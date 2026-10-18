import { createDb } from '../../src/db/index'
import { authSessions } from '../../src/db/schema'

// Seed a real opaque session, so route tests still exercise production auth.
export async function createAuthenticatedHeaders(
  binding: D1Database,
  userId = 'demo-owner',
  origin = 'http://localhost',
): Promise<Record<string, string>> {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  const tokenHash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)),
    ),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('')
  await createDb(binding)
    .insert(authSessions)
    .values({
      tokenHash,
      userId,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    })
  return {
    Cookie: `${origin.startsWith('https:') ? '__Host-setly_session' : 'setly_session'}=${token}`,
    Origin: origin,
  }
}
