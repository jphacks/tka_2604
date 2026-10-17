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
  title: string
  date?: string | null
  venue?: string | null
  description?: string | null
}

export type EventSettingsPatch = Partial<
  Pick<EventDetails, 'title' | 'status' | 'date' | 'venue' | 'description'>
>

export interface EventRepository {
  list(userId: string): Promise<EventSummary[]>
  get(userId: string, eventId: string): Promise<EventDetails | null>
  create(userId: string, input: CreateEventInput): Promise<EventDetails>
  update(
    userId: string,
    eventId: string,
    expectedUpdatedAt: string,
    patch: EventSettingsPatch,
  ): Promise<EventDetails>
  remove(userId: string, eventId: string): Promise<void>
}
