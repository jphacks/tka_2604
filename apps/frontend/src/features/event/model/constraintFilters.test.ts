import { expect, it } from 'vitest'

import {
  describeConstraint,
  evaluateConstraint,
} from '../../../shared/model/constraints'
import { eventFixture } from '../../../test/fixtures/event'
import {
  constraintTargets,
  emptyConstraintFilters,
  filterConstraintViews,
} from './constraintFilters'

it('combines target, type and query filters while distinguishing unchecked from unmet', () => {
  const event = structuredClone(eventFixture)
  const views = event.constraints.map((constraint) => ({
    constraint,
    text: describeConstraint(constraint, event),
    ...evaluateConstraint(constraint, event),
  }))
  const first = views[0]
  const targets = constraintTargets(first.constraint, event)
  const filtered = filterConstraintViews(
    views,
    event,
    {
      ...emptyConstraintFilters,
      type: first.constraint.type,
      bandId: targets.bandIds[0],
      query: first.text,
    },
    false,
  )
  expect(filtered).toContain(first)
  expect(
    filterConstraintViews(
      views,
      event,
      { ...emptyConstraintFilters, query: '存在しない名前' },
      false,
    ),
  ).toEqual([])
  const unchecked = { ...first, status: 'unchecked' as const }
  expect(
    filterConstraintViews([unchecked], event, emptyConstraintFilters, true),
  ).toEqual([])
  expect(
    filterConstraintViews(
      [unchecked],
      event,
      { ...emptyConstraintFilters, status: 'unchecked' },
      false,
    ),
  ).toEqual([unchecked])
})

it('finds member constraints through memberships and keeps the person identity', () => {
  const event = structuredClone(eventFixture)
  const constraint = event.constraints.find((c) => c.type === 'min_gap_member')!
  expect(constraint.type).toBe('min_gap_member')
  if (constraint.type !== 'min_gap_member') return
  const target = constraintTargets(constraint, event)
  expect(target.bandIds).toEqual(
    event.performances
      .filter((b) => b.memberIds.includes(constraint.targets.member_id))
      .map((b) => b.id),
  )
  expect(target.memberIds).toEqual([constraint.targets.member_id])
})
