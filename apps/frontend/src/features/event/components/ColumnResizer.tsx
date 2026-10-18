import type { ColumnHandle, useColumnResize } from '../hooks/useColumnResize'

const STEP = 16

export function ColumnResizer({
  handle,
  label,
  right,
  columns,
}: {
  handle: ColumnHandle
  label: string
  right: number
  columns: ReturnType<typeof useColumnResize>
}) {
  return (
    <button
      type="button"
      aria-label={`${label}（左右キーで調整、ダブルクリックで元に戻す）`}
      title="ドラッグで幅を変更（ダブルクリックで元に戻す）"
      onPointerDown={columns.startDrag(handle)}
      onDoubleClick={columns.reset}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        event.preventDefault()
        columns.resize(
          handle,
          event.key === 'ArrowLeft' ? -STEP : STEP,
          event.currentTarget,
        )
      }}
      style={{ right }}
      className="group absolute inset-y-0 z-20 hidden w-2 translate-x-1/2 cursor-col-resize touch-none outline-none xl:block"
    >
      <span
        className={`mx-auto block h-full w-0.5 transition-colors group-hover:bg-brand/40 group-focus-visible:bg-brand ${columns.dragging ? 'bg-brand/40' : ''}`}
      />
    </button>
  )
}
