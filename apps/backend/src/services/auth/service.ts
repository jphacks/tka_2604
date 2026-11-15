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
    async profile(userId: string) {
      const profile = await repository.findProfile(userId)
      if (!profile) return null
      const displayName =
        profile.displayName ??
        (profile.isRegistered ? (profile.loginId ?? userId) : 'ゲスト')
      return {
        displayName,
      }
    },
    async updateProfile(userId: string, profile: { displayName: string }) {
      const saved = await repository.updateProfile(userId, profile)
      return saved ? profile : null
    },
    async limitAttempts(
      operation: 'login' | 'register' | 'guest',
      userId: string,
      address: string,
    ) {
      const now = Date.now()
      // IP is supplied by Cloudflare, never X-Forwarded-For or the client body.
      const ip = await repository.reserveAttempt(
        `ip:${await hashToken(address)}`,
        30,
        now,
      )
      if (!ip.allowed) throw new AuthError('rate_limited', 429, ip.retryAfter)
      const account = await repository.reserveAttempt(
        // An unauthenticated caller must not consume another IP's login
        // allowance. Registration and login also have independent buckets.
        `${operation}:${await hashToken(JSON.stringify([userId, address]))}`,
        10,
        now,
      )
      if (!account.allowed)
        throw new AuthError('rate_limited', 429, account.retryAfter)
    },
    async login(userId: string, password: string, previousToken?: string) {
      const user = await repository.findUser(userId)
      if (
        !(await verifyPassword(
          password,
          user?.isRegistered ? user.passwordHash : undefined,
        )) ||
        !user?.isRegistered
      )
        throw new AuthError('invalid_credentials', 401)
      return issueSession(
        user.userId,
        { kind: 'login', passwordHash: user.passwordHash },
        previousToken,
      )
    },
    async guest(previousToken?: string) {
      const current = await this.session(previousToken)
      if (current) return { ...current, created: false }
      const userId = `guest_${crypto.randomUUID()}`
      const session = await issueSession(
        userId,
        {
          kind: 'guest',
          passwordHash: `guest:${await hashToken(newSessionToken())}`,
        },
        previousToken,
      )
      return { ...session, isRegistered: false, created: true }
    },
    async completeRegistration(
      loginId: string,
      password: string,
      previousToken?: string,
    ) {
      const current = await this.session(previousToken)
      if (!current) return null
      if (current.isRegistered || loginId === 'demo-owner')
        throw new AuthError('user_id_unavailable', 409)
      const token = newSessionToken()
      const now = Date.now()
      const saved = await repository.completeRegistration(
        current.userId,
        loginId,
        await hashPassword(password),
        await hashToken(previousToken!),
        await hashToken(token),
        now,
        now + SESSION_SECONDS * 1000,
      )
      if (!saved) throw new AuthError('user_id_unavailable', 409)
      return { userId: current.userId, loginId, isRegistered: true, token }
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
