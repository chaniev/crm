
import { useEffect, useRef, useState } from 'react'
import { Alert, Badge, Button, Group, Paper, Stack, Text } from '@mantine/core'
import { IconCheck } from '@tabler/icons-react'
import { getClient, type ClientAttendanceHistoryEntry, type ClientDetails } from '../../lib/api'
import { clientDetailText } from '../../resources/client-detail-tabs'
import { useClientAccessError } from './clientAccessBoundary'
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
  const [additional, setAdditional] = useState<ClientAttendanceHistoryEntry[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  const reportError = useClientAccessError()
  useEffect(() => () => request.current?.abort(), [])

  const rows = [...client.attendanceHistory, ...additional]
  const history = [...new Map(rows.map(row => [row.id, row])).values()].sort(compareAttendanceHistory)
  const totalHistoryCount = total ?? client.attendanceHistoryTotalCount ?? history.length
  const hasPartialHistory = client.attendanceHistoryLoaded && rows.length < totalHistoryCount

  async function loadMore() {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setPending(true)
    setError('')
    try {
      const page = await getClient(client.id, controller.signal, rows.length)
      if (controller.signal.aborted) return
      setAdditional(current => [...current, ...page.attendanceHistory])
      setTotal(page.attendanceHistory.length ? page.attendanceHistoryTotalCount : rows.length)
    } catch (cause) {
      if (!controller.signal.aborted && !await reportError(cause, false)) {
        setError(cause instanceof Error ? cause.message : clientDetailText.visitsError)
      }
    } finally {
      request.current = null
      if (!controller.signal.aborted) setPending(false)
    }
  }

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

        {error && <Alert color="red" role="alert">{error}</Alert>}
        {hasPartialHistory ? (
          <Stack align="start" gap="xs"><Text c="dimmed" size="sm">
            {fe6ClientProfileText.clientAttendanceHistorySection_jsxText_511e94e0}{history.length} {fe6ClientProfileText.clientAttendanceHistorySection_jsxText_7f4adf31}{totalHistoryCount}{fe6ClientProfileText.clientAttendanceHistorySection_jsxText_cdb4ee2a}</Text>
            <Button variant="light" loading={pending} onClick={loadMore}>{clientDetailText.moreVisits}</Button>
          </Stack>
        ) : null}
      </Stack>
    </PageSection>
  )
}
