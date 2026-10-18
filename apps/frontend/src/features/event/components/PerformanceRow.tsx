import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { Icon } from '../../../shared/ui/Icon'
import { NumberField } from '../../../shared/ui/NumberField'
import type { PerformanceRow as Row, PerformanceView } from '../model/types'

export const rowColumns =
  'grid min-w-[680px] grid-cols-[36px_45px_62px_minmax(140px,1fr)_minmax(120px,0.8fr)_minmax(160px,1.4fr)] items-center gap-1 px-3'

export function PerformanceRow({
  row,
  capacity,
  onFixed,
  onOrder,
}: {
  row: Row & { performance: PerformanceView }
  capacity: number
  onFixed: (id: string, fixed: boolean) => void
  onOrder: (id: string, value: number | null) => void
}) {
  const performance = row.performance
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: performance.id,
    disabled: { draggable: performance.fixed, droppable: performance.fixed },
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-performance={performance.id}
      className={`${rowColumns} relative min-h-[42px] border-b border-line/55 bg-white transition-colors hover:bg-canvas/65 ${isDragging ? 'z-10 bg-wash opacity-35' : ''}`}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        disabled={performance.fixed}
        aria-label={`${performance.name}を並べ替え`}
        title={
          performance.fixed
            ? '固定を解除すると移動できます'
            : 'ドラッグ／Spaceで開始・確定、↑↓で移動、Escで取消'
        }
        className="flex size-8 cursor-grab touch-none items-center justify-center rounded text-muted hover:bg-wash hover:text-brand focus-visible:bg-wash active:cursor-grabbing disabled:cursor-default disabled:opacity-35"
      >
        <Icon name="grip" className="size-[18px]" />
      </button>
      <label className="flex justify-center">
        <input
          type="checkbox"
          aria-label={`${performance.name}を固定`}
          disabled={row.order === null}
          title="解除すると、この出演枠の有効なハードの位置指定を削除します"
          checked={performance.fixed}
          onChange={(event) => onFixed(performance.id, event.target.checked)}
        />
      </label>
      <NumberField
        label={`${performance.name}の出演順`}
        value={row.order}
        max={capacity}
        allowEmpty
        disabled={performance.fixed}
        onCommit={(value) => onOrder(performance.id, value)}
      />
      <span
        className="min-w-0 truncate px-1 py-1 text-left font-medium text-brand"
        title={performance.name}
      >
        {performance.name}
      </span>
      <span
        className="min-w-0 truncate text-[13px] text-muted"
        title={performance.members.join('・')}
      >
        {performance.members.join('・')}
      </span>
      <span
        className="min-w-0 truncate text-[13px] text-muted"
        title={performance.description ?? undefined}
      >
        {performance.description}
      </span>
    </div>
  )
}

export function EmptyPerformanceRow({ row }: { row: Row }) {
  const { setNodeRef, isOver } = useSortable({
    id: row.key,
    disabled: { draggable: true },
  })
  return (
    <div
      ref={setNodeRef}
      className={`${rowColumns} min-h-[42px] border-b border-line/55 ${isOver ? 'bg-brand/10 ring-1 ring-brand/40 ring-inset' : 'bg-canvas/30'}`}
    >
      <span />
      <span />
      <span className="pl-2 text-muted/60 tabular-nums">
        {row.order ?? '—'}
      </span>
      <span className="col-span-3 text-xs text-muted/70">
        空き枠 · ここにドラッグして配置
      </span>
    </div>
  )
}
