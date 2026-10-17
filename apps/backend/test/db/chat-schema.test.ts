import { afterEach, beforeEach, expect, it } from 'vitest'

import { createEvent } from '../../src/db/events'
import { createDb } from '../../src/db/index'
import { bands, constraints, parts, users } from '../../src/db/schema'
import { testDatabase } from '../helpers/database'

let local: Awaited<ReturnType<typeof testDatabase>>
let db: ReturnType<typeof createDb>
let eventId: string
let otherId: string
const run = (query: string, ...values: (string | number | null)[]) =>
  local.binding
    .prepare(query)
    .bind(...values)
    .run()

beforeEach(async () => {
  local = await testDatabase()
  db = createDb(local.binding)
  await db.insert(users).values({ userId: 'owner', passwordHash: 'test-only' })
  eventId = (await createEvent(db, 'owner', { title: 'Live' })).event.eventId
  otherId = (await createEvent(db, 'owner', { title: 'Other' })).event.eventId
  await db.insert(bands).values([
    { bandId: 'b1', eventId, bandName: 'A' },
    { bandId: 'b2', eventId: otherId, bandName: 'B' },
  ])
})
afterEach(async () => {
  await local?.dispose()
})

it('round trips wish states and permits no wish without inventing a default', async () => {
  expect((await db.select().from(bands))[0]).toMatchObject({
    requestText: null,
    requestStatus: null,
  })
  for (const status of [
    'pending',
    'needs_confirmation',
    'converted',
    'failed',
  ]) {
    await run(
      'UPDATE bands SET request_text = ?, request_status = ? WHERE band_id = ?',
      '第2部を希望',
      status,
      'b1',
    )
    expect((await db.select().from(bands))[0]).toMatchObject({
      requestText: '第2部を希望',
      requestStatus: status,
    })
  }
  for (const [text, status] of [
    [null, 'pending'],
    ['希望', null],
    ['希望', 'invalid'],
    ['   ', 'pending'],
  ]) {
    await expect(
      run(
        'UPDATE bands SET request_text = ?, request_status = ? WHERE band_id = ?',
        text,
        status,
        'b1',
      ),
    ).rejects.toThrow()
  }
})

it('preserves nullable part names', async () => {
  const rows = await db.select().from(parts)
  expect(rows[0]).toHaveProperty('partName', null)
  await run(
    'UPDATE parts SET part_name = ? WHERE event_id = ?',
    '昼の部',
    eventId,
  )
  expect(
    (await db.select().from(parts)).find((p) => p.eventId === eventId),
  ).toHaveProperty('partName', '昼の部')
})

it('keeps constraint provenance in the same event on insert and update', async () => {
  const json = JSON.stringify({ constraint_id: 'c1', event_id: eventId })
  await run(
    'INSERT INTO constraints (constraint_id, event_id, constraint_json, source_band_id) VALUES (?, ?, ?, ?)',
    'c1',
    eventId,
    json,
    'b1',
  )
  expect((await db.select().from(constraints))[0]).toHaveProperty(
    'sourceBandId',
    'b1',
  )
  for (const bandId of ['b2', 'missing']) {
    await expect(
      run(
        'UPDATE constraints SET source_band_id = ? WHERE constraint_id = ?',
        bandId,
        'c1',
      ),
    ).rejects.toThrow()
    await expect(
      run(
        'INSERT INTO constraints (constraint_id, event_id, constraint_json, source_band_id) VALUES (?, ?, ?, ?)',
        'bad',
        eventId,
        JSON.stringify({ constraint_id: 'bad', event_id: eventId }),
        bandId,
      ),
    ).rejects.toThrow()
  }
})

const message = (
  id: string,
  event: string,
  seq: number,
  role: string,
  reply: string | null = null,
) =>
  run(
    'INSERT INTO chat_messages (message_id, event_id, seq, role, text, reply_to_message_id) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    event,
    seq,
    role,
    id,
    reply,
  )

it('stores ordered per-event messages and rejects duplicate sequence or replies', async () => {
  await message('u1', eventId, 0, 'user')
  await message('a1', eventId, 1, 'assistant', 'u1')
  await message('u2', otherId, 0, 'user')
  await expect(message('duplicate-seq', eventId, 1, 'user')).rejects.toThrow()
  await expect(
    message('duplicate-reply', eventId, 2, 'assistant', 'u1'),
  ).rejects.toThrow()
  const { results } = await local.binding
    .prepare('SELECT * FROM chat_messages WHERE event_id = ? ORDER BY seq')
    .bind(eventId)
    .all()
  expect(results.map((row) => row.message_id)).toEqual(['u1', 'a1'])
  expect(results[0].created_at).toEqual(expect.any(String))
})

it('rejects invalid chat roles, sequences and references, including updates', async () => {
  await message('u1', eventId, 0, 'user')
  await message('a1', eventId, 1, 'assistant', 'u1')
  await message('u2', otherId, 0, 'user')
  for (const attempt of [
    () => message('cross', otherId, 1, 'assistant', 'u1'),
    () => message('missing', eventId, 2, 'assistant', 'missing'),
    () => message('wrong-role', eventId, 2, 'assistant', 'a1'),
    () => message('bad-role', eventId, 2, 'system'),
    () => message('negative', eventId, -1, 'user'),
    () => message('fraction', eventId, 1.5, 'user'),
    () => message('user-reply', eventId, 2, 'user', 'u1'),
    () =>
      run(
        'UPDATE chat_messages SET event_id = ? WHERE message_id = ?',
        otherId,
        'u1',
      ),
    () =>
      run(
        'UPDATE chat_messages SET reply_to_message_id = ? WHERE message_id = ?',
        'u2',
        'a1',
      ),
    () =>
      run(
        "UPDATE chat_messages SET role = 'assistant', reply_to_message_id = 'u2' WHERE message_id = 'u1'",
      ),
  ])
    await expect(attempt()).rejects.toThrow()
})
