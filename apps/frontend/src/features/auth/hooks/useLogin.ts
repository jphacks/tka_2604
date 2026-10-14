import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { useSession } from '../../../app/sessionContext'

export function useLogin() {
  const { signIn } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function login() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await signIn('demo@example.com')
      const state: unknown = location.state
      const destination =
        state && typeof state === 'object' && 'returnTo' in state
          ? state.returnTo
          : undefined
      await navigate(
        typeof destination === 'string' && /^\/event(?:\/|$)/.test(destination)
          ? destination
          : '/event',
        { replace: true },
      )
    } catch {
      setError('デモを開始できませんでした。もう一度お試しください。')
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, login }
}
