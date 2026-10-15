import { DndContext, DragOverlay } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { ReactNode } from 'react'

import { Icon } from '../../../shared/ui/Icon'
import type { EventController } from '../hooks/useEvent'
import { useScheduleDnd } from '../hooks/useScheduleDnd'

export function UnassignedDropZone({ children }: { children: ReactNode }) {
  const { setNodeRef, isOver } = useSortable({
    id: 'unassigned',
    disabled: { draggable: true },
  })
  return (
    <div
      ref={setNodeRef}
      className={isOver ? 'ring-2 ring-brand/40 ring-inset' : ''}
    >
      {children}
    </div>
  )
}

export function ScheduleDragSurface({
  controller,
  children,
}: {
  controller: EventController
  children: ReactNode
}) {
  const dnd = useScheduleDnd(controller.move)
  if (!controller.schedule || !controller.event) return null
  const rows = [
    ...controller.schedule.sections.flatMap((section) => section.rows),
    ...controller.schedule.unassigned,
  ]
  const active = controller.event.performances.find(
    (band) => band.id === dnd.activeId,
  )
  const describe = (id: string | number) => {
    const row = rows.find((row) => row.key === String(id))
    return row
      ? `${row.performance?.name ?? '空き枠'}（${row.order === null ? '未配置' : `${row.order}番`}）`
      : '未配置一覧'
  }
  return (
    <DndContext
      sensors={dnd.sensors}
      collisionDetection={dnd.collisionDetection}
      onDragStart={dnd.onDragStart}
      onDragEnd={dnd.onDragEnd}
      onDragCancel={dnd.onDragCancel}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            'Spaceで持ち上げ、上下の矢印キーで移動先を選び、Spaceで確定します。Escapeでキャンセルします。',
        },
        announcements: {
          onDragStart: ({ active }) =>
            `${describe(active.id)}を持ち上げました。`,
          onDragOver: ({ over }) =>
            over ? `移動先：${describe(over.id)}` : '移動先の外です。',
          onDragEnd: ({ over }) =>
            over
              ? `${describe(over.id)}への移動を確認しました。結果は出演順・通知をご確認ください。`
              : '移動を取り消しました。',
          onDragCancel: () => '移動を取り消しました。',
        },
      }}
    >
      <SortableContext
        items={[...rows.map((row) => row.key), 'unassigned']}
        strategy={verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
      <DragOverlay>
        {active ? (
          <div className="flex items-center gap-3 rounded-lg border border-brand/30 bg-white p-4 shadow-lg">
            <Icon name="grip" />
            <span>{active.name}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
