import { readFile } from 'node:fs/promises'
import { URL } from 'node:url'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadEvent } from '../../src/db/events'
import { createDb } from '../../src/db/index'
import app from '../../src/index'
import * as integration from '../../src/integrations/solver'
import { openApiDocument } from '../../src/openapi'
import { SolverError } from '../../src/services/solver/errors'
import { testDatabase } from '../helpers/database'
import { expectJsonResponse } from '../helpers/openapi'

let local: Awaited<ReturnType<typeof testDatabase>>
beforeEach(async () => {
  local = await testDatabase()
  const seed = await readFile(
    new URL('../../db/seed.sql', import.meta.url),
    'utf8',
  )
  for (const statement of seed.split(';'))
    if (statement.trim()) await local.binding.prepare(statement).run()
})
afterEach(async () => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  await local?.dispose()
})
const snapshot = () =>
  loadEvent(createDb(local.binding), 'demo-owner', 'demo-event')
function request(body: unknown, eventId = 'demo-event') {
  return app.request(
    `/api/events/${eventId}/solve`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parts: [
          { partId: 'demo-part-2', bandCount: 0 },
          { partId: 'demo-part-1', bandCount: 5 },
        ],
        ...(body as Record<string, unknown>),
      }),
    },
    {
      DB: local.binding,
      SOLVER_API_URL: 'https://solver.invalid',
      SOLVER_API_TOKEN: 'test-token',
    },
  )
}
const solved = () => ({
  eventId: 'demo-event',
  status: 'optimal',
  placements: ['a', 'b', 'c'].map((id, order) => ({
    bandId: `demo-band-${id}`,
    partId: 'demo-part-1',
    order,
  })),
  unassignedBandIds: [],
  constraintResults: [{ constraintId: 'demo-constraint', status: 'met' }],
})

describe('solve from persisted event data', () => {
  it.each([
    undefined,
    [],
    [{ partId: 'demo-part-1', bandCount: 5 }],
    [
      { partId: 'demo-part-1', bandCount: 5 },
      { partId: 'demo-part-1', bandCount: 5 },
    ],
    [
      { partId: 'demo-part-1', bandCount: 5 },
      { partId: 'other-part', bandCount: 5 },
    ],
    ...[undefined, -1, 1.5, '5'].map((bandCount) => [
      { partId: 'demo-part-1', bandCount },
      { partId: 'demo-part-2', bandCount: 5 },
    ]),
  ])(
    'rejects invalid part capacities without calling Solver or saving: %j',
    async (parts) => {
      const before = (await snapshot())!
      const send = vi.fn<typeof fetch>()
      vi.stubGlobal('fetch', send)
      const response = await request({
        expectedUpdatedAt: before.event.updatedAt,
        parts,
      })
      expect(response.status).toBe(422)
      await expectJsonResponse(
        response,
        openApiDocument.paths['/api/events/{eventId}/solve'].post.responses,
      )
      expect(send).not.toHaveBeenCalled()
      expect(await snapshot()).toEqual(before)
    },
  )

  it.each(['soft', 'disabled'])(
    'accepts %s constraints while keeping their original JSON',
    async (kind) => {
      const before = (await snapshot())!
      const original = JSON.parse(
        before.constraints[0].constraintJson,
      ) as Record<string, unknown>
      const constraint =
        kind === 'soft'
          ? {
              ...original,
              hardness: 'soft',
              priority: 'high',
              params: { position: 1 },
            }
          : {
              ...original,
              enabled: false,
              targets: { band_id: 'removed-band' },
              params: { position: 99 },
            }
      await local.binding
        .prepare(
          "UPDATE constraints SET constraint_json = ? WHERE constraint_id = 'demo-constraint'",
        )
        .bind(JSON.stringify(constraint))
        .run()
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(
          Response.json({
            ...solved(),
            status: 'feasible',
            constraintResults: [
              {
                constraintId: 'demo-constraint',
                status: kind === 'soft' ? 'unmet' : 'disabled',
              },
            ],
          }),
        ),
      )
      const response = await request({
        expectedUpdatedAt: before.event.updatedAt,
      })
      expect(response.status).toBe(200)
      expect(
        JSON.parse((await snapshot())!.constraints[0].constraintJson),
      ).toEqual(constraint)
    },
  )

  it('rolls back a failed Solver result write without deleting saved constraints', async () => {
    const before = (await snapshot())!
    await local.binding
      .prepare(
        "CREATE TRIGGER fail_solver_write BEFORE INSERT ON band_order WHEN NEW.band_id = 'demo-band-c' BEGIN SELECT RAISE(ABORT, 'test failure'); END",
      )
      .run()
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(Response.json(solved())),
    )
    expect(
      (await request({ expectedUpdatedAt: before.event.updatedAt })).status,
    ).toBe(500)
    expect(await snapshot()).toEqual(before)
  })
  it.each([
    'solver_upstream_error',
    'solver_invalid_response',
    'solver_timeout',
    'solver_unavailable',
  ] as const)('keeps saved data when %s occurs', async (code) => {
    const before = (await snapshot())!
    vi.spyOn(integration, 'solverClient').mockReturnValueOnce(() =>
      Promise.reject(new SolverError(code)),
    )
    const response = await request({
      expectedUpdatedAt: before.event.updatedAt,
    })
    expect(response.status).toBe(
      code === 'solver_timeout'
        ? 504
        : code === 'solver_unavailable'
          ? 503
          : 502,
    )
    await expectJsonResponse(
      response,
      openApiDocument.paths['/api/events/{eventId}/solve'].post.responses,
    )
    expect(await snapshot()).toEqual(before)
  })

  it.each(['deleted', 'other'])(
    'rejects %s events before contacting Solver',
    async (kind) => {
      const before = (await snapshot())!
      await local.binding
        .prepare("INSERT INTO users VALUES ('other', 'test-only')")
        .run()
      await local.binding
        .prepare(
          kind === 'deleted'
            ? "UPDATE events SET is_deleted=1 WHERE event_id='demo-event'"
            : "UPDATE events SET created_user_id='other' WHERE event_id='demo-event'",
        )
        .run()
      const send = vi.fn<typeof fetch>()
      vi.stubGlobal('fetch', send)
      expect(
        (await request({ expectedUpdatedAt: before.event.updatedAt })).status,
      ).toBe(404)
      expect(send).not.toHaveBeenCalled()
    },
  )
  it('loads schedule and constraints from D1, forwards only the Solver contract and persists the validated result', async () => {
    const before = (await snapshot())!
    const send = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(solved()))
    vi.stubGlobal('fetch', send)
    const response = await request({
      expectedUpdatedAt: before.event.updatedAt,
    })
    expect(response.status).toBe(200)
    await expectJsonResponse(
      response,
      openApiDocument.paths['/api/events/{eventId}/solve'].post.responses,
    )
    expect(send).toHaveBeenCalledTimes(1)
    const [url, options] = send.mock.calls[0]
    expect(url).toBe('https://solver.invalid/solve')
    expect(options).toMatchObject({
      method: 'POST',
      redirect: 'manual',
      headers: { Authorization: 'Bearer test-token' },
    })
    const sentBody = options?.body
    if (typeof sentBody !== 'string') throw new Error('Expected a JSON string')
    const sent: unknown = JSON.parse(sentBody)
    expect(sent).toEqual({
      eventId: 'demo-event',
      parts: before.parts.map(({ partId, sortOrder }) => ({
        partId,
        sortOrder,
        bandCount: sortOrder === 0 ? 5 : 0,
      })),
      bands: before.bands.map(({ bandId }) => ({ bandId })),
      members: before.members.map(({ memberId }) => ({ memberId })),
      memberships: before.memberships,
      constraints: before.constraints.map(
        (row) => JSON.parse(row.constraintJson) as unknown,
      ),
      currentPlacements: before.placements,
    })
    const after = (await snapshot())!
    expect(after.placements).toEqual(solved().placements)
    expect(after.constraints).toEqual(before.constraints)
    expect(after.bands).toEqual(before.bands)
    expect(after.event.updatedAt).not.toBe(before.event.updatedAt)
  })

  it('uses data saved by the two independent POST APIs', async () => {
    const before = (await snapshot())!
    async function save(resource: string, body: unknown) {
      const response = await app.request(
        `/api/events/demo-event/${resource}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        { DB: local.binding },
      )
      expect(response.status).toBe(200)
      return response.json<{ updatedAt: string }>()
    }
    const saved = await save('schedule', {
      expectedUpdatedAt: before.event.updatedAt,
      parts: before.parts.map(({ partId, partName }) => ({ partId, partName })),
      placements: [],
      unassignedBandIds: before.bands.map((b) => b.bandId),
    })
    const updated = await save('constraints', {
      expectedUpdatedAt: saved.updatedAt,
      constraints: [],
    })
    const result = { ...solved(), constraintResults: [] }
    const send = vi.fn<typeof fetch>().mockResolvedValue(Response.json(result))
    vi.stubGlobal('fetch', send)
    expect(
      (await request({ expectedUpdatedAt: updated.updatedAt })).status,
    ).toBe(200)
    const sentBody = send.mock.calls[0][1]?.body
    if (typeof sentBody !== 'string') throw new Error('Expected a JSON string')
    const sent: unknown = JSON.parse(sentBody)
    expect(sent).toMatchObject({ constraints: [], currentPlacements: [] })
  })

  it.each(['infeasible', 'unknown'])(
    'preserves the current schedule on %s',
    async (status) => {
      const before = (await snapshot())!
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(
          Response.json({
            eventId: 'demo-event',
            status,
            placements: null,
            unassignedBandIds: null,
            constraintResults: null,
            diagnostics: [],
          }),
        ),
      )
      const response = await request({
        expectedUpdatedAt: before.event.updatedAt,
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        schedule: null,
        result: { status },
      })
      expect(await snapshot()).toEqual(before)
    },
  )

  it('saves partial placements without creating a dummy part', async () => {
    const before = (await snapshot())!
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          ...solved(),
          status: 'partial',
          placements: [solved().placements[0]],
          unassignedBandIds: ['demo-band-b', 'demo-band-c'],
        }),
      ),
    )
    expect(
      (await request({ expectedUpdatedAt: before.event.updatedAt })).status,
    ).toBe(200)
    expect((await snapshot())!.parts).toEqual(before.parts)
    expect((await snapshot())!.placements).toEqual([solved().placements[0]])
  })

  it.each([
    { ...solved(), eventId: 'other' },
    { ...solved(), placements: solved().placements.slice(0, 2) },
    {
      ...solved(),
      placements: [
        solved().placements[1],
        solved().placements[1],
        solved().placements[2],
      ],
    },
    { ...solved(), constraintResults: [] },
    {
      ...solved(),
      constraintResults: [{ constraintId: 'demo-constraint', status: 'unmet' }],
    },
    {
      ...solved(),
      placements: [...solved().placements]
        .reverse()
        .map((p, order) => ({ ...p, order })),
    },
    {
      ...solved(),
      diagnostics: [
        { code: 'test', message: 'test', constraintIds: ['foreign'] },
      ],
    },
  ])(
    'rejects an invalid response and preserves saved data: %j',
    async (result) => {
      const before = (await snapshot())!
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(Response.json(result)),
      )
      const response = await request({
        expectedUpdatedAt: before.event.updatedAt,
      })
      expect(response.status).toBe(502)
      await expectJsonResponse(
        response,
        openApiDocument.paths['/api/events/{eventId}/solve'].post.responses,
      )
      expect(await snapshot()).toEqual(before)
    },
  )

  it('rejects stale and unsaved client data before contacting Solver', async () => {
    const before = (await snapshot())!
    const send = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', send)
    expect(
      (await request({ expectedUpdatedAt: '2000-01-01T00:00:00.000Z' })).status,
    ).toBe(409)
    expect(
      (
        await request({
          expectedUpdatedAt: before.event.updatedAt,
          constraints: [],
        })
      ).status,
    ).toBe(422)
    expect(
      (await request({ expectedUpdatedAt: before.event.updatedAt }, 'missing'))
        .status,
    ).toBe(404)
    expect(send).not.toHaveBeenCalled()
    expect(await snapshot()).toEqual(before)
  })

  it('does not overwrite a concurrent edit while Solver is running', async () => {
    const before = (await snapshot())!
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(async () => {
        const response = await app.request(
          '/api/events/demo-event/constraints',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              expectedUpdatedAt: before.event.updatedAt,
              constraints: [],
            }),
          },
          { DB: local.binding },
        )
        expect(response.status).toBe(200)
        return Response.json(solved())
      }),
    )
    expect(
      (await request({ expectedUpdatedAt: before.event.updatedAt })).status,
    ).toBe(409)
    const after = (await snapshot())!
    expect(after.constraints).toEqual([])
    expect(after.placements).toEqual(before.placements)
  })
})
