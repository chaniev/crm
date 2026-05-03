import { useEffect, useState } from 'react'
import {
  Badge,
  Button,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core'
import {
  IconPlus,
  IconUserEdit,
  IconUsers,
} from '@tabler/icons-react'
import { getUsers, type UserListItem } from '../../lib/api'
import { resources } from '../../lib/resources'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  PageCard,
  PageHeader,
  RefreshButton,
  ResponsiveButtonGroup,
} from '../shared/ux'
import { UserManagementHero } from './UserManagementHero'
import { userRoleLabels } from './UserManagement.constants'

type UsersListScreenProps = {
  onCreate: () => void
  onEdit: (userId: string) => void
}

export function UsersListScreen({
  onCreate,
  onEdit,
}: UsersListScreenProps) {
  const [users, setUsers] = useState<UserListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const nextUsers = await getUsers(controller.signal)
        setUsers(nextUsers)
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : resources.users.list.loadingErrorMessage,
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

  const activeUsersCount = users.filter((user) => user.isActive).length
  const passwordRotationCount = users.filter((user) => user.mustChangePassword).length

  return (
    <Stack className="dashboard-stack" gap="xl">
      <UserManagementHero
        action={
          <ResponsiveButtonGroup>
            <Button
              color="accent.5"
              leftSection={<IconPlus size={18} />}
              onClick={onCreate}
            >
              {resources.users.list.createAction}
            </Button>
            <RefreshButton
              onClick={() => setReloadKey((currentKey) => currentKey + 1)}
            />
          </ResponsiveButtonGroup>
        }
        badge={resources.users.list.badge}
        description={resources.users.list.description}
        title={resources.users.list.title}
      />

      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <MetricCard
          description={resources.users.list.metrics.total.description}
          label={resources.users.list.metrics.total.label}
          value={String(users.length)}
        />
        <MetricCard
          description={resources.users.list.metrics.active.description}
          label={resources.users.list.metrics.active.label}
          value={String(activeUsersCount)}
        />
        <MetricCard
          description={resources.users.list.metrics.passwordRotation.description}
          label={resources.users.list.metrics.passwordRotation.label}
          value={String(passwordRotationCount)}
        />
      </SimpleGrid>

      <PageCard>
        <Stack gap="lg">
          <PageHeader
            actions={(
              <Badge color="brand.1" radius="xl" size="lg" variant="light">
                {resources.users.list.headCoachOnlyBadge}
              </Badge>
            )}
            description={resources.users.list.sectionDescription}
            title={resources.users.list.sectionTitle}
          />

          {loading ? (
            <LoadingState label="Загружаем пользователей..." />
          ) : null}

          {!loading && error ? (
            <ErrorState
              message={error}
              title={resources.users.list.loadingErrorTitle}
            />
          ) : null}

          {!loading && !error && users.length === 0 ? (
            <EmptyState
              description={resources.users.list.emptyDescription}
              icon={<IconUsers size={24} />}
              title={resources.users.list.emptyTitle}
            />
          ) : null}

          {!loading && !error && users.length > 0 ? (
            <Stack gap="md">
              {users.map((user) => (
                <Paper
                  className="list-row-card"
                  key={user.id}
                  radius="24px"
                  withBorder
                >
                  <Group justify="space-between" wrap="wrap">
                    <Stack gap={8}>
                      <Group gap="sm" wrap="wrap">
                        <Text fw={700}>{user.fullName}</Text>
                        <Badge radius="xl" variant="light">
                          {userRoleLabels[user.role]}
                        </Badge>
                        <Badge
                          color={user.isActive ? 'teal' : 'gray'}
                          radius="xl"
                          variant="light"
                        >
                          {user.isActive
                            ? resources.common.statuses.active
                            : resources.common.statuses.disabled}
                        </Badge>
                        <Badge
                          color={user.mustChangePassword ? 'accent.6' : 'brand.6'}
                          radius="xl"
                          variant="light"
                        >
                          {user.mustChangePassword
                            ? resources.users.list.passwordRotationRequired
                            : resources.users.list.passwordActual}
                        </Badge>
                      </Group>
                      <Text c="dimmed" size="sm">
                        {resources.users.list.loginPrefix}: {user.login}
                      </Text>
                      {user.messengerPlatformUserId ? (
                        <Text c="dimmed" size="sm">
                          {resources.users.list.telegramIdPrefix}: {user.messengerPlatformUserId}
                        </Text>
                      ) : null}
                    </Stack>

                    <Button
                      leftSection={<IconUserEdit size={18} />}
                      onClick={() => onEdit(user.id)}
                      variant="light"
                    >
                      {resources.users.list.editAction}
                    </Button>
                  </Group>
                </Paper>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </PageCard>
    </Stack>
  )
}
