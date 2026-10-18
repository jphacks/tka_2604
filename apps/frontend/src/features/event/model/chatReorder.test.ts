import { expect, it } from 'vitest'

import type { Constraint } from '../../../generated/constraint'
import {
  applyChatReorder,
  type ChatReorder,
  summarizeChatReorder,
} from './chatReorder'
import type { EventData } from './types'

const base = {
  schema_version: '1.0.0',
  event_id: 'e',
  enabled: true,
  params: {},
} as const
const hardBefore: Constraint = {
  ...base,
  constraint_id: 'c-hard',
  type: 'before',
  hardness: 'hard',
  priority: null,
  targets: { before_band_id: 'a', after_band_id: 'b' },
}
const softFirst: Constraint = {
  ...base,
  constraint_id: 'c-soft',
  type: 'at_position',
  hardness: 'soft',
  priority: 'high',
  targets: { band_id: 'c' },
  params: { position: 0 },
}
const softLast: Constraint = {
  ...softFirst,
  constraint_id: 'c-soft-2',
  priority: 'low',
  targets: { band_id: 'a' },
  params: { position: 2 },
}
const event: EventData = {
  id: 'e',
  name: 'Live',
  updatedAt: '2026-10-17T00:00:00.000Z',
  members: [],
  performances: ['a', 'b', 'c', 'd'].map((id) => ({
    id,
    name: id.toUpperCase(),
    memberIds: [],
  })),
  sections: [
    { id: 'p1', slots: ['a', 'b', null] },
    { id: 'p2', slots: ['c'] },
  ],
  constraints: [hardBefore, softFirst, softLast],
  messages: [],
  unassigned: ['d'],
}
const result = (
  constraintId: string,
  hardness: 'hard' | 'soft',
  before: 'met' | 'unmet',
  after: 'met' | 'unmet',
  explanations: string[] = [],
) => ({
  constraintId,
  hardness,
  priority: event.constraints.find((c) => c.constraint_id === constraintId)!
    .priority,
  before,
  after,
  violations: explanations.map(() => ({ kind: 'order' as const })),
  explanations,
})
const reorder = {
  expectedUpdatedAt: event.updatedAt!,
  reply: '盛り上がる順にしました。',
  source: 'llm',
  placements: [
    { bandId: 'c', partId: 'p1', order: 0 },
    { bandId: 'b', partId: 'p1', order: 1 },
    { bandId: 'a', partId: 'p2', order: 0 },
  ],
  results: [
    result('c-hard', 'hard', 'met', 'unmet', [
      'A（全体の3番目）がB（全体の2番目）より前になっていません。',
    ]),
    result('c-soft', 'soft', 'unmet', 'met'),
    result('c-soft-2', 'soft', 'met', 'unmet', ['Aが全体の3番目…']),
  ],
} as ChatReorder

it('places the proposal into existing sections, keeping capacity and unassigned bands', () => {
  const next = applyChatReorder(event, reorder)
  expect(next.sections).toEqual([
    { id: 'p1', slots: ['c', 'b', null] },
    { id: 'p2', slots: ['a'] },
  ])
  expect(next.unassigned).toEqual(['d'])
  expect(event.sections[0].slots).toEqual(['a', 'b', null])
})

it('rejects a proposal made for an older version or another roster', () => {
  expect(() =>
    applyChatReorder(
      { ...event, updatedAt: '2026-10-18T00:00:00.000Z' },
      reorder,
    ),
  ).toThrow('イベントが更新されました')
  expect(() =>
    applyChatReorder(event, {
      ...reorder,
      placements: [{ bandId: 'x', partId: 'p1', order: 0 }],
    }),
  ).toThrow('一致しません')
})

it('summarizes hard violations and soft changes with readable constraint text', () => {
  expect(summarizeChatReorder(event, reorder)).toEqual({
    hardViolations: [
      {
        constraintId: 'c-hard',
        text: 'AをBより前にする',
        priority: null,
        explanations: [
          'A（全体の3番目）がB（全体の2番目）より前になっていません。',
        ],
      },
    ],
    softNewlyUnmet: [
      {
        constraintId: 'c-soft-2',
        text: 'Aを3番にする',
        priority: 'low',
        explanations: ['Aが全体の3番目…'],
      },
    ],
    softNewlyMet: [
      {
        constraintId: 'c-soft',
        text: 'Cを1番にする',
        priority: 'high',
        explanations: [],
      },
    ],
  })
})
