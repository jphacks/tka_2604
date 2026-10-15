import { useCallback } from 'react'

import { workspaceRepository } from '../repositories/workspaceRepository'
import { useResource } from './useResource'

export function useEventResource(eventId: string) {
  const load = useCallback(
    (signal: AbortSignal) =>
      workspaceRepository.getRegistration(eventId, signal),
    [eventId],
  )
  return useResource(load)
}
