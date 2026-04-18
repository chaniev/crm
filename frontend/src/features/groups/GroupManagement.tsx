import { useEffect, useState, type ReactNode } from 'react'
import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  MultiSelect,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { type UseFormReturnType, useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCalendarWeek,
  IconClockHour4,
  IconDeviceFloppy,
  IconPlus,
  IconRefresh,
  IconUserStar,
  IconUsers,
  IconUsersGroup,
} from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  createGroup,
  getGroup,
  getGroupClients,
  getGroups,
  getTrainerOptions,
  updateGroup,
  type GroupClient,
  type TrainerOption,
  type TrainingGroupDetails,
  type TrainingGroupListItem,
  type UpsertTrainingGroupRequest,
} from '../../lib/api'

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
  name: string
  trainingStartTime: string
  scheduleText: string
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
        const response = await getGroups({ take: 50 }, controller.signal)
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
    <Stack className="dashboard-stack" gap="xl">
      <Paper className="dashboard-hero" radius="36px" shadow="lg">
        <div className="dashboard-hero__glow" />
        <Stack className="dashboard-hero__content" gap="lg">
          <Group gap="sm">
            <Badge color="accent.5" radius="xl" size="lg" variant="filled">
              Этап 5
            </Badge>
            <Badge color="brand.1" radius="xl" size="lg" variant="light">
              Route-level groups flow
            </Badge>
          </Group>

          <Stack gap="sm">
            <Title c="white" className="dashboard-hero__title" order={1}>
              Группы и назначение тренеров встроены в shell
            </Title>
            <Text className="dashboard-hero__description" size="lg">
              Список показывает расписание, время старта, состав тренеров и
              количество клиентов по каждой группе без перехода в отдельный модуль.
            </Text>
          </Stack>

          <Group className="management-hero__actions" gap="sm" wrap="wrap">
            <Button
              color="accent.5"
              leftSection={<IconPlus size={18} />}
              onClick={onCreate}
              variant="white"
            >
              Создать группу
            </Button>
            <Button
              leftSection={<IconRefresh size={18} />}
              onClick={() => setReloadKey((currentKey) => currentKey + 1)}
              variant="light"
            >
              Обновить список
            </Button>
          </Group>
        </Stack>
      </Paper>

      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <MetricCard
          description="Всего групп в management API"
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

      <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
        <Stack gap="lg">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Text fw={700}>Список групп</Text>
              <Text c="dimmed" size="sm">
                Показано {groups.length} из {totalCount}. Дальше этот же экран
                сможет работать и на частичной загрузке списка.
              </Text>
            </div>

            <Badge color="brand.1" radius="xl" size="lg" variant="light">
              HeadCoach и Administrator
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
              title="Список групп не загрузился"
              variant="light"
            >
              {error}
            </Alert>
          ) : null}

          {!loading && !error && groups.length === 0 ? (
            <Paper className="hint-card" radius="24px" withBorder>
              <Stack gap="sm">
                <Group gap="xs">
                  <ThemeIcon color="brand.7" radius="xl" size={30} variant="light">
                    <IconUsersGroup size={16} />
                  </ThemeIcon>
                  <Text fw={700}>Группы пока не созданы</Text>
                </Group>
                <Text c="dimmed" size="sm">
                  Создайте первую группу, чтобы закрепить тренеров и подготовить
                  основу для сценария посещений.
                </Text>
              </Stack>
            </Paper>
          ) : null}

          {!loading && !error && groups.length > 0 ? (
            <Stack gap="md">
              {groups.map((group) => (
                <Paper
                  className="list-row-card group-row-card"
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
                            {group.isActive ? 'Активна' : 'Неактивна'}
                          </Badge>
                          <Badge radius="xl" variant="light">
                            Старт {group.trainingStartTime}
                          </Badge>
                        </Group>

                        <Text c="dimmed" size="sm">
                          Расписание: {group.scheduleText}
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
      </Paper>
    </Stack>
  )
}

export function GroupCreateScreen({
  onCancel,
  onCreated,
}: GroupCreateScreenProps) {
  const [trainerOptions, setTrainerOptions] = useState<TrainerOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const form = useGroupForm()

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoadingOptions(true)
      setLoadError(null)

      try {
        const options = await getTrainerOptions(controller.signal)
        setTrainerOptions(options)
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

      notifications.show({
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
      <GroupFormHero
        action={(
          <Button
            leftSection={<IconArrowLeft size={18} />}
            onClick={onCancel}
            variant="white"
          >
            К списку групп
          </Button>
        )}
        badge="Новая группа"
        description="Создайте группу, задайте расписание и сразу назначьте нескольких тренеров."
        title="Route-level форма создания группы"
      />

      <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
        <Stack gap="lg">
          {loadingOptions ? (
            <Group justify="center" py="xl">
              <Loader color="brand.7" />
            </Group>
          ) : null}

          {!loadingOptions && loadError ? (
            <Alert
              color="red"
              icon={<IconAlertCircle size={18} />}
              title="Не удалось подготовить форму"
              variant="light"
            >
              {loadError}
            </Alert>
          ) : null}

          {!loadingOptions && !loadError ? (
            <GroupForm
              form={form}
              formError={formError}
              onSubmit={submit}
              submitLabel="Создать группу"
              submitting={submitting}
              trainerOptions={trainerOptions}
            />
          ) : null}
        </Stack>
      </Paper>
    </Stack>
  )
}

export function GroupEditScreen({
  groupId,
  onBack,
  onUpdated,
}: GroupEditScreenProps) {
  const [trainerOptions, setTrainerOptions] = useState<TrainerOption[]>([])
  const [groupClients, setGroupClients] = useState<GroupClient[]>([])
  const [groupName, setGroupName] = useState('Группа')
  const [clientCount, setClientCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const form = useGroupForm()

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setLoadError(null)

      try {
        const [group, options, clientsResponse] = await Promise.all([
          getGroup(groupId, controller.signal),
          getTrainerOptions(controller.signal),
          getGroupClients(groupId, controller.signal),
        ])

        setTrainerOptions(options)
        setGroupClients(clientsResponse.clients)
        setGroupName(group.name)
        setClientCount(group.clientCount)
        form.setValues(toFormValues(group))
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
  }, [form, groupId])

  async function submit(values: GroupFormValues) {
    setSubmitting(true)
    setFormError(null)
    form.clearErrors()

    try {
      const updatedGroup = await updateGroup(groupId, toUpsertGroupPayload(values))

      notifications.show({
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
      <GroupFormHero
        action={(
          <Button
            leftSection={<IconArrowLeft size={18} />}
            onClick={onBack}
            variant="white"
          >
            К списку групп
          </Button>
        )}
        badge="Редактирование группы"
        description="Обновляйте расписание, активность группы и список назначенных тренеров из одного экрана."
        title={`Настройка группы «${groupName}»`}
      />

      {loading ? (
        <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
          <Group justify="center" py="xl">
            <Loader color="brand.7" />
          </Group>
        </Paper>
      ) : null}

      {!loading && loadError ? (
        <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            title="Экран редактирования не загрузился"
            variant="light"
          >
            {loadError}
          </Alert>
        </Paper>
      ) : null}

      {!loading && !loadError ? (
        <>
          <SimpleGrid cols={{ base: 1, md: 3 }}>
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

          <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
            <GroupForm
              form={form}
              formError={formError}
              onSubmit={submit}
              submitLabel="Сохранить изменения"
              submitting={submitting}
              trainerOptions={trainerOptions}
            />
          </Paper>

          <Paper
            className="surface-card surface-card--wide group-clients-card"
            radius="28px"
            withBorder
          >
            <Stack gap="lg">
              <Group justify="space-between" wrap="wrap">
                <div>
                  <Text fw={700}>Клиенты группы</Text>
                  <Text c="dimmed" size="sm">
                    Read-only список помогает сверить состав группы до этапа клиентской карточки.
                  </Text>
                </div>

                <Badge color="brand.1" radius="xl" variant="light">
                  Всего: {groupClients.length}
                </Badge>
              </Group>

              {groupClients.length === 0 ? (
                <Paper className="hint-card" radius="24px" withBorder>
                  <Stack gap="sm">
                    <Group gap="xs">
                      <ThemeIcon color="brand.7" radius="xl" size={30} variant="light">
                        <IconUsers size={16} />
                      </ThemeIcon>
                      <Text fw={700}>В группе пока нет клиентов</Text>
                    </Group>
                    <Text c="dimmed" size="sm">
                      После этапов клиентской базы здесь будет виден фактический состав группы.
                    </Text>
                  </Stack>
                </Paper>
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
          </Paper>
        </>
      ) : null}
    </Stack>
  )
}

type GroupFormProps = {
  form: UseFormReturnType<GroupFormValues>
  formError: string | null
  onSubmit: (values: GroupFormValues) => Promise<void>
  submitLabel: string
  submitting: boolean
  trainerOptions: TrainerOption[]
}

function GroupForm({
  form,
  formError,
  onSubmit,
  submitLabel,
  submitting,
  trainerOptions,
}: GroupFormProps) {
  return (
    <form onSubmit={form.onSubmit((values) => void onSubmit(values))}>
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
          <TextInput
            label="Название группы"
            placeholder="Например, Юниоры 18:00"
            {...form.getInputProps('name')}
          />
          <TextInput
            label="Время начала"
            placeholder="18:00"
            type="time"
            {...form.getInputProps('trainingStartTime')}
          />
        </SimpleGrid>

        <TextInput
          label="Расписание"
          placeholder="Пн-Ср-Пт"
          {...form.getInputProps('scheduleText')}
        />

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
          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <HintStat
              icon={<IconClockHour4 size={18} />}
              label="Старт"
              value={form.values.trainingStartTime || 'Не задан'}
            />
            <HintStat
              icon={<IconCalendarWeek size={18} />}
              label="Расписание"
              value={form.values.scheduleText || 'Не задано'}
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
            После сохранения backend сразу обновит server-side scope назначенных тренеров.
          </Text>

          <Button
            leftSection={<IconDeviceFloppy size={18} />}
            loading={submitting}
            type="submit"
          >
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}

type MetricCardProps = {
  description: string
  label: string
  value: string
}

function MetricCard({
  description,
  label,
  value,
}: MetricCardProps) {
  return (
    <Paper className="surface-card metric-card" radius="28px" withBorder>
      <Stack gap={6}>
        <Text c="dimmed" fw={600} size="sm">
          {label}
        </Text>
        <Title order={3}>{value}</Title>
        <Text c="dimmed" size="sm">
          {description}
        </Text>
      </Stack>
    </Paper>
  )
}

type GroupFormHeroProps = {
  action: ReactNode
  badge: string
  description: string
  title: string
}

function GroupFormHero({
  action,
  badge,
  description,
  title,
}: GroupFormHeroProps) {
  return (
    <Paper className="dashboard-hero" radius="36px" shadow="lg">
      <div className="dashboard-hero__glow" />
      <Stack className="dashboard-hero__content" gap="lg">
        <Group gap="sm">
          <Badge color="accent.5" radius="xl" size="lg" variant="filled">
            Этап 5
          </Badge>
          <Badge color="brand.1" radius="xl" size="lg" variant="light">
            {badge}
          </Badge>
        </Group>

        <Stack gap="sm">
          <Title c="white" className="dashboard-hero__title" order={1}>
            {title}
          </Title>
          <Text className="dashboard-hero__description" size="lg">
            {description}
          </Text>
        </Stack>

        <Group className="management-hero__actions" gap="sm" wrap="wrap">
          {action}
        </Group>
      </Stack>
    </Paper>
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

function useGroupForm() {
  return useForm<GroupFormValues>({
    initialValues: {
      name: '',
      trainingStartTime: '',
      scheduleText: '',
      isActive: true,
      trainerIds: [],
    },
    validate: {
      name: (value) => (value.trim() ? null : 'Введите название группы.'),
      trainingStartTime: (value) =>
        value.trim() ? null : 'Укажите время начала тренировки.',
      scheduleText: (value) =>
        value.trim() ? null : 'Введите расписание группы.',
    },
  })
}

function toUpsertGroupPayload(
  values: GroupFormValues,
): UpsertTrainingGroupRequest {
  return {
    name: values.name.trim(),
    trainingStartTime: values.trainingStartTime.trim(),
    scheduleText: values.scheduleText.trim(),
    isActive: values.isActive,
    trainerIds: [...values.trainerIds].sort(),
  }
}

function toFormValues(group: TrainingGroupDetails): GroupFormValues {
  return {
    name: group.name,
    trainingStartTime: group.trainingStartTime,
    scheduleText: group.scheduleText,
    isActive: group.isActive,
    trainerIds: group.trainerIds,
  }
}
