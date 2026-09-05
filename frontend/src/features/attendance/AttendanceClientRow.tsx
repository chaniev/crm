import { Badge, Button, Group, Paper, Stack, Text } from '@mantine/core'
import { IconUserCircle } from '@tabler/icons-react'
import { buildClientPhotoUrl, type AttendanceState } from '../../lib/api'
import { ClientAvatar } from '../shared/ux'
import { AttendanceSaveStatus } from './AttendanceSaveStatus'
import { AttendanceStateControl } from './AttendanceStateControl'
import type { AttendanceClientRowState } from './types'
import { fe4AttendanceText } from '../../resources/fe-4-attendance'


type AttendanceClientRowProps = {
  row: AttendanceClientRowState
  disabledReason?: string | null
  onChange: (state: AttendanceState) => void
  onOpenClient?: (clientId: string) => void
  onRetry: () => void
}

export function AttendanceClientRow({
  row,
  disabledReason = null,
  onChange,
  onOpenClient,
  onRetry,
}: AttendanceClientRowProps) {
  const { client } = row
  const pendingReasonId = `attendance-client-profile-pending-${client.id}`
  const photoUrl = client.photo
    ? buildClientPhotoUrl(
        client.id,
        client.photo.uploadedAt ?? client.photo.path ?? 'attendance',
      )
    : null
  const statusLabel = client.isProfessional
    ? fe4AttendanceText.attendanceClientRow_string_81ee659f
    : client.membershipWarning
      ? fe4AttendanceText.attendanceClientRow_string_56e8a553
      : !client.hasActiveMembership
        ? fe4AttendanceText.attendanceClientRow_string_64add130
        : null

  return (
    <Paper
      className="attendance-client-card"
      data-testid={`attendance-client-card-${client.id}`}
      radius="lg"
      withBorder
    >
      <div className="attendance-client-row">
        <Group align="flex-start" className="attendance-client-identity" gap="md" wrap="nowrap">
          <ClientAvatar
            className="attendance-client-avatar"
            name={client.fullName}
            radius="xl"
            size={48}
            src={photoUrl}
          />
          <Stack className="attendance-client-main" gap={6}>
            <div>
              <Text fw={700}>{client.fullName}</Text>
              {statusLabel ? <Text c="dimmed" size="sm">{statusLabel}</Text> : null}
            </div>
            <Group gap="xs" wrap="wrap">
              {client.isProfessional ? <Badge color="blue" variant="light">{fe4AttendanceText.attendanceClientRow_jsxText_76fc7876}</Badge> : null}
              {client.membershipWarning ? (
                <Badge color="yellow" variant="light">{fe4AttendanceText.attendanceClientRow_jsxText_7730c85c}</Badge>
              ) : null}
            </Group>
            {client.membershipWarningMessage ? (
              <Text c="var(--crm-status-warning)" size="sm">{client.membershipWarningMessage}</Text>
            ) : null}
          </Stack>
        </Group>

        <div className="attendance-client-actions">
          <AttendanceStateControl
            clientName={client.fullName}
            disabled={row.saveState === 'pending' || Boolean(disabledReason)}
            onChange={onChange}
            value={row.displayedState}
          />
          {disabledReason ? (
            <Text c="dimmed" size="sm">
              {disabledReason}
            </Text>
          ) : null}
          {onOpenClient ? (
            <>
              <Button
                aria-label={fe4AttendanceText.attendanceClientRow_template_a4942e1b(client.fullName)}
                aria-describedby={row.saveState === 'pending' ? pendingReasonId : undefined}
                aria-disabled={row.saveState === 'pending'}
                className="attendance-client-profile-action"
                data-client-profile-action-id={client.id}
                leftSection={<IconUserCircle size={18} />}
                onClick={() => {
                  if (row.saveState === 'pending') return
                  onOpenClient(client.id)
                }}
                type="button"
                variant="light"
              >
                <span className="attendance-client-profile-action__label">
                  {fe4AttendanceText.attendanceClientRow_jsxText_a912ec86}</span>
              </Button>
              {row.saveState === 'pending' ? (
                <Text className="visually-hidden" id={pendingReasonId}>
                  {fe4AttendanceText.attendanceClientRow_jsxText_15d9dcc3}</Text>
              ) : null}
            </>
          ) : null}
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
