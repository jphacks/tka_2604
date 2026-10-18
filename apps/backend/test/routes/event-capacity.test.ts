import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { loadEvent } from '../../src/db/events'
import { createDb } from '../../src/db/index'
import { users } from '../../src/db/schema'
import app from '../../src/index'
import { openApiDocument } from '../../src/openapi'
import { testDatabase } from '../helpers/database'
import { expectJsonResponse } from '../helpers/openapi'

let local: Awaited<ReturnType<typeof testDatabase>>
beforeEach(async () => {
  local = await testDatabase()
  await createDb(local.binding)
    .insert(users)
    .values({ userId: 'demo-owner', passwordHash: 'test-only' })
})
afterEach(async () => {
  vi.restoreAllMocks()
  await local?.dispose()
})
function request(path: string, method = 'GET', body?: unknown) {
  return app.request(
    `/api/events${path}`,
    {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    { DB: local.binding },
  )
}

it('creates configured empty parts, saves a count-only edit and restores it', async () => {
  const created = await request('', 'POST', {
    title: 'Live',
    bandCounts: [2, 5, 3],
  })
  expect(created.status).toBe(201)
  const event = await created.json<{ eventId: string; updatedAt: string }>()
  const before = (await loadEvent(
    createDb(local.binding),
    'demo-owner',
    event.eventId,
  ))!
  expect(before.parts.map((part) => part.bandCount)).toEqual([2, 5, 3])
  const response = await request(`/${event.eventId}/schedule`, 'POST', {
    expectedUpdatedAt: event.updatedAt,
    parts: before.parts.map((part, index) => ({
      partId: part.partId,
      partName: part.partName,
      bandCount: index + 4,
    })),
    placements: [],
    unassignedBandIds: [],
  })
  expect(response.status).toBe(200)
  await expectJsonResponse(
    response,
    openApiDocument.paths['/api/events/{eventId}/schedule'].post.responses,
  )
  const restored = await request(`/${event.eventId}/schedule`)
  expect(
    (await restored.json<{ parts: { bandCount: number }[] }>()).parts.map(
      (part) => part.bandCount,
    ),
  ).toEqual([4, 5, 6])
  const saved = await loadEvent(
    createDb(local.binding),
    'demo-owner',
    event.eventId,
  )
  expect(saved?.bands).toEqual(before.bands)
  expect(saved?.constraints).toEqual(before.constraints)
  expect(
    (
      await request(`/${event.eventId}/schedule`, 'POST', {
        expectedUpdatedAt: event.updatedAt,
        parts: [{ partId: before.parts[0].partId, bandCount: 1 }],
        placements: [],
        unassignedBandIds: [],
      })
    ).status,
  ).toBe(409)
  expect(
    await loadEvent(createDb(local.binding), 'demo-owner', event.eventId),
  ).toEqual(saved)
})

it.each(
  [[], [0], [-1], [1.5], [21], Array<number>(9).fill(4)].map((counts) => [
    counts,
  ]),
)(
  'rejects invalid creation counts %j without creating data',
  async (bandCounts) => {
    expect(
      (await request('', 'POST', { title: 'Invalid', bandCounts })).status,
    ).toBe(422)
    expect(await (await request('')).json()).toEqual({ events: [] })
  },
)
