import { eventService } from '../events/service'
import type { EventRepository } from '../events/types'
import { generateAIChatResponse } from './generate.ts'
import { buildAIChatInput } from './input.ts'
import type { ChatGeneration, ChatModel, ChatTurn } from './types.ts'

export function chatService(
  repository: EventRepository,
  userId: string,
  model: ChatModel,
) {
  const events = eventService(repository, userId)
  return {
    async generate(eventId: string, turn: ChatTurn): Promise<ChatGeneration> {
      const [event, schedule, constraints, chat] = await Promise.all([
        events.get(eventId),
        events.getSchedule(eventId),
        events.getConstraints(eventId),
        events.getChat(eventId),
      ])
      const input = buildAIChatInput(
        { event, schedule, constraints, chat },
        turn,
      )
      return {
        eventId: event.eventId,
        updatedAt: event.updatedAt,
        output: await generateAIChatResponse(input, model),
      }
    },
  }
}
