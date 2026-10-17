import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createDb } from '../../src/db/index'
import { chatMessages, users } from '../../src/db/schema'
import { chatRepository } from '../../src/repositories/chat'
import { eventsRepository } from '../../src/repositories/events'
import { testDatabase } from '../helpers/database'

let local: Awaited<ReturnType<typeof testDatabase>>
let db: ReturnType<typeof createDb>
let messages: ReturnType<typeof chatRepository>
let events: ReturnType<typeof eventsRepository>
let eventId: string

beforeEach(async () => {
  local = await testDatabase()
  db = createDb(local.binding)
  await db.insert(users).values([
    { userId: 'owner', passwordHash: 'test-only' },
    { userId: 'other', passwordHash: 'test-only' },
  ])
  events = eventsRepository(db)
  eventId = (await events.create('owner', { title: 'Live' })).eventId
  messages = chatRepository(db)
})
afterEach(async () => local?.dispose())

describe('chat repository', () => {
  it('saves user and assistant text with ordered metadata without updating the event', async () => {
    const before = await events.get('owner', eventId)
    const user = await messages.saveUser('owner', eventId, 'u1', 'hello')
    const assistant = await messages.saveReply('owner', eventId, 'u1', 'reply')
    expect(user).toMatchObject({
      messageId: 'u1',
      seq: 0,
      role: 'user',
      text: 'hello',
      replyToMessageId: null,
    })
    expect(assistant).toMatchObject({
      seq: 1,
      role: 'assistant',
      text: 'reply',
      replyToMessageId: 'u1',
    })
    expect(assistant.createdAt).toMatch(/Z$/)
    expect(await messages.getReply('owner', eventId, 'u1')).toEqual(assistant)
    expect((await events.getChat('owner', eventId))?.messages).toEqual([
      user,
      assistant,
    ])
    expect(await events.get('owner', eventId)).toEqual(before)
  })

  it('reuses the same user message ID and text but rejects different text or event', async () => {
    const user = await messages.saveUser('owner', eventId, 'u1', 'hello')
    expect(await messages.saveUser('owner', eventId, 'u1', 'hello')).toEqual(
      user,
    )
    await expect(
      messages.saveUser('owner', eventId, 'u1', 'changed'),
    ).rejects.toMatchObject({ code: 'chat_message_conflict' })
    const another = await events.create('owner', { title: 'Another' })
    await expect(
      messages.saveUser('owner', another.eventId, 'u1', 'hello'),
    ).rejects.toMatchObject({ code: 'chat_message_conflict' })
    expect(await db.select().from(chatMessages)).toHaveLength(1)
  })

  it('allocates unique sequence numbers for concurrent messages and prevents duplicate replies', async () => {
    const rows = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        messages.saveUser('owner', eventId, `u${index}`, `text-${index}`),
      ),
    )
    expect(rows.map((row) => row.seq).sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ])
    const replies = await Promise.all([
      messages.saveReply('owner', eventId, 'u0', 'reply-one'),
      messages.saveReply('owner', eventId, 'u0', 'reply-two'),
    ])
    expect(replies[0]).toEqual(replies[1])
    expect(await db.select().from(chatMessages)).toHaveLength(9)
  })

  it('does not save or expose messages for other owners, missing or deleted events', async () => {
    await messages.saveUser('owner', eventId, 'u1', 'hello')
    await messages.saveReply('owner', eventId, 'u1', 'reply')
    for (const [owner, id] of [
      ['other', eventId],
      ['owner', 'missing'],
    ]) {
      await expect(
        messages.saveUser(owner, id, 'u2', 'hello'),
      ).rejects.toMatchObject({ code: 'event_not_found' })
      await expect(
        messages.saveReply(owner, id, 'u1', 'reply'),
      ).rejects.toMatchObject({ code: 'event_not_found' })
      expect(await messages.getReply(owner, id, 'u1')).toBeNull()
    }
    await events.remove('owner', eventId)
    await expect(
      messages.saveUser('owner', eventId, 'u2', 'hello'),
    ).rejects.toMatchObject({ code: 'event_not_found' })
    await expect(
      messages.saveReply('owner', eventId, 'u1', 'reply'),
    ).rejects.toMatchObject({ code: 'event_not_found' })
    expect(await messages.getReply('owner', eventId, 'u1')).toBeNull()
    expect(await db.select().from(chatMessages)).toHaveLength(2)
  })

  it('requires a same-event user parent and does not reuse an assistant ID as a user message', async () => {
    const another = await events.create('owner', { title: 'Another' })
    await messages.saveUser('owner', another.eventId, 'other-u', 'hello')
    for (const parent of ['missing', 'other-u'])
      await expect(
        messages.saveReply('owner', eventId, parent, 'reply'),
      ).rejects.toMatchObject({ code: 'chat_message_conflict' })
    await messages.saveUser('owner', eventId, 'u1', 'hello')
    const reply = await messages.saveReply('owner', eventId, 'u1', 'reply')
    await expect(
      messages.saveUser('owner', eventId, reply.messageId, 'reply'),
    ).rejects.toMatchObject({ code: 'chat_message_conflict' })
    await expect(
      messages.saveReply('owner', eventId, reply.messageId, 'reply'),
    ).rejects.toMatchObject({ code: 'chat_message_conflict' })
  })
})
