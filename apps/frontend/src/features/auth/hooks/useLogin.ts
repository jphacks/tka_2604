import { useRef, useState } from 'react'

import { useSession } from '../../../app/sessionContext'

export function useLogin() {
  const { signIn, signUp, notice } = useSession()
  const [registering, setRegistering] = useState(false)
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  async function login() {
    if (inFlight.current) return
    if (registering && password !== confirmation) {
      setError('確認用のパスワードが一致していません。')
      return
    }
    inFlight.current = true
    setBusy(true)
    setError('')
    try {
      await (registering ? signUp : signIn)(userId.trim(), password)
    } catch (cause: unknown) {
      setError(
        cause instanceof Error && !(cause instanceof TypeError)
          ? cause.message
          : '通信できませんでした。接続を確認してもう一度お試しください。',
      )
    } finally {
      inFlight.current = false
      setPassword('')
      setConfirmation('')
      setBusy(false)
    }
  }
  function switchMode() {
    if (inFlight.current) return
    setRegistering((value) => !value)
    setPassword('')
    setConfirmation('')
    setError('')
  }
  return {
    registering,
    switchMode,
    userId,
    setUserId,
    password,
    setPassword,
    confirmation,
    setConfirmation,
    busy,
    error,
    notice,
    login,
  }
}
