import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  MultiSelect,
  NumberInput,
  Paper,
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
  getGroups,
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
  GROUPS_LIST_TAKE,
  GROUPS_STATUS_LABELS,
} from './groupManagement.constants'
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
import { showAppNotification } from '../shared/notifications'

type GroupsListScreenProps = {
  onCreate: () => void
  onEdit: (groupId: string) => void
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
  onCreate,
  onEdit,
}: GroupsListScreenProps) {
  const [groups, setGroups] = useState<TrainingGroupListItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const response = await getGroups({ take: GROUPS_LIST_TAKE }, controller.signal)
        setGroups(response.items)
        setTotalCount(response.totalCount)
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Не удалось загрузить список групп.',
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

  const activeGroupsCount = groups.filter((group) => group.isActive).length
  const staffedGroupsCount = groups.filter((group) => group.trainerCount > 0).length

  return (
    <Stack className="dashboard-stack" data-testid="groups-screen" gap="xl">
      <PageHeader
        actions={(
          <ResponsiveButtonGroup>
            <Button
              color="accent.5"
              leftSection={<IconPlus size={18} />}
              onClick={onCreate}
            >
              Создать группу
            </Button>
            <RefreshButton
              label="Обновить список"
              onClick={() => setReloadKey((currentKey) => currentKey + 1)}
            />
          </ResponsiveButtonGroup>
        )}
        className="page-title-row"
      />

      <SimpleGrid cols={GROUPS_GRID_COLUMNS}>
        <MetricCard
          description="Всего тренировочных групп"
          label="Группы"
          value={String(totalCount)}
        />
        <MetricCard
          description="Активные тренировочные группы"
          label="Активные"
          value={String(activeGroupsCount)}
        />
        <MetricCard
          description="Группы, где уже назначен хотя бы один тренер"
          label="С тренерами"
          value={String(staffedGroupsCount)}
        />
      </SimpleGrid>

      <PageCard>
        <Stack gap="lg">
          <PageHeader title="Список групп" />

          {loading ? (
            <LoadingState label="Загружаем список групп..." />
          ) : null}

          {!loading && error ? (
            <ErrorState
              message={error}
              title="Список групп не загрузился"
            />
          ) : null}

          {!loading && !error && groups.length === 0 ? (
            <EmptyState
              description="Создайте первую группу, чтобы закрепить тренеров и подготовить основу для сценария посещений."
              icon={<IconUsersGroup size={24} />}
              title="Группы пока не созданы"
            />
          ) : null}

          {!loading && !error && groups.length > 0 ? (
            <Stack data-testid="groups-list" gap="md">
              {groups.map((group) => (
                <Paper
                  className="list-row-card group-row-card"
                  data-testid={`group-card-${group.id}`}
                  key={group.id}
                  radius="24px"
                  withBorder
                >
                  <Stack gap="md">
                    <Group justify="space-between" wrap="wrap">
                      <Stack gap={8}>
                        <Group gap="sm" wrap="wrap">
                          <Text fw={700}>{group.name}</Text>
                          <Badge
                            color={group.isActive ? 'teal' : 'gray'}
                            radius="xl"
                            variant="light"
                          >
                            {group.isActive
                              ? GROUPS_STATUS_LABELS.active
                              : GROUPS_STATUS_LABELS.inactive}
                          </Badge>
                          <Badge radius="xl" variant="light">
                            Старт {group.trainingStartTime}
                          </Badge>
                          <Badge color="brand.1" radius="xl" variant="light">
                            {group.groupTypeName}
                          </Badge>
                        </Group>

                        <Text c="dimmed" size="sm">
                          Расписание:{' '}
                          {formatGroupSchedule(group.weekdays, group.durationMinutes)}
                        </Text>

                        <Text c="dimmed" size="sm">
                          Филиал: {group.branchName} · Зал: {group.hallName}
                        </Text>

                        <Text c="dimmed" size="sm">
                          {group.trainerCount > 0
                            ? `Тренеры: ${group.trainerNames.join(', ')}`
                            : 'Тренеры пока не назначены'}
                        </Text>
                      </Stack>

                      <Button
                        leftSection={<IconDeviceFloppy size={18} />}
                        onClick={() => onEdit(group.id)}
                        variant="light"
                      >
                        Редактировать
                      </Button>
                    </Group>

                    <Group gap="sm" wrap="wrap">
                      <Badge color="brand.1" radius="xl" variant="light">
                        Клиентов: {group.clientCount}
                      </Badge>
                      <Badge color="sand" radius="xl" variant="light">
                        Тренеров: {group.trainerCount}
                      </Badge>
                    </Group>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </PageCard>
    </Stack>
  )
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
    <Stack className="dashboard-stack" gap="xl">
      <PageHeader
        actions={(
          <Button
            leftSection={<IconArrowLeft size={18} />}
            onClick={onCancel}
            variant="default"
          >
            К списку групп
          </Button>
        )}
        className="page-title-row"
        title="Новая группа"
        titleOrder={1}
      />

      <PageCard>
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
              onCancel={onCancel}
              onSubmit={submit}
              submitLabel="Создать группу"
              submitting={submitting}
              trainerOptions={trainerOptions}
            />
          ) : null}
        </Stack>
      </PageCard>
    </Stack>
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
  const [clientCount, setClientCount] = useState(0)
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
        setClientCount(group.clientCount)
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
    <Stack className="dashboard-stack" gap="xl">
      <PageHeader
        actions={(
          <Button
            leftSection={<IconArrowLeft size={18} />}
            onClick={onBack}
            variant="default"
          >
            К списку групп
          </Button>
        )}
        className="page-title-row"
        title={`Настройка группы «${groupName}»`}
        titleOrder={1}
      />

      {loading ? (
        <PageCard>
          <LoadingState label="Загружаем группу..." />
        </PageCard>
      ) : null}

      {!loading && loadError ? (
        <PageCard>
          <ErrorState
            message={loadError}
            title="Экран редактирования не загрузился"
          />
        </PageCard>
      ) : null}

      {!loading && !loadError ? (
        <>
          <SimpleGrid cols={GROUPS_GRID_COLUMNS}>
            <MetricCard
              description="Клиенты, уже привязанные к группе"
              label="Клиенты"
              value={String(clientCount)}
            />
            <MetricCard
              description="Доступных для выбора активных тренеров"
              label="Тренеры"
              value={String(trainerOptions.length)}
            />
            <MetricCard
              description="Тренеры, выбранные в форме"
              label="Назначено"
              value={String(form.values.trainerIds.length)}
            />
          </SimpleGrid>

          <PageCard>
            <GroupForm
              form={form}
              formError={formError}
              branchOptions={branchOptions}
              groupTypeOptions={groupTypeOptions}
              hallOptions={hallOptions}
              onCancel={onBack}
              onSubmit={submit}
              submitLabel="Сохранить изменения"
              submitting={submitting}
              trainerOptions={trainerOptions}
            />
          </PageCard>

          <PageCard className="group-clients-card">
            <Stack gap="lg">
              <PageHeader
                actions={(
                  <Badge color="brand.1" radius="xl" variant="light">
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
          </PageCard>
        </>
      ) : null}
    </Stack>
  )
}

type GroupFormProps = {
  form: UseFormReturnType<GroupFormValues>
  formError: string | null
  branchOptions: Branch[]
  groupTypeOptions: GroupType[]
  hallOptions: Hall[]
  onCancel: () => void
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
  onCancel,
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
              label: `${groupType.name} (${groupType.systemIdentifier})`,
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
          description="Можно выбрать несколько активных тренеров."
          label="Тренеры группы"
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
            <Button onClick={onCancel} type="button" variant="subtle">
              Отменить
            </Button>
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
      <ThemeIcon color="brand.7" radius="xl" size={34} variant="light">
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
