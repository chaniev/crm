import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Alert,
  Badge,
  Checkbox,
  Drawer,
  Group,
  MultiSelect,
  NumberInput,
  Paper,
  Pagination,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core'
import { type UseFormReturnType, useForm } from '@mantine/form'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCalendarWeek,
  IconClockHour4,
  IconDeviceFloppy,
  IconEdit,
  IconFilterOff,
  IconPlus,
  IconUserStar,
  IconUsers,
  IconUsersGroup,
} from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  createGroup,
  getBranches,
  getGroup,
  getGroupClients,
  getGroupTypes,
  getHalls,
  getTrainerOptions,
  updateGroup,
  type Branch,
  type GroupType,
  type GroupClient,
  type Hall,
  type TrainerOption,
  type TrainingGroupDetails,
  type TrainingGroupListItem,
  type UpsertTrainingGroupRequest,
} from '../../lib/api'
import {
  formatDurationMinutes,
  formatGroupSchedule,
  formatWeekdays,
  WEEKDAY_OPTIONS,
} from '../../lib/groupSchedule'
import {
  GROUPS_DEFAULT_NAME,
  GROUPS_FORM_FALLBACK_VALUES,
  GROUPS_GRID_COLUMNS,
  GROUPS_STATUS_LABELS,
} from './groupManagement.constants'
import {
  ActiveFiltersBar,
  Button,
  EntityLocatorBar,
  EmptyState,
  ErrorState,
  IconButton,
  ListRangeStatus,
  LoadingState,
  PageLayout,
  PageSection,
  ResponsiveButtonGroup,
  SectionHeader,
  TaskToolbarAction,
  TaskToolbarRefreshAction,
  TemporarySurfaceFooter,
  type ActiveFilter,
} from '../shared/ux'
import { showAppNotification } from '../shared/notifications'
import { GroupTrainerSubstitutionsSection } from './GroupTrainerSubstitutionsSection'
import {
  fromGroupStatusFilter,
  toGroupStatusFilter,
  type GroupStatusFilter,
} from './groupListQuery'
import type { GroupListReturnSnapshot } from './groupListReturnState'
import { useGroupsListState, type GroupsListState } from './useGroupsListState'

type GroupsListScreenProps = {
  initialReturnSnapshot?: GroupListReturnSnapshot | null
  onCreate: () => void
  onEdit: (groupId: string, returnSnapshot?: GroupListReturnSnapshot | null) => void
  onSaveReturnState?: (snapshot: GroupListReturnSnapshot) => void
}

type GroupCreateScreenProps = {
  onCancel: () => void
  onCreated: () => void
}

type GroupEditScreenProps = {
  groupId: string
  onBack: () => void
  onUpdated: () => void
}

type GroupFormValues = {
  branchId: string
  hallId: string
  groupTypeId: string
  name: string
  trainingStartTime: string
  durationMinutes: number | ''
  weekdays: string[]
  isActive: boolean
  trainerIds: string[]
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

                <div
                  aria-label="Страницы списка групп"
                  className="groups-list-pagination"
                  role="navigation"
                >
                  <Pagination
                    disabled={state.loading}
                    getControlProps={(control) => ({
                      'aria-label':
                        control === 'previous'
                          ? 'Назад'
                          : control === 'next'
                            ? 'Дальше'
                            : undefined,
                    })}
                    getItemProps={(page) => ({
                      'aria-label':
                        page === state.page
                          ? `Страница ${page}, текущая`
                          : `Страница ${page}`,
                    })}
                    onChange={state.goToPage}
                    total={state.pageCount}
                    value={state.page}
                  />
                </div>
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

function escapeCssIdentifier(value: string) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value)
  }

  return value.replace(/["\\]/g, '\\$&')
}

export function GroupCreateScreen({
  onCancel,
  onCreated,
}: GroupCreateScreenProps) {
  const [trainerOptions, setTrainerOptions] = useState<TrainerOption[]>([])
  const [branchOptions, setBranchOptions] = useState<Branch[]>([])
  const [hallOptions, setHallOptions] = useState<Hall[]>([])
  const [groupTypeOptions, setGroupTypeOptions] = useState<GroupType[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const form = useGroupForm()
  const formRef = useRef(form)
  formRef.current = form

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoadingOptions(true)
      setLoadError(null)

      try {
        const [branches, halls, groupTypes, options] = await Promise.all([
          getBranches({ includeArchived: true }, controller.signal),
          getHalls({ includeArchived: true }, controller.signal),
          getGroupTypes(controller.signal),
          getTrainerOptions(controller.signal),
        ])
        setBranchOptions(branches)
        setHallOptions(halls)
        setGroupTypeOptions(groupTypes)
        setTrainerOptions(options)
        const firstActiveBranch = branches.find((branch) => !branch.isArchived)
        if (firstActiveBranch && !formRef.current.values.branchId) {
          formRef.current.setFieldValue('branchId', firstActiveBranch.id)
        }
        if (groupTypes[0] && !formRef.current.values.groupTypeId) {
          formRef.current.setFieldValue('groupTypeId', groupTypes[0].id)
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить список тренеров.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoadingOptions(false)
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [])

  async function submit(values: GroupFormValues) {
    setSubmitting(true)
    setFormError(null)
    form.clearErrors()

    try {
      const createdGroup = await createGroup(toUpsertGroupPayload(values))

      showAppNotification({
        id: 'group-create-success',
        title: 'Группа создана',
        message: `Группа «${createdGroup.name}» уже доступна в списке.`,
        color: 'teal',
      })

      onCreated()
    } catch (error) {
      if (error instanceof ApiError) {
        form.setErrors(applyFieldErrors(error.fieldErrors))
        setFormError(error.message)
        return
      }

      setFormError('Не удалось создать группу. Попробуйте еще раз.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageLayout
        actions={(
          <Button
            leftSection={<IconArrowLeft size={18} />}
            onClick={onCancel}
            variant="default"
          >
            К списку групп
          </Button>
        )}
      title="Новая группа"
    >

      <PageSection>
        <Stack gap="lg">
          {loadingOptions ? (
            <LoadingState label="Подготавливаем форму группы..." />
          ) : null}

          {!loadingOptions && loadError ? (
            <ErrorState
              message={loadError}
              title="Не удалось подготовить форму"
            />
          ) : null}

          {!loadingOptions && !loadError ? (
          <GroupForm
            form={form}
            formError={formError}
            branchOptions={branchOptions}
            groupTypeOptions={groupTypeOptions}
            hallOptions={hallOptions}
              cancelAction={{ label: 'Отменить', onClick: onCancel }}
              onSubmit={submit}
              submitLabel="Создать группу"
              submitting={submitting}
              trainerOptions={trainerOptions}
            />
          ) : null}
        </Stack>
      </PageSection>
    </PageLayout>
  )
}

export function GroupEditScreen({
  groupId,
  onBack,
  onUpdated,
}: GroupEditScreenProps) {
  const [trainerOptions, setTrainerOptions] = useState<TrainerOption[]>([])
  const [branchOptions, setBranchOptions] = useState<Branch[]>([])
  const [hallOptions, setHallOptions] = useState<Hall[]>([])
  const [groupTypeOptions, setGroupTypeOptions] = useState<GroupType[]>([])
  const [groupClients, setGroupClients] = useState<GroupClient[]>([])
  const [groupName, setGroupName] = useState(GROUPS_DEFAULT_NAME)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const form = useGroupForm()
  const formRef = useRef(form)

  useEffect(() => {
    formRef.current = form
  }, [form])

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setLoadError(null)

      try {
        const [
          group,
          branches,
          halls,
          groupTypes,
          options,
          clientsResponse,
        ] = await Promise.all([
          getGroup(groupId, controller.signal),
          getBranches({ includeArchived: true }, controller.signal),
          getHalls({ includeArchived: true }, controller.signal),
          getGroupTypes(controller.signal),
          getTrainerOptions(controller.signal),
          getGroupClients(groupId, controller.signal),
        ])

        setBranchOptions(branches)
        setHallOptions(halls)
        setGroupTypeOptions(groupTypes)
        setTrainerOptions(options)
        setGroupClients(clientsResponse.clients)
        setGroupName(group.name)
        formRef.current.setValues(toFormValues(group))
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить данные группы.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [groupId])

  async function submit(values: GroupFormValues) {
    setSubmitting(true)
    setFormError(null)
    form.clearErrors()

    try {
      const updatedGroup = await updateGroup(groupId, toUpsertGroupPayload(values))

      showAppNotification({
        id: `group-edit-success-${groupId}`,
        title: 'Группа обновлена',
        message: `Изменения группы «${updatedGroup.name}» сохранены.`,
        color: 'teal',
      })

      onUpdated()
    } catch (error) {
      if (error instanceof ApiError) {
        form.setErrors(applyFieldErrors(error.fieldErrors))
        setFormError(error.message)
        return
      }

      setFormError('Не удалось сохранить изменения группы.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageLayout
        actions={(
          <Button
            leftSection={<IconArrowLeft size={18} />}
            onClick={onBack}
            variant="default"
          >
            К списку групп
          </Button>
        )}
      title={`Настройка группы «${groupName}»`}
    >

      {loading ? (
        <PageSection>
          <LoadingState label="Загружаем группу..." />
        </PageSection>
      ) : null}

      {!loading && loadError ? (
        <PageSection>
          <ErrorState
            message={loadError}
            title="Экран редактирования не загрузился"
          />
        </PageSection>
      ) : null}

      {!loading && !loadError ? (
        <>
          <PageSection>
            <GroupForm
              form={form}
              formError={formError}
              branchOptions={branchOptions}
              groupTypeOptions={groupTypeOptions}
              hallOptions={hallOptions}
              cancelAction={null}
              onSubmit={submit}
              submitLabel="Сохранить изменения"
              submitting={submitting}
              trainerOptions={trainerOptions}
            />
          </PageSection>

          <PageSection>
            <GroupTrainerSubstitutionsSection
              groupId={groupId}
              trainerOptions={trainerOptions}
            />
          </PageSection>

          <PageSection className="group-clients-card">
            <Stack gap="lg">
              <SectionHeader
                actions={(
                  <Badge color="var(--crm-brand-primary-soft)" radius="xl" variant="light">
                    Всего: {groupClients.length}
                  </Badge>
                )}
                description="Read-only список помогает сверить состав группы до этапа клиентской карточки."
                title="Клиенты группы"
              />

              {groupClients.length === 0 ? (
                <EmptyState
                  description="После этапов клиентской базы здесь будет виден фактический состав группы."
                  icon={<IconUsers size={24} />}
                  title="В группе пока нет клиентов"
                />
              ) : (
                <Stack gap="sm">
                  {groupClients.map((client) => (
                    <Paper
                      className="list-row-card"
                      key={client.id}
                      radius="24px"
                      withBorder
                    >
                      <Group justify="space-between" wrap="wrap">
                        <Stack gap={6}>
                          <Text fw={700}>{client.fullName}</Text>
                          {client.phone ? (
                            <Text c="dimmed" size="sm">
                              Телефон: {client.phone}
                            </Text>
                          ) : null}
                        </Stack>

                        <Badge radius="xl" variant="light">
                          {client.status}
                        </Badge>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Stack>
          </PageSection>
        </>
      ) : null}
    </PageLayout>
  )
}

type GroupFormProps = {
  form: UseFormReturnType<GroupFormValues>
  formError: string | null
  branchOptions: Branch[]
  groupTypeOptions: GroupType[]
  hallOptions: Hall[]
  cancelAction: { label: string; onClick: () => void } | null
  onSubmit: (values: GroupFormValues) => Promise<void>
  submitLabel: string
  submitting: boolean
  trainerOptions: TrainerOption[]
}

function GroupForm({
  form,
  formError,
  branchOptions,
  groupTypeOptions,
  hallOptions,
  cancelAction,
  onSubmit,
  submitLabel,
  submitting,
  trainerOptions,
}: GroupFormProps) {
  const selectedBranchId =
    form.values.branchId ||
    branchOptions.find((branch) => !branch.isArchived)?.id ||
    ''
  const filteredHallOptions = selectedBranchId
    ? hallOptions.filter((hall) => hall.branchId === selectedBranchId)
    : []

  function updateBranch(branchId: string | null) {
    const nextBranchId = branchId ?? ''
    const nextAllowedHallIds = new Set(
      hallOptions
        .filter((hall) => hall.branchId === nextBranchId)
        .map((hall) => hall.id),
    )

    form.setFieldValue('branchId', nextBranchId)
    if (!nextAllowedHallIds.has(form.values.hallId)) {
      form.setFieldValue('hallId', '')
    }
  }

  return (
    <form
      onSubmit={form.onSubmit((values) =>
        void onSubmit({
          ...values,
          branchId: values.branchId || selectedBranchId,
        }),
      )}
    >
      <Stack gap="lg">
        {formError ? (
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            title="Сохранение не выполнено"
            variant="light"
          >
            {formError}
          </Alert>
        ) : null}

        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <Select
            allowDeselect={false}
            data={branchOptions.map((branch) => ({
              value: branch.id,
              label: formatBranchOptionLabel(branch),
              disabled: branch.isArchived,
            }))}
            label="Филиал"
            onChange={updateBranch}
            placeholder="Выберите филиал"
            searchable
            value={selectedBranchId || null}
            error={form.errors.branchId}
          />
          <Select
            allowDeselect={false}
            data={filteredHallOptions.map((hall) => ({
              value: hall.id,
              label: formatHallOptionLabel(hall),
              disabled: hall.isArchived,
            }))}
            disabled={!selectedBranchId}
            label="Зал"
            onChange={(hallId) => form.setFieldValue('hallId', hallId ?? '')}
            placeholder={selectedBranchId ? 'Выберите зал' : 'Сначала выберите филиал'}
            searchable
            value={form.values.hallId || null}
            error={form.errors.hallId}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <TextInput
            label="Название группы"
            placeholder="Например, Юниоры 18:00"
            {...form.getInputProps('name')}
          />
          <Select
            allowDeselect={false}
            data={groupTypeOptions.map((groupType) => ({
              value: groupType.id,
              label: groupType.name,
            }))}
            label="Тип группы"
            onChange={(groupTypeId) =>
              form.setFieldValue('groupTypeId', groupTypeId ?? '')
            }
            placeholder="Выберите тип группы"
            searchable
            value={form.values.groupTypeId || null}
            error={form.errors.groupTypeId}
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <TextInput
            label="Время начала"
            placeholder="18:00"
            type="time"
            {...form.getInputProps('trainingStartTime')}
          />
          <NumberInput
            allowDecimal={false}
            label="Длительность"
            onChange={(value) =>
              form.setFieldValue(
                'durationMinutes',
                typeof value === 'number' ? value : '',
              )
            }
            placeholder="60"
            suffix=" мин"
            value={form.values.durationMinutes}
            error={form.errors.durationMinutes}
          />
        </SimpleGrid>

        <Checkbox.Group
          label="Дни недели"
          onChange={(weekdays) => form.setFieldValue('weekdays', weekdays)}
          value={form.values.weekdays}
          error={form.errors.weekdays}
        >
          <Group gap="xs" mt="xs">
            {WEEKDAY_OPTIONS.map((option) => (
              <Checkbox
                key={option.value}
                label={option.label}
                value={option.value}
              />
            ))}
          </Group>
        </Checkbox.Group>

        <MultiSelect
          data={trainerOptions.map((trainer) => ({
            value: trainer.id,
            label: `${trainer.fullName} (${trainer.login})`,
          }))}
          description="Можно выбрать несколько активных тренеров. Временное замещение на период настраивается отдельно и не меняет этот список."
          label="Основные тренеры группы"
          placeholder="Выберите тренеров"
          searchable
          {...form.getInputProps('trainerIds')}
        />

        <Switch
          checked={form.values.isActive}
          color="teal"
          label="Группа активна"
          onChange={(event) =>
            form.setFieldValue('isActive', event.currentTarget.checked)
          }
        />

        <Paper className="hint-card" radius="24px" withBorder>
          <SimpleGrid cols={GROUPS_GRID_COLUMNS}>
            <HintStat
              icon={<IconUsersGroup size={18} />}
              label="Филиал"
              value={
                branchOptions.find((branch) => branch.id === form.values.branchId)?.name ??
                'Не выбран'
              }
            />
            <HintStat
              icon={<IconUsersGroup size={18} />}
              label="Тип"
              value={
                groupTypeOptions.find(
                  (groupType) => groupType.id === form.values.groupTypeId,
                )?.name ?? 'Не выбран'
              }
            />
            <HintStat
              icon={<IconUsersGroup size={18} />}
              label="Зал"
              value={
                hallOptions.find((hall) => hall.id === form.values.hallId)?.name ??
                'Не выбран'
              }
            />
            <HintStat
              icon={<IconClockHour4 size={18} />}
              label="Старт"
              value={
                form.values.trainingStartTime ||
                GROUPS_FORM_FALLBACK_VALUES.trainingStartTime
              }
            />
            <HintStat
              icon={<IconCalendarWeek size={18} />}
              label="Дни"
              value={
                form.values.weekdays.length > 0
                  ? formatWeekdays(form.values.weekdays.map(Number))
                  : GROUPS_FORM_FALLBACK_VALUES.weekdays
              }
            />
            <HintStat
              icon={<IconClockHour4 size={18} />}
              label="Длительность"
              value={
                typeof form.values.durationMinutes === 'number'
                  ? formatDurationMinutes(form.values.durationMinutes)
                  : GROUPS_FORM_FALLBACK_VALUES.durationMinutes
              }
            />
            <HintStat
              icon={<IconUserStar size={18} />}
              label="Тренеры"
              value={String(form.values.trainerIds.length)}
            />
          </SimpleGrid>
        </Paper>

        <Group justify="space-between" wrap="wrap">
          <Text c="dimmed" size="sm">
            После сохранения тренеры увидят назначенную группу в своем рабочем списке.
          </Text>

          <ResponsiveButtonGroup justify="flex-end">
            {cancelAction ? (
              <Button onClick={cancelAction.onClick} type="button" variant="subtle">
                {cancelAction.label}
              </Button>
            ) : null}
            <Button
              leftSection={<IconDeviceFloppy size={18} />}
              loading={submitting}
              type="submit"
            >
              {submitLabel}
            </Button>
          </ResponsiveButtonGroup>
        </Group>
      </Stack>
    </form>
  )
}

type HintStatProps = {
  icon: ReactNode
  label: string
  value: string
}

function HintStat({
  icon,
  label,
  value,
}: HintStatProps) {
  return (
    <Group gap="sm" wrap="nowrap">
      <ThemeIcon color="var(--crm-action-primary)" radius="xl" size={34} variant="light">
        {icon}
      </ThemeIcon>
      <Stack gap={2}>
        <Text c="dimmed" fw={600} size="xs">
          {label}
        </Text>
        <Text fw={700}>{value}</Text>
      </Stack>
    </Group>
  )
}

function formatBranchOptionLabel(branch: Branch) {
  const parts = [branch.name]

  if (branch.address) {
    parts.push(branch.address)
  }

  if (branch.isArchived) {
    parts.push('архивный')
  }

  return parts.join(' · ')
}

function formatHallOptionLabel(hall: Hall) {
  const parts = [hall.name]

  if (hall.isArchived) {
    parts.push('архивный')
  }

  return parts.join(' · ')
}

function useGroupForm() {
  return useForm<GroupFormValues>({
    initialValues: {
      branchId: '',
      hallId: '',
      groupTypeId: '',
      name: '',
      trainingStartTime: '',
      durationMinutes: '',
      weekdays: [],
      isActive: true,
      trainerIds: [],
    },
    validate: {
      name: (value) => (value.trim() ? null : 'Введите название группы.'),
      trainingStartTime: (value) =>
        value.trim() ? null : 'Укажите время начала тренировки.',
      groupTypeId: (value) => (value ? null : 'Выберите тип группы.'),
    },
  })
}

function toUpsertGroupPayload(
  values: GroupFormValues,
): UpsertTrainingGroupRequest {
  return {
    name: values.name.trim(),
    branchId: values.branchId || undefined,
    hallId: values.hallId || undefined,
    groupTypeId: values.groupTypeId || undefined,
    trainingStartTime: values.trainingStartTime.trim(),
    durationMinutes:
      typeof values.durationMinutes === 'number' ? values.durationMinutes : null,
    weekdays: values.weekdays.map(Number),
    isActive: values.isActive,
    trainerIds: [...values.trainerIds].sort(),
  }
}

function toFormValues(group: TrainingGroupDetails): GroupFormValues {
  return {
    branchId: group.branchId,
    hallId: group.hallId,
    groupTypeId: group.groupTypeId,
    name: group.name,
    trainingStartTime: group.trainingStartTime,
    durationMinutes: group.durationMinutes,
    weekdays: group.weekdays.map(String),
    isActive: group.isActive,
    trainerIds: group.trainerIds,
  }
}
