import type { Constraint } from '../../generated/constraint'

export type EventStatus = 'planning' | 'adjusting' | 'confirmed'

export interface EventDetails {
  eventId: string
  title: string
  status: EventStatus
  date: string | null
  venue: string | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface EventSummary extends EventDetails {
  performanceCount: number
  assignedCount: number
  partCount: number
  responseCount: null
}

export interface CreateEventInput {
  bandCounts?: number[]
  title: string
  date?: string | null
  venue?: string | null
  description?: string | null
}

export type EventSettingsPatch = Partial<
  Pick<EventDetails, 'title' | 'status' | 'date' | 'venue' | 'description'>
>

export interface EventSchedule {
  eventId: string
  updatedAt: string
  bands: {
    bandId: string
    bandName: string
    description: string | null
    requestText: string | null
    requestStatus:
      'pending' | 'needs_confirmation' | 'converted' | 'failed' | null
  }[]
  members: { memberId: string; memberName: string }[]
  memberships: { bandId: string; memberId: string }[]
  parts: {
    partId: string
    partName: string | null
    sortOrder: number
    bandCount: number
  }[]
  placements: { bandId: string; partId: string; order: number }[]
  unassignedBandIds: string[]
}

export interface EventConstraints {
  eventId: string
  updatedAt: string
  constraints: { constraint: Constraint; sourceBandId: string | null }[]
}

export interface StoredEventConstraints {
  eventId: string
  updatedAt: string
  constraints: {
    constraintId: string
    constraintJson: string
    sourceBandId: string | null
  }[]
}

export interface EventChat {
  eventId: string
  messages: {
    messageId: string
    seq: number
    role: 'user' | 'assistant'
    text: string
    replyToMessageId: string | null
    createdAt: string
  }[]
}

export interface EventRepository {
  list(userId: string): Promise<EventSummary[]>
  get(userId: string, eventId: string): Promise<EventDetails | null>
  getSchedule(userId: string, eventId: string): Promise<EventSchedule | null>
  getConstraints(
    userId: string,
    eventId: string,
  ): Promise<StoredEventConstraints | null>
  getChat(userId: string, eventId: string): Promise<EventChat | null>
  create(userId: string, input: CreateEventInput): Promise<EventDetails>
  update(
    userId: string,
    eventId: string,
    expectedUpdatedAt: string,
    patch: EventSettingsPatch,
  ): Promise<EventDetails>
  remove(userId: string, eventId: string): Promise<void>
}
