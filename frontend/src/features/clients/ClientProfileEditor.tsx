import { useEffect, type ReactNode } from 'react'
import { Alert, Stack, Text } from '@mantine/core'
import { updateClientProfile } from '../../lib/api'
import { fe6ClientProfileText as text } from '../../resources/fe-6-client-profile'
import { PageSection } from '../shared/ux'
import { ClientForm } from './ClientForm'
import { ClientNoteAttribution } from './ClientNoteAttribution'
import {
  toClientFormValues, toClientProfilePayload, useClientForm, validateClientForm, type ClientFormValues,
} from './ClientManagement.form'
import { useClientEditorSave, type ClientEditorProps } from './useClientEditorSave'

export function ClientProfileEditor({ client, onSaved, onDirtyChange, photo, actions }: ClientEditorProps & {
  photo: ReactNode
  actions?: ReactNode
}) {
  const form = useClientForm(client)
  const dirty = form.isDirty()
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])
  const state = useClientEditorSave(client.id, onSaved)

  function reset(values = toClientFormValues(client)) {
    form.setValues(values)
    form.resetDirty(values)
    form.clearErrors()
    state.clear()
  }

  async function save(values: ClientFormValues) {
    const errors = validateClientForm(values)
    if (Object.keys(errors).length) {
      form.setErrors(errors)
      state.setError(text.clientEditScreen_setFormError_97732402)
      return
    }

    const updated = await state.submit(() => updateClientProfile(client.id, toClientProfilePayload(values)), form.setErrors)
    if (updated) {
      const saved = toClientFormValues(updated)
      form.setValues(saved)
      form.resetDirty(saved)
      form.clearErrors()
    }
  }

  return (
    <PageSection>
      <Stack gap="md">
        {client.isProfessional && <Alert title={text.profileProfessional}>{client.professionalComment}</Alert>}
        <ClientForm
          form={form}
          formError={state.error}
          profile={{ photo, businessDate: client.businessDate, branchName: client.branchName }}
          photoSection={client.notesLastChangedAt && client.notesLastChangedByName &&
            <ClientNoteAttribution authorName={client.notesLastChangedByName} changedAt={client.notesLastChangedAt} />}
          cancelAction={dirty ? { label: text.cancelChanges, onClick: () => reset() } : null}
          onSubmit={save}
          submitLabel={text.clientEditScreen_submitLabel_744cf2b2}
          submitting={state.pending}
        />
        {state.saved && !dirty && <Text role="status" c="teal">{text.clientEditScreen_title_f436b337}</Text>}
        {actions}
      </Stack>
    </PageSection>
  )
}
