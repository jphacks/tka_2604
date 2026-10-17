import { expect, it } from 'vitest'

import type { Constraint } from '../../../src/generated/constraint'
import { evaluateConstraint } from '../../../src/services/solver/evaluation'
import type {
  Placement,
  SolverRequest,
} from '../../../src/services/solver/types'
import {
  validateSolverInput,
  validateSolverResult,
} from '../../../src/services/solver/validation'

const base = {
  schema_version: '1.0.0',
  constraint_id: 'c',
  event_id: 'e',
  enabled: true,
  hardness: 'hard',
  priority: null,
} as const
const input = (constraint: Constraint): SolverRequest => ({
  eventId: 'e',
  bands: ['a', 'b', 'c', 'd'].map((bandId) => ({ bandId })),
  members: [{ memberId: 'm' }],
  memberships: ['a', 'c', 'd'].map((bandId) => ({ bandId, memberId: 'm' })),
  parts: [
    { partId: 'p0', sortOrder: 0 },
    { partId: 'p1', sortOrder: 1 },
  ],
  constraints: [constraint],
  currentPlacements: [],
})
const placements: Placement[] = [
  { bandId: 'a', partId: 'p0', order: 0 },
  { bandId: 'b', partId: 'p0', order: 1 },
  { bandId: 'c', partId: 'p1', order: 0 },
]
const cases: Constraint[] = [
  {
    ...base,
    type: 'min_gap_member',
    targets: { member_id: 'm' },
    params: { min_diff: 3, same_part_only: false },
  },
  {
    ...base,
    type: 'min_gap_bands',
    targets: { band_ids: ['a', 'c', 'd'] },
    params: { min_diff: 3, same_part_only: false },
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
    targets: { band_id: 'c' },
    params: { position: 3 },
  },
  {
    ...base,
    type: 'in_range',
    targets: { band_ids: ['a', 'c', 'd'] },
    params: { kind: 'positions', position_from: 0, position_to: 1 },
  },
  {
    ...base,
    type: 'in_range',
    targets: { band_ids: ['a', 'c', 'd'] },
    params: { kind: 'parts', part_ids: [0] },
  },
  {
    ...base,
    type: 'count',
    targets: { band_ids: ['a', 'b', 'c', 'd'] },
    params: { scope: 'per_part', min: 0, max: 1 },
  },
  {
    ...base,
    type: 'count',
    targets: { band_ids: ['a', 'b', 'c', 'd'] },
    params: { scope: 'in_parts', part_ids: [0], min: 0, max: 1 },
  },
]
it.each(cases)(
  'rejects decidable partial hard violations for $type / $params',
  (constraint) => {
    const request = input(constraint)
    validateSolverInput(request)
    const evaluated = evaluateConstraint(constraint, request, placements)
    expect(evaluated.violated).toBe(true)
    expect(() =>
      validateSolverResult(request, {
        eventId: 'e',
        status: 'partial',
        placements,
        unassignedBandIds: ['d'],
        constraintResults: [{ constraintId: 'c', status: evaluated.status }],
      }),
    ).toThrow('solver_invalid_response')
  },
)
it('distinguishes unmet soft from unchecked partial targets and rejects false achievements', () => {
  const constraint: Constraint = {
    ...cases[2],
    hardness: 'soft',
    priority: 'high',
  }
  const request = input(constraint)
  const value = {
    eventId: 'e',
    status: 'partial',
    placements,
    unassignedBandIds: ['d'],
    constraintResults: [{ constraintId: 'c', status: 'unmet' }],
  }
  expect(validateSolverResult(request, value)).toEqual(value)
  expect(() =>
    validateSolverResult(request, {
      ...value,
      constraintResults: [{ constraintId: 'c', status: 'met' }],
    }),
  ).toThrow('solver_invalid_response')
  const unchecked: Constraint = {
    ...base,
    type: 'min_gap_member',
    targets: { member_id: 'm' },
    params: { min_diff: 2, same_part_only: false },
  }
  expect(evaluateConstraint(unchecked, input(unchecked), placements)).toEqual({
    status: 'unchecked',
    violated: false,
  })
})
it('counts global positions continuously across empty parts and part boundaries', () => {
  const constraint: Constraint = {
    ...base,
    type: 'min_gap_member',
    targets: { member_id: 'm' },
    params: { min_diff: 3, same_part_only: true },
  }
  expect(evaluateConstraint(constraint, input(constraint), placements)).toEqual(
    { status: 'unchecked', violated: false },
  )
  const request = input(cases[0])
  request.parts.push({ partId: 'p2', sortOrder: 2 })
  const separated = placements.map((row) =>
    row.partId === 'p1' ? { ...row, partId: 'p2' } : row,
  )
  expect(evaluateConstraint(cases[0], request, separated).violated).toBe(true)
})
it('treats count lower bounds as unchecked with missing targets, but tests empty parts on complete results', () => {
  const constraint: Constraint = {
    ...base,
    type: 'count',
    targets: { band_ids: ['a', 'b', 'c', 'd'] },
    params: { scope: 'per_part', min: 1, max: 4 },
  }
  expect(
    evaluateConstraint(constraint, input(constraint), placements.slice(0, 2)),
  ).toEqual({ status: 'unchecked', violated: false })
  const full = ['a', 'b', 'c', 'd'].map((bandId, order) => ({
    bandId,
    partId: 'p0',
    order,
  }))
  expect(evaluateConstraint(constraint, input(constraint), full)).toEqual({
    status: 'unmet',
    violated: true,
  })
})
it('accepts a hard-violating current hint, but rejects duplicates, gaps and foreign references', () => {
  const request = input(cases[3])
  request.currentPlacements = placements
  expect(() => validateSolverInput(request)).not.toThrow()
  for (const invalid of [
    [placements[0], placements[0]],
    [{ ...placements[0], order: 2 }],
    [{ ...placements[0], bandId: 'other' }],
    [{ ...placements[0], partId: 'other' }],
  ])
    expect(() =>
      validateSolverInput({ ...request, currentPlacements: invalid }),
    ).toThrow('invalid_input')
})
it('rejects duplicate IDs, foreign memberships, invalid part indices and invalid constraint branches', () => {
  const request = input(cases[0])
  for (const change of [
    { bands: [request.bands[0], request.bands[0]] },
    { members: [request.members[0], request.members[0]] },
    { memberships: [{ bandId: 'a', memberId: 'other' }] },
    { memberships: [request.memberships[0], request.memberships[0]] },
    { parts: [{ partId: 'p0', sortOrder: 1 }] },
    { parts: [] },
  ])
    expect(() => validateSolverInput({ ...request, ...change })).toThrow(
      'invalid_input',
    )
  const invalid: Constraint[] = [
    {
      ...base,
      type: 'count',
      targets: { band_ids: ['a'] },
      params: { scope: 'per_part', min: 2, max: 1 },
    },
    {
      ...base,
      type: 'count',
      targets: { band_ids: ['a'] },
      params: { scope: 'in_parts', part_ids: [2], min: 0, max: 1 },
    },
    {
      ...base,
      type: 'in_range',
      targets: { band_ids: ['a'] },
      params: { kind: 'positions', position_from: 2, position_to: 1 },
    },
    {
      ...base,
      type: 'in_range',
      targets: { band_ids: ['a'] },
      params: { kind: 'parts', part_ids: [2] },
    },
    {
      ...base,
      type: 'before',
      targets: { before_band_id: 'a', after_band_id: 'a' },
      params: {},
    },
    {
      ...base,
      type: 'min_gap_member',
      targets: { member_id: 'other' },
      params: { min_diff: 2, same_part_only: false },
    },
    { ...cases[0], priority: 'high' },
  ]
  for (const constraint of invalid)
    expect(() => validateSolverInput(input(constraint))).toThrow(
      'invalid_input',
    )
})

it('validates schema and intrinsic parameter ordering even for disabled constraints', () => {
  const constraint: Constraint = {
    ...base,
    enabled: false,
    type: 'count',
    targets: { band_ids: ['a'] },
    params: { scope: 'per_part', min: 2, max: 1 },
  }
  expect(() => validateSolverInput(input(constraint))).toThrow('invalid_input')
  expect(() =>
    validateSolverInput(input({ ...constraint, event_id: 'other' })),
  ).toThrow('invalid_input')
})

const staleReferences: Constraint[] = [
  {
    ...base,
    type: 'min_gap_member',
    targets: { member_id: 'deleted-member' },
    params: { min_diff: 2, same_part_only: false },
  },
  {
    ...base,
    type: 'min_gap_bands',
    targets: { band_ids: ['a', 'deleted-band'] },
    params: { min_diff: 2, same_part_only: true },
  },
  {
    ...base,
    type: 'before',
    targets: { before_band_id: 'deleted-band', after_band_id: 'a' },
    params: {},
  },
  {
    ...base,
    type: 'at_position',
    targets: { band_id: 'deleted-band' },
    params: { position: 99 },
  },
  {
    ...base,
    type: 'at_position',
    targets: { band_id: 'a' },
    params: { position: 99 },
  },
  {
    ...base,
    type: 'in_range',
    targets: { band_ids: ['a'] },
    params: { kind: 'parts', part_ids: [99] },
  },
  {
    ...base,
    type: 'in_range',
    targets: { band_ids: ['a'] },
    params: { kind: 'positions', position_from: 99, position_to: 100 },
  },
  {
    ...base,
    type: 'count',
    targets: { band_ids: ['a', 'deleted-band'] },
    params: { scope: 'per_part', min: 0, max: 1 },
  },
  {
    ...base,
    type: 'count',
    targets: { band_ids: ['a'] },
    params: { scope: 'in_parts', part_ids: [99], min: 0, max: 1 },
  },
]
it.each(staleReferences)(
  'accepts disabled stale references for $type / $params, but rejects re-enabling them',
  (constraint) => {
    const disabled: Constraint = { ...constraint, enabled: false }
    const request = input(disabled)
    expect(() => validateSolverInput(request)).not.toThrow()
    const result = {
      eventId: 'e',
      status: 'feasible',
      placements: ['a', 'b', 'c', 'd'].map((bandId, order) => ({
        bandId,
        partId: 'p0',
        order,
      })),
      unassignedBandIds: [],
      constraintResults: [{ constraintId: 'c', status: 'disabled' }],
    }
    expect(validateSolverResult(request, result)).toEqual(result)
    expect(() =>
      validateSolverResult(request, {
        ...result,
        constraintResults: [{ constraintId: 'c', status: 'met' }],
      }),
    ).toThrow('solver_invalid_response')
    expect(() =>
      validateSolverInput(input({ ...disabled, enabled: true })),
    ).toThrow('invalid_input')
  },
)
