import { createContext, useContext } from 'react'

import type { Session } from '../shared/model/workspace'

export interface SessionContextValue {
  session: Session | null
  loading: boolean
  restoreError: string
  notice: string
  retrySession: () => Promise<void>
  signIn: (userId: string, password: string) => Promise<void>
  signUp: (userId: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}
export const SessionContext = createContext<SessionContextValue | null>(null)
export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('SessionProvider is required')
  return value
}
