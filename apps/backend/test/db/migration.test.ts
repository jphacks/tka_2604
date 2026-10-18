import { readFile } from 'node:fs/promises'
import { URL } from 'node:url'

import { expect, it } from 'vitest'

import { applyMigrations, testDatabase } from '../helpers/database'

it('upgrades populated legacy data without losing names, nulls, memberships or placements', async () => {
  const local = await testDatabase({ through: '0001_event_integrity.sql' })
  try {
    const run = (sql: string) => local.binding.prepare(sql).run()
    await run("INSERT INTO users VALUES ('owner', 'test-only')")
    await run(
      "INSERT INTO events (event_id, created_user_id, title) VALUES ('e', 'owner', 'Live')",
    )
    await run(
      "INSERT INTO parts (part_id, event_id, sort_order, comment) VALUES ('p1', 'e', 0, '前半'), ('p2', 'e', 1, NULL)",
    )
    await run("INSERT INTO bands VALUES ('b', 'e', 'A')")
    await run("INSERT INTO members VALUES ('m', 'e', 'Member')")
    await run("INSERT INTO band_members VALUES ('b', 'm')")
    await run("INSERT INTO band_order VALUES ('b', 'p1', 0)")
    await run(
      `INSERT INTO constraints VALUES ('c', 'e', '{"constraint_id":"c","event_id":"e","params":{"part_ids":[1]}}')`,
    )
    await applyMigrations(local.binding, { after: '0001_event_integrity.sql' })
    const { results: names } = await local.binding
      .prepare('SELECT part_name FROM parts ORDER BY sort_order')
      .all()
    expect(names.map((row) => row.part_name)).toEqual(['前半', null])
    expect(
      await local.binding
        .prepare("SELECT band_name, description FROM bands WHERE band_id = 'b'")
        .first(),
    ).toEqual({ band_name: 'A', description: null })
    for (const table of [
      'users',
      'events',
      'bands',
      'members',
      'band_members',
      'band_order',
      'constraints',
    ]) {
      expect(
        await local.binding
          .prepare(`SELECT count(*) AS n FROM ${table}`)
          .first('n'),
      ).toBe(1)
    }
    expect(
      (await local.binding.prepare('PRAGMA foreign_key_check').all()).results,
    ).toEqual([])
    await expect(
      run("DELETE FROM parts WHERE part_id = 'p2'"),
    ).rejects.toThrow()
    await run("UPDATE bands SET band_name = 'Edited' WHERE band_id = 'b'")
    expect(
      await local.binding
        .prepare("SELECT request_text FROM bands WHERE band_id = 'b'")
        .first('request_text'),
    ).toBeNull()
  } finally {
    await local.dispose()
  }
})

it('removes every legacy event status while retaining all business data and FK enforcement', async () => {
  const local = await testDatabase({ through: '0006_band_description.sql' })
  try {
    const seed = await readFile(
      new URL('../../db/seed.sql', import.meta.url),
      'utf8',
    )
    await local.binding.batch(
      seed
        .split(';')
        .filter((sql) => sql.trim())
        .map((sql) => local.binding.prepare(sql)),
    )
    await local.binding
      .prepare(
        "UPDATE events SET status = 'adjusting' WHERE event_id = 'demo-event'",
      )
      .run()
    for (const [id, status, deleted] of [
      ['planned', 'planning', 0],
      ['done', 'confirmed', 1],
    ]) {
      await local.binding
        .prepare(
          'INSERT INTO events (event_id, created_user_id, title, status, is_deleted) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(id, 'demo-owner', id, status, deleted)
        .run()
    }
    const tables = [
      'users',
      'events',
      'bands',
      'members',
      'band_members',
      'parts',
      'band_order',
      'constraints',
      'chat_messages',
    ]
    async function snapshot() {
      return Promise.all(
        tables.map(async (table) => {
          const { results } = await local.binding
            .prepare(`SELECT * FROM ${table} ORDER BY rowid`)
            .all()
          return results.map((row) => {
            if (table === 'events') delete row.status
            return row
          })
        }),
      )
    }
    const before = await snapshot()
    await applyMigrations(local.binding, { after: '0006_band_description.sql' })
    expect(await snapshot()).toEqual(before)
    const { results: columns } = await local.binding
      .prepare('PRAGMA table_info(events)')
      .all()
    expect(columns.map((column) => column.name)).not.toContain('status')
    expect(
      (await local.binding.prepare('PRAGMA foreign_key_check').all()).results,
    ).toEqual([])
    await expect(
      local.binding
        .prepare(
          "INSERT INTO bands (band_id, event_id, band_name) VALUES ('invalid', 'missing', 'Invalid')",
        )
        .run(),
    ).rejects.toThrow()
    await expect(
      local.binding
        .prepare(
          "UPDATE events SET is_deleted = 2 WHERE event_id = 'demo-event'",
        )
        .run(),
    ).rejects.toThrow()
    await expect(
      local.binding
        .prepare("DELETE FROM parts WHERE part_id = 'demo-part-1'")
        .run(),
    ).rejects.toThrow()
    await expect(
      local.binding
        .prepare("UPDATE band_members SET member_id = 'missing'")
        .run(),
    ).rejects.toThrow()
  } finally {
    await local.dispose()
  }
})
