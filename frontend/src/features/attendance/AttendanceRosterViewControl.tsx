import { SegmentedControl, Stack, Text } from '@mantine/core'
import { useId } from 'react'

export type AttendanceRosterView = 'unmarked' | 'all'

type AttendanceRosterViewControlProps = {
  value: AttendanceRosterView
  onChange: (value: AttendanceRosterView) => void
  compact?: boolean
}

export function AttendanceRosterViewControl({
  compact = false,
  value,
  onChange,
}: AttendanceRosterViewControlProps) {
  const labelId = useId()

  return (
    <Stack gap={4} role="group" aria-labelledby={labelId}>
      <Text className={compact ? 'visually-hidden' : undefined} fw={700} id={labelId} size="sm">Показывать клиентов</Text>
      <SegmentedControl
        className="attendance-roster-view-control"
        data={[
          { label: 'Не отмечено', value: 'unmarked' },
          { label: 'Все', value: 'all' },
        ]}
        data-testid="attendance-roster-view-control"
        onChange={(nextValue) => onChange(nextValue as AttendanceRosterView)}
        value={value}
      />
    </Stack>
  )
}
