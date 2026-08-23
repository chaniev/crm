
import { Alert, Badge, Group, Paper, Stack, Text } from '@mantine/core'
import { IconCheck } from '@tabler/icons-react'
import type { ClientDetails } from '../../lib/api'
import { PageSection } from '../shared/ux'
import {
  compareAttendanceHistory,
  formatDateValue,
} from './ClientManagement.formatting'

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
            <Text fw={700}>История посещений</Text>
            <Text c="dimmed" size="sm">
              {canManage
                ? 'Карточка показывает дату тренировки, группу и признак посещения.'
                : 'Тренеру доступны только дата тренировки, назначенная группа и признак посещения.'}
            </Text>
          </div>

          <Group gap="sm" wrap="wrap">
            <Badge color="var(--crm-brand-primary-soft)" radius="xl" variant="light">
              {canManage ? 'Полная карточка' : 'Режим тренера'}
            </Badge>
            <Badge color="sand" radius="xl" variant="light">
              Всего: {totalHistoryCount}
            </Badge>
          </Group>
        </Group>

        {!client.attendanceHistoryLoaded ? (
          <Alert
            color="blue"
            icon={<IconCheck size={18} />}
            title="История пока не загружена"
            variant="light"
          >
            История посещений появится здесь после загрузки данных.
          </Alert>
        ) : history.length === 0 ? (
          <Text c="dimmed" size="sm">
            По этому клиенту пока нет отмеченных посещений.
          </Text>
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
                        {entry.isPresent ? 'Присутствовал' : 'Отсутствовал'}
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
            Показана текущая порция истории: {history.length} из {totalHistoryCount}.
          </Text>
        ) : null}
      </Stack>
    </PageSection>
  )
}
