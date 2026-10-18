import { assert, test } from 'vitest'

import { eventFixture } from '../../../test/fixtures/event'
import { eventReducer, initialState, removeBandFromEvent } from './eventReducer'
import {
  buildSchedule,
  movePerformance,
  resizeSchedule,
  setPerformanceOrder,
} from './schedule'

const fresh = () => structuredClone(eventFixture)
function assertRoster(event: typeof eventFixture) {
  const placed = event.sections.flatMap((section) =>
    section.slots.filter(Boolean),
  )
  assert.equal(
    new Set([...placed, ...event.unassigned]).size,
    event.performances.length,
  )
  assert.equal(
    placed.length + event.unassigned.length,
    event.performances.length,
  )
}

test('deleting a band clears its placement and only its generated constraints', () => {
  const event = fresh()
  event.updatedAt = 'old-version'
  event.constraintSources = {
    'fixed-p1': null,
    'fixed-p5': null,
    'gap-m1': 'p2',
    'last-p12': 'p4',
  }
  const result = removeBandFromEvent(event, 'p2', 'new-version')
  assert.equal(result.updatedAt, 'new-version')
  assert.equal(
    result.performances.some((band) => band.id === 'p2'),
    false,
  )
  assert.equal(result.sections[0].slots[1], null)
  assert.deepEqual(result.unassigned, event.unassigned)
  assert.deepEqual(result.members, event.members)
  assert.deepEqual(
    result.constraints.map((constraint) => constraint.constraint_id),
    ['fixed-p1', 'fixed-p5', 'last-p12'],
  )
  assert.deepEqual(result.constraintSources, {
    'fixed-p1': null,
    'fixed-p5': null,
    'last-p12': 'p4',
  })
})

test('fixture: 3 parts, 4 slots each, 2 unassigned', () => {
  const schedule = buildSchedule(fresh())
  assert.equal(schedule.capacity, 12)
  assert.equal(schedule.assignedCount, 12)
  assert.equal(schedule.unassigned.length, 2)
})

test('direct order reorders within a part, preserving fixed slots', () => {
  const result = setPerformanceOrder(fresh(), 'p2', 4)
  assert.deepEqual(result.event.sections[0].slots, ['p1', 'p3', 'p4', 'p2'])
  assertRoster(result.event)
})

test('moving a fixed performance or dropping on one is rejected', () => {
  assert.ok(setPerformanceOrder(fresh(), 'p1', 2).error)
  assert.ok(setPerformanceOrder(fresh(), 'p2', 1).error)
})

test('cross-part drop shifts only movable slots without losing performers', () => {
  const result = movePerformance(fresh(), 'p2', {
    sectionId: 'part-1',
    index: 2,
  })
  assert.deepEqual(result.event.sections[0].slots, ['p1', 'p3', 'p4', 'p6'])
  assert.deepEqual(result.event.sections[1].slots, ['p5', 'p7', 'p2', 'p8'])
  assertRoster(result.event)
})

test('reordering crosses several fixed slots in both directions and preserves empty slots', () => {
  let state = eventReducer(initialState, { type: 'loaded', event: fresh() })
  state = eventReducer(state, { type: 'fixed', id: 'p3', fixed: true })
  const original = state.event!
  const forward = setPerformanceOrder(original, 'p2', 6)
  assert.equal(forward.error, undefined)
  assert.deepEqual(forward.event.sections[0].slots, ['p1', 'p4', 'p3', 'p6'])
  assert.deepEqual(forward.event.sections[1].slots, ['p5', 'p2', 'p7', 'p8'])
  const reverse = setPerformanceOrder(forward.event, 'p2', 2)
  assert.deepEqual(reverse.event.sections, original.sections)
  const empty = setPerformanceOrder(original, 'p4', null).event
  const withGap = setPerformanceOrder(empty, 'p2', 6)
  assert.deepEqual(withGap.event.sections[0].slots, ['p1', null, 'p3', 'p6'])
  assert.deepEqual(withGap.event.sections[1].slots, ['p5', 'p2', 'p7', 'p8'])
  assert.deepEqual(original.sections[0].slots, ['p1', 'p2', 'p3', 'p4'])
  assertRoster(forward.event)
  assertRoster(reverse.event)
  assertRoster(withGap.event)
})

test('unassigned drop replaces an occupied slot and returns displaced performer', () => {
  const result = setPerformanceOrder(fresh(), 'p13', 12)
  assert.equal(result.event.sections[2].slots[3], 'p13')
  assert.deepEqual(result.event.unassigned, ['p12', 'p14'])
  assertRoster(result.event)
})

test('empty order unassigns and dropping into empty slot places again', () => {
  const result = setPerformanceOrder(fresh(), 'p2', null)
  assert.equal(result.event.sections[0].slots[1], null)
  const placed = setPerformanceOrder(result.event, 'p13', 2)
  assert.equal(placed.event.sections[0].slots[1], 'p13')
  assertRoster(placed.event)
})

test('shrinking part or part count moves excess entries to unassigned', () => {
  const event = { ...fresh(), constraints: [] }
  const result = resizeSchedule(event, 2, 'part-2')
  assert.deepEqual(result.event.unassigned, ['p13', 'p14', 'p11', 'p12'])
  assertRoster(result.event)
  const parts = resizeSchedule(event, 2)
  assert.equal(parts.event.sections.length, 2)
  assert.equal(parts.event.unassigned.length, 6)
  assertRoster(parts.event)
})

test('adding parts or slots adds empty slots without auto placement', () => {
  const result = resizeSchedule(fresh(), 4)
  assert.deepEqual(result.event.sections[3].slots, [null, null, null, null])
  const expanded = resizeSchedule(result.event, 6, 'part-2')
  assert.equal(expanded.event.sections[2].slots.length, 6)
  assert.equal(expanded.event.unassigned.length, 2)
  assertRoster(expanded.event)
})

test('settings reject removing fixed slots or shifting their absolute order', () => {
  assert.ok(resizeSchedule(fresh(), 1).error)
  assert.ok(resizeSchedule(fresh(), 5, 'part-0').error)
  const event = fresh()
  event.constraints = event.constraints.filter(
    (constraint) => constraint.constraint_id !== 'fixed-p5',
  )
  assert.equal(resizeSchedule(event, 5, 'part-0').error, undefined)
})

test('invalid settings and order values do not mutate event', () => {
  const event = fresh()
  for (const value of [0, -1, 13, 1.5, NaN]) {
    const result = setPerformanceOrder(event, 'p2', value)
    assert.ok(result.error)
    assert.equal(result.event, event)
  }
  for (const value of [0, 9, 1.5]) assert.ok(resizeSchedule(event, value).error)
})

test('position checkbox and constraints use the same reducer state', () => {
  let state = eventReducer(initialState, { type: 'loaded', event: fresh() })
  state = eventReducer(state, { type: 'fixed', id: 'p2', fixed: true })
  assert.ok(
    state.event!.constraints.some(
      (constraint) =>
        constraint.type === 'at_position' &&
        constraint.targets.band_id === 'p2',
    ),
  )
  state = eventReducer(state, { type: 'order', id: 'p2', value: 3 })
  assert.ok(state.error)
  state = eventReducer(state, {
    type: 'constraint-update',
    id: 'fixed-p2',
    patch: { hardness: 'soft' },
  })
  assert.equal(state.event!.constraints.at(-1)!.priority, 'mid')
  state = eventReducer(state, { type: 'order', id: 'p2', value: 3 })
  assert.equal(state.error, '')
  state = eventReducer(state, { type: 'constraint-delete', id: 'fixed-p2' })
  assert.equal(state.event!.constraints.length, 4)
})

test('unchanged order or settings preserve the original event', () => {
  const event = fresh()
  assert.equal(setPerformanceOrder(event, 'p2', 2).event, event)
  assert.equal(resizeSchedule(event, 3).event, event)
  assert.equal(resizeSchedule(event, 4, 'part-1').event, event)
})

test('resizing does not orphan soft position or part references', () => {
  assert.ok(resizeSchedule(fresh(), 2).error)
  const event = fresh()
  event.constraints = [
    {
      schema_version: '1.0.0',
      constraint_id: 'range',
      event_id: event.id,
      type: 'in_range',
      hardness: 'soft',
      priority: 'mid',
      enabled: true,
      targets: { band_ids: ['p1'] },
      params: { kind: 'parts', part_ids: [2] },
    },
  ]
  assert.ok(resizeSchedule(event, 2).error)
})
