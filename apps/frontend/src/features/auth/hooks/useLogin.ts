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
    if (registering) {
      if (!/^[A-Za-z0-9_-]{3,20}$/.test(userId.trim())) {
        setError(
          'ログインIDは半角英数字・ハイフン・アンダースコアで3〜20文字にしてください。',
        )
        return
      }
      if (password.length < 7 || password.length > 32) {
        setError('パスワードは7〜32文字にしてください。')
        return
      }
      if (!/\S/u.test(password)) {
        setError('空白のみのパスワードは使用できません。')
        return
      }
    }
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
  function selectMode(nextRegistering: boolean) {
    if (inFlight.current || nextRegistering === registering) return
    setRegistering(nextRegistering)
    setPassword('')
    setConfirmation('')
    setError('')
  }
  return {
    registering,
    selectMode,
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
