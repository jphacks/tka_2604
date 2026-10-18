import { describe, expect, it, vi } from 'vitest'

import { deferred } from '../../test/deferred'
import {
  advanceSessionGeneration,
  createSessionFetch,
  onUnauthorized,
} from './sessionEvents'

describe('session-aware transport', () => {
  it('uses same-origin cookies and notifies once for concurrent unauthorized responses', async () => {
    const pending = deferred<Response>()
    const fetcher = vi.fn<typeof fetch>().mockReturnValue(pending.promise)
    const fetch = createSessionFetch(fetcher)
    const unauthorized = vi.fn()
    const unsubscribe = onUnauthorized(unauthorized)
    try {
      const requests = [
        fetch('/api/events'),
        fetch('/api/events/event/solve', { method: 'POST' }),
      ]
      pending.resolve(new Response(null, { status: 401 }))
      await Promise.all(requests)
      expect(unauthorized).toHaveBeenCalledOnce()
      expect(fetcher).toHaveBeenCalledWith('/api/events', {
        credentials: 'same-origin',
        cache: 'no-store',
      })
    } finally {
      unsubscribe()
    }
  })

  it.each(['login', 'register', 'session'])(
    'lets auth/%s handle its own unauthorized response',
    async (endpoint) => {
      const fetch = createSessionFetch(
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response(null, { status: 401 })),
      )
      const unauthorized = vi.fn()
      const unsubscribe = onUnauthorized(unauthorized)
      try {
        await fetch(`/api/auth/${endpoint}`)
        expect(unauthorized).not.toHaveBeenCalled()
      } finally {
        unsubscribe()
      }
    },
  )

  it('ignores unauthorized responses from an earlier authentication generation', async () => {
    const pending = deferred<Response>()
    const fetch = createSessionFetch(
      vi.fn<typeof fetch>().mockReturnValue(pending.promise),
    )
    const unauthorized = vi.fn()
    const unsubscribe = onUnauthorized(unauthorized)
    try {
      const request = fetch('/api/events')
      advanceSessionGeneration()
      pending.resolve(new Response(null, { status: 401 }))
      await request
      expect(unauthorized).not.toHaveBeenCalled()
    } finally {
      unsubscribe()
    }
  })
})
