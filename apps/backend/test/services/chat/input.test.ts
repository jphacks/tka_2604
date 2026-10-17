import { describe, expect, it } from 'vitest'

import { buildAIChatInput } from '../../../src/services/chat/input.ts'
import { currentConstraint, input, snapshot } from './fixtures.ts'

const turn = { userMessage: 'Aを第2部にしたい', pendingProposal: null }

describe('AI chat input from event API DTOs', () => {
  it('rejects a missing saved current message instead of including the whole history', () => {
    expect(() =>
      buildAIChatInput(snapshot(), { ...turn, currentMessageId: 'missing' }),
    ).toThrow('ai_chat_invalid_input')
  })
  it('maps the event API DTOs and keeps DB-only and provenance fields out of model input', () => {
    const state = snapshot()
    state.schedule.bands[0].requestText = 'private form request'
    const result = buildAIChatInput(state, turn)
    expect(result).toEqual({
      ...input(),
      context: { ...input().context, constraints: [currentConstraint()] },
    })
    expect(JSON.stringify(result)).not.toContain('private form request')
    expect(JSON.stringify(result)).not.toContain('sourceBandId')
    expect(result.context.constraints[0].enabled).toBe(false)
  })

  it('ignores caller-supplied context and histories in favor of repository data', () => {
    const supplied = {
      ...turn,
      context: { event: { title: 'untrusted' } },
      recentMessages: [{ role: 'user', text: 'untrusted' }],
    }
    const result = buildAIChatInput(snapshot(), supplied)
    expect(result.context.event.title).toBe('秋ライブ')
    expect(result.recentMessages).toEqual([])
  })

  it.each(['schedule', 'constraints'] as const)(
    'rejects a different %s version',
    (key) => {
      const state = snapshot()
      state[key].updatedAt = '2026-10-17T00:00:01.000Z'
      expect(() => buildAIChatInput(state, turn)).toThrow('event_save_conflict')
    },
  )

  it.each(['schedule', 'constraints', 'chat'] as const)(
    'rejects %s DTOs from another event',
    (key) => {
      const state = snapshot()
      state[key].eventId = 'other-event'
      expect(() => buildAIChatInput(state, turn)).toThrow(
        'invalid_event_snapshot',
      )
    },
  )

  it('rejects a constraint with a mismatched event ID', () => {
    const state = snapshot()
    state.constraints.constraints[0].constraint.event_id = 'other-event'
    expect(() => buildAIChatInput(state, turn)).toThrow(
      'invalid_stored_constraint',
    )
  })

  it('sorts stored history by seq and excludes the current message and subsequent replies', () => {
    const state = snapshot()
    const createdAt = state.event.createdAt
    state.chat.messages = [
      {
        messageId: 'u2',
        seq: 3,
        role: 'user',
        text: turn.userMessage,
        replyToMessageId: null,
        createdAt,
      },
      {
        messageId: 'a1',
        seq: 2,
        role: 'assistant',
        text: '第2部までです。',
        replyToMessageId: 'u1',
        createdAt,
      },
      {
        messageId: 'u1',
        seq: 1,
        role: 'user',
        text: '第何部まで？',
        replyToMessageId: null,
        createdAt,
      },
      {
        messageId: 'a2',
        seq: 4,
        role: 'assistant',
        text: 'later answer',
        replyToMessageId: 'u2',
        createdAt,
      },
    ]
    const result = buildAIChatInput(state, { ...turn, currentMessageId: 'u2' })
    expect(result.recentMessages).toEqual([
      { role: 'user', text: '第何部まで？' },
      { role: 'assistant', text: '第2部までです。' },
    ])
    expect(state.chat.messages[0].messageId).toBe('u2')
    expect(() =>
      buildAIChatInput(state, { ...turn, currentMessageId: 'a1' }),
    ).toThrow('ai_chat_invalid_input')
  })
})
