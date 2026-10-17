import { useState } from 'react'

import type { Constraint } from '../../../generated/constraint'
import { describeConstraint } from '../../../shared/model/constraints'
import { Button } from '../../../shared/ui/Button'
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog'
import { Icon } from '../../../shared/ui/Icon'
import { Panel } from '../../../shared/ui/Panel'
import type { EventController } from '../hooks/useEvent'
import { ConstraintControls } from './ConstraintControls'
import { ConstraintForm } from './ConstraintForm'

export function ConstraintsPanel({
  controller,
}: {
  controller: EventController
}) {
  const [editing, setEditing] = useState<Constraint | null | undefined>(
    undefined,
  )
  const [deleting, setDeleting] = useState<Constraint | null>(null)
  const event = controller.event
  if (!event) return null
  return (
    <Panel
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
      <div className="max-h-[75dvh] min-h-0 space-y-2 overflow-y-auto p-2 xl:max-h-none xl:flex-1">
        {controller.constraintViews.map(
          ({ constraint, text, status, detail }) => (
            <article
              key={constraint.constraint_id}
              className={`rounded-lg border p-3 ${status === 'unmet' && constraint.hardness === 'hard' ? 'border-red-200 bg-red-50/30' : 'border-line'}`}
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
                  className={`flex-1 text-sm leading-6 ${constraint.enabled ? '' : 'text-muted line-through'}`}
                >
                  {text}
                </h3>
                <Button
                  variant="ghost"
                  className="px-1.5"
                  aria-label={`${text}を編集`}
                  onClick={() => setEditing(constraint)}
                >
                  <Icon name="edit" />
                </Button>
                <Button
                  variant="ghost"
                  className="px-1.5 hover:text-red-600"
                  aria-label={`${text}を削除`}
                  onClick={() => setDeleting(constraint)}
                >
                  <Icon name="trash" />
                </Button>
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
                className={`mt-3 text-xs leading-6 ${status === 'met' ? 'text-emerald-700' : status === 'unmet' || status === 'invalid' ? 'text-red-700' : 'text-muted'}`}
              >
                {status === 'met' ? '✓ ' : ''}
                {detail}
              </p>
            </article>
          ),
        )}
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
          message={`「${describeConstraint(deleting, event)}」を削除します。位置固定の条件を削除すると固定も解除されます。`}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            controller.deleteConstraint(deleting.constraint_id)
            setDeleting(null)
          }}
        />
      )}
    </Panel>
  )
}
