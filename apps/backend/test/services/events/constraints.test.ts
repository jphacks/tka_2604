import { describe, expect, it } from 'vitest'

import type { Constraint } from '../../../src/generated/constraint'
import { decodeConstraints } from '../../../src/services/events/constraints'

const base = {
  schema_version: '1.0.0' as const,
  constraint_id: 'c',
  event_id: 'e',
  hardness: 'hard' as const,
  priority: null,
  enabled: true,
}
const examples: Constraint[] = [
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
  {
    ...base,
    type: 'in_range',
    targets: { band_ids: ['a'] },
    params: { kind: 'parts', part_ids: [0] },
  },
  {
    ...base,
    type: 'count',
    targets: { band_ids: ['a'] },
    params: { scope: 'per_part', min: 0, max: 1 },
  },
]
function decode(value: unknown) {
  return decodeConstraints({
    eventId: 'e',
    updatedAt: 'now',
    constraints: [
      {
        constraintId: 'c',
        constraintJson: JSON.stringify(value),
        sourceBandId: 'origin',
      },
    ],
  })
}

describe('stored constraints', () => {
  it.each(examples)(
    'decodes a canonical $type constraint without changing its JSON or provenance',
    (value) => {
      expect(decode(value).constraints).toEqual([
        { constraint: value, sourceBandId: 'origin' },
      ])
    },
  )
  it.each([
    null,
    {},
    { ...examples[3], type: 'unsupported' },
    { ...examples[3], event_id: 'other' },
    { ...examples[3], constraint_id: 'other' },
    { ...examples[3], enabled: 'true' },
    { ...examples[3], hardness: 'hard', priority: 'high' },
    { ...examples[3], hardness: 'soft', priority: null },
    { ...examples[3], extra: 'not in schema' },
    { ...examples[3], params: { position: -1 } },
    { ...examples[1], targets: { band_ids: ['a', 'a'] } },
  ])('rejects invalid or mismatched stored data: %j', (value) => {
    expect(() => decode(value)).toThrow('invalid_stored_constraint')
  })
  it('reports invalid JSON instead of returning an empty collection', () => {
    expect(() =>
      decodeConstraints({
        eventId: 'e',
        updatedAt: 'now',
        constraints: [
          { constraintId: 'c', constraintJson: '{', sourceBandId: null },
        ],
      }),
    ).toThrow()
    expect(
      decodeConstraints({ eventId: 'e', updatedAt: 'now', constraints: [] })
        .constraints,
    ).toEqual([])
  })
})
