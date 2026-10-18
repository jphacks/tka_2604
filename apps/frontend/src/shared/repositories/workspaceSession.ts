import type { Session } from '../model/workspace'

// Workspace entry state until the authentication API is available (#57/#59).
// Event and roster data are always loaded from the API.
let session: Session | null = null
export const workspaceSession = {
  getSession() {
    return Promise.resolve(session && { ...session })
  },
  signIn(email: string) {
    session = { name: 'ライブ運営', email }
    return Promise.resolve({ ...session })
  },
  signOut() {
    session = null
    return Promise.resolve()
  },
}
