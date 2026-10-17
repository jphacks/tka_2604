import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

import type { EventData } from '../../../shared/model/event'
import type { EventRepository } from '../repositories/types'

const api = vi.hoisted(() => ({
  getEvent: vi.fn(),
  saveSchedule: vi.fn<EventRepository['saveSchedule']>(),
  saveConstraints: vi.fn<EventRepository['saveConstraints']>(),
}))
vi.mock('../../../shared/repositories/dataSource', () => ({
  dataSource: 'api',
}))
vi.mock('../../../shared/repositories/workspaceRepository', () => ({
  workspaceRepository: { rememberEvent: vi.fn() },
}))
vi.mock('../../../shared/api/events', () => ({ eventsApi: api }))
vi.mock('../repositories/eventRepository', () => ({ eventRepository: api }))
import { useEvent } from './useEvent'

const event: EventData = {
  id: 'e',
  name: 'Live',
  updatedAt: '2026-10-17T00:00:00.000Z',
  members: [],
  messages: [],
  constraints: [],
  performances: ['a', 'b'].map((id) => ({ id, name: id, memberIds: [] })),
  sections: [{ id: 'p1', slots: ['a', 'b'] }],
  unassigned: [],
}
beforeEach(() => {
  vi.resetAllMocks()
  api.getEvent.mockResolvedValue(structuredClone(event))
})

it('keeps unsaved edits after a failed save and sends the displayed revision on retry', async () => {
  const { result } = renderHook(() => useEvent('e'))
  await waitFor(() => expect(result.current.event).not.toBeNull())
  act(() => result.current.setOrder('b', 1))
  expect(result.current.scheduleDirty).toBe(true)
  expect(result.current.notice).not.toContain('保存しました')
  api.saveSchedule.mockRejectedValueOnce(new Error('通信失敗'))
  await act(() => result.current.saveSchedule())
  expect(result.current.event?.sections[0].slots).toEqual(['b', 'a'])
  expect(result.current.scheduleDirty).toBe(true)
  expect(result.current.error).toBe('通信失敗')
  api.saveSchedule.mockResolvedValueOnce({
    updatedAt: '2026-10-17T00:00:00.001Z',
  })
  await act(() => result.current.saveSchedule())
  expect(api.saveSchedule.mock.calls[1][0].updatedAt).toBe(event.updatedAt)
  expect(result.current.scheduleDirty).toBe(false)
  act(() => result.current.setFixed('b', true))
  api.saveConstraints.mockResolvedValueOnce({
    updatedAt: '2026-10-17T00:00:00.002Z',
    constraintSources: {},
  })
  await act(() => result.current.saveConstraints())
  expect(api.saveConstraints.mock.calls[0][0].updatedAt).toBe(
    '2026-10-17T00:00:00.001Z',
  )
})

it('preserves both edits on a conflict and blocks duplicate saves and edits while saving', async () => {
  const { result } = renderHook(() => useEvent('e'))
  await waitFor(() => expect(result.current.event).not.toBeNull())
  act(() => {
    result.current.setOrder('b', 1)
    result.current.setFixed('a', true)
  })
  let reject!: (error: Error) => void
  api.saveSchedule.mockReturnValue(
    new Promise((_resolve, fail) => {
      reject = fail
    }),
  )
  let saving!: Promise<void>
  act(() => {
    saving = result.current.saveSchedule()
  })
  act(() => {
    void result.current.saveConstraints()
    result.current.setOrder('a', 1)
  })
  expect(api.saveConstraints).not.toHaveBeenCalled()
  await act(async () => {
    reject(new Error('再取得してください'))
    await saving
  })
  expect(result.current.scheduleDirty).toBe(true)
  expect(result.current.constraintsDirty).toBe(true)
  expect(result.current.event?.sections[0].slots).toEqual(['b', 'a'])
  expect(result.current.event?.constraints).toHaveLength(1)
  expect(api.getEvent).toHaveBeenCalledTimes(1)
})

it('retains validation errors and prevents edits while a confirmed reload is pending', async () => {
  const dense = { ...structuredClone(event), scheduleMode: 'dense' as const }
  api.getEvent.mockResolvedValueOnce(dense)
  const { result } = renderHook(() => useEvent('e'))
  await waitFor(() => expect(result.current.event).not.toBeNull())
  act(() => result.current.setOrder('b', 99))
  expect(result.current.error).toContain('1〜2')
  act(() => result.current.setOrder('b', 1))
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  let resolve!: (value: EventData) => void
  const reloaded = new Promise<EventData>((done) => {
    resolve = done
  })
  api.getEvent.mockReturnValueOnce(reloaded)
  act(() => result.current.retryLoad())
  await waitFor(() => expect(api.getEvent).toHaveBeenCalledTimes(2))
  act(() => result.current.setOrder('a', null))
  expect(result.current.event?.unassigned).toEqual([])
  await act(async () => {
    resolve(dense)
    await reloaded
  })
  expect(result.current.scheduleDirty).toBe(false)
  expect(result.current.refreshing).toBe(false)
  confirm.mockRestore()
})

it('keeps frame capacity in the current view without marking a server change', async () => {
  api.getEvent.mockResolvedValueOnce({
    ...event,
    scheduleMode: 'dense',
    sections: [{ id: 'p1', slots: ['a', 'b', null, null] }],
  })
  const { result } = renderHook(() => useEvent('e'))
  await waitFor(() => expect(result.current.event).not.toBeNull())
  act(() => result.current.resize(6, 'p1'))
  expect(result.current.event?.sections[0].slots).toHaveLength(6)
  expect(result.current.scheduleDirty).toBe(false)
  act(() => result.current.setOrder('b', 1))
  expect(result.current.event?.sections[0].slots).toEqual([
    'b',
    'a',
    null,
    null,
    null,
    null,
  ])
  expect(result.current.scheduleDirty).toBe(true)
  api.saveSchedule.mockResolvedValueOnce({
    updatedAt: '2026-10-17T00:00:00.001Z',
  })
  await act(() => result.current.saveSchedule())
  expect(result.current.event?.sections[0].slots).toHaveLength(6)
  expect(result.current.scheduleDirty).toBe(false)
})
