import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { type EventData, positions } from '../../../shared/model/event'
import { Button } from '../../../shared/ui/Button'
import { slideFrom } from '../../../shared/ui/flip'

type View = 'before' | 'after'

// FLIP: measure every row after each view change, then start each row at its
// old spot and let it slide to the new one. Rows are keyed by band ID, so a
// band moving across parts animates too.
function useFlip(view: View) {
  const rows = useRef(new Map<string, HTMLLIElement>())
  const last = useRef(new Map<string, DOMRect>())
  const measure = () =>
    new Map(
      [...rows.current].map(([id, row]) => [id, row.getBoundingClientRect()]),
    )
  useLayoutEffect(() => {
    const previous = last.current
    const current = measure()
    for (const [id, row] of rows.current) {
      const from = previous.get(id)
      if (from)
        slideFrom(row, from.top - current.get(id)!.top, { duration: 450 })
    }
    last.current = current
  }, [view])
  // The dialog opens after this component mounts, so the first measurement
  // sees hidden rows. Measure again once it is on screen.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      last.current = measure()
    })
    return () => cancelAnimationFrame(frame)
  }, [])
  return (id: string) => (row: HTMLLIElement | null) => {
    if (row) rows.current.set(id, row)
    else rows.current.delete(id)
  }
}

export function ReorderPreview({
  event,
  next,
}: {
  event: EventData
  next: EventData
}) {
  // Opens on the old order and stays there until the person plays it.
  const [view, setView] = useState<View>('before')
  const ref = useFlip(view)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const play = () => {
    clearTimeout(timer.current)
    setView('before')
    timer.current = setTimeout(() => setView('after'), 400)
  }
  const before = positions(event)
  const after = positions(next)
  const shown = view === 'before' ? event : next
  const name = (id: string) =>
    event.performances.find((band) => band.id === id)?.name ?? '不明な出演枠'
  const moved = [...after].filter(
    ([id, to]) => before.get(id)?.position !== to.position,
  ).length
  return (
    <section aria-label="並べ替えの前後" className="mt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label="表示する並び"
          className="inline-flex rounded-md border border-line p-0.5 text-xs"
        >
          {(['before', 'after'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => {
                clearTimeout(timer.current)
                setView(value)
              }}
              className={`rounded px-3 py-1 ${view === value ? 'bg-brand text-white' : 'text-muted hover:text-brand'}`}
            >
              {value === 'before' ? '変更前' : '変更後'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>{moved}組が移動</span>
          <Button className="text-xs" variant="ghost" onClick={play}>
            再生
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        {shown.sections.map((section, index) => (
          <div key={section.id}>
            <h3 className="mb-1 text-xs font-semibold">
              {section.name || `第${index + 1}部`}
            </h3>
            <ol className="space-y-1 text-sm">
              {section.slots.flatMap((id) => {
                if (id === null) return []
                const from = before.get(id)?.position
                const to = after.get(id)?.position
                const shift =
                  from !== undefined && to !== undefined ? from - to : 0
                const position = (view === 'before' ? from : to) ?? 0
                return (
                  <li
                    key={id}
                    ref={ref(id)}
                    data-moved={shift !== 0}
                    className={`relative flex items-center justify-between gap-3 rounded-md border px-2 py-1 ${shift ? 'border-brand/40 bg-wash' : 'border-transparent'}`}
                  >
                    <span>
                      {position + 1}. {name(id)}
                    </span>
                    {shift !== 0 && (
                      <span
                        className="text-xs font-medium text-brand"
                        aria-label={
                          view === 'before'
                            ? `${to! + 1}番へ移動`
                            : `${Math.abs(shift)}つ${shift > 0 ? '前' : '後ろ'}へ移動`
                        }
                      >
                        {view === 'before'
                          ? `→ ${to! + 1}番`
                          : `${shift > 0 ? '↑' : '↓'}${Math.abs(shift)}`}
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          </div>
        ))}
      </div>
    </section>
  )
}
