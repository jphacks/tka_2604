import { describe, expect, it } from 'vitest'

import type { Constraint } from '../../generated/constraint'
import {
  describeConstraint,
  evaluateConstraint,
  validateConstraint,
} from './constraints'
import { type EventData, isFixed } from './event'

const event: EventData = {
  id: 'event',
  name: 'ライブ',
  members: [
    { id: 'm1', name: '佐藤' },
    { id: 'm2', name: '佐藤' },
  ],
  performances: [
    { id: 'a', name: 'A', memberIds: ['m1'] },
    { id: 'b', name: 'B', memberIds: ['m2'] },
    { id: 'c', name: 'C', memberIds: ['m1'] },
  ],
  sections: [
    { id: 'part-0', slots: ['a', 'b'] },
    { id: 'part-1', slots: ['c', null] },
  ],
  unassigned: [],
  constraints: [],
  messages: [],
}
const base = {
  schema_version: '1.0.0',
  constraint_id: 'c1',
  event_id: 'event',
  hardness: 'hard',
  priority: null,
  enabled: true,
} as const

describe('schema constraints on the current schedule', () => {
  const cases: Constraint[] = [
    {
      ...base,
      type: 'min_gap_member',
      targets: { member_id: 'm1' },
      params: { min_diff: 2, same_part_only: false },
    },
    {
      ...base,
      type: 'min_gap_bands',
      targets: { band_ids: ['a', 'c'] },
      params: { min_diff: 2, same_part_only: false },
    },
    {
      ...base,
      type: 'before',
      targets: { before_band_id: 'a', after_band_id: 'c' },
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
      targets: { band_ids: ['c'] },
      params: { kind: 'positions', position_from: 2, position_to: 2 },
    },
    {
      ...base,
      type: 'in_range',
      targets: { band_ids: ['c'] },
      params: { kind: 'parts', part_ids: [1] },
    },
    {
      ...base,
      type: 'count',
      targets: { band_ids: ['a', 'c'] },
      params: { scope: 'per_part', min: 1, max: 1 },
    },
    {
      ...base,
      type: 'count',
      targets: { band_ids: ['a', 'b'] },
      params: { scope: 'in_parts', part_ids: [0], min: 2, max: 2 },
    },
  ]
  it.each(cases)('validates and evaluates $type', (constraint) => {
    expect(validateConstraint(constraint, event)).toBe('')
    expect(evaluateConstraint(constraint, event).status).toBe('met')
    expect(describeConstraint(constraint, event)).not.toBe('')
  })
  it('uses IDs instead of names and evaluates across part boundaries', () => {
    const constraint: Constraint = {
      ...base,
      type: 'min_gap_member',
      targets: { member_id: 'm1' },
      params: { min_diff: 3, same_part_only: false },
    }
    expect(evaluateConstraint(constraint, event).status).toBe('unmet')
    expect(
      evaluateConstraint(
        {
          ...constraint,
          params: { ...constraint.params, same_part_only: true },
        },
        event,
      ).status,
    ).toBe('met')
  })
  it('distinguishes unassigned, invalid, disabled, and unmet', () => {
    const constraint: Constraint = {
      ...base,
      type: 'at_position',
      targets: { band_id: 'a' },
      params: { position: 1 },
    }
    expect(evaluateConstraint(constraint, event).status).toBe('unmet')
    expect(
      evaluateConstraint(constraint, {
        ...event,
        sections: [{ id: 'part-0', slots: [null, 'b', 'c'] }],
        unassigned: ['a'],
      }).status,
    ).toBe('unchecked')
    expect(
      evaluateConstraint(
        { ...constraint, targets: { band_id: 'missing' } },
        event,
      ).status,
    ).toBe('invalid')
    expect(
      evaluateConstraint({ ...constraint, enabled: false }, event).status,
    ).toBe('disabled')
  })
  it('rejects wrong event, priority, range, duplicate IDs, and unknown parts', () => {
    expect(
      validateConstraint({ ...cases[0], event_id: 'other' }, event),
    ).not.toBe('')
    expect(
      validateConstraint({ ...cases[0], priority: 'high' }, event),
    ).not.toBe('')
    expect(
      validateConstraint(
        {
          ...base,
          type: 'at_position',
          targets: { band_id: 'a' },
          params: { position: 4 },
        },
        event,
      ),
    ).not.toBe('')
    expect(
      validateConstraint(
        {
          ...base,
          type: 'in_range',
          targets: { band_ids: ['a'] },
          params: { kind: 'positions', position_from: 2, position_to: 1 },
        },
        event,
      ),
    ).not.toBe('')
    expect(
      validateConstraint(
        {
          ...base,
          type: 'min_gap_bands',
          targets: { band_ids: ['a', 'a'] },
          params: { min_diff: 2, same_part_only: false },
        },
        event,
      ),
    ).not.toBe('')
    expect(
      validateConstraint(
        {
          ...base,
          type: 'count',
          targets: { band_ids: ['a'] },
          params: { scope: 'in_parts', part_ids: [2], min: 0, max: 1 },
        },
        event,
      ),
    ).not.toBe('')
  })
  it('derives fixed state only from an enabled hard position constraint at its target', () => {
    const constraint: Constraint = {
      ...base,
      type: 'at_position',
      targets: { band_id: 'a' },
      params: { position: 0 },
    }
    expect(isFixed({ ...event, constraints: [constraint] }, 'a')).toBe(true)
    expect(
      isFixed(
        { ...event, constraints: [{ ...constraint, enabled: false }] },
        'a',
      ),
    ).toBe(false)
    expect(
      isFixed(
        {
          ...event,
          constraints: [{ ...constraint, hardness: 'soft', priority: 'mid' }],
        },
        'a',
      ),
    ).toBe(false)
  })
})

it('uses the registered band count for positions in a persisted dense schedule', () => {
  const event: EventData = {
    id: 'dense',
    name: 'Live',
    scheduleMode: 'dense',
    performances: [{ id: 'b', name: 'B', memberIds: [] }],
    members: [],
    sections: [{ id: 'p', slots: [] }],
    unassigned: ['b'],
    messages: [],
    constraints: [],
  }
  const constraint: Constraint = {
    schema_version: '1.0.0',
    constraint_id: 'c',
    event_id: 'dense',
    type: 'at_position',
    hardness: 'hard',
    priority: null,
    enabled: true,
    targets: { band_id: 'b' },
    params: { position: 0 },
  }
  expect(validateConstraint(constraint, event)).toBe('')
  expect(evaluateConstraint(constraint, event).status).toBe('unchecked')
})

it('does not count temporary empty frames in persisted constraint positions', () => {
  const persisted: EventData = {
    ...event,
    scheduleMode: 'dense',
    sections: [
      { id: 'first', slots: ['a', null, null, null] },
      { id: 'second', slots: ['b', null, null, null] },
    ],
  }
  const fixed: Constraint = {
    schema_version: '1.0.0',
    constraint_id: 'fixed-b',
    event_id: event.id,
    type: 'at_position',
    hardness: 'hard',
    priority: null,
    enabled: true,
    targets: { band_id: 'b' },
    params: { position: 1 },
  }
  expect(evaluateConstraint(fixed, persisted).status).toBe('met')
})
