import { useState } from 'react'

import type { Constraint } from '../../../generated/constraint'
import { describeConstraint } from '../../../shared/model/constraints'
import { Button } from '../../../shared/ui/Button'
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog'
import { Icon } from '../../../shared/ui/Icon'
import { Panel } from '../../../shared/ui/Panel'
import type { EventController } from '../hooks/useEvent'
import { constraintTone, groupConstraintViews } from '../model/constraintGroups'
import { ConstraintControls } from './ConstraintControls'
import { ConstraintForm } from './ConstraintForm'
import { ConstraintGroupCard } from './ConstraintGroupCard'

export function ConstraintsPanel({
  controller,
}: {
  controller: EventController
}) {
  const [editing, setEditing] = useState<Constraint | null | undefined>(
    undefined,
  )
  const [deleting, setDeleting] = useState<Constraint[] | null>(null)
  const event = controller.event
  if (!event) return null
  return (
    <Panel
      inert={
        controller.saving ||
        controller.solving ||
        controller.refreshing ||
        controller.sending
      }
      title="制約"
      detail={
        <span className="text-xs text-muted">{event.constraints.length}件</span>
      }
      action={
        <Button variant="subtle" onClick={() => setEditing(null)}>
          <Icon name="plus" />
          手動追加
        </Button>
      }
    >
      <div className="flex shrink-0 items-center justify-end border-b border-line px-3 py-2 text-xs">
        <Button
          variant={controller.showUnmet ? 'primary' : 'ghost'}
          className="text-xs"
          aria-pressed={controller.showUnmet}
          onClick={() => controller.setShowUnmet(!controller.showUnmet)}
        >
          未達成のみ（{controller.unmetCount}）
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2 wrap-anywhere">
        {groupConstraintViews(controller.constraintViews).map(({ views }) => {
          if (views.length > 1)
            return (
              <ConstraintGroupCard
                key={views[0].constraint.constraint_id}
                event={event}
                views={views}
                onUpdate={(patch) => {
                  for (const view of views)
                    controller.updateConstraint(
                      view.constraint.constraint_id,
                      patch,
                    )
                }}
                onEdit={setEditing}
                onDelete={setDeleting}
              />
            )
          const [{ constraint, text, status, detail }] = views
          return (
            <article
              key={constraint.constraint_id}
              className={`rounded-lg border p-3 ${constraintTone(constraint.enabled, constraint.hardness, status)}`}
            >
              <div className="mb-3 flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  aria-label={`${text}を有効にする`}
                  checked={constraint.enabled}
                  onChange={(change) =>
                    controller.updateConstraint(constraint.constraint_id, {
                      enabled: change.target.checked,
                    })
                  }
                />
                <h3
                  className={`min-w-0 flex-1 text-sm leading-6 ${constraint.enabled ? '' : 'text-muted line-through'}`}
                >
                  {text}
                </h3>
              </div>
              <ConstraintControls
                label={text}
                hardness={constraint.hardness}
                priority={constraint.priority}
                onHardness={(hardness) =>
                  controller.updateConstraint(constraint.constraint_id, {
                    hardness,
                  })
                }
                onPriority={(priority) =>
                  controller.updateConstraint(constraint.constraint_id, {
                    priority,
                  })
                }
              />
              <p
                className={`mt-3 text-xs leading-6 ${status === 'met' ? 'text-emerald-700' : status === 'unmet' || status === 'invalid' ? (constraint.hardness === 'hard' ? 'text-red-700' : 'text-amber-800') : 'text-muted'}`}
              >
                {status === 'met' ? '✓ ' : ''}
                {detail}
              </p>
              <div className="mt-2 flex justify-end gap-1 border-t border-line/60 pt-2">
                <Button
                  variant="ghost"
                  className="px-2"
                  aria-label={`${text}を編集`}
                  onClick={() => setEditing(constraint)}
                >
                  <Icon name="edit" />
                  編集
                </Button>
                <Button
                  variant="ghost"
                  className="px-2 hover:text-red-600"
                  aria-label={`${text}を削除`}
                  onClick={() => setDeleting([constraint])}
                >
                  <Icon name="trash" />
                  削除
                </Button>
              </div>
            </article>
          )
        })}
        {!controller.constraintViews.length && (
          <p className="py-8 text-center text-sm leading-7 text-muted">
            {controller.showUnmet
              ? '未達成の条件はありません。未配置の対象がある条件は未判定です。'
              : '制約はまだありません。「手動追加」から種類を選んで追加できます。'}
          </p>
        )}
      </div>
      {editing !== undefined && (
        <ConstraintForm
          event={event}
          constraint={editing ?? undefined}
          onSave={controller.saveConstraint}
          onClose={() => setEditing(undefined)}
        />
      )}
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
            for (const constraint of deleting)
              controller.deleteConstraint(constraint.constraint_id)
            setDeleting(null)
          }}
        />
      )}
    </Panel>
  )
}
