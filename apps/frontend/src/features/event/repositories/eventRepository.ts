import { mockEventRepository } from '../../../mock/eventRepository'
import type { EventRepository } from './types'

// Composition point: replace only this adapter to connect a real API.
export const eventRepository: EventRepository = mockEventRepository
