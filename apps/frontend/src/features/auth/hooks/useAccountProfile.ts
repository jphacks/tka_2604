import { useEffect, useState } from 'react'

import type { Profile } from '../model/profile'
import { profileRepository } from '../repositories/profileRepository'

export function useAccountProfile(userId: string) {
  const [profile, setProfile] = useState<Profile>({
    displayName: userId,
    avatarText: Array.from(userId)[0].toUpperCase(),
    avatarColor: 'blue',
  })
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    void profileRepository
      .getProfile()
      .then((value) => {
        if (active) {
          setProfile(value)
          setLoaded(true)
        }
      })
      .catch(() => {
        if (active)
          setLoadError(
            'プロフィールを取得できませんでした。接続を確認して再試行してください。',
          )
      })
    return () => {
      active = false
    }
  }, [attempt])
  function retry() {
    setLoadError('')
    setAttempt((value) => value + 1)
  }
  async function saveProfile(value: Profile) {
    setProfile(await profileRepository.saveProfile(value))
  }
  return { profile, loaded, loadError, retry, saveProfile }
}
