import { describe, expect, it } from 'vitest'

import {
  createEventSchema,
  updateEventSchema,
} from '../../../src/services/events/validation'

describe('event input validation', () => {
  it('trims names, accepts leap days and explicit nullable fields', () => {
    expect(
      createEventSchema.parse({
        title: ' Live ',
        date: '2028-02-29',
        venue: null,
      }),
    ).toEqual({ title: 'Live', date: '2028-02-29', venue: null })
    expect(
      updateEventSchema.parse({
        expectedUpdatedAt: '2026-10-17T00:00:00.000Z',
        description: null,
      }),
    ).toEqual({
      expectedUpdatedAt: '2026-10-17T00:00:00.000Z',
      description: null,
    })
  })
  it.each([
    {},
    { title: '' },
    { title: ' \n ' },
    { title: 1 },
    { title: 'Live', date: '2026-02-29' },
    { title: 'Live', date: '2026-13-01' },
    { title: 'Live', createdUserId: 'other' },
    { title: 'Live', status: 'confirmed' },
  ])('rejects invalid create input: %j', (input) => {
    expect(createEventSchema.safeParse(input).success).toBe(false)
  })
  it.each([
    {},
    { title: 'Live' },
    { expectedUpdatedAt: 'invalid', title: 'Live' },
    { expectedUpdatedAt: '2026-10-17T00:00:00.000Z' },
    { expectedUpdatedAt: '2026-10-17T00:00:00.000Z', status: 'unknown' },
    { expectedUpdatedAt: '2026-10-17T00:00:00.000Z', isDeleted: true },
  ])('rejects invalid update input: %j', (input) => {
    expect(updateEventSchema.safeParse(input).success).toBe(false)
  })
})
