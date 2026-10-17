import type { Constraint } from '../../generated/constraint'
import type { SolverRequest } from './contract'

// Recheck claims independently, including violations decidable in partial results.
export function evaluate(
  constraint: Constraint,
  input: SolverRequest,
  placements: SolverRequest['currentPlacements'],
) {
  if (!constraint.enabled) return { status: 'disabled', violated: false }
  const order = new Map(input.parts.map((p) => [p.partId, p.sortOrder]))
  const positions = new Map(
    placements
      .toSorted(
        (a, b) =>
          order.get(a.partId)! - order.get(b.partId)! || a.order - b.order,
      )
      .map((p, position) => [
        p.bandId,
        { position, part: order.get(p.partId)! },
      ]),
  )
  const ids =
    constraint.type === 'min_gap_member'
      ? input.memberships
          .filter((m) => m.memberId === constraint.targets.member_id)
          .map((m) => m.bandId)
      : constraint.type === 'before'
        ? [constraint.targets.before_band_id, constraint.targets.after_band_id]
        : constraint.type === 'at_position'
          ? [constraint.targets.band_id]
          : constraint.targets.band_ids
  const placed = ids.flatMap((id) => {
    const value = positions.get(id)
    return value ? [value] : []
  })
  const incomplete = placed.length !== ids.length
  let violated = false
  switch (constraint.type) {
    case 'min_gap_bands':
    case 'min_gap_member':
      violated = placed.some((a, i) =>
        placed
          .slice(i + 1)
          .some(
            (b) =>
              (!constraint.params.same_part_only || a.part === b.part) &&
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
      violated = placed.some((p) => p.position !== constraint.params.position)
      break
    case 'in_range': {
      const params = constraint.params
      violated = placed.some((p) =>
        params.kind === 'positions'
          ? p.position < params.position_from || p.position > params.position_to
          : !params.part_ids.includes(p.part),
      )
      break
    }
    case 'count': {
      const params = constraint.params
      const counts =
        params.scope === 'per_part'
          ? input.parts.map(
              (part) => placed.filter((p) => p.part === part.sortOrder).length,
            )
          : [placed.filter((p) => params.part_ids.includes(p.part)).length]
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
