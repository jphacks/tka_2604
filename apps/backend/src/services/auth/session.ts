export const SESSION_COOKIE = 'setly_session'
export const SECURE_SESSION_COOKIE = '__Host-setly_session'
export const SESSION_SECONDS = 24 * 60 * 60

export function validSessionToken(token: string | undefined): token is string {
  return token !== undefined && /^[a-f0-9]{64}$/.test(token)
}
export function newSessionToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}
export async function hashToken(token: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  )
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}
