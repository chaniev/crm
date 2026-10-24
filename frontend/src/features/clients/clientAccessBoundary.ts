import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, getClient } from '../../lib/api'

export function isClientAccessError(error: unknown) {
  return error instanceof ApiError && (error.status === 403 || error.status === 404)
}

export function useClientAccessBoundary(clientId: string) {
  const generation = useMemo(() => Symbol(clientId), [clientId])
  const lifetime = useRef({ generation, active: true, closed: false })
  const [deniedGeneration, setDeniedGeneration] = useState<symbol | null>(null)
  useEffect(() => {
    lifetime.current = { generation, active: true, closed: false }
    return () => { lifetime.current.active = false }
  }, [generation])
  const isCurrent = useCallback(() => lifetime.current.generation === generation && lifetime.current.active && !lifetime.current.closed, [generation])
  const close = useCallback((showUnavailable = true) => {
    if (!isCurrent()) return
    lifetime.current.closed = true
    if (showUnavailable) setDeniedGeneration(generation)
  }, [generation, isCurrent])
  const reportError = useCallback(async (error: unknown, nested = true) => {
    if (!isCurrent() || !isClientAccessError(error)) return false
    if (nested) {
      // A missing photo/sale/message does not by itself revoke the parent card.
      try { await getClient(clientId) }
      catch (parentError) {
        if (isCurrent() && isClientAccessError(parentError)) { close(); return true }
      }
      return false
    }
    close()
    return true
  }, [clientId, close, isCurrent])
  return { isCurrent, close, reportError, unavailable: deniedGeneration === generation }
}

export const ClientAccessErrorContext = createContext<(error: unknown) => Promise<boolean>>(async () => false)
export const useClientAccessError = () => useContext(ClientAccessErrorContext)
