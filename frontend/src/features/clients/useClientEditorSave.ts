import { useEffect, useRef, useState } from 'react'
import { ApiError, applyFieldErrors, getClient, type ClientDetails } from '../../lib/api'
import { fe6ClientProfileText as text } from '../../resources/fe-6-client-profile'
import { clientFieldErrorAliases } from './ClientManagement.form'
import { useClientAccessError } from './clientAccessBoundary'

export type ClientEditorProps = {
  client: ClientDetails
  onSaved: (updated: ClientDetails) => void
  onDirtyChange: (dirty: boolean) => void
}

export function useClientEditorSave(clientId: string, onSaved: ClientEditorProps['onSaved']) {
  const reportError = useClientAccessError()
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lifetime = useRef({ active: true, submitting: false })
  useEffect(() => {
    const current = { active: true, submitting: false }
    lifetime.current = current
    return () => { current.active = false }
  }, [clientId])

  function clear() {
    setSaved(false)
    setError(null)
  }

  async function submit(write: () => Promise<ClientDetails | null>, showFieldErrors: (errors: Record<string, string>) => void) {
    const current = lifetime.current
    if (!current.active || current.submitting) return
    current.submitting = true
    clear()
    setPending(true)
    try {
      const result = await write()
      if (!current.active) return
      const updated = result ?? await getClient(clientId)
      if (!current.active) return
      onSaved(updated)
      setSaved(true)
      return updated
    } catch (cause) {
      if (!current.active || await reportError(cause, false) || !current.active) return
      if (cause instanceof ApiError) showFieldErrors(applyFieldErrors(cause.fieldErrors, clientFieldErrorAliases))
      setError(cause instanceof Error ? cause.message : text.clientEditScreen_setFormError_e238fab9)
    } finally {
      current.submitting = false
      if (current.active) setPending(false)
    }
  }

  return { pending, saved, error, clear, submit, setError }
}
