import type { Constraint } from '../../generated/constraint'
import type { ConstraintResultStatus, Placement, SolverRequest } from './types'

export function targetBandIds(
  constraint: Constraint,
  input: SolverRequest,
): string[] {
  switch (constraint.type) {
    case 'min_gap_member':
      return input.memberships
        .filter((row) => row.memberId === constraint.targets.member_id)
        .map((row) => row.bandId)
    case 'before':
      return [
        constraint.targets.before_band_id,
        constraint.targets.after_band_id,
      ]
    case 'at_position':
      return [constraint.targets.band_id]
    default:
      return constraint.targets.band_ids
  }
}

// Re-evaluate the response, including violations already decidable in a partial placement.
export function evaluateConstraint(
  constraint: Constraint,
  input: SolverRequest,
  placements: Placement[],
): { status: ConstraintResultStatus; violated: boolean } {
  if (!constraint.enabled) return { status: 'disabled', violated: false }
  const partOrders = new Map(
    input.parts.map((part) => [part.partId, part.sortOrder]),
  )
  const ordered = placements.toSorted(
    (a, b) =>
      partOrders.get(a.partId)! - partOrders.get(b.partId)! ||
      a.order - b.order,
  )
  const positions = new Map(
    ordered.map((row, position) => [
      row.bandId,
      { ...row, position, part: partOrders.get(row.partId)! },
    ]),
  )
  const ids = targetBandIds(constraint, input)
  const placed = ids.flatMap((id) => {
    const value = positions.get(id)
    return value ? [value] : []
  })
  const incomplete = placed.length !== ids.length
  let violated = false
  switch (constraint.type) {
    case 'min_gap_member':
    case 'min_gap_bands':
      violated = placed.some((a, i) =>
        placed
          .slice(i + 1)
          .some(
            (b) =>
              !(constraint.params.same_part_only && a.part !== b.part) &&
              Math.abs(a.position - b.position) < constraint.params.min_diff,
          ),
      )
      break
    case 'before': {
      const a = positions.get(constraint.targets.before_band_id)
      const b = positions.get(constraint.targets.after_band_id)
      violated = Boolean(a && b && a.position >= b.position)
      break
    }
    case 'at_position':
      violated = placed.some(
        (row) => row.position !== constraint.params.position,
      )
      break
    case 'in_range': {
      const params = constraint.params
      violated = placed.some((row) =>
        params.kind === 'positions'
          ? row.position < params.position_from ||
            row.position > params.position_to
          : !params.part_ids.includes(row.part),
      )
      break
    }
    case 'count': {
      const params = constraint.params
      const counts =
        params.scope === 'per_part'
          ? input.parts.map(
              (part) =>
                placed.filter((row) => row.part === part.sortOrder).length,
            )
          : [placed.filter((row) => params.part_ids.includes(row.part)).length]
      violated = counts.some(
        (count) => count > params.max || (!incomplete && count < params.min),
      )
      break
    }
  }
  return {
    status: incomplete ? 'unchecked' : violated ? 'unmet' : 'met',
    violated,
  }
}
