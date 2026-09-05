import { Progress, Stack, Text } from '@mantine/core'
import { fe4AttendanceText } from '../../resources/fe-4-attendance'


type AttendanceProgressProps = {
  marked: number
  total: number
  compact?: boolean
}

export function AttendanceProgress({ compact = false, marked, total }: AttendanceProgressProps) {
  const value = total > 0 ? (marked / total) * 100 : 0

  return (
    <Stack
      aria-label={fe4AttendanceText.attendanceProgress_template_7363b38e(marked, total)}
      aria-valuemax={total}
      aria-valuemin={0}
      aria-valuenow={marked}
      className="attendance-progress"
      gap={compact ? 4 : 6}
      role="progressbar"
    >
      <Text fw={600} size="sm">{fe4AttendanceText.attendanceProgress_jsxText_8dc8c1de}{marked} {fe4AttendanceText.attendanceProgress_jsxText_7f4adf31}{total}</Text>
      <Progress aria-hidden="true" radius="xl" size="sm" value={value} />
    </Stack>
  )
}
