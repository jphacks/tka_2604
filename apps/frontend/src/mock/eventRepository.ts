import type { EventRepository } from '../features/event/repositories/types'
import { delay } from './delay'
import { mockWorkspaceStore } from './workspaceStore'

export const mockEventRepository: Pick<EventRepository, 'getEvent'> = {
  async getEvent(eventId, signal) {
    await delay(180, signal)
    return mockWorkspaceStore.getEvent(eventId)
  },
}
