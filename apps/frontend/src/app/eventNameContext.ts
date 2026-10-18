import type { Dispatch, SetStateAction } from 'react'
import { createContext, useContext } from 'react'

export const EventNameContext = createContext<Dispatch<
  SetStateAction<string>
> | null>(null)

export function useEventName() {
  return useContext(EventNameContext)
}
