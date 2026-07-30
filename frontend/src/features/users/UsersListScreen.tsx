import { useEffect, useState } from 'react'
import {
  Alert,
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
import { getUsers, type UserListItem, type UserListResponse } from '../../lib/api'
import { resources } from '../../lib/resources'
import {
  Button,
  EntityLocatorBar,
  EmptyState,
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
  TaskToolbarAction,
  TaskToolbarRefreshAction,
} from '../shared/ux'
import { userRoleLabels } from './UserManagement.constants'
import {
  filterTrainerListItems,
  normalizeTrainerListSearchQuery,
} from './trainerListSearch'

type UsersListScreenProps = {
  onCreate: () => void
  onEdit: (userId: string) => void
  onQueryChange: (query: string) => void
  query: string
}

export function UsersListScreen({
  onCreate,
  onEdit,
  onQueryChange,
  query,
}: UsersListScreenProps) {
  const [response, setResponse] = useState<UserListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const nextResponse = await getUsers(controller.signal)
        setResponse(nextResponse)
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

  const filteredUsers = filterTrainerListItems(response?.items ?? [], query)
  const hasQuery = Boolean(normalizeTrainerListSearchQuery(query))
  const canCreate = (response?.createRoleOptions.length ?? 0) > 0

  function reload() {
    setReloadKey((currentKey) => currentKey + 1)
  }

  return (
    <PageLayout
      data-testid="users-screen"
      showHeader={false}
      title="Тренеры"
    >
      <PageSection variant="plain">
        <EntityLocatorBar
          accessibleLabel={resources.users.list.searchAccessibleLabel}
          data-testid="users-list-locator"
          frequentActions={(
            <TaskToolbarRefreshAction
              loading={loading}
              onClick={reload}
            />
          )}
          onChange={onQueryChange}
          onClear={() => onQueryChange('')}
          placeholder={resources.users.list.searchPlaceholder}
          primaryAction={canCreate ? (
            <TaskToolbarAction
              icon={<IconPlus size={18} />}
              label={resources.users.list.createAction}
              onClick={onCreate}
              priority="primary"
            />
          ) : null}
          resultsId="users-results"
          value={query}
        />
      </PageSection>

      <div
        aria-busy={loading || undefined}
        aria-label="Результаты поиска тренеров"
        id="users-results"
        role="region"
      >
        <PageSection>
          <Stack gap="lg">
          {loading && !response ? (
            <LoadingState label="Загружаем тренеров..." />
          ) : null}

          {!loading && error && !response ? (
            <ErrorState
              action={(
                <Button
                  aria-label="Повторить загрузку списка тренеров"
                  onClick={reload}
                  variant="light"
                >
                  Повторить
                </Button>
              )}
              message={error}
              title={resources.users.list.loadingErrorTitle}
            />
          ) : null}

          {loading && response ? (
            <Text aria-live="polite" c="dimmed" fw={600} size="sm">
              {resources.users.list.refreshingLabel}
            </Text>
          ) : null}

          {!loading && error && response ? (
            <Alert color="red" title={resources.users.list.staleErrorTitle} variant="light">
              <Stack gap="sm">
                <Text size="sm">{error}</Text>
                <Group>
                  <Button onClick={reload} variant="light">
                    Повторить
                  </Button>
                </Group>
              </Stack>
            </Alert>
          ) : null}

          {response && filteredUsers.length === 0 ? (
            <EmptyState
              action={hasQuery ? (
                <Button onClick={() => onQueryChange('')} variant="light">
                  Очистить поиск
                </Button>
              ) : undefined}
              description={hasQuery
                ? resources.users.list.emptySearchDescription
                : resources.users.list.emptyDescription}
              icon={<IconUsers size={24} />}
              title={hasQuery
                ? resources.users.list.emptySearchTitle
                : resources.users.list.emptyTitle}
            />
          ) : null}

          {response && filteredUsers.length > 0 ? (
            <Stack gap="md">
              {filteredUsers.map((user) => (
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
      </div>
    </PageLayout>
  )
}

function canEditUser(user: UserListItem) {
  if (user.allowedActions === undefined) {
    return true
  }

  return user.allowedActions.includes('Edit') || user.allowedActions.includes('Update')
}
