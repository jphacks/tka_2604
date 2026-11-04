import type { Constraint } from '../../../generated/constraint'
import {
  type ConstraintStatus,
  targetBandIds,
} from '../../../shared/model/constraints'
import type { EventData } from '../../../shared/model/event'

export interface ConstraintFilters {
  query: string
  type: Constraint['type'] | ''
  bandId: string
  memberId: string
  status: ConstraintStatus | ''
}
export const emptyConstraintFilters: ConstraintFilters = {
  query: '',
  type: '',
  bandId: '',
  memberId: '',
  status: '',
}

export function constraintTargets(constraint: Constraint, event: EventData) {
  const bandIds = targetBandIds(constraint, event)
  const memberIds =
    constraint.type === 'min_gap_member'
      ? [constraint.targets.member_id]
      : [
          ...new Set(
            event.performances
              .filter((band) => bandIds.includes(band.id))
              .flatMap((band) => band.memberIds),
          ),
        ]
  return { bandIds, memberIds }
}
export function filterConstraintViews<
  T extends { constraint: Constraint; text: string; status: ConstraintStatus },
>(
  views: T[],
  event: EventData,
  filters: ConstraintFilters,
  unmetOnly: boolean,
) {
  const query = filters.query.trim().toLocaleLowerCase()
  return views.filter((view) => {
    const { constraint, status } = view
    if (unmetOnly && status !== 'unmet' && status !== 'invalid') return false
    if (filters.status && status !== filters.status) return false
    if (filters.type && constraint.type !== filters.type) return false
    const targets = constraintTargets(constraint, event)
    if (filters.bandId && !targets.bandIds.includes(filters.bandId))
      return false
    if (filters.memberId && !targets.memberIds.includes(filters.memberId))
      return false
    const names = [
      view.text,
      constraint.source_text ?? '',
      ...event.performances
        .filter((b) => targets.bandIds.includes(b.id))
        .map((b) => b.name),
      ...event.members
        .filter((m) => targets.memberIds.includes(m.id))
        .map((m) => m.name),
    ]
    return !query || names.join(' ').toLocaleLowerCase().includes(query)
  })
}
