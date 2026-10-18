import type { SolverClient } from '../solver/contract.ts'
import { aiChatInputSchema, aiChatOutputSchema } from './contract.ts'
import { AIChatError } from './errors.ts'
import {
  evaluateReorder,
  hasHardViolation,
  repairWithSolver,
  validateReorder,
} from './reorder.ts'
import type {
  AIChatInput,
  AIChatOutput,
  ChatModel,
  ReorderResult,
} from './types.ts'
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
  if (output.type === 'reorder_proposal')
    validateReorder(output.placements, input)
  return output
}

// Hard violations are judged here, never by the model. When the model's order
// breaks one, the Solver returns the nearest hard-feasible order. Without a
// Solver, or if it cannot, the proposal is returned with its violations.
export async function generateAIChatTurn(
  value: unknown,
  model: ChatModel,
  repair?: { eventId: string; solver: SolverClient },
): Promise<{ output: AIChatOutput; reorder?: ReorderResult }> {
  const output = await generateAIChatResponse(value, model)
  if (output.type !== 'reorder_proposal') return { output }
  const input: AIChatInput = aiChatInputSchema.parse(value)
  const proposed = evaluateReorder(output.placements, input, 'llm')
  if (!repair || !hasHardViolation(proposed))
    return { output, reorder: proposed }
  const repaired = await repairWithSolver(
    output.placements,
    input,
    repair.eventId,
    repair.solver,
  )
  const result = repaired && evaluateReorder(repaired, input, 'solver')
  return {
    output,
    reorder: result && !hasHardViolation(result) ? result : proposed,
  }
}
