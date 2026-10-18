import { Hono, type MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'
import { validator } from 'hono/validator'
import { z } from 'zod'

import { AuthError } from '../services/auth/errors'
import {
  type AuthEnv,
  clearSessionCookie,
  createAuthService,
  invalidOrigin,
  isSafeMethod,
  readSessionCookie,
  sameOrigin,
  secureTransport,
  unauthorized,
  writeSessionCookie,
} from './auth-security'

const loginInput = z.strictObject({
  userId: z.string().min(1).max(128),
  password: z.string().min(1).max(128),
})
const registrationInput = z.strictObject({
  userId: z
    .string()
    .min(3)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/),
  password: z.string().min(15).max(128),
})
function credentials<T extends z.ZodType>(schema: T) {
  return validator('json', (value: unknown, c) => {
    const result = schema.safeParse(value)
    if (!result.success)
      return c.json(
        {
          error: {
            code: 'invalid_input',
            message: 'ログインIDとパスワードの入力を確認してください。',
            details: [],
          },
        },
        422,
      )
    return result.data
  })
}
const requireAuthOrigin: MiddlewareHandler<AuthEnv> = async (c, next) => {
  c.header('Cache-Control', 'no-store')
  // Plain HTTP credentials are permitted only for local development.
  if (!secureTransport(c)) return invalidOrigin(c)
  if (!isSafeMethod(c.req.method) && !sameOrigin(c)) return invalidOrigin(c)
  await next()
}

export const authRoutes = new Hono<AuthEnv>()
  .onError((error, c) => {
    if (error instanceof AuthError) {
      if (error.retryAfter) c.header('Retry-After', String(error.retryAfter))
      const messages = {
        invalid_credentials: 'ログインIDまたはパスワードが正しくありません。',
        user_id_unavailable: 'このログインIDは使用できません。',
        rate_limited: '試行回数が多いため、しばらく待ってからお試しください。',
      }
      return c.json(
        {
          error: {
            code: error.code,
            message: messages[error.code],
            details: [],
          },
        },
        error.status,
      )
    }
    if (error instanceof HTTPException && error.status === 400)
      return c.json(
        {
          error: {
            code: 'invalid_input',
            message: 'JSONの形式が不正です。',
            details: [],
          },
        },
        400,
      )
    return c.json(
      {
        error: {
          code: 'internal_error',
          message: '認証処理に失敗しました。もう一度お試しください。',
          details: [],
        },
      },
      500,
    )
  })
  .use('*', requireAuthOrigin)
  .use(
    '*',
    bodyLimit({
      maxSize: 4096,
      onError: (c) =>
        c.json(
          {
            error: {
              code: 'invalid_input',
              message: '入力が長すぎます。',
              details: [],
            },
          },
          413,
        ),
    }),
  )
  .post('/login', credentials(loginInput), async (c) => {
    const input = c.req.valid('json')
    const service = createAuthService(c)
    await service.limitAttempts(
      input.userId,
      c.req.header('CF-Connecting-IP') ?? 'local',
    )
    const session = await service.login(
      input.userId,
      input.password,
      readSessionCookie(c),
    )
    writeSessionCookie(c, session.token)
    return c.json({ userId: session.userId }, 200)
  })
  .post('/register', credentials(registrationInput), async (c) => {
    const input = c.req.valid('json')
    const service = createAuthService(c)
    await service.limitAttempts(
      input.userId,
      c.req.header('CF-Connecting-IP') ?? 'local',
    )
    const session = await service.register(
      input.userId,
      input.password,
      readSessionCookie(c),
    )
    writeSessionCookie(c, session.token)
    return c.json({ userId: session.userId }, 201)
  })
  .get('/session', async (c) => {
    const token = readSessionCookie(c)
    if (!token) return unauthorized(c)
    const session = await createAuthService(c).session(token)
    // Only explicit logout clears a cookie; this may be an older request.
    if (!session) return unauthorized(c)
    return c.json(session, 200)
  })
  .post('/logout', async (c) => {
    const token = readSessionCookie(c)
    if (token) await createAuthService(c).logout(token)
    clearSessionCookie(c)
    return c.body(null, 204)
  })
