import { useCallback, useContext, useState, type ComponentProps } from 'react'
import { Alert, Button, Group, NativeSelect, Stack, Text } from '@mantine/core'
import { MembershipCorrectionPanel } from '../../../frontend/src/features/clients/membership/MembershipCorrectionPanel'
import { MembershipPurchasePanel } from '../../../frontend/src/features/clients/membership/MembershipPurchasePanel'
import { MembershipRenewPanel } from '../../../frontend/src/features/clients/membership/MembershipRenewPanel'
import { MembershipGroupTransferSurface } from '../../../frontend/src/features/clients/membership/MembershipGroupTransferSurface'
import { MembershipHistory } from '../../../frontend/src/features/clients/membership/MembershipHistory'
import type { ClientMembershipSection } from '../../../frontend/src/features/clients/membership/ClientMembershipSection'
import { DraftState } from './DraftState'

type Mode = 'correct' | 'renew' | 'purchase'
type Props = Pick<ComponentProps<typeof ClientMembershipSection>, 'client'|'pending'|'onClientChange'|'onSubmit'|'onMembershipCommentChange'>

export function MembershipEditor({ client, pending, onClientChange, onSubmit, onMembershipCommentChange }: Props) {
  const [saleId, setSaleId] = useState<string | undefined>(client.currentMemberships[0]?.saleId)
  const [mode, setMode] = useState<Mode>(client.currentMemberships.length ? 'correct' : 'purchase')
  const [revision, reset] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const register = useContext(DraftState)
  const selected = client.currentMemberships.find(item => item.saleId === saleId) ?? client.currentMemberships[0]
  const canRenew = selected && selected.behaviorKind !== 'SingleVisit' && selected.entitlementState !== 'LegacyTargetMissing'
  function switchEditor(next: Mode, nextSale = selected?.saleId) {
    if (dirty && !window.confirm('Отменить несохранённые изменения абонемента?')) return
    setNotice('')
    setError('')
    setSaleId(nextSale)
    setMode(next)
    reset(value => value + 1)
  }
  async function save(submission: Parameters<Props['onSubmit']>[0]) {
    setError('')
    try {
      await onSubmit(submission)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить изменения.')
      throw cause
    }
    setNotice(submission.kind === 'correct' ? 'Изменения абонемента сохранены' : 'Абонемент оформлен')
    if (submission.kind !== 'correct') setSaleId(undefined)
    setMode('correct')
    reset(value => value + 1)
  }
  function cancel() {
    setError('')
    setNotice('')
    setMode(selected ? 'correct' : 'purchase')
    reset(value => value + 1)
  }
  // Each active CRM form reports the actual dirtiness of its inputs.
  const trackForm = useCallback((_area: string, value: boolean) => {
    setDirty(value)
    if (value) setNotice('')
    register('memberships', value)
  }, [register])
  const common = { pending, onSubmit: save, onCancel: cancel, businessDate: client.businessDate }
  return <DraftState.Provider value={trackForm}><Stack className="membership-editor" gap="md">
    {client.currentMemberships.length > 1 && <NativeSelect label="Абонемент" value={selected?.saleId}
      onChange={event => switchEditor('correct', event.target.value)} data={client.currentMemberships.map(item =>
        ({ value: item.saleId, label: item.membershipName + ' · ' + item.purchaseDate }))}/>}
    {mode === 'correct' && selected && <MembershipCorrectionPanel key={selected.id + revision} {...common} currentMembership={selected}/>}
    {mode === 'renew' && selected && <MembershipRenewPanel key={'renew' + revision} {...common} currentMembership={selected} branchId={client.branchId}/>}
    {mode === 'purchase' && !client.isProfessional && <MembershipPurchasePanel key={'purchase' + revision} {...common} branchId={client.branchId}/>}
    {error && <Alert color="red" role="alert">{error}</Alert>}
    {notice && <Text role="status" c="teal">{notice}</Text>}
    <Group gap="xs">
      {mode !== 'renew' && canRenew && <Button variant="light" onClick={() => switchEditor('renew')}>Продлить</Button>}
      {mode !== 'purchase' && !client.isProfessional && <Button variant="light" onClick={() => switchEditor('purchase')}>Новый абонемент</Button>}
    </Group>
    {selected && <details className="auxiliary"><summary>Перенести группу в абонементах</summary>
      <MembershipGroupTransferSurface client={client} pending={pending} onTransferred={onClientChange}/></details>}
    <details className="auxiliary"><summary>История абонементов</summary>
      <MembershipHistory clientId={client.id} history={client.membershipHistory} onMembershipCommentChange={onMembershipCommentChange}/></details>
  </Stack></DraftState.Provider>
}
