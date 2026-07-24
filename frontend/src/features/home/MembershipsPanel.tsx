import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Badge, Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core'
import { IconCalendarEvent, IconUserHeart } from '@tabler/icons-react'
import {
  getMembershipAttentionItems,
  type MembershipAttentionItem,
  type MembershipAttentionState,
  type MembershipBehaviorKind,
} from '../../lib/api'
import { resources } from '../../lib/resources'
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageSection,
  RefreshButton,
  ResponsiveButtonGroup,
  SectionHeader,
} from '../shared/ux'

type MembershipsPanelProps = {
  onCountChange?: (count: number | null) => void
  onOpenClient?: (clientId: string) => void
}

const behaviorKindLabels = resources.common.membership.typeLabels satisfies Record<MembershipBehaviorKind, string>

export function MembershipsPanel({ onCountChange, onOpenClient }: MembershipsPanelProps) {
  const [clients, setClients] = useState<MembershipAttentionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [lastSuccessfulCheck, setLastSuccessfulCheck] = useState<Date | null>(null)
  const hasSuccessfulLoadRef = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setError(null)
      if (!hasSuccessfulLoadRef.current) onCountChange?.(null)
      try {
        const response = await getMembershipAttentionItems(controller.signal)
        if (controller.signal.aborted) return
        setClients(response)
        onCountChange?.(response.length)
        hasSuccessfulLoadRef.current = true
        setLastSuccessfulCheck(new Date())
      } catch (loadError) {
        if (controller.signal.aborted) return
        setError(loadError instanceof Error ? loadError.message : resources.home.expiringMemberships.loadingErrorMessage)
        if (!hasSuccessfulLoadRef.current) onCountChange?.(null)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [onCountChange, reloadKey])

  return (
    <PageSection className="home-memberships-panel">
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap">
          <SectionHeader description={resources.home.expiringMemberships.description} title={resources.home.expiringMemberships.title} />
          <RefreshButton loading={loading} onClick={() => setReloadKey((current) => current + 1)} />
        </Group>
        {lastSuccessfulCheck ? (
          <Text c="dimmed" data-testid="memberships-last-check" size="sm">
            Проверено: {lastSuccessfulCheck.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        ) : null}
        {loading && !hasSuccessfulLoadRef.current ? <LoadingState label="Загружаем абонементы..." /> : null}
        {!loading && error ? (
          <ErrorState
            action={<RefreshButton label="Повторить" onClick={() => setReloadKey((current) => current + 1)} />}
            message={error}
            title={resources.home.expiringMemberships.loadingErrorTitle}
          />
        ) : null}
        {hasSuccessfulLoadRef.current && clients.length === 0 ? (
          <EmptyState
            description={resources.home.expiringMemberships.emptyDescription}
            icon={<IconCalendarEvent size={28} />}
            title="С абонементами всё в порядке"
          />
        ) : null}
        {hasSuccessfulLoadRef.current && clients.length > 0 ? (
          <Stack data-testid="home-expiring-memberships-list" gap="sm">
            {clients.map((client) => (
              <Paper className="home-client-row-card" data-testid={`home-client-card-${client.clientId}`} key={client.clientId} radius="lg" withBorder>
                <div className="home-client-row">
                  <Text fw={700} size="lg">{client.fullName}</Text>
                  <SimpleGrid className="home-client-row__fields" cols={{ base: 1, xs: 2, xl: 3 }}>
                    <HomeField label={resources.home.expiringMemberships.fields.behaviorKind} value={behaviorKindLabels[client.behaviorKind]} />
                    <HomeField label={resources.home.expiringMemberships.fields.expirationDate} value={formatDateValue(client.expirationDate)} />
                    <HomeField label={resources.home.expiringMemberships.fields.state} value={<MembershipAttentionStateView client={client} />} />
                  </SimpleGrid>
                  {onOpenClient ? <ResponsiveButtonGroup justify="flex-end"><Button leftSection={<IconUserHeart size={18} />} onClick={() => onOpenClient(client.clientId)} variant="light">{resources.home.expiringMemberships.openClientAction}</Button></ResponsiveButtonGroup> : null}
                </div>
              </Paper>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </PageSection>
  )
}

function HomeField({ label, value }: { label: string; value: ReactNode }) {
  return <div className="home-client-row__field"><Text c="dimmed" fw={700} size="xs" tt="uppercase">{label}</Text>{typeof value === 'string' ? <Text fw={600} size="sm">{value}</Text> : value}</div>
}

function MembershipAttentionStateView({ client }: { client: MembershipAttentionItem }) {
  return <Stack gap={4}><Badge color={getMembershipAttentionStateColor(client.state)} variant="light">{resources.home.expiringMemberships.stateLabels[client.state]}</Badge><Text fw={600} size="sm">{formatMembershipAttentionStateText(client)}</Text></Stack>
}

function formatDateValue(value: string | null) {
  if (!value) return 'Не указана'
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(Date.UTC(year, month - 1, day)))
}

function formatMembershipAttentionStateText(client: MembershipAttentionItem) {
  switch (client.state) {
    case 'Expired': return formatExpiredText(client.daysUntilExpiration)
    case 'ExpiringSoon': return formatExpiringSoonText(client.daysUntilExpiration)
    case 'Unknown': return 'Неизвестно'
  }
}

function getMembershipAttentionStateColor(state: MembershipAttentionState) {
  switch (state) {
    case 'Expired': return 'red'
    case 'ExpiringSoon': return 'orange'
    case 'Unknown': return 'gray'
  }
}

function formatExpiredText(value: number | null) {
  if (value === null) return 'Истек'
  const days = Math.abs(value)
  return days === 0 ? 'Истек сегодня' : `Истек ${days} ${formatDayWord(days)} назад`
}

function formatExpiringSoonText(value: number | null) {
  if (value === null) return 'Скоро истечет'
  if (value === 0) return resources.home.expiringMemberships.today
  return `Осталось ${value} ${formatDayWord(value)}`
}

function formatDayWord(value: number) {
  const normalized = Math.abs(value) % 100
  const digit = normalized % 10
  if (normalized >= 11 && normalized <= 19) return 'дней'
  if (digit === 1) return 'день'
  if (digit >= 2 && digit <= 4) return 'дня'
  return 'дней'
}
