import { type Dispatch, useEffect, useRef, useState } from 'react'

import type { ChatMessage, EventData } from '../../../shared/model/event'
import { isDecisionMessage } from '../model/chatMessage'
import type { ChatProposal } from '../model/chatProposal'
import type { ChatReorder } from '../model/chatReorder'
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
  const [chatError, setChatError] = useState('')
  const [recordingDecision, setRecordingDecision] = useState(false)
  const [chatProposal, setChatProposal] = useState<ChatProposal | null>(null)
  const [chatReorder, setChatReorder] = useState<ChatReorder | null>(null)
  const [pendingDecision, setPendingDecision] = useState<{
    decision: 'applied' | 'discarded'
    messageId: string
  } | null>(null)
  const pending = useRef<ChatMessage | null>(null)
  const busy = useRef(false)
  const lifetime = useRef<AbortController | null>(null)
  const recording = useRef(false)
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
    setChatError('')
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
      if (reply.proposal)
        setChatProposal({
          ...reply.proposal,
          messageId: message.id,
          sourceText: text,
        })
      if (reply.reorder)
        setChatReorder({ ...reply.reorder, reply: reply.reply })
      const messages = await eventRepository.getMessages(eventId, signal)
      if (!signal?.aborted) dispatch({ type: 'messages', messages })
      pending.current = null
    } catch (error) {
      if (!signal?.aborted) {
        setChatDraft((current) => current || text)
        setChatError(
          error instanceof Error ? error.message : '送信に失敗しました。',
        )
      }
    } finally {
      busy.current = false
      if (!signal?.aborted) setSending(false)
    }
  }
  async function recordDecision(
    decision: 'applied' | 'discarded',
    retry: typeof pendingDecision = null,
  ) {
    if (recording.current) return false
    const entry =
      retry?.decision === decision
        ? retry
        : { decision, messageId: `decision-${crypto.randomUUID()}` }
    setPendingDecision(entry)
    recording.current = true
    setRecordingDecision(true)
    setChatError('')
    const signal = lifetime.current?.signal
    try {
      await eventRepository.recordDecision(
        eventId,
        entry.decision,
        entry.messageId,
        signal,
      )
      if (signal?.aborted) return
      const messages = await eventRepository.getMessages(eventId, signal)
      if (!signal?.aborted) {
        dispatch({ type: 'messages', messages })
        setPendingDecision(null)
        return true
      }
    } catch (error) {
      if (!signal?.aborted) {
        setChatError(
          error instanceof Error ? error.message : '選択の記録に失敗しました。',
        )
      }
      return false
    } finally {
      recording.current = false
      if (!signal?.aborted) setRecordingDecision(false)
    }
  }
  const unanswered =
    event?.messages.filter(
      (message) =>
        message.role === 'user' &&
        !isDecisionMessage(message) &&
        !event.messages.some((reply) => reply.replyToMessageId === message.id),
    ) ?? []
  return {
    chatDraft,
    chatError,
    dismissChatError: () => setChatError(''),
    recordingDecision,
    setChatDraft,
    chatProposal,
    dismissProposal: () => setChatProposal(null),
    chatReorder,
    pendingDecision,
    recordDecision,
    dismissReorder: () => setChatReorder(null),
    changeProposal: (
      index: number,
      patch: {
        hardness?: 'hard' | 'soft' | null
        priority?: 'high' | 'mid' | 'low' | null
      },
    ) =>
      setChatProposal(
        (current) =>
          current && {
            ...current,
            actions: current.actions.map((action, i) =>
              i === index && action.type !== 'delete_constraint'
                ? { ...action, constraint: { ...action.constraint, ...patch } }
                : action,
            ),
          },
      ),
    sending,
    chatBlocked: blocked,
    unanswered,
    sendMessage: async () => {
      if (blocked || busy.current || recording.current) return
      if (pendingDecision) {
        const recorded = await recordDecision(
          pendingDecision.decision,
          pendingDecision,
        )
        if (!recorded) return
      }
      const retry = unanswered.find(
        (message) => message.text === chatDraft.trim(),
      )
      return sendMessage(retry)
    },
    canSend:
      (Boolean(chatDraft.trim()) || Boolean(pendingDecision)) &&
      chatDraft.trim().length <= 1000 &&
      !sending &&
      !recordingDecision &&
      !blocked,
  }
}
