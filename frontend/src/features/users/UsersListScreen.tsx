import { useEffect, useState } from 'react'
import {
  Badge,
  Group,
  Paper,
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
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
  TaskToolbarAction,
  TaskToolbarActions,
  TaskToolbarRefreshAction,
} from '../shared/ux'
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
        setUsers(nextUsers.items)
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

  return (
    <PageLayout
      data-testid="users-screen"
      showHeader={false}
      title="Тренеры"
    >
      <PageSection variant="plain">
        <TaskToolbarActions
          className="users-list-toolbar"
          frequentActions={(
            <TaskToolbarRefreshAction
              loading={loading}
              onClick={() => setReloadKey((currentKey) => currentKey + 1)}
            />
          )}
          primaryAction={(
            <TaskToolbarAction
              icon={<IconPlus size={18} />}
              label={resources.users.list.createAction}
              onClick={onCreate}
              priority="primary"
            />
          )}
        />
      </PageSection>

      <PageSection>
        <Stack gap="lg">
          {loading ? (
            <LoadingState label="Загружаем тренеров..." />
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
                  data-testid={`user-card-${user.id}`}
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
                          color={user.mustChangePassword ? 'var(--crm-status-warning)' : 'var(--crm-action-primary)'}
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

                    {canEditUser(user) ? (
                      <Button
                        leftSection={<IconUserEdit size={18} />}
                        onClick={() => onEdit(user.id)}
                        variant="light"
                      >
                        {resources.users.list.editAction}
                      </Button>
                    ) : (
                      <Badge color="gray" radius="xl" variant="light">
                        {resources.users.list.readOnlyTarget}
                      </Badge>
                    )}
                  </Group>
                </Paper>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </PageSection>
    </PageLayout>
  )
}

function canEditUser(user: UserListItem) {
  if (user.allowedActions === undefined) {
    return true
  }

  return user.allowedActions.includes('Edit') || user.allowedActions.includes('Update')
}
