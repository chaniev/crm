import { useCallback, useRef } from 'react'

import type { MembershipActionMode } from './ClientManagement.types'

export function useClientActionSubmissionKey() {
  const submissionRef = useRef<{ fingerprint: string; key: string } | null>(null)

  return useCallback((kind: MembershipActionMode | 'transfer', payload: unknown) => {
    const fingerprint = JSON.stringify({ kind, payload })
    if (submissionRef.current?.fingerprint !== fingerprint) {
      submissionRef.current = {
        fingerprint,
        key: createIdempotencyKey(),
      }
    }

    return submissionRef.current.key
  }, [])
}

function createIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
