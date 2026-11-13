import { createApiClient, ensureOk } from '../../../shared/api/client'
import { colors, type Profile } from '../model/profile'
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
    !('avatarText' in value) ||
    typeof value.avatarText !== 'string' ||
    !('avatarColor' in value) ||
    typeof value.avatarColor !== 'string'
  )
    throw new Error('プロフィールを読み取れませんでした。')
  const color = colors.find((item) => item.value === value.avatarColor)
  if (!color || !value.displayName.trim() || !value.avatarText.trim())
    throw new Error('プロフィールを読み取れませんでした。')
  return {
    displayName: value.displayName,
    avatarText: value.avatarText,
    avatarColor: color.value,
  }
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
