import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { credentials } from '../../src/routes/auth-input'

const contentTypes = [
  'application/json',
  'application/json; charset=utf-8',
  'application/json ; charset=utf-8',
  'application/json;',
  'application/json; unusual_parameter=value',
  'Application/JSON; charset=UTF-8',
]
const valid = { userId: 'test-operator', password: 'test-only-password' }

function setup() {
  const save = vi.fn()
  const app = new Hono().post(
    '/',
    bodyLimit({ maxSize: 4096 }),
    credentials(z.strictObject({ userId: z.string(), password: z.string() })),
    (c) => {
      save(c.req.valid('json'))
      return c.json({ userId: c.req.valid('json').userId }, 201)
    },
  )
  const send = (contentType: string | undefined, body: string) =>
    app.request('/', {
      method: 'POST',
      headers: contentType ? { 'Content-Type': contentType } : {},
      body,
    })
  return { send, save }
}

describe('authentication JSON validation', () => {
  it.each(contentTypes)('parses valid input with %s', async (contentType) => {
    const { send, save } = setup()
    const response = await send(contentType, JSON.stringify(valid))
    expect(response.status).toBe(201)
    expect(save).toHaveBeenCalledExactlyOnceWith(valid)
  })

  it.each(contentTypes)(
    'rejects extra fields with %s before saving',
    async (contentType) => {
      const { send, save } = setup()
      const response = await send(
        contentType,
        JSON.stringify({ ...valid, extra: 'reject' }),
      )
      expect(response.status).toBe(422)
      expect(await response.json()).toMatchObject({
        error: { code: 'invalid_input' },
      })
      expect(save).not.toHaveBeenCalled()
    },
  )

  it.each(contentTypes)(
    'rejects malformed JSON with %s before saving',
    async (contentType) => {
      const { send, save } = setup()
      expect((await send(contentType, '{')).status).toBe(400)
      expect(save).not.toHaveBeenCalled()
    },
  )

  it.each([undefined, 'text/plain', 'application/jsonp'])(
    'rejects non-JSON media type %s',
    async (contentType) => {
      const { send, save } = setup()
      expect((await send(contentType, JSON.stringify(valid))).status).toBe(422)
      expect(save).not.toHaveBeenCalled()
    },
  )

  it('preserves the authentication body size limit', async () => {
    const { send, save } = setup()
    expect(
      (
        await send(
          'application/json;',
          JSON.stringify({ ...valid, password: 'a'.repeat(4096) }),
        )
      ).status,
    ).toBe(413)
    expect(save).not.toHaveBeenCalled()
  })
})
