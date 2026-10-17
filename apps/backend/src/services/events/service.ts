import { EventError } from './errors'
import type {
  CreateEventInput,
  EventRepository,
  EventSettingsPatch,
} from './types'

export function eventService(repository: EventRepository, userId: string) {
  return {
    list: () => repository.list(userId),
    async get(eventId: string) {
      const event = await repository.get(userId, eventId)
      if (!event) throw new EventError('event_not_found')
      return event
    },
    create: (input: CreateEventInput) => repository.create(userId, input),
    update(
      eventId: string,
      input: EventSettingsPatch & { expectedUpdatedAt: string },
    ) {
      const { expectedUpdatedAt, ...patch } = input
      return repository.update(userId, eventId, expectedUpdatedAt, patch)
    },
    remove: (eventId: string) => repository.remove(userId, eventId),
  }
}
