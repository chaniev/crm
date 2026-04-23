import { useEffect, useState } from 'react'
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
} from '@mantine/core'
import {
  IconAlertCircle,
  IconPlus,
  IconRefresh,
  IconUserEdit,
  IconUsers,
} from '@tabler/icons-react'
import { getUsers, type UserListItem } from '../../lib/api'
import { resources } from '../../lib/resources'
import { MetricCard, ResponsiveButtonGroup } from '../shared/ux'
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
            <Button
              leftSection={<IconRefresh size={18} />}
              onClick={() => setReloadKey((currentKey) => currentKey + 1)}
              variant="light"
            >
              {resources.common.actions.refresh}
            </Button>
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

      <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
        <Stack gap="lg">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Text fw={700}>{resources.users.list.sectionTitle}</Text>
              <Text c="dimmed" size="sm">
                {resources.users.list.sectionDescription}
              </Text>
            </div>

            <Badge color="brand.1" radius="xl" size="lg" variant="light">
              {resources.users.list.headCoachOnlyBadge}
            </Badge>
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
              title={resources.users.list.loadingErrorTitle}
              variant="light"
            >
              {error}
            </Alert>
          ) : null}

          {!loading && !error && users.length === 0 ? (
            <Paper className="hint-card" radius="24px" withBorder>
              <Stack gap="sm">
                <Group gap="xs">
                  <ThemeIconPlaceholder />
                  <Text fw={700}>{resources.users.list.emptyTitle}</Text>
                </Group>
                <Text c="dimmed" size="sm">
                  {resources.users.list.emptyDescription}
                </Text>
              </Stack>
            </Paper>
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
      </Paper>
    </Stack>
  )
}

function ThemeIconPlaceholder() {
  return (
    <Badge color="brand.1" leftSection={<IconUsers size={14} />} radius="xl" variant="light">
      &nbsp;
    </Badge>
  )
}
