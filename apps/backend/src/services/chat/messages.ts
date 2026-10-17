import type { EventRepository } from '../events/types'
import { chatService } from './service'
import type { ChatModel, ChatRepository } from './types'

export function chatMessageService(
  eventRepository: EventRepository,
  messages: ChatRepository,
  userId: string,
  model: ChatModel,
) {
  const generator = chatService(eventRepository, userId, model)
  return {
    async send(eventId: string, input: { messageId: string; message: string }) {
      // Persist before external I/O. Failure leaves the user message available
      // for a retry with the same ID, without modifying business updatedAt.
      const user = await messages.saveUser(
        userId,
        eventId,
        input.messageId,
        input.message,
      )
      const previous = await messages.getReply(userId, eventId, user.messageId)
      if (previous) return { reply: previous.text }
      const generated = await generator.generate(eventId, {
        userMessage: user.text,
        pendingProposal: null,
        currentMessageId: user.messageId,
      })
      // Keep only conversational text; provider metadata, type and unapplied
      // actions are not stored in chat history or applied as constraints.
      const assistant = await messages.saveReply(
        userId,
        eventId,
        user.messageId,
        generated.output.message,
      )
      return { reply: assistant.text }
    },
  }
}
