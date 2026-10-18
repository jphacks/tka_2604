import { useState } from 'react'

import { useSession } from '../../../app/sessionContext'

export function useLogin() {
  const { signIn } = useSession()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function login() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await signIn('operator@example.com')
    } catch {
      setError('ワークスペースを開けませんでした。もう一度お試しください。')
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, login }
}
