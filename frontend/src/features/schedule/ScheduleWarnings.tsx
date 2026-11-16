import { Alert, Stack, Text } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import type { ScheduleWarning } from '../../lib/api'
import { formatScheduleProblemCode } from './scheduleActionReasons'

export function WarningList({ warnings }: { warnings: ScheduleWarning[] }) {
  return (
    <Alert color="yellow" icon={<IconAlertTriangle size={18} />}>
      <Stack gap={4}>
        {warnings.map((warning) => (
          <Text key={`${warning.code}:${warning.message}`} size="sm">
            {formatScheduleProblemCode(warning.code) ?? warning.message}
          </Text>
        ))}
      </Stack>
    </Alert>
  )
}

