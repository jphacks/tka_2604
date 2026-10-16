import type { SortingStrategy } from '@dnd-kit/sortable'

import { buildSchedule, findTarget, movePerformance } from './schedule'
import type { EventData, PerformanceRow } from './types'

// Use the same projected placement as the committed move. A plain list sort
// displaces fixed rows and ignores section headers when crossing part boundaries.
export function createScheduleSortingStrategy(
  event: EventData,
  rows: PerformanceRow[],
): SortingStrategy {
  let cached:
    | { active: number; over: number; destinations: Map<string, number> }
    | undefined
  return ({ activeIndex, overIndex, index, rects }) => {
    if (cached?.active !== activeIndex || cached.over !== overIndex) {
      const id = rows[activeIndex]?.performance?.id
      const overKey =
        overIndex === rows.length ? 'unassigned' : rows[overIndex]?.key
      const target = overKey ? findTarget(event, overKey) : undefined
      const result =
        id && target ? movePerformance(event, id, target) : undefined
      const destinations = new Map<string, number>()
      if (result && !result.error) {
        const projected = buildSchedule(result.event)
        const projectedRows = [
          ...projected.sections.flatMap((section) => section.rows),
          ...projected.unassigned,
        ]
        projectedRows.forEach((row, slot) => {
          if (row.performance) destinations.set(row.performance.id, slot)
        })
      }
      cached = { active: activeIndex, over: overIndex, destinations }
    }
    const id = rows[index]?.performance?.id
    const destination = id ? cached.destinations.get(id) : undefined
    if (
      destination === undefined ||
      destination === index ||
      destination >= rows.length
    )
      return null
    const from = rects[index]
    const to = rects[destination]
    if (!from || !to) return null
    return {
      x: to.left - from.left,
      y: to.top - from.top,
      scaleX: 1,
      scaleY: 1,
    }
  }
}
