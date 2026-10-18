import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

import type { EventData } from '../../../shared/model/event'
const api = vi.hoisted(() => ({ getRoster: vi.fn(), deleteBand: vi.fn() }))
vi.mock('../../../shared/repositories/workspaceRepository', () => ({
  workspaceRepository: api,
}))
import { useParticipants } from './useParticipants'
const original: EventData = {
  id: 'event',
  name: 'Live',
  updatedAt: '2026-10-18T00:00:00.000Z',
  scheduleMode: 'dense',
  members: [{ id: 'm', name: '田中' }],
  performances: [
    { id: 'a', name: 'A', memberIds: ['m'] },
    { id: 'b', name: 'B', memberIds: ['m'] },
    { id: 'c', name: 'C', memberIds: [] },
  ],
  sections: [{ id: 'part', slots: ['a', 'b', null, null] }],
  unassigned: ['c'],
  constraints: [],
  messages: [],
}
beforeEach(() => {
  vi.resetAllMocks()
  api.getRoster.mockResolvedValue(structuredClone(original))
  api.deleteBand.mockResolvedValue({
    eventId: 'event',
    bandId: 'a',
    updatedAt: '2026-10-18T00:01:00.000Z',
  })
})
it('opening and cancelling confirmation never deletes a band', async () => {
  const { result } = renderHook(() => useParticipants('event'))
  await waitFor(() => expect(result.current.rows).toHaveLength(3))
  act(() => result.current.requestDelete('a'))
  expect(result.current.deleteTarget?.name).toBe('A')
  expect(api.deleteBand).not.toHaveBeenCalled()
  act(() => result.current.cancelDelete())
  expect(result.current.deleteTarget).toBeNull()
  expect(api.deleteBand).not.toHaveBeenCalled()
})
it('commits once, blocks cancellation during sending, updates order and keeps members', async () => {
  let complete!: (value: {
    eventId: string
    bandId: string
    updatedAt: string
  }) => void
  api.deleteBand.mockReturnValue(
    new Promise((resolve) => {
      complete = resolve
    }),
  )
  const { result } = renderHook(() => useParticipants('event'))
  await waitFor(() => expect(result.current.rows).toHaveLength(3))
  act(() => result.current.requestDelete('a'))
  act(() => {
    void result.current.confirmDelete()
    void result.current.confirmDelete()
    result.current.cancelDelete()
  })
  expect(api.deleteBand).toHaveBeenCalledOnce()
  expect(api.deleteBand).toHaveBeenCalledWith('event', 'a', original.updatedAt)
  expect(result.current.deleteTarget).not.toBeNull()
  await act(() => {
    complete({
      eventId: 'event',
      bandId: 'a',
      updatedAt: '2026-10-18T00:01:00.000Z',
    })
    return Promise.resolve()
  })
  expect(result.current.deleteTarget).toBeNull()
  expect(result.current.rows.map((row) => row.id)).toEqual(['b', 'c'])
  expect(result.current.rows[0].position?.order).toBe(1)
  expect(result.current.stats.members).toBe(1)
  expect(result.current.data?.updatedAt).toBe('2026-10-18T00:01:00.000Z')
})
it('retains the target on errors and requires explicit refresh before using a new version', async () => {
  api.deleteBand.mockRejectedValueOnce(
    new Error('イベントが更新されました。再取得してください。'),
  )
  const { result } = renderHook(() => useParticipants('event'))
  await waitFor(() => expect(result.current.rows).toHaveLength(3))
  act(() => result.current.requestDelete('a'))
  await act(() => result.current.confirmDelete())
  expect(result.current.deleteError).toContain('再取得')
  expect(result.current.deleteTarget?.name).toBe('A')
  expect(result.current.rows).toHaveLength(3)
  api.getRoster.mockResolvedValue({
    ...structuredClone(original),
    updatedAt: '2026-10-18T01:00:00.000Z',
  })
  await act(() => result.current.refreshDeleteTarget())
  expect(result.current.deleteTarget).toBeNull()
  expect(api.deleteBand).toHaveBeenCalledOnce()
  act(() => result.current.requestDelete('a'))
  await act(() => result.current.confirmDelete())
  expect(api.deleteBand).toHaveBeenLastCalledWith(
    'event',
    'a',
    '2026-10-18T01:00:00.000Z',
  )
})
