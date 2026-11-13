import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createApiClient } from '../shared/api/client'
import { workspaceRepository } from '../shared/repositories/workspaceRepository'
import { deferred } from '../test/deferred'
import { useSession } from './sessionContext'
import { SessionProvider } from './SessionProvider'

beforeEach(() => {
  vi.spyOn(workspaceRepository, 'getSession').mockResolvedValue({
    userId: 'operator',
  })
  vi.spyOn(workspaceRepository, 'signIn').mockResolvedValue({
    userId: 'operator',
  })
  vi.spyOn(workspaceRepository, 'signOut').mockResolvedValue()
})

describe('server session state', () => {
  it('waits for restoration, exposes failures, and retries', async () => {
    vi.mocked(workspaceRepository.getSession).mockRejectedValueOnce(
      new Error('offline'),
    )
    const { result } = renderHook(useSession, { wrapper: SessionProvider })
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.restoreError).toContain('確認できませんでした')
    await act(() => result.current.retrySession())
    expect(result.current.session).toEqual({ userId: 'operator' })
    expect(result.current.restoreError).toBe('')
  })

  it('clears an expired session on a managed API 401', async () => {
    const { result } = renderHook(useSession, { wrapper: SessionProvider })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const client = createApiClient(
      '',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 401 })),
    )
    await act(async () => {
      await client.api.events.$get()
    })
    expect(result.current.session).toBeNull()
    expect(result.current.notice).toContain('もう一度ログイン')
  })

  it('does not let an older restoration restore a session after logout', async () => {
    const oldSession = deferred<{ userId: string }>()
    vi.mocked(workspaceRepository.getSession).mockReturnValue(
      oldSession.promise,
    )
    const { result } = renderHook(useSession, { wrapper: SessionProvider })
    await act(() => result.current.signOut())
    await act(async () => {
      oldSession.resolve({ userId: 'old-user' })
      await oldSession.promise
    })
    expect(result.current.session).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('ignores a stale API 401 after a new login', async () => {
    const { result } = renderHook(useSession, { wrapper: SessionProvider })
    await waitFor(() => expect(result.current.loading).toBe(false))
    const pending = deferred<Response>()
    const client = createApiClient(
      '',
      vi.fn<typeof fetch>().mockReturnValue(pending.promise),
    )
    const request = client.api.events.$get()
    await act(() => result.current.signIn('operator', 'secret-password'))
    await act(async () => {
      pending.resolve(new Response(null, { status: 401 }))
      await request
    })
    expect(result.current.session).toEqual({ userId: 'operator' })
  })

  it('retains the session if logout could not be confirmed', async () => {
    vi.mocked(workspaceRepository.signOut).mockRejectedValueOnce(
      new Error('offline'),
    )
    const { result } = renderHook(useSession, { wrapper: SessionProvider })
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await expect(result.current.signOut()).rejects.toThrow('offline')
    })
    expect(result.current.session).toEqual({ userId: 'operator' })
  })
})
