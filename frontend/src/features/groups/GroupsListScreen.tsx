import { useEffect, useState } from 'react'
import {
  Alert,
  Badge,
  Drawer,
  Group,
  Select,
  Stack,
  Switch,
  Text,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconEdit,
  IconFilterOff,
  IconPlus,
  IconUsersGroup,
} from '@tabler/icons-react'
import type { TrainingGroupListItem } from '../../lib/api'
import { formatGroupSchedule } from '../../lib/groupSchedule'
import {
  ActiveFiltersBar,
  AppPagination,
  Button,
  EntityLocatorBar,
  EmptyState,
  ErrorState,
  IconButton,
  ListRangeStatus,
  LoadingState,
  PageLayout,
  PageSection,
  TaskToolbarAction,
  TaskToolbarRefreshAction,
  TemporarySurfaceFooter,
  type ActiveFilter,
} from '../shared/ux'
import { GROUPS_STATUS_LABELS } from './groupManagement.constants'
import { escapeCssIdentifier } from './groupDom'
import {
  fromGroupStatusFilter,
  toGroupStatusFilter,
  type GroupStatusFilter,
} from './groupListQuery'
import type { GroupListReturnSnapshot } from './groupListReturnState'
import { useGroupsListState, type GroupsListState } from './useGroupsListState'
import { fe13GroupsCoreText } from '../../resources/fe-13-groups-core'


export type GroupsListScreenProps = {
  initialReturnSnapshot?: GroupListReturnSnapshot | null
  onCreate: () => void
  onEdit: (groupId: string, returnSnapshot?: GroupListReturnSnapshot | null) => void
  onSaveReturnState?: (snapshot: GroupListReturnSnapshot) => void
}

export function GroupsListScreen({
  initialReturnSnapshot = null,
  onCreate,
  onEdit,
  onSaveReturnState,
}: GroupsListScreenProps) {
  const [filtersOpened, setFiltersOpened] = useState(false)
  const state = useGroupsListState({ initialReturnSnapshot })
  const {
    completeReturnRestore,
    error,
    groups,
    loading,
    returnRestoreSnapshot,
  } = state
  const activeFilters = buildActiveGroupFilters(state)
  const showFirstLoad = state.loading && state.groups.length === 0 && !state.error
  const showBlockingError = state.error && state.groups.length === 0
  const showStaleError = state.error && state.groups.length > 0
  const showEmpty =
    !state.loading &&
    !state.error &&
    state.groups.length === 0
  const statusOptions = [
    { value: 'all', label: fe13GroupsCoreText.groupsListScreen_label_215816bf },
    { value: 'active', label: fe13GroupsCoreText.groupsListScreen_label_eeaeb976 },
    { value: 'inactive', label: fe13GroupsCoreText.groupsListScreen_label_4b6feb75 },
  ] satisfies Array<{ value: GroupStatusFilter; label: string }>

  useEffect(() => {
    onSaveReturnState?.(state.returnSnapshot)
  }, [onSaveReturnState, state.returnSnapshot])

  useEffect(() => {
    const restoreSnapshot = returnRestoreSnapshot

    if (!restoreSnapshot || loading) {
      return
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      const anchorId = restoreSnapshot.anchorGroupId ?? restoreSnapshot.selectedGroupId
      const shouldFocusRecovery = Boolean(error) || groups.length === 0
      const anchorElement = !shouldFocusRecovery && anchorId
        ? document.querySelector<HTMLElement>(
            `[data-group-id="${escapeCssIdentifier(anchorId)}"]`,
          )
        : null
      const focusTarget =
        anchorElement?.querySelector<HTMLElement>('[data-group-edit-action="true"]') ??
        document.querySelector<HTMLElement>('[data-group-return-recovery="true"]') ??
        document.getElementById('groups-results')

      if (anchorElement) {
        anchorElement.scrollIntoView({ block: 'center' })
      } else if (restoreSnapshot.scrollY > 0) {
        window.scrollTo({ top: restoreSnapshot.scrollY })
      }

      focusTarget?.focus({ preventScroll: true })
      completeReturnRestore()
    })

    return () => window.cancelAnimationFrame(animationFrameId)
  }, [completeReturnRestore, error, groups.length, loading, returnRestoreSnapshot])

  function handleEdit(groupId: string) {
    const snapshot = state.captureReturnSnapshot(groupId)
    onEdit(groupId, snapshot)
  }

  return (
    <PageLayout
      className="groups-screen"
      data-testid="groups-screen"
      showHeader={false}
      title={fe13GroupsCoreText.groupsListScreen_title_cd8c5873}
    >
      <div className="groups-list-controls" data-testid="groups-list-controls">
        <EntityLocatorBar
          accessibleLabel={fe13GroupsCoreText.groupsListScreen_accessibleLabel_ebbe1ead}
          activeFilterCount={state.activeFilterCount}
          className="groups-list-locator"
          disabled={showFirstLoad}
          frequentActions={(
            <TaskToolbarRefreshAction
              label={fe13GroupsCoreText.groupsListScreen_label_afde8d3f}
              loading={state.loading}
              onClick={state.reload}
            />
          )}
          onChange={state.setSearchDraft}
          onClear={state.clearSearchQuery}
          onInputBlur={state.applySearchNow}
          onOpenFilters={() => setFiltersOpened(true)}
          placeholder={fe13GroupsCoreText.groupsListScreen_placeholder_d45e66ab}
          primaryAction={(
            <TaskToolbarAction
              icon={<IconPlus size={18} />}
              label={fe13GroupsCoreText.groupsListScreen_label_c9fd9fc0}
              onClick={onCreate}
              priority="primary"
            />
          )}
          resultsId="groups-results"
          value={state.searchDraft}
        />

        <ActiveFiltersBar
          filters={activeFilters}
          onReset={state.resetFilters}
          resetLabel={fe13GroupsCoreText.groupsListScreen_resetLabel_51d41686}
        />
      </div>

      <Drawer
        classNames={{
          body: 'groups-filters-drawer__body',
          content: 'groups-filters-drawer__content',
          header: 'groups-filters-drawer__header',
        }}
        closeButtonProps={{
          'aria-label': fe13GroupsCoreText.groupsListScreen_ariaLabel_82f96580,
          className: 'temporary-surface-close groups-filters-drawer__close',
        }}
        closeOnClickOutside
        closeOnEscape
        onClose={() => setFiltersOpened(false)}
        opened={filtersOpened}
        overlayProps={{ backgroundOpacity: 0.18, blur: 2 }}
        position="bottom"
        returnFocus
        size="min(28rem, 100dvh)"
        title={fe13GroupsCoreText.groupsListScreen_title_7514e29a}
        trapFocus
        withCloseButton
        zIndex={300}
      >
        <div className="groups-filters-drawer__fields">
          <Select
            data={statusOptions}
            label={fe13GroupsCoreText.groupsListScreen_label_225077c6}
            onChange={(value) =>
              state.updateFilters({
                isActive: fromGroupStatusFilter(
                  (value as GroupStatusFilter | null) ?? 'all',
                ),
              })
            }
            value={toGroupStatusFilter(state.filters.isActive)}
          />
          <Switch
            checked={state.filters.withoutTrainer}
            label={fe13GroupsCoreText.groupsListScreen_label_732e659e}
            onChange={(event) =>
              state.updateFilters({
                withoutTrainer: event.currentTarget.checked,
              })
            }
          />
        </div>
        <TemporarySurfaceFooter
          primaryAction={(
            <Button onClick={() => setFiltersOpened(false)} type="button">
              {fe13GroupsCoreText.groupsListScreen_jsxText_ef05d579}</Button>
          )}
          secondaryAction={(
            <Button
              leftSection={<IconFilterOff size={16} />}
              onClick={state.resetFilters}
              type="button"
              variant="secondary"
            >
              {fe13GroupsCoreText.groupsListScreen_jsxText_407f8717}</Button>
          )}
        />
      </Drawer>

      <section aria-labelledby="groups-list-title" className="groups-list-section">
        <h2 className="groups-screen__visually-hidden" id="groups-list-title">{fe13GroupsCoreText.groupsListScreen_jsxText_bae09e03}</h2>
        <PageSection className="groups-list-surface" variant="plain">
          <Stack gap="xs">
            <div
              className="groups-list-status-row"
              data-testid="groups-list-status-row"
            >
              <ListRangeStatus
                end={state.pageEnd}
                loading={state.loading}
                start={state.pageStart}
                total={state.totalCount}
              />
              <div className="groups-list-metrics">
                <span
                  aria-label={
                    state.summary
                      ? fe13GroupsCoreText.groupsListScreen_template_314bfdaa(state.summary.totalCount)
                      : state.totalCount === null
                        ? fe13GroupsCoreText.groupsListScreen_string_e2d00d68
                        : fe13GroupsCoreText.groupsListScreen_template_0405138b(state.totalCount)
                  }
                >
                  {fe13GroupsCoreText.groupsListScreen_jsxText_f8ba76ae}{state.summary?.totalCount ?? state.totalCount ?? '—'}
                </span>
                <span
                  aria-label={
                    state.summary
                      ? fe13GroupsCoreText.groupsListScreen_template_f84f017b(state.summary.activeWithoutTrainerCount)
                      : fe13GroupsCoreText.groupsListScreen_string_4a9db5ba
                  }
                >
                  {fe13GroupsCoreText.groupsListScreen_jsxText_26c38cb9}{state.summary?.activeWithoutTrainerCount ?? '—'}
                </span>
              </div>
            </div>

            {showFirstLoad ? (
              <LoadingState label={fe13GroupsCoreText.groupsListScreen_label_0cf113c5} />
            ) : null}

            {showBlockingError ? (
              <ErrorState
                action={(
                  <Button data-group-return-recovery="true" onClick={state.reload}>
                    {fe13GroupsCoreText.groupsListScreen_jsxText_5189135a}</Button>
                )}
                message={state.error ?? fe13GroupsCoreText.groupsListScreen_string_85b97c29}
                title={fe13GroupsCoreText.groupsListScreen_title_214164fa}
              />
            ) : null}

            {showStaleError ? (
              <Alert
                color="red"
                icon={<IconAlertCircle size={18} />}
                title={fe13GroupsCoreText.groupsListScreen_title_3fdee84e}
                variant="light"
              >
                <Group gap="sm" justify="space-between">
                  <Text size="sm">{state.error}</Text>
                  <Button data-group-return-recovery="true" onClick={state.reload} variant="secondary">
                    {fe13GroupsCoreText.groupsListScreen_jsxText_5189135a}</Button>
                </Group>
              </Alert>
            ) : null}

            {showEmpty ? (
              <EmptyState
                action={state.isFirstRunEmpty ? null : state.filters.appliedQuery && state.activeFilterCount === 0 ? (
                  <Button
                    data-group-return-recovery="true"
                    onClick={state.clearSearchQuery}
                    variant="secondary"
                  >
                    {fe13GroupsCoreText.groupsListScreen_jsxText_6e1f7baa}</Button>
                ) : (
                  <Button
                    data-group-return-recovery="true"
                    onClick={state.resetFilters}
                    variant="secondary"
                  >
                    {fe13GroupsCoreText.groupsListScreen_resetLabel_51d41686}</Button>
                )}
                description={
                  state.isFirstRunEmpty
                    ? fe13GroupsCoreText.groupsListScreen_string_69da2f93
                    : fe13GroupsCoreText.groupsListScreen_string_401b50ae
                }
                icon={<IconUsersGroup size={24} />}
                title={
                  state.isFirstRunEmpty
                    ? fe13GroupsCoreText.groupsListScreen_string_33e84aeb
                    : fe13GroupsCoreText.groupsListScreen_string_ed2efb2d
                }
              />
            ) : null}

            {state.groups.length > 0 ? (
              <>
                <div
                  aria-busy={state.loading}
                  className="groups-list"
                  data-testid="groups-list"
                  id="groups-results"
                  role="list"
                  tabIndex={-1}
                >
                  <div className="groups-list-header" role="presentation">
                    <span>{fe13GroupsCoreText.groupsListScreen_jsxText_907efbd4}</span>
                    <span>{fe13GroupsCoreText.groupsListScreen_jsxText_f7642da6}</span>
                    <span>{fe13GroupsCoreText.groupsListScreen_jsxText_92431022}</span>
                    <span>{fe13GroupsCoreText.groupsListScreen_jsxText_0314946c}</span>
                    <span>{fe13GroupsCoreText.groupsListScreen_label_225077c6}</span>
                    <span>{fe13GroupsCoreText.groupsListScreen_jsxText_59792556}</span>
                  </div>
                  {state.groups.map((group) => (
                    <GroupRegistryRow
                      group={group}
                      key={group.id}
                      onEdit={handleEdit}
                      selected={state.selectedGroupId === group.id}
                    />
                  ))}
                </div>

                <AppPagination
                  className="groups-list-pagination"
                  disabled={state.loading}
                  label={fe13GroupsCoreText.groupsListScreen_label_2e31d9a4}
                  onChange={state.goToPage}
                  page={state.page}
                  total={state.pageCount}
                />
              </>
            ) : null}
          </Stack>
        </PageSection>
      </section>
    </PageLayout>
  )
}

function GroupRegistryRow({
  group,
  onEdit,
  selected,
}: {
  group: TrainingGroupListItem
  onEdit: (groupId: string) => void
  selected: boolean
}) {
  const trainerText =
    group.trainerNames.length > 0
      ? group.trainerNames.join(', ')
      : fe13GroupsCoreText.groupsListScreen_string_a674b477
  const scheduleText = formatGroupSchedule(group.weekdays, group.durationMinutes)

  return (
    <article
      className="group-registry-row crm-list-row-surface"
      data-group-id={group.id}
      data-selected={selected || undefined}
      data-testid={`group-card-${group.id}`}
      role="listitem"
    >
      <div className="group-registry-row__name">
        <Text component="h3" fw={800}>
          {group.name}
        </Text>
      </div>
      <Text
        className="group-registry-row__meta group-registry-row__location"
        c="dimmed"
        title={`${group.branchName} · ${group.hallName}`}
      >
        {group.branchName} {fe13GroupsCoreText.groupsListScreen_jsxText_a137f17a}{group.hallName}
      </Text>
      <Text
        className="group-registry-row__meta group-registry-row__schedule"
        c="dimmed"
        title={scheduleText}
      >
        {scheduleText}
      </Text>
      <div className="group-registry-row__trainer-status">
        <Text
          className="group-registry-row__meta group-registry-row__trainers"
          c="dimmed"
          title={trainerText}
        >
          {trainerText}
        </Text>
        <div className="group-registry-row__status">
          <Badge
            color={group.isActive ? 'teal' : 'gray'}
            radius="xl"
            variant="light"
          >
            {group.isActive
              ? GROUPS_STATUS_LABELS.active
              : GROUPS_STATUS_LABELS.inactive}
          </Badge>
        </div>
      </div>
      <IconButton
        className="group-registry-row__edit"
        data-group-edit-action="true"
        icon={<IconEdit size={18} />}
        label={fe13GroupsCoreText.groupsListScreen_template_5d140dac(group.name)}
        onClick={() => onEdit(group.id)}
        size={44}
        variant="light"
      />
    </article>
  )
}

function buildActiveGroupFilters(state: GroupsListState): ActiveFilter[] {
  const filters: ActiveFilter[] = []

  if (state.filters.appliedQuery) {
    filters.push({
      id: 'query',
      label: fe13GroupsCoreText.groupsListScreen_label_3a3cdea7(state.filters.appliedQuery),
      onRemove: state.clearSearchQuery,
    })
  }

  if (state.filters.isActive !== null) {
    filters.push({
      id: 'isActive',
      label: state.filters.isActive ? fe13GroupsCoreText.groupsListScreen_label_eeaeb976 : fe13GroupsCoreText.groupsListScreen_label_4b6feb75,
      onRemove: () => state.updateFilters({ isActive: null }),
    })
  }

  if (state.filters.withoutTrainer) {
    filters.push({
      id: 'withoutTrainer',
      label: fe13GroupsCoreText.groupsListScreen_label_732e659e,
      onRemove: () => state.updateFilters({ withoutTrainer: false }),
    })
  }

  return filters
}
