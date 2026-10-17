import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadEvent } from '../../../src/db/events'
import { createDb } from '../../../src/db/index'
import {
  bands,
  chatMessages,
  constraints,
  parts,
  users,
} from '../../../src/db/schema'
import { eventsRepository } from '../../../src/repositories/events'
import { chatService } from '../../../src/services/chat/service.ts'
import type { ChatModel } from '../../../src/services/chat/types.ts'
import { testDatabase } from '../../helpers/database'
import { approval, currentConstraint } from './fixtures.ts'

let local: Awaited<ReturnType<typeof testDatabase>>
let db: ReturnType<typeof createDb>
let repository: ReturnType<typeof eventsRepository>
let eventId: string

beforeEach(async () => {
  local = await testDatabase()
  db = createDb(local.binding)
  await db.insert(users).values([
    { userId: 'owner', passwordHash: 'test-only' },
    { userId: 'other', passwordHash: 'test-only' },
  ])
  repository = eventsRepository(db)
  const event = await repository.create('owner', { title: 'Live' })
  eventId = event.eventId
  await db
    .insert(parts)
    .values({ partId: 'part-2', eventId, sortOrder: 1, partName: null })
  await db.insert(bands).values({
    bandId: 'band-a',
    eventId,
    bandName: 'A',
    requestText: 'private form text',
    requestStatus: 'pending',
  })
  await db.insert(constraints).values({
    constraintId: 'constraint-1',
    eventId,
    constraintJson: JSON.stringify({
      ...currentConstraint(),
      event_id: eventId,
    }),
    sourceBandId: 'band-a',
  })
  for (let index = 1; index <= 8; index++) {
    await db.insert(chatMessages).values({
      messageId: `message-${index}`,
      eventId,
      seq: index,
      role: index % 2 ? 'user' : 'assistant',
      text: `text-${index}`,
      replyToMessageId: index % 2 ? null : `message-${index - 1}`,
    })
  }
})
afterEach(async () => local?.dispose())

const turn = { userMessage: 'Aを第2部にしたい', pendingProposal: null }

describe('chat generation using the PR #60 event repository', () => {
  it('reads persisted state and ordered history without mutating business data or messages', async () => {
    const model = vi.fn<ChatModel>().mockResolvedValue(approval())
    const before = await loadEvent(db, 'owner', eventId)
    const result = await chatService(repository, 'owner', model).generate(
      eventId,
      turn,
    )
    expect(result.updatedAt).toBe(before?.event.updatedAt)
    const request = model.mock.calls[0][0]
    expect(request.context.constraints[0]).toMatchObject({
      enabled: false,
      event_id: eventId,
    })
    expect(request.context.currentPlacements).toEqual([])
    expect(request.context.parts).toHaveLength(2)
    expect(request.recentMessages.map((message) => message.text)).toEqual([
      'text-3',
      'text-4',
      'text-5',
      'text-6',
      'text-7',
      'text-8',
    ])
    expect(JSON.stringify(request)).not.toContain('private form text')
    expect(await loadEvent(db, 'owner', eventId)).toEqual(before)
    expect((await repository.getChat('owner', eventId))?.messages).toHaveLength(
      8,
    )
  })

  it('does not call the model for other owners or deleted events', async () => {
    const model = vi.fn<ChatModel>()
    await expect(
      chatService(repository, 'other', model).generate(eventId, turn),
    ).rejects.toMatchObject({ code: 'event_not_found' })
    await repository.remove('owner', eventId)
    await expect(
      chatService(repository, 'owner', model).generate(eventId, turn),
    ).rejects.toMatchObject({ code: 'event_not_found' })
    expect(model).not.toHaveBeenCalled()
  })
})
