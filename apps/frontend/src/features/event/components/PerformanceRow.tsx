import { NumberField } from '../../../shared/ui/NumberField'
import type { PerformanceRow as Row, PerformanceView } from '../model/types'

export const rowColumns =
  'grid min-w-[520px] grid-cols-[30px_45px_62px_minmax(140px,1fr)_minmax(140px,1.1fr)] items-center gap-1 px-3'

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
  return (
    <div
      data-performance={performance.id}
      className={`${rowColumns} relative min-h-[42px] border-b border-line/55 bg-white transition-colors hover:bg-canvas/65`}
    >
      <span />
      <label className="flex justify-center">
        <input
          type="checkbox"
          aria-label={`${performance.name}を固定`}
          disabled={row.order === null}
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
        className="min-w-0 truncate pr-2 font-medium"
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
    </div>
  )
}

export function EmptyPerformanceRow({ row }: { row: Row }) {
  return (
    <div
      className={`${rowColumns} min-h-[42px] border-b border-line/55 bg-canvas/30`}
    >
      <span />
      <span />
      <span className="pl-2 text-muted/60 tabular-nums">{row.order}</span>
      <span className="col-span-2 text-xs text-muted/70">空き枠</span>
    </div>
  )
}
