import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, expect, it } from 'vitest'

import { loadEvent } from '../../src/db/events'
import { createDb } from '../../src/db/index'
import {
  bandMembers,
  bandOrder,
  bands,
  chatMessages,
  constraints,
  events,
  users,
} from '../../src/db/schema'
import app from '../../src/index'
import { openApiDocument } from '../../src/openapi'
import { createAuthenticatedHeaders } from '../helpers/auth'
import { testDatabase } from '../helpers/database'
import { seedEventInformation } from '../helpers/event-information'
import { expectJsonResponse } from '../helpers/openapi'

let local: Awaited<ReturnType<typeof testDatabase>>
let sessionHeaders: Record<string, string>
let db: ReturnType<typeof createDb>
let seed: Awaited<ReturnType<typeof seedEventInformation>>
beforeEach(async () => {
  local = await testDatabase()
  db = createDb(local.binding)
  await db.insert(users).values([
    { userId: 'demo-owner', passwordHash: 'test-only' },
    { userId: 'other-owner', passwordHash: 'test-only' },
  ])
  seed = await seedEventInformation(db)
  sessionHeaders = await createAuthenticatedHeaders(local.binding)
})
afterEach(async () => {
  await local?.dispose()
})
const snapshot = () => loadEvent(db, 'demo-owner', seed.event.eventId)
async function remove(
  bandId = 'a-b2',
  body: unknown = { expectedUpdatedAt: seed.event.updatedAt },
  eventId = seed.event.eventId,
) {
  const response = await app.request(
    `/api/events/${eventId}/bands/${bandId}`,
    {
      method: 'DELETE',
      headers: { ...sessionHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    { DB: local.binding },
  )
  await expectJsonResponse(
    response,
    openApiDocument.paths['/api/events/{eventId}/bands/{bandId}'].delete
      .responses,
  )
  return response
}
it('deletes an unassigned band, retaining members, other memberships, constraints and chat', async () => {
  const before = (await snapshot())!
  const messages = await db.select().from(chatMessages)
  const response = await remove()
  expect(response.status).toBe(200)
  const saved = await response.json<{
    eventId: string
    bandId: string
    updatedAt: string
  }>()
  expect(saved).toMatchObject({ eventId: seed.event.eventId, bandId: 'a-b2' })
  expect(Date.parse(saved.updatedAt)).toBeGreaterThan(
    Date.parse(seed.event.updatedAt),
  )
  const after = (await snapshot())!
  expect(after.bands.map((b) => b.bandId)).toEqual(['a-b1'])
  expect(after.members).toEqual(before.members)
  expect(after.memberships).toEqual([{ bandId: 'a-b1', memberId: 'a-m1' }])
  expect(after.placements).toEqual(before.placements)
  expect(after.parts).toEqual(before.parts)
  expect(after.constraints).toEqual(before.constraints)
  expect(await db.select().from(chatMessages)).toEqual(messages)
})
it('deletes an assigned band and leaves a vacant slot and preserves every other placement', async () => {
  await db.insert(bands).values([
    { eventId: seed.event.eventId, bandId: 'a-b3', bandName: 'C' },
    { eventId: seed.event.eventId, bandId: 'a-b4', bandName: 'D' },
  ])
  await db.insert(bandOrder).values([
    { bandId: 'a-b2', partId: 'a-p1', order: 1 },
    { bandId: 'a-b3', partId: 'a-p1', order: 2 },
    { bandId: 'a-b4', partId: 'a-p2', order: 0 },
  ])
  expect((await remove()).status).toBe(200)
  expect((await snapshot())!.placements).toEqual([
    { bandId: 'a-b1', partId: 'a-p1', order: 0 },
    { bandId: 'a-b3', partId: 'a-p1', order: 2 },
    { bandId: 'a-b4', partId: 'a-p2', order: 0 },
  ])
})
it('can delete the final band while preserving the member roster, parts and constraints without a source', async () => {
  const before = (await snapshot())!
  expect((await remove('a-b1')).status).toBe(200)
  const revision = (await snapshot())!.event.updatedAt
  expect((await remove('a-b2', { expectedUpdatedAt: revision })).status).toBe(
    200,
  )
  const after = (await snapshot())!
  expect(after.bands).toEqual([])
  expect(after.placements).toEqual([])
  expect(after.members).toHaveLength(1)
  expect(after.parts).toHaveLength(2)
  expect(after.constraints).toEqual(
    before.constraints.filter((row) => row.sourceBandId === null),
  )
})
it('deletes all constraints sourced from the band, retaining target-only and other-source constraints', async () => {
  await db.insert(constraints).values([
    {
      constraintId: 'a-c3',
      eventId: seed.event.eventId,
      sourceBandId: 'a-b1',
      constraintJson: JSON.stringify({
        ...seed.constraints.constraints[0].constraint,
        constraint_id: 'a-c3',
        enabled: false,
        targets: { band_id: 'a-b2' },
      }),
    },
    {
      constraintId: 'a-c4',
      eventId: seed.event.eventId,
      sourceBandId: 'a-b2',
      constraintJson: JSON.stringify({
        ...seed.constraints.constraints[0].constraint,
        constraint_id: 'a-c4',
      }),
    },
  ])
  const before = (await snapshot())!
  expect((await remove('a-b1')).status).toBe(200)
  const after = (await snapshot())!
  expect(after.bands.map((band) => band.bandId)).toEqual(['a-b2'])
  expect(after.constraints).toEqual(
    before.constraints.filter((row) => row.sourceBandId !== 'a-b1'),
  )
  expect(after.members).toEqual(before.members)
})
it.each([
  ['missing event', 'a-b2', 'missing', 404],
  ['missing band', 'missing', 'a-event', 404],
  ['band of another event', 'other-b1', 'a-event', 404],
] as const)('rejects %s', async (_label, bandId, eventId, status) => {
  await seedEventInformation(db, 'other-owner', 'other')
  const before = await snapshot()
  expect((await remove(bandId, undefined, eventId)).status).toBe(status)
  expect(await snapshot()).toEqual(before)
  expect(
    await db.select().from(bands).where(eq(bands.bandId, 'other-b1')),
  ).toHaveLength(1)
})
it.each(['other-owner', 'deleted'] as const)(
  'does not delete from %s events',
  async (mode) => {
    if (mode === 'deleted') await db.update(events).set({ isDeleted: true })
    else await db.update(events).set({ createdUserId: 'other-owner' })
    expect((await remove()).status).toBe(404)
    expect(
      await db.select().from(bands).where(eq(bands.bandId, 'a-b2')),
    ).toHaveLength(1)
  },
)
it('rejects a stale token and simultaneous deletion allows only one commit', async () => {
  expect(
    (await remove('a-b2', { expectedUpdatedAt: '2020-01-01T00:00:00.000Z' }))
      .status,
  ).toBe(409)
  const results = await Promise.all([remove(), remove()])
  expect(results.map((r) => r.status).sort()).toEqual([200, 409])
  expect((await snapshot())!.bands.map((b) => b.bandId)).toEqual(['a-b1'])
})
it.each([
  {},
  { expectedUpdatedAt: 'bad' },
  { expectedUpdatedAt: '2026-10-17T00:00:00.000Z', userId: 'other-owner' },
  null,
])('rejects invalid input %j', async (body) => {
  const before = await snapshot()
  expect((await remove('a-b2', body)).status).toBe(422)
  expect(await snapshot()).toEqual(before)
})
it('returns 400 for malformed JSON', async () => {
  const response = await app.request(
    `/api/events/${seed.event.eventId}/bands/a-b2`,
    {
      method: 'DELETE',
      headers: { ...sessionHeaders, 'Content-Type': 'application/json' },
      body: '{',
    },
    { DB: local.binding },
  )
  expect(response.status).toBe(400)
  await expectJsonResponse(
    response,
    openApiDocument.paths['/api/events/{eventId}/bands/{bandId}'].delete
      .responses,
  )
})
it('rolls back deletion, memberships, order and timestamp on a late D1 failure', async () => {
  await db
    .insert(bandOrder)
    .values({ bandId: 'a-b2', partId: 'a-p1', order: 1 })
  const before = await snapshot()
  await local.binding
    .prepare(
      "CREATE TRIGGER fail_delete AFTER DELETE ON bands BEGIN SELECT RAISE(ABORT, 'test_failure'); END",
    )
    .run()
  expect((await remove('a-b1')).status).toBe(500)
  expect(await snapshot()).toEqual(before)
  expect(await db.select().from(bandMembers)).toHaveLength(2)
})
