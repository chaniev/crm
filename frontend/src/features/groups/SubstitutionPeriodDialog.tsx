import { useState, type FormEvent } from 'react'
import { Alert, Group, Modal, NativeSelect, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import {
  ApiError, applyFieldErrors, cancelGroupTrainerSubstitutionPeriod, createGroupTrainerSubstitutionPeriod,
  type GroupTrainerSubstitution, type TrainerOption,
} from '../../lib/api'
import { fe14GroupStaffingText as copy } from '../../resources/fe-14-group-staffing'
import { formatPeriod } from './formatSubstitutionPeriod'
import { Button } from '../shared/ux'

type Props = {
  groupId: string
  groupName: string
  trainerOptions: TrainerOption[]
  period: GroupTrainerSubstitution | null
  onClose: () => void
  onSaved: (notice: string) => void
}

export function SubstitutionPeriodDialog({ groupId, groupName, trainerOptions, period, onClose, onSaved }: Props) {
  const [substituteTrainerId, setTrainerId] = useState('')
  const [startsOn, setStart] = useState('')
  const [endsOn, setEnd] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})
  const trainer = trainerOptions.find((item) => item.id === substituteTrainerId)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError('')
    setFields({})
    try {
      const result = period
        ? await cancelGroupTrainerSubstitutionPeriod(groupId, period.id)
        : await createGroupTrainerSubstitutionPeriod(groupId, { substituteTrainerId, startsOn, endsOn })
      onSaved(`${period ? copy.cancelled : copy.assigned} ${result.substituteTrainer.fullName}, ${formatPeriod(result)}.`)
    } catch (cause) {
      const fieldErrors = cause instanceof ApiError ? applyFieldErrors(cause.fieldErrors) : {}
      setFields(fieldErrors)
      const otherField = Object.entries(fieldErrors).find(([key]) => !['substituteTrainerId', 'startsOn', 'endsOn'].includes(key))
      setError(otherField?.[1] ?? (cause instanceof ApiError && cause.status === 400 && Object.keys(fieldErrors).length
        ? copy.checkFields : cause instanceof Error ? cause.message : copy.mutationFailure))
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal centered opened zIndex="calc(var(--crm-layer-mobile-navigation) + 1)" title={period ? copy.cancelPrompt : copy.assignPeriod}
      onClose={() => { if (!pending) onClose() }} closeOnClickOutside={false} closeOnEscape={!pending}
      closeButtonProps={{ 'aria-label': copy.close, disabled: pending }}
      returnFocus={false} transitionProps={{ duration: 0 }} classNames={{ content: 'group-substitution-dialog' }}>
      <form onSubmit={submit} onChange={() => { setFields({}); setError('') }}>
        <Stack>
          {period ? (
            <>
              <div>
                <Text fw={700}>{period.substituteTrainer.fullName}</Text>
                <Text>{copy.groupLabel(groupName)} · {formatPeriod(period)}</Text>
              </div>
              <Text>{copy.cancelConsequence}</Text>
            </>
          ) : (
            <>
              <Text>{copy.periodScope(trainer?.fullName ?? copy.trainer, groupName)}</Text>
              <NativeSelect data-autofocus label={copy.substituteTrainer} required disabled={pending}
                value={substituteTrainerId} error={fields.substituteTrainerId}
                data={[{ value: '', label: copy.selectTrainer }, ...trainerOptions.map((item) => ({
                  value: item.id, label: `${item.fullName} (${item.login})`,
                }))]} onChange={(event) => setTrainerId(event.currentTarget.value)} />
              <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
                <TextInput type="date" label={copy.startDate} required disabled={pending} value={startsOn}
                  error={fields.startsOn} onChange={(event) => setStart(event.currentTarget.value)} />
                <TextInput type="date" label={copy.endDate} required disabled={pending} value={endsOn}
                  error={fields.endsOn} onChange={(event) => setEnd(event.currentTarget.value)} />
              </SimpleGrid>
            </>
          )}
          {error && <Alert role="alert" color="red">{error}</Alert>}
          <Group justify="flex-end" gap="sm">
            <Button data-autofocus={period ? true : undefined} type="button" variant="secondary" disabled={pending} onClick={onClose}>
              {period ? copy.keep : copy.close}
            </Button>
            <Button type="submit" variant={period ? 'destructive' : 'primary'} loading={pending}>
              {period ? copy.cancelPeriod : copy.assign}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}
