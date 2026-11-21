import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Checkbox, Group, Stack, Text } from '@mantine/core'
import { updateClientGroups, type TrainingGroupListItem } from '../../lib/api'
import { formatGroupSchedule } from '../../lib/groupSchedule'
import { fe6ClientProfileText as text } from '../../resources/fe-6-client-profile'
import { PageSection } from '../shared/ux'
import { loadClientGroupOptions } from './loadClientGroupOptions'
import { useClientAccessError } from './clientAccessBoundary'
import { useClientEditorSave, type ClientEditorProps } from './useClientEditorSave'
import './ClientEditors.css'

export function ClientGroupsEditor({ client, onSaved, onDirtyChange }: ClientEditorProps) {
  const [draft, setDraft] = useState<string[] | null>(null)
  const ids = draft ?? client.groupIds
  const dirty = ids.length !== client.groupIds.length || ids.some(id => !client.groupIds.includes(id))
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])
  const [options, setOptions] = useState<TrainingGroupListItem[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const state = useClientEditorSave(client.id, onSaved)
  const reportError = useClientAccessError()
  useEffect(() => {
    const controller = new AbortController()
    void loadClientGroupOptions(controller.signal).then(groups => {
      if (!controller.signal.aborted) setOptions(groups.filter(g => g.branchId === client.branchId))
    }).catch(async (cause: unknown) => {
      if (controller.signal.aborted || await reportError(cause) || controller.signal.aborted) return
      setLoadError(cause instanceof Error ? cause.message : text.groupsLoadError)
    })
    return () => controller.abort()
  }, [client.branchId, attempt, reportError])

  function change(next: string[] | null) {
    setDraft(next)
    setFieldError(null)
    state.clear()
  }

  async function save() {
    setFieldError(null)
    const updated = await state.submit(() => updateClientGroups(client.id, { groupIds: ids }),
      errors => setFieldError(errors.groupIds ?? null))
    if (updated) setDraft(null)
  }

  const groups = [...(options ?? []), ...client.groups.filter(g => !options?.some(o => o.id === g.id))]
  return (
    <PageSection>
      {loadError ? <Alert role="alert" color="red" title={text.groupsLoadError}>
        <Stack align="start">{loadError}
          <Button variant="default" onClick={() => { setLoadError(null); setAttempt(attempt + 1) }}>{text.retryGroups}</Button>
        </Stack>
      </Alert> : !options ? <Text role="status">{text.loadingGroups}</Text> : (
        <form onSubmit={event => { event.preventDefault(); void save() }}>
          <fieldset className="client-assignment-list" disabled={state.pending} aria-describedby={fieldError || state.error ? 'client-group-error' : undefined}>
            <legend>{text.clientForm_label_ab308eef}</legend>
            {groups.map(group => (
              <label className="client-assignment" key={group.id}>
                <Checkbox checked={ids.includes(group.id)} aria-label={group.name}
                  onChange={event => change(event.currentTarget.checked ? [...ids, group.id] : ids.filter(id => id !== group.id))} />
                <span className="client-assignment-copy"><strong>{group.name}</strong>
                  <span>{[group.trainingStartTime, group.weekdays && group.durationMinutes && formatGroupSchedule(group.weekdays, group.durationMinutes)].filter(Boolean).join(' · ')}</span>
                  <span>{[group.branchName, group.hallName].filter(Boolean).join(' · ')}</span>
                </span>
                {!group.isActive && <Badge color="gray">{text.clientDetailSections_string_4f049897}</Badge>}
              </label>
            ))}
          </fieldset>
          {!ids.length && <Text size="sm" mt="sm">{text.noGroupSelection}</Text>}
          {(fieldError || state.error) && <Alert id="client-group-error" role="alert" color="red" mt="md">{fieldError || state.error}</Alert>}
          <Group mt="md">
            <Button type="submit" disabled={!dirty} loading={state.pending}>{text.saveGroups}</Button>
            {dirty && <Button type="button" variant="subtle" disabled={state.pending} onClick={() => change(null)}>{text.cancelChanges}</Button>}
          </Group>
          {state.saved && !dirty && <Text role="status" c="teal" mt="sm">{text.clientEditScreen_title_f436b337}</Text>}
        </form>
      )}
    </PageSection>
  )
}
