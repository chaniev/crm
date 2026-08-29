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
    { value: 'all', label: 'Все' },
    { value: 'active', label: 'Активные' },
    { value: 'inactive', label: 'Неактивные' },
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
      title="Группы"
    >
      <div className="groups-list-controls" data-testid="groups-list-controls">
        <EntityLocatorBar
          accessibleLabel="Поиск групп по названию"
          activeFilterCount={state.activeFilterCount}
          className="groups-list-locator"
          disabled={showFirstLoad}
          frequentActions={(
            <TaskToolbarRefreshAction
              label="Обновить список групп"
              loading={state.loading}
              onClick={state.reload}
            />
          )}
          onChange={state.setSearchDraft}
          onClear={state.clearSearchQuery}
          onInputBlur={state.applySearchNow}
          onOpenFilters={() => setFiltersOpened(true)}
          placeholder="Название группы"
          primaryAction={(
            <TaskToolbarAction
              icon={<IconPlus size={18} />}
              label="Новая группа"
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
          resetLabel="Сбросить все"
        />
      </div>

      <Drawer
        classNames={{
          body: 'groups-filters-drawer__body',
          content: 'groups-filters-drawer__content',
          header: 'groups-filters-drawer__header',
        }}
        closeButtonProps={{
          'aria-label': 'Закрыть фильтры групп',
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
        title="Фильтры групп"
        trapFocus
        withCloseButton
        zIndex={300}
      >
        <div className="groups-filters-drawer__fields">
          <Select
            data={statusOptions}
            label="Статус"
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
            label="Без тренера"
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
              Готово
            </Button>
          )}
          secondaryAction={(
            <Button
              leftSection={<IconFilterOff size={16} />}
              onClick={state.resetFilters}
              type="button"
              variant="secondary"
            >
              Сбросить
            </Button>
          )}
        />
      </Drawer>

      <section aria-labelledby="groups-list-title" className="groups-list-section">
        <h2 className="groups-screen__visually-hidden" id="groups-list-title">Список групп</h2>
        <PageSection className="groups-list-surface" variant="plain">
          <Stack gap="lg">
            <div className="groups-list-status-row">
              <ListRangeStatus
                end={state.pageEnd}
                loading={state.loading}
                start={state.pageStart}
                total={state.totalCount}
              />
            </div>

            {showFirstLoad ? (
              <LoadingState label="Загружаем список групп..." />
            ) : null}

            {showBlockingError ? (
              <ErrorState
                action={(
                  <Button data-group-return-recovery="true" onClick={state.reload}>
                    Повторить
                  </Button>
                )}
                message={state.error ?? 'Не удалось загрузить список групп.'}
                title="Список групп не загрузился"
              />
            ) : null}

            {showStaleError ? (
              <Alert
                color="red"
                icon={<IconAlertCircle size={18} />}
                title="Обновление списка не загрузилось"
                variant="light"
              >
                <Group gap="sm" justify="space-between">
                  <Text size="sm">{state.error}</Text>
                  <Button data-group-return-recovery="true" onClick={state.reload} variant="secondary">
                    Повторить
                  </Button>
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
                    Очистить поиск
                  </Button>
                ) : (
                  <Button
                    data-group-return-recovery="true"
                    onClick={state.resetFilters}
                    variant="secondary"
                  >
                    Сбросить все
                  </Button>
                )}
                description={
                  state.isFirstRunEmpty
                    ? 'Создайте первую группу, чтобы закрепить тренеров и подготовить основу для сценария посещений.'
                    : 'Измените поисковый запрос или фильтры, чтобы расширить список.'
                }
                icon={<IconUsersGroup size={24} />}
                title={
                  state.isFirstRunEmpty
                    ? 'Группы пока не созданы'
                    : 'Группы не найдены'
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
                    <span>Группа</span>
                    <span>Филиал и зал</span>
                    <span>Расписание</span>
                    <span>Тренеры</span>
                    <span>Статус</span>
                    <span>Редактировать</span>
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
                  label="Страницы списка групп"
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
      : 'Тренер не назначен'
  const scheduleText = formatGroupSchedule(group.weekdays, group.durationMinutes)

  return (
    <article
      className="group-registry-row"
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
      <Text className="group-registry-row__meta" c="dimmed">
        {group.branchName} · {group.hallName}
      </Text>
      <Text className="group-registry-row__meta" c="dimmed">
        {scheduleText}
      </Text>
      <Text className="group-registry-row__meta" c="dimmed">
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
      <IconButton
        className="group-registry-row__edit"
        data-group-edit-action="true"
        icon={<IconEdit size={18} />}
        label={`Редактировать группу «${group.name}»`}
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
      label: `Поиск: ${state.filters.appliedQuery}`,
      onRemove: state.clearSearchQuery,
    })
  }

  if (state.filters.isActive !== null) {
    filters.push({
      id: 'isActive',
      label: state.filters.isActive ? 'Активные' : 'Неактивные',
      onRemove: () => state.updateFilters({ isActive: null }),
    })
  }

  if (state.filters.withoutTrainer) {
    filters.push({
      id: 'withoutTrainer',
      label: 'Без тренера',
      onRemove: () => state.updateFilters({ withoutTrainer: false }),
    })
  }

  return filters
}
