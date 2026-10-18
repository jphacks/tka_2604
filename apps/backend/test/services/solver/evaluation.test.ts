import { describe, expect, it } from 'vitest'

import type { Constraint } from '../../../src/generated/constraint'
import type { SolverRequest } from '../../../src/services/solver/contract'
import { evaluate } from '../../../src/services/solver/evaluation'

const base = {
  schema_version: '1.0.0',
  constraint_id: 'c',
  event_id: 'e',
  hardness: 'hard',
  priority: null,
  enabled: true,
} as const
const input: SolverRequest = {
  eventId: 'e',
  bands: ['a', 'b', 'c'].map((bandId) => ({ bandId })),
  members: [{ memberId: 'm' }],
  memberships: [
    { bandId: 'a', memberId: 'm' },
    { bandId: 'b', memberId: 'm' },
  ],
  parts: [
    { partId: 'p', bandCount: 4, sortOrder: 0 },
    { partId: 'q', bandCount: 4, sortOrder: 1 },
  ],
  constraints: [],
  currentPlacements: [],
}
const placements = [
  { bandId: 'a', partId: 'p', order: 0 },
  { bandId: 'b', partId: 'p', order: 1 },
  { bandId: 'c', partId: 'q', order: 0 },
]
const cases: Constraint[] = [
  {
    ...base,
    type: 'min_gap_member',
    targets: { member_id: 'm' },
    params: { min_diff: 2, same_part_only: false },
  },
  {
    ...base,
    type: 'min_gap_bands',
    targets: { band_ids: ['a', 'b'] },
    params: { min_diff: 2, same_part_only: true },
  },
  {
    ...base,
    type: 'before',
    targets: { before_band_id: 'b', after_band_id: 'a' },
    params: {},
  },
  {
    ...base,
    type: 'at_position',
    targets: { band_id: 'a' },
    params: { position: 1 },
  },
  {
    ...base,
    type: 'in_range',
    targets: { band_ids: ['a'] },
    params: { kind: 'positions', position_from: 1, position_to: 2 },
  },
  {
    ...base,
    type: 'in_range',
    targets: { band_ids: ['a'] },
    params: { kind: 'parts', part_ids: [1] },
  },
  {
    ...base,
    type: 'count',
    targets: { band_ids: ['a', 'b'] },
    params: { scope: 'per_part', min: 0, max: 1 },
  },
  {
    ...base,
    type: 'count',
    targets: { band_ids: ['a', 'b'] },
    params: { scope: 'in_parts', part_ids: [0], min: 0, max: 1 },
  },
]
describe('independent evaluation of Solver results', () => {
  it.each(cases)('detects $type hard violations', (c) =>
    expect(evaluate(c, input, placements)).toEqual({
      status: 'unmet',
      violated: true,
    }),
  )
  it('marks disabled and incomplete constraints without ignoring decidable violations', () => {
    expect(
      evaluate({ ...cases[0], enabled: false }, input, placements),
    ).toEqual({ status: 'disabled', violated: false })
    expect(evaluate(cases[0], input, placements.slice(0, 1))).toEqual({
      status: 'unchecked',
      violated: false,
    })
    const c: Constraint = {
      ...base,
      type: 'count',
      targets: { band_ids: ['a', 'b', 'c'] },
      params: { scope: 'per_part', min: 0, max: 1 },
    }
    expect(evaluate(c, input, placements.slice(0, 2))).toEqual({
      status: 'unchecked',
      violated: true,
    })
  })
  it('counts global position differences across a part boundary', () => {
    const c: Constraint = {
      ...base,
      type: 'min_gap_bands',
      targets: { band_ids: ['b', 'c'] },
      params: { min_diff: 2, same_part_only: true },
    }
    expect(evaluate(c, input, placements)).toEqual({
      status: 'met',
      violated: false,
    })
    expect(
      evaluate(
        { ...c, params: { ...c.params, same_part_only: false } },
        input,
        placements,
      ),
    ).toEqual({ status: 'unmet', violated: true })
  })
})
