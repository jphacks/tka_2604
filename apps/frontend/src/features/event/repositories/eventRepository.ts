import { mockEventRepository } from '../../../mock/eventRepository'
import { sendChatMessage } from './chatRepository'
import type { EventRepository } from './types'

// Event loading stays on the demo store until the event APIs are connected.
export const eventRepository: EventRepository = {
  ...mockEventRepository,
  sendMessage: sendChatMessage,
}
