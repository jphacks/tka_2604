import { eq } from 'drizzle-orm'
import { hc } from 'hono/client'
import { afterEach, beforeEach, expect, expectTypeOf, it, vi } from 'vitest'

import { createDb } from '../../src/db/index'
import { constraints, events, users } from '../../src/db/schema'
import app, { type AppType } from '../../src/index'
import { SOLVER_TIMEOUT_MS } from '../../src/integrations/solver'
import { openApiDocument } from '../../src/openapi'
import type { SolveResponse } from '../../src/services/solver/types'
import { testDatabase } from '../helpers/database'
import { seedEventInformation } from '../helpers/event-information'
import { expectJsonResponse } from '../helpers/openapi'

let local: Awaited<ReturnType<typeof testDatabase>>
let db: ReturnType<typeof createDb>
let fixture: Awaited<ReturnType<typeof seedEventInformation>>
const send = vi.fn<typeof fetch>()
beforeEach(async () => {
  local = await testDatabase()
  db = createDb(local.binding)
  await db.insert(users).values([
    { userId: 'demo-owner', passwordHash: 'test-only' },
    { userId: 'other', passwordHash: 'test-only' },
  ])
  fixture = await seedEventInformation(db)
  send.mockReset()
  vi.stubGlobal('fetch', send)
})
afterEach(async () => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  await local?.dispose()
})
function result() {
  return {
    eventId: 'a-event',
    status: 'optimal',
    placements: [
      { bandId: 'a-b1', partId: 'a-p1', order: 0 },
      { bandId: 'a-b2', partId: 'a-p2', order: 0 },
    ],
    unassignedBandIds: [],
    constraintResults: [
      { constraintId: 'a-c1', status: 'met' },
      { constraintId: 'a-c2', status: 'disabled' },
    ],
  }
}
function request(
  body: unknown = { expectedUpdatedAt: fixture.event.updatedAt },
  eventId = 'a-event',
  configured = true,
) {
  return app.request(
    `/api/events/${eventId}/solve`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    {
      DB: local.binding,
      ...(configured
        ? {
            SOLVER_API_URL: 'https://solver.invalid',
            SOLVER_API_TOKEN: 'test-only',
          }
        : {}),
    },
  )
}
async function schedule() {
  const response = await app.request(
    '/api/events/a-event/schedule',
    {},
    { DB: local.binding },
  )
  return response.json()
}
async function contract(response: Response) {
  await expectJsonResponse(
    response,
    openApiDocument.paths['/api/events/{eventId}/solve'].post.responses,
  )
}

it('loads saved constraints and roster, forwards only solver fields, then persists complete placements', async () => {
  send.mockResolvedValue(Response.json({ ...result(), diagnostics: [] }))
  const response = await request()
  expect(response.status).toBe(200)
  await contract(response)
  expect(await response.json()).toMatchObject({
    result: { ...result(), diagnostics: [] },
    schedule: { placements: result().placements, unassignedBandIds: [] },
  })
  expect(await schedule()).toMatchObject({
    placements: result().placements,
    unassignedBandIds: [],
  })
  const [url, init] = send.mock.calls[0]
  expect(url).toBe('https://solver.invalid/solve')
  expect(init).toMatchObject({
    method: 'POST',
    redirect: 'manual',
    headers: { Authorization: 'Bearer test-only' },
  })
  const input: unknown = JSON.parse(
    typeof init?.body === 'string' ? init.body : '',
  )
  expect(input).toEqual({
    eventId: 'a-event',
    parts: [
      { partId: 'a-p1', sortOrder: 0 },
      { partId: 'a-p2', sortOrder: 1 },
    ],
    bands: [{ bandId: 'a-b1' }, { bandId: 'a-b2' }],
    members: [{ memberId: 'a-m1' }],
    memberships: fixture.schedule.memberships,
    constraints: fixture.constraints.constraints.map((row) => row.constraint),
    currentPlacements: fixture.schedule.placements,
  })
})

it('returns partial placements, unchecked and diagnostics, and leaves unassigned bands in the roster', async () => {
  const partial = {
    ...result(),
    status: 'partial',
    placements: result().placements.slice(0, 1),
    unassignedBandIds: ['a-b2'],
    diagnostics: [
      { code: 'example', constraintIds: ['a-c1'], message: 'Confirmed fact' },
    ],
  }
  send.mockResolvedValue(Response.json(partial))
  const response = await request()
  expect(response.status).toBe(200)
  await contract(response)
  expect(await response.json()).toMatchObject({
    result: partial,
    schedule: { bands: fixture.schedule.bands, unassignedBandIds: ['a-b2'] },
  })
})

it.each(['infeasible', 'unknown'])(
  'preserves %s and the current schedule without saving',
  async (status) => {
    const value = {
      eventId: 'a-event',
      status,
      placements: null,
      unassignedBandIds: null,
      constraintResults: null,
    }
    send.mockResolvedValue(Response.json(value))
    const response = await request()
    expect(response.status).toBe(200)
    await contract(response)
    expect(await response.json()).toEqual({ result: value, schedule: null })
    expect(await schedule()).toEqual(fixture.schedule)
  },
)

it.each([
  { ...result(), eventId: 'other-event' },
  { ...result(), placements: result().placements.slice(0, 1) },
  { ...result(), placements: [result().placements[0], result().placements[0]] },
  {
    ...result(),
    placements: [
      { bandId: 'a-b1', partId: 'other-part', order: 0 },
      result().placements[1],
    ],
  },
  {
    ...result(),
    placements: [
      { bandId: 'a-b1', partId: 'a-p1', order: 1 },
      result().placements[1],
    ],
  },
  {
    ...result(),
    placements: [
      result().placements[1],
      { bandId: 'a-b1', partId: 'a-p2', order: 1 },
    ],
  },
  { ...result(), constraintResults: [] },
  {
    ...result(),
    constraintResults: [
      result().constraintResults[0],
      result().constraintResults[0],
    ],
  },
  {
    ...result(),
    constraintResults: result().constraintResults.map((row) => ({
      ...row,
      status: 'met',
    })),
  },
  { ...result(), diagnostics: null },
  {
    ...result(),
    diagnostics: [
      { code: 'example', constraintIds: ['missing'], message: 'Bad ref' },
    ],
  },
  { ...result(), diagnostics: [{ code: 'example', constraintIds: [] }] },
  { ...result(), status: 'partial', unassignedBandIds: ['a-b2'] },
  { ...result(), status: 'unknown' },
])(
  'rejects invalid solver output and keeps current placements: %#',
  async (value) => {
    send.mockResolvedValue(Response.json(value))
    const response = await request()
    expect(response.status).toBe(502)
    await contract(response)
    expect(await response.json()).toMatchObject({
      error: { code: 'solver_invalid_response' },
    })
    expect(await schedule()).toEqual(fixture.schedule)
  },
)

it('detects edits during calculation and refuses to overwrite them', async () => {
  send.mockImplementation(async () => {
    await db
      .update(events)
      .set({ title: 'Edited', updatedAt: '2026-10-17T01:00:00.000Z' })
      .where(eq(events.eventId, 'a-event'))
    return Response.json(result())
  })
  const response = await request()
  expect(response.status).toBe(409)
  await contract(response)
  expect(await schedule()).toMatchObject({
    placements: fixture.schedule.placements,
    updatedAt: '2026-10-17T01:00:00.000Z',
  })
})

it('saves validated constraint changes before solving, preserving provenance and request metadata', async () => {
  const changed = fixture.constraints.constraints.map((row) => ({
    ...row.constraint,
    enabled: false,
  }))
  send.mockImplementation(async () => {
    const rows = await db.select().from(constraints)
    expect(
      rows.every((row) => {
        const value: unknown = JSON.parse(row.constraintJson)
        return (
          typeof value === 'object' &&
          value !== null &&
          'enabled' in value &&
          value.enabled === false
        )
      }),
    ).toBe(true)
    return Response.json({
      ...result(),
      constraintResults: result().constraintResults.map((row) => ({
        ...row,
        status: 'disabled',
      })),
    })
  })
  const response = await request({
    expectedUpdatedAt: fixture.event.updatedAt,
    constraints: changed,
  })
  expect(response.status).toBe(200)
  const rows = await db.select().from(constraints)
  expect(rows.find((row) => row.constraintId === 'a-c1')?.sourceBandId).toBe(
    'a-b1',
  )
  expect(await schedule()).toMatchObject({ bands: fixture.schedule.bands })
})

it('does not call solver when saving constraints fails', async () => {
  await local.binding
    .prepare(
      "CREATE TRIGGER fail_constraint BEFORE INSERT ON constraints BEGIN SELECT RAISE(ABORT, 'test_failure'); END",
    )
    .run()
  const response = await request({
    expectedUpdatedAt: fixture.event.updatedAt,
    constraints: fixture.constraints.constraints.map((row) => row.constraint),
  })
  expect(response.status).toBe(500)
  expect(send).not.toHaveBeenCalled()
  expect(await schedule()).toEqual(fixture.schedule)
})

it('rolls back schedule saving when a later DB statement fails', async () => {
  await local.binding
    .prepare(
      "CREATE TRIGGER fail_order BEFORE INSERT ON band_order BEGIN SELECT RAISE(ABORT, 'test_failure'); END",
    )
    .run()
  send.mockResolvedValue(Response.json(result()))
  const response = await request()
  expect(response.status).toBe(500)
  expect(await schedule()).toEqual(fixture.schedule)
})

it.each([
  {},
  { expectedUpdatedAt: 'bad' },
  { expectedUpdatedAt: '2026-10-17T00:00:00.000Z', constraints: [{}] },
])('rejects invalid input before calling solver', async (body) => {
  const response = await request(body)
  expect(response.status).toBe(422)
  await contract(response)
  expect(send).not.toHaveBeenCalled()
})

it('rejects stale, missing, deleted and other-owner events before calling solver', async () => {
  expect(
    (await request({ expectedUpdatedAt: '2026-10-16T00:00:00.000Z' })).status,
  ).toBe(409)
  await seedEventInformation(db, 'other', 'other')
  for (const id of ['missing', 'other-event'])
    expect((await request(undefined, id)).status).toBe(404)
  await db
    .update(events)
    .set({ isDeleted: true })
    .where(eq(events.eventId, 'a-event'))
  expect((await request()).status).toBe(404)
  expect(send).not.toHaveBeenCalled()
})

it('rejects cross-event constraint references, invalid ranges and empty rosters', async () => {
  for (const change of [
    { targets: { band_id: 'other-band' } },
    { event_id: 'other-event' },
    { params: { position: 2 } },
  ]) {
    const value = {
      ...fixture.constraints.constraints[0].constraint,
      ...change,
    }
    const response = await request({
      expectedUpdatedAt: fixture.event.updatedAt,
      constraints: [value],
    })
    expect(response.status).toBe(422)
  }
  const { createEvent } = await import('../../src/db/events')
  const empty = await createEvent(db, 'demo-owner', { title: 'Empty' })
  expect(
    (
      await request(
        { expectedUpdatedAt: empty.event.updatedAt },
        empty.event.eventId,
      )
    ).status,
  ).toBe(422)
  expect(send).not.toHaveBeenCalled()
})

it('distinguishes configuration, upstream HTTP, network and malformed JSON failures', async () => {
  expect((await request(undefined, 'a-event', false)).status).toBe(503)
  for (const response of [
    new Response('secret upstream details', { status: 500 }),
    new Response('bad json'),
  ]) {
    send.mockResolvedValueOnce(response)
    const received = await request()
    expect(received.status).toBe(502)
    await contract(received)
    expect(JSON.stringify(await received.json())).not.toContain('secret')
  }
  send.mockRejectedValueOnce(new Error('secret network details'))
  expect((await request()).status).toBe(502)
  expect(await schedule()).toEqual(fixture.schedule)
})

it('exposes the solve response through Hono RPC', () => {
  const client = hc<AppType>('http://localhost')
  expectTypeOf(client.api.events[':eventId'].solve.$post).toBeFunction()
  type ResponseBody = Awaited<
    ReturnType<
      Awaited<
        ReturnType<(typeof client.api.events)[':eventId']['solve']['$post']>
      >['json']
    >
  >
  expectTypeOf<
    Extract<ResponseBody, { result: unknown }>
  >().toExtend<SolveResponse>()
})

it('returns 504 for a communication timeout and preserves the schedule', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  send.mockImplementation(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new Error('aborted')),
        )
      }),
  )
  const pending = request()
  await vi.waitFor(() => expect(send).toHaveBeenCalled(), { timeout: 3000 })
  await vi.advanceTimersByTimeAsync(SOLVER_TIMEOUT_MS)
  const response = await pending
  vi.useRealTimers()
  expect(response.status).toBe(504)
  await contract(response)
  expect(await response.json()).toMatchObject({
    error: { code: 'solver_timeout' },
  })
  expect(await schedule()).toEqual(fixture.schedule)
})
it('returns 400 for malformed JSON, without invoking the solver', async () => {
  const response = await app.request(
    '/api/events/a-event/solve',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    },
    { DB: local.binding },
  )
  expect(response.status).toBe(400)
  await contract(response)
  expect(send).not.toHaveBeenCalled()
})
it('keeps saved constraint edits after an upstream failure, and uses a new token for retries', async () => {
  const changed = fixture.constraints.constraints.map((row) => ({
    ...row.constraint,
    enabled: false,
  }))
  send.mockRejectedValueOnce(new Error('network failure'))
  expect(
    (
      await request({
        expectedUpdatedAt: fixture.event.updatedAt,
        constraints: changed,
      })
    ).status,
  ).toBe(502)
  expect(await schedule()).toMatchObject({
    placements: fixture.schedule.placements,
  })
  const rows = await db.select().from(constraints)
  expect(rows.map((row) => JSON.parse(row.constraintJson) as unknown)).toEqual(
    changed,
  )
  expect((await request()).status).toBe(409)
  expect(send).toHaveBeenCalledTimes(1)
})

it('forwards and preserves saved disabled constraints with stale references, and rejects re-enabling them', async () => {
  const disabled = {
    ...fixture.constraints.constraints[1].constraint,
    targets: { band_id: 'deleted-band' },
    params: { position: 99 },
  }
  await db
    .update(constraints)
    .set({ constraintJson: JSON.stringify(disabled) })
    .where(eq(constraints.constraintId, 'a-c2'))
  send.mockResolvedValueOnce(Response.json(result()))
  const response = await request()
  expect(response.status).toBe(200)
  await contract(response)
  const forwarded: unknown = JSON.parse(
    typeof send.mock.calls[0][1]?.body === 'string'
      ? send.mock.calls[0][1].body
      : '',
  )
  expect(forwarded).toMatchObject({
    constraints: [fixture.constraints.constraints[0].constraint, disabled],
  })
  const saved = await db
    .select()
    .from(constraints)
    .where(eq(constraints.constraintId, 'a-c2'))
  expect(JSON.parse(saved[0].constraintJson) as unknown).toEqual(disabled)
  const snapshot = await schedule()
  const [event] = await db
    .select()
    .from(events)
    .where(eq(events.eventId, 'a-event'))
  const rejected = await request({
    expectedUpdatedAt: event.updatedAt,
    constraints: [
      fixture.constraints.constraints[0].constraint,
      { ...disabled, enabled: true },
    ],
  })
  expect(rejected.status).toBe(422)
  await contract(rejected)
  expect(send).toHaveBeenCalledTimes(1)
  expect(await schedule()).toEqual(snapshot)
})
