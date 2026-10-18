import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  advanceSessionGeneration,
  onUnauthorized,
} from '../shared/api/sessionEvents'
import type { Session } from '../shared/model/workspace'
import { workspaceRepository } from '../shared/repositories/workspaceRepository'
import { SessionContext } from './sessionContext'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [restoreError, setRestoreError] = useState('')
  const [notice, setNotice] = useState('')
  const operation = useRef(0)
  const loadSession = useCallback(async (id: number) => {
    try {
      const value = await workspaceRepository.getSession()
      if (operation.current === id) {
        setSession(value)
        setRestoreError('')
      }
    } catch {
      if (operation.current === id)
        setRestoreError(
          'ログイン状態を確認できませんでした。接続を確認して再試行してください。',
        )
    } finally {
      if (operation.current === id) setLoading(false)
    }
  }, [])
  useEffect(() => {
    advanceSessionGeneration()
    const unsubscribe = onUnauthorized(() => {
      operation.current += 1
      setSession(null)
      setLoading(false)
      setRestoreError('')
      setNotice(
        'セッションの有効期限が切れました。もう一度ログインしてください。',
      )
    })
    void loadSession(++operation.current)
    return () => {
      operation.current += 1
      unsubscribe()
    }
  }, [loadSession])
  async function retrySession() {
    setLoading(true)
    setRestoreError('')
    await loadSession(++operation.current)
  }
  async function authenticate(request: () => Promise<Session>) {
    const id = ++operation.current
    advanceSessionGeneration()
    const value = await request()
    if (operation.current === id) {
      advanceSessionGeneration()
      setSession(value)
      setLoading(false)
      setRestoreError('')
      setNotice('')
    }
  }
  async function signIn(userId: string, password: string) {
    await authenticate(() => workspaceRepository.signIn(userId, password))
  }
  async function signUp(userId: string, password: string) {
    await authenticate(() => workspaceRepository.signUp(userId, password))
  }
  async function signOut() {
    const id = ++operation.current
    advanceSessionGeneration()
    await workspaceRepository.signOut()
    if (operation.current === id) {
      advanceSessionGeneration()
      setSession(null)
      setLoading(false)
      setRestoreError('')
      setNotice('')
    }
  }
  return (
    <SessionContext.Provider
      value={{
        session,
        loading,
        restoreError,
        notice,
        retrySession,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}
