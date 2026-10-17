import { decodeConstraints } from './constraints'
import { EventError } from './errors'
import type {
  CreateEventInput,
  EventRepository,
  EventSettingsPatch,
} from './types'

export function eventService(repository: EventRepository, userId: string) {
  function required<T>(value: T | null): T {
    if (value === null) throw new EventError('event_not_found')
    return value
  }
  return {
    list: () => repository.list(userId),
    async get(eventId: string) {
      const event = await repository.get(userId, eventId)
      if (!event) throw new EventError('event_not_found')
      return event
    },
    async getSchedule(eventId: string) {
      return required(await repository.getSchedule(userId, eventId))
    },
    async getConstraints(eventId: string) {
      return decodeConstraints(
        required(await repository.getConstraints(userId, eventId)),
      )
    },
    async getChat(eventId: string) {
      return required(await repository.getChat(userId, eventId))
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
