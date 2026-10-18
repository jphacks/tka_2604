import type { Constraint } from '../../generated/constraint.ts'
import type {
  EventChat,
  EventConstraints,
  EventDetails,
  EventSchedule,
} from '../events/types.ts'

export type { Constraint } from '../../generated/constraint.ts'

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never

export type ProposedConstraint = DistributiveOmit<
  Constraint,
  | 'schema_version'
  | 'constraint_id'
  | 'event_id'
  | 'source_text'
  | 'hardness'
  | 'priority'
  | 'enabled'
> & {
  hardness: 'hard' | 'soft' | null
  priority: 'high' | 'mid' | 'low' | null
}

export type ConstraintProposalAction =
  | { type: 'add_constraint'; constraint: ProposedConstraint }
  | {
      type: 'update_constraint'
      constraintId: string
      constraint: ProposedConstraint
    }
  | { type: 'delete_constraint'; constraintId: string }

export type AIChatInput = {
  context: {
    event: Pick<EventDetails, 'title'>
    parts: EventSchedule['parts']
    bands: Pick<EventSchedule['bands'][number], 'bandId' | 'bandName'>[]
    members: EventSchedule['members']
    memberships: EventSchedule['memberships']
    constraints: EventConstraints['constraints'][number]['constraint'][]
    currentPlacements: EventSchedule['placements']
  }
  recentMessages: Pick<EventChat['messages'][number], 'role' | 'text'>[]
  userMessage: string
  pendingProposal: { actions: ConstraintProposalAction[] } | null
}

export type AIChatOutput =
  | {
      type: 'approval_required'
      message: string
      actions: [ConstraintProposalAction, ...ConstraintProposalAction[]]
    }
  | { type: 'clarification_required'; message: string; actions: [] }
  | { type: 'answer'; message: string; actions: [] }

export type ChatModel = (input: AIChatInput) => Promise<unknown>

export type ChatTurn = Pick<AIChatInput, 'userMessage' | 'pendingProposal'> & {
  currentMessageId?: string
}

export type ChatGeneration = {
  eventId: string
  updatedAt: string
  output: AIChatOutput
}

export interface ChatResponse {
  reply: string
  proposal?: { expectedUpdatedAt: string; actions: ConstraintProposalAction[] }
}

export type ChatMessage = EventChat['messages'][number]

export interface ChatRepository {
  saveUser(
    userId: string,
    eventId: string,
    messageId: string,
    text: string,
  ): Promise<ChatMessage>
  getReply(
    userId: string,
    eventId: string,
    messageId: string,
  ): Promise<ChatMessage | null>
  saveReply(
    userId: string,
    eventId: string,
    messageId: string,
    text: string,
    replyId?: string,
  ): Promise<ChatMessage>
}
