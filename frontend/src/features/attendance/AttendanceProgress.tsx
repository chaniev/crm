import { Progress, Stack, Text } from '@mantine/core'

type AttendanceProgressProps = {
  marked: number
  total: number
}

export function AttendanceProgress({ marked, total }: AttendanceProgressProps) {
  const value = total > 0 ? (marked / total) * 100 : 0

  return (
    <Stack
      aria-label={`Отмечено ${marked} из ${total}`}
      aria-valuemax={total}
      aria-valuemin={0}
      aria-valuenow={marked}
      gap={6}
      role="progressbar"
    >
      <Text fw={600} size="sm">Отмечено {marked} из {total}</Text>
      <Progress aria-hidden="true" radius="xl" size="sm" value={value} />
    </Stack>
  )
}
