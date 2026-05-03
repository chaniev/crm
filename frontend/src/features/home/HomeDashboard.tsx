import { useEffect, useState, type ReactNode } from 'react'
import {
  Alert,
  Badge,
  Button,
  Paper,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core'
import { IconAlertCircle, IconCalendarEvent, IconUserHeart } from '@tabler/icons-react'
import {
  getExpiringClientMemberships,
  type AuthenticatedUser,
  type ExpiringClientMembership,
  type MembershipType,
} from '../../lib/api'
import { resources } from '../../lib/resources'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageCard,
  PageHeader,
  RefreshButton,
  ResponsiveButtonGroup,
} from '../shared/ux'

type HomeDashboardProps = {
  user: AuthenticatedUser
  onOpenClient?: (clientId: string) => void
}

const membershipTypeLabels = resources.common.membership.typeLabels satisfies Record<
  MembershipType,
  string
>

export function HomeDashboard({ user, onOpenClient }: HomeDashboardProps) {
  const [clients, setClients] = useState<ExpiringClientMembership[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const canViewExpiringMemberships =
    user.role === 'HeadCoach' || user.role === 'Administrator'

  useEffect(() => {
    if (!canViewExpiringMemberships) {
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
        const response = await getExpiringClientMemberships(controller.signal)

        if (controller.signal.aborted) {
          return
        }

        setClients(
          response
            .sort(
              (left, right) =>
                left.daysUntilExpiration - right.daysUntilExpiration ||
                left.fullName.localeCompare(right.fullName, 'ru'),
            ),
        )
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
  }, [canViewExpiringMemberships, reloadKey])

  if (!canViewExpiringMemberships) {
    return (
      <Stack className="dashboard-stack" data-testid="home-screen" gap="xl">
        <PageCard>
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            title={resources.home.accessDenied.title}
            variant="light"
          >
            {resources.home.accessDenied.message}
          </Alert>
        </PageCard>
      </Stack>
    )
  }

  return (
    <Stack className="dashboard-stack" data-testid="home-screen" gap="xl">
      <PageCard className="home-screen-card">
        <Stack gap="lg">
          <PageHeader
            actions={
              <RefreshButton
                loading={loading}
                onClick={() => setReloadKey((current) => current + 1)}
              />
            }
            description={resources.home.expiringMemberships.description}
            title={resources.home.expiringMemberships.title}
          />

          {loading ? (
            <LoadingState label="Загружаем истекающие абонементы..." />
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
                        label={resources.home.expiringMemberships.fields.daysUntilExpiration}
                        value={
                          <Badge
                            color={client.daysUntilExpiration <= 2 ? 'red' : 'accent.5'}
                            radius="xl"
                            variant="light"
                          >
                            {formatDaysUntilExpiration(client.daysUntilExpiration)}
                          </Badge>
                        }
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
      </PageCard>
    </Stack>
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

function formatDaysUntilExpiration(daysUntilExpiration: number) {
  if (daysUntilExpiration === 0) {
    return resources.home.expiringMemberships.today
  }

  return `${daysUntilExpiration} ${formatDayWord(daysUntilExpiration)}`
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
