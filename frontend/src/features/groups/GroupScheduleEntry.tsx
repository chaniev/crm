import { Stack, Text } from '@mantine/core'
import type { ScheduleEntryState } from './useGroupScheduleEntry'
import { WEEKDAY_LABELS, formatDurationMinutes } from '../../lib/groupSchedule'
import { fe13GroupsCoreText as text } from '../../resources/fe-13-groups-core'
import { Button, LoadingState } from '../shared/ux'

export function GroupScheduleEntry({ state, pending, onOpen, onRetry }: {
  state: ScheduleEntryState
  pending: boolean
  onOpen: () => void
  onRetry: () => void
}) {
  const slots = state.kind === 'ready' ? state.series.currentVersion.slots : []
  const common = slots.length > 0 && slots.every(slot =>
    slot.hallId === slots[0].hallId && slot.durationMinutes === slots[0].durationMinutes)
  return (
    <section aria-label={text.scheduleTitle} className="group-schedule-entry">
      <Stack gap="xs">
        <Text fw={700}>{text.scheduleTitle}</Text>
        {state.kind === 'loading' ? <LoadingState label={text.scheduleLoading} /> : null}
        {state.kind === 'error' ? (
          <>
            <Text role="status">{state.message}</Text>
            {state.retry ? <Button variant="secondary" onClick={onRetry}>{text.scheduleRetry}</Button> : null}
          </>
        ) : null}
        {state.kind === 'ready' ? (
          <div className="group-schedule-entry__content">
            <Stack gap="xs">
              <div className={common ? 'group-schedule-entry__slots' : undefined}>
              {slots.map((slot, index) => (
                <div key={`${slot.isoWeekday}:${slot.startTime}:${index}`}>
                  <Text fw={600}>{WEEKDAY_LABELS[slot.isoWeekday]} {slot.startTime}</Text>
                  {!common ? <Text>{formatDurationMinutes(slot.durationMinutes)} · {slot.hallName}</Text> : null}
                </div>
              ))}
              </div>
              {common ? <Text>{formatDurationMinutes(slots[0].durationMinutes)} · {slots[0].hallName}</Text> : null}
            </Stack>
            <Button data-group-schedule-action disabled={pending} onClick={onOpen} variant="secondary">
              {text.scheduleEdit}
            </Button>
          </div>
        ) : null}
      </Stack>
    </section>
  )
}
