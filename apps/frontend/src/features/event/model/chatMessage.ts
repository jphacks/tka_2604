import type { ChatMessage } from '../../../shared/model/event'

const decisionMessageId =
  /^decision-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export function isDecisionMessage(message: ChatMessage) {
  return message.role === 'user' && decisionMessageId.test(message.id)
}
