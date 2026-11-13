import { expect, it } from 'vitest'

import { createDb } from '../../src/db/index'
import { users } from '../../src/db/schema'
import app from '../../src/index'
import { openApiDocument } from '../../src/openapi'
import { createAuthenticatedHeaders } from '../helpers/auth'
import { applyMigrations, testDatabase } from '../helpers/database'
import { expectJsonResponse } from '../helpers/openapi'

it('persists only the authenticated profile, validates input and protects credentials', async () => {
  const local = await testDatabase()
  const db = createDb(local.binding)
  try {
    await db.insert(users).values([
      { userId: 'alice', passwordHash: 'private-alice' },
      { userId: 'bob', passwordHash: 'private-bob' },
    ])
    const headers = await createAuthenticatedHeaders(local.binding, 'alice')
    const request = (method: string, body?: unknown, extraHeaders = headers) =>
      app.request(
        '/api/auth/profile',
        {
          method,
          headers: { ...extraHeaders, 'Content-Type': 'application/json' },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
        { DB: local.binding },
      )
    expect((await request('GET', undefined, {})).status).toBe(401)
    const initial = await request('GET')
    expect(await initial.json()).toEqual({
      displayName: 'alice',
    })
    const profile = {
      displayName: 'ライブ運営',
    }
    expect(
      (
        await request('PATCH', profile, {
          Cookie: headers.Cookie,
          Origin: 'https://foreign.example',
        })
      ).status,
    ).toBe(403)
    for (const invalid of [
      { ...profile, displayName: ' ' },
      { ...profile, displayName: 'x'.repeat(41) },
      { ...profile, avatarText: 'A' },
      { ...profile, avatarColor: 'red' },
      { ...profile, userId: 'bob' },
      { ...profile, passwordHash: 'overwritten' },
    ])
      expect((await request('PATCH', invalid)).status).toBe(422)
    const saved = await request('PATCH', profile)
    expect(saved.status).toBe(200)
    await expectJsonResponse(
      saved.clone(),
      openApiDocument.paths['/api/auth/profile'].patch.responses,
    )
    expect(await saved.json()).toEqual(profile)
    const restored = await request('GET')
    await expectJsonResponse(
      restored.clone(),
      openApiDocument.paths['/api/auth/profile'].get.responses,
    )
    expect(await restored.json()).toEqual(profile)
    const secondSession = await createAuthenticatedHeaders(
      local.binding,
      'alice',
    )
    expect(
      await (await request('GET', undefined, secondSession)).json(),
    ).toEqual(profile)
    const bob = await createAuthenticatedHeaders(local.binding, 'bob')
    expect(await (await request('GET', undefined, bob)).json()).toEqual({
      displayName: 'bob',
    })
    expect(
      (await db.select().from(users)).map((user) => user.passwordHash).sort(),
    ).toEqual(['private-alice', 'private-bob'])
  } finally {
    await local.dispose()
  }
})

it('adds profile settings while preserving existing credentials, sessions and event ownership', async () => {
  const local = await testDatabase({ through: '0008_auth_sessions.sql' })
  try {
    await local.binding
      .prepare(
        "INSERT INTO users (user_id, password_hash) VALUES ('legacy-owner', 'unchanged-hash')",
      )
      .run()
    await local.binding
      .prepare(
        "INSERT INTO events (event_id, created_user_id, title) VALUES ('legacy-event', 'legacy-owner', 'Existing live')",
      )
      .run()
    const headers = await createAuthenticatedHeaders(
      local.binding,
      'legacy-owner',
    )
    const beforeEvents = await local.binding
      .prepare('SELECT * FROM events')
      .all()
    const beforeSessions = await local.binding
      .prepare('SELECT * FROM auth_sessions')
      .all()
    await applyMigrations(local.binding, { after: '0008_auth_sessions.sql' })
    expect(
      (await local.binding.prepare('SELECT * FROM users').all()).results,
    ).toEqual([
      {
        user_id: 'legacy-owner',
        password_hash: 'unchanged-hash',
        display_name: null,
      },
    ])
    expect(
      (await local.binding.prepare('SELECT * FROM events').all()).results,
    ).toEqual(beforeEvents.results)
    expect(
      (await local.binding.prepare('SELECT * FROM auth_sessions').all())
        .results,
    ).toEqual(beforeSessions.results)
    expect(
      await (
        await app.request(
          '/api/auth/profile',
          { headers },
          { DB: local.binding },
        )
      ).json(),
    ).toEqual({
      displayName: 'legacy-owner',
    })
  } finally {
    await local.dispose()
  }
})
