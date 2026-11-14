import { act, renderHook } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'

import type { EventData } from '../../../shared/model/event'

const api = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  getMessages: vi.fn(),
  recordDecision: vi.fn(),
}))

vi.mock('../../../shared/api/events', () => ({
  eventsApi: { getMessages: api.getMessages },
}))
vi.mock('../repositories/eventRepository', () => ({ eventRepository: api }))
import { useEventChat } from './useEventChat'

const event: EventData = {
  id: 'a',
  name: 'A',
  members: [],
  performances: [],
  sections: [],
  unassigned: [],
  messages: [],
  constraints: [],
}
beforeEach(() => vi.resetAllMocks())

it('reuses the user ID after a lost response and restores authoritative history', async () => {
  const dispatch = vi.fn()
  const { result } = renderHook(() => useEventChat('a', dispatch, event, false))
  api.sendMessage
    .mockRejectedValueOnce(new Error('通信失敗'))
    .mockResolvedValueOnce({ reply: '回答' })
  act(() => result.current.setChatDraft('希望'))
  await act(() => result.current.sendMessage())
  expect(result.current.chatDraft).toBe('希望')
  expect(result.current.chatError).toBe('通信失敗')
  expect(dispatch).not.toHaveBeenCalledWith(
    expect.objectContaining({ type: 'notice' }),
  )
  const id = api.sendMessage.mock.calls[0][3] as string
  const messages = [
    { id, role: 'user', text: '希望', replyToMessageId: null },
    { id: 'answer', role: 'assistant', text: '回答', replyToMessageId: id },
  ]
  api.getMessages.mockResolvedValue(messages)
  await act(() => result.current.sendMessage())
  expect(api.sendMessage.mock.calls[1][3]).toBe(id)
  expect(result.current.chatError).toBe('')
  expect(dispatch).toHaveBeenLastCalledWith({ type: 'messages', messages })
})

it('retries an unanswered persisted message using its original ID after reopening', async () => {
  const user = {
    id: 'existing',
    role: 'user' as const,
    text: '元の発言',
    replyToMessageId: null,
  }
  api.sendMessage.mockResolvedValue({ reply: '回答' })
  api.getMessages.mockResolvedValue([user])
  const { result } = renderHook(() =>
    useEventChat('a', vi.fn(), { ...event, messages: [user] }, false),
  )
  expect(result.current.unanswered).toEqual([user])
  expect(result.current.chatError).toBe('')
  act(() => result.current.setChatDraft(user.text))
  await act(() => result.current.sendMessage())
  expect(api.sendMessage.mock.calls[0][3]).toBe('existing')
})

it('keeps decision logs in history without offering an AI retry', () => {
  const decision = {
    id: 'decision-123e4567-e89b-42d3-a456-426614174000',
    role: 'user' as const,
    text: '提案を破棄しました。',
    replyToMessageId: null,
  }
  const ordinary = { ...decision, id: 'decision-old', text: '通常の発言' }
  const { result } = renderHook(() =>
    useEventChat(
      'a',
      vi.fn(),
      { ...event, messages: [decision, ordinary] },
      false,
    ),
  )
  expect(result.current.unanswered).toEqual([ordinary])
})

it('retries a failed decision log with the same ID without asking the model', async () => {
  api.recordDecision.mockRejectedValueOnce(new Error('通信失敗'))
  api.recordDecision.mockResolvedValueOnce(undefined)
  api.getMessages.mockResolvedValue([])
  const { result } = renderHook(() => useEventChat('a', vi.fn(), event, false))
  await act(() => result.current.recordDecision('discarded'))
  expect(result.current.pendingDecision?.decision).toBe('discarded')
  expect(result.current.chatError).toBe('通信失敗')
  expect(result.current.canSend).toBe(true)
  await act(() => result.current.sendMessage())
  expect(api.recordDecision.mock.calls[1][2]).toBe(
    api.recordDecision.mock.calls[0][2],
  )
  expect(result.current.pendingDecision).toBeNull()
  expect(api.sendMessage).not.toHaveBeenCalled()
})

it('blocks chat while business edits are unsaved and ignores replies after leaving', async () => {
  const dispatch = vi.fn()
  const { result, rerender, unmount } = renderHook(
    ({ blocked }) => useEventChat('a', dispatch, event, blocked),
    { initialProps: { blocked: true } },
  )
  act(() => result.current.setChatDraft('希望'))
  await act(() => result.current.sendMessage())
  expect(api.sendMessage).not.toHaveBeenCalled()
  rerender({ blocked: false })
  let resolve!: (reply: string) => void
  api.sendMessage.mockReturnValue(
    new Promise<string>((done) => {
      resolve = done
    }),
  )
  let sending!: Promise<void>
  act(() => {
    sending = result.current.sendMessage()
    void result.current.sendMessage()
  })
  expect(api.sendMessage).toHaveBeenCalledTimes(1)
  const signal = api.sendMessage.mock.calls[0][2] as AbortSignal
  unmount()
  await act(async () => {
    resolve('遅い返信')
    await sending
  })
  expect(signal.aborted).toBe(true)
  expect(api.getMessages).not.toHaveBeenCalled()
  expect(dispatch).toHaveBeenCalledTimes(1)
})

it('keeps a reorder proposal with the reply text until it is dismissed', async () => {
  const reorder = {
    expectedUpdatedAt: '2026-10-17T00:00:00.000Z',
    source: 'llm',
    placements: [{ bandId: 'a', partId: 'p1', order: 0 }],
    results: [],
  }
  api.sendMessage.mockResolvedValue({ reply: '並べ替えました。', reorder })
  api.getMessages.mockResolvedValue([])
  const { result } = renderHook(() => useEventChat('a', vi.fn(), event, false))
  act(() => result.current.setChatDraft('盛り上げて'))
  await act(() => result.current.sendMessage())
  expect(result.current.chatReorder).toEqual({
    ...reorder,
    reply: '並べ替えました。',
  })
  act(() => result.current.dismissReorder())
  expect(result.current.chatReorder).toBeNull()
})

it('only shows errors after a failed request and keeps dismissed errors hidden', async () => {
  const message = { id: 'unanswered', role: 'user' as const, text: '希望' }
  const data = { ...event, messages: [message] }
  const { result, rerender } = renderHook(() =>
    useEventChat('a', vi.fn(), data, false),
  )
  expect(result.current.chatError).toBe('')
  api.sendMessage.mockRejectedValue(new Error('通信失敗'))
  act(() => result.current.setChatDraft('希望'))
  await act(() => result.current.sendMessage())
  expect(result.current.chatError).toBe('通信失敗')
  act(() => result.current.dismissChatError())
  rerender()
  expect(result.current.chatError).toBe('')
  expect(result.current.unanswered).toEqual([message])
  api.sendMessage.mockRejectedValueOnce(new Error('通信失敗'))
  act(() => result.current.setChatDraft('希望'))
  await act(() => result.current.sendMessage())
  expect(result.current.chatError).toBe('通信失敗')
  expect(api.sendMessage.mock.calls[0][3]).toBe('unanswered')
})
