import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Badge,
  Drawer,
  Group,
  Select,
  Stack,
  Text,
} from '@mantine/core'
import {
  IconFilterOff,
  IconPlus,
  IconUserEdit,
  IconUsers,
} from '@tabler/icons-react'
import { getUsers, type UserListItem, type UserListResponse } from '../../lib/api'
import { resources } from '../../lib/resources'
import {
  Button,
  ActiveFiltersBar,
  EntityLocatorBar,
  EmptyState,
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
  TaskToolbarAction,
  TaskToolbarRefreshAction,
  TemporarySurfaceFooter,
  type ActiveFilter,
} from '../shared/ux'
import { userRoleLabels } from './UserManagement.constants'
import {
  countActiveTrainerFilters,
  DEFAULT_TRAINER_LIST_FILTERS,
  filterTrainerListItems,
  normalizeTrainerListSearchQuery,
  type TrainerListFilters,
  type TrainerPasswordFilter,
  type TrainerStatusFilter,
} from './trainerListSearch'
import { fe11SettingsUsersText } from '../../resources/fe-11-settings-users'


export type TrainerListReturnRequest = {
  trainerId: string | null
  scrollY: number
}

type UsersListScreenProps = {
  filters: TrainerListFilters
  onCreate: () => void
  onEdit: (userId: string) => void
  onFiltersChange: (filters: TrainerListFilters) => void
  onQueryChange: (query: string) => void
  onReturnFocusConsumed?: () => void
  query: string
  returnFocusRequest?: TrainerListReturnRequest | null
}

export function UsersListScreen({
  filters,
  onCreate,
  onEdit,
  onFiltersChange,
  onQueryChange,
  onReturnFocusConsumed,
  query,
  returnFocusRequest = null,
}: UsersListScreenProps) {
  const [filtersOpened, setFiltersOpened] = useState(false)
  const [response, setResponse] = useState<UserListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const resultsRef = useRef<HTMLDivElement | null>(null)
  const statusFilterRef = useRef<HTMLInputElement | null>(null)

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

  const filteredUsers = filterTrainerListItems(response?.items ?? [], query, filters)
  const hasQuery = Boolean(normalizeTrainerListSearchQuery(query))
  const activeFilterCount = countActiveTrainerFilters(filters)
  const hasActiveFilters = activeFilterCount > 0
  const canCreate = (response?.createRoleOptions.length ?? 0) > 0
  const showFirstRunEmpty =
    response &&
    response.items.length === 0 &&
    !hasQuery &&
    !hasActiveFilters
  const showFilteredEmpty =
    response &&
    filteredUsers.length === 0 &&
    !showFirstRunEmpty
  const activeFilters = buildActiveTrainerFilters(filters, onFiltersChange)
  const statusOptions = [
    { value: 'all', label: resources.users.list.filterAll },
    { value: 'inactive', label: resources.users.list.filterInactive },
  ] satisfies Array<{ value: TrainerStatusFilter; label: string }>
  const passwordOptions = [
    { value: 'all', label: resources.users.list.filterAll },
    { value: 'mustChange', label: resources.users.list.filterMustChangePassword },
  ] satisfies Array<{ value: TrainerPasswordFilter; label: string }>

  useEffect(() => {
    if (!returnFocusRequest || loading) {
      return
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      const row = returnFocusRequest.trainerId
        ? document.querySelector<HTMLElement>(
          getTrainerRowSelector(returnFocusRequest.trainerId),
        )
        : null
      const focusTarget =
        row instanceof HTMLButtonElement
          ? row
          : row
            ? resultsRef.current
            : document.querySelector<HTMLElement>('[data-trainer-return-recovery="true"]') ??
              resultsRef.current ??
              document.querySelector<HTMLInputElement>('#coaches-results-locator')

      if (row) {
        row.scrollIntoView({ block: 'center' })
      } else if (returnFocusRequest.scrollY > 0) {
        window.scrollTo({ top: returnFocusRequest.scrollY })
      }

      focusTarget?.focus({ preventScroll: true })
      onReturnFocusConsumed?.()
    })

    return () => window.cancelAnimationFrame(animationFrameId)
  }, [
    filteredUsers,
    loading,
    onReturnFocusConsumed,
    returnFocusRequest,
  ])

  useEffect(() => {
    if (!filtersOpened) {
      return
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      statusFilterRef.current?.focus()
    })

    return () => window.cancelAnimationFrame(animationFrameId)
  }, [filtersOpened])

  function reload() {
    setReloadKey((currentKey) => currentKey + 1)
  }

  function resetTrainerFilters() {
    onFiltersChange(DEFAULT_TRAINER_LIST_FILTERS)
  }

  function updateStatusFilter(status: TrainerStatusFilter) {
    onFiltersChange({
      ...filters,
      status,
    })
  }

  function updatePasswordFilter(password: TrainerPasswordFilter) {
    onFiltersChange({
      ...filters,
      password,
    })
  }

  function focusFiltersTriggerFallback() {
    window.setTimeout(() => {
      const focusTarget =
        document.querySelector<HTMLButtonElement>('.entity-locator-bar__filter:not(:disabled)') ??
        document.querySelector<HTMLInputElement>('#coaches-results-locator')

      focusTarget?.focus()
    }, 0)
  }

  function closeFiltersDrawer() {
    setFiltersOpened(false)
    focusFiltersTriggerFallback()
  }

  return (
    <PageLayout
      data-testid="users-screen"
      showHeader={false}
      title={fe11SettingsUsersText.usersListScreen_title_0314946c}
    >
      <PageSection variant="plain">
        <EntityLocatorBar
          activeFilterCount={activeFilterCount}
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
          onOpenFilters={() => setFiltersOpened(true)}
          placeholder={resources.users.list.searchPlaceholder}
          primaryAction={canCreate ? (
            <TaskToolbarAction
              icon={<IconPlus size={18} />}
              label={resources.users.list.createAction}
              onClick={onCreate}
              priority="primary"
            />
          ) : null}
          resultsId="coaches-results"
          value={query}
        />
        <ActiveFiltersBar
          filters={activeFilters}
          onReset={resetTrainerFilters}
          resetLabel={resources.common.actions.resetFilters}
        />
      </PageSection>

      <Drawer
        classNames={{
          body: 'coaches-filters-drawer__body',
          content: 'coaches-filters-drawer__content',
          header: 'coaches-filters-drawer__header',
        }}
        closeButtonProps={{
          'aria-label': resources.users.list.closeFilters,
          className: 'temporary-surface-close coaches-filters-drawer__close',
        }}
        closeOnClickOutside
        closeOnEscape
        onClose={closeFiltersDrawer}
        opened={filtersOpened}
        overlayProps={{ backgroundOpacity: 0.18, blur: 2 }}
        position="bottom"
        returnFocus
        size="min(24rem, 100dvh)"
        title={resources.users.list.filtersTitle}
        trapFocus
        withCloseButton
        zIndex={300}
      >
        <div className="coaches-filters-drawer__fields">
          <Select
            data-autofocus
            data={statusOptions}
            label={resources.users.list.statusFilterLabel}
            onChange={(value) =>
              updateStatusFilter((value as TrainerStatusFilter | null) ?? 'all')
            }
            ref={statusFilterRef}
            value={filters.status}
          />
          <Select
            data={passwordOptions}
            label={resources.users.list.passwordFilterLabel}
            onChange={(value) =>
              updatePasswordFilter((value as TrainerPasswordFilter | null) ?? 'all')
            }
            value={filters.password}
          />
        </div>
        <TemporarySurfaceFooter
          primaryAction={(
            <Button onClick={closeFiltersDrawer} type="button">
              {resources.users.list.doneFilters}
            </Button>
          )}
          secondaryAction={(
            <Button
              leftSection={<IconFilterOff size={16} />}
              onClick={resetTrainerFilters}
              type="button"
              variant="secondary"
            >
              {fe11SettingsUsersText.usersListScreen_jsxText_407f8717}</Button>
          )}
        />
      </Drawer>

      <div
        aria-busy={loading || undefined}
        aria-label={fe11SettingsUsersText.usersListScreen_ariaLabel_544fa84d}
        id="coaches-results"
        ref={resultsRef}
        role="region"
        tabIndex={-1}
      >
        <PageSection>
          <Stack gap="lg">
          {loading && !response ? (
            <LoadingState label={fe11SettingsUsersText.usersListScreen_label_d85336e3} />
          ) : null}

          {!loading && error && !response ? (
            <ErrorState
              action={(
                <Button
                  aria-label={fe11SettingsUsersText.usersListScreen_ariaLabel_49234431}
                  onClick={reload}
                  variant="light"
                >
                  {fe11SettingsUsersText.usersListScreen_jsxText_5189135a}</Button>
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
                    {fe11SettingsUsersText.usersListScreen_jsxText_5189135a}</Button>
                </Group>
              </Stack>
            </Alert>
          ) : null}

          {showFilteredEmpty ? (
            <EmptyState
              action={hasActiveFilters ? (
                <Button
                  data-trainer-return-recovery="true"
                  onClick={resetTrainerFilters}
                  variant="light"
                >
                  {resources.common.actions.resetFilters}
                </Button>
              ) : hasQuery ? (
                <Button
                  data-trainer-return-recovery="true"
                  onClick={() => onQueryChange('')}
                  variant="light"
                >
                  {fe11SettingsUsersText.usersListScreen_jsxText_6e1f7baa}</Button>
              ) : undefined}
              description={hasActiveFilters
                ? resources.users.list.emptyFilteredDescription
                : resources.users.list.emptySearchDescription}
              icon={<IconUsers size={24} />}
              title={resources.users.list.emptySearchTitle}
            />
          ) : null}

          {showFirstRunEmpty ? (
            <EmptyState
              description={resources.users.list.emptyDescription}
              icon={<IconUsers size={24} />}
              title={resources.users.list.emptyTitle}
            />
          ) : null}

          {response && filteredUsers.length > 0 ? (
            <Stack gap="md">
              {filteredUsers.map((user) => (
                <UserListCard
                  key={user.id}
                  onEdit={onEdit}
                  user={user}
                />
              ))}
            </Stack>
          ) : null}
          </Stack>
        </PageSection>
      </div>
    </PageLayout>
  )
}

function UserListCard({
  onEdit,
  user,
}: {
  onEdit: (userId: string) => void
  user: UserListItem
}) {
  const exceptionBadges: Array<{ color?: string; label: string }> = []

  if (user.role !== 'Coach') {
    exceptionBadges.push({ label: userRoleLabels[user.role] })
  }

  if (!user.isActive) {
    exceptionBadges.push({
      color: 'gray',
      label: resources.common.statuses.disabled,
    })
  }

  if (user.mustChangePassword) {
    exceptionBadges.push({
      color: 'var(--crm-status-warning)',
      label: resources.users.list.passwordRotationRequired,
    })
  }

  if (canEditUser(user)) {
    return (
      <button
        aria-label={fe11SettingsUsersText.usersListScreen_template_1fa0371e(user.fullName)}
        className="coach-registry-row coach-registry-row--editable list-row-card crm-list-row-surface"
        data-testid={`user-card-${user.id}`}
        data-trainer-id={user.id}
        onClick={() => onEdit(user.id)}
        type="button"
      >
        <UserRowContent exceptionBadges={exceptionBadges} user={user} />
        <span aria-hidden="true" className="coach-registry-row__cue">
          <IconUserEdit size={18} />
          <span>{resources.users.list.editAction}</span>
        </span>
      </button>
    )
  }

  return (
    <div
      className="coach-registry-row list-row-card crm-list-row-surface"
      data-testid={`user-card-${user.id}`}
      data-trainer-id={user.id}
    >
      <UserRowContent exceptionBadges={exceptionBadges} user={user} />
      <Badge color="gray" radius="xl" variant="light">
        {resources.users.list.readOnlyTarget}
      </Badge>
    </div>
  )
}

function canEditUser(user: UserListItem) {
  return user.allowedActions?.some((action) => action === 'Edit' || action === 'Update') === true
}

function UserRowContent({
  exceptionBadges,
  user,
}: {
  exceptionBadges: Array<{ color?: string; label: string }>
  user: UserListItem
}) {
  return (
    <span className="coach-registry-row__identity">
      <span className="coach-registry-row__title-line">
        <span className="coach-registry-row__name">{user.fullName}</span>
        {exceptionBadges.map((badge) => (
          <Badge
            color={badge.color}
            key={badge.label}
            radius="xl"
            variant="light"
          >
            {badge.label}
          </Badge>
        ))}
      </span>
      <span className="coach-registry-row__meta">
        {resources.users.list.loginPrefix}{fe11SettingsUsersText.usersListScreen_jsxText_e7ac0786}{user.login}
      </span>
      {user.messengerPlatformUserId ? (
        <span className="coach-registry-row__meta">
          {resources.users.list.telegramIdPrefix}{fe11SettingsUsersText.usersListScreen_jsxText_e7ac0786}{user.messengerPlatformUserId}
        </span>
      ) : null}
    </span>
  )
}

function buildActiveTrainerFilters(
  filters: TrainerListFilters,
  onFiltersChange: (filters: TrainerListFilters) => void,
): ActiveFilter[] {
  const activeFilters: ActiveFilter[] = []

  if (filters.status === 'inactive') {
    activeFilters.push({
      id: 'status',
      label: resources.users.list.filterInactive,
      onRemove: () => onFiltersChange({ ...filters, status: 'all' }),
    })
  }

  if (filters.password === 'mustChange') {
    activeFilters.push({
      id: 'password',
      label: resources.users.list.activePasswordFilter,
      onRemove: () => onFiltersChange({ ...filters, password: 'all' }),
    })
  }

  return activeFilters
}

function getTrainerRowSelector(trainerId: string) {
  return `[data-trainer-id="${trainerId.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`
}
