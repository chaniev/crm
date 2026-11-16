import { useEffect, useState } from 'react'
import { readScheduleUrlState, writeScheduleUrlState, type ScheduleUrlState } from './scheduleUrlState'

export function useScheduleUrlState() {
  const [urlState, setUrlState] = useState(readScheduleUrlState)

  useEffect(() => {
    function syncFromHistory() {
      setUrlState(readScheduleUrlState())
    }

    window.addEventListener('popstate', syncFromHistory)

    return () => window.removeEventListener('popstate', syncFromHistory)
  }, [])

  function applyState(next: Partial<ScheduleUrlState>, options: { replace?: boolean } = {}) {
    setUrlState((current) => {
      const merged = { ...current, ...next }
      writeScheduleUrlState(merged, options)
      return merged
    })
  }

  return { urlState, applyState }
}
