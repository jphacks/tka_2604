import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { ProcessingStatus } from './ProcessingStatus'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('skips processing messages when work finishes within 500ms', async () => {
  const { rerender } = render(
    <ProcessingStatus message="変更を保存しています。" />,
  )
  await act(() => vi.advanceTimersByTime(300))
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
  rerender(<ProcessingStatus />)
  await act(() => vi.advanceTimersByTime(1000))
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
})

it('shows longer work once and keeps the message visible for at least 800ms', async () => {
  const { rerender } = render(
    <ProcessingStatus message="変更を保存しています。" />,
  )
  await act(() => vi.advanceTimersByTime(500))
  expect(screen.getAllByRole('status')).toHaveLength(1)
  expect(screen.getByRole('status')).toHaveTextContent('保存中')
  await act(() => vi.advanceTimersByTime(100))
  rerender(<ProcessingStatus />)
  await act(() => vi.advanceTimersByTime(699))
  expect(screen.getByRole('status')).toHaveTextContent('保存中')
  await act(() => vi.advanceTimersByTime(1))
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
})

it('keeps the indicator steady when another operation starts before it disappears', async () => {
  const { rerender } = render(
    <ProcessingStatus message="変更を保存しています。" />,
  )
  await act(() => vi.advanceTimersByTime(500))
  rerender(<ProcessingStatus />)
  await act(() => vi.advanceTimersByTime(200))
  rerender(<ProcessingStatus message="出演順を計算しています。" />)
  await act(() => vi.advanceTimersByTime(0))
  expect(screen.getByRole('status')).toHaveTextContent('計算中')
  await act(() => vi.advanceTimersByTime(1000))
  expect(screen.getByRole('status')).toHaveTextContent('計算中')
})
