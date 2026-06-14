import { useEffect, useState, type ReactNode } from 'react'
import {
  Badge,
  Paper,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core'
import { IconCalendarEvent, IconUserHeart } from '@tabler/icons-react'
import {
  getMembershipAttentionItems,
  type AuthenticatedUser,
  type MembershipAttentionItem,
  type MembershipAttentionState,
  type MembershipType,
} from '../../lib/api'
import { resources } from '../../lib/resources'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Button,
  PageLayout,
  PageSection,
  RefreshButton,
  ResponsiveButtonGroup,
  SectionHeader,
} from '../shared/ux'
import { AttendanceWorkspace } from '../attendance/AttendanceScreen'

type HomeDashboardProps = {
  user: AuthenticatedUser
  onOpenClient?: (clientId: string) => void
}

const membershipTypeLabels = resources.common.membership.typeLabels satisfies Record<
  MembershipType,
  string
>

export function HomeDashboard({ user, onOpenClient }: HomeDashboardProps) {
  const [clients, setClients] = useState<MembershipAttentionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const canViewMembershipAttention = user.permissions.canManageClients
  const canWorkWithAttendance = user.permissions.canMarkAttendance

  useEffect(() => {
    if (!canViewMembershipAttention) {
      setLoading(false)
      setClients([])
      setError(null)
      return
    }

    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const response = await getMembershipAttentionItems(controller.signal)

        if (controller.signal.aborted) {
          return
        }

        setClients(response)
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        setClients([])
        setError(
          loadError instanceof Error
            ? loadError.message
            : resources.home.expiringMemberships.loadingErrorMessage,
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [canViewMembershipAttention, reloadKey])

  if (!canViewMembershipAttention && !canWorkWithAttendance) {
    return (
      <PageLayout data-testid="home-screen" title="Главная">
        <PageSection>
          <ErrorState
            message={resources.home.accessDenied.message}
            title={resources.home.accessDenied.title}
          />
        </PageSection>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      actions={canViewMembershipAttention ? (
        <RefreshButton
          loading={loading}
          onClick={() => setReloadKey((current) => current + 1)}
        />
      ) : null}
      data-testid="home-screen"
      title="Главная"
    >
      {canViewMembershipAttention ? (
        <PageSection className="home-screen-card">
          <Stack gap="lg">
            <SectionHeader
              description={resources.home.expiringMemberships.description}
              title={resources.home.expiringMemberships.title}
            />

            {loading ? (
              <LoadingState label="Загружаем абонементы..." />
            ) : null}

            {!loading && error ? (
              <ErrorState
                action={
                  <RefreshButton
                    label="Повторить"
                    onClick={() => setReloadKey((current) => current + 1)}
                  />
                }
                message={error}
                title={resources.home.expiringMemberships.loadingErrorTitle}
              />
            ) : null}

            {!loading && !error && clients.length === 0 ? (
              <EmptyState
                description={resources.home.expiringMemberships.emptyDescription}
                icon={<IconCalendarEvent size={28} />}
                title={resources.home.expiringMemberships.emptyTitle}
              />
            ) : null}

            {!loading && !error && clients.length > 0 ? (
              <Stack data-testid="home-expiring-memberships-list" gap="md">
                {clients.map((client) => (
                  <Paper
                    className="list-row-card home-client-row-card"
                    data-testid={`home-client-card-${client.clientId}`}
                    key={client.clientId}
                    radius="24px"
                    withBorder
                  >
                    <div className="home-client-row">
                      <div className="home-client-row__identity">
                        <Text fw={700} size="lg">
                          {client.fullName}
                        </Text>
                      </div>

                      <SimpleGrid className="home-client-row__fields" cols={{ base: 1, xs: 2, xl: 4 }}>
                        <HomeField
                          label={resources.home.expiringMemberships.fields.membershipType}
                          value={membershipTypeLabels[client.membershipType]}
                        />
                        <HomeField
                          label={resources.home.expiringMemberships.fields.expirationDate}
                          value={formatDateValue(client.expirationDate)}
                        />
                        <HomeField
                          label={resources.home.expiringMemberships.fields.state}
                          value={<MembershipAttentionStateView client={client} />}
                        />
                        <HomeField
                          label={resources.home.expiringMemberships.fields.payment}
                          value={
                            <Badge
                              color={client.isPaid ? 'teal' : 'red'}
                              radius="xl"
                              variant="light"
                            >
                              {client.isPaid
                                ? resources.common.statuses.paid
                                : resources.common.statuses.unpaid}
                            </Badge>
                          }
                        />
                      </SimpleGrid>

                      {onOpenClient ? (
                        <ResponsiveButtonGroup justify="flex-end">
                          <Button
                            leftSection={<IconUserHeart size={18} />}
                            onClick={() => onOpenClient(client.clientId)}
                            variant="light"
                          >
                            {resources.home.expiringMemberships.openClientAction}
                          </Button>
                        </ResponsiveButtonGroup>
                      ) : null}
                    </div>
                  </Paper>
                ))}
              </Stack>
            ) : null}
          </Stack>
        </PageSection>
      ) : null}

      {canWorkWithAttendance ? (
        <PageSection
          className="home-attendance-section"
          data-testid="attendance-screen"
          variant="plain"
        >
          <Stack gap="lg">
            <SectionHeader
              description="Рабочий список групп и клиентов для отметки посещений."
              title="Посещения"
            />
            <AttendanceWorkspace user={user} />
          </Stack>
        </PageSection>
      ) : null}
    </PageLayout>
  )
}

type HomeFieldProps = {
  label: string
  value: ReactNode
}

function HomeField({ label, value }: HomeFieldProps) {
  return (
    <div className="home-client-row__field">
      <Text c="dimmed" fw={700} size="xs" tt="uppercase">
        {label}
      </Text>
      {typeof value === 'string' ? (
        <Text fw={600} size="sm">
          {value}
        </Text>
      ) : (
        value
      )}
    </div>
  )
}

function MembershipAttentionStateView({
  client,
}: {
  client: MembershipAttentionItem
}) {
  return (
    <Stack gap={4}>
      <Badge
        color={getMembershipAttentionStateColor(client.state)}
        radius="xl"
        variant="light"
      >
        {resources.home.expiringMemberships.stateLabels[client.state]}
      </Badge>
      <Text fw={600} size="sm">
        {formatMembershipAttentionStateText(client)}
      </Text>
    </Stack>
  )
}

function formatDateValue(value: string | null) {
  if (!value) {
    return 'Не указана'
  }

  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return value
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function formatMembershipAttentionStateText(client: MembershipAttentionItem) {
  switch (client.state) {
    case 'Expired':
      return formatExpiredText(client.daysUntilExpiration)
    case 'ExpiringSoon':
      return formatExpiringSoonText(client.daysUntilExpiration)
    case 'Unpaid':
      return 'Ожидается оплата'
    case 'Unknown':
      return 'Неизвестно'
  }
}

function getMembershipAttentionStateColor(state: MembershipAttentionState) {
  switch (state) {
    case 'Expired':
      return 'red'
    case 'ExpiringSoon':
      return 'orange'
    case 'Unpaid':
      return 'yellow'
    case 'Unknown':
      return 'gray'
  }
}

function formatExpiredText(daysUntilExpiration: number | null) {
  if (daysUntilExpiration === null) {
    return 'Истек'
  }

  const overdueDays = Math.abs(daysUntilExpiration)

  if (overdueDays === 0) {
    return 'Истек сегодня'
  }

  return `Истек ${overdueDays} ${formatDayWord(overdueDays)} назад`
}

function formatExpiringSoonText(daysUntilExpiration: number | null) {
  if (daysUntilExpiration === null) {
    return 'Скоро истечет'
  }

  if (daysUntilExpiration === 0) {
    return resources.home.expiringMemberships.today
  }

  return `Осталось ${daysUntilExpiration} ${formatDayWord(daysUntilExpiration)}`
}

function formatDayWord(value: number) {
  const normalizedValue = Math.abs(value) % 100
  const lastDigit = normalizedValue % 10

  if (normalizedValue >= 11 && normalizedValue <= 19) {
    return 'дней'
  }

  if (lastDigit === 1) {
    return 'день'
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'дня'
  }

  return 'дней'
}
