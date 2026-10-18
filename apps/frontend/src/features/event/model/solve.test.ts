import { expect, it } from 'vitest'

import type { SolveResponse } from '../../../shared/api/events'
import { applySolverSchedule } from './solve'
import type { EventData } from './types'

const event: EventData = {
  id: 'e',
  name: 'Live',
  updatedAt: 'old',
  members: [],
  performances: [
    { id: 'a', name: 'A', memberIds: [] },
    { id: 'b', name: 'B', memberIds: [] },
  ],
  sections: [{ id: 'p1', slots: ['a', null, null, null, null, null] }],
  constraints: [],
  messages: [],
  unassigned: ['b'],
}
it('applies a stored solution while retaining local frame capacity', () => {
  const response: SolveResponse = {
    result: {
      eventId: 'e',
      status: 'feasible',
      placements: [
        { bandId: 'b', partId: 'p1', order: 0 },
        { bandId: 'a', partId: 'p1', order: 1 },
      ],
      unassignedBandIds: [],
      constraintResults: [],
    },
    schedule: {
      eventId: 'e',
      updatedAt: 'new',
      bands: [],
      members: [],
      memberships: [],
      parts: [{ partId: 'p1', partName: '前半', bandCount: 4, sortOrder: 0 }],
      placements: [
        { bandId: 'a', partId: 'p1', order: 1 },
        { bandId: 'b', partId: 'p1', order: 0 },
      ],
      unassignedBandIds: [],
    },
  }
  expect(() =>
    applySolverSchedule(
      { ...event, sections: [{ id: 'p1', slots: ['a'] }] },
      response,
    ),
  ).toThrow('枠数')
  expect(applySolverSchedule(event, response)).toMatchObject({
    updatedAt: 'new',
    sections: [
      { id: 'p1', name: '前半', slots: ['b', 'a', null, null, null, null] },
    ],
    unassigned: [],
  })
})
it.each(['infeasible', 'unknown'] as const)(
  'retains the current table for %s',
  (status) => {
    expect(
      applySolverSchedule(event, {
        result: {
          eventId: 'e',
          status,
          placements: null,
          unassignedBandIds: null,
          constraintResults: null,
        },
        schedule: null,
      }),
    ).toBe(event)
  },
)
