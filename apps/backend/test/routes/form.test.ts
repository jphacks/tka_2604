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

import { loadEvent } from '../../src/db/events'
import { createDb } from '../../src/db/index'
import {
  bandMembers,
  bands,
  chatMessages,
  events,
  members,
  users,
} from '../../src/db/schema'
import app, { type AppType } from '../../src/index'
import { openApiDocument } from '../../src/openapi'
import * as persistence from '../../src/repositories/form'
import { createFormRoutes } from '../../src/routes/form'
import { formService } from '../../src/services/form/service'
import type { FormRoster, SavedFormBand } from '../../src/services/form/types'
import { testDatabase } from '../helpers/database'
import { seedEventInformation } from '../helpers/event-information'
import { expectJsonResponse } from '../helpers/openapi'

let local: Awaited<ReturnType<typeof testDatabase>>
let db: ReturnType<typeof createDb>
let seed: Awaited<ReturnType<typeof seedEventInformation>>
beforeEach(async () => {
  local = await testDatabase()
  db = createDb(local.binding)
  await db
    .insert(users)
    .values({ userId: 'demo-owner', passwordHash: 'hidden' })
  seed = await seedEventInformation(db)
})
afterEach(async () => {
  await local?.dispose()
})

async function request(suffix = '', method = 'GET', body?: unknown) {
  const response = await app.request(
    `/api/events/${seed.event.eventId}/form${suffix}`,
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
  const contract =
    method === 'GET'
      ? openApiDocument.paths['/api/events/{eventId}/form'].get.responses
      : method === 'POST'
        ? openApiDocument.paths['/api/events/{eventId}/form/bands'].post
            .responses
        : openApiDocument.paths['/api/events/{eventId}/form/bands/{bandId}']
            .patch.responses
  await expectJsonResponse(response, contract)
  return response
}

async function snapshot() {
  return loadEvent(db, 'demo-owner', seed.event.eventId)
}

describe('form HTTP API', () => {
  it('removes the last member only from one band, retains the roster, and reuses the ID', async () => {
    const removed = await request('/bands/a-b1', 'PATCH', {
      expectedUpdatedAt: seed.event.updatedAt,
      memberIds: [],
      newMembers: [],
    })
    expect(removed.status).toBe(200)
    const saved = await removed.json<SavedFormBand>()
    expect(saved.band.memberIds).toEqual([])
    expect(saved.members).toEqual([])
    const roster = await (await request()).json<FormRoster>()
    expect(roster.members).toEqual([{ memberId: 'a-m1', memberName: '田中' }])
    expect(roster.memberships).toEqual([{ bandId: 'a-b2', memberId: 'a-m1' }])
    const second = await request('/bands/a-b2', 'PATCH', {
      expectedUpdatedAt: saved.updatedAt,
      memberIds: [],
      newMembers: [],
    })
    const empty = await second.json<SavedFormBand>()
    const orphanRoster = await (await request()).json<FormRoster>()
    expect(orphanRoster.memberships).toEqual([])
    expect(orphanRoster.members).toEqual(roster.members)
    const readded = await request('/bands/a-b1', 'PATCH', {
      expectedUpdatedAt: empty.updatedAt,
      memberIds: ['a-m1'],
      newMembers: [],
    })
    expect(readded.status).toBe(200)
    expect((await readded.json<SavedFormBand>()).band.memberIds).toEqual([
      'a-m1',
    ])
    expect(await db.select().from(members)).toHaveLength(1)
  })

  it('publicly accesses another owner event without the admin demo owner or exposing private data', async () => {
    await db
      .insert(users)
      .values({ userId: 'other-owner', passwordHash: 'not-public' })
    seed = await seedEventInformation(db, 'other-owner', 'public')
    // The form router works independently of the administrator router.
    const standalone = createFormRoutes(() =>
      formService(persistence.formRepository(db)),
    )
    const direct = await standalone.request(
      `/${seed.event.eventId}/form`,
      {},
      { DB: local.binding },
    )
    expect(direct.status).toBe(200)
    expect(await direct.json()).toEqual(await (await request()).json())
    const created = await request('/bands', 'POST', {
      expectedUpdatedAt: seed.event.updatedAt,
      bandName: '公開登録',
      memberIds: ['public-m1'],
      newMembers: [],
    })
    expect(created.status).toBe(201)
    const body = await created.text()
    for (const privateValue of [
      'passwordHash',
      'requestText',
      'converted',
      'sourceBandId',
      'createdUserId',
      'placements',
      'messages',
    ])
      expect(body).not.toContain(privateValue)
    // This public access does not grant access to the admin event API.
    const admin = await app.request(
      `/api/events/${seed.event.eventId}`,
      {},
      { DB: local.binding },
    )
    expect(admin.status).toBe(404)
  })

  it('rejects malformed input and unknown fields before writing', async () => {
    const before = await snapshot()
    for (const [suffix, method, body] of [
      [
        '/bands',
        'POST',
        {
          expectedUpdatedAt: seed.event.updatedAt,
          bandName: '空',
          memberIds: [],
          newMembers: [],
        },
      ],
      [
        '/bands',
        'POST',
        {
          expectedUpdatedAt: seed.event.updatedAt,
          bandName: '重複',
          memberIds: ['a-m1', 'a-m1'],
          newMembers: [],
        },
      ],
      [
        '/bands/a-b1',
        'PATCH',
        { expectedUpdatedAt: seed.event.updatedAt, memberIds: [] },
      ],
      [
        '/bands/a-b1',
        'PATCH',
        { expectedUpdatedAt: seed.event.updatedAt, memberName: '全体変更' },
      ],
      [
        '/bands/a-b1',
        'PATCH',
        {
          expectedUpdatedAt: seed.event.updatedAt,
          bandName: '不正',
          requestText: '変更不可',
          createdUserId: 'forged',
        },
      ],
    ] as const) {
      const response = await request(suffix, method, body)
      expect(response.status).toBe(422)
      expect(await snapshot()).toEqual(before)
    }
    for (const [body, headers, status] of [
      ['{', { 'Content-Type': 'application/json' }, 400],
      ['{}', {}, 422],
    ] as const) {
      const response = await app.request(
        `/api/events/${seed.event.eventId}/form/bands`,
        { method: 'POST', body, headers },
        { DB: local.binding },
      )
      expect(response.status).toBe(status)
      await expectJsonResponse(
        response,
        openApiDocument.paths['/api/events/{eventId}/form/bands'].post
          .responses,
      )
      expect(await snapshot()).toEqual(before)
    }
  })

  it('returns documented internal errors without exposing DB details or saving partial data', async () => {
    await local.binding
      .prepare(
        "CREATE TRIGGER fail_form_member BEFORE INSERT ON members WHEN NEW.member_name = '失敗' BEGIN SELECT RAISE(ABORT, 'private SQL details'); END",
      )
      .run()
    const before = await snapshot()
    const response = await request('/bands', 'POST', {
      expectedUpdatedAt: seed.event.updatedAt,
      bandName: '保存しない',
      memberIds: [],
      newMembers: [{ memberName: '失敗' }],
    })
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: {
        code: 'internal_error',
        message: 'フォームの処理に失敗しました。',
        details: [],
      },
    })
    expect(await snapshot()).toEqual(before)
    const repository = persistence.formRepository(db)
    vi.spyOn(persistence, 'formRepository').mockReturnValueOnce({
      ...repository,
      get: () => Promise.reject(new Error('private DB details')),
    })
    const get = await request()
    expect(get.status).toBe(500)
    expect(await get.text()).not.toContain('private DB')
  })

  it('shares form request and response types through AppType and supports the standalone form router', async () => {
    const client = hc<AppType>('http://localhost', {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) =>
        app.request(input instanceof URL ? input.toString() : input, init, {
          DB: local.binding,
        }),
    })
    const form = client.api.events[':eventId'].form
    const response = await form.$get({ param: { eventId: seed.event.eventId } })
    if (response.status !== 200) throw new Error('Expected form roster')
    const roster = await response.json()
    expectTypeOf(roster).toEqualTypeOf<FormRoster>()
    const created = await form.bands.$post({
      param: { eventId: seed.event.eventId },
      json: {
        expectedUpdatedAt: roster.updatedAt,
        bandName: 'RPC',
        memberIds: ['a-m1'],
        newMembers: [],
      },
    })
    if (created.status !== 201) throw new Error('Expected created band')
    const saved = await created.json()
    expectTypeOf(saved).toEqualTypeOf<SavedFormBand>()
    const updated = await form.bands[':bandId'].$patch({
      param: { eventId: seed.event.eventId, bandId: saved.band.bandId },
      json: {
        expectedUpdatedAt: saved.updatedAt,
        memberIds: [],
        newMembers: [],
      },
    })
    expect(updated.status).toBe(200)
  })

  it('saves 20 new members within D1 statement limits and exposes them on the admin schedule', async () => {
    const response = await request('/bands', 'POST', {
      expectedUpdatedAt: seed.event.updatedAt,
      bandName: '20人バンド',
      memberIds: [],
      newMembers: Array.from({ length: 20 }, (_, index) => ({
        memberName: `出演者${index}`,
      })),
    })
    expect(response.status).toBe(201)
    const saved = await response.json<SavedFormBand>()
    expect(saved.members).toHaveLength(20)
    const schedule = await app.request(
      `/api/events/${seed.event.eventId}/schedule`,
      {},
      { DB: local.binding },
    )
    expect(schedule.status).toBe(200)
    const body = await schedule.json<{
      bands: { bandId: string }[]
      unassignedBandIds: string[]
      members: { memberId: string }[]
    }>()
    expect(body.bands).toContainEqual(
      expect.objectContaining({ bandId: saved.band.bandId }),
    )
    expect(body.unassignedBandIds).toContain(saved.band.bandId)
    expect(body.members).toHaveLength(21)
  })

  it('returns documented 404 for missing events and does not expose a deletion endpoint', async () => {
    const response = await app.request(
      '/api/events/missing/form',
      {},
      { DB: local.binding },
    )
    expect(response.status).toBe(404)
    await expectJsonResponse(
      response,
      openApiDocument.paths['/api/events/{eventId}/form'].get.responses,
    )
    const before = await snapshot()
    const removed = await app.request(
      `/api/events/${seed.event.eventId}/form/bands/a-b1`,
      { method: 'DELETE' },
      { DB: local.binding },
    )
    expect(removed.status).toBe(404)
    expect(await snapshot()).toEqual(before)
  })

  it('returns only selection data including members without memberships', async () => {
    await db.insert(members).values({
      memberId: 'a-m0',
      eventId: seed.event.eventId,
      memberName: '未所属',
    })
    const response = await request()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      eventId: seed.event.eventId,
      eventTitle: seed.event.title,
      updatedAt: seed.event.updatedAt,
      bands: [
        { bandId: 'a-b1', bandName: 'A' },
        { bandId: 'a-b2', bandName: 'B' },
      ],
      members: [
        { memberId: 'a-m0', memberName: '未所属' },
        { memberId: 'a-m1', memberName: '田中' },
      ],
      memberships: [
        { bandId: 'a-b1', memberId: 'a-m1' },
        { bandId: 'a-b2', memberId: 'a-m1' },
      ],
    })
  })

  it('registers an unassigned band with an existing member and a new same-name person', async () => {
    const response = await request('/bands', 'POST', {
      expectedUpdatedAt: seed.event.updatedAt,
      bandName: ' 新バンド ',
      memberIds: ['a-m1'],
      newMembers: [{ memberName: ' 田中 ' }],
    })
    expect(response.status).toBe(201)
    const body = await response.json<{
      updatedAt: string
      band: { bandId: string; bandName: string; memberIds: string[] }
      members: { memberId: string; memberName: string }[]
    }>()
    expect(body.band.bandName).toBe('新バンド')
    expect(body.band.memberIds).toHaveLength(2)
    expect(body.members.map((m) => m.memberName)).toEqual(['田中', '田中'])
    expect(new Set(body.band.memberIds).size).toBe(2)
    const saved = (await snapshot())!
    expect(saved.bands).toHaveLength(3)
    expect(saved.placements).toEqual(seed.schedule.placements)
    expect(
      saved.bands.find((b) => b.bandId === body.band.bandId),
    ).toMatchObject({ requestText: null, requestStatus: null })
    expect(Date.parse(body.updatedAt)).toBeGreaterThan(
      Date.parse(seed.event.updatedAt),
    )
    expect(saved.event.updatedAt).toBe(body.updatedAt)
  })

  it('replaces a member only in the selected band and preserves wishes, placements and constraints', async () => {
    const before = (await snapshot())!
    const messages = await db.select().from(chatMessages)
    const response = await request('/bands/a-b1', 'PATCH', {
      expectedUpdatedAt: seed.event.updatedAt,
      bandName: '変更後',
      memberIds: [],
      newMembers: [{ memberName: '佐藤' }],
    })
    expect(response.status).toBe(200)
    const after = (await snapshot())!
    expect(after.members).toEqual(expect.arrayContaining(before.members))
    expect(after.memberships).toContainEqual({
      bandId: 'a-b2',
      memberId: 'a-m1',
    })
    expect(after.memberships).not.toContainEqual({
      bandId: 'a-b1',
      memberId: 'a-m1',
    })
    expect(after.bands.find((b) => b.bandId === 'a-b1')).toMatchObject({
      bandName: '変更後',
      requestText: '先頭に固定',
      requestStatus: 'converted',
    })
    expect(after.constraints).toEqual(before.constraints)
    expect(after.placements).toEqual(before.placements)
    expect(await db.select().from(chatMessages)).toEqual(messages)
  })

  it('renames only a band when membership fields are omitted', async () => {
    const before = (await snapshot())!
    const response = await request('/bands/a-b1', 'PATCH', {
      expectedUpdatedAt: seed.event.updatedAt,
      bandName: ' 新しい名前 ',
    })
    expect(response.status).toBe(200)
    const after = (await snapshot())!
    expect(after.memberships).toEqual(before.memberships)
    expect(after.members).toEqual(before.members)
    expect(after.bands.find((b) => b.bandId === 'a-b1')?.bandName).toBe(
      '新しい名前',
    )
  })

  it('rejects missing and cross-event member IDs without partially saving new people', async () => {
    const other = await seedEventInformation(db, 'demo-owner', 'other')
    const before = await snapshot()
    for (const memberId of ['missing', other.schedule.members[0].memberId]) {
      const response = await request('/bands', 'POST', {
        expectedUpdatedAt: seed.event.updatedAt,
        bandName: '不正',
        memberIds: [memberId],
        newMembers: [{ memberName: '保存しない' }],
      })
      expect(response.status).toBe(422)
      expect(await response.json()).toMatchObject({
        error: { code: 'invalid_input', details: [{ path: '/memberIds/0' }] },
      })
      expect(await snapshot()).toEqual(before)
    }
  })

  it('rejects stale saves and missing or foreign band paths without changing data', async () => {
    await seedEventInformation(db, 'demo-owner', 'other')
    const before = await snapshot()
    for (const bandId of ['missing', 'other-b1']) {
      const response = await request(`/bands/${bandId}`, 'PATCH', {
        expectedUpdatedAt: seed.event.updatedAt,
        bandName: '不正',
      })
      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({
        error: { code: 'band_not_found' },
      })
    }
    const response = await request('/bands', 'POST', {
      expectedUpdatedAt: '2026-10-16T00:00:00.000Z',
      bandName: '古い更新',
      memberIds: ['a-m1'],
      newMembers: [],
    })
    expect(response.status).toBe(409)
    expect(await snapshot()).toEqual(before)
  })

  it('does not operate on deleted events', async () => {
    await db
      .update(events)
      .set({ isDeleted: true })
      .where(eq(events.eventId, seed.event.eventId))
    const before = await db.select().from(bands)
    for (const [suffix, method, body] of [
      ['', 'GET', undefined],
      [
        '/bands',
        'POST',
        {
          expectedUpdatedAt: seed.event.updatedAt,
          bandName: '不正',
          memberIds: ['a-m1'],
          newMembers: [],
        },
      ],
      [
        '/bands/a-b1',
        'PATCH',
        { expectedUpdatedAt: seed.event.updatedAt, bandName: '不正' },
      ],
    ] as const) {
      const response = await request(suffix, method, body)
      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({
        error: { code: 'event_not_found' },
      })
    }
    expect(await db.select().from(bands)).toEqual(before)
    expect(await db.select().from(bandMembers)).toHaveLength(2)
  })
})
