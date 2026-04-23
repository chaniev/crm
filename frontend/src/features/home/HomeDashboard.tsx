import { useEffect, useState, type ReactNode } from 'react'
import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconAlertCircle, IconRefresh, IconUserHeart } from '@tabler/icons-react'
import {
  getExpiringClientMemberships,
  type AuthenticatedUser,
  type ExpiringClientMembership,
  type MembershipType,
} from '../../lib/api'
import { resources } from '../../lib/resources'
import { ResponsiveButtonGroup } from '../shared/ux'

type HomeDashboardProps = {
  user: AuthenticatedUser
  onOpenClient?: (clientId: string) => void
}

const membershipTypeLabels: Record<MembershipType, string> = {
  SingleVisit: 'Разовое посещение',
  Monthly: 'Месячный',
  Yearly: 'Годовой',
}

export function HomeDashboard({ user, onOpenClient }: HomeDashboardProps) {
  const [clients, setClients] = useState<ExpiringClientMembership[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
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
            : 'Не удалось загрузить клиентов с истекающими абонементами.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [reloadKey])

  if (user.role !== 'HeadCoach' && user.role !== 'Administrator') {
    return (
      <Stack className="dashboard-stack" data-testid="home-screen" gap="xl">
        <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            title="Главная страница недоступна"
            variant="light"
          >
            Этот экран доступен главному тренеру и администратору.
          </Alert>
        </Paper>
      </Stack>
    )
  }

  return (
    <Stack className="dashboard-stack" data-testid="home-screen" gap="xl">
      <Paper className="surface-card surface-card--wide home-screen-card" radius="28px" withBorder>
        <Stack gap="lg">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Title order={2}>Истекающие абонементы</Title>
              <Text c="dimmed" size="sm">
                Только клиенты, у которых абонемент закончится менее чем через{' '}
                {resources.common.membership.expiringWindowDays} дней.
              </Text>
            </div>

            <Group gap="sm" wrap="wrap">
              <Badge color="brand.1" radius="xl" size="lg" variant="light">
                Главный тренер и администратор
              </Badge>
              <ResponsiveButtonGroup justify="flex-end">
                <Button
                  leftSection={<IconRefresh size={18} />}
                  onClick={() => setReloadKey((current) => current + 1)}
                  variant="light"
                >
                  {resources.common.actions.refresh}
                </Button>
              </ResponsiveButtonGroup>
            </Group>
          </Group>

          {loading ? (
            <Group justify="center" py="xl">
              <Loader color="brand.7" />
            </Group>
          ) : null}

          {!loading && error ? (
            <Alert
              color="red"
              icon={<IconAlertCircle size={18} />}
              title="Список не загрузился"
              variant="light"
            >
              {error}
            </Alert>
          ) : null}

          {!loading && !error && clients.length === 0 ? (
            <Paper className="list-row-card home-empty-card" radius="24px" withBorder>
              <Stack gap="sm">
                <Text fw={700}>
                  В ближайшие {resources.common.membership.expiringWindowDays} дней
                  истекающих абонементов нет.
                </Text>
                <Text c="dimmed" size="sm">
                  Экран остается узким operational-списком и не показывает дополнительные виджеты.
                </Text>
              </Stack>
            </Paper>
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
                        label="Тип абонемента"
                        value={membershipTypeLabels[client.membershipType]}
                      />
                      <HomeField
                        label="Дата окончания"
                        value={formatDateValue(client.expirationDate)}
                      />
                      <HomeField
                        label="Дней до окончания"
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
                        label="Оплата"
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
                          Карточка клиента
                        </Button>
                      </ResponsiveButtonGroup>
                    ) : null}
                  </div>
                </Paper>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </Paper>
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
    return 'Сегодня'
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
