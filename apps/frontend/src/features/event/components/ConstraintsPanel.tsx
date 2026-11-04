import { Panel } from '../../../shared/ui/Panel'
import type { EventController } from '../hooks/useEvent'
import { ConstraintCollection } from './ConstraintCollection'
import { ConstraintFilters } from './ConstraintFilters'

export function ConstraintsPanel({
  controller,
}: {
  controller: EventController
}) {
  if (!controller.event) return null
  return (
    <Panel
      title="制約"
      busyMessage={controller.processingMessage}
      inert={Boolean(controller.processingMessage)}
      detail={
        <span className="text-xs text-muted">
          {controller.event.constraints.length}件
        </span>
      }
    >
      <ConstraintFilters controller={controller} />
      <ConstraintCollection
        controller={controller}
        views={controller.constraintViews}
        emptyMessage={
          controller.event.constraints.length
            ? '条件に一致する制約はありません。絞り込みを変更してください。未判定は未達成に含めません。'
            : undefined
        }
      />
    </Panel>
  )
}
