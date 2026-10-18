import { EventError } from '../events/errors.ts'
import type {
  EventChat,
  EventConstraints,
  EventDetails,
  EventSchedule,
} from '../events/types.ts'
import { aiChatInputSchema } from './contract.ts'
import { AIChatError } from './errors.ts'
import type { AIChatInput, ChatTurn } from './types.ts'
import { validateActions, validateContext } from './validation.ts'

// Use PR #60's decoded DTOs instead of reading DB rows in the chat service.
export type ChatEventSnapshot = {
  event: EventDetails
  schedule: EventSchedule
  constraints: EventConstraints
  chat: EventChat
}

export function buildAIChatInput(
  snapshot: ChatEventSnapshot,
  turn: ChatTurn,
): AIChatInput {
  const { event, schedule, constraints, chat } = snapshot
  if (
    [schedule, constraints, chat].some(
      (value) => value.eventId !== event.eventId,
    )
  )
    throw new Error('invalid_event_snapshot')
  if (
    schedule.updatedAt !== event.updatedAt ||
    constraints.updatedAt !== event.updatedAt
  )
    throw new EventError('event_save_conflict')
  if (
    constraints.constraints.some(
      ({ constraint }) => constraint.event_id !== event.eventId,
    )
  )
    throw new Error('invalid_stored_constraint')

  const currentMessage = turn.currentMessageId
    ? chat.messages.find(
        (message) => message.messageId === turn.currentMessageId,
      )
    : undefined
  if (turn.currentMessageId && !currentMessage)
    throw new AIChatError('ai_chat_invalid_input')
  if (
    currentMessage &&
    (currentMessage.role !== 'user' ||
      currentMessage.text.trim() !== turn.userMessage.trim())
  )
    throw new AIChatError('ai_chat_invalid_input')
  const recentMessages = chat.messages
    .filter((message) => !currentMessage || message.seq < currentMessage.seq)
    .toSorted((a, b) => a.seq - b.seq)
    .map(({ role, text }) => ({ role, text }))

  const parsed = aiChatInputSchema.safeParse({
    context: {
      event: { title: event.title },
      parts: schedule.parts.map(({ partId, sortOrder, partName }) => ({
        partId,
        sortOrder,
        partName,
      })),
      bands: schedule.bands.map(({ bandId, bandName, description }) => ({
        bandId,
        bandName,
        description,
      })),
      members: schedule.members.map(({ memberId, memberName }) => ({
        memberId,
        memberName,
      })),
      memberships: schedule.memberships.map(({ bandId, memberId }) => ({
        bandId,
        memberId,
      })),
      constraints: constraints.constraints.map(({ constraint }) => constraint),
      currentPlacements: schedule.placements.map(
        ({ bandId, partId, order }) => ({ bandId, partId, order }),
      ),
    },
    recentMessages,
    userMessage: turn.userMessage,
    pendingProposal: turn.pendingProposal,
  })
  if (!parsed.success) throw new AIChatError('ai_chat_invalid_input')
  const input = parsed.data
  validateContext(input)
  if (input.pendingProposal)
    validateActions(
      input.pendingProposal.actions,
      input,
      'ai_chat_invalid_input',
    )
  return input
}
