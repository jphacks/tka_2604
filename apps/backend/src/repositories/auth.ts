import { and, eq, exists, gt, lte, sql } from 'drizzle-orm'

import type { createDb } from '../db/index'
import { authRateLimits, authSessions, users } from '../db/schema'

type Db = ReturnType<typeof createDb>
export type SessionCredentials = {
  kind: 'login' | 'register'
  passwordHash: string
}
export function authRepository(db: Db) {
  return {
    async findUser(userId: string) {
      return (
        (
          await db.select().from(users).where(eq(users.userId, userId)).limit(1)
        )[0] ?? null
      )
    },
    async saveSession(
      tokenHash: string,
      userId: string,
      expiresAt: number,
      oldTokenHash: string | null,
      now: number,
      credentials: SessionCredentials,
    ) {
      const matchesCredentials = and(
        eq(users.userId, userId),
        eq(users.passwordHash, credentials.passwordHash),
      )
      const insertSession =
        credentials.kind === 'register'
          ? db
              .insert(authSessions)
              .values({ tokenHash, userId, expiresAt })
              .returning({ tokenHash: authSessions.tokenHash })
          : db
              .insert(authSessions)
              .select(
                db
                  .select({
                    tokenHash: sql<string>`${tokenHash}`.as('token_hash'),
                    userId: users.userId,
                    expiresAt: sql<number>`${expiresAt}`.as('expires_at'),
                  })
                  .from(users)
                  .where(matchesCredentials),
              )
              .returning({ tokenHash: authSessions.tokenHash })
      const sessionStatements = [
        db.delete(authSessions).where(lte(authSessions.expiresAt, now)),
        db
          .delete(authSessions)
          .where(
            and(
              eq(authSessions.tokenHash, oldTokenHash ?? ''),
              exists(
                db
                  .select({ userId: users.userId })
                  .from(users)
                  .where(matchesCredentials),
              ),
            ),
          ),
        insertSession,
      ] as const
      try {
        if (credentials.kind === 'register') {
          await db.batch([
            db
              .insert(users)
              .values({ userId, passwordHash: credentials.passwordHash }),
            ...sessionStatements,
          ])
          return true
        } else {
          // Password reset and session issuance are serialized by this batch.
          // A stale verified hash neither issues nor rotates a valid session.
          const [, , inserted] = await db.batch(sessionStatements)
          return inserted.length > 0
        }
      } catch (error) {
        // D1 rolls back the entire batch, including user creation and rotation.
        // Only this specific constraint is an expected registration conflict.
        let cause: unknown = error
        for (let depth = 0; depth < 4 && cause instanceof Error; depth++) {
          if (
            credentials.kind === 'register' &&
            cause.message.includes('UNIQUE constraint failed: users.user_id')
          )
            return false
          cause = cause.cause
        }
        throw error
      }
    },
    async findSession(tokenHash: string, now: number) {
      return (
        (
          await db
            .select({ userId: users.userId })
            .from(authSessions)
            .innerJoin(users, eq(authSessions.userId, users.userId))
            .where(
              and(
                eq(authSessions.tokenHash, tokenHash),
                gt(authSessions.expiresAt, now),
              ),
            )
            .limit(1)
        )[0] ?? null
      )
    },
    async deleteSession(tokenHash: string) {
      await db.delete(authSessions).where(eq(authSessions.tokenHash, tokenHash))
    },
    async reserveAttempt(key: string, limit: number, now: number) {
      // One atomic UPSERT: parallel requests cannot all observe the old count.
      // Refused attempts never extend this fixed window or overflow its count.
      const [row] = await db
        .insert(authRateLimits)
        .values({ key, attempts: 1, expiresAt: now + 60_000 })
        .onConflictDoUpdate({
          target: authRateLimits.key,
          set: {
            attempts: sql`case when ${authRateLimits.expiresAt} <= ${now} then 1 else min(${authRateLimits.attempts} + 1, ${limit + 1}) end`,
            expiresAt: sql`case when ${authRateLimits.expiresAt} <= ${now} then ${now + 60_000} else ${authRateLimits.expiresAt} end`,
          },
        })
        .returning()
      await db.delete(authRateLimits).where(lte(authRateLimits.expiresAt, now))
      return {
        allowed: row.attempts <= limit,
        retryAfter: Math.max(1, Math.ceil((row.expiresAt - now) / 1000)),
      }
    },
  }
}
export type AuthRepository = ReturnType<typeof authRepository>
