import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { testDatabase } from '../test/database'
import { createEvent, deleteEvent, deletePart, loadEvent } from './events'
import { createDb } from './index'
import { bandOrder, bands, constraints, parts, users } from './schema'

let local: Awaited<ReturnType<typeof testDatabase>>
let db: ReturnType<typeof createDb>
beforeEach(async () => {
  local = await testDatabase()
  db = createDb(local.binding)
  await db.insert(users).values([
    { userId: 'owner', passwordHash: 'test-only-not-a-login' },
    { userId: 'other', passwordHash: 'test-only-not-a-login' },
  ])
})
afterEach(async () => {
  await local?.dispose()
})

describe('event persistence', () => {
  it('creates an event with one empty part and optional fields unset', async () => {
    const saved = await createEvent(db, 'owner', { title: 'Live' })
    expect(saved.event).toMatchObject({
      title: 'Live',
      status: 'planning',
      date: null,
      venue: null,
      description: null,
      isDeleted: false,
    })
    expect(saved.parts).toHaveLength(1)
    expect(saved.parts[0]).toMatchObject({ sortOrder: 0, comment: null })
    expect(saved.placements).toEqual([])
    expect(saved.event).not.toHaveProperty('passwordHash')
  })

  it('hides other owners and logically deleted events without deleting child rows', async () => {
    const saved = await createEvent(db, 'owner', { title: 'Live' })
    await db
      .insert(bands)
      .values({ bandId: 'b1', eventId: saved.event.eventId, bandName: 'A' })
    expect(await loadEvent(db, 'other', saved.event.eventId)).toBeNull()
    await expect(deleteEvent(db, 'other', saved.event.eventId)).rejects.toThrow(
      'event_not_found',
    )
    await deleteEvent(db, 'owner', saved.event.eventId)
    expect(await loadEvent(db, 'owner', saved.event.eventId)).toBeNull()
    expect(await db.select().from(bands)).toHaveLength(1)
    expect(await db.select().from(parts)).toHaveLength(1)
  })

  it('prevents deleting the last part, an occupied part and a constraint-referenced part', async () => {
    const saved = await createEvent(db, 'owner', { title: 'Live' })
    const eventId = saved.event.eventId
    const first = saved.parts[0].partId
    await expect(deletePart(db, 'owner', eventId, first)).rejects.toThrow()
    await db.insert(parts).values({ partId: 'p2', eventId, sortOrder: 1 })
    await db.insert(bands).values({ bandId: 'b1', eventId, bandName: 'A' })
    await db.insert(bandOrder).values({ bandId: 'b1', partId: first, order: 0 })
    await expect(deletePart(db, 'owner', eventId, first)).rejects.toThrow()
    await db.insert(constraints).values({
      constraintId: 'c1',
      eventId,
      constraintJson: JSON.stringify({
        constraint_id: 'c1',
        event_id: eventId,
        type: 'in_range',
        params: { kind: 'parts', part_ids: [1] },
      }),
    })
    await expect(deletePart(db, 'owner', eventId, 'p2')).rejects.toThrow()
  })
})

it('deletes an empty unreferenced part and compacts the remaining display order', async () => {
  const saved = await createEvent(db, 'owner', { title: 'Live' })
  const eventId = saved.event.eventId
  await db.insert(parts).values([
    { partId: 'p2', eventId, sortOrder: 1 },
    { partId: 'p3', eventId, sortOrder: 2 },
  ])
  await deletePart(db, 'owner', eventId, 'p2')
  const result = await loadEvent(db, 'owner', eventId)
  expect(result?.parts.map((part) => [part.partId, part.sortOrder])).toEqual([
    [saved.parts[0].partId, 0],
    ['p3', 1],
  ])
  expect(result?.event.updatedAt).not.toBe(saved.event.updatedAt)
})
