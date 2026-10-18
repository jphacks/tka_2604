import type { EventRepository } from '../events/types'
import { chatService } from './service'
import type { ChatModel, ChatRepository, ChatResponse } from './types'

export function chatMessageService(
  eventRepository: EventRepository,
  messages: ChatRepository,
  userId: string,
  model: ChatModel,
) {
  const generator = chatService(eventRepository, userId, model)
  return {
    async send(
      eventId: string,
      input: { messageId: string; message: string },
    ): Promise<ChatResponse> {
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
      // Proposals stay transient until explicitly applied through constraint saving.
      // Only the request that inserted this answer may return its proposal.
      const replyId = crypto.randomUUID()
      const assistant = await messages.saveReply(
        userId,
        eventId,
        user.messageId,
        generated.output.message,
        replyId,
      )
      return {
        reply: assistant.text,
        ...(generated.output.type === 'approval_required' &&
        assistant.messageId === replyId
          ? {
              proposal: {
                expectedUpdatedAt: generated.updatedAt,
                actions: generated.output.actions,
              },
            }
          : {}),
      }
    },
  }
}
