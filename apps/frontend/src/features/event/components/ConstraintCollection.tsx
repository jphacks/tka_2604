import { useState } from 'react'

import type { Constraint } from '../../../generated/constraint'
import { describeConstraint } from '../../../shared/model/constraints'
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog'
import type { EventController } from '../hooks/useEvent'
import { groupConstraintViews } from '../model/constraintGroups'
import { ConstraintCard } from './ConstraintCard'
import { ConstraintGroupCard } from './ConstraintGroupCard'

export function ConstraintCollection({
  controller,
  views,
  onEdit,
  emptyMessage = '制約はまだありません。「手動追加」から種類を選んで追加できます。',
}: {
  controller: EventController
  views: EventController['constraintViews']
  onEdit: (constraint: Constraint) => void
  emptyMessage?: string
}) {
  const [deleting, setDeleting] = useState<Constraint[] | null>(null)
  const event = controller.event
  if (!event) return null
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2 wrap-anywhere">
        {groupConstraintViews(views).map(({ key, views: group }) =>
          group.length > 1 ? (
            <ConstraintGroupCard
              key={key}
              event={event}
              views={group}
              onUpdate={(patch) =>
                controller.updateConstraints(
                  group.map((view) => view.constraint.constraint_id),
                  patch,
                )
              }
              onEdit={onEdit}
              onDelete={setDeleting}
            />
          ) : (
            <ConstraintCard
              key={key}
              view={group[0]}
              onUpdate={(patch) =>
                controller.updateConstraint(
                  group[0].constraint.constraint_id,
                  patch,
                )
              }
              onEdit={onEdit}
              onDelete={setDeleting}
            />
          ),
        )}
        {!views.length && (
          <p className="py-6 text-center text-sm leading-6 text-muted">
            {emptyMessage}
          </p>
        )}
      </div>
      {deleting && (
        <ConfirmDialog
          title="制約を削除"
          message={
            deleting.length === 1
              ? `「${describeConstraint(deleting[0], event)}」を削除します。位置固定の条件を削除すると固定も解除されます。`
              : `${deleting.length}件の制約をまとめて削除します。`
          }
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            controller.deleteConstraints(deleting.map((c) => c.constraint_id))
            setDeleting(null)
          }}
        />
      )}
    </div>
  )
}
