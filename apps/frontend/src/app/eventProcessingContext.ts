import type { Dispatch, SetStateAction } from 'react'
import { createContext, useContext } from 'react'

export const EventProcessingContext = createContext<Dispatch<
  SetStateAction<string | undefined>
> | null>(null)

export function useEventProcessing() {
  return useContext(EventProcessingContext)
}
