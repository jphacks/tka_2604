import { mockEventRepository } from '../../../mock/eventRepository'
import { eventsApi } from '../../../shared/api/events'
import {
  dataSource,
  unavailable,
} from '../../../shared/repositories/dataSource'
import type { EventRepository } from './types'

export const eventRepository: EventRepository =
  dataSource === 'api'
    ? {
        getEvent: (eventId, signal) => eventsApi.getEvent(eventId, signal),
        sendMessage: unavailable,
      }
    : mockEventRepository
