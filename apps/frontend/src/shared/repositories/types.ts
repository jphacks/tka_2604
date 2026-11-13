import type { EventData } from '../model/event'
import type {
  EventDetails,
  EventDraft,
  EventSummary,
  Session,
} from '../model/workspace'

export interface WorkspaceRepository {
  getSession: () => Promise<Session | null>
  signIn: (userId: string, password: string) => Promise<Session>
  signUp: (userId: string, password: string) => Promise<Session>
  signOut: () => Promise<void>
  getRoster(id: string, signal?: AbortSignal): Promise<EventData>
  getDetails(id: string, signal?: AbortSignal): Promise<EventDetails>
  listEvents(signal?: AbortSignal): Promise<EventSummary[]>
  createEvent(draft: EventDraft): Promise<EventDetails>
  updateDetails(
    id: string,
    patch: Partial<Omit<EventDetails, 'id'>>,
  ): Promise<EventDetails>
  deleteEvent(id: string): Promise<void>
  deleteBand(
    eventId: string,
    bandId: string,
    expectedUpdatedAt: string,
  ): Promise<{ eventId: string; bandId: string; updatedAt: string }>
}
