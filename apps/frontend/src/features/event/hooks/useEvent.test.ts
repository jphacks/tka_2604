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

it('automatically persists order and constraint edits using the latest revision', async () => {
  api.saveSchedule.mockResolvedValue({ updatedAt: '2026-10-17T00:00:00.001Z' })
  api.saveConstraints.mockResolvedValue({
    updatedAt: '2026-10-17T00:00:00.002Z',
    constraintSources: {},
  })
  const { result } = renderHook(() => useEvent('e'))
  await waitFor(() => expect(result.current.event).not.toBeNull())
  act(() => result.current.setOrder('b', 1))
  await waitFor(() => expect(api.saveSchedule).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(result.current.scheduleDirty).toBe(false))
  expect(api.saveSchedule.mock.calls[0][0].sections[0].slots).toEqual([
    'b',
    'a',
  ])
  act(() => result.current.setFixed('b', true))
  await waitFor(() => expect(api.saveConstraints).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(result.current.constraintsDirty).toBe(false))
  expect(api.saveConstraints.mock.calls[0][0].updatedAt).toBe(
    '2026-10-17T00:00:00.001Z',
  )
})

it('keeps failed edits without a retry loop and persists them on explicit retry', async () => {
  api.saveSchedule.mockRejectedValueOnce(new Error('通信失敗'))
  const { result } = renderHook(() => useEvent('e'))
  await waitFor(() => expect(result.current.event).not.toBeNull())
  act(() => result.current.setOrder('b', 1))
  await waitFor(() => expect(result.current.error).toBe('通信失敗'))
  expect(result.current.event?.sections[0].slots).toEqual(['b', 'a'])
  expect(result.current.scheduleDirty).toBe(true)
  expect(result.current.notice).not.toContain('保存しました')
  act(() => result.current.setFixed('b', true))
  expect(api.saveSchedule).toHaveBeenCalledTimes(1)
  expect(api.saveConstraints).not.toHaveBeenCalled()
  api.saveSchedule.mockResolvedValueOnce({
    updatedAt: '2026-10-17T00:00:00.001Z',
  })
  api.saveConstraints.mockResolvedValueOnce({
    updatedAt: '2026-10-17T00:00:00.002Z',
  })
  act(() => result.current.retrySave())
  await waitFor(() => expect(result.current.constraintsDirty).toBe(false))
  expect(result.current.scheduleDirty).toBe(false)
  expect(api.saveSchedule.mock.calls[1][0].updatedAt).toBe(event.updatedAt)
  expect(api.saveConstraints.mock.calls[0][0].updatedAt).toBe(
    '2026-10-17T00:00:00.001Z',
  )
})

it('preserves both edits on conflict and blocks further edits during the request', async () => {
  let reject!: (error: Error) => void
  api.saveSchedule.mockReturnValue(
    new Promise((_resolve, fail) => {
      reject = fail
    }),
  )
  const { result } = renderHook(() => useEvent('e'))
  await waitFor(() => expect(result.current.event).not.toBeNull())
  act(() => {
    result.current.setOrder('b', 1)
    result.current.setFixed('a', true)
  })
  await waitFor(() => expect(result.current.saving).toBe(true))
  act(() => result.current.setOrder('a', 1))
  expect(api.saveConstraints).not.toHaveBeenCalled()
  act(() => {
    reject(new Error('再取得してください'))
  })
  await waitFor(() => expect(result.current.saveFailed).toBe(true))
  expect(result.current.scheduleDirty).toBe(true)
  expect(result.current.constraintsDirty).toBe(true)
  expect(result.current.event?.sections[0].slots).toEqual(['b', 'a'])
  expect(result.current.event?.constraints).toHaveLength(1)
  expect(api.getEvent).toHaveBeenCalledTimes(1)
  expect(api.saveSchedule).toHaveBeenCalledTimes(1)
})

it('retains validation errors and prevents edits during a confirmed reload after failure', async () => {
  const dense = { ...structuredClone(event), scheduleMode: 'dense' as const }
  api.getEvent.mockResolvedValueOnce(dense)
  api.saveSchedule.mockRejectedValueOnce(new Error('再取得してください'))
  const { result } = renderHook(() => useEvent('e'))
  await waitFor(() => expect(result.current.event).not.toBeNull())
  act(() => result.current.setOrder('b', 99))
  expect(result.current.error).toContain('1〜2')
  expect(api.saveSchedule).not.toHaveBeenCalled()
  act(() => result.current.setOrder('b', 1))
  await waitFor(() => expect(result.current.saveFailed).toBe(true))
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  let resolve!: (value: EventData) => void
  api.getEvent.mockReturnValueOnce(
    new Promise<EventData>((done) => {
      resolve = done
    }),
  )
  act(() => result.current.retryLoad())
  await waitFor(() => expect(api.getEvent).toHaveBeenCalledTimes(2))
  act(() => result.current.setOrder('a', null))
  expect(result.current.event?.unassigned).toEqual([])
  act(() => {
    resolve(dense)
  })
  await waitFor(() => expect(result.current.refreshing).toBe(false))
  expect(result.current.scheduleDirty).toBe(false)
  expect(result.current.refreshing).toBe(false)
  expect(result.current.saveFailed).toBe(false)
  confirm.mockRestore()
})

it('keeps local frame capacity without a server write, including after order saving', async () => {
  api.getEvent.mockResolvedValueOnce({
    ...event,
    scheduleMode: 'dense',
    sections: [{ id: 'p1', slots: ['a', 'b', null, null] }],
  })
  api.saveSchedule.mockResolvedValueOnce({
    updatedAt: '2026-10-17T00:00:00.001Z',
  })
  const { result } = renderHook(() => useEvent('e'))
  await waitFor(() => expect(result.current.event).not.toBeNull())
  act(() => result.current.resize(6, 'p1'))
  expect(result.current.event?.sections[0].slots).toHaveLength(6)
  expect(result.current.scheduleDirty).toBe(false)
  expect(api.saveSchedule).not.toHaveBeenCalled()
  act(() => result.current.setOrder('b', 1))
  await waitFor(() => expect(api.saveSchedule).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(result.current.scheduleDirty).toBe(false))
  expect(result.current.event?.sections[0].slots).toEqual([
    'b',
    'a',
    null,
    null,
    null,
    null,
  ])
})
