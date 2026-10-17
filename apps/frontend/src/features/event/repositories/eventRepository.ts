import { mockEventRepository } from '../../../mock/eventRepository'
import { eventsApi } from '../../../shared/api/events'
import { dataSource } from '../../../shared/repositories/dataSource'
import { sendChatMessage } from './chatRepository'
import type { EventRepository } from './types'

export const eventRepository: EventRepository = {
  ...(dataSource === 'api' ? eventsApi : mockEventRepository),
  sendMessage: sendChatMessage,
}
