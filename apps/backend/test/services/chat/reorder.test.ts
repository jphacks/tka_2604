import { describe, expect, it, vi } from 'vitest'

import { AIChatError } from '../../../src/services/chat/errors.ts'
import { generateAIChatTurn } from '../../../src/services/chat/generate.ts'
import type {
  AIChatInput,
  ChatModel,
  Constraint,
  Placement,
} from '../../../src/services/chat/types.ts'
import type { SolverClient } from '../../../src/services/solver/contract.ts'
import { SolverError } from '../../../src/services/solver/errors.ts'
import { input as baseInput } from './fixtures.ts'

const base = {
  schema_version: '1.0.0',
  event_id: 'event-1',
  enabled: true,
} as const
const hardBefore: Constraint = {
  ...base,
  constraint_id: 'c-before',
  type: 'before',
  hardness: 'hard',
  priority: null,
  targets: { before_band_id: 'band-a', after_band_id: 'band-b' },
  params: {},
}
const softGap: Constraint = {
  ...base,
  constraint_id: 'c-gap',
  type: 'min_gap_bands',
  hardness: 'soft',
  priority: 'high',
  targets: { band_ids: ['band-a', 'band-b'] },
  params: { min_diff: 2, same_part_only: false },
}
// Targets an unplaced band, so it cannot be sent to the Solver for repair.
const unplacedAt: Constraint = {
  ...base,
  constraint_id: 'c-unplaced',
  type: 'at_position',
  hardness: 'hard',
  priority: null,
  targets: { band_id: 'band-d' },
  params: { position: 3 },
}

function input(): AIChatInput {
  const state = baseInput()
  state.context.bands.push(
    { bandId: 'band-c', bandName: 'C', description: 'しっとりバラード' },
    { bandId: 'band-d', bandName: 'D', description: null },
  )
  state.context.constraints = [hardBefore, softGap, unplacedAt]
  state.context.currentPlacements = [
    { bandId: 'band-a', partId: 'part-1', order: 0 },
    { bandId: 'band-b', partId: 'part-1', order: 1 },
    { bandId: 'band-c', partId: 'part-2', order: 0 },
  ]
  state.userMessage = '後半に向けて盛り上がるようにして'
  return state
}

const reorder = (placements: Placement[]) => ({
  type: 'reorder_proposal' as const,
  message: '盛り上がる順に並べ替えました。',
  actions: [],
  placements,
})
// Breaks the hard before constraint.
const violating = reorder([
  { bandId: 'band-b', partId: 'part-1', order: 0 },
  { bandId: 'band-c', partId: 'part-1', order: 1 },
  { bandId: 'band-a', partId: 'part-2', order: 0 },
])
// Keeps the hard constraint and newly meets the soft gap.
const fixed = reorder([
  { bandId: 'band-a', partId: 'part-1', order: 0 },
  { bandId: 'band-c', partId: 'part-1', order: 1 },
  { bandId: 'band-b', partId: 'part-2', order: 0 },
])
const solved = (placements: Placement[]) => ({
  eventId: 'event-1',
  status: 'optimal',
  placements,
  unassignedBandIds: [],
  constraintResults: [],
})
const infeasible = {
  eventId: 'event-1',
  status: 'infeasible',
  placements: null,
  unassignedBandIds: null,
  constraintResults: null,
}
const repair = (solver: SolverClient) => ({ eventId: 'event-1', solver })
const beforeViolation = {
  kind: 'order',
  beforeBandId: 'band-a',
  afterBandId: 'band-b',
  positions: [2, 0],
}

describe('reorder proposals judged by BE', () => {
  it('returns non-reorder replies without a judgement', async () => {
    const answer = { type: 'answer', message: '了解です。', actions: [] }
    expect(
      await generateAIChatTurn(input(), vi.fn().mockResolvedValue(answer)),
    ).toEqual({ output: answer })
  })

  it('evaluates every constraint before and after and skips the Solver for a hard-feasible proposal', async () => {
    const solver = vi.fn<SolverClient>()
    const result = await generateAIChatTurn(
      input(),
      vi.fn<ChatModel>().mockResolvedValue(fixed),
      repair(solver),
    )
    expect(solver).not.toHaveBeenCalled()
    const unchanged = { violations: [], explanations: [] }
    expect(result).toEqual({
      output: fixed,
      reorder: {
        placements: fixed.placements,
        source: 'llm',
        results: [
          {
            constraintId: 'c-before',
            hardness: 'hard',
            priority: null,
            before: 'met',
            after: 'met',
            ...unchanged,
          },
          {
            constraintId: 'c-gap',
            hardness: 'soft',
            priority: 'high',
            before: 'unmet',
            after: 'met',
            ...unchanged,
          },
          {
            constraintId: 'c-unplaced',
            hardness: 'hard',
            priority: null,
            before: 'unchecked',
            after: 'unchecked',
            ...unchanged,
          },
        ],
      },
    })
  })

  it('returns hard violations with explanations when no Solver is available', async () => {
    const result = await generateAIChatTurn(
      input(),
      vi.fn<ChatModel>().mockResolvedValue(violating),
    )
    expect(result.reorder?.source).toBe('llm')
    expect(result.reorder?.results[0]).toEqual({
      constraintId: 'c-before',
      hardness: 'hard',
      priority: null,
      before: 'met',
      after: 'unmet',
      violations: [beforeViolation],
      explanations: [
        'A（全体の3番目）がB（全体の1番目）より前になっていません。',
      ],
    })
  })

  it("asks the Solver for the nearest hard-feasible order, keeping each band near the model's position", async () => {
    const solver = vi
      .fn<SolverClient>()
      .mockResolvedValue(solved(fixed.placements))
    const model = vi.fn<ChatModel>().mockResolvedValue(violating)
    const result = await generateAIChatTurn(input(), model, repair(solver))
    expect(model).toHaveBeenCalledTimes(1)
    const request = solver.mock.calls[0][0]
    expect(request.bands).toEqual([
      { bandId: 'band-b' },
      { bandId: 'band-c' },
      { bandId: 'band-a' },
    ])
    expect(request.memberships).toEqual([
      { bandId: 'band-a', memberId: 'member-1' },
      { bandId: 'band-b', memberId: 'member-1' },
    ])
    expect(request.currentPlacements).toEqual(violating.placements)
    expect(request.constraints.map((c) => c.constraint_id)).toEqual([
      'c-before',
      'c-gap',
      'reorder-flow-0',
      'reorder-flow-1',
      'reorder-flow-2',
    ])
    const window = (bandId: string, from: number, to: number) => ({
      type: 'in_range',
      hardness: 'soft',
      priority: 'low',
      targets: { band_ids: [bandId] },
      params: { kind: 'positions', position_from: from, position_to: to },
    })
    expect(request.constraints.slice(2)).toMatchObject([
      window('band-b', 0, 1),
      window('band-c', 0, 2),
      window('band-a', 1, 2),
    ])
    expect(result.output).toEqual(violating)
    expect(result.reorder).toMatchObject({
      placements: fixed.placements,
      source: 'solver',
    })
    expect(result.reorder?.results[0]).toMatchObject({
      after: 'met',
      violations: [],
    })
  })

  it.each([
    ['is infeasible', () => Promise.resolve(infeasible)],
    ['fails', () => Promise.reject(new SolverError('solver_timeout'))],
    ['returns a malformed result', () => Promise.resolve({ status: 'ok' })],
    [
      'returns another event',
      () => Promise.resolve({ ...solved(fixed.placements), eventId: 'other' }),
    ],
    ['drops a band', () => Promise.resolve(solved(fixed.placements.slice(1)))],
    [
      'still breaks a hard constraint',
      () => Promise.resolve(solved(violating.placements)),
    ],
  ])(
    'keeps the model proposal with its violations when the Solver %s',
    async (_, response) => {
      const result = await generateAIChatTurn(
        input(),
        vi.fn<ChatModel>().mockResolvedValue(violating),
        repair(vi.fn<SolverClient>().mockImplementation(response)),
      )
      expect(result.reorder).toMatchObject({
        placements: violating.placements,
        source: 'llm',
      })
      expect(result.reorder?.results[0].violations).toEqual([beforeViolation])
    },
  )

  it('does not hide unexpected Solver errors', async () => {
    await expect(
      generateAIChatTurn(
        input(),
        vi.fn<ChatModel>().mockResolvedValue(violating),
        repair(vi.fn<SolverClient>().mockRejectedValue(new Error('bug'))),
      ),
    ).rejects.toThrow('bug')
  })

  it('does not hide provider failures', async () => {
    const model = vi
      .fn<ChatModel>()
      .mockRejectedValue(new AIChatError('ai_chat_timeout'))
    await expect(generateAIChatTurn(input(), model)).rejects.toMatchObject({
      code: 'ai_chat_timeout',
    })
  })

  it.each([
    ['a missing band', violating.placements.slice(1)],
    [
      'a duplicated band',
      [...fixed.placements, { bandId: 'band-a', partId: 'part-2', order: 1 }],
    ],
    [
      'an unassigned band',
      [...fixed.placements, { bandId: 'band-d', partId: 'part-2', order: 1 }],
    ],
    [
      'an unknown part',
      fixed.placements.map((p, i) => (i ? p : { ...p, partId: 'part-x' })),
    ],
    [
      'a gap in part orders',
      fixed.placements.map((p) =>
        p.bandId === 'band-b' ? { ...p, order: 1 } : p,
      ),
    ],
    [
      'two bands at one order',
      fixed.placements.map((p) =>
        p.bandId === 'band-c' ? { ...p, order: 0 } : p,
      ),
    ],
  ])('rejects a reorder with %s', async (_, placements) => {
    await expect(
      generateAIChatTurn(
        input(),
        vi.fn().mockResolvedValue(reorder(placements)),
      ),
    ).rejects.toMatchObject({ code: 'ai_chat_invalid_output' })
  })

  it('explains violations with band and part names and 1-based positions', async () => {
    const state = input()
    state.context.constraints = [
      { ...softGap, params: { min_diff: 3, same_part_only: false } },
      {
        ...base,
        constraint_id: 'c-range',
        type: 'in_range',
        hardness: 'soft',
        priority: 'low',
        targets: { band_ids: ['band-c'] },
        params: { kind: 'parts', part_ids: [1] },
      },
      {
        ...base,
        constraint_id: 'c-count',
        type: 'count',
        hardness: 'soft',
        priority: 'low',
        targets: { band_ids: ['band-a', 'band-b', 'band-c'] },
        params: { scope: 'in_parts', part_ids: [0], min: 0, max: 1 },
      },
    ]
    const result = await generateAIChatTurn(
      state,
      vi.fn<ChatModel>().mockResolvedValue(fixed),
    )
    expect(result.reorder?.results.map((r) => r.explanations)).toEqual([
      ['A（全体の1番目）とB（全体の3番目）の位置の差が2です（3以上が必要）。'],
      ['Cが全体の2番目（第1部）にあり、指定された位置・部の外です。'],
      ['第1部が2組です（0〜1組が必要）。'],
    ])
  })
})
