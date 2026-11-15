import { useEffect, useRef, useState } from 'react'
import { Alert, FileInput, Select, Stack, Text, TextInput } from '@mantine/core'
import { getBranches, type AuthenticatedUser, type Branch } from '../../lib/api'
import { getSemanticToneComponentProps } from '../../theme/semanticTones'
import { clientImportText as text } from '../../resources/client-import'
import { Button, LoadingState, PageSection } from '../shared/ux'
import { type ImportState, type useClientImport } from './useClientImport'

export function ImportOperationNumber({ operationId }: { operationId: string }) {
  const [copied, setCopied] = useState<string | null>(null)
  return <Stack gap="xs">
    <Text>{text.operation}</Text><Text component="code" style={{ overflowWrap: 'anywhere', userSelect: 'all' }}>{operationId}</Text>
    <Button variant="secondary" onClick={() => { void navigator.clipboard?.writeText(operationId).then(() => setCopied(text.copied), () => setCopied(text.copyFailed)); if (!navigator.clipboard) setCopied(text.copyFailed) }}>{text.copy}</Button>
    {copied && <Text role="status">{copied}</Text>}
  </Stack>
}

export function ImportOutcome({ state, canAudit, active = true }: { state: ImportState; canAudit: boolean; active?: boolean }) {
  const summary = useRef<HTMLDivElement>(null)
  const previous = useRef(state)
  useEffect(() => {
    if (state !== previous.current && active && state.kind === 'error') summary.current?.focus()
    previous.current = state
  }, [state, active])
  if (state.kind === 'ready') return null
  const unknown = state.kind === 'unknown' || state.kind === 'pending'
  const title = state.kind === 'success' ? text.success(state.count) : state.kind === 'error' ? text.failed : state.kind === 'pending' ? text.pending : text.unknown
  return <Alert {...getSemanticToneComponentProps(state.kind === 'success' ? 'success' : state.kind === 'error' ? 'danger' : 'warning')} title={title}>
    <Stack gap="sm" ref={summary} tabIndex={-1} aria-live="polite">
      {state.kind === 'error' && <><Text>{state.message}</Text><ul style={{ paddingInlineStart: 'var(--mantine-spacing-lg)' }}>
        {state.issues.map((issue, index) => <li key={index}>
          <Text>{[issue.row ? text.row(issue.row) : null, issue.field ? text.fields[issue.field] ?? issue.field : null].filter(Boolean).join(' · ')}{': '}{issue.message}</Text>
        </li>)}
      </ul></>}
      <ImportOperationNumber operationId={state.operationId} />
      {unknown && <><Text>{text.preserve}</Text><Text>{canAudit ? text.audit : text.askAudit}</Text></>}
    </Stack>
  </Alert>
}

export function ClientImportPanel({ user, model }: { user: AuthenticatedUser; model: ReturnType<typeof useClientImport> }) {
  const groupField = useRef<HTMLInputElement>(null)
  const branchField = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (model.state.kind !== 'error') return
    const field = model.state.issues.find(issue => issue.row === null)?.field
    if (field === 'groupName') groupField.current?.focus()
    if (field === 'branchId') branchField.current?.focus()
  }, [model.state])
  const [branches, setBranches] = useState<Branch[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [reload, setReload] = useState(0)
  const scope = user.clientImportScope
  useEffect(() => {
    const controller = new AbortController()
    getBranches({}, controller.signal).then(value => { if (!controller.signal.aborted) { setBranches(value); setFailed(false) } }, () => { if (!controller.signal.aborted) setFailed(true) })
    return () => controller.abort()
  }, [reload, scope?.kind, scope?.branchId])
  const selectedBranch = scope?.kind === 'OwnBranch' ? scope.branchId : model.branchId
  const branchName = branches?.find(branch => branch.id === selectedBranch)?.name
  const fieldError = (field: string) => model.state.kind === 'error' ? model.state.issues.filter(issue => issue.row === null && issue.field === field).map(issue => issue.message).join(' ') || undefined : undefined
  const noBranch = scope?.kind === 'OwnBranch' && !scope.branchId
  return <PageSection><Stack gap="lg" maw={600} style={{ width: '100%' }}>
    <ImportOutcome state={model.state} canAudit={user.permissions.canViewAuditLog} />
    {model.state.kind === 'success' && <><Text>{branchName} · {model.groupName}</Text><Button onClick={model.reset}>{text.newImport}</Button></>}
    {noBranch ? <Text>{text.noBranch}</Text> : <>
      {failed ? <Alert {...getSemanticToneComponentProps('danger')} title={text.lookupError}><Button variant="secondary" onClick={() => setReload(value => value + 1)}>{text.refresh}</Button></Alert> : !branches && <LoadingState label={text.loading} />}
      <form onSubmit={event => { event.preventDefault(); if (selectedBranch && branchName && !failed) void model.submit(selectedBranch) }}>
        <Stack gap="lg">
          {scope?.kind === 'SelectBranch' ? <Select ref={branchField} label={text.branch} placeholder={text.selectBranch} data={(branches ?? []).map(branch => ({ value: branch.id, label: branch.name }))} value={model.branchId} onChange={model.setBranchId} disabled={model.locked || !branches || failed} error={fieldError('branchId')} /> : <Stack gap="xs"><Text fw={600}>{text.branch}</Text><Text>{branchName ?? text.loading}</Text></Stack>}
          <TextInput ref={groupField} label={text.group} description={text.groupHelp} value={model.groupName} onChange={event => model.setGroupName(event.currentTarget.value)} disabled={model.locked} error={fieldError('groupName')} />
          <FileInput label={text.file} description={text.fileHelp} placeholder={text.selectFile} accept=".xlsx" value={model.file} onChange={model.setFile} disabled={model.locked} error={fieldError('file')} styles={{ input: { height: 'auto', minHeight: '2.75rem', whiteSpace: 'normal', overflowWrap: 'anywhere' } }} />
          <Text c="dimmed">{text.warning}</Text>
          <Button type="submit" loading={model.state.kind === 'pending'} disabled={model.locked || !model.file || !model.groupName.trim() || !selectedBranch || !branchName || failed}>{text.submit}</Button>
        </Stack>
      </form>
    </>}
  </Stack></PageSection>
}
