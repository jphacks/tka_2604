import { expect, it } from 'vitest'

import type { Constraint } from '../../../generated/constraint'
import type { ConstraintStatus } from '../../../shared/model/constraints'
import { groupConstraintViews } from './constraintGroups'

const gap = (
  id: string,
  memberId: string,
  patch: Partial<Constraint> = {},
): Constraint =>
  ({
    schema_version: '1.0.0',
    constraint_id: id,
    event_id: 'e',
    type: 'min_gap_member',
    hardness: 'hard',
    priority: null,
    enabled: true,
    targets: { member_id: memberId },
    params: { min_diff: 2, same_part_only: false },
    ...patch,
  }) as Constraint
const view = (constraint: Constraint, status: ConstraintStatus = 'met') => ({
  constraint,
  text: constraint.constraint_id,
  status,
  detail: '',
})

it('groups member gaps with the same settings at the first position and keeps others apart', () => {
  const fixed = {
    ...gap('fix', 'm1'),
    type: 'at_position',
    targets: { band_id: 'p1' },
    params: { position: 0 },
  } as Constraint
  const groups = groupConstraintViews([
    view(gap('a', 'm1')),
    view(fixed),
    view(gap('b', 'm2')),
    view(gap('c', 'm3', { params: { min_diff: 3, same_part_only: false } })),
    view(gap('d', 'm4', { hardness: 'soft', priority: 'mid' })),
    view(gap('e', 'm5', { enabled: false })),
    view(gap('f', 'm6')),
  ])
  expect(
    groups.map((group) =>
      group.views.map((item) => item.constraint.constraint_id),
    ),
  ).toEqual([['a', 'b', 'f'], ['fix'], ['c'], ['d'], ['e']])
})
