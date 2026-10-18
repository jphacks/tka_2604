import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { loadEvent } from '../../src/db/events'
import { createDb } from '../../src/db/index'
import { events, users } from '../../src/db/schema'
import { formRepository } from '../../src/repositories/form'
import { testDatabase } from '../helpers/database'
import { seedEventInformation } from '../helpers/event-information'

let local: Awaited<ReturnType<typeof testDatabase>>
let db: ReturnType<typeof createDb>
let seed: Awaited<ReturnType<typeof seedEventInformation>>
beforeEach(async () => {
  local = await testDatabase()
  db = createDb(local.binding)
  await db
    .insert(users)
    .values({ userId: 'demo-owner', passwordHash: 'test-only' })
  seed = await seedEventInformation(db)
})
afterEach(async () => {
  await local?.dispose()
})

const change = (id: string) => ({
  bandId: id,
  bandName: id,
  description: null,
  create: true,
  memberIds: ['a-m1'],
  newMembers: [],
})

describe('form repository with D1', () => {
  it('saves a band description on create and replaces it on update', async () => {
    const created = await formRepository(db).save(
      seed.event.eventId,
      seed.event.updatedAt,
      { ...change('new'), description: 'メロコア' },
    )
    expect(
      (await formRepository(db).get(seed.event.eventId))?.bands,
    ).toContainEqual({
      bandId: 'new',
      bandName: 'new',
      description: 'メロコア',
    })
    await formRepository(db).save(seed.event.eventId, created.updatedAt, {
      ...change('new'),
      create: false,
      description: null,
    })
    expect(
      (await formRepository(db).get(seed.event.eventId))?.bands,
    ).toContainEqual({ bandId: 'new', bandName: 'new', description: null })
  })

  it('commits a new band and advances the event token', async () => {
    const saved = await formRepository(db).save(
      seed.event.eventId,
      seed.event.updatedAt,
      change('new'),
    )
    expect(Date.parse(saved.updatedAt)).toBeGreaterThan(
      Date.parse(seed.event.updatedAt),
    )
    expect(
      (await formRepository(db).get(seed.event.eventId))?.bands,
    ).toContainEqual({ bandId: 'new', bandName: 'new', description: null })
  })

  it('allows only one simultaneous save with the same token', async () => {
    const repository = formRepository(db)
    const outcomes = await Promise.allSettled([
      repository.save(
        seed.event.eventId,
        seed.event.updatedAt,
        change('new-1'),
      ),
      repository.save(
        seed.event.eventId,
        seed.event.updatedAt,
        change('new-2'),
      ),
    ])
    expect(outcomes.filter((item) => item.status === 'fulfilled')).toHaveLength(
      1,
    )
    expect(outcomes.find((item) => item.status === 'rejected')).toMatchObject({
      reason: { code: 'event_save_conflict' },
    })
    expect((await repository.get(seed.event.eventId))?.bands).toHaveLength(3)
  })

  it('rolls back the event token, band name, new member and memberships after a late failure', async () => {
    const before = await loadEvent(db, 'demo-owner', seed.event.eventId)
    await expect(
      formRepository(db).save(seed.event.eventId, seed.event.updatedAt, {
        bandId: 'a-b1',
        bandName: 'should roll back',
        description: 'should roll back',
        create: false,
        newMembers: [
          { memberId: 'new-member', memberName: 'should roll back' },
        ],
        memberIds: ['new-member', 'missing-member'],
      }),
    ).rejects.toThrow()
    expect(await loadEvent(db, 'demo-owner', seed.event.eventId)).toEqual(
      before,
    )
  })

  it('rejects a foreign target band inside the save without changing either event', async () => {
    const other = await seedEventInformation(db, 'demo-owner', 'other')
    const before = await loadEvent(db, 'demo-owner', seed.event.eventId)
    const otherBefore = await loadEvent(db, 'demo-owner', other.event.eventId)
    await expect(
      formRepository(db).save(seed.event.eventId, seed.event.updatedAt, {
        bandId: 'other-b1',
        bandName: 'wrong event',
        description: null,
        create: false,
        memberIds: [],
        newMembers: [],
      }),
    ).rejects.toMatchObject({ code: 'band_not_found' })
    expect(await loadEvent(db, 'demo-owner', seed.event.eventId)).toEqual(
      before,
    )
    expect(await loadEvent(db, 'demo-owner', other.event.eventId)).toEqual(
      otherBefore,
    )
  })

  it('rechecks deletion and target event in the atomic save', async () => {
    await db
      .update(events)
      .set({ isDeleted: true })
      .where(eq(events.eventId, seed.event.eventId))
    await expect(
      formRepository(db).save(
        seed.event.eventId,
        seed.event.updatedAt,
        change('new'),
      ),
    ).rejects.toMatchObject({ code: 'event_not_found' })
    await expect(
      formRepository(db).save('missing', seed.event.updatedAt, change('other')),
    ).rejects.toMatchObject({ code: 'event_not_found' })
  })
})
