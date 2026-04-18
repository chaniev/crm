import { useEffect, useState } from 'react'
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Pagination,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import {
  IconAlertCircle,
  IconCalendarEvent,
  IconFilter,
  IconRefresh,
  IconSearch,
} from '@tabler/icons-react'
import {
  getAuditLogEntries,
  getAuditLogFilterOptions,
  type AuditLogEntry,
  type AuditLogFilterOptions,
  type AuditLogListResponse,
  type AuthenticatedUser,
  type GetAuditLogParams,
} from '../../lib/api'
import { ResponsiveButtonGroup } from '../shared/ux'

type AuditLogScreenProps = {
  user: AuthenticatedUser
}

type AuditFilterValues = {
  userId: string | null
  actionType: string | null
  entityType: string | null
  dateFrom: string
  dateTo: string
}

const AUDIT_PAGE_SIZE = 20
const INITIAL_FILTER_VALUES: AuditFilterValues = {
  userId: null,
  actionType: null,
  entityType: null,
  dateFrom: '',
  dateTo: '',
}

const EMPTY_FILTER_OPTIONS: AuditLogFilterOptions = {
  users: [],
  actionTypes: [],
  entityTypes: [],
}

const actionTypeLabels: Record<string, string> = {
  Login: 'Вход в систему',
  Logout: 'Выход из системы',
  PasswordChanged: 'Смена пароля',
  UserCreated: 'Создание пользователя',
  UserUpdated: 'Редактирование пользователя',
  ClientCreated: 'Создание клиента',
  ClientUpdated: 'Редактирование клиента',
  ClientArchived: 'Архивирование клиента',
  ClientRestored: 'Возврат клиента из архива',
  TrainingGroupCreated: 'Создание группы',
  TrainingGroupUpdated: 'Редактирование группы',
  ClientMembershipPurchased: 'Оформление абонемента',
  ClientMembershipRenewed: 'Продление абонемента',
  ClientMembershipCorrected: 'Исправление абонемента',
  ClientMembershipPaymentMarked: 'Отметка оплаты',
  ClientMembershipSingleVisitWrittenOff: 'Списание разового посещения',
  AttendanceMarked: 'Отметка посещения',
  AttendanceUpdated: 'Изменение посещения',
}

const entityTypeLabels: Record<string, string> = {
  UserSession: 'Сессия пользователя',
  User: 'Пользователь',
  Client: 'Клиент',
  TrainingGroup: 'Группа',
  ClientMembership: 'Абонемент',
  Attendance: 'Посещение',
}

export function AuditLogScreen({ user }: AuditLogScreenProps) {
  const form = useForm<AuditFilterValues>({
    initialValues: INITIAL_FILTER_VALUES,
  })
  const [response, setResponse] = useState<AuditLogListResponse | null>(null)
  const [filterOptions, setFilterOptions] = useState<AuditLogFilterOptions>(
    EMPTY_FILTER_OPTIONS,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [appliedFilters, setAppliedFilters] =
    useState<AuditFilterValues>(INITIAL_FILTER_VALUES)

  useEffect(() => {
    if (!user.permissions.canViewAuditLog) {
      setResponse(null)
      setFilterOptions(EMPTY_FILTER_OPTIONS)
      setError(null)
      setLoading(false)
      return
    }

    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const [nextOptions, nextResponse] = await Promise.all([
          getAuditLogFilterOptions(controller.signal),
          getAuditLogEntries(
            buildAuditRequestParams(appliedFilters, page),
            controller.signal,
          ),
        ])

        if (controller.signal.aborted) {
          return
        }

        setFilterOptions(nextOptions)
        setResponse(nextResponse)
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        setResponse(null)
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Не удалось загрузить журнал действий.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [appliedFilters, page, reloadKey, user.permissions.canViewAuditLog])

  function handleApplyFilters(values: AuditFilterValues) {
    const nextFilters = normalizeFilterValues(values)
    setPage(1)
    setAppliedFilters(nextFilters)
    form.setValues(nextFilters)
  }

  function handleResetFilters() {
    form.setValues(INITIAL_FILTER_VALUES)
    setPage(1)
    setAppliedFilters(INITIAL_FILTER_VALUES)
  }

  if (!user.permissions.canViewAuditLog) {
    return (
      <Stack className="dashboard-stack" data-testid="audit-screen" gap="xl">
        <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            title="Журнал действий недоступен"
            variant="light"
          >
            Этот экран доступен только ролям `HeadCoach` и `Administrator`.
          </Alert>
        </Paper>
      </Stack>
    )
  }

  const entries = response?.items ?? []
  const activeFiltersCount = countActiveFilters(appliedFilters)
  const totalPages = getTotalPages(response)
  const userSelectOptions = filterOptions.users.map((auditUser) => ({
    value: auditUser.id,
    label: `${auditUser.fullName} (${auditUser.login})`,
  }))
  const actionTypeOptions = filterOptions.actionTypes.map((actionType) => ({
    value: actionType,
    label: formatActionType(actionType),
  }))
  const entityTypeOptions = filterOptions.entityTypes.map((entityType) => ({
    value: entityType,
    label: formatEntityType(entityType),
  }))

  return (
    <Stack className="dashboard-stack" data-testid="audit-screen" gap="xl">
      <Paper className="dashboard-hero audit-hero" radius="36px" shadow="lg">
        <div className="dashboard-hero__glow" />
        <Stack className="dashboard-hero__content" gap="lg">
          <Group gap="sm" wrap="wrap">
            <Badge color="accent.5" radius="xl" size="lg" variant="filled">
              Этап 10
            </Badge>
            <Badge color="brand.1" radius="xl" size="lg" variant="light">
              Журнал действий
            </Badge>
            <Badge radius="xl" size="lg" variant="light">
              HeadCoach и Administrator
            </Badge>
          </Group>

          <Stack gap="sm">
            <Title c="white" className="dashboard-hero__title" order={1}>
              Route-level журнал показывает действия, описание и старые/новые значения
            </Title>
            <Text className="dashboard-hero__description" size="lg">
              Экран остаётся read-only: фильтрует backend-аудит по пользователю,
              типу действия, типу объекта и периоду, а изменения показывает как
              old/new JSON.
            </Text>
          </Stack>

          <ResponsiveButtonGroup>
            <Button
              leftSection={<IconRefresh size={18} />}
              onClick={() => setReloadKey((current) => current + 1)}
              variant="light"
            >
              Обновить
            </Button>
          </ResponsiveButtonGroup>
        </Stack>
      </Paper>

      <Paper className="surface-card surface-card--wide audit-filter-card" radius="28px" withBorder>
        <Stack gap="lg">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Text fw={700}>Фильтры журнала</Text>
              <Text c="dimmed" size="sm">
                Применение фильтров перезагружает записи с первой страницы.
              </Text>
            </div>

            <Group gap="xs" wrap="wrap">
              <Badge color="brand.1" radius="xl" variant="light">
                Активных фильтров: {activeFiltersCount}
              </Badge>
              {response ? (
                <Badge color="accent.5" radius="xl" variant="light">
                  Всего записей: {response.totalCount}
                </Badge>
              ) : null}
            </Group>
          </Group>

          <form data-testid="audit-filter-form" onSubmit={form.onSubmit(handleApplyFilters)}>
            <Stack gap="md">
              <SimpleGrid cols={{ base: 1, md: 2, xl: 5 }}>
                <Select
                  clearable
                  data={userSelectOptions}
                  label="Пользователь"
                  leftSection={<IconSearch size={16} />}
                  placeholder="Все пользователи"
                  searchable
                  {...form.getInputProps('userId')}
                />
                <Select
                  clearable
                  data={actionTypeOptions}
                  label="Тип действия"
                  placeholder="Все действия"
                  searchable
                  {...form.getInputProps('actionType')}
                />
                <Select
                  clearable
                  data={entityTypeOptions}
                  label="Тип объекта"
                  placeholder="Все объекты"
                  searchable
                  {...form.getInputProps('entityType')}
                />
                <TextInput
                  label="Период с"
                  leftSection={<IconCalendarEvent size={16} />}
                  type="date"
                  {...form.getInputProps('dateFrom')}
                />
                <TextInput
                  label="Период по"
                  leftSection={<IconCalendarEvent size={16} />}
                  type="date"
                  {...form.getInputProps('dateTo')}
                />
              </SimpleGrid>

              <ResponsiveButtonGroup>
                <Button leftSection={<IconFilter size={18} />} type="submit">
                  Применить фильтры
                </Button>
                <Button onClick={handleResetFilters} type="button" variant="default">
                  Сбросить
                </Button>
              </ResponsiveButtonGroup>
            </Stack>
          </form>
        </Stack>
      </Paper>

      <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
        <Stack gap="lg">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Text fw={700}>Записи журнала</Text>
              <Text c="dimmed" size="sm">
                Краткое описание действия раскрывается в детальный old/new diff.
              </Text>
            </div>

            {response ? (
              <Badge color="brand.1" radius="xl" variant="light">
                Страница {response.page}
              </Badge>
            ) : null}
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
              title="Журнал не загрузился"
              variant="light"
            >
              {error}
            </Alert>
          ) : null}

          {!loading && !error && entries.length === 0 ? (
            <Paper className="hint-card audit-empty-card" radius="24px" withBorder>
              <Stack gap="sm">
                <Text fw={700}>Под выбранные фильтры записей нет.</Text>
                <Text c="dimmed" size="sm">
                  Сбросьте фильтры или обновите журнал после новых действий в системе.
                </Text>
              </Stack>
            </Paper>
          ) : null}

          {!loading && !error && entries.length > 0 ? (
            <Accordion
              chevronPosition="right"
              className="audit-log-list"
              data-testid="audit-log-list"
              variant="separated"
            >
              {entries.map((entry) => (
                <Accordion.Item key={entry.id} value={entry.id}>
                  <Accordion.Control>
                    <Stack className="audit-entry-summary" gap="xs">
                      <Group gap="xs" wrap="wrap">
                        <Badge color="brand.1" radius="xl" variant="light">
                          {formatActionType(entry.actionType)}
                        </Badge>
                        <Badge color="accent.5" radius="xl" variant="light">
                          {formatEntityType(entry.entityType)}
                        </Badge>
                        <Badge radius="xl" variant="light">
                          {formatUserLabel(entry)}
                        </Badge>
                      </Group>

                      <Text fw={700}>{entry.description}</Text>

                      <Group gap="xs" wrap="wrap">
                        <Text c="dimmed" size="sm">
                          {formatDateTime(entry.createdAt)}
                        </Text>
                        {entry.entityId ? (
                          <Text c="dimmed" size="sm">
                            ID объекта: {entry.entityId}
                          </Text>
                        ) : null}
                      </Group>
                    </Stack>
                  </Accordion.Control>

                  <Accordion.Panel>
                    <SimpleGrid cols={{ base: 1, lg: 2 }}>
                      <JsonPanel
                        emptyLabel="Для этой записи старые значения не переданы."
                        title="Старые значения"
                        value={entry.oldValueJson}
                      />
                      <JsonPanel
                        emptyLabel="Для этой записи новые значения не переданы."
                        title="Новые значения"
                        value={entry.newValueJson}
                      />
                    </SimpleGrid>
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          ) : null}

          {!loading && !error && totalPages > 1 ? (
            <Group justify="space-between" wrap="wrap">
              <Text c="dimmed" size="sm">
                {formatPaginationSummary(response)}
              </Text>
              <Pagination onChange={setPage} total={totalPages} value={page} />
            </Group>
          ) : null}
        </Stack>
      </Paper>
    </Stack>
  )
}

type JsonPanelProps = {
  title: string
  value: unknown | null
  emptyLabel: string
}

function JsonPanel({ title, value, emptyLabel }: JsonPanelProps) {
  const formattedValue = formatJsonForDisplay(value)

  return (
    <Paper className="list-row-card audit-json-card" radius="24px" withBorder>
      <Stack gap="sm">
        <Text fw={700}>{title}</Text>
        {formattedValue ? (
          <Text className="audit-json-block" component="pre" size="sm">
            {formattedValue}
          </Text>
        ) : (
          <Text c="dimmed" size="sm">
            {emptyLabel}
          </Text>
        )}
      </Stack>
    </Paper>
  )
}

function normalizeFilterValues(values: AuditFilterValues): AuditFilterValues {
  return {
    userId: values.userId || null,
    actionType: values.actionType?.trim() || null,
    entityType: values.entityType?.trim() || null,
    dateFrom: values.dateFrom.trim(),
    dateTo: values.dateTo.trim(),
  }
}

function buildAuditRequestParams(
  filters: AuditFilterValues,
  page: number,
): GetAuditLogParams {
  return {
    page,
    pageSize: AUDIT_PAGE_SIZE,
    userId: filters.userId || undefined,
    actionType: filters.actionType || undefined,
    entityType: filters.entityType || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  }
}

function countActiveFilters(filters: AuditFilterValues) {
  return [
    filters.userId,
    filters.actionType,
    filters.entityType,
    filters.dateFrom,
    filters.dateTo,
  ].filter(Boolean).length
}

function getTotalPages(response: AuditLogListResponse | null) {
  if (!response) {
    return 1
  }

  if (response.totalCount !== null) {
    return Math.max(1, Math.ceil(response.totalCount / response.pageSize))
  }

  return response.hasNextPage ? response.page + 1 : Math.max(response.page, 1)
}

function formatPaginationSummary(response: AuditLogListResponse | null) {
  if (!response) {
    return ''
  }

  const firstItemIndex = response.totalCount === 0 ? 0 : response.skip + 1
  const lastItemIndex = response.skip + response.items.length

  if (response.totalCount !== null) {
    return `Показаны записи ${firstItemIndex}-${lastItemIndex} из ${response.totalCount}.`
  }

  return `Показаны записи ${firstItemIndex}-${lastItemIndex}.`
}

function formatActionType(actionType: string) {
  return actionTypeLabels[actionType] ?? actionType
}

function formatEntityType(entityType: string) {
  return entityTypeLabels[entityType] ?? entityType
}

function formatUserLabel(entry: AuditLogEntry) {
  if (entry.userLogin && !entry.userName.includes(entry.userLogin)) {
    return `${entry.userName} (${entry.userLogin})`
  }

  return entry.userName
}

function formatDateTime(value: string) {
  if (!value) {
    return 'Дата не указана'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatJsonForDisplay(value: AuditLogEntry['oldValueJson']) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
