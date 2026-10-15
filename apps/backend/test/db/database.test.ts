import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createDb } from '../../src/db/index'
import {
  bandMembers,
  bandOrder,
  bands,
  constraints,
  events,
  members,
  parts,
  users,
} from '../../src/db/schema'
import { testDatabase } from '../helpers/database'

let local: Awaited<ReturnType<typeof testDatabase>>
let db: ReturnType<typeof createDb>
beforeEach(async () => {
  local = await testDatabase()
  db = createDb(local.binding)
  await db
    .insert(users)
    .values({ userId: 'owner', passwordHash: 'test-only-not-a-login' })
  await db.insert(events).values([
    { eventId: 'e1', createdUserId: 'owner', title: 'Live' },
    { eventId: 'e2', createdUserId: 'owner', title: 'Other' },
  ])
  await db.insert(parts).values([
    { partId: 'p1', eventId: 'e1', sortOrder: 0 },
    { partId: 'p2', eventId: 'e1', sortOrder: 1 },
    { partId: 'other-part', eventId: 'e2', sortOrder: 0 },
  ])
  await db.insert(bands).values([
    { bandId: 'b1', eventId: 'e1', bandName: 'A' },
    { bandId: 'b2', eventId: 'e1', bandName: 'B' },
  ])
  await db.insert(members).values([
    { memberId: 'm1', eventId: 'e1', memberName: '同名' },
    { memberId: 'm2', eventId: 'e1', memberName: '同名' },
    { memberId: 'other-member', eventId: 'e2', memberName: 'Other' },
  ])
})
afterEach(async () => {
  await local?.dispose()
})

describe('D1 business schema with actual migrations', () => {
  it('keeps names independent from identity, shared membership, unassigned bands and empty parts', async () => {
    await db.insert(bandMembers).values([
      { bandId: 'b1', memberId: 'm1' },
      { bandId: 'b2', memberId: 'm1' },
      { bandId: 'b2', memberId: 'm2' },
    ])
    expect(await db.select().from(bandMembers)).toHaveLength(3)
    expect(
      (await db.select().from(members)).filter((m) => m.memberName === '同名'),
    ).toHaveLength(2)
    expect(await db.select().from(bandOrder)).toEqual([])
    expect(await db.select().from(parts)).toHaveLength(3)
  })

  it('rejects duplicate membership, repeated placement and occupied positions', async () => {
    await db.insert(bandMembers).values({ bandId: 'b1', memberId: 'm1' })
    await expect(
      db.insert(bandMembers).values({ bandId: 'b1', memberId: 'm1' }),
    ).rejects.toThrow()
    await db.insert(bandOrder).values({ bandId: 'b1', partId: 'p1', order: 0 })
    await expect(
      db.insert(bandOrder).values({ bandId: 'b1', partId: 'p2', order: 0 }),
    ).rejects.toThrow()
    await expect(
      db.insert(bandOrder).values({ bandId: 'b2', partId: 'p1', order: 0 }),
    ).rejects.toThrow()
  })

  it('rejects cross-event membership and placement in the DB', async () => {
    await expect(
      db.insert(bandMembers).values({ bandId: 'b1', memberId: 'other-member' }),
    ).rejects.toThrow()
    await expect(
      db
        .insert(bandOrder)
        .values({ bandId: 'b1', partId: 'other-part', order: 0 }),
    ).rejects.toThrow()
  })

  it('rejects missing parents, invalid order and invalid event state', async () => {
    await expect(
      db.insert(bandMembers).values({ bandId: 'missing', memberId: 'm1' }),
    ).rejects.toThrow()
    await expect(
      db.insert(bandOrder).values({ bandId: 'b1', partId: 'p1', order: -1 }),
    ).rejects.toThrow()
    await expect(
      local.binding
        .prepare("UPDATE events SET status = 'invalid' WHERE event_id = 'e1'")
        .run(),
    ).rejects.toThrow()
    await expect(
      local.binding
        .prepare("UPDATE events SET is_deleted = 2 WHERE event_id = 'e1'")
        .run(),
    ).rejects.toThrow()
  })

  it('stores constraint JSON without a separate type column and checks identity', async () => {
    const value = JSON.stringify({
      schema_version: '1.0.0',
      constraint_id: 'c1',
      event_id: 'e1',
      type: 'at_position',
      hardness: 'hard',
      priority: null,
      enabled: true,
      targets: { band_id: 'b1' },
      params: { position: 0 },
    })
    await db
      .insert(constraints)
      .values({ constraintId: 'c1', eventId: 'e1', constraintJson: value })
    expect((await db.select().from(constraints))[0].constraintJson).toBe(value)
    await expect(
      db
        .insert(constraints)
        .values({ constraintId: 'c2', eventId: 'e1', constraintJson: value }),
    ).rejects.toThrow()
    await expect(
      db.insert(constraints).values({
        constraintId: 'c3',
        eventId: 'e1',
        constraintJson: 'not-json',
      }),
    ).rejects.toThrow()
  })
})

it('rolls back earlier writes if a later D1 batch statement fails', async () => {
  await expect(
    db.batch([
      db.update(events).set({ title: 'changed' }),
      db
        .insert(bandOrder)
        .values({ bandId: 'b1', partId: 'other-part', order: 0 }),
    ]),
  ).rejects.toThrow()
  expect((await db.select().from(events)).map((event) => event.title)).toEqual([
    'Live',
    'Other',
  ])
  expect(await db.select().from(bandOrder)).toEqual([])
})

it('enforces same-event integrity on updates as well as inserts', async () => {
  await db.insert(bandMembers).values({ bandId: 'b1', memberId: 'm1' })
  await db.insert(bandOrder).values({ bandId: 'b1', partId: 'p1', order: 0 })
  await expect(
    local.binding
      .prepare(
        "UPDATE band_members SET member_id = 'other-member' WHERE band_id = 'b1'",
      )
      .run(),
  ).rejects.toThrow()
  await expect(
    local.binding
      .prepare(
        "UPDATE band_order SET part_id = 'other-part' WHERE band_id = 'b1'",
      )
      .run(),
  ).rejects.toThrow()
  await expect(
    local.binding
      .prepare("UPDATE bands SET event_id = 'e2' WHERE band_id = 'b1'")
      .run(),
  ).rejects.toThrow()
  await expect(
    local.binding
      .prepare("UPDATE members SET event_id = 'e2' WHERE member_id = 'm1'")
      .run(),
  ).rejects.toThrow()
  await expect(
    local.binding
      .prepare("UPDATE parts SET event_id = 'e2' WHERE part_id = 'p1'")
      .run(),
  ).rejects.toThrow()
})
