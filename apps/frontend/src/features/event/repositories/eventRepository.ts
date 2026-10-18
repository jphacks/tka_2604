import { mockEventRepository } from '../../../mock/eventRepository'
import { eventsApi } from '../../../shared/api/events'
import {
  dataSource,
  unavailable,
} from '../../../shared/repositories/dataSource'
import { sendChatMessage } from './chatRepository'
import type { EventRepository } from './types'

export const eventRepository: EventRepository = {
  getEvent: (eventId, signal) =>
    dataSource === 'api'
      ? eventsApi.getEvent(eventId, signal)
      : mockEventRepository.getEvent(eventId, signal),
  getMessages:
    dataSource === 'api'
      ? eventsApi.getMessages
      : async (eventId, signal) =>
          (await mockEventRepository.getEvent(eventId, signal)).messages,
  solve: (event) =>
    dataSource === 'api' ? eventsApi.solve(event) : unavailable(),
  saveSchedule: (event) =>
    dataSource === 'api' ? eventsApi.saveSchedule(event) : unavailable(),
  async saveConstraints(event) {
    if (dataSource !== 'api') return unavailable()
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
}
