import { describe, expect, it } from 'vitest'

import type { EventData } from '../../../shared/model/event'
import {
  movePersistedPerformance,
  setPersistedOrder,
} from './persistedSchedule'

const event: EventData = {
  id: 'e',
  name: 'Live',
  members: [],
  messages: [],
  constraints: [],
  performances: ['a', 'b', 'c'].map((id) => ({ id, name: id, memberIds: [] })),
  sections: [
    { id: 'p1', slots: ['a', 'b'] },
    { id: 'p2', slots: [] },
  ],
  unassigned: ['c'],
}

describe('persisted schedule', () => {
  it('moves into an empty part and back to unassigned without creating holes', () => {
    const moved = movePersistedPerformance(event, 'a', {
      sectionId: 'p2',
      index: 0,
    }).event
    expect(moved.sections.map((p) => p.slots)).toEqual([['b'], ['a']])
    expect(
      movePersistedPerformance(moved, 'a', { unassignedIndex: 1 }).event
        .unassigned,
    ).toEqual(['c', 'a'])
    expect(event.sections[0].slots).toEqual(['a', 'b'])
  })
  it('inserts an unassigned band by its global order, including the end', () => {
    expect(setPersistedOrder(event, 'c', 2).event.sections[0].slots).toEqual([
      'a',
      'c',
      'b',
    ])
    expect(setPersistedOrder(event, 'c', 3).event.sections[1].slots).toEqual([
      'c',
    ])
    expect(setPersistedOrder(event, 'c', 4).error).toBeTruthy()
  })
  it('keeps fixed absolute positions and refuses a move that would shift them', () => {
    const fixed: EventData = {
      ...event,
      constraints: [
        {
          schema_version: '1.0.0',
          constraint_id: 'fixed-b',
          event_id: 'e',
          type: 'at_position',
          hardness: 'hard',
          priority: null,
          enabled: true,
          targets: { band_id: 'b' },
          params: { position: 1 },
        },
      ],
    }
    expect(setPersistedOrder(fixed, 'c', 1).error).toContain('固定')
    expect(setPersistedOrder(fixed, 'b', null).error).toContain('固定')
    expect(setPersistedOrder(fixed, 'c', 3).error).toBeUndefined()
  })
})

it('keeps temporary capacities while moving bands between parts', () => {
  const withFrames: EventData = {
    ...event,
    scheduleMode: 'dense',
    sections: [
      { id: 'p1', slots: ['a', 'b', null, null] },
      { id: 'p2', slots: [null, null, null, null] },
    ],
  }
  const moved = movePersistedPerformance(withFrames, 'b', {
    sectionId: 'p2',
    index: 2,
  }).event
  expect(moved.sections.map((part) => part.slots)).toEqual([
    ['a', null, null, null],
    ['b', null, null, null],
  ])
  expect(setPersistedOrder(moved, 'c', 3).event.sections[1].slots).toEqual([
    'b',
    'c',
    null,
    null,
  ])
})
