import { useState } from 'react'

import type { Constraint } from '../../../generated/constraint'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import type { EventController } from '../hooks/useEvent'
import { constraintTargets } from '../model/constraintFilters'
import { ConstraintCollection } from './ConstraintCollection'
import { ConstraintForm } from './ConstraintForm'

export function RelatedConstraints({
  controller,
  bandId,
}: {
  controller: Pick<
    EventController,
    | 'event'
    | 'allConstraintViews'
    | 'processingMessage'
    | 'updateConstraints'
    | 'updateConstraint'
    | 'deleteConstraints'
    | 'saveConstraint'
    | 'saveConstraintBatch'
  >
  bandId: string
}) {
  const [editing, setEditing] = useState<Constraint | null | undefined>(
    undefined,
  )
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
      <div inert={Boolean(controller.processingMessage)}>
        <div className="flex justify-end px-2 py-1">
          <Button variant="subtle" onClick={() => setEditing(null)}>
            <Icon name="plus" />
            手動追加
          </Button>
        </div>
        <ConstraintCollection
          controller={controller}
          views={views}
          onEdit={setEditing}
          emptyMessage="このバンド・所属メンバーに関連する制約はありません。"
        />
        {editing !== undefined && (
          <ConstraintForm
            event={event}
            constraint={editing ?? undefined}
            initialBandId={bandId}
            onSave={controller.saveConstraint}
            onSaveMany={controller.saveConstraintBatch}
            onClose={() => setEditing(undefined)}
          />
        )}
      </div>
    </section>
  )
}
