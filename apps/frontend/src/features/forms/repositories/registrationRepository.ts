import { hc } from 'hono/client'

import type { FormAppType } from '../../../../../backend/src/routes/form'
import { RegistrationError, type RegistrationRepository } from './types'

const client = hc<FormAppType>('/api/events')

async function read<T>(response: Pick<Response, 'ok' | 'json'>): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: {
        code?: string
        message?: string
        details?: { reason: string }[]
      }
    } | null
    const error = body?.error
    throw new RegistrationError(
      error?.code ?? 'request_failed',
      [
        error?.message,
        ...(error?.details?.map((detail) => detail.reason) ?? []),
      ]
        .filter(Boolean)
        .join(' ') || '通信に失敗しました。時間をおいて再試行してください。',
    )
  }
  return response.json<T>()
}

// Public form transport, shared with future form integrations (#59).
export const registrationRepository: RegistrationRepository = {
  async get(eventId, signal) {
    return read(
      await client[':eventId'].form.$get(
        { param: { eventId } },
        { init: { signal } },
      ),
    )
  },
  async create(eventId, input) {
    return read(
      await client[':eventId'].form.bands.$post({
        param: { eventId },
        json: input,
      }),
    )
  },
  async update(eventId, bandId, input) {
    return read(
      await client[':eventId'].form.bands[':bandId'].$patch({
        param: { eventId, bandId },
        json: input,
      }),
    )
  },
}
