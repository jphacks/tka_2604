import { eq } from 'drizzle-orm'
import { hc } from 'hono/client'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest'

import { createEvent } from '../../src/db/events'
import { createDb } from '../../src/db/index'
import { chatMessages, constraints, events, users } from '../../src/db/schema'
import app, { type AppType } from '../../src/index'
import { openApiDocument } from '../../src/openapi'
import { createAuthenticatedHeaders } from '../helpers/auth'
import { testDatabase } from '../helpers/database'
import { seedEventInformation } from '../helpers/event-information'
import { expectJsonResponse } from '../helpers/openapi'

let local: Awaited<ReturnType<typeof testDatabase>>
let sessionHeaders: Record<string, string>
let db: ReturnType<typeof createDb>
beforeEach(async () => {
  local = await testDatabase()
  db = createDb(local.binding)
  await db.insert(users).values([
    { userId: 'demo-owner', passwordHash: 'test-only' },
    { userId: 'other', passwordHash: 'test-only' },
  ])
  sessionHeaders = await createAuthenticatedHeaders(local.binding)
})
afterEach(async () => {
  vi.restoreAllMocks()
  await local?.dispose()
})
const suffixes = ['schedule', 'constraints', 'chat'] as const
function request(eventId: string, suffix: string) {
  return app.request(
    `/api/events/${eventId}/${suffix}`,
    { headers: sessionHeaders },
    { DB: local.binding },
  )
}
function contract(suffix: (typeof suffixes)[number]) {
  return openApiDocument.paths[`/api/events/{eventId}/${suffix}`].get.responses
}

describe('event information GET APIs', () => {
  it('retrieves the complete roster, empty parts, unassigned bands, parsed constraints with provenance and ordered chat', async () => {
    const expected = await seedEventInformation(db)
    await seedEventInformation(db, 'other', 'other')
    await seedEventInformation(db, 'demo-owner', 'another')
    const before = await local.binding
      .prepare('SELECT * FROM events ORDER BY event_id')
      .all()
    const outgoing = vi.spyOn(globalThis, 'fetch')
    for (const suffix of suffixes) {
      const response = await request(expected.event.eventId, suffix)
      expect(response.status).toBe(200)
      expect(await response.clone().json()).toEqual(expected[suffix])
      await expectJsonResponse(response, contract(suffix))
    }
    expect(outgoing).not.toHaveBeenCalled()
    expect(
      await local.binding
        .prepare('SELECT * FROM events ORDER BY event_id')
        .all(),
    ).toMatchObject({ results: before.results })
    const basic = await app.request(
      `/api/events/${expected.event.eventId}`,
      { headers: sessionHeaders },
      { DB: local.binding },
    )
    expect(await basic.json()).toEqual(expected.event)
  })

  it('returns empty collections for a new event and preserves its empty first part', async () => {
    const created = await createEvent(db, 'demo-owner', { title: 'Empty' })
    for (const suffix of suffixes) {
      const response = await request(created.event.eventId, suffix)
      expect(response.status).toBe(200)
      await expectJsonResponse(response, contract(suffix))
      expect(await response.json()).toMatchObject(
        suffix === 'schedule'
          ? {
              bands: [],
              members: [],
              memberships: [],
              parts: [{ partName: null, sortOrder: 0 }],
              placements: [],
              unassignedBandIds: [],
            }
          : suffix === 'constraints'
            ? { constraints: [] }
            : { messages: [] },
      )
    }
  })

  it.each(suffixes)(
    'returns 404 for missing, deleted or other-owner events through /%s',
    async (suffix) => {
      const own = await seedEventInformation(db)
      const other = await seedEventInformation(db, 'other', 'other')
      await db
        .update(events)
        .set({ isDeleted: true })
        .where(eq(events.eventId, own.event.eventId))
      for (const eventId of [
        'missing',
        own.event.eventId,
        other.event.eventId,
      ]) {
        const response = await request(eventId, suffix)
        expect(response.status).toBe(404)
        await expectJsonResponse(response, contract(suffix))
        expect(await response.json()).toMatchObject({
          error: { code: 'event_not_found' },
        })
      }
    },
  )

  it('returns all messages beyond a typical page size without altering business updatedAt', async () => {
    const expected = await seedEventInformation(db)
    for (let seq = 10; seq < 75; seq++)
      await db.insert(chatMessages).values({
        messageId: `extra-${seq}`,
        eventId: expected.event.eventId,
        seq,
        role: 'user',
        text: `text-${seq}`,
      })
    const response = await request(expected.event.eventId, 'chat')
    expect(response.status).toBe(200)
    const body = await response.json<{ messages: unknown[] }>()
    expect(body.messages).toHaveLength(68)
    expect((await db.select().from(events))[0].updatedAt).toBe(
      expected.event.updatedAt,
    )
  })

  it.each(suffixes)(
    'returns a documented 500 without exposing a DB failure through /%s',
    async (suffix) => {
      const expected = await seedEventInformation(db)
      const table = {
        schedule: 'bands',
        constraints: 'constraints',
        chat: 'chat_messages',
      }[suffix]
      await local.binding
        .prepare(`ALTER TABLE ${table} RENAME TO unavailable_data`)
        .run()
      const response = await request(expected.event.eventId, suffix)
      expect(response.status).toBe(500)
      await expectJsonResponse(response, contract(suffix))
      expect(await response.text()).not.toContain('unavailable_data')
    },
  )

  it('rejects malformed saved constraints instead of silently dropping them', async () => {
    const expected = await seedEventInformation(db)
    await db
      .update(constraints)
      .set({
        constraintJson: JSON.stringify({
          constraint_id: 'a-c1',
          event_id: expected.event.eventId,
          type: 'unsupported',
        }),
      })
      .where(eq(constraints.constraintId, 'a-c1'))
    const response = await request(expected.event.eventId, 'constraints')
    expect(response.status).toBe(500)
    await expectJsonResponse(response, contract('constraints'))
    expect((await request(expected.event.eventId, 'schedule')).status).toBe(200)
    expect((await request(expected.event.eventId, 'chat')).status).toBe(200)
  })

  it('exposes the three read endpoints through the Hono RPC client', async () => {
    const expected = await seedEventInformation(db)
    const client = hc<AppType>('http://localhost', {
      headers: sessionHeaders,
      fetch: async (input: RequestInfo | URL, init?: RequestInit) =>
        app.request(input instanceof URL ? input.toString() : input, init, {
          DB: local.binding,
        }),
    })
    const params = { param: { eventId: expected.event.eventId } }
    const schedule = await (
      await client.api.events[':eventId'].schedule.$get(params)
    ).json()
    const constraints = await (
      await client.api.events[':eventId'].constraints.$get(params)
    ).json()
    const chat = await (
      await client.api.events[':eventId'].chat.$get(params)
    ).json()
    expectTypeOf(schedule.eventId).toBeString()
    expectTypeOf(chat.messages[0].seq).toBeNumber()
    expectTypeOf(constraints.constraints[0].constraint.type).toEqualTypeOf<
      | 'min_gap_member'
      | 'min_gap_bands'
      | 'before'
      | 'at_position'
      | 'in_range'
      | 'count'
    >()
    expect(schedule).toEqual(expected.schedule)
    expect(constraints).toEqual(expected.constraints)
    expect(chat).toEqual(expected.chat)
  })
})
