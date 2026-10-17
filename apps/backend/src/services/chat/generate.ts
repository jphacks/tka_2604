import { aiChatInputSchema, aiChatOutputSchema } from './contract.ts'
import { AIChatError } from './errors.ts'
import type { AIChatOutput, ChatModel } from './types.ts'
import {
  inheritUpdateSettings,
  validateActions,
  validateContext,
} from './validation.ts'

export const RECENT_MESSAGE_LIMIT = 6

export async function generateAIChatResponse(
  value: unknown,
  model: ChatModel,
): Promise<AIChatOutput> {
  const parsedInput = aiChatInputSchema.safeParse(value)
  if (!parsedInput.success) throw new AIChatError('ai_chat_invalid_input')
  const input = {
    ...parsedInput.data,
    recentMessages:
      parsedInput.data.recentMessages.slice(-RECENT_MESSAGE_LIMIT),
  }
  validateContext(input)
  if (input.pendingProposal)
    validateActions(
      input.pendingProposal.actions,
      input,
      'ai_chat_invalid_input',
    )

  const parsedOutput = aiChatOutputSchema.safeParse(await model(input))
  if (!parsedOutput.success) throw new AIChatError('ai_chat_invalid_output')
  const output = parsedOutput.data
  // Validate the raw output too, so an invalid hard/priority combination is not repaired silently.
  validateActions(output.actions, input, 'ai_chat_invalid_output')
  if (output.type === 'approval_required') {
    const actions = inheritUpdateSettings(output.actions, input)
    validateActions(actions, input, 'ai_chat_invalid_output')
    return aiChatOutputSchema.parse({ ...output, actions })
  }
  return output
}
