import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createDb } from '../../src/db/index'
import { authSessions, users } from '../../src/db/schema'
import app from '../../src/index'
import { authRepository } from '../../src/repositories/auth'
import { hashPassword } from '../../src/services/auth/password'
import { authService } from '../../src/services/auth/service'
import { createAuthenticatedHeaders } from '../helpers/auth'
import { testDatabase } from '../helpers/database'

let local: Awaited<ReturnType<typeof testDatabase>>
beforeEach(async () => {
  local = await testDatabase()
})
afterEach(async () => {
  await local?.dispose()
})

describe('authentication races', () => {
  it.each(['/api/auth/session', '/api/events'])(
    'does not clear a newer browser cookie when an older request to %s is unauthorized',
    async (path) => {
      await createDb(local.binding)
        .insert(users)
        .values({ userId: 'operator', passwordHash: 'test-placeholder' })
      const oldHeaders = await createAuthenticatedHeaders(
        local.binding,
        'operator',
      )
      await createDb(local.binding)
        .update(authSessions)
        .set({ expiresAt: Date.now() - 1 })
      // Another tab has already established a new session before this old
      // request arrives. Its response must not delete that tab's new cookie.
      const currentHeaders = await createAuthenticatedHeaders(
        local.binding,
        'operator',
      )
      const response = await app.request(
        path,
        { headers: oldHeaders },
        { DB: local.binding },
      )
      expect(response.status).toBe(401)
      expect(response.headers.get('set-cookie')).toBeNull()
      expect(
        (
          await app.request(
            '/api/auth/session',
            { headers: currentHeaders },
            { DB: local.binding },
          )
        ).status,
      ).toBe(200)
      const unknown = await app.request(
        path,
        { headers: { Cookie: `setly_session=${'0'.repeat(64)}` } },
        { DB: local.binding },
      )
      expect(unknown.status).toBe(401)
      expect(unknown.headers.get('set-cookie')).toBeNull()
    },
  )

  it('still revokes the server session and clears the cookie on explicit logout', async () => {
    await createDb(local.binding)
      .insert(users)
      .values({ userId: 'operator', passwordHash: 'test-placeholder' })
    const headers = await createAuthenticatedHeaders(local.binding, 'operator')
    const response = await app.request(
      '/api/auth/logout',
      { method: 'POST', headers },
      { DB: local.binding },
    )
    expect(response.status).toBe(204)
    expect(response.headers.get('set-cookie')).toMatch(/Max-Age=0/i)
    expect(await createDb(local.binding).select().from(authSessions)).toEqual(
      [],
    )
  })

  it('rejects an in-flight old-password login after a reset without rotating another valid session', async () => {
    const oldPassword = 'old-test-only-passphrase'
    const newPassword = 'new-test-only-passphrase'
    const db = createDb(local.binding)
    const [oldHash, newHash] = await Promise.all([
      hashPassword(oldPassword),
      hashPassword(newPassword),
    ])
    await db.insert(users).values([
      { userId: 'reset-user', passwordHash: oldHash },
      { userId: 'current-user', passwordHash: 'test-placeholder' },
    ])
    await createAuthenticatedHeaders(local.binding, 'reset-user')
    const currentHeaders = await createAuthenticatedHeaders(
      local.binding,
      'current-user',
    )
    const currentToken = currentHeaders.Cookie.split('=')[1]
    const repository = authRepository(db)
    const findUser = repository.findUser.bind(repository)
    vi.spyOn(repository, 'findUser').mockImplementationOnce(async (userId) => {
      const readBeforeReset = await findUser(userId)
      // Deterministically interleave an actual database credential reset after
      // login reads the old hash but before it issues its new session.
      await db.batch([
        db.delete(authSessions).where(eq(authSessions.userId, userId)),
        db
          .update(users)
          .set({ passwordHash: newHash })
          .where(eq(users.userId, userId)),
      ])
      return readBeforeReset
    })
    const service = authService(repository)
    await expect(
      service.login('reset-user', oldPassword, currentToken),
    ).rejects.toMatchObject({ code: 'invalid_credentials', status: 401 })
    expect(
      await db.select({ userId: authSessions.userId }).from(authSessions),
    ).toEqual([{ userId: 'current-user' }])
    expect(await service.session(currentToken)).toEqual({
      userId: 'current-user',
    })
    const signedIn = await service.login(
      'reset-user',
      newPassword,
      currentToken,
    )
    expect(await service.session(signedIn.token)).toEqual({
      userId: 'reset-user',
    })
    expect(await service.session(currentToken)).toBeNull()
  })
})
