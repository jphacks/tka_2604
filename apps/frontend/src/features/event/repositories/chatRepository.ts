import { hc } from 'hono/client'

import type { ChatAppType } from '../../../../../backend/src/routes/chat'

const client = hc<ChatAppType>('/api/events')

export async function sendChatMessage(
  eventId: string,
  message: string,
  signal?: AbortSignal,
  messageId?: string,
): Promise<string> {
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
  return body.reply
}
