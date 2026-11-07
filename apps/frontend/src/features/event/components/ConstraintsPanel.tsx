import { Button } from '../../../shared/ui/Button'
import { Panel } from '../../../shared/ui/Panel'
import type { EventController } from '../hooks/useEvent'
import { ConstraintCollection } from './ConstraintCollection'

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
      <div className="flex shrink-0 justify-end border-b border-line px-3 py-1 text-xs">
        <Button
          variant={controller.showUnmet ? 'primary' : 'ghost'}
          className="text-xs"
          aria-pressed={controller.showUnmet}
          onClick={() => controller.setShowUnmet(!controller.showUnmet)}
        >
          未達成のみ（{controller.unmetCount}）
        </Button>
      </div>
      <ConstraintCollection
        controller={controller}
        views={controller.constraintViews}
        emptyMessage={
          controller.showUnmet
            ? '未達成の条件はありません。未配置の対象がある条件は未判定です。'
            : undefined
        }
      />
    </Panel>
  )
}
