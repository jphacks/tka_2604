import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createEvent, loadEvent } from '../../src/db/events'
import { createDb } from '../../src/db/index'
import { type EventChanges, saveEvent } from '../../src/db/save-event'
import { bands, constraints, users } from '../../src/db/schema'
import { testDatabase } from '../helpers/database'

let local: Awaited<ReturnType<typeof testDatabase>>
let db: ReturnType<typeof createDb>
let saved: Awaited<ReturnType<typeof createEvent>>
let input: EventChanges
beforeEach(async () => {
  local = await testDatabase()
  db = createDb(local.binding)
  await db
    .insert(users)
    .values({ userId: 'owner', passwordHash: 'test-only-not-a-login' })
  saved = await createEvent(db, 'owner', { title: 'Live' })
  input = {
    title: 'Edited',
    status: 'adjusting',
    date: null,
    venue: null,
    description: null,
    bands: [
      { bandId: 'b1', bandName: 'A' },
      { bandId: 'b2', bandName: 'B' },
    ],
    members: [{ memberId: 'm1', memberName: 'Member' }],
    memberships: [
      { bandId: 'b1', memberId: 'm1' },
      { bandId: 'b2', memberId: 'm1' },
    ],
    parts: [
      { partId: saved.parts[0].partId, partName: '前半' },
      { partId: 'p2', partName: null },
    ],
    placements: [
      { bandId: 'b1', partId: saved.parts[0].partId, order: 0 },
      { bandId: 'b2', partId: saved.parts[0].partId, order: 1 },
    ],
    constraints: [
      {
        constraintId: 'c1',
        constraintJson: JSON.stringify({
          schema_version: '1.0.0',
          constraint_id: 'c1',
          event_id: saved.event.eventId,
          type: 'at_position',
          hardness: 'hard',
          priority: null,
          enabled: true,
          targets: { band_id: 'b1' },
          params: { position: 0 },
        }),
      },
    ],
  }
})
afterEach(async () => {
  await local?.dispose()
})
const save = () =>
  saveEvent(db, 'owner', saved.event.eventId, saved.event.updatedAt, input)

describe('manual event-wide save', () => {
  it('round trips the whole event with empty parts and free band counts', async () => {
    const result = await save()
    expect(result.event.title).toBe('Edited')
    expect(result.bands).toHaveLength(2)
    expect(result.memberships).toHaveLength(2)
    expect(result.parts).toHaveLength(2)
    expect(result.placements).toHaveLength(2)
    expect(result.constraints[0].constraintJson).toBe(
      input.constraints[0].constraintJson,
    )
  })

  it('unassigns bands and removes membership without deleting their records or constraints', async () => {
    saved = await save()
    input.placements = []
    input.memberships = []
    const result = await save()
    expect(result.bands).toHaveLength(2)
    expect(result.members).toHaveLength(1)
    expect(result.placements).toEqual([])
    expect(result.constraints).toHaveLength(1)
  })

  it('swaps occupied positions and parts atomically without rewriting constraints', async () => {
    saved = await save()
    input.placements.reverse()
    input.placements = input.placements.map((item, index) => ({
      ...item,
      order: index,
    }))
    input.parts.reverse()
    const result = await save()
    expect(result.parts[0].partId).toBe('p2')
    expect(result.placements.map((item) => item.bandId)).toEqual(['b2', 'b1'])
    expect(result.constraints).toEqual(saved.constraints)
  })

  it('rejects stale saves, including two simultaneous saves from the same version', async () => {
    const results = await Promise.allSettled([save(), save()])
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1)
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1)
    await expect(save()).rejects.toThrow('event_save_conflict')
  })

  it('rolls back all changes when a later placement violates a DB constraint', async () => {
    saved = await save()
    input.title = 'Must not persist'
    input.placements[1].order = 0
    await expect(save()).rejects.toThrow()
    expect(await loadEvent(db, 'owner', saved.event.eventId)).toEqual(saved)
  })

  it('rejects zero parts, removal of band records and writes by another owner', async () => {
    await expect(
      saveEvent(db, 'other', saved.event.eventId, saved.event.updatedAt, input),
    ).rejects.toThrow('event_not_found')
    saved = await save()
    input.bands = []
    await expect(save()).rejects.toThrow('unassign_band_instead_of_deleting')
    input.bands = saved.bands
    input.parts = []
    await expect(save()).rejects.toThrow('at_least_one_part_required')
  })
})

it('saves a 40-band event with 280 distinct members without exceeding parameter limits', async () => {
  input.bands = Array.from({ length: 40 }, (_, index) => ({
    bandId: `band-${index}`,
    bandName: `Band ${index}`,
  }))
  input.members = Array.from({ length: 280 }, (_, index) => ({
    memberId: `member-${index}`,
    memberName: `Member ${index}`,
  }))
  input.memberships = input.members.map((member, index) => ({
    memberId: member.memberId,
    bandId: input.bands[Math.floor(index / 7)].bandId,
  }))
  input.placements = input.bands.map((band, index) => ({
    bandId: band.bandId,
    partId: input.parts[index < 20 ? 0 : 1].partId,
    order: index % 20,
  }))
  input.constraints = []
  const result = await save()
  expect(result.bands).toHaveLength(40)
  expect(result.memberships).toHaveLength(280)
  expect(result.placements).toHaveLength(40)
})

it('rejects IDs belonging to another event without changing that event', async () => {
  const other = await createEvent(db, 'owner', { title: 'Other' })
  input.parts[1].partId = other.parts[0].partId
  await expect(save()).rejects.toThrow()
  expect(await loadEvent(db, 'owner', other.event.eventId)).toEqual(other)
  expect(await loadEvent(db, 'owner', saved.event.eventId)).toEqual(saved)
})

it('prevents deleting a part referenced by a remaining constraint', async () => {
  input.constraints = [
    {
      constraintId: 'part-constraint',
      constraintJson: JSON.stringify({
        schema_version: '1.0.0',
        constraint_id: 'part-constraint',
        event_id: saved.event.eventId,
        type: 'in_range',
        hardness: 'hard',
        priority: null,
        enabled: true,
        targets: { band_ids: ['b1'] },
        params: { kind: 'parts', part_ids: [1] },
      }),
    },
  ]
  saved = await save()
  input.parts.pop()
  await expect(save()).rejects.toThrow('part_is_referenced_by_constraint')
  expect(await loadEvent(db, 'owner', saved.event.eventId)).toEqual(saved)
})

it('deletes an empty unreferenced part in the event-wide save and compacts its order', async () => {
  input.parts.push({ partId: 'p3', partName: null })
  saved = await save()
  input.parts = input.parts.filter((part) => part.partId !== 'p2')
  const result = await save()
  expect(result.parts.map((part) => [part.partId, part.sortOrder])).toEqual([
    [saved.parts[0].partId, 0],
    ['p3', 1],
  ])
  expect(result.placements).toEqual(saved.placements)
  expect(result.constraints).toEqual(saved.constraints)
  expect(result.event.updatedAt).not.toBe(saved.event.updatedAt)
})

it('rejects deleting a part from a stale screen after another screen saves its partName', async () => {
  saved = await save()
  input.parts[1].partName = 'Saved in another screen'
  const latest = await save()
  input.parts.pop()
  await expect(save()).rejects.toThrow('event_save_conflict')
  expect(await loadEvent(db, 'owner', saved.event.eventId)).toEqual(latest)
})

it('keeps server-managed wishes and provenance through event-wide replacement', async () => {
  saved = await save()
  await db
    .update(bands)
    .set({
      description: 'メロコア',
      requestText: '第2部を希望',
      requestStatus: 'converted',
    })
    .where(eq(bands.bandId, 'b1'))
  await db
    .update(constraints)
    .set({ sourceBandId: 'b1' })
    .where(eq(constraints.constraintId, 'c1'))
  const forgedBand = {
    ...input.bands[0],
    description: 'Must not replace',
    requestText: 'Must not replace',
    requestStatus: 'failed' as const,
  }
  input.bands[0] = forgedBand
  const forgedConstraint = { ...input.constraints[0], sourceBandId: 'b2' }
  input.constraints[0] = forgedConstraint
  const result = await save()
  expect(result.bands.find((band) => band.bandId === 'b1')).toMatchObject({
    description: 'メロコア',
    requestText: '第2部を希望',
    requestStatus: 'converted',
  })
  expect(result.constraints[0].sourceBandId).toBe('b1')
  expect(result.parts[0].partName).toBe('前半')
  expect(result.parts[1].partName).toBeNull()
  expect(await loadEvent(db, 'owner', saved.event.eventId)).toEqual(result)
})
