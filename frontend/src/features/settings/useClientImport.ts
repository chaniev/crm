import { useEffect, useRef, useState } from 'react'
import { ApiError, importClients, type ClientImportInput, type ClientImportIssue } from '../../lib/api'

export type ImportState =
  | { kind: 'ready' }
  | { kind: 'pending' | 'unknown'; operationId: string }
  | { kind: 'success'; operationId: string; count: number }
  | { kind: 'error'; operationId: string; message: string; issues: ClientImportIssue[] }
export type NavigationGuard = (action: () => void) => void
export type NavigationGuardRegistration = (guard: NavigationGuard | null) => void

export function useClientImport() {
  const [file, setFile] = useState<File | null>(null)
  const [groupName, setGroupName] = useState('')
  const [branchId, setBranchId] = useState<string | null>(null)
  const [state, setState] = useState<ImportState>({ kind: 'ready' })
  const sending = useRef(false)
  const uncertain = state.kind === 'pending' || state.kind === 'unknown'
  const locked = uncertain || state.kind === 'success'
  useEffect(() => {
    if (!uncertain) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [uncertain])

  async function submit(selectedBranch: string) {
    if (sending.current || locked || !file || !groupName.trim()) return
    sending.current = true
    const operationId = crypto.randomUUID()
    const input: ClientImportInput = { file, branchId: selectedBranch, groupName, operationId }
    setState({ kind: 'pending', operationId })
    try {
      const result = await importClients(input)
      setState({ kind: 'success', operationId, count: result.createdCount })
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && (!error.operationId || error.operationId === operationId))
        setState({ kind: 'error', operationId, message: error.message, issues: error.issues })
      else setState({ kind: 'unknown', operationId })
    } finally { sending.current = false }
  }
  return { file, setFile, groupName, setGroupName, branchId, setBranchId, state, uncertain, locked, submit,
    reset: () => { if (!uncertain) { setFile(null); setState({ kind: 'ready' }) } } }
}
