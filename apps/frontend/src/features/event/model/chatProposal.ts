import type { ChatResponse } from '../../../../../backend/src/services/chat/types'
import type { Constraint } from '../../../generated/constraint'
import { validateConstraint } from '../../../shared/model/constraints'
import type { EventData } from './types'

export type ChatProposal = NonNullable<ChatResponse['proposal']> & {
  messageId: string
  sourceText: string
}

export function applyChatProposal(
  event: EventData,
  proposal: ChatProposal,
): Constraint[] {
  if (event.updatedAt !== proposal.expectedUpdatedAt)
    throw new Error(
      '提案後にイベントが更新されました。最新の状態でもう一度相談してください。',
    )
  const constraints = [...event.constraints]
  for (const [index, action] of proposal.actions.entries()) {
    const id =
      action.type === 'add_constraint'
        ? `chat-${proposal.messageId}-${index}`
        : action.constraintId
    const at = constraints.findIndex((item) => item.constraint_id === id)
    if (action.type === 'delete_constraint') {
      if (at < 0) throw new Error('削除する制約が見つかりません。')
      constraints.splice(at, 1)
      continue
    }
    if (action.type === 'update_constraint' && at < 0)
      throw new Error('更新する制約が見つかりません。')
    if (action.type === 'add_constraint' && at >= 0)
      throw new Error('この提案は反映済みです。')
    const { hardness, priority } = action.constraint
    if (!hardness) throw new Error('提案の必須／任意を選択してください。')
    if (hardness === 'soft' && !priority)
      throw new Error('任意の制約には優先度を選択してください。')
    const constraint = {
      ...action.constraint,
      hardness,
      priority: hardness === 'hard' ? null : priority,
      schema_version: '1.0.0',
      constraint_id: id,
      event_id: event.id,
      enabled: at >= 0 ? constraints[at].enabled : true,
      source_text: proposal.sourceText,
    } as Constraint
    const error = validateConstraint(constraint, event)
    if (error) throw new Error(error)
    if (at >= 0) constraints[at] = constraint
    else constraints.push(constraint)
  }
  return constraints
}
