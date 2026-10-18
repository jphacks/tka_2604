import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import type { EventData } from '../../../shared/model/event'
import { ReorderPreview } from './ReorderPreview'

const event: EventData = {
  id: 'e',
  name: 'Live',
  members: [],
  messages: [],
  constraints: [],
  performances: ['A', 'B', 'C'].map((name) => ({
    id: name.toLowerCase(),
    name,
    memberIds: [],
  })),
  sections: [
    { id: 'p1', name: '前半', slots: ['a', 'b'] },
    { id: 'p2', slots: ['c'] },
  ],
  unassigned: [],
}
// C moves from 3rd to 1st across parts; A and B each move one back.
const next: EventData = {
  ...event,
  sections: [
    { id: 'p1', name: '前半', slots: ['c', 'a'] },
    { id: 'p2', slots: ['b'] },
  ],
}
const rows = () => screen.getAllByRole('listitem').map((row) => row.textContent)

afterEach(() => vi.useRealTimers())

it('opens on the old order and stays there until the person plays it', () => {
  vi.useFakeTimers()
  render(<ReorderPreview event={event} next={next} />)
  expect(rows()).toEqual(['1. A→ 2番', '2. B→ 3番', '3. C→ 1番'])
  act(() => {
    vi.advanceTimersByTime(1000)
  })
  expect(rows()[0]).toBe('1. A→ 2番')
  expect(screen.getByText('3組が移動')).toBeTruthy()
  expect(screen.getByRole('button', { name: '変更前' })).toHaveProperty(
    'ariaPressed',
    'true',
  )
})

it('switches views by hand and plays the move from the old order', () => {
  vi.useFakeTimers()
  render(<ReorderPreview event={event} next={next} />)
  fireEvent.click(screen.getByRole('button', { name: '変更後' }))
  expect(rows()).toEqual(['1. C↑2', '2. A↓1', '3. B↓1'])
  expect(screen.getByText('第2部')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '再生' }))
  expect(rows()[0]).toBe('1. A→ 2番')
  act(() => {
    vi.advanceTimersByTime(400)
  })
  expect(rows()[0]).toBe('1. C↑2')
  fireEvent.click(screen.getByRole('button', { name: '変更前' }))
  expect(rows()[0]).toBe('1. A→ 2番')
})

it('does not mark bands that stay in place', () => {
  render(<ReorderPreview event={event} next={event} />)
  expect(screen.getByText('0組が移動')).toBeTruthy()
  expect(
    screen
      .getAllByRole('listitem')
      .every((row) => row.dataset.moved === 'false'),
  ).toBe(true)
})
