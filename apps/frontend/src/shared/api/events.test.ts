import type { InferRequestType } from 'hono/client'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import { type ApiClient, createApiClient } from './client'
import { createEventsApi } from './events'

const details = {
  eventId: 'event-1',
  title: 'ライブ',
  status: 'planning',
  date: null,
  venue: null,
  description: null,
  createdAt: '2026-10-17T00:00:00.000Z',
  updatedAt: '2026-10-17T00:00:00.000Z',
}
function setup(responses: Response[]) {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(() => {
    const response = responses.shift()
    if (!response) throw new Error('Unexpected request')
    return Promise.resolve(response)
  })
  return {
    api: createEventsApi(createApiClient('http://localhost', fetcher)),
    fetcher,
  }
}
function requestBody(init?: RequestInit) {
  if (typeof init?.body !== 'string') throw new Error('Expected JSON body')
  return init.body
}
const json = (body: unknown, status = 200) => Response.json(body, { status })

describe('events RPC adapter', () => {
  it('infers request fields from the backend validator', () => {
    type CreateInput = InferRequestType<
      ApiClient['api']['events']['$post']
    >['json']
    expectTypeOf<CreateInput['title']>().toEqualTypeOf<string>()
    type UpdateInput = InferRequestType<
      ApiClient['api']['events'][':eventId']['$patch']
    >['json']
    expectTypeOf<UpdateInput['expectedUpdatedAt']>().toEqualTypeOf<string>()
  })
  it('maps the list without inventing a form response count', async () => {
    const { api } = setup([
      json({
        events: [
          {
            ...details,
            performanceCount: 2,
            assignedCount: 1,
            partCount: 2,
            responseCount: null,
          },
        ],
      }),
    ])
    expect(await api.listEvents()).toEqual([
      {
        id: 'event-1',
        name: 'ライブ',
        date: '',
        venue: '',
        description: '',
        status: 'planning',
        updatedAt: details.updatedAt,
        performanceCount: 2,
        assignedCount: 1,
        partCount: 2,
        responseCount: null,
      },
    ])
  })
  it('creates events with nullable fields and reads the returned ID', async () => {
    const { api, fetcher } = setup([json(details, 201)])
    expect(
      (
        await api.createEvent({
          name: 'ライブ',
          date: '',
          venue: '',
          description: '',
        })
      ).id,
    ).toBe('event-1')
    expect(
      JSON.parse(requestBody(fetcher.mock.calls[0][1])) as unknown,
    ).toEqual({
      title: 'ライブ',
      bandCounts: [4],
      date: null,
      venue: null,
      description: null,
    })
  })
  it('keeps the displayed revision when saving and reports a conflict', async () => {
    const { api, fetcher } = setup([
      json(
        {
          error: {
            code: 'update_conflict',
            message: 'イベントが更新されました。',
            details: [],
          },
        },
        409,
      ),
      json({
        ...details,
        title: '更新',
        updatedAt: '2026-10-17T00:00:01.000Z',
      }),
    ])
    const patch = { name: '更新', updatedAt: details.updatedAt }
    await expect(api.updateDetails('event-1', patch)).rejects.toThrow(
      'イベントが更新されました。',
    )
    expect(
      JSON.parse(requestBody(fetcher.mock.calls[0][1])) as unknown,
    ).toEqual({
      title: '更新',
      expectedUpdatedAt: details.updatedAt,
    })
    expect((await api.updateDetails('event-1', patch)).name).toBe('更新')
  })
  it('requires a revision instead of fetching a newer one before saving', async () => {
    const { api, fetcher } = setup([])
    await expect(
      api.updateDetails('event-1', { name: '更新' }),
    ).rejects.toThrow('再取得')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('loads parts, memberships and constraint provenance without changing IDs', async () => {
    const constraint = {
      schema_version: '1.0.0',
      constraint_id: 'c1',
      event_id: 'event-1',
      type: 'at_position',
      hardness: 'hard',
      priority: null,
      enabled: true,
      targets: { band_id: 'b1' },
      params: { position: 0 },
    }
    const { api } = setup([
      json(details),
      json({
        eventId: 'event-1',
        updatedAt: details.updatedAt,
        bands: [
          {
            bandId: 'b1',
            bandName: 'A',
            requestText: '最初',
            requestStatus: 'converted',
          },
        ],
        members: [
          { memberId: 'm1', memberName: '同名' },
          { memberId: 'm2', memberName: '同名' },
        ],
        memberships: [{ bandId: 'b1', memberId: 'm1' }],
        parts: [
          { partId: 'p2', partName: '後半', bandCount: 4, sortOrder: 1 },
          { partId: 'p1', partName: '前半', bandCount: 6, sortOrder: 0 },
        ],
        placements: [{ bandId: 'b1', partId: 'p1', order: 2 }],
        unassignedBandIds: [],
      }),
      json({
        eventId: 'event-1',
        updatedAt: details.updatedAt,
        constraints: [{ constraint, sourceBandId: 'b1' }],
      }),
      json({
        messages: [
          {
            messageId: 'chat-1',
            role: 'user',
            text: '希望',
            replyToMessageId: null,
          },
        ],
      }),
    ])
    // Chat history has its own sequence; it does not participate in updatedAt.
    const event = await api.getEvent('event-1')
    expect(event.sections).toEqual([
      { id: 'p1', name: '前半', slots: [null, null, 'b1', null, null, null] },
      { id: 'p2', name: '後半', slots: [null, null, null, null] },
    ])
    expect(event.performances[0]).toMatchObject({
      id: 'b1',
      memberIds: ['m1'],
      requestText: '最初',
      requestStatus: 'converted',
    })
    expect(event.constraints).toEqual([constraint])
    expect(event.constraintSources).toEqual({ c1: 'b1' })
    expect(event.members).toHaveLength(2)
    expect(event.messages).toEqual([
      { id: 'chat-1', role: 'user', text: '希望', replyToMessageId: null },
    ])
  })
  it('rejects inconsistent revisions instead of mixing snapshots', async () => {
    const { api } = setup([
      json(details),
      json({ eventId: 'event-1', updatedAt: 'newer' }),
      json({ eventId: 'event-1', updatedAt: details.updatedAt }),
      json({ messages: [] }),
    ])
    await expect(api.getEvent('event-1')).rejects.toThrow('再取得')
  })
  it('passes cancellation to all reads and rejects server failures', async () => {
    const { api, fetcher } = setup([json({ error: 'upstream' }, 503)])
    const signal = new AbortController().signal
    await expect(api.listEvents(signal)).rejects.toThrow('503')
    expect(fetcher.mock.calls[0][1]?.signal).toBe(signal)
  })
  it('handles a successful deletion without reading JSON', async () => {
    const { api } = setup([new Response(null, { status: 204 })])
    await expect(api.deleteEvent('event-1')).resolves.toBeUndefined()
  })
})

it('saves parts and placements without closing vacant slots with the displayed revision, then constraints with the new revision', async () => {
  const savedAt = '2026-10-17T00:00:00.001Z'
  const { api, fetcher } = setup([
    json({ updatedAt: savedAt }),
    json({ updatedAt: '2026-10-17T00:00:00.002Z', constraints: [] }),
  ])
  const event = {
    id: 'event-1',
    name: 'Live',
    updatedAt: details.updatedAt,
    members: [],
    performances: [],
    messages: [],
    constraints: [],
    constraintSources: { removed: 'band-1' },
    sections: [
      { id: 'part-1', name: '前半', slots: ['b2', null, 'b1', null] },
      { id: 'part-2', name: null, slots: [null, null, null, null] },
    ],
    unassigned: ['b3'],
  }
  const saved = await api.saveSchedule(event)
  expect(JSON.parse(requestBody(fetcher.mock.calls[0][1])) as unknown).toEqual({
    expectedUpdatedAt: details.updatedAt,
    parts: [
      { partId: 'part-1', partName: '前半', bandCount: 4 },
      { partId: 'part-2', partName: null, bandCount: 4 },
    ],
    placements: [
      { bandId: 'b2', partId: 'part-1', order: 0 },
      { bandId: 'b1', partId: 'part-1', order: 2 },
    ],
    unassignedBandIds: ['b3'],
  })
  await api.saveConstraints({ ...event, updatedAt: saved.updatedAt })
  expect(JSON.parse(requestBody(fetcher.mock.calls[1][1])) as unknown).toEqual({
    expectedUpdatedAt: savedAt,
    constraints: [],
  })
  expect(fetcher.mock.calls[0][0]).toBe(
    'http://localhost/api/events/event-1/schedule',
  )
})

it('does not retry a conflicting save with a freshly fetched revision', async () => {
  const { api, fetcher } = setup([
    json(
      {
        error: { code: 'event_save_conflict', message: '再取得してください。' },
      },
      409,
    ),
  ])
  const event = {
    id: 'event-1',
    name: 'Live',
    updatedAt: details.updatedAt,
    sections: [],
    constraints: [],
    members: [],
    performances: [],
    messages: [],
    unassigned: [],
  }
  await expect(api.saveConstraints(event)).rejects.toThrow('再取得')
  expect(event.updatedAt).toBe(details.updatedAt)
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('deletes only the selected band using the revision captured for confirmation', async () => {
  const saved = {
    eventId: 'event-1',
    bandId: 'band-1',
    updatedAt: '2026-10-18T00:01:00.000Z',
  }
  const { api, fetcher } = setup([json(saved)])
  await expect(
    api.deleteBand('event-1', 'band-1', details.updatedAt),
  ).resolves.toEqual(saved)
  expect(fetcher.mock.calls[0][0]).toBe(
    'http://localhost/api/events/event-1/bands/band-1',
  )
  expect(fetcher.mock.calls[0][1]?.method).toBe('DELETE')
  expect(JSON.parse(requestBody(fetcher.mock.calls[0][1])) as unknown).toEqual({
    expectedUpdatedAt: details.updatedAt,
  })
})
it('reports delete conflicts without presenting the deletion as successful', async () => {
  const { api } = setup([
    json(
      {
        error: {
          code: 'event_save_conflict',
          message: 'conflict',
          details: [],
        },
      },
      409,
    ),
  ])
  await expect(
    api.deleteBand('event-1', 'band-1', details.updatedAt),
  ).rejects.toThrow('対象を確認してから削除')
})
