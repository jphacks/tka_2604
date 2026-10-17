import { expect, it } from 'vitest'

import { validateConstraint } from '../../../src/shared/constraints/schema'

const base = {
  schema_version: '1.0.0',
  constraint_id: 'c',
  event_id: 'e',
  hardness: 'hard',
  priority: null,
  enabled: true,
} as const
const examples = [
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
    params: { min_diff: 2, same_part_only: false },
  },
  {
    ...base,
    type: 'before',
    targets: { before_band_id: 'a', after_band_id: 'b' },
    params: {},
  },
  {
    ...base,
    type: 'at_position',
    targets: { band_id: 'a' },
    params: { position: 0 },
  },
]

it('validates shared JSON Schema unions, uniqueness and strict objects without generated JavaScript', () => {
  const variants = [
    {
      ...base,
      type: 'in_range',
      targets: { band_ids: ['a'] },
      params: { kind: 'positions', position_from: 0, position_to: 1 },
    },
    {
      ...base,
      type: 'count',
      targets: { band_ids: ['a'] },
      params: { scope: 'in_parts', part_ids: [0], min: 0, max: 1 },
    },
    { ...examples[3], hardness: 'soft', priority: 'high' },
  ]
  for (const value of [...examples, ...variants])
    expect(validateConstraint(value)).toBe(true)
  for (const value of [
    {
      ...variants[0],
      params: {
        kind: 'positions',
        position_from: 0,
        position_to: 1,
        part_ids: [0],
      },
    },
    {
      ...variants[1],
      params: { scope: 'in_parts', part_ids: [0, 0], min: 0, max: 1 },
    },
    {
      ...variants[1],
      params: { scope: 'in_parts', part_ids: [0], min: 0.5, max: 1 },
    },
    { ...examples[3], targets: { band_id: '' } },
    { ...examples[0], params: { min_diff: 2, same_part_only: 'false' } },
  ])
    expect(validateConstraint(value)).toBe(false)
})
