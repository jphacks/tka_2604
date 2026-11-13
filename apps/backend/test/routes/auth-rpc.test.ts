import { hc } from 'hono/client'
import { expect, expectTypeOf, it } from 'vitest'

import app, { type AppType } from '../../src/index'
import { openApiDocument } from '../../src/openapi'
import { testDatabase } from '../helpers/database'
import { expectJsonResponse } from '../helpers/openapi'

it('shares registration, login, session and logout contracts through Hono RPC', async () => {
  const local = await testDatabase()
  let cookie: string | undefined
  const client = hc<AppType>('http://localhost', {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      headers.set('Origin', 'http://localhost')
      if (cookie) headers.set('Cookie', cookie)
      const response = await app.request(
        input instanceof URL ? input.toString() : input,
        { ...init, headers },
        { DB: local.binding },
      )
      const changedCookie = response.headers.get('set-cookie')
      if (changedCookie) cookie = changedCookie.split(';')[0]
      return response
    },
  })
  try {
    const credentials = {
      userId: 'rpc-owner',
      password: 'test-only-rpc-passphrase',
    }
    const registered = await client.api.auth.register.$post({
      json: credentials,
    })
    await expectJsonResponse(
      registered,
      openApiDocument.paths['/api/auth/register'].post.responses,
    )
    if (registered.status !== 201) throw new Error('Registration failed')
    const registeredUser = await registered.json()
    expectTypeOf(registeredUser).toEqualTypeOf<{ userId: string }>()
    expect(registeredUser).toEqual({ userId: credentials.userId })

    const loggedIn = await client.api.auth.login.$post({ json: credentials })
    await expectJsonResponse(
      loggedIn,
      openApiDocument.paths['/api/auth/login'].post.responses,
    )
    if (loggedIn.status !== 200) throw new Error('Login failed')
    expectTypeOf(await loggedIn.json()).toEqualTypeOf<{ userId: string }>()

    const session = await client.api.auth.session.$get()
    await expectJsonResponse(
      session,
      openApiDocument.paths['/api/auth/session'].get.responses,
    )
    if (session.status !== 200) throw new Error('Session restore failed')
    const restored = await session.json()
    expectTypeOf(restored).toEqualTypeOf<{ userId: string }>()
    expect(restored).toEqual({ userId: credentials.userId })

    const loggedOut = await client.api.auth.logout.$post()
    expect(loggedOut.status).toBe(204)
    expect(await loggedOut.text()).toBe('')
    const expired = await client.api.auth.session.$get()
    expect(expired.status).toBe(401)
    await expectJsonResponse(
      expired,
      openApiDocument.paths['/api/auth/session'].get.responses,
    )
  } finally {
    await local.dispose()
  }
})
