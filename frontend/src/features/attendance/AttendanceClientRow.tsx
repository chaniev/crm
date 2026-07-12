import { Avatar, Badge, Group, Paper, Stack, Text, Tooltip } from '@mantine/core'
import { IconCreditCardOff } from '@tabler/icons-react'
import { buildClientPhotoUrl, type AttendanceState } from '../../lib/api'
import { AttendanceSaveStatus } from './AttendanceSaveStatus'
import { AttendanceStateControl } from './AttendanceStateControl'
import type { AttendanceClientRowState } from './types'

type AttendanceClientRowProps = {
  row: AttendanceClientRowState
  onChange: (state: AttendanceState) => void
  onRetry: () => void
}

export function AttendanceClientRow({ row, onChange, onRetry }: AttendanceClientRowProps) {
  const { client } = row
  const photoUrl = client.photo
    ? buildClientPhotoUrl(
        client.id,
        client.photo.uploadedAt ?? client.photo.path ?? 'attendance',
      )
    : null
  const statusLabel = client.isProfessional
    ? 'Льготный оплаченный статус'
    : client.membershipWarning
      ? 'Есть предупреждение по абонементу'
      : client.hasActivePaidMembership
        ? 'Отметка доступна на выбранную дату'
        : 'Нужна проверка статуса абонемента'

  return (
    <Paper
      className="attendance-client-card"
      data-testid={`attendance-client-card-${client.id}`}
      radius="lg"
      withBorder
    >
      <div className="attendance-client-row">
        <Group align="flex-start" className="attendance-client-identity" gap="md" wrap="nowrap">
          <Avatar
            className="attendance-client-avatar"
            name={client.fullName}
            radius="xl"
            size={48}
            src={photoUrl}
          />
          <Stack className="attendance-client-main" gap={6}>
            <div>
              <Text fw={700}>{client.fullName}</Text>
              <Text c="dimmed" size="sm">{statusLabel}</Text>
            </div>
            <Group gap="xs" wrap="wrap">
              {client.isProfessional ? <Badge color="blue" variant="light">Профессионал</Badge> : null}
              {client.membershipWarning ? (
                <Badge color="yellow" variant="light">Проблема с абонементом</Badge>
              ) : null}
              {client.hasUnpaidCurrentMembership ? (
                <Tooltip label="Текущий абонемент не оплачен, но отметка посещения разрешена." multiline withArrow>
                  <Badge color="red" leftSection={<IconCreditCardOff size={14} />} variant="light">Не оплачено</Badge>
                </Tooltip>
              ) : null}
            </Group>
            {client.membershipWarningMessage ? (
              <Text c="yellow.8" size="sm">{client.membershipWarningMessage}</Text>
            ) : null}
          </Stack>
        </Group>

        <div className="attendance-client-actions">
          <AttendanceStateControl
            clientName={client.fullName}
            disabled={row.saveState === 'pending'}
            onChange={onChange}
            value={row.displayedState}
          />
          <AttendanceSaveStatus
            errorMessage={row.errorMessage}
            onRetry={onRetry}
            saveState={row.saveState}
          />
        </div>
      </div>
    </Paper>
  )
}
