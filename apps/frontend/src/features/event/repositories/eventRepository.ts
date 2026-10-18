import { eventsApi } from '../../../shared/api/events'
import { recordChatDecision, sendChatMessage } from './chatRepository'
import type { EventRepository } from './types'

export const eventRepository: EventRepository = {
  getEvent: (id, signal) => eventsApi.getEvent(id, signal),
  getMessages: eventsApi.getMessages,
  solve: (event) => eventsApi.solve(event),
  saveSchedule: (event) => eventsApi.saveSchedule(event),
  async saveConstraints(event) {
    const saved = await eventsApi.saveConstraints(event)
    return {
      updatedAt: saved.updatedAt,
      constraintSources: Object.fromEntries(
        saved.constraints.map((item) => [
          item.constraint.constraint_id,
          item.sourceBandId,
        ]),
      ),
    }
  },
  sendMessage: sendChatMessage,
  recordDecision: recordChatDecision,
}
