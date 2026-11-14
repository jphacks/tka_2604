let generation = 0
const listeners = new Set<() => void>()

// A response from a previous login must not invalidate the current session.
export function advanceSessionGeneration() {
  generation += 1
}

export function onUnauthorized(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function createSessionFetch(
  fetcher: typeof fetch = (...args) => fetch(...args),
): typeof fetch {
  return async (input, init) => {
    const requestGeneration = generation
    const response = await fetcher(input, {
      ...init,
      credentials: 'same-origin',
      cache: 'no-store',
    })
    const path = new URL(
      input instanceof Request ? input.url : String(input),
      'http://localhost',
    ).pathname
    if (
      response.status === 401 &&
      requestGeneration === generation &&
      path !== '/api/auth/login' &&
      path !== '/api/auth/register' &&
      path !== '/api/auth/session'
    ) {
      advanceSessionGeneration()
      for (const listener of listeners) listener()
    }
    return response
  }
}
