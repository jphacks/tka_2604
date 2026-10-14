import type { EventData } from '../model/event'
import type {
  EventDetails,
  EventDraft,
  EventSummary,
  FormSettings,
  PerformanceDraft,
  RegistrationData,
  Session,
} from '../model/workspace'

export interface WorkspaceRepository {
  getSession(): Promise<Session | null>
  signIn(email: string): Promise<Session>
  signOut(): Promise<void>
  listEvents(signal?: AbortSignal): Promise<EventSummary[]>
  createEvent(draft: EventDraft): Promise<EventDetails>
  updateDetails(
    id: string,
    patch: Partial<Omit<EventDetails, 'id'>>,
  ): Promise<EventDetails>
  deleteEvent(id: string): Promise<void>
  getRegistration(id: string, signal?: AbortSignal): Promise<RegistrationData>
  updateForm(id: string, settings: FormSettings): Promise<void>
  addPerformance(id: string, draft: PerformanceDraft): Promise<string>
  submitPerformance(id: string, draft: PerformanceDraft): Promise<string>
  updatePerformance(
    id: string,
    performanceId: string,
    draft: PerformanceDraft,
  ): Promise<void>
  deletePerformance(id: string, performanceId: string): Promise<void>
  rememberEvent(event: EventData): void
}
