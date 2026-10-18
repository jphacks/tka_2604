import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadEvent } from '../../src/db/events'
import { createDb } from '../../src/db/index'
import { chatMessages, events, users } from '../../src/db/schema'
import app from '../../src/index'
import { openApiDocument } from '../../src/openapi'
import { testDatabase } from '../helpers/database'
import { seedEventInformation } from '../helpers/event-information'
import { expectJsonResponse } from '../helpers/openapi'

let local: Awaited<ReturnType<typeof testDatabase>>
const credentials = {
  userId: 'operator-a',
  password: 'test-only-long-passphrase',
}
beforeEach(async () => {
  local = await testDatabase()
})
afterEach(async () => {
  await local?.dispose()
})

function request(
  path: string,
  method = 'GET',
  body?: unknown,
  cookie?: string,
  origin = 'http://localhost',
) {
  return app.request(
    path,
    {
      method,
      headers: {
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    { DB: local.binding },
  )
}
const cookieOf = (response: Response) =>
  response.headers.get('set-cookie')!.split(';')[0]
async function register() {
  const response = await request('/api/auth/register', 'POST', credentials)
  expect(response.status).toBe(201)
  return response
}

describe('real credentials and server sessions', () => {
  it('registers a hashed password, restores a session, and revokes it on logout', async () => {
    const registered = await register()
    await expectJsonResponse(
      registered,
      openApiDocument.paths['/api/auth/register'].post.responses,
    )
    expect(await registered.json()).toEqual({ userId: credentials.userId })
    expect(registered.headers.get('set-cookie')).toMatch(/HttpOnly/i)
    expect(registered.headers.get('set-cookie')).toMatch(/SameSite=Lax/i)
    expect(registered.headers.get('cache-control')).toBe('no-store')
    const saved = await createDb(local.binding).select().from(users)
    expect(saved).toHaveLength(1)
    expect(saved[0].passwordHash).not.toContain(credentials.password)
    const cookie = cookieOf(registered)
    const session = await request('/api/auth/session', 'GET', undefined, cookie)
    expect(await session.json()).toEqual({ userId: credentials.userId })
    expect(
      (await request('/api/events', 'GET', undefined, cookie)).status,
    ).toBe(200)
    expect(
      (await request('/api/auth/logout', 'POST', undefined, cookie)).status,
    ).toBe(204)
    expect(
      (await request('/api/auth/session', 'GET', undefined, cookie)).status,
    ).toBe(401)
    expect(
      (await request('/api/events', 'GET', undefined, cookie)).status,
    ).toBe(401)
    expect(
      (await request('/api/auth/logout', 'POST', undefined, cookie)).status,
    ).toBe(204)
  })

  it('rolls back registration if the session cannot be saved', async () => {
    await local.binding
      .prepare(
        "CREATE TRIGGER fail_session BEFORE INSERT ON auth_sessions BEGIN SELECT RAISE(ABORT, 'test failure'); END;",
      )
      .run()
    const response = await request('/api/auth/register', 'POST', credentials)
    expect(response.status).toBe(500)
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(await createDb(local.binding).select().from(users)).toEqual([])
  })

  it('rejects wrong and nonexistent credentials with the same generic error and no session', async () => {
    await register()
    const wrong = await request('/api/auth/login', 'POST', {
      ...credentials,
      password: 'incorrect',
    })
    const missing = await request('/api/auth/login', 'POST', {
      ...credentials,
      userId: 'missing',
    })
    expect(wrong.status).toBe(401)
    expect(missing.status).toBe(401)
    expect(await wrong.json()).toEqual(await missing.json())
    expect(wrong.headers.get('set-cookie')).toBeNull()
    const loggedIn = await request('/api/auth/login', 'POST', credentials)
    expect(loggedIn.status).toBe(200)
    expect(await loggedIn.json()).toEqual({ userId: credentials.userId })
  })

  it('does not register reserved legacy IDs or overwrite an existing password', async () => {
    expect(
      (
        await request('/api/auth/register', 'POST', {
          ...credentials,
          userId: 'demo-owner',
        })
      ).status,
    ).toBe(409)
    await register()
    const before = await createDb(local.binding).select().from(users)
    expect(
      (
        await request('/api/auth/register', 'POST', {
          ...credentials,
          password: 'another-long-passphrase',
        })
      ).status,
    ).toBe(409)
    expect(await createDb(local.binding).select().from(users)).toEqual(before)
  })

  it.each([
    { ...credentials, password: 'short' },
    { ...credentials, userId: 'invalid id' },
    { ...credentials, userId: 'ab' },
    { ...credentials, admin: true },
  ])('rejects invalid signup without a user or session', async (body) => {
    const response = await request('/api/auth/register', 'POST', body)
    expect(response.status).toBe(422)
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(await createDb(local.binding).select().from(users)).toEqual([])
  })

  it('rejects cross-origin login, registration and authenticated mutation', async () => {
    const cookie = cookieOf(await register())
    for (const [path, body] of [
      ['/api/auth/login', credentials],
      ['/api/auth/register', credentials],
      ['/api/auth/logout', undefined],
      ['/api/events', { title: 'Forged' }],
    ] as const) {
      const response = await request(
        path,
        'POST',
        body,
        cookie,
        'https://evil.invalid',
      )
      expect(response.status).toBe(403)
      expect(await response.json()).toMatchObject({
        error: { code: 'invalid_origin' },
      })
    }
    expect(
      (await request('/api/auth/session', 'GET', undefined, cookie)).status,
    ).toBe(200)
    expect(
      await (await request('/api/events', 'GET', undefined, cookie)).json(),
    ).toEqual({ events: [] })
  })

  it('isolates every event operation between two real users without external calls or mutation', async () => {
    const cookieA = cookieOf(await register())
    const responseB = await request('/api/auth/register', 'POST', {
      ...credentials,
      userId: 'operator-b',
    })
    expect(responseB.status).toBe(201)
    const cookieB = cookieOf(responseB)
    const created = await request(
      '/api/events',
      'POST',
      { title: 'Private A' },
      cookieA,
    )
    expect(created.status).toBe(201)
    const db = createDb(local.binding)
    const seed = await seedEventInformation(db, credentials.userId)
    const base = `/api/events/${seed.event.eventId}`
    const expectedUpdatedAt = seed.event.updatedAt
    const operations = [
      ['GET', base, undefined],
      ['GET', `${base}/schedule`, undefined],
      ['GET', `${base}/constraints`, undefined],
      ['GET', `${base}/chat`, undefined],
      [
        'POST',
        `${base}/chat`,
        { message: 'Change the private event', messageId: 'forged-message' },
      ],
      [
        'POST',
        `${base}/solve`,
        {
          expectedUpdatedAt,
          parts: seed.schedule.parts.map(({ partId, bandCount }) => ({
            partId,
            bandCount,
          })),
        },
      ],
      [
        'POST',
        `${base}/schedule`,
        {
          expectedUpdatedAt,
          parts: seed.schedule.parts.map(({ partId, bandCount }) => ({
            partId,
            bandCount,
            partName: 'Forged part name',
          })),
          placements: seed.schedule.placements,
          unassignedBandIds: seed.schedule.unassignedBandIds,
        },
      ],
      ['POST', `${base}/constraints`, { expectedUpdatedAt, constraints: [] }],
      ['PATCH', base, { expectedUpdatedAt, title: 'Forged title' }],
      ['DELETE', `${base}/bands/a-b1`, { expectedUpdatedAt }],
      ['DELETE', base, undefined],
    ] as const
    const before = await loadEvent(db, credentials.userId, seed.event.eventId)
    const eventsBefore = await db.select().from(events)
    const messagesBefore = await db.select().from(chatMessages)
    const external = vi.spyOn(globalThis, 'fetch')
    try {
      const list = await app.request(
        '/api/events?userId=operator-a',
        {
          headers: { Cookie: cookieB, 'X-User-Id': credentials.userId },
        },
        { DB: local.binding },
      )
      expect(list.status).toBe(200)
      expect(await list.json()).toEqual({ events: [] })
      for (const [method, path, body] of operations) {
        const response = await request(path, method, body, cookieB)
        expect(response.status, `${method} ${path}`).toBe(404)
        expect(await response.json()).toMatchObject({
          error: { code: 'event_not_found' },
        })
      }
      expect(external).not.toHaveBeenCalled()
      expect(
        await loadEvent(db, credentials.userId, seed.event.eventId),
      ).toEqual(before)
      expect(await db.select().from(events)).toEqual(eventsBefore)
      expect(await db.select().from(chatMessages)).toEqual(messagesBefore)
      expect((await request(base, 'GET', undefined, cookieA)).status).toBe(200)
    } finally {
      external.mockRestore()
    }
  })

  it('uses a host-only secure cookie over HTTPS and rejects the HTTP fallback cookie', async () => {
    const origin = 'https://setly.example'
    const registered = await request(
      `${origin}/api/auth/register`,
      'POST',
      credentials,
      undefined,
      origin,
    )
    expect(registered.status).toBe(201)
    const setCookie = registered.headers.get('set-cookie')!
    expect(setCookie).toMatch(/^__Host-setly_session=[a-f0-9]{64};/)
    expect(setCookie).toMatch(/; Secure(?:;|$)/i)
    expect(setCookie).toMatch(/; HttpOnly(?:;|$)/i)
    expect(setCookie).toMatch(/; Path=\/(?:;|$)/i)
    expect(setCookie).toMatch(/; SameSite=Lax(?:;|$)/i)
    expect(setCookie).not.toMatch(/(?:^|;)\s*Domain=/i)
    const secureCookie = cookieOf(registered)
    const fallbackCookie = secureCookie.replace(
      '__Host-setly_session=',
      'setly_session=',
    )
    for (const path of ['/api/auth/session', '/api/events']) {
      expect(
        (
          await request(
            `${origin}${path}`,
            'GET',
            undefined,
            secureCookie,
            origin,
          )
        ).status,
      ).toBe(200)
      expect(
        (
          await request(
            `${origin}${path}`,
            'GET',
            undefined,
            fallbackCookie,
            origin,
          )
        ).status,
      ).toBe(401)
    }
  })

  it('expires sessions after 24 hours and does not store the raw cookie token', async () => {
    const cookie = cookieOf(await register())
    const token = cookie.split('=')[1]
    const stored = await local.binding
      .prepare('SELECT token_hash, expires_at FROM auth_sessions')
      .first<{ token_hash: string; expires_at: number }>()
    expect(stored!.token_hash).not.toBe(token)
    expect(stored!.expires_at - Date.now()).toBeGreaterThan(86_390_000)
    expect(stored!.expires_at - Date.now()).toBeLessThanOrEqual(86_400_000)
    await local.binding
      .prepare('UPDATE auth_sessions SET expires_at = ?')
      .bind(Date.now() - 1)
      .run()
    expect(
      (await request('/api/events', 'GET', undefined, cookie)).status,
    ).toBe(401)
    expect(
      (await request('/api/auth/session', 'GET', undefined, cookie)).status,
    ).toBe(401)
  })

  it('rejects tampered cookies and removed users', async () => {
    const cookie = cookieOf(await register())
    expect(
      (await request('/api/events', 'GET', undefined, `${cookie}00`)).status,
    ).toBe(401)
    const tampered = cookie.slice(0, -1) + (cookie.endsWith('0') ? '1' : '0')
    expect(
      (await request('/api/events', 'GET', undefined, tampered)).status,
    ).toBe(401)
    await createDb(local.binding)
      .delete(users)
      .where(eq(users.userId, credentials.userId))
    expect(
      (await request('/api/auth/session', 'GET', undefined, cookie)).status,
    ).toBe(401)
  })

  it('throttles repeated login attempts including unknown IDs without issuing a session', async () => {
    for (let count = 0; count < 10; count++)
      expect(
        (await request('/api/auth/login', 'POST', credentials)).status,
      ).toBe(401)
    const limited = await request('/api/auth/login', 'POST', credentials)
    expect(limited.status).toBe(429)
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(limited.headers.get('set-cookie')).toBeNull()
    await local.binding
      .prepare('UPDATE auth_rate_limits SET expires_at = ?')
      .bind(Date.now() - 1)
      .run()
    expect((await request('/api/auth/login', 'POST', credentials)).status).toBe(
      401,
    )
  })
})
