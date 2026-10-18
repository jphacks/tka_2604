import { afterEach, describe, expect, it, vi } from 'vitest'

import { solverClient } from '../../src/integrations/solver'
import type { SolverRequest } from '../../src/services/solver/contract'

const input: SolverRequest = {
  eventId: 'e',
  bands: [{ bandId: 'a' }],
  members: [],
  memberships: [],
  parts: [{ partId: 'p', bandCount: 4, sortOrder: 0 }],
  constraints: [],
  currentPlacements: [],
}
const config = { url: 'https://solver.invalid', token: 'test-token' }
afterEach(() => vi.useRealTimers())
describe('Solver transport', () => {
  it.each([
    {},
    { url: config.url },
    { ...config, url: 'invalid' },
    { ...config, url: 'http://external.invalid' },
    { ...config, url: 'https://user:pass@solver.invalid' },
  ])(
    'rejects invalid connection settings without sending: %j',
    async (settings) => {
      const send = vi.fn<typeof fetch>()
      await expect(solverClient(settings, send)(input)).rejects.toThrow(
        'solver_unavailable',
      )
      expect(send).not.toHaveBeenCalled()
    },
  )
  it('supports a local mock Solver and removes URL query/fragment data', async () => {
    const send = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ ok: true }))
    expect(
      await solverClient(
        { ...config, url: 'http://localhost:8000/base/?ignored=yes#ignored' },
        send,
      )(input),
    ).toEqual({ ok: true })
    expect(send.mock.calls[0][0]).toBe('http://localhost:8000/base/solve')
    expect(send.mock.calls[0][1]).toMatchObject({
      redirect: 'manual',
      body: JSON.stringify(input),
    })
  })
  it.each([302, 401, 422, 500])(
    'handles upstream HTTP %i without following redirects',
    async (status) => {
      const send = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('private failure', { status }))
      await expect(solverClient(config, send)(input)).rejects.toThrow(
        'solver_upstream_error',
      )
      expect(send).toHaveBeenCalledTimes(1)
    },
  )
  it('distinguishes communication failure, invalid JSON and oversized JSON', async () => {
    await expect(
      solverClient(
        config,
        vi.fn<typeof fetch>().mockRejectedValue(new Error('network')),
      )(input),
    ).rejects.toThrow('solver_upstream_error')
    for (const body of ['{', 'a'.repeat(2 * 1024 * 1024 + 1)]) {
      await expect(
        solverClient(
          config,
          vi.fn<typeof fetch>().mockResolvedValue(new Response(body)),
        )(input),
      ).rejects.toThrow('solver_invalid_response')
    }
  })
  it.each(['headers', 'body'])(
    'enforces the 30-second deadline while waiting for %s',
    async (phase) => {
      vi.useFakeTimers()
      const send = vi.fn<typeof fetch>().mockImplementation(() =>
        phase === 'headers'
          ? new Promise<Response>(() => undefined)
          : Promise.resolve(
              new Response(
                new ReadableStream({
                  start(c) {
                    c.enqueue(new TextEncoder().encode('{'))
                  },
                }),
              ),
            ),
      )
      const pending = solverClient(config, send)(input)
      const assertion = expect(pending).rejects.toThrow('solver_timeout')
      await vi.advanceTimersByTimeAsync(30_000)
      await assertion
      expect(send.mock.calls[0][1]?.signal?.aborted).toBe(true)
    },
  )
})
