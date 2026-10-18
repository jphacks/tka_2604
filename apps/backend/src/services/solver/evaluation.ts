import type { Constraint } from '../../generated/constraint'

// Local shapes keep this module free of Solver/DB imports, since chat RPC types
// (shared with the frontend) reach it through violations.
type Placement = { bandId: string; partId: string; order: number }
type Roster = {
  parts: { partId: string; sortOrder: number }[]
  memberships: { bandId: string; memberId: string }[]
}

// Positions are 0-based over all placed bands; parts are sortOrder values.
export type Violation =
  | {
      kind: 'too_close'
      bandIds: [string, string]
      positions: [number, number]
      minDiff: number
    }
  | {
      kind: 'order'
      beforeBandId: string
      afterBandId: string
      positions: [number, number]
    }
  | { kind: 'out_of_position'; bandId: string; position: number; part: number }
  | { kind: 'count'; parts: number[]; count: number; min: number; max: number }

export type Evaluation = {
  status: 'disabled' | 'unchecked' | 'met' | 'unmet'
  violated: boolean
  violations: Violation[]
}

// Recheck claims independently, including violations decidable in partial results.
export function evaluate(
  constraint: Constraint,
  input: Roster,
  placements: Placement[],
): Evaluation {
  if (!constraint.enabled)
    return { status: 'disabled', violated: false, violations: [] }
  const order = new Map(input.parts.map((p) => [p.partId, p.sortOrder]))
  const positions = new Map(
    placements
      .toSorted(
        (a, b) =>
          order.get(a.partId)! - order.get(b.partId)! || a.order - b.order,
      )
      .map((p, position) => [
        p.bandId,
        { bandId: p.bandId, position, part: order.get(p.partId)! },
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
  const violations: Violation[] = []
  switch (constraint.type) {
    case 'min_gap_bands':
    case 'min_gap_member': {
      const { min_diff, same_part_only } = constraint.params
      placed.forEach((a, i) => {
        for (const b of placed.slice(i + 1))
          if (
            (!same_part_only || a.part === b.part) &&
            Math.abs(a.position - b.position) < min_diff
          ) {
            const [first, second] = a.position < b.position ? [a, b] : [b, a]
            violations.push({
              kind: 'too_close',
              bandIds: [first.bandId, second.bandId],
              positions: [first.position, second.position],
              minDiff: min_diff,
            })
          }
      })
      break
    }
    case 'before': {
      const a = positions.get(constraint.targets.before_band_id)
      const b = positions.get(constraint.targets.after_band_id)
      if (a && b && a.position >= b.position)
        violations.push({
          kind: 'order',
          beforeBandId: a.bandId,
          afterBandId: b.bandId,
          positions: [a.position, b.position],
        })
      break
    }
    case 'at_position':
    case 'in_range': {
      const params = constraint.params
      for (const p of placed)
        if (
          'position' in params
            ? p.position !== params.position
            : params.kind === 'positions'
              ? p.position < params.position_from ||
                p.position > params.position_to
              : !params.part_ids.includes(p.part)
        )
          violations.push({
            kind: 'out_of_position',
            bandId: p.bandId,
            position: p.position,
            part: p.part,
          })
      break
    }
    case 'count': {
      const params = constraint.params
      const groups =
        params.scope === 'per_part'
          ? input.parts.map((part) => [part.sortOrder])
          : [params.part_ids]
      for (const parts of groups) {
        const count = placed.filter((p) => parts.includes(p.part)).length
        if (count > params.max || (!incomplete && count < params.min))
          violations.push({
            kind: 'count',
            parts,
            count,
            min: params.min,
            max: params.max,
          })
      }
      break
    }
  }
  const violated = violations.length > 0
  return {
    status: incomplete ? 'unchecked' : violated ? 'unmet' : 'met',
    violated,
    violations,
  }
}
