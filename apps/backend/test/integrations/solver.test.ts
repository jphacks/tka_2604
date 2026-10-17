import { afterEach, expect, it, vi } from 'vitest'

import { solverClient } from '../../src/integrations/solver'
import type { SolverRequest } from '../../src/services/solver/types'

const input: SolverRequest = {
  eventId: 'e',
  bands: [{ bandId: 'a' }],
  parts: [{ partId: 'p', sortOrder: 0 }],
  members: [],
  memberships: [],
  constraints: [],
  currentPlacements: [],
}
afterEach(() => vi.useRealTimers())
it('uses a 30-second deadline by default, including the final millisecond', async () => {
  vi.useFakeTimers()
  const send = vi.fn<typeof fetch>().mockImplementation(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new Error('aborted')),
        )
      }),
  )
  const pending = expect(
    solverClient(
      { url: 'https://solver.invalid', token: 'test-only' },
      send,
    )(input),
  ).rejects.toMatchObject({ code: 'solver_timeout' })
  await vi.advanceTimersByTimeAsync(29_999)
  expect(send.mock.calls[0][1]?.signal?.aborted).toBe(false)
  await vi.advanceTimersByTimeAsync(1)
  expect(send.mock.calls[0][1]?.signal?.aborted).toBe(true)
  await pending
  expect(vi.getTimerCount()).toBe(0)
})
it('aborts timed out communication without changing it into unknown', async () => {
  vi.useFakeTimers()
  const send = vi.fn<typeof fetch>().mockImplementation(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new Error('aborted')),
        )
      }),
  )
  const solve = solverClient(
    { url: 'https://solver.invalid', token: 'test-only' },
    send,
    25,
  )
  const pending = expect(solve(input)).rejects.toMatchObject({
    code: 'solver_timeout',
  })
  await vi.advanceTimersByTimeAsync(25)
  await pending
  expect(send.mock.calls[0][1]?.signal?.aborted).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
})
it('bounds response size and cancels oversized bodies', async () => {
  const cancel = vi.fn()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1))
    },
    cancel,
  })
  const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(body))
  await expect(
    solverClient(
      { url: 'https://solver.invalid', token: 'test-only' },
      send,
    )(input),
  ).rejects.toMatchObject({ code: 'solver_invalid_response' })
  expect(cancel).toHaveBeenCalled()
})
it('does not forward the bearer token to redirects or non-local HTTP', async () => {
  const send = vi.fn<typeof fetch>()
  await expect(
    solverClient(
      { url: 'http://solver.invalid', token: 'test-only' },
      send,
    )(input),
  ).rejects.toMatchObject({ code: 'solver_unavailable' })
  expect(send).not.toHaveBeenCalled()
})

it('rejects redirects without following them', async () => {
  const send = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(null, {
      status: 302,
      headers: { Location: 'https://other.invalid' },
    }),
  )
  await expect(
    solverClient(
      { url: 'https://solver.invalid', token: 'test-only' },
      send,
    )(input),
  ).rejects.toMatchObject({ code: 'solver_upstream_error' })
  expect(send).toHaveBeenCalledTimes(1)
  expect(send.mock.calls[0][1]?.redirect).toBe('manual')
})
