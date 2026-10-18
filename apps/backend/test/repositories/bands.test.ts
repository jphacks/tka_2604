import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, expect, it } from 'vitest'

import { createDb } from '../../src/db/index'
import { bands, events, users } from '../../src/db/schema'
import { bandsRepository } from '../../src/repositories/bands'
import { testDatabase } from '../helpers/database'
import { seedEventInformation } from '../helpers/event-information'
let local: Awaited<ReturnType<typeof testDatabase>>
let db: ReturnType<typeof createDb>
beforeEach(async () => {
  local = await testDatabase()
  db = createDb(local.binding)
  await db.insert(users).values([
    { userId: 'demo-owner', passwordHash: 'test-only' },
    { userId: 'other', passwordHash: 'test-only' },
  ])
  await seedEventInformation(db)
})
afterEach(async () => {
  await local?.dispose()
})
it.each(['owner', 'deleted', 'revision'] as const)(
  'rechecks %s changes inside the atomic delete',
  async (mode) => {
    const repository = bandsRepository(db)
    const snapshot = (await repository.load('demo-owner', 'a-event'))!
    await db
      .update(events)
      .set(
        mode === 'owner'
          ? { createdUserId: 'other' }
          : mode === 'deleted'
            ? { isDeleted: true }
            : { updatedAt: '2026-10-18T00:00:00.000Z' },
      )
      .where(eq(events.eventId, 'a-event'))
    await expect(
      repository.remove('demo-owner', snapshot, 'a-b2'),
    ).rejects.toMatchObject({
      code: mode === 'revision' ? 'event_save_conflict' : 'event_not_found',
    })
    expect(
      await db.select().from(bands).where(eq(bands.bandId, 'a-b2')),
    ).toHaveLength(1)
  },
)
