import { hc } from 'hono/client'

import type { AppType } from '../../../../backend/src/index'

export function createApiClient(
  baseUrl: string,
  fetcher: typeof fetch = fetch,
) {
  return hc<AppType>(baseUrl, { fetch: fetcher })
}
export type ApiClient = ReturnType<typeof createApiClient>

const solverErrors: Record<string, string> = {
  solver_unavailable:
    'Solverの接続設定が不足しています。管理者に確認してください。現在の配置は保持しています。',
  solver_timeout:
    '計算が時間内に完了しませんでした。現在の配置は保持しています。もう一度お試しください。',
  solver_upstream_error:
    'Solverと通信できませんでした。現在の配置は保持しています。もう一度お試しください。',
  solver_invalid_response:
    '計算結果を検証できませんでした。現在の配置は保持しています。管理者に確認してください。',
}

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
      if ('code' in error && error.code === 'event_save_conflict')
        throw new Error(
          'イベントが更新されました。未保存の編集は保持しています。「最新の状態を取得」から再取得してください。',
        )
      if (
        'code' in error &&
        typeof error.code === 'string' &&
        solverErrors[error.code]
      )
        throw new Error(solverErrors[error.code])
      throw new Error(error.message)
    }
  }
  throw new Error(
    `通信に失敗しました（${response.status}）。もう一度お試しください。`,
  )
}
