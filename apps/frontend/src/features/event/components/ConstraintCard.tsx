import type { Constraint } from '../../../generated/constraint'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import type { EventController } from '../hooks/useEvent'
import { constraintTone } from '../model/constraintGroups'
import type { ConstraintPatch } from '../model/eventReducer'
import { ConstraintControls } from './ConstraintControls'

export function ConstraintCard({
  view,
  onUpdate,
  onEdit,
  onDelete,
}: {
  view: EventController['constraintViews'][number]
  onUpdate: (patch: ConstraintPatch) => void
  onEdit: (constraint: Constraint) => void
  onDelete: (constraints: Constraint[]) => void
}) {
  const { constraint, text, status, detail } = view
  return (
    <article
      className={`rounded-lg border p-2 ${constraintTone(constraint.enabled, constraint.hardness, status)}`}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-1"
          aria-label={`${text}を有効にする`}
          checked={constraint.enabled}
          onChange={(event) => onUpdate({ enabled: event.target.checked })}
        />
        <h3
          className={`min-w-0 flex-1 text-sm leading-5 ${constraint.enabled ? '' : 'text-muted line-through'}`}
        >
          {text}
        </h3>
        <div className="flex shrink-0 items-center gap-0">
          <Button
            variant="ghost"
            className="min-h-8 px-1.5"
            aria-label={`${text}を編集`}
            title="編集"
            onClick={() => onEdit(constraint)}
          >
            <Icon name="edit" />
          </Button>
          <Button
            variant="ghost"
            className="min-h-8 px-1.5 hover:text-red-600"
            aria-label={`${text}を削除`}
            title="削除"
            onClick={() => onDelete([constraint])}
          >
            <Icon name="trash" />
          </Button>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <ConstraintControls
          label={text}
          hardness={constraint.hardness}
          priority={constraint.priority}
          onHardness={(hardness) => onUpdate({ hardness })}
          onPriority={(priority) => onUpdate({ priority })}
        />
        {(status === 'unmet' || status === 'invalid') && (
          <p
            className={`min-w-0 text-xs leading-5 ${constraint.hardness === 'hard' ? 'text-red-700' : 'text-amber-800'}`}
          >
            {detail}
          </p>
        )}
      </div>
    </article>
  )
}
