import { afterEach, describe, expect, it, vi } from 'vitest'

import { sendChatMessage } from './chatRepository'

afterEach(() => vi.unstubAllGlobals())

describe('chat HTTP adapter', () => {
  it('forwards the event, JSON body and cancellation signal', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ reply: 'backendの返信' }))
    vi.stubGlobal('fetch', fetch)
    const controller = new AbortController()
    expect(
      await sendChatMessage('event-a', '本文', controller.signal, 'stable-id'),
    ).toEqual({ reply: 'backendの返信' })
    expect(fetch).toHaveBeenCalledWith(
      '/api/events/event-a/chat',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ message: '本文', messageId: 'stable-id' }),
        signal: controller.signal,
      }),
    )
  })

  it.each([{}, { reply: '' }, { reply: 1 }])(
    'rejects malformed successful responses: %j',
    async (body) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body)))
      await expect(sendChatMessage('event-a', '本文')).rejects.toThrow(
        '応答を読み取れませんでした',
      )
    },
  )

  it.each([400, 500])(
    'rejects HTTP %i instead of showing a successful reply',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            Response.json({ error: '内部の詳細' }, { status }),
          ),
      )
      await expect(sendChatMessage('event-a', '本文')).rejects.toThrow(
        '送信に失敗しました',
      )
    },
  )
})

it.each([
  { expectedUpdatedAt: 'now', actions: [] },
  {
    expectedUpdatedAt: 'now',
    actions: [{ type: 'add_constraint', constraint: null }],
  },
])('rejects a malformed proposal without displaying it', async (proposal) => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json({ reply: '案です', proposal })),
  )
  await expect(sendChatMessage('event-a', '本文')).rejects.toThrow(
    '変更案を読み取れませんでした',
  )
})
