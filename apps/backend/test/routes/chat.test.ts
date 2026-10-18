import { eq } from 'drizzle-orm'
import { hc } from 'hono/client'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest'

import { createDb } from '../../src/db/index'
import {
  bands,
  chatMessages,
  constraints,
  events,
  users,
} from '../../src/db/schema'
import app, { type AppType } from '../../src/index'
import * as gemini from '../../src/integrations/llm/gemini'
import { openApiDocument } from '../../src/openapi'
import { eventsRepository } from '../../src/repositories/events'
import { AIChatError } from '../../src/services/chat/errors'
import type { ChatModel } from '../../src/services/chat/types'
import { testDatabase } from '../helpers/database'
import { expectJsonResponse } from '../helpers/openapi'

let local: Awaited<ReturnType<typeof testDatabase>>
let db: ReturnType<typeof createDb>
let eventId: string
let model: ReturnType<typeof vi.fn<ChatModel>>
const answer = { type: 'answer', message: 'AIの回答', actions: [] }
const responses =
  openApiDocument.paths['/api/events/{eventId}/chat'].post.responses

beforeEach(async () => {
  local = await testDatabase()
  db = createDb(local.binding)
  await db.insert(users).values([
    { userId: 'demo-owner', passwordHash: 'test-only' },
    { userId: 'other', passwordHash: 'test-only' },
  ])
  eventId = (await eventsRepository(db).create('demo-owner', { title: 'Live' }))
    .eventId
  model = vi.fn<ChatModel>().mockResolvedValue(answer)
  vi.spyOn(gemini, 'createGeminiChatModel').mockReturnValue(model)
})
afterEach(async () => {
  vi.restoreAllMocks()
  await local?.dispose()
})
function post(body: unknown, id = eventId) {
  return app.request(
    `/api/events/${id}/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    { DB: local.binding, GOOGLE_AI_API_TOKEN: 'test-only-key' },
  )
}
async function rows() {
  return (await eventsRepository(db).getChat('demo-owner', eventId))!.messages
}

describe('persisted chat POST API', () => {
  it('does not call the model if saving the user fails', async () => {
    await local.binding
      .prepare(
        "CREATE TRIGGER fail_user_save BEFORE INSERT ON chat_messages WHEN NEW.role = 'user' BEGIN SELECT RAISE(ABORT, 'private_db_detail'); END;",
      )
      .run()
    const response = await post({ message: 'hello' })
    expect(response.status).toBe(500)
    await expectJsonResponse(response, responses)
    expect(await db.select().from(chatMessages)).toEqual([])
    expect(gemini.createGeminiChatModel).not.toHaveBeenCalled()
  })

  it('rejects non-JSON input without saving', async () => {
    const response = await app.request(
      `/api/events/${eventId}/chat`,
      { method: 'POST', body: 'message=hello' },
      { DB: local.binding },
    )
    expect(response.status).toBe(422)
    await expectJsonResponse(response, responses)
    expect(await db.select().from(chatMessages)).toEqual([])
    expect(gemini.createGeminiChatModel).not.toHaveBeenCalled()
  })
  it('does not save an assistant answer after the event is deleted during generation', async () => {
    model.mockImplementationOnce(async () => {
      await db
        .update(events)
        .set({ isDeleted: true })
        .where(eq(events.eventId, eventId))
      return answer
    })
    const response = await post({ message: 'hello', messageId: 'u1' })
    expect(response.status).toBe(404)
    await expectJsonResponse(response, responses)
    expect(await db.select().from(chatMessages)).toMatchObject([
      { role: 'user', text: 'hello' },
    ])
  })
  it('saves the user before the model, excludes the current turn from history and saves only validated assistant text', async () => {
    const before = await eventsRepository(db).get('demo-owner', eventId)
    for (let seq = 0; seq < 8; seq++)
      await db.insert(chatMessages).values({
        messageId: `old-${seq}`,
        eventId,
        seq,
        role: 'user',
        text: `old-${seq}`,
      })
    await db.insert(bands).values({ bandId: 'band-a', eventId, bandName: 'A' })
    const output = {
      type: 'approval_required',
      message: 'Aの条件を追加しますか？',
      actions: [
        {
          type: 'add_constraint',
          constraint: {
            type: 'in_range',
            targets: { band_ids: ['band-a'] },
            params: { kind: 'parts', part_ids: [0] },
            hardness: null,
            priority: null,
          },
        },
      ],
    }
    model.mockImplementationOnce(async (input) => {
      expect((await rows()).at(-1)).toMatchObject({
        messageId: 'u1',
        role: 'user',
        text: 'hello',
      })
      expect(input.userMessage).toBe('hello')
      expect(input.recentMessages.map((entry) => entry.text)).toEqual([
        'old-2',
        'old-3',
        'old-4',
        'old-5',
        'old-6',
        'old-7',
      ])
      return output
    })
    const response = await post({ message: '  hello  ', messageId: 'u1' })
    expect(response.status).toBe(200)
    await expectJsonResponse(response, responses)
    expect(await response.json()).toEqual({
      reply: output.message,
      proposal: {
        expectedUpdatedAt: before!.updatedAt,
        actions: output.actions,
      },
    })
    expect(response.headers.get('X-Chat-Message-Id')).toBe('u1')
    expect((await rows()).slice(-2)).toMatchObject([
      { messageId: 'u1', role: 'user', text: 'hello', replyToMessageId: null },
      { role: 'assistant', text: output.message, replyToMessageId: 'u1' },
    ])
    expect(await db.select().from(constraints)).toEqual([])
    expect(await eventsRepository(db).get('demo-owner', eventId)).toEqual(
      before,
    )
    const history = await app.request(
      `/api/events/${eventId}/chat`,
      {},
      { DB: local.binding },
    )
    expect(history.status).toBe(200)
    await expectJsonResponse(
      history,
      openApiDocument.paths['/api/events/{eventId}/chat'].get.responses,
    )
    expect(await history.json()).toEqual({ eventId, messages: await rows() })
  })

  it('generates a message ID when omitted and returns the saved answer on replay without another model call', async () => {
    const response = await post({ message: 'hello' })
    expect(response.status).toBe(200)
    const messageId = response.headers.get('X-Chat-Message-Id')
    expect(messageId).toBeTruthy()
    const replay = await post({ message: 'hello', messageId })
    expect(replay.status).toBe(200)
    expect(await replay.json()).toEqual({ reply: answer.message })
    expect(model).toHaveBeenCalledTimes(1)
    expect(await rows()).toHaveLength(2)
  })

  it.each([
    ['ai_chat_provider_error', 502],
    ['ai_chat_timeout', 504],
  ] as const)(
    'keeps a failed user turn and supports a retry after %s',
    async (code, status) => {
      model.mockRejectedValueOnce(new AIChatError(code))
      const failed = await post({ message: 'hello', messageId: 'retry-user' })
      expect(failed.status).toBe(status)
      await expectJsonResponse(failed, responses)
      expect(failed.headers.get('X-Chat-Message-Id')).toBe('retry-user')
      expect(await rows()).toMatchObject([
        { messageId: 'retry-user', role: 'user' },
      ])
      const retried = await post({ message: 'hello', messageId: 'retry-user' })
      expect(retried.status).toBe(200)
      expect(await rows()).toHaveLength(2)
      expect(model.mock.calls[1][0].recentMessages).toEqual([])
    },
  )

  it('does not persist invalid model output', async () => {
    model.mockResolvedValueOnce({
      type: 'answer',
      message: 'broken',
      actions: [{ type: 'delete_constraint', constraintId: 'invented' }],
    })
    const response = await post({ message: 'hello' })
    expect(response.status).toBe(502)
    await expectJsonResponse(response, responses)
    expect(await rows()).toMatchObject([{ role: 'user', text: 'hello' }])
  })

  it('preserves the user on assistant-save failure and exposes no DB details', async () => {
    await local.binding
      .prepare(
        "CREATE TRIGGER fail_chat_reply BEFORE INSERT ON chat_messages WHEN NEW.role = 'assistant' BEGIN SELECT RAISE(ABORT, 'private_db_detail'); END;",
      )
      .run()
    const response = await post({ message: 'hello', messageId: 'u1' })
    expect(response.status).toBe(500)
    await expectJsonResponse(response, responses)
    expect(await response.text()).not.toContain('private_db_detail')
    expect(await rows()).toMatchObject([{ role: 'user', text: 'hello' }])
    await local.binding.prepare('DROP TRIGGER fail_chat_reply').run()
    expect((await post({ message: 'hello', messageId: 'u1' })).status).toBe(200)
    expect(await rows()).toHaveLength(2)
  })

  it('does not call the model or save messages for missing, deleted or other-owner events', async () => {
    const repository = eventsRepository(db)
    const other = await repository.create('other', { title: 'Other' })
    await repository.remove('demo-owner', eventId)
    for (const id of ['missing', eventId, other.eventId]) {
      const response = await post({ message: 'hello' }, id)
      expect(response.status).toBe(404)
      await expectJsonResponse(response, responses)
    }
    expect(await db.select().from(chatMessages)).toEqual([])
    expect(gemini.createGeminiChatModel).not.toHaveBeenCalled()
  })

  it('rejects reuse of a message ID for a different body or event', async () => {
    await post({ message: 'hello', messageId: 'u1' })
    const another = await eventsRepository(db).create('demo-owner', {
      title: 'Another',
    })
    for (const [id, message] of [
      [eventId, 'changed'],
      [another.eventId, 'hello'],
    ]) {
      const response = await post({ message, messageId: 'u1' }, id)
      expect(response.status).toBe(409)
      await expectJsonResponse(response, responses)
      expect(await response.json()).toMatchObject({
        error: { code: 'chat_message_conflict' },
      })
    }
    expect(model).toHaveBeenCalledTimes(1)
    expect(await rows()).toHaveLength(2)
  })

  it('persists exactly one user and one answer for concurrent retries', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let count = 0
    model.mockImplementation(async () => {
      const current = ++count
      if (count === 2) release()
      await gate
      return { ...answer, message: `answer-${current}` }
    })
    const responses = await Promise.all([
      post({ message: 'hello', messageId: 'u1' }),
      post({ message: 'hello', messageId: 'u1' }),
    ])
    expect(responses.map((response) => response.status)).toEqual([200, 200])
    const bodies = await Promise.all(
      responses.map((response) => response.json()),
    )
    expect(bodies[0]).toEqual(bodies[1])
    expect(await rows()).toHaveLength(2)
  })

  it('saves the user even when the API key is missing, and cached answers need no key', async () => {
    vi.mocked(gemini.createGeminiChatModel).mockRestore()
    const request = () =>
      app.request(
        `/api/events/${eventId}/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'hello', messageId: 'u1' }),
        },
        { DB: local.binding },
      )
    const failed = await request()
    expect(failed.status).toBe(500)
    expect(await rows()).toMatchObject([{ messageId: 'u1', role: 'user' }])
    vi.spyOn(gemini, 'createGeminiChatModel').mockReturnValue(model)
    expect((await request()).status).toBe(200)
    vi.mocked(gemini.createGeminiChatModel).mockRestore()
    expect((await request()).status).toBe(200)
    expect(model).toHaveBeenCalledTimes(1)
  })

  it.each([
    {},
    null,
    { message: 1 },
    { message: '' },
    { message: ' ' },
    { message: 'a'.repeat(1001) },
    { message: 'hello', userId: 'other' },
    { message: 'hello', messageId: '' },
    { message: 'hello', messageId: 'bad\r\nheader' },
    { message: 'hello', messageId: 'a'.repeat(129) },
  ])(
    'rejects invalid input %j without saving or invoking the model',
    async (body) => {
      const response = await post(body)
      expect(response.status).toBe(422)
      await expectJsonResponse(response, responses)
      expect(await db.select().from(chatMessages)).toEqual([])
      expect(gemini.createGeminiChatModel).not.toHaveBeenCalled()
    },
  )

  it('accepts a 1000-character message', async () => {
    expect((await post({ message: 'a'.repeat(1000) })).status).toBe(200)
  })

  it('rejects malformed JSON without saving', async () => {
    const response = await app.request(
      `/api/events/${eventId}/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      },
      { DB: local.binding },
    )
    expect(response.status).toBe(400)
    await expectJsonResponse(response, responses)
    expect(await db.select().from(chatMessages)).toEqual([])
  })

  it('shares the request and unchanged reply shape through Hono RPC', async () => {
    const client = hc<AppType>('http://localhost', {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) =>
        app.request(input instanceof URL ? input.toString() : input, init, {
          DB: local.binding,
          GOOGLE_AI_API_TOKEN: 'test-only-key',
        }),
    })
    const response = await client.api.events[':eventId'].chat.$post({
      param: { eventId },
      json: { message: 'hello', messageId: 'rpc-user' },
    })
    if (response.status !== 200) throw new Error('Expected success')
    const body = await response.json()
    expectTypeOf(body.reply).toEqualTypeOf<string>()
    expectTypeOf<
      NonNullable<typeof body.proposal>['expectedUpdatedAt']
    >().toEqualTypeOf<string>()
    expect(body.reply).toBe(answer.message)
  })
})
