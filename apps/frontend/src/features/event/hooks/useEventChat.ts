import { type Dispatch, useEffect, useRef, useState } from 'react'

import type { ChatMessage, EventData } from '../../../shared/model/event'
import { dataSource } from '../../../shared/repositories/dataSource'
import type { EventAction } from '../model/eventReducer'
import { eventRepository } from '../repositories/eventRepository'

export function useEventChat(
  eventId: string,
  dispatch: Dispatch<EventAction>,
  event: EventData | null,
  blocked: boolean,
) {
  const [chatDraft, setChatDraft] = useState('')
  const [sending, setSending] = useState(false)
  const pending = useRef<ChatMessage | null>(null)
  const busy = useRef(false)
  const lifetime = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    return () => controller.abort()
  }, [eventId])

  async function sendMessage(retry?: ChatMessage) {
    const text = (retry?.text ?? chatDraft).trim()
    if (!text || text.length > 1000 || busy.current || blocked) return
    const message =
      retry ??
      (pending.current?.text === text
        ? pending.current
        : { id: crypto.randomUUID(), role: 'user' as const, text })
    pending.current = message
    busy.current = true
    setSending(true)
    setChatDraft('')
    dispatch({ type: 'message', message })
    const signal = lifetime.current?.signal
    try {
      const reply = await eventRepository.sendMessage(
        eventId,
        text,
        signal,
        message.id,
      )
      if (signal?.aborted) return
      if (dataSource === 'api') {
        const messages = await eventRepository.getMessages(eventId, signal)
        if (!signal?.aborted) dispatch({ type: 'messages', messages })
      } else
        dispatch({
          type: 'message',
          message: {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: reply,
            replyToMessageId: message.id,
          },
        })
      pending.current = null
    } catch (error) {
      if (!signal?.aborted) {
        setChatDraft((current) => current || text)
        dispatch({
          type: 'notice',
          message:
            error instanceof Error ? error.message : '送信に失敗しました。',
          error: true,
        })
      }
    } finally {
      busy.current = false
      if (!signal?.aborted) setSending(false)
    }
  }
  const unanswered =
    dataSource === 'api'
      ? (event?.messages.filter(
          (message) =>
            message.role === 'user' &&
            !event.messages.some(
              (reply) => reply.replyToMessageId === message.id,
            ),
        ) ?? [])
      : []
  return {
    chatDraft,
    setChatDraft,
    sending,
    chatBlocked: blocked,
    unanswered,
    retryMessage: (message: ChatMessage) => sendMessage(message),
    sendMessage: () => {
      const retry = unanswered.find(
        (message) => message.text === chatDraft.trim(),
      )
      return sendMessage(retry)
    },
    canSend:
      Boolean(chatDraft.trim()) &&
      chatDraft.trim().length <= 1000 &&
      !sending &&
      !blocked,
  }
}
