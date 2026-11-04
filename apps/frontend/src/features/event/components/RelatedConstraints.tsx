import { useState } from 'react'

import { memberLabel } from '../../../shared/model/event'
import { Select } from '../../../shared/ui/Input'
import type { EventController } from '../hooks/useEvent'
import { constraintTargets } from '../model/constraintFilters'
import { ConstraintCollection } from './ConstraintCollection'

export function RelatedConstraints({
  controller,
  bandId,
}: {
  controller: EventController
  bandId: string
}) {
  const [memberId, setMemberId] = useState('')
  const event = controller.event
  const band = event?.performances.find((item) => item.id === bandId)
  if (!event || !band) return null
  const views = controller.allConstraintViews.filter(({ constraint }) =>
    constraintTargets(constraint, event).bandIds.includes(bandId),
  )
  return (
    <section
      aria-label={`${band.name}の関連制約`}
      className="mt-5 border-t border-line pt-3"
    >
      <h3 className="mb-2 text-sm font-semibold">
        関連する制約（{views.length}件）
      </h3>
      <label className="text-xs">
        追加する制約の対象
        <Select
          className="mt-1 w-full"
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          disabled={Boolean(controller.processingMessage)}
        >
          <option value="">{band.name}（バンド）</option>
          {event.members
            .filter((m) => band.memberIds.includes(m.id))
            .map((m) => (
              <option key={m.id} value={m.id}>
                {memberLabel(event, m)}
              </option>
            ))}
        </Select>
      </label>
      <div inert={Boolean(controller.processingMessage)}>
        <ConstraintCollection
          controller={controller}
          views={views}
          initialDraft={
            memberId
              ? { type: 'min_gap_member', memberId }
              : {
                  type: 'in_range',
                  bandIds: [bandId],
                  beforeId: bandId,
                  rangeKind: 'parts',
                }
          }
          emptyMessage="このバンド・所属メンバーに関連する制約はありません。"
        />
      </div>
    </section>
  )
}
