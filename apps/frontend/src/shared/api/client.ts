import { hc } from 'hono/client'

import type { AppType } from '../../../../backend/src/index'

export function createApiClient(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
) {
  return hc<AppType>(baseUrl, { fetch: fetcher })
}
export type ApiClient = ReturnType<typeof createApiClient>

export async function ensureOk(
  response: Pick<Response, 'ok' | 'status' | 'json'>,
) {
  if (response.ok) return
  let body: unknown
  try {
    body = await response.json()
  } catch {
    // Proxies may return HTML or an empty body on failure.
  }
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const error = body.error
    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof error.message === 'string'
    ) {
      throw new Error(error.message)
    }
  }
  throw new Error(
    `通信に失敗しました（${response.status}）。もう一度お試しください。`,
  )
}
