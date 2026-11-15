import type { AIChatInput } from './types.ts'

// Facts derived only from saved context. No Solver inference or pending proposal.
export function buildChatStatistics(context: AIChatInput['context']) {
  const bandIds = context.bands.map((band) => band.bandId)
  const knownBands = new Set(bandIds)
  const partOrders = new Set(context.parts.map((part) => part.sortOrder))
  const basis = context.constraints.flatMap((constraint) =>
    constraint.enabled &&
    constraint.hardness === 'hard' &&
    constraint.type === 'in_range' &&
    constraint.params.kind === 'parts' &&
    constraint.params.part_ids.length === 1 &&
    partOrders.has(constraint.params.part_ids[0])
      ? [
          {
            constraintId: constraint.constraint_id,
            partSortOrder: constraint.params.part_ids[0],
            bandIds: constraint.targets.band_ids.filter((id) =>
              knownBands.has(id),
            ),
          },
        ]
      : [],
  )
  const fixed = new Set(basis.flatMap((item) => item.bandIds))
  const partOrder = new Map(context.parts.map((p) => [p.partId, p.sortOrder]))
  const placements = context.currentPlacements.toSorted(
    (a, b) =>
      partOrder.get(a.partId)! - partOrder.get(b.partId)! || a.order - b.order,
  )
  const placed = new Set(placements.map((p) => p.bandId))
  const memberAppearances = context.members.map(({ memberId }) => {
    const bands = new Set(
      context.memberships
        .filter((m) => m.memberId === memberId)
        .map((m) => m.bandId),
    )
    const appearances = placements.flatMap((p, position) =>
      bands.has(p.bandId) ? [{ ...p, position }] : [],
    )
    return {
      memberId,
      placedBandIds: appearances.map((p) => p.bandId),
      unplacedBandIds: bandIds.filter((id) => bands.has(id) && !placed.has(id)),
      gaps: appearances.slice(1).map((p, index) => ({
        beforeBandId: appearances[index].bandId,
        afterBandId: p.bandId,
        bandsBetween: p.position - appearances[index].position - 1,
        samePart: p.partId === appearances[index].partId,
      })),
    }
  })
  return {
    totals: {
      bands: bandIds.length,
      members: context.members.length,
      placedBands: placed.size,
      unplacedBands: bandIds.filter((id) => !placed.has(id)).length,
    },
    parts: context.parts
      .toSorted((a, b) => a.sortOrder - b.sortOrder)
      .map((p) => ({
        partId: p.partId,
        placedBandCount: placements.filter((item) => item.partId === p.partId)
          .length,
      })),
    partFixing: {
      fixedCount: fixed.size,
      unfixedCount: bandIds.length - fixed.size,
      fixedBandIds: bandIds.filter((id) => fixed.has(id)),
      unfixedBandIds: bandIds.filter((id) => !fixed.has(id)),
      basis,
    },
    gapConditions: context.constraints.flatMap((c) =>
      c.type === 'min_gap_member' || c.type === 'min_gap_bands'
        ? [
            {
              constraintId: c.constraint_id,
              enabled: c.enabled,
              hardness: c.hardness,
              targets: c.targets,
              minBandsBetween: c.params.min_diff - 1,
              samePartOnly: c.params.same_part_only,
            },
          ]
        : [],
    ),
    memberAppearances,
  }
}
