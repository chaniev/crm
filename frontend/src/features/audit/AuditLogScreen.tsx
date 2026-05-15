import { useEffect, useState } from 'react'
import {
  Badge,
  Group,
  Modal,
  Pagination,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconCalendarEvent, IconFilter, IconSearch } from '@tabler/icons-react'
import {
  getAuditLogEntries,
  getAuditLogFilterOptions,
  type AuditLogEntry,
  type AuditLogFilterOptions,
  type AuditLogListResponse,
  type AuthenticatedUser,
  type GetAuditLogParams,
} from '../../lib/api'
import { resources } from '../../lib/resources'
import {
  Button,
  EmptyState,
  ErrorState,
  FilterToolbar,
  LoadingState,
  PageCard,
  PageHeader,
  RefreshButton,
  ResponsiveButtonGroup,
} from '../shared/ux'

type AuditLogScreenProps = {
  user: AuthenticatedUser
}

type AuditFilterValues = {
  userId: string | null
  source: string | null
  messengerPlatform: string | null
  actionType: string | null
  entityType: string | null
  dateFrom: string
  dateTo: string
}

const AUDIT_PAGE_SIZE = 20
const INITIAL_FILTER_VALUES: AuditFilterValues = {
  userId: null,
  source: null,
  messengerPlatform: null,
  actionType: null,
  entityType: null,
  dateFrom: '',
  dateTo: '',
}

const EMPTY_FILTER_OPTIONS: AuditLogFilterOptions = {
  users: [],
  actionTypes: [],
  entityTypes: [],
  sources: [],
  messengerPlatforms: [],
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
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null)
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

  useEffect(() => {
    if (!selectedEntry) {
      return
    }

    if (!response) {
      if (!loading) {
        setSelectedEntry(null)
      }
      return
    }

    if (!response.items.some((entry) => entry.id === selectedEntry.id)) {
      setSelectedEntry(null)
    }
  }, [loading, response, selectedEntry])

  function handleApplyFilters(values: AuditFilterValues) {
    const nextFilters = normalizeFilterValues(values)
    setSelectedEntry(null)
    setPage(1)
    setAppliedFilters(nextFilters)
    form.setValues(nextFilters)
  }

  function handleResetFilters() {
    setSelectedEntry(null)
    form.setValues(INITIAL_FILTER_VALUES)
    setPage(1)
    setAppliedFilters(INITIAL_FILTER_VALUES)
  }

  function handleRefresh() {
    setSelectedEntry(null)
    setReloadKey((current) => current + 1)
  }

  function handlePageChange(nextPage: number) {
    setSelectedEntry(null)
    setPage(nextPage)
  }

  if (!user.permissions.canViewAuditLog) {
    return (
      <Stack className="dashboard-stack" data-testid="audit-screen" gap="xl">
        <PageCard>
          <ErrorState
            message="Этот экран доступен главному тренеру и администратору."
            title="Журнал действий недоступен"
          />
        </PageCard>
      </Stack>
    )
  }

  const entries = response?.items ?? []
  const totalPages = getTotalPages(response)
  const userSelectOptions = filterOptions.users.map((auditUser) => ({
    value: auditUser.id,
    label: `${auditUser.fullName} (${auditUser.login})`,
  }))
  const sourceOptions = filterOptions.sources.map((source) => ({
    value: source,
    label: formatSource(source),
  }))
  const messengerPlatformOptions = filterOptions.messengerPlatforms.map(
    (messengerPlatform) => ({
      value: messengerPlatform,
      label: formatMessengerPlatform(messengerPlatform),
    }),
  )
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
      <PageCard className="audit-filter-card">
        <Stack gap="lg">
          <PageHeader
            actions={(
              <ResponsiveButtonGroup>
                <RefreshButton onClick={handleRefresh} />
              </ResponsiveButtonGroup>
            )}
          />

          <form data-testid="audit-filter-form" onSubmit={form.onSubmit(handleApplyFilters)}>
            <FilterToolbar
              actions={
                <ResponsiveButtonGroup>
                  <Button leftSection={<IconFilter size={18} />} type="submit">
                    Применить фильтры
                  </Button>
                  <Button onClick={handleResetFilters} type="button" variant="secondary">
                    Сбросить
                  </Button>
                </ResponsiveButtonGroup>
              }
              className="audit-filter-toolbar"
            >
              <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }}>
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
                  data={sourceOptions}
                  label="Источник"
                  placeholder="Все источники"
                  searchable
                  {...form.getInputProps('source')}
                />
                <Select
                  clearable
                  data={messengerPlatformOptions}
                  label="Мессенджер"
                  placeholder="Все мессенджеры"
                  searchable
                  {...form.getInputProps('messengerPlatform')}
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
            </FilterToolbar>
          </form>
        </Stack>
      </PageCard>

      <PageCard>
        <Stack gap="lg">
          <PageHeader title="Записи журнала" />

          {loading ? (
            <LoadingState label="Загружаем журнал действий..." />
          ) : null}

          {!loading && error ? (
            <ErrorState
              message={error}
              title="Журнал не загрузился"
            />
          ) : null}

          {!loading && !error && entries.length === 0 ? (
            <EmptyState
              description="Сбросьте фильтры или обновите журнал после новых действий в системе."
              title="Под выбранные фильтры записей нет."
            />
          ) : null}

          {!loading && !error && entries.length > 0 ? (
            <div
              aria-label="Записи журнала действий"
              className="audit-log-grid audit-log-list"
              data-testid="audit-log-grid"
              role="table"
            >
              <div className="audit-log-header" role="row">
                <div role="columnheader">Дата</div>
                <div role="columnheader">Действие</div>
                <div role="columnheader">Объект</div>
                <div role="columnheader">Описание</div>
                <div role="columnheader">Автор</div>
                <div role="columnheader">Источник</div>
                <div role="columnheader">Детали</div>
              </div>
              {entries.map((entry) => (
                <AuditLogGridRow
                  entry={entry}
                  key={entry.id}
                  onOpenDetails={setSelectedEntry}
                />
              ))}
            </div>
          ) : null}

          {!loading && !error && totalPages > 1 ? (
            <Group justify="space-between" wrap="wrap">
              <Text c="dimmed" size="sm">
                {formatPaginationSummary(response)}
              </Text>
              <Pagination onChange={handlePageChange} total={totalPages} value={page} />
            </Group>
          ) : null}
        </Stack>
      </PageCard>

      <AuditDetailsModal
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />
    </Stack>
  )
}

type AuditLogGridRowProps = {
  entry: AuditLogEntry
  onOpenDetails: (entry: AuditLogEntry) => void
}

function AuditLogGridRow({ entry, onOpenDetails }: AuditLogGridRowProps) {
  const dateTimeParts = formatDateTimeParts(entry.createdAt)
  const userLogin = getUserLoginLabel(entry)

  return (
    <div className="audit-log-row" data-testid="audit-log-row" role="row">
      <div className="audit-log-cell audit-log-cell--date" role="cell">
        <span className="audit-log-cell__label">Дата</span>
        <Text fw={700} size="sm">
          {dateTimeParts.date}
        </Text>
        <Text c="dimmed" size="xs">
          {dateTimeParts.time}
        </Text>
      </div>

      <div className="audit-log-cell audit-log-cell--action" role="cell">
        <span className="audit-log-cell__label">Действие</span>
        <Text fw={700} size="sm">
          {formatActionType(entry.actionType)}
        </Text>
      </div>

      <div className="audit-log-cell audit-log-cell--entity" role="cell">
        <span className="audit-log-cell__label">Объект</span>
        <Text fw={700} size="sm">
          {formatEntityType(entry.entityType)}
        </Text>
        {entry.entityId ? (
          <Text c="dimmed" size="xs">
            ID: {entry.entityId}
          </Text>
        ) : null}
      </div>

      <div className="audit-log-cell audit-log-cell--description" role="cell">
        <span className="audit-log-cell__label">Описание</span>
        <Text className="audit-log-description" fw={700} size="sm">
          {entry.description}
        </Text>
      </div>

      <div
        aria-label={`Автор: ${formatUserLabel(entry)}`}
        className="audit-log-cell audit-log-cell--actor"
        data-testid="audit-log-actor-cell"
        role="cell"
      >
        <span className="audit-log-cell__label">Автор</span>
        <Text fw={700} size="sm">
          {entry.userName}
        </Text>
        {userLogin ? (
          <Text c="dimmed" size="xs">
            {userLogin}
          </Text>
        ) : null}
      </div>

      <div className="audit-log-cell audit-log-cell--source" role="cell">
        <span className="audit-log-cell__label">Источник</span>
        <Text fw={700} size="sm">
          {entry.source ? formatSource(entry.source) : 'Не указан'}
        </Text>
        {entry.messengerPlatform ? (
          <Text c="dimmed" size="xs">
            {formatMessengerPlatform(entry.messengerPlatform)}
          </Text>
        ) : null}
      </div>

      <div className="audit-log-cell audit-log-cell--details" role="cell">
        <Button
          aria-haspopup="dialog"
          aria-label={`Показать детали записи: ${entry.description}`}
          data-testid="audit-log-details-action"
          onClick={() => onOpenDetails(entry)}
          size="xs"
          variant="light"
        >
          Детали
        </Button>
      </div>
    </div>
  )
}

type AuditDetailsModalProps = {
  entry: AuditLogEntry | null
  onClose: () => void
}

function AuditDetailsModal({ entry, onClose }: AuditDetailsModalProps) {
  const dateTimeParts = entry ? formatDateTimeParts(entry.createdAt) : null

  return (
    <Modal
      centered
      onClose={onClose}
      opened={Boolean(entry)}
      size="xl"
      title="Подробности записи журнала"
    >
      {entry ? (
        <Stack data-testid="audit-log-details-modal" gap="lg">
          <Stack gap="sm">
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
              {entry.source ? (
                <Badge color="cyan" radius="xl" variant="light">
                  {formatSource(entry.source)}
                </Badge>
              ) : null}
              {entry.messengerPlatform ? (
                <Badge color="teal" radius="xl" variant="light">
                  {formatMessengerPlatform(entry.messengerPlatform)}
                </Badge>
              ) : null}
            </Group>

            <Text fw={800}>{entry.description}</Text>

            <Group gap="xs" wrap="wrap">
              <Text c="dimmed" size="sm">
                {dateTimeParts ? `${dateTimeParts.date}, ${dateTimeParts.time}` : null}
              </Text>
              {entry.entityId ? (
                <Text c="dimmed" size="sm">
                  ID объекта: {entry.entityId}
                </Text>
              ) : null}
            </Group>
          </Stack>

          <SimpleGrid cols={{ base: 1, md: 2 }}>
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
        </Stack>
      ) : null}
    </Modal>
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
    <Paper className="list-row-card audit-json-card" radius="var(--radius-inner)" withBorder>
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
    source: values.source?.trim() || null,
    messengerPlatform: values.messengerPlatform?.trim() || null,
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
    source: filters.source || undefined,
    messengerPlatform: filters.messengerPlatform || undefined,
    actionType: filters.actionType || undefined,
    entityType: filters.entityType || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  }
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
  return getDictionaryLabel(resources.audit.actionLabels, actionType)
}

function formatEntityType(entityType: string) {
  return getDictionaryLabel(resources.audit.entityLabels, entityType)
}

function formatSource(source: string) {
  return getDictionaryLabel(resources.audit.sourceLabels, source)
}

function formatMessengerPlatform(messengerPlatform: string) {
  return getDictionaryLabel(
    resources.audit.messengerPlatformLabels,
    messengerPlatform,
  )
}

function getDictionaryLabel(dictionary: Record<string, string>, value: string) {
  return dictionary[value] ?? value
}

function formatUserLabel(entry: AuditLogEntry) {
  const userLogin = getUserLoginLabel(entry)

  if (userLogin) {
    return `${entry.userName} (${userLogin})`
  }

  return entry.userName
}

function getUserLoginLabel(entry: AuditLogEntry) {
  if (entry.userLogin && !entry.userName.includes(entry.userLogin)) {
    return entry.userLogin
  }

  return null
}

function formatDateTimeParts(value: string) {
  if (!value) {
    return {
      date: 'Дата не указана',
      time: '',
    }
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return {
      date: value,
      time: '',
    }
  }

  return {
    date: new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date),
    time: new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date),
  }
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
