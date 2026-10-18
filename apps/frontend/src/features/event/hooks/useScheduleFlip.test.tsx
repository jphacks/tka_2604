import { render } from '@testing-library/react'
import { useRef } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'

import { useScheduleFlip } from './useScheduleFlip'

const ROW = 40

function Table({ order, trigger }: { order: string[]; trigger: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useScheduleFlip(ref, trigger)
  return (
    <div ref={ref}>
      {order.map((id) => (
        <div key={id} data-performance={id} />
      ))}
    </div>
  )
}

const animate = vi.fn()
// jsdom has no layout: place each row by its index and record animations.
beforeEach(() => {
  animate.mockClear()
  HTMLElement.prototype.animate = animate
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      const index = this.dataset.performance
        ? [...this.parentElement!.children].indexOf(this)
        : 0
      return { top: index * ROW } as DOMRect
    },
  )
})

const slides = () =>
  animate.mock.calls
    .filter(([frames]) => 'transform' in (frames as Keyframe[])[0])
    .map(([frames]) => (frames as Keyframe[])[0].transform)

it('slides moved rows from their previous place only when the trigger changes', () => {
  const { rerender } = render(<Table order={['a', 'b', 'c']} trigger={0} />)
  rerender(<Table order={['c', 'a', 'b']} trigger={0} />)
  expect(animate).not.toHaveBeenCalled()

  rerender(<Table order={['a', 'b', 'c']} trigger={1} />)
  // a and b come back up by one row each; c goes down from the top by two.
  expect(slides()).toEqual([
    `translateY(${ROW}px)`,
    `translateY(${ROW}px)`,
    `translateY(${-2 * ROW}px)`,
  ])
})

it('leaves unmoved rows still', () => {
  const { rerender } = render(<Table order={['a', 'b']} trigger={0} />)
  rerender(<Table order={['a', 'b']} trigger={1} />)
  expect(animate).not.toHaveBeenCalled()
})
