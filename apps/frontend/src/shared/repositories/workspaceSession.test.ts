import { afterEach, describe, expect, it, vi } from 'vitest'

import { workspaceSession } from './workspaceSession'

afterEach(() => vi.unstubAllGlobals())

describe('authentication API', () => {
  it('sends credentials to login with same-origin cookies and returns the server identity', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ userId: 'operator' }))
    vi.stubGlobal('fetch', fetcher)
    await expect(
      workspaceSession.signIn('operator', 'secret-password'),
    ).resolves.toEqual({ userId: 'operator' })
    expect(fetcher).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        body: JSON.stringify({
          userId: 'operator',
          password: 'secret-password',
        }),
      }),
    )
  })

  it('restores the server session and treats only 401 as signed out', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ userId: 'operator' }))
      .mockResolvedValueOnce(
        Response.json({ error: { code: 'unauthorized' } }, { status: 401 }),
      )
      .mockResolvedValueOnce(new Response('', { status: 503 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(workspaceSession.getSession()).resolves.toEqual({
      userId: 'operator',
    })
    await expect(workspaceSession.getSession()).resolves.toBeNull()
    await expect(workspaceSession.getSession()).rejects.toThrow()
  })

  it('registers a new account and uses the returned session identity', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ userId: 'new-user' }, { status: 201 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(
      workspaceSession.signUp('new-user', 'a-long-unique-password'),
    ).resolves.toEqual({ userId: 'new-user' })
    expect(fetcher).toHaveBeenCalledWith(
      '/api/auth/register',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        body: JSON.stringify({
          userId: 'new-user',
          password: 'a-long-unique-password',
        }),
      }),
    )
  })

  it('reports a failed login and asks the server to invalidate logout', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          {
            error: {
              code: 'invalid_credentials',
              message: 'ログインIDまたはパスワードが正しくありません。',
            },
          },
          { status: 401 },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetcher)
    await expect(workspaceSession.signIn('operator', 'wrong')).rejects.toThrow(
      'ログインIDまたはパスワード',
    )
    await expect(workspaceSession.signOut()).resolves.toBeUndefined()
    expect(fetcher).toHaveBeenLastCalledWith(
      '/api/auth/logout',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
    )
  })
})
