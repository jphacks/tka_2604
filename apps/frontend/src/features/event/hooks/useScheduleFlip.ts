import { type RefObject, useLayoutEffect, useRef } from 'react'

import { slideFrom } from '../../../shared/ui/flip'

// Remembers where each performance row sat after every render and, when
// `trigger` changes (an AI reorder or a solver result), slides rows from those spots.
// Offsets are taken inside the scroll container, so scrolling in between
// does not shift the animation. Manual drags keep their own animation.
export function useScheduleFlip(
  container: RefObject<HTMLElement | null>,
  trigger: number,
) {
  const offsets = useRef(new Map<string, number>())
  const lastTrigger = useRef(trigger)
  useLayoutEffect(() => {
    const root = container.current
    if (!root) return
    const top = root.getBoundingClientRect().top - root.scrollTop
    const next = new Map<string, number>()
    const animate = lastTrigger.current !== trigger
    for (const row of root.querySelectorAll<HTMLElement>(
      '[data-performance]',
    )) {
      const id = row.dataset.performance!
      const offset = row.getBoundingClientRect().top - top
      next.set(id, offset)
      const previous = offsets.current.get(id)
      if (animate && previous !== undefined)
        slideFrom(row, previous - offset, {
          duration: 800,
          highlight: 'var(--color-wash)',
        })
    }
    offsets.current = next
    lastTrigger.current = trigger
  })
}
