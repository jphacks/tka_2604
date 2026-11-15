import { createApiClient, ensureOk } from '../api/client'
import type { Session } from '../model/workspace'

const client = createApiClient('').api.auth

async function readSession(
  response: Pick<Response, 'ok' | 'status' | 'json'>,
): Promise<Session> {
  await ensureOk(response)
  const body: unknown = await response.json()
  if (
    !body ||
    typeof body !== 'object' ||
    !('userId' in body) ||
    typeof body.userId !== 'string' ||
    !body.userId
  ) {
    throw new Error('ログイン情報を読み取れませんでした。')
  }
  return {
    userId: body.userId,
    ...('isRegistered' in body && typeof body.isRegistered === 'boolean'
      ? { isRegistered: body.isRegistered }
      : {}),
    ...('loginId' in body &&
    (typeof body.loginId === 'string' || body.loginId === null)
      ? { loginId: body.loginId }
      : {}),
  }
}

export const workspaceSession = {
  async getSession() {
    const response = await client.session.$get()
    if (response.status === 401) return null
    return readSession(response)
  },
  async signIn(userId: string, password: string) {
    return readSession(await client.login.$post({ json: { userId, password } }))
  },
  async signUp(userId: string, password: string) {
    return readSession(
      await client.register.$post({ json: { userId, password } }),
    )
  },
  async startGuest() {
    return readSession(await client.guest.$post())
  },
  async completeRegistration(userId: string, password: string) {
    return readSession(
      await client['complete-registration'].$post({
        json: { userId, password },
      }),
    )
  },
  async signOut() {
    await ensureOk(await client.logout.$post())
  },
}
