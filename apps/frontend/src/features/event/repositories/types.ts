import type { ChatMessage, EventData } from '../model/types'

interface EventSaveResult {
  updatedAt: string
  constraintSources?: EventData['constraintSources']
}

// The UI depends on this contract. An API adapter can replace the mock adapter.
export interface EventRepository {
  getEvent(eventId: string, signal?: AbortSignal): Promise<EventData>
  getMessages(eventId: string, signal?: AbortSignal): Promise<ChatMessage[]>
  saveSchedule(event: EventData): Promise<EventSaveResult>
  saveConstraints(event: EventData): Promise<EventSaveResult>
  sendMessage(
    eventId: string,
    message: string,
    signal?: AbortSignal,
    messageId?: string,
  ): Promise<string>
}
