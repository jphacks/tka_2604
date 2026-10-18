import { expect, it } from 'vitest'

import { ensureOk } from './client'

it.each([
  ['solver_unavailable', 503, 'Solverの接続設定'],
  ['solver_timeout', 504, '計算が時間内に完了しませんでした'],
  ['solver_upstream_error', 502, 'Solverと通信できませんでした'],
  ['solver_invalid_response', 502, '計算結果を検証できませんでした'],
])(
  'explains %s without claiming infeasibility',
  async (code, status, message) => {
    await expect(
      ensureOk(
        Response.json(
          {
            error: {
              code,
              message: 'Solverの呼出しまたは応答の検証に失敗しました。',
              details: [],
            },
          },
          { status },
        ),
      ),
    ).rejects.toThrow(message)
  },
)
