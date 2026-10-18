import { createDb } from '../db/index'
import { createGeminiChatModel } from '../integrations/llm/gemini'
import { solverClient } from '../integrations/solver'
import { chatRepository } from '../repositories/chat'
import { eventsRepository } from '../repositories/events'
import {
  chatMessageService,
  recordChatDecision,
} from '../services/chat/messages'
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
      // Brings a reorder proposal that breaks a hard constraint back into a
      // hard-feasible order. Without a configured Solver it stays unrepaired.
      bindings.SOLVER_API_URL && bindings.SOLVER_API_TOKEN
        ? solverClient({
            url: bindings.SOLVER_API_URL,
            token: bindings.SOLVER_API_TOKEN,
          })
        : undefined,
    )
    return service.send(eventId, input)
  },
  async (eventId, input, bindings) => {
    const db = createDb(bindings.DB)
    return recordChatDecision(chatRepository(db), 'demo-owner', eventId, input)
  },
)
