import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import type * as ReactRouter from 'react-router'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'

import type { EventDetails, EventDraft } from '../../../shared/model/workspace'

const mocks = vi.hoisted(() => ({
  listEvents: vi.fn(),
  createEvent: vi.fn<(draft: EventDraft) => Promise<Partial<EventDetails>>>(),
  importRoster: vi.fn(),
  navigate: vi.fn(),
}))
vi.mock('../../../shared/repositories/workspaceRepository', () => ({
  workspaceRepository: {
    listEvents: mocks.listEvents,
    createEvent: mocks.createEvent,
  },
}))
vi.mock('../../participants/hooks/useRosterImport', () => ({
  importRoster: mocks.importRoster,
}))
vi.mock('react-router', async (original) => ({
  ...(await original<typeof ReactRouter>()),
  useNavigate: () => mocks.navigate,
}))
import { useEvents } from './useEvents'

const csv = [
  '曲名,紹介,メンバー1,メンバー2',
  ...Array.from({ length: 12 }, (_, i) => `曲${i},,佐藤,田中${i}`),
].join('\n')
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(MemoryRouter, null, children)

beforeEach(() => {
  vi.resetAllMocks()
  mocks.listEvents.mockResolvedValue([])
  mocks.createEvent.mockResolvedValue({
    id: 'e1',
    updatedAt: '2026-10-19T00:00:00.000Z',
  })
})

async function withRoster() {
  const { result } = renderHook(() => useEvents(), { wrapper })
  act(() => result.current.setDraft({ bandCounts: [4, 4] }))
  await act(() => result.current.roster.readFile(new File([csv], 'r.csv')))
  return result
}

it('名簿を選ぶと組数を部へ割り振り、作成後にその名簿を取り込む', async () => {
  const result = await withRoster()
  expect(result.current.draft.bandCounts).toEqual([6, 6])
  expect(result.current.roster.plan).toMatchObject({ bands: 12, people: 13 })

  await act(() => result.current.create())

  expect(mocks.createEvent.mock.calls[0][0].bandCounts).toEqual([6, 6])
  expect(mocks.importRoster).toHaveBeenCalledWith(
    'e1',
    expect.any(Array),
    [],
    '2026-10-19T00:00:00.000Z',
    expect.any(Function),
  )
  expect(mocks.importRoster.mock.calls[0][1]).toHaveLength(12)
  expect(mocks.navigate).toHaveBeenCalledWith('/event/e1')
})

it('名簿があるときは部数を変えると組数を割り振り直す', async () => {
  const result = await withRoster()
  act(() => result.current.setDraft({ bandCounts: [6, 6, 4] }))
  expect(result.current.draft.bandCounts).toEqual([4, 4, 4])
  act(() => result.current.setDraft({ bandCounts: [4, 9, 4] }))
  expect(result.current.draft.bandCounts).toEqual([4, 9, 4])
})

it('取込が途中で失敗したら再作成させず、名簿画面へ理由を渡す', async () => {
  mocks.importRoster.mockRejectedValue(new Error('3行目で止まりました。'))
  const result = await withRoster()

  await act(() => result.current.create())

  expect(mocks.createEvent).toHaveBeenCalledTimes(1)
  expect(mocks.navigate).toHaveBeenCalledWith('/event/e1/performances', {
    state: {
      notice: expect.stringContaining('3行目で止まりました。') as string,
    },
  })
  expect(result.current.formError).toBe('')
})

it('名簿がなければ取り込まずに作成する', async () => {
  const { result } = renderHook(() => useEvents(), { wrapper })
  await waitFor(() => expect(mocks.listEvents).toHaveBeenCalled())

  await act(() => result.current.create())

  expect(mocks.importRoster).not.toHaveBeenCalled()
  expect(mocks.navigate).toHaveBeenCalledWith('/event/e1')
})
