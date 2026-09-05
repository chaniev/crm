
import { Alert, Badge, Group, Paper, Stack, Text } from '@mantine/core'
import { IconCheck } from '@tabler/icons-react'
import type { ClientDetails } from '../../lib/api'
import { PageSection } from '../shared/ux'
import {
  compareAttendanceHistory,
  formatDateValue,
} from './ClientManagement.formatting'
import { fe6ClientProfileText } from '../../resources/fe-6-client-profile'


type ClientAttendanceHistorySectionProps = {
  canManage: boolean
  client: ClientDetails
}

export function ClientAttendanceHistorySection({
  canManage,
  client,
}: ClientAttendanceHistorySectionProps) {
  const history = [...client.attendanceHistory].sort(compareAttendanceHistory)
  const totalHistoryCount = client.attendanceHistoryTotalCount ?? history.length
  const hasPartialHistory =
    client.attendanceHistoryLoaded &&
    client.attendanceHistoryTotalCount !== null &&
    client.attendanceHistoryTotalCount > history.length

  return (
    <PageSection className="client-detail-card">
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap">
          <div>
            <Text fw={700}>{fe6ClientProfileText.clientAttendanceHistorySection_jsxText_85242586}</Text>
            <Text c="dimmed" size="sm">
              {canManage
                ? fe6ClientProfileText.clientAttendanceHistorySection_string_8428fe4a
                : fe6ClientProfileText.clientAttendanceHistorySection_string_34866051}
            </Text>
          </div>

          <Group gap="sm" wrap="wrap">
            <Badge color="var(--crm-brand-primary-soft)" radius="xl" variant="light">
              {canManage ? fe6ClientProfileText.clientAttendanceHistorySection_string_d78acecd : fe6ClientProfileText.clientAttendanceHistorySection_string_f46c76fc}
            </Badge>
            <Badge color="sand" radius="xl" variant="light">
              {fe6ClientProfileText.clientAttendanceHistorySection_jsxText_f8ba76ae}{totalHistoryCount}
            </Badge>
          </Group>
        </Group>

        {!client.attendanceHistoryLoaded ? (
          <Alert
            color="blue"
            icon={<IconCheck size={18} />}
            title={fe6ClientProfileText.clientAttendanceHistorySection_title_b7367866}
            variant="light"
          >
            {fe6ClientProfileText.clientAttendanceHistorySection_jsxText_f4f7179e}</Alert>
        ) : history.length === 0 ? (
          <Text c="dimmed" size="sm">
            {fe6ClientProfileText.clientAttendanceHistorySection_jsxText_001835f0}</Text>
        ) : (
          <Stack gap="sm">
            {history.map((entry) => (
              <Paper className="list-row-card" key={entry.id} radius="8px" withBorder>
                <Stack gap={6}>
                  <Group justify="space-between" wrap="wrap">
                    <Group gap="sm" wrap="wrap">
                      <Text fw={700}>{formatDateValue(entry.trainingDate)}</Text>
                      <Badge
                        color={entry.isPresent ? 'teal' : 'gray'}
                        radius="xl"
                        variant="light"
                      >
                        {entry.isPresent ? fe6ClientProfileText.clientAttendanceHistorySection_string_f1cfa3af : fe6ClientProfileText.clientAttendanceHistorySection_string_439e3b4c}
                      </Badge>
                    </Group>

                  <Badge color="var(--crm-brand-primary-soft)" radius="xl" variant="light">
                    {entry.groupName}
                  </Badge>
                </Group>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}

        {hasPartialHistory ? (
          <Text c="dimmed" size="sm">
            {fe6ClientProfileText.clientAttendanceHistorySection_jsxText_511e94e0}{history.length} {fe6ClientProfileText.clientAttendanceHistorySection_jsxText_7f4adf31}{totalHistoryCount}{fe6ClientProfileText.clientAttendanceHistorySection_jsxText_cdb4ee2a}</Text>
        ) : null}
      </Stack>
    </PageSection>
  )
}
