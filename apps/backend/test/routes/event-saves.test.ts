import { readFile } from 'node:fs/promises'
import { URL } from 'node:url'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadEvent } from '../../src/db/events'
import { createDb } from '../../src/db/index'
import * as persistence from '../../src/db/save-event'
import app from '../../src/index'
import { openApiDocument } from '../../src/openapi'
import { createAuthenticatedHeaders } from '../helpers/auth'
import { testDatabase } from '../helpers/database'
import { expectJsonResponse } from '../helpers/openapi'

let local: Awaited<ReturnType<typeof testDatabase>>
let sessionHeaders: Record<string, string>
beforeEach(async () => {
  local = await testDatabase()
  const seed = await readFile(
    new URL('../../db/seed.sql', import.meta.url),
    'utf8',
  )
  for (const statement of seed.split(';'))
    if (statement.trim()) await local.binding.prepare(statement).run()
  await local.binding
    .prepare("INSERT INTO users VALUES ('demo-other-owner', 'test-only')")
    .run()
  sessionHeaders = await createAuthenticatedHeaders(local.binding)
})
afterEach(async () => {
  vi.restoreAllMocks()
  await local?.dispose()
})
const snapshot = () =>
  loadEvent(createDb(local.binding), 'demo-owner', 'demo-event')
function request(resource: string, body: unknown, eventId = 'demo-event') {
  return app.request(
    `/api/events/${eventId}/${resource}`,
    {
      method: 'POST',
      headers: { ...sessionHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    { DB: local.binding },
  )
}
async function input() {
  const saved = (await snapshot())!
  return {
    expectedUpdatedAt: saved.event.updatedAt,
    parts: saved.parts.map(({ partId, partName }) => ({ partId, partName })),
    placements: saved.placements,
    unassignedBandIds: saved.bands
      .filter((b) => !saved.placements.some((p) => p.bandId === b.bandId))
      .map((b) => b.bandId),
  }
}

describe('separate schedule and constraint saves', () => {
  it('rejects part and constraint IDs already belonging to another event', async () => {
    const before = (await snapshot())!
    await local.binding
      .prepare(
        "INSERT INTO events(event_id,created_user_id,title) VALUES ('other-event','demo-other-owner','Other')",
      )
      .run()
    await local.binding
      .prepare(
        "INSERT INTO parts(part_id,event_id,sort_order) VALUES ('foreign-part','other-event',0)",
      )
      .run()
    const original = JSON.parse(before.constraints[0].constraintJson) as Record<
      string,
      unknown
    >
    await local.binding
      .prepare(
        "INSERT INTO constraints(constraint_id,event_id,constraint_json) VALUES ('foreign-constraint','other-event',?)",
      )
      .bind(
        JSON.stringify({
          ...original,
          constraint_id: 'foreign-constraint',
          event_id: 'other-event',
        }),
      )
      .run()
    const body = await input()
    expect(
      (
        await request('schedule', {
          ...body,
          parts: [...body.parts, { partId: 'foreign-part', partName: null }],
        })
      ).status,
    ).toBe(422)
    expect(
      (
        await request('constraints', {
          expectedUpdatedAt: before.event.updatedAt,
          constraints: [{ ...original, constraint_id: 'foreign-constraint' }],
        })
      ).status,
    ).toBe(422)
    expect(await snapshot()).toEqual(before)
  })

  it('refuses deletion of a part referenced by a retained constraint', async () => {
    const before = (await snapshot())!
    const original = JSON.parse(before.constraints[0].constraintJson) as Record<
      string,
      unknown
    >
    const constraint = {
      ...original,
      type: 'in_range',
      targets: { band_ids: ['demo-band-a'] },
      params: { kind: 'parts', part_ids: [0] },
    }
    await local.binding
      .prepare(
        "UPDATE constraints SET constraint_json=? WHERE constraint_id='demo-constraint'",
      )
      .bind(JSON.stringify(constraint))
      .run()
    const saved = await snapshot()
    const body = await input()
    expect(
      (
        await request('schedule', {
          ...body,
          parts: body.parts.slice(1),
          placements: [],
          unassignedBandIds: before.bands.map((b) => b.bandId),
        })
      ).status,
    ).toBe(422)
    expect(await snapshot()).toEqual(saved)
  })
  it('saves schedule, then constraints using the returned token and preserves unrelated data', async () => {
    const before = (await snapshot())!
    const schedule = await input()
    schedule.parts.reverse()
    schedule.parts[0].partName = 'Finale'
    schedule.placements = []
    schedule.unassignedBandIds = before.bands.map((b) => b.bandId)
    const first = await request('schedule', schedule)
    expect(first.status).toBe(200)
    await expectJsonResponse(
      first,
      openApiDocument.paths['/api/events/{eventId}/schedule'].post.responses,
    )
    const body = await first.json<{ updatedAt: string; parts: unknown[] }>()
    expect(body.updatedAt).not.toBe(schedule.expectedUpdatedAt)
    const constraint = JSON.parse(
      before.constraints[0].constraintJson,
    ) as Record<string, unknown>
    const stale = await request('constraints', {
      expectedUpdatedAt: schedule.expectedUpdatedAt,
      constraints: [],
    })
    expect(stale.status).toBe(409)
    const second = await request('constraints', {
      expectedUpdatedAt: body.updatedAt,
      constraints: [{ ...constraint, enabled: false }],
    })
    expect(second.status).toBe(200)
    await expectJsonResponse(
      second,
      openApiDocument.paths['/api/events/{eventId}/constraints'].post.responses,
    )
    const after = (await snapshot())!
    expect(after.bands).toEqual(before.bands)
    expect(after.members).toEqual(before.members)
    expect(after.memberships).toEqual(before.memberships)
    expect(after.event.title).toBe(before.event.title)
    expect(after.placements).toEqual([])
    expect(after.constraints[0].sourceBandId).toBe(
      before.constraints[0].sourceBandId,
    )
    expect(JSON.parse(after.constraints[0].constraintJson)).toEqual({
      ...constraint,
      enabled: false,
    })
    const chat = await app.request(
      '/api/events/demo-event/chat',
      { headers: sessionHeaders },
      { DB: local.binding },
    )
    expect((await chat.json<{ messages: unknown[] }>()).messages).toHaveLength(
      2,
    )
  })

  it.each(['missing', 'deleted', 'other'])(
    'rejects %s events without saving',
    async (kind) => {
      const body = await input()
      if (kind !== 'missing')
        await local.binding
          .prepare(
            kind === 'deleted'
              ? "UPDATE events SET is_deleted = 1 WHERE event_id = 'demo-event'"
              : "UPDATE events SET created_user_id = 'demo-other-owner' WHERE event_id = 'demo-event'",
          )
          .run()
      for (const resource of ['schedule', 'constraints']) {
        const response = await request(
          resource,
          resource === 'schedule'
            ? body
            : { expectedUpdatedAt: body.expectedUpdatedAt, constraints: [] },
          kind === 'missing' ? 'missing' : 'demo-event',
        )
        expect(response.status).toBe(404)
      }
    },
  )

  it('rejects missing/duplicate/foreign bands, duplicate positions, duplicate parts and zero parts without writes', async () => {
    const before = await snapshot()
    const body = await input()
    for (const invalid of [
      { ...body, unassignedBandIds: [] },
      {
        ...body,
        unassignedBandIds: [
          ...body.unassignedBandIds,
          body.placements[0].bandId,
        ],
      },
      { ...body, unassignedBandIds: ['foreign'] },
      {
        ...body,
        placements: [
          body.placements[0],
          {
            ...body.placements[1],
            partId: body.placements[0].partId,
            order: body.placements[0].order,
          },
        ],
      },
      { ...body, parts: [body.parts[0], body.parts[0]] },
      { ...body, parts: [] },
      {
        ...body,
        placements: body.placements.map((row) => ({
          ...row,
          order: 1_000_000,
        })),
      },
    ]) {
      const response = await request('schedule', invalid)
      expect(response.status).toBe(422)
      await expectJsonResponse(
        response,
        openApiDocument.paths['/api/events/{eventId}/schedule'].post.responses,
      )
      expect(await snapshot()).toEqual(before)
    }
  })

  it('validates constraint JSON, identity, references and numeric ranges before saving', async () => {
    const before = (await snapshot())!
    const constraint = JSON.parse(
      before.constraints[0].constraintJson,
    ) as Record<string, unknown>
    for (const invalid of [
      {},
      { ...constraint, event_id: 'other' },
      { ...constraint, targets: { band_id: 'foreign' } },
      { ...constraint, params: { position: 99 } },
      { ...constraint, priority: 'high' },
      {
        ...constraint,
        type: 'count',
        targets: { band_ids: ['demo-band-a'] },
        params: { scope: 'per_part', min: 2, max: 1 },
      },
    ]) {
      const response = await request('constraints', {
        expectedUpdatedAt: before.event.updatedAt,
        constraints: [invalid],
      })
      expect(response.status).toBe(422)
      expect(await snapshot()).toEqual(before)
    }
  })

  it('returns 500 on a persistence failure and keeps the previous data', async () => {
    const before = await snapshot()
    vi.spyOn(persistence, 'saveEvent').mockRejectedValueOnce(
      new Error('DB failed'),
    )
    expect((await request('schedule', await input())).status).toBe(500)
    expect(await snapshot()).toEqual(before)
  })

  it('rolls back the event timestamp and all replaced rows when a DB write fails', async () => {
    const before = (await snapshot())!
    await local.binding
      .prepare(
        "CREATE TRIGGER fail_constraint_save BEFORE INSERT ON constraints WHEN NEW.constraint_id = 'fail-write' BEGIN SELECT RAISE(ABORT, 'test failure'); END",
      )
      .run()
    const original = JSON.parse(before.constraints[0].constraintJson) as Record<
      string,
      unknown
    >
    const response = await request('constraints', {
      expectedUpdatedAt: before.event.updatedAt,
      constraints: [{ ...original, constraint_id: 'fail-write' }],
    })
    expect(response.status).toBe(500)
    expect(await snapshot()).toEqual(before)
  })

  it('allows only one of two concurrent saves using the same timestamp', async () => {
    const before = (await snapshot())!
    const body = { expectedUpdatedAt: before.event.updatedAt, constraints: [] }
    const results = await Promise.all([
      request('constraints', body),
      request('constraints', body),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    expect((await snapshot())!.constraints).toEqual([])
  })

  it('rejects invalid JSON and unexpected request fields', async () => {
    const before = await snapshot()
    const malformed = await app.request(
      '/api/events/demo-event/schedule',
      {
        method: 'POST',
        headers: { ...sessionHeaders, 'Content-Type': 'application/json' },
        body: '{',
      },
      { DB: local.binding },
    )
    expect(malformed.status).toBe(400)
    expect(
      (await request('schedule', { ...(await input()), bands: [] })).status,
    ).toBe(422)
    expect(await snapshot()).toEqual(before)
  })
})

it('saves and reloads leading and internal vacancies without compacting placements', async () => {
  const body = await input()
  body.placements = body.placements.map((row, index) => ({
    ...row,
    order: index * 2 + 1,
  }))
  const response = await request('schedule', body)
  expect(response.status).toBe(200)
  expect((await snapshot())!.placements).toEqual(body.placements)
})

it('rejects a vacant placement outside the configured frames without saving', async () => {
  const before = (await snapshot())!
  const body = await input()
  body.placements = body.placements.map((row) => ({
    ...row,
    order: before.parts.find((part) => part.partId === row.partId)!.bandCount,
  }))
  expect((await request('schedule', body)).status).toBe(422)
  expect(await snapshot()).toEqual(before)
})
