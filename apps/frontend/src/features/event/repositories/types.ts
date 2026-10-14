import type { EventData } from '../model/types'

// The UI depends on this contract. An API adapter can replace the mock adapter.
export interface EventRepository {
  getEvent(eventId: string, signal?: AbortSignal): Promise<EventData>
  sendMessage(
    eventId: string,
    message: string,
    signal?: AbortSignal,
  ): Promise<string>
  generateDraft(eventId: string, signal?: AbortSignal): Promise<string>
}
