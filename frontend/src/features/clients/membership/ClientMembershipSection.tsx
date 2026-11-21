import './ClientMembershipSection.css'
import { useCallback, useRef, useState } from 'react'
import { Alert, Button, Group, NativeSelect, Paper, Stack, Text } from '@mantine/core'
import type { ClientDetails, ClientMembership } from '../../../lib/api'
import { fe7ClientMembershipText as text } from '../../../resources/fe-7-client-membership'
import type { MembershipActionMode, MembershipActionSubmission } from '../ClientManagement.types'
import { formatDateValue } from '../ClientManagement.formatting'
import { MembershipCorrectionPanel } from './MembershipCorrectionPanel'
import { MembershipGroupTransferSurface } from './MembershipGroupTransferSurface'
import { MembershipHistory } from './MembershipHistory'
import { MembershipPurchasePanel } from './MembershipPurchasePanel'
import { MembershipRenewPanel } from './MembershipRenewPanel'
import { MembershipDraftContext } from './membershipDrafts'

type ClientMembershipSectionProps = {
  client: ClientDetails
  pending: boolean
  onClientChange: (client: ClientDetails) => void
  onSubmit: (submission: MembershipActionSubmission) => Promise<void>
  onMembershipCommentChange: (membership: ClientMembership) => void
  onDirtyChange: (dirty: boolean) => void
}

export function ClientMembershipSection({
  client, pending, onClientChange, onSubmit, onMembershipCommentChange, onDirtyChange,
}: ClientMembershipSectionProps) {
  const [saleId, setSaleId] = useState<string>()
  const [action, setAction] = useState<MembershipActionMode | null>(null)
  const [revision, setRevision] = useState(0)
  const [transferVisited, setTransferVisited] = useState(false)
  const [historyVisited, setHistoryVisited] = useState(false)
  const dirtyForms = useRef(new Set<string>())
  const selected = client.currentMemberships.find(sale => sale.saleId === saleId) ?? client.currentMemberships[0]
  const mode = action ?? (selected ? 'correct' : 'purchase')
  const canRenew = selected && selected.behaviorKind !== 'SingleVisit' && selected.entitlementState !== 'LegacyTargetMissing'
  const reportDirty = useCallback((form: string, dirty: boolean) => {
    if (dirty) dirtyForms.current.add(form)
    else dirtyForms.current.delete(form)
    onDirtyChange(dirtyForms.current.size > 0)
  }, [onDirtyChange])

  function switchMode(next: MembershipActionMode, nextSaleId = selected?.saleId) {
    if (dirtyForms.current.has('editor') && !window.confirm(text.discardEditor)) return
    setAction(next)
    setSaleId(nextSaleId)
    setRevision(previous => previous + 1)
  }

  function resetEditor() {
    setAction(null)
    setRevision(previous => previous + 1)
  }

  async function save(submission: MembershipActionSubmission) {
    await onSubmit(submission)
    if (submission.kind !== 'correct') setSaleId(undefined)
    resetEditor()
  }

  const panelProps = { businessDate: client.businessDate, pending, onCancel: resetEditor, onSubmit: save }

  return (
    <MembershipDraftContext value={reportDirty}>
      <Stack className="membership-editor" gap="md">
        {client.currentMemberships.length > 1 && (
          <NativeSelect
            label={text.membershipCorrectionPanel_label_1139430b}
            disabled={pending}
            value={selected?.saleId}
            data={client.currentMemberships.map(sale => ({
              value: sale.saleId,
              label: `${sale.membershipName} · ${formatDateValue(sale.purchaseDate)}`,
            }))}
            onChange={event => switchMode('correct', event.currentTarget.value)}
          />
        )}
        {selected?.entitlementState === 'LegacyTargetMissing' && (
          <Alert color="yellow">{text.clientMembershipSection_jsxText_71606622}</Alert>
        )}
        {mode === 'correct' && selected && (
          <MembershipCorrectionPanel key={`${selected.id}-${revision}`} {...panelProps} currentMembership={selected} />
        )}
        {mode === 'renew' && canRenew && (
          <MembershipRenewPanel key={`${selected.id}-${revision}`} {...panelProps} branchId={client.branchId} currentMembership={selected} />
        )}
        {mode === 'purchase' && !client.isProfessional && (
          <MembershipPurchasePanel key={revision} {...panelProps} branchId={client.branchId} />
        )}
        {!selected && client.isProfessional && <Text c="dimmed">{text.clientMembershipSection_jsxText_10110ccf}</Text>}
        <Group gap="xs">
          {mode !== 'renew' && canRenew && (
            <Button disabled={pending} variant="light" onClick={() => switchMode('renew')}>{text.clientMembershipSection_jsxText_659ad690}</Button>
          )}
          {mode !== 'purchase' && !client.isProfessional && (
            <Button disabled={pending} variant="light" onClick={() => switchMode('purchase')}>{text.clientMembershipSection_jsxText_a946d490}</Button>
          )}
        </Group>
        {selected && (
          <Paper component="details" withBorder p="sm" onToggle={event => {
            if (event.currentTarget.open) setTransferVisited(true)
          }}>
            <summary>{text.membershipGroupTransferSurface_jsxText_01c7a7e5}</summary>
            {transferVisited && <MembershipGroupTransferSurface client={client} pending={pending} onTransferred={onClientChange} />}
          </Paper>
        )}
        <Paper component="details" withBorder p="sm" onToggle={event => {
          if (event.currentTarget.open) setHistoryVisited(true)
        }}>
          <summary>{text.historyDisclosure}</summary>
          {historyVisited && <MembershipHistory clientId={client.id} history={client.membershipHistory} onMembershipCommentChange={onMembershipCommentChange} />}
        </Paper>
      </Stack>
    </MembershipDraftContext>
  )
}
