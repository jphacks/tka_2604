import { createDb } from '../db/index'
import { createGeminiChatModel } from '../integrations/llm/gemini'
import { chatRepository } from '../repositories/chat'
import { eventsRepository } from '../repositories/events'
import { chatMessageService } from '../services/chat/messages'
import { createChatRoutes } from './chat'

export const chatRoutes = createChatRoutes<CloudflareBindings>(
  async (eventId, input, bindings) => {
    const db = createDb(bindings.DB)
    // #57 replaces the server-side placeholder with the authenticated user ID.
    // Create the model only when invoked: save the user first, and allow a
    // cached reply even if the provider is unavailable or its key is missing.
    const service = chatMessageService(
      eventsRepository(db),
      chatRepository(db),
      'demo-owner',
      (modelInput) =>
        createGeminiChatModel({ apiKey: bindings.GOOGLE_AI_API_TOKEN ?? '' })(
          modelInput,
        ),
    )
    return service.send(eventId, input)
  },
)
