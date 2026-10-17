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

import { createEvent, loadEvent } from '../../src/db/events'
import { createDb } from '../../src/db/index'
import {
  bandMembers,
  bandOrder,
  bands,
  chatMessages,
  constraints,
  events,
  members,
  parts,
  users,
} from '../../src/db/schema'
import app, { type AppType } from '../../src/index'
import * as solverIntegration from '../../src/integrations/solver'
import { openApiDocument } from '../../src/openapi'
import * as persistence from '../../src/repositories/events'
import { eventRoutes } from '../../src/routes/events'
import type {
  EventDetails,
  EventSummary,
} from '../../src/services/events/types'
import { testDatabase } from '../helpers/database'
import { expectJsonResponse } from '../helpers/openapi'

let local: Awaited<ReturnType<typeof testDatabase>>
let db: ReturnType<typeof createDb>
beforeEach(async () => {
  local = await testDatabase()
  db = createDb(local.binding)
  await db.insert(users).values([
    { userId: 'demo-owner', passwordHash: 'test-only' },
    { userId: 'other', passwordHash: 'test-only' },
  ])
})
afterEach(async () => {
  await local?.dispose()
})

function request(path = '/api/events', method = 'GET', body?: unknown) {
  return app.request(
    path,
    {
      method,
      ...(body === undefined
        ? {}
        : {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }),
    },
    { DB: local.binding },
  )
}

async function create() {
  const response = await request('/api/events', 'POST', {
    title: ' Live ',
    date: '2026-11-01',
    venue: 'Hall',
    description: 'About',
  })
  expect(response.status).toBe(201)
  await expectJsonResponse(
    response,
    openApiDocument.paths['/api/events'].post.responses,
  )
  expect(response.headers.get('location')).toMatch(/^\/api\/events\//)
  return response.json<EventDetails>()
}

describe('event HTTP API', () => {
  it('serves schedule and constraint saves directly from eventRoutes', async () => {
    const created = await create()
    const snapshot = (await loadEvent(db, 'demo-owner', created.eventId))!
    const schedule = await eventRoutes.request(
      `/${created.eventId}/schedule`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedUpdatedAt: created.updatedAt,
          parts: snapshot.parts.map(({ partId, partName }) => ({
            partId,
            partName,
          })),
          placements: [],
          unassignedBandIds: [],
        }),
      },
      { DB: local.binding },
    )
    expect(schedule.status).toBe(200)
    await expectJsonResponse(
      schedule,
      openApiDocument.paths['/api/events/{eventId}/schedule'].post.responses,
    )
    const saved = await schedule.json<{ updatedAt: string }>()
    const constraints = await eventRoutes.request(
      `/${created.eventId}/constraints`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedUpdatedAt: saved.updatedAt,
          constraints: [],
        }),
      },
      { DB: local.binding },
    )
    expect(constraints.status).toBe(200)
    await expectJsonResponse(
      constraints,
      openApiDocument.paths['/api/events/{eventId}/constraints'].post.responses,
    )
  })

  it('serves solve directly from eventRoutes with the same owner and DB', async () => {
    const created = await create()
    const snapshot = (await loadEvent(db, 'demo-owner', created.eventId))!
    await db.insert(bands).values({
      bandId: 'direct-band',
      eventId: created.eventId,
      bandName: 'Direct',
    })
    const client = vi.fn().mockResolvedValue({
      eventId: created.eventId,
      status: 'feasible',
      placements: [
        { bandId: 'direct-band', partId: snapshot.parts[0].partId, order: 0 },
      ],
      unassignedBandIds: [],
      constraintResults: [],
    })
    vi.spyOn(solverIntegration, 'solverClient').mockReturnValueOnce(client)
    const response = await eventRoutes.request(
      `/${created.eventId}/solve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedUpdatedAt: created.updatedAt }),
      },
      { DB: local.binding },
    )
    expect(response.status).toBe(200)
    await expectJsonResponse(
      response,
      openApiDocument.paths['/api/events/{eventId}/solve'].post.responses,
    )
    expect(client).toHaveBeenCalledOnce()
    expect(
      (await loadEvent(db, 'demo-owner', created.eventId))?.placements,
    ).toHaveLength(1)
  })

  it('creates, lists, retrieves and partially updates the same basic event through D1', async () => {
    const created = await create()
    expect(created).toMatchObject({
      title: 'Live',
      status: 'planning',
      date: '2026-11-01',
      venue: 'Hall',
      description: 'About',
    })
    const path = `/api/events/${created.eventId}`
    const detail = await request(path)
    await expectJsonResponse(
      detail,
      openApiDocument.paths['/api/events/{eventId}'].get.responses,
    )
    expect(await detail.json()).toEqual(created)
    const list = await request()
    await expectJsonResponse(
      list,
      openApiDocument.paths['/api/events'].get.responses,
    )
    expect(await list.json()).toEqual({
      events: [
        {
          ...created,
          performanceCount: 0,
          assignedCount: 0,
          partCount: 1,
          responseCount: null,
        },
      ],
    })
    const updated = await request(path, 'PATCH', {
      expectedUpdatedAt: created.updatedAt,
      title: 'Renamed',
      venue: null,
      status: 'confirmed',
    })
    expect(updated.status).toBe(200)
    await expectJsonResponse(
      updated,
      openApiDocument.paths['/api/events/{eventId}'].patch.responses,
    )
    const body = await updated.json<EventDetails>()
    expect(body).toMatchObject({
      ...created,
      title: 'Renamed',
      venue: null,
      status: 'confirmed',
      updatedAt: body.updatedAt,
    })
    expect(body.updatedAt).not.toBe(created.updatedAt)
    expect(await (await request(path)).json()).toEqual(body)
    expect(
      (await loadEvent(db, 'demo-owner', created.eventId))?.event.title,
    ).toBe('Renamed')
    expect(body).not.toHaveProperty('createdUserId')
    expect(body).not.toHaveProperty('bands')
    expect(body).not.toHaveProperty('isDeleted')
  })

  it.each([
    { title: '' },
    { title: ' \n ' },
    { title: 42 },
    { title: 'Live', date: '2026-02-29' },
    { title: 'Live', createdUserId: 'other' },
  ])('rejects invalid create input without writing: %j', async (input) => {
    const response = await request('/api/events', 'POST', input)
    expect(response.status).toBe(422)
    await expectJsonResponse(
      response,
      openApiDocument.paths['/api/events'].post.responses,
    )
    const body = await response.json<{
      error: { code: string; details: unknown[] }
    }>()
    expect(body.error.code).toBe('invalid_input')
    expect(body.error.details.length).toBeGreaterThan(0)
    expect(await db.select().from(events)).toEqual([])
    expect(await db.select().from(parts)).toEqual([])
  })

  it('returns 400 for malformed JSON and 422 for a missing JSON content type', async () => {
    for (const [body, headers, status] of [
      ['{', { 'Content-Type': 'application/json' }, 400],
      ['{"title":"Live"}', {}, 422],
    ] as const) {
      const response = await app.request(
        '/api/events',
        { method: 'POST', body, headers },
        { DB: local.binding },
      )
      expect(response.status).toBe(status)
      await expectJsonResponse(
        response,
        openApiDocument.paths['/api/events'].post.responses,
      )
    }
    expect(await db.select().from(events)).toEqual([])
  })

  it('rejects invalid settings and stale updates without changing saved data', async () => {
    const created = await create()
    const path = `/api/events/${created.eventId}`
    for (const input of [
      { expectedUpdatedAt: created.updatedAt, title: ' ' },
      { expectedUpdatedAt: created.updatedAt, status: 'unknown' },
      { expectedUpdatedAt: created.updatedAt, bands: [] },
      { expectedUpdatedAt: created.updatedAt },
      { title: 'Missing timestamp' },
    ]) {
      const response = await request(path, 'PATCH', input)
      expect(response.status).toBe(422)
      await expectJsonResponse(
        response,
        openApiDocument.paths['/api/events/{eventId}'].patch.responses,
      )
    }
    expect(await (await request(path)).json()).toEqual(created)
    await request(path, 'PATCH', {
      expectedUpdatedAt: created.updatedAt,
      title: 'New',
    })
    const stale = await request(path, 'PATCH', {
      expectedUpdatedAt: created.updatedAt,
      title: 'Stale',
    })
    expect(stale.status).toBe(409)
    await expectJsonResponse(
      stale,
      openApiDocument.paths['/api/events/{eventId}'].patch.responses,
    )
    expect(await stale.json()).toMatchObject({
      error: { code: 'event_save_conflict' },
    })
    expect(await (await request(path)).json()).toMatchObject({ title: 'New' })
  })

  it('hides missing, deleted and other-owner events for detail, update and delete', async () => {
    const other = await createEvent(db, 'other', { title: 'Other' })
    const created = await create()
    await request(`/api/events/${created.eventId}`, 'DELETE')
    for (const eventId of ['missing', other.event.eventId, created.eventId]) {
      for (const method of ['GET', 'PATCH', 'DELETE'] as const) {
        const response = await request(
          `/api/events/${eventId}`,
          method,
          method === 'PATCH'
            ? { expectedUpdatedAt: created.updatedAt, title: 'Changed' }
            : undefined,
        )
        expect(response.status).toBe(404)
        const operation =
          method === 'GET' ? 'get' : method === 'PATCH' ? 'patch' : 'delete'
        await expectJsonResponse(
          response,
          openApiDocument.paths['/api/events/{eventId}'][operation].responses,
        )
        expect(await response.json()).toMatchObject({
          error: { code: 'event_not_found' },
        })
      }
    }
    expect(await (await request()).json()).toEqual({ events: [] })
    expect(
      (await loadEvent(db, 'other', other.event.eventId))?.event.title,
    ).toBe('Other')
  })

  it('logically deletes while preserving bands, members, parts, memberships, placements, wishes, constraints and chat', async () => {
    const created = await create()
    const eventId = created.eventId
    const saved = (await loadEvent(db, 'demo-owner', eventId))!
    await db.insert(bands).values({
      bandId: 'band',
      eventId,
      bandName: 'A',
      requestText: '第1部',
      requestStatus: 'pending',
    })
    await db
      .insert(members)
      .values({ memberId: 'member', eventId, memberName: 'Member' })
    await db.insert(bandMembers).values({ bandId: 'band', memberId: 'member' })
    await db
      .insert(bandOrder)
      .values({ bandId: 'band', partId: saved.parts[0].partId, order: 0 })
    await db.insert(constraints).values({
      constraintId: 'condition',
      eventId,
      constraintJson: JSON.stringify({
        constraint_id: 'condition',
        event_id: eventId,
      }),
      sourceBandId: 'band',
    })
    await db.insert(chatMessages).values({
      messageId: 'message',
      eventId,
      seq: 0,
      role: 'user',
      text: 'Hello',
    })
    const response = await request(`/api/events/${eventId}`, 'DELETE')
    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
    expect(response.headers.get('content-type')).toBeNull()
    expect(
      openApiDocument.paths['/api/events/{eventId}'].delete.responses,
    ).toHaveProperty('204')
    expect(
      await db.select().from(events).where(eq(events.eventId, eventId)),
    ).toMatchObject([{ isDeleted: true }])
    expect(await db.select().from(bands)).toMatchObject([
      { requestText: '第1部', requestStatus: 'pending' },
    ])
    for (const table of [
      members,
      bandMembers,
      bandOrder,
      parts,
      constraints,
      chatMessages,
    ]) {
      expect(await db.select().from(table)).toHaveLength(1)
    }
    expect(await loadEvent(db, 'demo-owner', eventId)).toBeNull()
  })

  it('uses the demo owner without environment settings and ignores client-supplied owner IDs', async () => {
    const created = await create()
    await createEvent(db, 'other', { title: 'Other owner' })
    const response = await app.request(
      '/api/events?userId=other',
      { headers: { 'X-User-Id': 'other' } },
      { DB: local.binding },
    )
    expect(response.status).toBe(200)
    await expectJsonResponse(
      response,
      openApiDocument.paths['/api/events'].get.responses,
    )
    const body = await response.json<{ events: EventSummary[] }>()
    expect(body.events.map((event) => event.eventId)).toEqual([created.eventId])
    expect(
      await db.select().from(events).where(eq(events.eventId, created.eventId)),
    ).toMatchObject([{ createdUserId: 'demo-owner' }])
  })

  it('returns documented 500 errors for DB failures without exposing internal details', async () => {
    const created = await create()
    const repository = persistence.eventsRepository(db)
    for (const method of ['GET', 'POST', 'PATCH', 'DELETE'] as const) {
      const fail = () =>
        Promise.reject(new Error('SQL password_hash hidden exception'))
      vi.spyOn(persistence, 'eventsRepository').mockReturnValue({
        ...repository,
        list: fail,
        get: fail,
        create: fail,
        update: fail,
        remove: fail,
      })
      const path =
        method === 'POST' ? '/api/events' : `/api/events/${created.eventId}`
      const response = await request(
        path,
        method,
        method === 'POST'
          ? { title: 'Failed' }
          : method === 'PATCH'
            ? { expectedUpdatedAt: created.updatedAt, title: 'Failed' }
            : undefined,
      )
      expect(response.status).toBe(500)
      const responses =
        method === 'POST'
          ? openApiDocument.paths['/api/events'].post.responses
          : openApiDocument.paths['/api/events/{eventId}'][
              method === 'GET' ? 'get' : method === 'PATCH' ? 'patch' : 'delete'
            ].responses
      await expectJsonResponse(response, responses)
      expect(await response.json()).toEqual({
        error: {
          code: 'internal_error',
          message: 'イベントの処理に失敗しました。',
          details: [],
        },
      })
    }
    expect(await repository.get('demo-owner', created.eventId)).toEqual(created)
  })

  it('exposes event request and response types through Hono RPC', async () => {
    const client = hc<AppType>('http://localhost', {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) =>
        app.request(input instanceof URL ? input.toString() : input, init, {
          DB: local.binding,
        }),
    })
    const response = await client.api.events.$post({ json: { title: 'RPC' } })
    if (response.status !== 201) throw new Error('Expected created event')
    const created = await response.json()
    expectTypeOf(created).toEqualTypeOf<EventDetails>()
    const list = await client.api.events.$get()
    if (list.status !== 200) throw new Error('Expected event list')
    expectTypeOf(await list.json()).toEqualTypeOf<{ events: EventSummary[] }>()
    const detail = await client.api.events[':eventId'].$get({
      param: { eventId: created.eventId },
    })
    expect(detail.status).toBe(200)
    const updated = await client.api.events[':eventId'].$patch({
      param: { eventId: created.eventId },
      json: { expectedUpdatedAt: created.updatedAt, title: 'Changed RPC' },
    })
    expect(updated.status).toBe(200)
    const deleted = await client.api.events[':eventId'].$delete({
      param: { eventId: created.eventId },
    })
    expect(deleted.status).toBe(204)
  })
})
