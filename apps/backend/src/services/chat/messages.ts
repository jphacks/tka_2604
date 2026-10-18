import type { EventRepository } from '../events/types'
import type { SolverClient } from '../solver/contract'
import { chatService } from './service'
import type { ChatModel, ChatRepository, ChatResponse } from './types'

export function recordChatDecision(
  messages: ChatRepository,
  userId: string,
  eventId: string,
  input: { messageId: string; decision: 'applied' | 'discarded' },
) {
  const text =
    input.decision === 'applied'
      ? '提案を受理しました。'
      : '提案を破棄しました。'
  return messages.saveUser(userId, eventId, input.messageId, text)
}

export function chatMessageService(
  eventRepository: EventRepository,
  messages: ChatRepository,
  userId: string,
  model: ChatModel,
  solver?: SolverClient,
) {
  const generator = chatService(eventRepository, userId, model, solver)
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
      // Proposals and reorders stay transient until explicitly applied by saving.
      // Only the request that inserted this answer may return its proposal.
      const replyId = crypto.randomUUID()
      const assistant = await messages.saveReply(
        userId,
        eventId,
        user.messageId,
        generated.output.message,
        replyId,
      )
      const fresh = assistant.messageId === replyId
      return {
        reply: assistant.text,
        ...(generated.output.type === 'approval_required' && fresh
          ? {
              proposal: {
                expectedUpdatedAt: generated.updatedAt,
                actions: generated.output.actions,
              },
            }
          : {}),
        ...(generated.reorder && fresh
          ? {
              reorder: {
                expectedUpdatedAt: generated.updatedAt,
                ...generated.reorder,
              },
            }
          : {}),
      }
    },
  }
}
