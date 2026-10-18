import { and, eq, sql } from 'drizzle-orm'

import type { createDb } from '../db/index'
import { chatMessages, events } from '../db/schema'
import { ChatMessageError } from '../services/chat/errors'
import type { ChatMessage, ChatRepository } from '../services/chat/types'
import { EventError } from '../services/events/errors'

type Database = ReturnType<typeof createDb>
const fields = {
  messageId: chatMessages.messageId,
  seq: chatMessages.seq,
  role: chatMessages.role,
  text: chatMessages.text,
  replyToMessageId: chatMessages.replyToMessageId,
  createdAt: chatMessages.createdAt,
}
const returning = sql`message_id as messageId, seq, role, text,
  reply_to_message_id as replyToMessageId, created_at as createdAt`

export function chatRepository(db: Database): ChatRepository {
  const scope = (userId: string, eventId: string) =>
    and(
      eq(events.eventId, eventId),
      eq(events.createdUserId, userId),
      eq(events.isDeleted, false),
    )
  async function requireEvent(userId: string, eventId: string) {
    const event = await db
      .select({ eventId: events.eventId })
      .from(events)
      .where(scope(userId, eventId))
      .get()
    if (!event) throw new EventError('event_not_found')
  }
  const getReply: ChatRepository['getReply'] = async (
    userId,
    eventId,
    messageId,
  ) => {
    const reply = await db
      .select(fields)
      .from(chatMessages)
      .innerJoin(events, eq(events.eventId, chatMessages.eventId))
      .where(
        and(
          scope(userId, eventId),
          eq(chatMessages.replyToMessageId, messageId),
        ),
      )
      .get()
    return reply ?? null
  }
  return {
    getReply,
    async saveUser(userId, eventId, messageId, text) {
      // Allocate seq and enforce ownership in the same INSERT. A separate MAX read
      // would race with another request. Every value is bound by Drizzle.
      const [inserted] = await db.all<ChatMessage>(sql`
        INSERT INTO chat_messages (message_id, event_id, seq, role, text)
        SELECT ${messageId}, e.event_id,
          coalesce((SELECT max(seq) + 1 FROM chat_messages WHERE event_id = e.event_id), 0),
          'user', ${text}
        FROM events e
        WHERE e.event_id = ${eventId} AND e.created_user_id = ${userId} AND e.is_deleted = 0
        ON CONFLICT(message_id) DO NOTHING
        RETURNING ${returning}
      `)
      if (inserted) return inserted
      await requireEvent(userId, eventId)
      const existing = await db
        .select(fields)
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.eventId, eventId),
            eq(chatMessages.messageId, messageId),
          ),
        )
        .get()
      if (!existing || existing.role !== 'user' || existing.text !== text)
        throw new ChatMessageError()
      return existing
    },
    async saveReply(
      userId,
      eventId,
      messageId,
      text,
      replyId = crypto.randomUUID(),
    ) {
      const [inserted] = await db.all<ChatMessage>(sql`
        INSERT INTO chat_messages (message_id, event_id, seq, role, text, reply_to_message_id)
        SELECT ${replyId}, e.event_id,
          coalesce((SELECT max(seq) + 1 FROM chat_messages WHERE event_id = e.event_id), 0),
          'assistant', ${text}, ${messageId}
        FROM events e
        WHERE e.event_id = ${eventId} AND e.created_user_id = ${userId} AND e.is_deleted = 0
          AND EXISTS (SELECT 1 FROM chat_messages parent
            WHERE parent.message_id = ${messageId} AND parent.event_id = e.event_id AND parent.role = 'user')
        ON CONFLICT(reply_to_message_id) DO NOTHING
        RETURNING ${returning}
      `)
      if (inserted) return inserted
      await requireEvent(userId, eventId)
      const existing = await getReply(userId, eventId, messageId)
      if (!existing) throw new ChatMessageError()
      return existing
    },
  }
}
