import type {
  AuthRepository,
  SessionCredentials,
} from '../../repositories/auth'
import { AuthError } from './errors'
import { hashPassword, verifyPassword } from './password'
import {
  hashToken,
  newSessionToken,
  SESSION_SECONDS,
  validSessionToken,
} from './session'

export function authService(repository: AuthRepository) {
  async function issueSession(
    userId: string,
    credentials: SessionCredentials,
    previousToken?: string,
  ) {
    const token = newSessionToken()
    const now = Date.now()
    const saved = await repository.saveSession(
      await hashToken(token),
      userId,
      now + SESSION_SECONDS * 1000,
      validSessionToken(previousToken) ? await hashToken(previousToken) : null,
      now,
      credentials,
    )
    if (!saved) {
      if (credentials.kind === 'register')
        throw new AuthError('user_id_unavailable', 409)
      throw new AuthError('invalid_credentials', 401)
    }
    return { userId, token }
  }
  return {
    async limitAttempts(userId: string, address: string) {
      const now = Date.now()
      // IP is supplied by Cloudflare, never X-Forwarded-For or the client body.
      const ip = await repository.reserveAttempt(
        `ip:${await hashToken(address)}`,
        30,
        now,
      )
      if (!ip.allowed) throw new AuthError('rate_limited', 429, ip.retryAfter)
      const account = await repository.reserveAttempt(
        `user:${await hashToken(userId)}`,
        10,
        now,
      )
      if (!account.allowed)
        throw new AuthError('rate_limited', 429, account.retryAfter)
    },
    async login(userId: string, password: string, previousToken?: string) {
      const user = await repository.findUser(userId)
      if (!(await verifyPassword(password, user?.passwordHash)) || !user)
        throw new AuthError('invalid_credentials', 401)
      return issueSession(
        user.userId,
        { kind: 'login', passwordHash: user.passwordHash },
        previousToken,
      )
    },
    async register(userId: string, password: string, previousToken?: string) {
      // The legacy owner must only be provisioned administratively, even on a
      // fresh database, so a public signup cannot claim existing demo data.
      if (userId === 'demo-owner')
        throw new AuthError('user_id_unavailable', 409)
      const passwordHash = await hashPassword(password)
      return issueSession(
        userId,
        { kind: 'register', passwordHash },
        previousToken,
      )
    },
    async session(token?: string) {
      if (!validSessionToken(token)) return null
      return repository.findSession(await hashToken(token), Date.now())
    },
    async logout(token?: string) {
      if (validSessionToken(token))
        await repository.deleteSession(await hashToken(token))
    },
  }
}
