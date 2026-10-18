import type { ChatResponse } from '../../../../../backend/src/services/chat/types'
import type { SolveResponse } from '../../../shared/api/events'
import type { ChatMessage, EventData } from '../model/types'

interface EventSaveResult {
  updatedAt: string
  constraintSources?: EventData['constraintSources']
}

export interface EventRepository {
  getEvent(eventId: string, signal?: AbortSignal): Promise<EventData>
  getMessages(eventId: string, signal?: AbortSignal): Promise<ChatMessage[]>
  solve(event: EventData): Promise<SolveResponse>
  saveSchedule(event: EventData): Promise<EventSaveResult>
  saveConstraints(event: EventData): Promise<EventSaveResult>
  deleteBand(
    eventId: string,
    bandId: string,
    expectedUpdatedAt: string,
  ): Promise<{ eventId: string; bandId: string; updatedAt: string }>
  sendMessage(
    eventId: string,
    message: string,
    signal?: AbortSignal,
    messageId?: string,
  ): Promise<ChatResponse>
}
