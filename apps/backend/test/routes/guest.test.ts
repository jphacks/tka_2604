import { afterEach, beforeEach, expect, it } from 'vitest'

import { loadEvent } from '../../src/db/events'
import { createDb } from '../../src/db/index'
import app from '../../src/index'
import { openApiDocument } from '../../src/openapi'
import { testDatabase } from '../helpers/database'
import { seedEventInformation } from '../helpers/event-information'
import { expectJsonResponse } from '../helpers/openapi'

let local: Awaited<ReturnType<typeof testDatabase>>
beforeEach(async () => {
  local = await testDatabase()
})
afterEach(async () => {
  await local?.dispose()
})
const credentials = { userId: 'new-organizer', password: 'test-only-password' }
async function request(
  path: string,
  method = 'GET',
  body?: unknown,
  cookie?: string,
) {
  return app.request(
    path,
    {
      method,
      headers: {
        Origin: 'http://localhost',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
    { DB: local.binding },
  )
}
const cookieOf = (response: Response) =>
  response.headers.get('set-cookie')!.split(';')[0]
async function guest() {
  const response = await request('/api/auth/guest', 'POST')
  expect(response.status).toBe(201)
  return {
    cookie: cookieOf(response),
    user: await response.json<{ userId: string; isRegistered: boolean }>(),
  }
}

it('creates an isolated guest, restores and reuses its session, and never permits password login', async () => {
  const { cookie, user } = await guest()
  expect(user.isRegistered).toBe(false)
  expect(
    await (await request('/api/auth/profile', 'GET', undefined, cookie)).json(),
  ).toEqual({ displayName: 'ゲスト' })
  const session = await request('/api/auth/session', 'GET', undefined, cookie)
  expect(await session.json()).toEqual({ ...user, loginId: null })
  const reused = await request('/api/auth/guest', 'POST', undefined, cookie)
  expect(reused.status).toBe(200)
  expect((await reused.json<{ userId: string }>()).userId).toBe(user.userId)
  const second = await guest()
  expect(second.user.userId).not.toBe(user.userId)
  const seeded = await seedEventInformation(
    createDb(local.binding),
    user.userId,
  )
  expect(
    (
      await request(
        `/api/events/${seeded.event.eventId}`,
        'GET',
        undefined,
        second.cookie,
      )
    ).status,
  ).toBe(404)
  // Even a valid hash on a guest must not grant password login.
  const { hashPassword } = await import('../../src/services/auth/password')
  await local.binding
    .prepare(
      'UPDATE users SET password_hash = ?, login_id = user_id WHERE user_id = ?',
    )
    .bind(await hashPassword(credentials.password), user.userId)
    .run()
  expect(
    (
      await request('/api/auth/login', 'POST', {
        ...credentials,
        userId: user.userId,
      })
    ).status,
  ).toBe(401)
  expect(
    (await request('/api/auth/complete-registration', 'POST', credentials))
      .status,
  ).toBe(401)
})

it('registers the same user atomically, retains every event record, rotates the session and logs in from another browser', async () => {
  const { cookie, user } = await guest()
  const db = createDb(local.binding)
  const seeded = await seedEventInformation(db, user.userId)
  const before = await loadEvent(db, user.userId, seeded.event.eventId)
  const chatBefore = await local.binding
    .prepare('SELECT * FROM chat_messages ORDER BY seq')
    .all()
  const registered = await request(
    '/api/auth/complete-registration',
    'POST',
    credentials,
    cookie,
  )
  expect(registered.status).toBe(200)
  expect(
    await (
      await request('/api/auth/profile', 'GET', undefined, cookieOf(registered))
    ).json(),
  ).toEqual({ displayName: credentials.userId })
  expect(await registered.json()).toEqual({
    userId: user.userId,
    isRegistered: true,
    loginId: credentials.userId,
  })
  expect(await loadEvent(db, user.userId, seeded.event.eventId)).toEqual(before)
  expect(
    (
      await local.binding
        .prepare('SELECT * FROM chat_messages ORDER BY seq')
        .all()
    ).results,
  ).toEqual(chatBefore.results)
  expect(
    (await request('/api/auth/session', 'GET', undefined, cookie)).status,
  ).toBe(401)
  expect(
    (await request('/api/auth/session', 'GET', undefined, cookieOf(registered)))
      .status,
  ).toBe(200)
  expect(
    (await request('/api/auth/register', 'POST', credentials)).status,
  ).toBe(409)
  const login = await request('/api/auth/login', 'POST', credentials)
  expect(login.status).toBe(200)
  expect(
    (
      await request(
        `/api/events/${seeded.event.eventId}`,
        'GET',
        undefined,
        cookieOf(login),
      )
    ).status,
  ).toBe(200)
  expect(
    (
      await request('/api/auth/login', 'POST', {
        ...credentials,
        userId: user.userId,
      })
    ).status,
  ).toBe(401)
  expect(
    (
      await request(
        '/api/auth/complete-registration',
        'POST',
        { ...credentials, userId: 'other-id' },
        cookieOf(login),
      )
    ).status,
  ).toBe(409)
})

it('preserves the guest after a duplicate ID, bad input or failed database write and allows retry', async () => {
  await request('/api/auth/register', 'POST', credentials)
  const { cookie, user } = await guest()
  expect(
    (
      await request(
        '/api/auth/complete-registration',
        'POST',
        credentials,
        cookie,
      )
    ).status,
  ).toBe(409)
  expect(
    (
      await request(
        '/api/auth/complete-registration',
        'POST',
        { ...credentials, userId: 'ab' },
        cookie,
      )
    ).status,
  ).toBe(422)
  await local.binding
    .prepare(
      "CREATE TRIGGER fail_registration BEFORE INSERT ON auth_sessions WHEN NEW.user_id = '" +
        user.userId +
        "' BEGIN SELECT RAISE(ABORT, 'test failure'); END",
    )
    .run()
  expect(
    (
      await request(
        '/api/auth/complete-registration',
        'POST',
        { ...credentials, userId: 'retry-id' },
        cookie,
      )
    ).status,
  ).toBe(500)
  expect(
    await (await request('/api/auth/session', 'GET', undefined, cookie)).json(),
  ).toMatchObject({ isRegistered: false })
  await local.binding.prepare('DROP TRIGGER fail_registration').run()
  expect(
    (
      await request(
        '/api/auth/complete-registration',
        'POST',
        { ...credentials, userId: 'retry-id' },
        cookie,
      )
    ).status,
  ).toBe(200)
})

it('only completes registration once under concurrent requests and rejects expired or logged-out sessions', async () => {
  const { cookie } = await guest()
  const responses = await Promise.all(
    ['first-id', 'second-id'].map((userId) =>
      request(
        '/api/auth/complete-registration',
        'POST',
        { ...credentials, userId },
        cookie,
      ),
    ),
  )
  expect(responses.filter((response) => response.status === 200)).toHaveLength(
    1,
  )
  expect(
    responses.filter((response) => [401, 409].includes(response.status)),
  ).toHaveLength(1)
  const other = await guest()
  await request('/api/auth/logout', 'POST', undefined, other.cookie)
  expect(
    (
      await request(
        '/api/auth/complete-registration',
        'POST',
        credentials,
        other.cookie,
      )
    ).status,
  ).toBe(401)
  const expired = await guest()
  await local.binding.prepare('UPDATE auth_sessions SET expires_at = 0').run()
  expect(
    (
      await request(
        '/api/auth/complete-registration',
        'POST',
        credentials,
        expired.cookie,
      )
    ).status,
  ).toBe(401)
})

it('documents guest responses, checks Origin, reserves IDs and limits guest creation', async () => {
  const rejected = await app.request(
    '/api/auth/guest',
    { method: 'POST' },
    { DB: local.binding },
  )
  expect(rejected.status).toBe(403)
  const response = await request('/api/auth/guest', 'POST')
  expect(response.status).toBe(201)
  await expectJsonResponse(
    response,
    openApiDocument.paths['/api/auth/guest'].post.responses,
  )
  const cookie = cookieOf(response)
  const reserved = await request(
    '/api/auth/complete-registration',
    'POST',
    { ...credentials, userId: 'demo-owner' },
    cookie,
  )
  expect(reserved.status).toBe(409)
  for (let n = 1; n < 10; n++)
    expect((await request('/api/auth/guest', 'POST')).status).toBe(201)
  const limited = await request('/api/auth/guest', 'POST')
  expect(limited.status).toBe(429)
  expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0)
})
