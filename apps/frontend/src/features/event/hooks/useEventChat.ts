import { type Dispatch, useEffect, useRef, useState } from 'react'

import type { EventAction } from '../model/eventReducer'
import { eventRepository } from '../repositories/eventRepository'

export function useEventChat(eventId: string, dispatch: Dispatch<EventAction>) {
  const [chatDraft, setChatDraft] = useState('')
  const [sending, setSending] = useState(false)
  const busy = useRef(false)
  const lifetime = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    return () => controller.abort()
  }, [eventId])

  async function sendMessage() {
    const text = chatDraft.trim()
    if (!text || text.length > 1000 || busy.current) return
    busy.current = true
    setSending(true)
    setChatDraft('')
    dispatch({
      type: 'message',
      message: { id: crypto.randomUUID(), role: 'user', text },
    })
    const signal = lifetime.current?.signal
    try {
      const reply = await eventRepository.sendMessage(eventId, text, signal)
      if (!signal?.aborted)
        dispatch({
          type: 'message',
          message: { id: crypto.randomUUID(), role: 'assistant', text: reply },
        })
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
  return {
    chatDraft,
    setChatDraft,
    sending,
    sendMessage,
    canSend:
      Boolean(chatDraft.trim()) && chatDraft.trim().length <= 1000 && !sending,
  }
}
