import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

import type { EventData } from '../../../shared/model/event'
import type { EventRepository } from '../repositories/types'

const api = vi.hoisted(() => ({
  getEvent: vi.fn(),
  deleteBand: vi.fn<EventRepository['deleteBand']>(),
  solve: vi.fn<EventRepository['solve']>(),
  saveSchedule: vi.fn<EventRepository['saveSchedule']>(),
  saveConstraints: vi.fn<EventRepository['saveConstraints']>(),
  sendMessage: vi.fn<EventRepository['sendMessage']>(),
  getMessages: vi.fn<EventRepository['getMessages']>(),
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

it('saves order only on explicit request and auto-saves constraints without saving order', async () => {
  api.saveSchedule.mockResolvedValue({ updatedAt: '2026-10-17T00:00:00.002Z' })
  api.saveConstraints.mockResolvedValue({
    updatedAt: '2026-10-17T00:00:00.001Z',
    constraintSources: {},
  })
  const { result } = renderHook(() => useEvent('e'))
  await waitFor(() => expect(result.current.event).not.toBeNull())
  act(() => result.current.setOrder('b', 1))
  expect(api.saveSchedule).not.toHaveBeenCalled()
  act(() => result.current.setFixed('b', true))
  await waitFor(() => expect(result.current.constraintsDirty).toBe(false))
  expect(api.saveConstraints).toHaveBeenCalledTimes(1)
  expect(api.saveSchedule).not.toHaveBeenCalled()
  expect(result.current.scheduleDirty).toBe(true)
  await act(() => result.current.saveSchedule())
  expect(api.saveSchedule.mock.calls[0][0].updatedAt).toBe(
    '2026-10-17T00:00:00.001Z',
  )
  expect(result.current.scheduleDirty).toBe(false)
})

it('keeps failed edits without a retry loop and persists them on explicit retry', async () => {
  api.saveSchedule.mockRejectedValueOnce(new Error('通信失敗'))
  const { result } = renderHook(() => useEvent('e'))
  await waitFor(() => expect(result.current.event).not.toBeNull())
  act(() => result.current.setOrder('b', 1))
  await act(() => result.current.saveSchedule())
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
  await act(() => result.current.retrySave())
  await waitFor(() => expect(result.current.constraintsDirty).toBe(false))
  expect(result.current.scheduleDirty).toBe(false)
  expect(api.saveSchedule.mock.calls[1][0].updatedAt).toBe(event.updatedAt)
  expect(api.saveConstraints.mock.calls[0][0].updatedAt).toBe(
    '2026-10-17T00:00:00.001Z',
  )
})

it('auto-saves only constraints while order is unsaved, preserving both edits on conflict', async () => {
  let reject!: (error: Error) => void
  api.saveConstraints.mockReturnValue(
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
  act(() => reject(new Error('再取得してください')))
  await waitFor(() => expect(result.current.saveFailed).toBe(true))
  expect(api.saveSchedule).not.toHaveBeenCalled()
  expect(result.current.scheduleDirty).toBe(true)
  expect(result.current.constraintsDirty).toBe(true)
  expect(result.current.event?.sections[0].slots).toEqual(['b', 'a'])
  expect(api.getEvent).toHaveBeenCalledTimes(1)
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
  await act(() => result.current.saveSchedule())
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

it('marks a frame count edit dirty and persists it on explicit saving', async () => {
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
  expect(result.current.scheduleDirty).toBe(true)
  expect(api.saveSchedule).not.toHaveBeenCalled()
  act(() => result.current.setOrder('b', 1))
  await act(() => result.current.saveSchedule())
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

it('deletes a band with the current version and synchronizes the schedule baseline', async () => {
  const withSource: EventData = {
    ...structuredClone(event),
    constraintSources: { generated: 'a', manual: null },
    constraints: [
      {
        schema_version: '1.0.0',
        constraint_id: 'generated',
        event_id: 'e',
        type: 'at_position',
        hardness: 'hard',
        priority: null,
        enabled: true,
        targets: { band_id: 'a' },
        params: { position: 0 },
      },
      {
        schema_version: '1.0.0',
        constraint_id: 'manual',
        event_id: 'e',
        type: 'at_position',
        hardness: 'hard',
        priority: null,
        enabled: true,
        targets: { band_id: 'b' },
        params: { position: 1 },
      },
    ],
  }
  api.getEvent.mockResolvedValueOnce(withSource)
  api.deleteBand.mockResolvedValueOnce({
    eventId: 'e',
    bandId: 'a',
    updatedAt: '2026-10-17T00:01:00.000Z',
  })
  const { result } = renderHook(() => useEvent('e'))
  await waitFor(() => expect(result.current.event).not.toBeNull())
  await act(() => result.current.deleteBand('a'))
  expect(api.deleteBand).toHaveBeenCalledWith('e', 'a', withSource.updatedAt)
  expect(result.current.event?.sections[0].slots).toEqual([null, 'b'])
  expect(result.current.event?.performances.map((band) => band.id)).toEqual([
    'b',
  ])
  expect(
    result.current.event?.constraints.map((item) => item.constraint_id),
  ).toEqual(['manual'])
  expect(result.current.event?.members).toEqual([])
  expect(result.current.event?.updatedAt).toBe('2026-10-17T00:01:00.000Z')
  expect(result.current.scheduleDirty).toBe(false)
  expect(result.current.constraintsDirty).toBe(false)
})

it('persists order then constraints before invoking Solver with the last revision', async () => {
  const calls: string[] = []
  api.saveSchedule.mockImplementationOnce((snapshot) => {
    calls.push('schedule')
    expect(snapshot.sections[0].slots).toEqual(['b', 'a'])
    return Promise.resolve({ updatedAt: '2026-10-17T00:00:00.001Z' })
  })
  api.saveConstraints.mockImplementationOnce((snapshot) => {
    calls.push('constraints')
    expect(snapshot.updatedAt).toBe('2026-10-17T00:00:00.001Z')
    return Promise.resolve({ updatedAt: '2026-10-17T00:00:00.002Z' })
  })
  api.solve.mockImplementationOnce((snapshot) => {
    calls.push('solve')
    expect(snapshot.updatedAt).toBe('2026-10-17T00:00:00.002Z')
    return Promise.resolve({
      result: {
        eventId: 'e',
        status: 'unknown',
        placements: null,
        unassignedBandIds: null,
        constraintResults: null,
      },
      schedule: null,
    })
  })
  const { result } = renderHook(() => useEvent('e'))
  await waitFor(() => expect(result.current.event).not.toBeNull())
  act(() => result.current.setOrder('b', 1))
  const revision = result.current.reorderRevision
  await act(() => result.current.generate())
  expect(calls).toEqual(['schedule', 'constraints', 'solve'])
  // 計算結果の反映も並べ替えアニメーションの対象にする
  expect(result.current.reorderRevision).toBe(revision + 1)
  expect(result.current.scheduleDirty).toBe(false)
  expect(result.current.notice).toContain('探索が完了していません')
})

it.each(['schedule', 'constraints'] as const)(
  'never invokes Solver when %s persistence fails',
  async (kind) => {
    api.saveSchedule.mockResolvedValue({
      updatedAt: '2026-10-17T00:00:00.001Z',
    })
    api.saveConstraints.mockResolvedValue({
      updatedAt: '2026-10-17T00:00:00.002Z',
    })
    const failed = kind === 'schedule' ? api.saveSchedule : api.saveConstraints
    failed.mockRejectedValueOnce(new Error('保存競合'))
    const { result } = renderHook(() => useEvent('e'))
    await waitFor(() => expect(result.current.event).not.toBeNull())
    await act(() => result.current.generate())
    expect(api.solve).not.toHaveBeenCalled()
    if (kind === 'schedule') expect(api.saveConstraints).not.toHaveBeenCalled()
    expect(result.current.error).toBe('保存競合')
  },
)

async function receiveReorder(result: {
  current: ReturnType<typeof useEvent>
}) {
  api.sendMessage.mockResolvedValue({
    reply: '盛り上がる順にしました。',
    reorder: {
      expectedUpdatedAt: event.updatedAt!,
      source: 'llm',
      placements: [
        { bandId: 'b', partId: 'p1', order: 0 },
        { bandId: 'a', partId: 'p1', order: 1 },
      ],
      results: [],
    },
  })
  api.getMessages.mockResolvedValue([])
  act(() => result.current.setChatDraft('盛り上げて'))
  await act(() => result.current.sendMessage())
  expect(result.current.chatReorder?.reply).toBe('盛り上がる順にしました。')
}

it('saves an approved reorder through the schedule API and keeps the order on rejection', async () => {
  api.saveSchedule.mockResolvedValue({ updatedAt: '2026-10-17T00:00:00.001Z' })
  const { result } = renderHook(() => useEvent('e'))
  await waitFor(() => expect(result.current.event).not.toBeNull())
  await receiveReorder(result)
  act(() => result.current.dismissReorder())
  expect(result.current.event?.sections[0].slots).toEqual(['a', 'b'])
  expect(api.saveSchedule).not.toHaveBeenCalled()

  await receiveReorder(result)
  await act(() => result.current.applyReorder())
  expect(api.saveSchedule.mock.calls[0][0].sections[0].slots).toEqual([
    'b',
    'a',
  ])
  expect(result.current.chatReorder).toBeNull()
  expect(result.current.scheduleDirty).toBe(false)
  expect(result.current.notice).toBe('並べ替え案を出演順に保存しました。')
})

it('does not apply a reorder proposed for an older version', async () => {
  const { result } = renderHook(() => useEvent('e'))
  await waitFor(() => expect(result.current.event).not.toBeNull())
  await receiveReorder(result)
  api.getEvent.mockResolvedValue({
    ...structuredClone(event),
    updatedAt: '2026-10-18T00:00:00.000Z',
  })
  act(() => result.current.retryLoad())
  await waitFor(() =>
    expect(result.current.event?.updatedAt).toBe('2026-10-18T00:00:00.000Z'),
  )
  await act(() => result.current.applyReorder())
  expect(api.saveSchedule).not.toHaveBeenCalled()
  expect(result.current.error).toContain('イベントが更新されました')
  expect(result.current.event?.sections[0].slots).toEqual(['a', 'b'])
})
