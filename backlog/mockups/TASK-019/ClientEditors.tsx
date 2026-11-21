import { useState, type ReactNode } from 'react'
import { Alert, Badge, Button, Checkbox, Group, Stack, Text } from '@mantine/core'
import { useForm } from '@mantine/form'
import { updateClient, type ClientDetails } from '../../../frontend/src/lib/api'
import { ClientForm } from '../../../frontend/src/features/clients/ClientForm'
import { ClientNoteAttribution } from '../../../frontend/src/features/clients/ClientNoteAttribution'
import { toClientFormValues, toUpsertClientPayload, validateClientForm, type ClientFormValues } from '../../../frontend/src/features/clients/ClientManagement.form'
import { PageSection } from '../../../frontend/src/features/shared/ux'
import { formatGroupSchedule } from '../../../frontend/src/lib/groupSchedule'
import { branches } from '../../done/2026-11-21/TASK-018-mockups/fixtures'
import { demoGroups } from './fixtures'
import { useDraftState } from './DraftState'

type EditorProps = { client: ClientDetails; onSaved: (client: ClientDetails) => void }

function useSaveClient(client: ClientDetails, onSaved: EditorProps['onSaved']) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function save(values: ClientFormValues) {
    setError('')
    setNotice('')
    setSaving(true)
    try {
      const updated = await updateClient(client.id, toUpsertClientPayload(values))
      if (!updated) throw new Error('Не удалось получить сохранённую карточку.')
      onSaved(updated)
      setNotice('Изменения сохранены')
      return updated
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить изменения.')
    } finally {
      setSaving(false)
    }
  }
  return { saving, error, notice, save, clear: () => { setError(''); setNotice('') } }
}

export function InfoEditor({ client, onSaved, photo, actions }: EditorProps & { photo: ReactNode; actions: ReactNode }) {
  const form = useForm<ClientFormValues>({ initialValues: toClientFormValues(client) })
  const state = useSaveClient(client, onSaved)
  useDraftState('info', form.isDirty())
  async function save(values: ClientFormValues) {
    const errors = validateClientForm(values)
    if (Object.keys(errors).length) { form.setErrors(errors); return }
    const updated = await state.save({ ...values, groupIds: client.groupIds })
    if (updated) {
      const saved = toClientFormValues(updated)
      form.setValues(saved)
      form.resetDirty(saved)
    }
  }
  function reset() {
    const saved = toClientFormValues(client)
    form.setValues(saved)
    form.resetDirty(saved)
    form.clearErrors()
    state.clear()
  }
  return <PageSection>
    <Stack gap="md">
      {client.isProfessional && <Alert title="Профессионал">{client.professionalComment}</Alert>}
      {photo}
      <ClientForm form={form} branchOptions={branches} groupOptions={[]} lockBranch
        cancelAction={form.isDirty() ? { label: 'Отменить изменения', onClick: reset } : null}
        formError={state.error || null} submitting={state.saving} submitLabel="Сохранить изменения" onSubmit={save}
        photoSection={client.notesLastChangedByName && client.notesLastChangedAt &&
          <ClientNoteAttribution authorName={client.notesLastChangedByName} changedAt={client.notesLastChangedAt}/>} />
      {state.notice && !form.isDirty() && <Text role="status" c="teal">{state.notice}</Text>}
      {actions}
    </Stack>
  </PageSection>
}

export function GroupsEditor({ client, onSaved }: EditorProps) {
  const [ids, setIds] = useState(client.groupIds)
  const dirty = ids.length !== client.groupIds.length || ids.some(id => !client.groupIds.includes(id))
  useDraftState('groups', dirty)
  const state = useSaveClient(client, onSaved)
  const options = demoGroups.filter(group => group.branchId === client.branchId || client.groupIds.includes(group.id))
  return <PageSection><form onSubmit={async event => {
    event.preventDefault()
    const updated = await state.save({ ...toClientFormValues(client), groupIds: ids })
    if (updated) setIds(updated.groupIds)
  }}>
    <fieldset className="assignment-list" disabled={state.saving}>
      <legend>Группы клиента</legend>
      {options.map(group => <label className="assignment" key={group.id}>
        <Checkbox checked={ids.includes(group.id)} aria-label={group.name}
          onChange={event => {
            setIds(event.currentTarget.checked ? [...ids, group.id] : ids.filter(id => id !== group.id))
            state.clear()
          }}/>
        <span className="assignment-copy"><strong>{group.name}</strong>
          <span>{group.trainingStartTime} · {formatGroupSchedule(group.weekdays, group.durationMinutes)}</span>
          <span>{group.branchName} · {group.hallName}</span></span>
        {!group.isActive && <Badge color="gray">Неактивна</Badge>}
      </label>)}
    </fieldset>
    {!ids.length && <Text size="sm" mt="sm">Группы не выбраны.</Text>}
    {state.error && <Alert color="red" mt="md" role="alert">{state.error}</Alert>}
    <Group mt="md"><Button type="submit" disabled={!dirty} loading={state.saving}>Сохранить группы</Button>
      {dirty && <Button variant="subtle" type="button" onClick={() => { setIds(client.groupIds); state.clear() }}>Отменить изменения</Button>}
    </Group>
    {state.notice && <Text mt="sm" role="status" c="teal">{state.notice}</Text>}
  </form></PageSection>
}
