import { SegmentedControl, Stack, Text } from '@mantine/core'
import { useId } from 'react'
import { fe4AttendanceText } from '../../resources/fe-4-attendance'


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
      <Text className={compact ? 'visually-hidden' : undefined} fw={700} id={labelId} size="sm">{fe4AttendanceText.attendanceRosterViewControl_jsxText_4627639b}</Text>
      <SegmentedControl
        className="attendance-roster-view-control"
        data={[
          { label: fe4AttendanceText.attendanceRosterViewControl_label_7c7cca86, value: 'unmarked' },
          { label: fe4AttendanceText.attendanceRosterViewControl_label_215816bf, value: 'all' },
        ]}
        data-testid="attendance-roster-view-control"
        onChange={(nextValue) => onChange(nextValue as AttendanceRosterView)}
        value={value}
      />
    </Stack>
  )
}
