import type { EventRepository } from '../features/event/repositories/types'
import { delay } from './delay'
import { mockReplies } from './eventData'
import { mockWorkspaceStore } from './workspaceStore'

export const mockEventRepository: EventRepository = {
  async getEvent(eventId, signal) {
    await delay(180, signal)
    return mockWorkspaceStore.getEvent(eventId)
  },
  async sendMessage(_eventId, message, signal) {
    await delay(700, signal)
    return mockReplies[message.length % mockReplies.length]
  },
}
