import { expect, it } from 'vitest'

import type { EventData } from '../../../shared/model/event'
import { scheduleContent } from '../../../shared/model/event'
import { movePersistedPerformance } from './persistedSchedule'
import { configureSchedule } from './schedule'

const event: EventData = {
  id: 'live',
  name: 'Live',
  scheduleMode: 'dense',
  members: [],
  messages: [],
  constraints: [],
  performances: ['a', 'b', 'c', 'd', 'e'].map((id) => ({
    id,
    name: id,
    memberIds: [],
  })),
  sections: [
    { id: 'p1', slots: ['a', 'b'] },
    { id: 'p2', slots: ['c', 'd'] },
  ],
  unassigned: ['e'],
}

it('inserts across a full part boundary while keeping both configured counts', () => {
  const moved = movePersistedPerformance(event, 'd', {
    sectionId: 'p1',
    index: 1,
  })
  expect(moved.error).toBeUndefined()
  expect(moved.event.sections.map((part) => part.slots)).toEqual([
    ['a', 'd'],
    ['b', 'c'],
  ])
  expect(moved.event.unassigned).toEqual(['e'])
})

it('inserting an unassigned band never expands a full part', () => {
  const moved = movePersistedPerformance(event, 'e', {
    sectionId: 'p1',
    index: 1,
  })
  expect(moved.event.sections.map((part) => part.slots)).toEqual([
    ['a', 'e'],
    ['b', 'c'],
  ])
  expect(moved.event.unassigned).toEqual(['d'])
})

it('treats a count-only edit as a schedule change', () => {
  const resized = {
    ...event,
    sections: [{ id: 'p1', slots: ['a', 'b', null] }, event.sections[1]],
  }
  expect(scheduleContent(resized)).not.toEqual(scheduleContent(event))
})

it('applies counts together, unassigns truncated bands, and retains part IDs', () => {
  const resized = configureSchedule(event, [1, 1, 3]).event
  expect(resized.sections.map((part) => part.slots)).toEqual([
    ['a'],
    ['c'],
    [null, null, null],
  ])
  expect(resized.sections.slice(0, 2).map((part) => part.id)).toEqual([
    'p1',
    'p2',
  ])
  expect(resized.unassigned).toEqual(['e', 'b', 'd'])
  expect(configureSchedule(event, [2]).event.unassigned).toEqual([
    'e',
    'c',
    'd',
  ])
  expect(event.sections[0].slots).toEqual(['a', 'b'])
})

it('rejects reducing a fixed band or a part referenced by a constraint without partial edits', () => {
  const fixed: EventData = {
    ...event,
    constraints: [
      {
        schema_version: '1.0.0',
        constraint_id: 'fixed',
        event_id: event.id,
        type: 'at_position',
        hardness: 'hard',
        priority: null,
        enabled: true,
        targets: { band_id: 'd' },
        params: { position: 3 },
      },
    ],
  }
  expect(configureSchedule(fixed, [2]).event).toBe(fixed)
  expect(configureSchedule(fixed, [2]).error).toContain('固定')
  const referenced: EventData = {
    ...event,
    constraints: [
      {
        schema_version: '1.0.0',
        constraint_id: 'part',
        event_id: event.id,
        type: 'in_range',
        hardness: 'hard',
        priority: null,
        enabled: true,
        targets: { band_ids: ['a'] },
        params: { kind: 'parts', part_ids: [1] },
      },
    ],
  }
  expect(configureSchedule(referenced, [2]).event).toBe(referenced)
  expect(configureSchedule(referenced, [2]).error).toContain('制約')
})

it('treats moving a vacant position as a schedule change with unchanged counts', () => {
  const before = { ...event, sections: [{ id: 'p1', slots: ['a', null, 'b'] }] }
  const after = { ...event, sections: [{ id: 'p1', slots: ['a', 'b', null] }] }
  expect(scheduleContent(after)).not.toEqual(scheduleContent(before))
})
