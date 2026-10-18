import { expect, it } from 'vitest'

import { applyMigrations, testDatabase } from '../helpers/database'

it('migrates populated parts without losing placements, names or integrity triggers', async () => {
  const local = await testDatabase({ through: '0003_chat_integrity.sql' })
  try {
    const db = local.binding
    await db.prepare("INSERT INTO users VALUES ('owner', 'test-only')").run()
    await db
      .prepare(
        "INSERT INTO events(event_id, created_user_id, title) VALUES ('e','owner','Live')",
      )
      .run()
    await db
      .prepare(
        "INSERT INTO parts(part_id,event_id,sort_order,part_name) VALUES ('p1','e',0,'前半'),('p2','e',1,NULL)",
      )
      .run()
    for (let index = 0; index < 6; index++) {
      await db
        .prepare(
          "INSERT INTO bands(band_id,event_id,band_name) VALUES (?, 'e', ?)",
        )
        .bind(`b${index}`, `Band ${index}`)
        .run()
      await db
        .prepare(
          'INSERT INTO band_order(band_id,part_id,"order") VALUES (?, ?, ?)',
        )
        .bind(`b${index}`, 'p1', index * 2 + 1)
        .run()
    }
    await applyMigrations(db, { after: '0003_chat_integrity.sql' })
    expect(
      (
        await db
          .prepare('SELECT part_name,band_count FROM parts ORDER BY sort_order')
          .all()
      ).results,
    ).toEqual([
      { part_name: '前半', band_count: 12 },
      { part_name: null, band_count: 4 },
    ])
    expect(
      (await db.prepare('SELECT * FROM band_order').all()).results,
    ).toHaveLength(6)
    for (const count of [0, -1, 1.5])
      await expect(
        db
          .prepare('UPDATE parts SET band_count=? WHERE part_id=?')
          .bind(count, 'p1')
          .run(),
      ).rejects.toThrow()
    await expect(
      db.prepare("DELETE FROM parts WHERE part_id='p1'").run(),
    ).rejects.toThrow()
    expect(
      await db
        .prepare("SELECT band_count FROM parts WHERE part_id='p1'")
        .first(),
    ).toEqual({ band_count: 12 })
  } finally {
    await local.dispose()
  }
})
