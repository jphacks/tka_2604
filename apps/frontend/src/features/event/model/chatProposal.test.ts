import { expect, it } from 'vitest'

import { applyChatProposal, type ChatProposal } from './chatProposal'
import type { EventData } from './types'

const event: EventData = {
  id: 'e',
  name: 'Live',
  updatedAt: '2026-10-17T00:00:00.000Z',
  members: [],
  performances: [
    { id: 'a', name: 'A', memberIds: [] },
    { id: 'b', name: 'B', memberIds: [] },
  ],
  sections: [{ id: 'p1', slots: ['a', 'b'] }],
  constraints: [],
  messages: [],
  unassigned: [],
}
const proposal: ChatProposal = {
  expectedUpdatedAt: event.updatedAt!,
  messageId: 'u1',
  sourceText: '必須でAを先頭に',
  actions: [
    {
      type: 'add_constraint',
      constraint: {
        type: 'at_position',
        targets: { band_id: 'a' },
        params: { position: 0 },
        hardness: 'hard',
        priority: null,
      },
    },
  ],
}
it('creates stable IDs and retains source text only after application', () => {
  const next = applyChatProposal(event, proposal)
  expect(event.constraints).toEqual([])
  expect(next[0]).toMatchObject({
    constraint_id: 'chat-u1-0',
    event_id: 'e',
    source_text: proposal.sourceText,
    enabled: true,
  })
  expect(() =>
    applyChatProposal({ ...event, constraints: next }, proposal),
  ).toThrow('反映済み')
})
it('requires explicit hardness and soft priority instead of choosing defaults', () => {
  for (const settings of [
    { hardness: null, priority: null },
    { hardness: 'soft' as const, priority: null },
  ]) {
    const action = proposal.actions[0]
    if (action.type === 'delete_constraint') throw new Error('invalid fixture')
    expect(() =>
      applyChatProposal(event, {
        ...proposal,
        actions: [
          { ...action, constraint: { ...action.constraint, ...settings } },
        ],
      }),
    ).toThrow(/選択/)
  }
})
it('rejects stale proposals and invalid references without partial changes', () => {
  expect(() =>
    applyChatProposal(
      { ...event, updatedAt: '2026-10-17T00:00:00.001Z' },
      proposal,
    ),
  ).toThrow('更新')
  expect(() =>
    applyChatProposal(event, {
      ...proposal,
      actions: [
        ...proposal.actions,
        { type: 'delete_constraint', constraintId: 'missing' },
      ],
    }),
  ).toThrow('見つかりません')
  expect(event.constraints).toEqual([])
})
it('updates and deletes by the existing ID while retaining enabled state', () => {
  const original = { ...applyChatProposal(event, proposal)[0], enabled: false }
  const context = { ...event, constraints: [original] }
  const action = proposal.actions[0]
  if (
    action.type === 'delete_constraint' ||
    action.constraint.type !== 'at_position'
  )
    throw new Error('invalid fixture')
  const next = applyChatProposal(context, {
    ...proposal,
    actions: [
      {
        type: 'update_constraint',
        constraintId: original.constraint_id,
        constraint: { ...action.constraint, params: { position: 1 } },
      },
    ],
  })
  expect(next).toHaveLength(1)
  expect(next[0]).toMatchObject({
    constraint_id: original.constraint_id,
    enabled: false,
    params: { position: 1 },
  })
  expect(
    applyChatProposal(context, {
      ...proposal,
      actions: [
        { type: 'delete_constraint', constraintId: original.constraint_id },
      ],
    }),
  ).toEqual([])
})
