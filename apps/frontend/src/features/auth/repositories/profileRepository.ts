import { createApiClient, ensureOk } from '../../../shared/api/client'
import type { Profile } from '../model/profile'
const client = createApiClient('').api.auth.profile
async function readProfile(
  response: Pick<Response, 'ok' | 'status' | 'json'>,
): Promise<Profile> {
  await ensureOk(response)
  const value: unknown = await response.json()
  if (
    !value ||
    typeof value !== 'object' ||
    !('displayName' in value) ||
    typeof value.displayName !== 'string' ||
    !value.displayName.trim()
  )
    throw new Error('プロフィールを読み取れませんでした。')
  return { displayName: value.displayName }
}

export const profileRepository = {
  async getProfile() {
    return readProfile(await client.$get())
  },
  async saveProfile(profile: Profile) {
    return readProfile(
      await client.$patch({
        json: profile,
      }),
    )
  },
}
