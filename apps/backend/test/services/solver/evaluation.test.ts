import { describe, expect, it } from 'vitest'

import type { Constraint } from '../../../src/generated/constraint'
import type { SolverRequest } from '../../../src/services/solver/contract'
import {
  evaluate,
  type Violation,
} from '../../../src/services/solver/evaluation'

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
    { partId: 'p', sortOrder: 0 },
    { partId: 'q', sortOrder: 1 },
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
const tooClose: Violation = {
  kind: 'too_close',
  bandIds: ['a', 'b'],
  positions: [0, 1],
  minDiff: 2,
}
const outOfPosition: Violation = {
  kind: 'out_of_position',
  bandId: 'a',
  position: 0,
  part: 0,
}
const overCount: Violation = {
  kind: 'count',
  parts: [0],
  count: 2,
  min: 0,
  max: 1,
}
const expectedViolations: Violation[][] = [
  [tooClose],
  [tooClose],
  [{ kind: 'order', beforeBandId: 'b', afterBandId: 'a', positions: [1, 0] }],
  [outOfPosition],
  [outOfPosition],
  [outOfPosition],
  [overCount],
  [overCount],
]
describe('independent evaluation of Solver results', () => {
  it.each(cases.map((c, i) => [c.type, c, expectedViolations[i]] as const))(
    'detects %s hard violations with their locations',
    (_, c, violations) =>
      expect(evaluate(c, input, placements)).toEqual({
        status: 'unmet',
        violated: true,
        violations,
      }),
  )
  it('marks disabled and incomplete constraints without ignoring decidable violations', () => {
    expect(
      evaluate({ ...cases[0], enabled: false }, input, placements),
    ).toEqual({ status: 'disabled', violated: false, violations: [] })
    expect(evaluate(cases[0], input, placements.slice(0, 1))).toEqual({
      status: 'unchecked',
      violated: false,
      violations: [],
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
      violations: [overCount],
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
      violations: [],
    })
    expect(
      evaluate(
        { ...c, params: { ...c.params, same_part_only: false } },
        input,
        placements,
      ),
    ).toEqual({
      status: 'unmet',
      violated: true,
      violations: [
        {
          kind: 'too_close',
          bandIds: ['b', 'c'],
          positions: [1, 2],
          minDiff: 2,
        },
      ],
    })
  })
  it('reports every offending pair and part', () => {
    const spread = [
      { bandId: 'a', partId: 'p', order: 0 },
      { bandId: 'b', partId: 'p', order: 1 },
      { bandId: 'c', partId: 'p', order: 2 },
    ]
    const gap: Constraint = {
      ...base,
      type: 'min_gap_bands',
      targets: { band_ids: ['c', 'a', 'b'] },
      params: { min_diff: 3, same_part_only: false },
    }
    expect(evaluate(gap, input, spread).violations).toEqual([
      { kind: 'too_close', bandIds: ['a', 'c'], positions: [0, 2], minDiff: 3 },
      { kind: 'too_close', bandIds: ['b', 'c'], positions: [1, 2], minDiff: 3 },
      { kind: 'too_close', bandIds: ['a', 'b'], positions: [0, 1], minDiff: 3 },
    ])
    const count: Constraint = {
      ...base,
      type: 'count',
      targets: { band_ids: ['a', 'b', 'c'] },
      params: { scope: 'per_part', min: 1, max: 2 },
    }
    expect(evaluate(count, input, spread).violations).toEqual([
      { kind: 'count', parts: [0], count: 3, min: 1, max: 2 },
      { kind: 'count', parts: [1], count: 0, min: 1, max: 2 },
    ])
  })
})
