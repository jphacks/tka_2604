import { useState } from 'react'

import type { Constraint } from '../../../generated/constraint'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { Panel } from '../../../shared/ui/Panel'
import type { EventController } from '../hooks/useEvent'
import { ConstraintCollection } from './ConstraintCollection'
import { ConstraintFilters } from './ConstraintFilters'
import { ConstraintForm } from './ConstraintForm'

export function ConstraintsPanel({
  controller,
}: {
  controller: EventController
}) {
  const [editing, setEditing] = useState<Constraint | null | undefined>(
    undefined,
  )
  if (!controller.event) return null
  return (
    <Panel
      title="制約"
      busy={Boolean(controller.processingMessage)}
      inert={Boolean(controller.processingMessage)}
      detail={
        <span className="text-xs text-muted">
          {controller.event.constraints.length}件
        </span>
      }
      action={
        <Button
          variant="subtle"
          className="min-h-8 px-2 text-xs"
          disabled={Boolean(controller.processingMessage)}
          onClick={() => setEditing(null)}
        >
          <Icon name="plus" />
          手動追加
        </Button>
      }
    >
      <ConstraintFilters controller={controller} />
      <ConstraintCollection
        controller={controller}
        views={controller.constraintViews}
        onEdit={setEditing}
        emptyMessage={
          controller.event.constraints.length
            ? '条件に一致する制約はありません。絞り込みを変更してください。未判定は未達成に含めません。'
            : undefined
        }
      />
      {editing !== undefined && (
        <ConstraintForm
          event={controller.event}
          constraint={editing ?? undefined}
          onSaveMany={controller.saveConstraintBatch}
          onSave={controller.saveConstraint}
          onClose={() => setEditing(undefined)}
        />
      )}
    </Panel>
  )
}
