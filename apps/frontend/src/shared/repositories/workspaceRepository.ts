import { mockWorkspaceRepository } from '../../mock/workspaceRepository'
import { eventsApi } from '../api/events'
import { dataSource, unavailable } from './dataSource'
import type { WorkspaceRepository } from './types'

export const workspaceRepository: WorkspaceRepository =
  dataSource === 'api'
    ? {
        // Authentication remains the explicitly labelled demo session until #57/#59.
        getSession: () => mockWorkspaceRepository.getSession(),
        signIn: (email) => mockWorkspaceRepository.signIn(email),
        signOut: () => mockWorkspaceRepository.signOut(),
        ...eventsApi,
        async getRoster(id, signal) {
          return {
            data: await eventsApi.getEvent(id, signal),
            submissions: null,
          }
        },
        getRegistration: unavailable,
        updateForm: unavailable,
        addPerformance: unavailable,
        submitPerformance: unavailable,
        updatePerformance: unavailable,
        deletePerformance: unavailable,
        rememberEvent() {},
      }
    : mockWorkspaceRepository
