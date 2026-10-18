import { eventsApi } from '../api/events'
import type { WorkspaceRepository } from './types'
import { workspaceSession } from './workspaceSession'

export const workspaceRepository: WorkspaceRepository = {
  ...workspaceSession,
  ...eventsApi,
  async getRoster(id, signal) {
    return eventsApi.getEvent(id, signal)
  },
}
