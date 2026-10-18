import { expect, it, vi } from 'vitest'

import type { Constraint } from '../../../src/generated/constraint'
import {
  type BandRepository,
  bandService,
  validateBandDeletion,
} from '../../../src/services/bands/service'
import type { Snapshot } from '../../../src/services/scheduling/types'
const fixture = (): Snapshot => ({
  event: {
    eventId: 'event',
    createdUserId: 'owner',
    title: 'Live',
    status: 'planning',
    date: null,
    venue: null,
    description: null,
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z',
    isDeleted: false,
  },
  bands: ['a', 'b', 'c'].map((bandId) => ({
    bandId,
    eventId: 'event',
    bandName: bandId,
    requestText: null,
    requestStatus: null,
  })),
  members: [{ eventId: 'event', memberId: 'a', memberName: 'Same string ID' }],
  memberships: [],
  parts: [{ partId: 'p', eventId: 'event', sortOrder: 0, partName: null }],
  placements: [],
  constraints: [],
})
const common = {
  schema_version: '1.0.0',
  constraint_id: 'c',
  event_id: 'event',
  enabled: false,
  hardness: 'hard',
  priority: null,
} as const
const targeted: Constraint[] = [
  {
    ...common,
    type: 'at_position',
    targets: { band_id: 'a' },
    params: { position: 0 },
  },
  {
    ...common,
    type: 'before',
    targets: { before_band_id: 'b', after_band_id: 'a' },
    params: {},
  },
  {
    ...common,
    type: 'min_gap_bands',
    targets: { band_ids: ['b', 'a'] },
    params: { min_diff: 2, same_part_only: false },
  },
  {
    ...common,
    type: 'in_range',
    targets: { band_ids: ['a'] },
    params: { kind: 'parts', part_ids: [0] },
  },
  {
    ...common,
    type: 'count',
    targets: { band_ids: ['a'] },
    params: { scope: 'per_part', min: 0, max: 1 },
  },
]
function store(
  snapshot: Snapshot,
  constraint: Constraint,
  sourceBandId: string | null = null,
) {
  snapshot.constraints = [
    {
      eventId: 'event',
      constraintId: 'c',
      constraintJson: JSON.stringify(constraint),
      sourceBandId,
    },
  ]
}
it.each(targeted)(
  'rejects references in a disabled $type constraint',
  (constraint) => {
    const snapshot = fixture()
    store(snapshot, constraint)
    expect(() => validateBandDeletion(snapshot, 'a')).toThrow(
      'band_constraint_conflict',
    )
  },
)
it('guards sourceBandId without confusing a member ID with the same band ID', () => {
  const snapshot = fixture()
  const constraint: Constraint = {
    ...common,
    type: 'min_gap_member',
    targets: { member_id: 'a' },
    params: { min_diff: 2, same_part_only: false },
  }
  store(snapshot, constraint)
  expect(() => validateBandDeletion(snapshot, 'a')).not.toThrow()
  store(snapshot, constraint, 'a')
  expect(() => validateBandDeletion(snapshot, 'a')).toThrow(
    'band_constraint_conflict',
  )
})
it.each<Constraint>([
  {
    ...common,
    type: 'at_position',
    targets: { band_id: 'b' },
    params: { position: 2 },
  },
  {
    ...common,
    type: 'in_range',
    targets: { band_ids: ['b'] },
    params: { kind: 'positions', position_from: 0, position_to: 2 },
  },
])(
  'refuses deletion that invalidates another $type position range',
  (constraint) => {
    const snapshot = fixture()
    store(snapshot, constraint)
    expect(() => validateBandDeletion(snapshot, 'a')).toThrow(
      'band_constraint_conflict',
    )
  },
)
it('fails closed on corrupt stored constraints', () => {
  const snapshot = fixture()
  store(snapshot, targeted[0])
  snapshot.constraints[0].constraintJson = '{}'
  expect(() => validateBandDeletion(snapshot, 'b')).toThrow(
    'invalid_stored_constraint',
  )
})
it('never starts a delete write for a stale revision or unknown band', async () => {
  const snapshot = fixture()
  const remove = vi.fn<BandRepository['remove']>()
  const repository: BandRepository = {
    load: vi.fn().mockResolvedValue(snapshot),
    remove,
  }
  const service = bandService(repository, 'owner')
  await expect(
    service.remove('event', 'a', '2020-01-01T00:00:00.000Z'),
  ).rejects.toMatchObject({ code: 'event_save_conflict' })
  await expect(
    service.remove('event', 'missing', snapshot.event.updatedAt),
  ).rejects.toMatchObject({ code: 'band_not_found' })
  expect(remove).not.toHaveBeenCalled()
})
