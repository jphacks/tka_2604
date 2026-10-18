import type { Context, MiddlewareHandler } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'

import { createDb } from '../db/index'
import { authRepository } from '../repositories/auth'
import { authService } from '../services/auth/service'
import {
  SECURE_SESSION_COOKIE,
  SESSION_COOKIE,
  SESSION_SECONDS,
  validSessionToken,
} from '../services/auth/session'

export type AuthVariables = { userId: string }
export type AuthEnv = { Bindings: CloudflareBindings; Variables: AuthVariables }

function cookieOptions(c: Context) {
  const url = new URL(c.req.url)
  return {
    path: '/',
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'Lax' as const,
  }
}
function cookieName(c: Context) {
  return cookieOptions(c).secure ? SECURE_SESSION_COOKIE : SESSION_COOKIE
}
export function readSessionCookie(c: Context) {
  return getCookie(c, cookieName(c))
}
export function writeSessionCookie(c: Context, token: string) {
  setCookie(c, cookieName(c), token, {
    ...cookieOptions(c),
    maxAge: SESSION_SECONDS,
  })
}
export function clearSessionCookie(c: Context) {
  deleteCookie(c, cookieName(c), cookieOptions(c))
}
export function createAuthService(c: Context<AuthEnv>) {
  return authService(authRepository(createDb(c.env.DB)))
}
export function unauthorized(c: Context) {
  c.header('Cache-Control', 'no-store')
  return c.json(
    {
      error: {
        code: 'unauthorized',
        message: 'ログインしてください。',
        details: [],
      },
    },
    401,
  )
}
export function invalidOrigin(c: Context) {
  return c.json(
    {
      error: {
        code: 'invalid_origin',
        message: 'この送信元からは操作できません。',
        details: [],
      },
    },
    403,
  )
}
export function isSafeMethod(method: string) {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS'
}
export function secureTransport(c: Context) {
  const url = new URL(c.req.url)
  return (
    url.protocol === 'https:' ||
    (url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  )
}
export function sameOrigin(c: Context) {
  const url = new URL(c.req.url)
  const origin = c.req.header('Origin')
  const site = c.req.header('Sec-Fetch-Site')
  return (
    origin === url.origin &&
    (!site || site === 'same-origin' || site === 'none')
  )
}

export const requireSession: MiddlewareHandler<AuthEnv> = async (c, next) => {
  c.header('Cache-Control', 'no-store')
  if (!secureTransport(c)) return invalidOrigin(c)
  // An outer router may already have verified the same request.
  if (!c.get('userId')) {
    const token = readSessionCookie(c)
    if (!validSessionToken(token)) return unauthorized(c)
    try {
      const session = await createAuthService(c).session(token)
      // A delayed response must not erase a cookie from a newer login.
      if (!session) return unauthorized(c)
      c.set('userId', session.userId)
    } catch {
      return c.json(
        {
          error: {
            code: 'internal_error',
            message: 'ログイン状態を確認できませんでした。',
            details: [],
          },
        },
        500,
      )
    }
  }
  if (!isSafeMethod(c.req.method) && !sameOrigin(c)) return invalidOrigin(c)
  await next()
}

function publicOperation(method: string, path: string) {
  if ((method === 'GET' || method === 'HEAD') && path === '/api/health')
    return true
  if (method === 'GET' && path === '/api/auth/session') return true
  if (
    method === 'POST' &&
    ['/api/auth/login', '/api/auth/register', '/api/auth/logout'].includes(path)
  )
    return true
  return (
    ((method === 'GET' || method === 'HEAD') &&
      /^\/api\/events\/[^/]+\/form$/.test(path)) ||
    (method === 'POST' && /^\/api\/events\/[^/]+\/form\/bands$/.test(path)) ||
    (method === 'PATCH' &&
      /^\/api\/events\/[^/]+\/form\/bands\/[^/]+$/.test(path))
  )
}

export const protectApi: MiddlewareHandler<AuthEnv> = async (c, next) => {
  c.header('Cache-Control', 'no-store')
  c.header('X-Content-Type-Options', 'nosniff')
  if (publicOperation(c.req.method, c.req.path)) return next()
  return requireSession(c, next)
}
