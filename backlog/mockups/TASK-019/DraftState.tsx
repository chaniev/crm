import { createContext, useContext, useEffect } from 'react'

export type DraftArea = 'info' | 'groups' | 'memberships' | 'messages'
export const DraftState = createContext<(area: DraftArea, dirty: boolean) => void>(() => {})

export function useDraftState(area: DraftArea, dirty: boolean) {
  const register = useContext(DraftState)
  useEffect(() => {
    register(area, dirty)
    return () => register(area, false)
  }, [area, dirty, register])
}
