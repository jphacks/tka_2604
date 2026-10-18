import { hc } from 'hono/client'

import type { ChatAppType } from '../../../../../backend/src/routes/chat'
import type { ChatResponse } from '../../../../../backend/src/services/chat/types'

const client = hc<ChatAppType>('/api/events')

export async function sendChatMessage(
  eventId: string,
  message: string,
  signal?: AbortSignal,
  messageId?: string,
): Promise<ChatResponse> {
  const response = await client[':eventId'].chat.$post(
    { param: { eventId }, json: { message, ...(messageId && { messageId }) } },
    { init: { signal } },
  )
  if (!response.ok) {
    throw new Error('送信に失敗しました。もう一度お試しください。')
  }
  const body: unknown = await response.json()
  if (
    !body ||
    typeof body !== 'object' ||
    !('reply' in body) ||
    typeof body.reply !== 'string' ||
    !body.reply.trim()
  ) {
    throw new Error('チャットの応答を読み取れませんでした。')
  }
  if ('proposal' in body) {
    const proposal = body.proposal
    if (
      !proposal ||
      typeof proposal !== 'object' ||
      !('expectedUpdatedAt' in proposal) ||
      typeof proposal.expectedUpdatedAt !== 'string' ||
      !('actions' in proposal) ||
      !Array.isArray(proposal.actions) ||
      !proposal.actions.length ||
      !proposal.actions.every((action: unknown) => {
        if (!action || typeof action !== 'object' || !('type' in action))
          return false
        if (
          action.type !== 'add_constraint' &&
          (!('constraintId' in action) ||
            typeof action.constraintId !== 'string')
        )
          return false
        if (action.type === 'delete_constraint') return true
        if (
          action.type !== 'add_constraint' &&
          action.type !== 'update_constraint'
        )
          return false
        if (
          !('constraint' in action) ||
          !action.constraint ||
          typeof action.constraint !== 'object'
        )
          return false
        const constraint = action.constraint
        return (
          'type' in constraint &&
          [
            'min_gap_member',
            'min_gap_bands',
            'before',
            'at_position',
            'in_range',
            'count',
          ].includes(String(constraint.type)) &&
          'hardness' in constraint &&
          [null, 'hard', 'soft'].includes(
            constraint.hardness as string | null,
          ) &&
          'priority' in constraint &&
          [null, 'high', 'mid', 'low'].includes(
            constraint.priority as string | null,
          ) &&
          'targets' in constraint &&
          !!constraint.targets &&
          typeof constraint.targets === 'object' &&
          'params' in constraint &&
          !!constraint.params &&
          typeof constraint.params === 'object'
        )
      })
    )
      throw new Error('チャットの変更案を読み取れませんでした。')
  }
  return body as ChatResponse
}
