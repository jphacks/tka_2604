import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { MemberList } from './MemberList'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function overflow(element: HTMLElement, overflowing = true) {
  Object.defineProperties(element, {
    clientWidth: { configurable: true, value: 100 },
    scrollWidth: { configurable: true, value: overflowing ? 200 : 100 },
  })
}

it('shows truncated names after 500ms and closes the tooltip on leave', async () => {
  const names = ['佐藤一郎', '鈴木花子', '高橋太郎', '田中美咲']
  render(<MemberList names={names} />)
  const members = screen.getByText(names.join('・'))
  overflow(members)
  expect(screen.queryByRole('tooltip')).toBeNull()
  fireEvent.pointerEnter(members)
  await act(() => vi.advanceTimersByTime(499))
  expect(screen.queryByRole('tooltip')).toBeNull()
  await act(() => vi.advanceTimersByTime(1))
  const tooltip = screen.getByRole('tooltip')
  expect(tooltip).toHaveTextContent(names.join('・'))
  expect(tooltip.parentElement).toBe(document.body)
  fireEvent.pointerLeave(members)
  await act(() => vi.advanceTimersByTime(150))
  expect(screen.queryByRole('tooltip')).toBeNull()
})

it('stays open while moving onto the tooltip to select names and closes with Escape', async () => {
  render(<MemberList names={['佐藤', '鈴木']} />)
  const members = screen.getByText('佐藤・鈴木')
  overflow(members)
  fireEvent.pointerEnter(members)
  await act(() => vi.advanceTimersByTime(500))
  const tooltip = screen.getByRole('tooltip')
  fireEvent.pointerLeave(members)
  await act(() => vi.advanceTimersByTime(50))
  fireEvent.pointerEnter(tooltip)
  await act(() => vi.advanceTimersByTime(500))
  expect(tooltip).toBeVisible()
  expect(tooltip).toHaveClass('select-text')
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(screen.queryByRole('tooltip')).toBeNull()
})

it('closes after leaving both the names and tooltip', async () => {
  render(<MemberList names={['佐藤', '鈴木']} />)
  const members = screen.getByText('佐藤・鈴木')
  overflow(members)
  fireEvent.pointerEnter(members)
  await act(() => vi.advanceTimersByTime(500))
  const tooltip = screen.getByRole('tooltip')
  fireEvent.pointerLeave(members)
  fireEvent.pointerEnter(tooltip)
  fireEvent.pointerLeave(tooltip)
  await act(() => vi.advanceTimersByTime(150))
  expect(screen.queryByRole('tooltip')).toBeNull()
})

it('does not expand the row on click and dismisses the tooltip when scrolling', async () => {
  const { container } = render(<MemberList names={['佐藤', '鈴木']} />)
  const members = screen.getByText('佐藤・鈴木')
  overflow(members)
  fireEvent.click(members)
  expect(screen.queryByRole('tooltip')).toBeNull()
  expect(container.querySelector('details')).toBeNull()
  fireEvent.pointerEnter(members)
  await act(() => vi.advanceTimersByTime(500))
  expect(screen.getByRole('tooltip')).toBeVisible()
  fireEvent.scroll(window)
  expect(screen.queryByRole('tooltip')).toBeNull()
})

it('does not show a tooltip when all names fit', async () => {
  render(<MemberList names={['佐藤']} />)
  const members = screen.getByText('佐藤')
  overflow(members, false)
  fireEvent.pointerEnter(members)
  await act(() => vi.advanceTimersByTime(1000))
  expect(screen.queryByRole('tooltip')).toBeNull()
})

it('cancels a pending tooltip when leaving or scrolling before the delay', async () => {
  render(<MemberList names={['佐藤', '鈴木']} />)
  const members = screen.getByText('佐藤・鈴木')
  overflow(members)
  fireEvent.pointerEnter(members)
  fireEvent.pointerLeave(members)
  await act(() => vi.advanceTimersByTime(500))
  expect(screen.queryByRole('tooltip')).toBeNull()
  fireEvent.pointerEnter(members)
  fireEvent.scroll(window)
  await act(() => vi.advanceTimersByTime(500))
  expect(screen.queryByRole('tooltip')).toBeNull()
})
