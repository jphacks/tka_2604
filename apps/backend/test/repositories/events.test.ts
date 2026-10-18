import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createEvent } from '../../src/db/events'
import { createDb } from '../../src/db/index'
import { bandOrder, bands, events, parts, users } from '../../src/db/schema'
import { eventsRepository } from '../../src/repositories/events'
import { testDatabase } from '../helpers/database'

let local: Awaited<ReturnType<typeof testDatabase>>
let db: ReturnType<typeof createDb>
let repository: ReturnType<typeof eventsRepository>

beforeEach(async () => {
  local = await testDatabase()
  db = createDb(local.binding)
  await db.insert(users).values([
    { userId: 'owner', passwordHash: 'test-only' },
    { userId: 'other', passwordHash: 'test-only' },
  ])
  repository = eventsRepository(db)
})
afterEach(async () => {
  await local?.dispose()
})

describe('event repository', () => {
  it('creates an event and one empty part atomically, and retrieves only public basic fields', async () => {
    const created = await repository.create('owner', { title: 'Live' })
    expect(created).toMatchObject({
      title: 'Live',
      status: 'planning',
      date: null,
      venue: null,
      description: null,
    })
    expect(await repository.get('owner', created.eventId)).toEqual(created)
    expect(created).not.toHaveProperty('createdUserId')
    expect(created).not.toHaveProperty('isDeleted')
    expect(await db.select().from(parts)).toMatchObject([
      { eventId: created.eventId, sortOrder: 0 },
    ])
    await expect(
      repository.create('missing-user', { title: 'Must roll back' }),
    ).rejects.toThrow()
    expect(await db.select().from(events)).toHaveLength(1)
    await local.binding
      .prepare(
        "CREATE TRIGGER fail_part BEFORE INSERT ON parts BEGIN SELECT RAISE(ABORT, 'part_failure'); END",
      )
      .run()
    await expect(
      repository.create('owner', { title: 'Second statement fails' }),
    ).rejects.toThrow()
    expect(await db.select().from(events)).toHaveLength(1)
    expect(await db.select().from(parts)).toHaveLength(1)
  })

  it('counts bands, placements and empty parts independently, and filters owner and deleted events', async () => {
    const saved = await createEvent(db, 'owner', { title: 'Live' })
    const eventId = saved.event.eventId
    await db.insert(bands).values([
      { bandId: 'b1', eventId, bandName: 'A' },
      { bandId: 'b2', eventId, bandName: 'B' },
      { bandId: 'b3', eventId, bandName: 'C' },
    ])
    await db
      .insert(parts)
      .values({ partId: 'empty-part', eventId, sortOrder: 1 })
    await db.insert(bandOrder).values([
      { bandId: 'b1', partId: saved.parts[0].partId, order: 0 },
      { bandId: 'b2', partId: saved.parts[0].partId, order: 1 },
    ])
    await createEvent(db, 'other', { title: 'Other owner' })
    const deleted = await createEvent(db, 'owner', { title: 'Deleted' })
    await repository.remove('owner', deleted.event.eventId)
    expect(await repository.list('owner')).toMatchObject([
      {
        eventId,
        performanceCount: 3,
        assignedCount: 2,
        partCount: 2,
        responseCount: null,
      },
    ])
    expect(await repository.get('other', eventId)).toBeNull()
    expect(await repository.get('owner', deleted.event.eventId)).toBeNull()
  })

  it('updates only supplied settings and advances updatedAt even within the same millisecond', async () => {
    const current = await repository.create('owner', {
      title: 'Live',
      venue: 'Hall',
      description: 'Keep',
    })
    const future = '2099-01-01T00:00:00.000Z'
    await db
      .update(events)
      .set({ updatedAt: future })
      .where(eq(events.eventId, current.eventId))
    const updated = await repository.update('owner', current.eventId, future, {
      title: 'Changed',
      venue: null,
      status: 'confirmed',
    })
    expect(updated).toMatchObject({
      title: 'Changed',
      venue: null,
      description: 'Keep',
      status: 'confirmed',
      updatedAt: '2099-01-01T00:00:00.001Z',
    })
    expect(await repository.get('owner', current.eventId)).toEqual(updated)
    await expect(
      repository.update('owner', current.eventId, future, { title: 'Stale' }),
    ).rejects.toThrow('event_save_conflict')
    expect(await repository.get('owner', current.eventId)).toEqual(updated)
  })

  it('allows only one competing settings update, and distinguishes a missing event from a stale update', async () => {
    const current = await repository.create('owner', { title: 'Live' })
    const results = await Promise.allSettled([
      repository.update('owner', current.eventId, current.updatedAt, {
        title: 'A',
      }),
      repository.update('owner', current.eventId, current.updatedAt, {
        title: 'B',
      }),
    ])
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1)
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1)
    await expect(
      repository.update('other', current.eventId, current.updatedAt, {
        title: 'Other',
      }),
    ).rejects.toThrow('event_not_found')
    await repository.remove('owner', current.eventId)
    await expect(
      repository.update('owner', current.eventId, current.updatedAt, {
        title: 'Deleted',
      }),
    ).rejects.toThrow('event_not_found')
    await expect(repository.remove('owner', current.eventId)).rejects.toThrow(
      'event_not_found',
    )
  })
})

it('retrieves only one owned event and returns null for inaccessible information', async () => {
  const { seedEventInformation } = await import('../helpers/event-information')
  const expected = await seedEventInformation(db, 'owner')
  await seedEventInformation(db, 'owner', 'another')
  await seedEventInformation(db, 'other', 'other')
  expect(await repository.getSchedule('owner', expected.event.eventId)).toEqual(
    expected.schedule,
  )
  expect(await repository.getChat('owner', expected.event.eventId)).toEqual(
    expected.chat,
  )
  expect(
    await repository.getConstraints('owner', expected.event.eventId),
  ).toEqual({
    eventId: expected.event.eventId,
    updatedAt: expected.event.updatedAt,
    constraints: expected.constraints.constraints.map((row) => ({
      constraintId: row.constraint.constraint_id,
      constraintJson: JSON.stringify(row.constraint),
      sourceBandId: row.sourceBandId,
    })),
  })
  for (const method of ['getSchedule', 'getConstraints', 'getChat'] as const) {
    expect(await repository[method]('other', expected.event.eventId)).toBeNull()
    expect(await repository[method]('owner', 'missing')).toBeNull()
  }
  await repository.remove('owner', expected.event.eventId)
  for (const method of ['getSchedule', 'getConstraints', 'getChat'] as const)
    expect(await repository[method]('owner', expected.event.eventId)).toBeNull()
})
