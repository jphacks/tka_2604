import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

import type { Session } from '../shared/model/workspace'
import { workspaceRepository } from '../shared/repositories/workspaceRepository'
import { SessionContext } from './sessionContext'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    workspaceRepository
      .getSession()
      .then((value) => {
        if (active) {
          setSession(value)
          setLoading(false)
        }
      })
      .catch(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])
  async function signIn(email: string) {
    setSession(await workspaceRepository.signIn(email))
  }
  async function signOut() {
    await workspaceRepository.signOut()
    setSession(null)
  }
  return (
    <SessionContext.Provider value={{ session, loading, signIn, signOut }}>
      {children}
    </SessionContext.Provider>
  )
}
