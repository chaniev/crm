import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge,
  Group,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { IconCalendarEvent, IconEye, IconSearch } from '@tabler/icons-react'
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
  AppPagination,
  CompactFilterPanel,
  EmptyState,
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
  TaskToolbarRefreshAction,
  type CompactFilterItem,
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

type AuditResponseSnapshot = {
  key: string
  response: AuditLogListResponse
}

export function AuditLogScreen({ user }: AuditLogScreenProps) {
  const [responseSnapshot, setResponseSnapshot] =
    useState<AuditResponseSnapshot | null>(null)
  const [filterOptions, setFilterOptions] = useState<AuditLogFilterOptions>(
    EMPTY_FILTER_OPTIONS,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [staleError, setStaleError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null)
  const [filters, setFilters] = useState<AuditFilterValues>(INITIAL_FILTER_VALUES)
  const responseSnapshotRef = useRef<AuditResponseSnapshot | null>(null)
  const requestParams = useMemo(
    () => buildAuditRequestParams(filters, page),
    [filters, page],
  )
  const requestKey = useMemo(
    () => buildAuditRequestKey(requestParams),
    [requestParams],
  )

  function storeResponseSnapshot(nextSnapshot: AuditResponseSnapshot | null) {
    responseSnapshotRef.current = nextSnapshot
    setResponseSnapshot(nextSnapshot)
  }

  useEffect(() => {
    if (!user.permissions.canViewAuditLog) {
      storeResponseSnapshot(null)
      setFilterOptions(EMPTY_FILTER_OPTIONS)
      setError(null)
      setStaleError(null)
      setLoading(false)
      return
    }

    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)
      setStaleError(null)
      if (responseSnapshotRef.current?.key !== requestKey) {
        storeResponseSnapshot(null)
      }

      try {
        const [nextOptions, nextResponse] = await Promise.all([
          getAuditLogFilterOptions(controller.signal),
          getAuditLogEntries(requestParams, controller.signal),
        ])

        if (controller.signal.aborted) {
          return
        }

        setFilterOptions(nextOptions)
        storeResponseSnapshot({
          key: requestKey,
          response: nextResponse,
        })
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        const message =
          loadError instanceof Error
            ? loadError.message
            : 'Не удалось загрузить журнал действий.'
        const currentSnapshot = responseSnapshotRef.current

        if (currentSnapshot?.key === requestKey) {
          setStaleError('Не удалось обновить, показаны предыдущие данные')
          setError(null)
        } else {
          storeResponseSnapshot(null)
          setStaleError(null)
          setError(message)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [reloadKey, requestKey, requestParams, user.permissions.canViewAuditLog])

  const response =
    responseSnapshot?.key === requestKey ? responseSnapshot.response : null

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

  function updateFilters(nextFilters: Partial<AuditFilterValues>) {
    setSelectedEntry(null)
    setPage(1)
    setFilters((currentFilters) =>
      normalizeFilterValues({
        ...currentFilters,
        ...nextFilters,
      }),
    )
  }

  function handleResetFilters() {
    setSelectedEntry(null)
    setPage(1)
    setFilters(INITIAL_FILTER_VALUES)
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
      <PageLayout data-testid="audit-screen" showHeader={false} title="Журнал">
        <PageSection>
          <ErrorState
            message="Этот экран доступен главному тренеру и администратору."
            title="Журнал действий недоступен"
          />
        </PageSection>
      </PageLayout>
    )
  }

  const entries = response?.items ?? []
  const totalPages = getTotalPages(response)
  const hasActiveFilters = hasAuditFilters(filters)
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
  const primaryFilters = [
    {
      key: 'userId',
      label: 'Пользователь',
      render: () => (
        <Select
          clearable
          data={userSelectOptions}
          label="Пользователь"
          leftSection={<IconSearch size={16} />}
          onChange={(value) => updateFilters({ userId: value })}
          placeholder="Все пользователи"
          searchable
          value={filters.userId}
        />
      ),
    },
    {
      key: 'actionType',
      label: 'Тип действия',
      render: () => (
        <Select
          clearable
          data={actionTypeOptions}
          label="Тип действия"
          onChange={(value) => updateFilters({ actionType: value })}
          placeholder="Все действия"
          searchable
          value={filters.actionType}
        />
      ),
    },
    {
      key: 'dateFrom',
      label: 'Период с',
      render: () => (
        <TextInput
          label="Период с"
          leftSection={<IconCalendarEvent size={16} />}
          onChange={(event) => updateFilters({ dateFrom: event.currentTarget.value })}
          type="date"
          value={filters.dateFrom}
        />
      ),
    },
    {
      key: 'dateTo',
      label: 'Период по',
      render: () => (
        <TextInput
          label="Период по"
          leftSection={<IconCalendarEvent size={16} />}
          onChange={(event) => updateFilters({ dateTo: event.currentTarget.value })}
          type="date"
          value={filters.dateTo}
        />
      ),
    },
  ] satisfies CompactFilterItem[]
  const secondaryFilters = [
    {
      key: 'source',
      label: 'Источник',
      render: () => (
        <Select
          clearable
          data={sourceOptions}
          label="Источник"
          onChange={(value) => updateFilters({ source: value })}
          placeholder="Все источники"
          searchable
          value={filters.source}
        />
      ),
    },
    {
      key: 'messengerPlatform',
      label: 'Мессенджер',
      render: () => (
        <Select
          clearable
          data={messengerPlatformOptions}
          label="Мессенджер"
          onChange={(value) => updateFilters({ messengerPlatform: value })}
          placeholder="Все мессенджеры"
          searchable
          value={filters.messengerPlatform}
        />
      ),
    },
    {
      key: 'entityType',
      label: 'Тип объекта',
      render: () => (
        <Select
          clearable
          data={entityTypeOptions}
          label="Тип объекта"
          onChange={(value) => updateFilters({ entityType: value })}
          placeholder="Все объекты"
          searchable
          value={filters.entityType}
        />
      ),
    },
  ] satisfies CompactFilterItem[]

  return (
    <PageLayout data-testid="audit-screen" showHeader={false} title="Журнал">
      <CompactFilterPanel
        actions={<TaskToolbarRefreshAction loading={loading} onClick={handleRefresh} />}
        className="audit-filter-toolbar"
        data-testid="audit-filter-panel"
        onReset={handleResetFilters}
        primary={primaryFilters}
        secondary={secondaryFilters}
      />

      <PageSection>
        <Stack gap="lg">
          {loading ? (
            <LoadingState label="Загружаем журнал действий..." />
          ) : null}

          {!loading && error ? (
            <ErrorState
              action={
                <Button onClick={handleRefresh} variant="secondary">
                  Повторить
                </Button>
              }
              message={error}
              title="Журнал не загрузился"
            />
          ) : null}

          {!loading && !error && entries.length === 0 ? (
            <EmptyState
              action={
                hasActiveFilters ? (
                  <Button onClick={handleResetFilters} variant="secondary">
                    Сбросить фильтры
                  </Button>
                ) : null
              }
              description={
                hasActiveFilters
                  ? 'Сбросьте фильтры или обновите журнал после новых действий в системе.'
                  : 'Обновите журнал после новых действий в системе.'
              }
              title={
                hasActiveFilters
                  ? 'Под выбранные фильтры записей нет.'
                  : 'В журнале пока нет записей'
              }
            />
          ) : null}

          {!error && staleError ? (
            <ErrorState
              action={
                <Button onClick={handleRefresh} variant="secondary">
                  Повторить
                </Button>
              }
              message={staleError}
              title="Данные могли устареть"
            />
          ) : null}

          {!error && entries.length > 0 ? (
            <div
              aria-label="Журнал действий"
              className="audit-log-grid audit-log-list"
              data-testid="audit-log-grid"
              role="table"
            >
              <div className="audit-log-header" role="row">
                <div role="columnheader">Дата</div>
                <div role="columnheader">Описание</div>
                <div role="columnheader">Пользователь</div>
                <div role="columnheader">Детали</div>
              </div>
              {entries.map((entry) => (
                <AuditLogGridRow
                  entry={entry}
                  key={entry.id}
                  onOpenDetails={(entry) => {
                    setSelectedEntry(entry)
                  }}
                />
              ))}
            </div>
          ) : null}

          {!loading && !error ? (
            <AppPagination
              className="audit-pagination-shell audit-pagination"
              gap={8}
              label="Страницы журнала действий"
              nextLabel={getAuditPaginationControlLabel('next')}
              onChange={handlePageChange}
              page={page}
              pageLabel={(pageNumber) => `Страница ${pageNumber} журнала`}
              previousLabel={getAuditPaginationControlLabel('previous')}
              summary={formatPaginationSummary(response)}
              total={totalPages}
            />
          ) : null}
        </Stack>
      </PageSection>

      <AuditDetailsModal
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />
    </PageLayout>
  )
}

type AuditLogGridRowProps = {
  entry: AuditLogEntry
  onOpenDetails: (entry: AuditLogEntry) => void
}

function AuditLogGridRow({ entry, onOpenDetails }: AuditLogGridRowProps) {
  const dateTimeParts = formatDateTimeParts(entry.createdAt)
  const presentation = buildAuditEntryPresentation(entry)

  return (
    <div
      className="audit-log-row crm-list-row-surface"
      data-testid="audit-log-row"
      role="row"
    >
      <div className="audit-log-cell audit-log-cell--date" role="cell">
        <Text className="audit-log-time" fw={700} size="sm">
          <span>{dateTimeParts.date}</span>
          {dateTimeParts.time ? <span>{dateTimeParts.time}</span> : null}
        </Text>
      </div>

      <div
        aria-label={presentation.descriptionAccessibleLabel}
        className="audit-log-cell audit-log-cell--description"
        role="cell"
      >
        <Text className="audit-log-description" fw={800}>
          {presentation.description}
        </Text>
      </div>

      <Text aria-hidden="true" className="audit-log-context" size="sm">
        {presentation.contextText}
      </Text>

      <div
        aria-label={`Автор: ${presentation.actorAccessibleLabel}`}
        className="audit-log-cell audit-log-cell--actor"
        data-testid="audit-log-actor-cell"
        role="cell"
      >
        <Text className="audit-log-actor" fw={700} size="sm">
          {presentation.actorText}
        </Text>
      </div>

      <div className="audit-log-cell audit-log-cell--details" role="cell">
        <Button
          aria-haspopup="dialog"
          aria-label={`Показать подробности записи: ${presentation.description}`}
          className="audit-log-details-action"
          data-testid="audit-log-details-action"
          leftSection={<IconEye aria-hidden="true" size={18} />}
          onClick={(event) => {
            event.currentTarget.focus({ preventScroll: true })
            onOpenDetails(entry)
          }}
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
  const description = entry ? getAuditDescription(entry) : ''

  useEffect(() => {
    if (!entry) {
      return
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !event.isComposing) {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)

    return () => document.removeEventListener('keydown', handleEscape)
  }, [entry, onClose])

  return (
    <Modal
      centered
      closeButtonProps={{
        'aria-label': 'Закрыть подробности записи',
        autoFocus: true,
      }}
      closeOnEscape={false}
      onClose={onClose}
      opened={Boolean(entry)}
      returnFocus
      size="xl"
      title="Подробности записи журнала"
    >
      {entry ? (
        <Stack data-testid="audit-log-details-modal" gap="lg">
          <Stack gap="sm">
            <Group gap="xs" wrap="wrap">
              <Badge color="var(--crm-brand-primary-soft)" radius="xl" variant="light">
                {formatActionType(entry.actionType)}
              </Badge>
              <Badge color="var(--crm-brand-secondary)" radius="xl" variant="light">
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

            <Text fw={800}>{description}</Text>

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

function buildAuditRequestKey(params: GetAuditLogParams) {
  return JSON.stringify({
    actionType: params.actionType ?? null,
    dateFrom: params.dateFrom ?? null,
    dateTo: params.dateTo ?? null,
    entityType: params.entityType ?? null,
    messengerPlatform: params.messengerPlatform ?? null,
    page: params.page ?? 1,
    pageSize: params.pageSize ?? AUDIT_PAGE_SIZE,
    source: params.source ?? null,
    userId: params.userId ?? null,
  })
}

function hasAuditFilters(filters: AuditFilterValues) {
  return Boolean(
    filters.userId ||
      filters.source ||
      filters.messengerPlatform ||
      filters.actionType ||
      filters.entityType ||
      filters.dateFrom ||
      filters.dateTo,
  )
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

  if (response.totalCount !== null) {
    return `Страница ${response.page} из ${getTotalPages(response)}`
  }

  return `Страница ${response.page}`
}

function getAuditPaginationControlLabel(
  control: 'first' | 'previous' | 'last' | 'next',
) {
  if (control === 'first') {
    return 'Первая страница журнала'
  }

  if (control === 'previous') {
    return 'Предыдущая страница журнала'
  }

  if (control === 'next') {
    return 'Следующая страница журнала'
  }

  return 'Последняя страница журнала'
}

type AuditTokenPresentation = {
  visible: string
  accessible: string
}

type AuditEntryPresentation = {
  description: string
  descriptionAccessibleLabel: string
  contextText: string
  actorText: string
  actorAccessibleLabel: string
}

function buildAuditEntryPresentation(entry: AuditLogEntry): AuditEntryPresentation {
  const description = getAuditDescription(entry)
  const userLogin = getUserLoginLabel(entry)
  const action = getAuditTokenPresentation({
    dictionary: resources.audit.actionLabels,
    knownPrefix: 'Действие',
    unknownPrefix: 'Тип действия из API',
    value: entry.actionType,
  })
  const entity = getAuditTokenPresentation({
    dictionary: resources.audit.entityLabels,
    knownPrefix: 'Объект',
    unknownPrefix: 'Тип объекта из API',
    value: entry.entityType,
  })
  const contextParts = [action, entity]
  const accessibleParts = [`Описание: ${description}`, action.accessible, entity.accessible]

  if (entry.entityId) {
    contextParts.push({
      visible: entry.entityId,
      accessible: `ID объекта: ${entry.entityId}`,
    })
    accessibleParts.push(`ID объекта: ${entry.entityId}`)
  }

  if (entry.source) {
    const source = getAuditTokenPresentation({
      dictionary: resources.audit.sourceLabels,
      knownPrefix: 'Источник',
      unknownPrefix: 'Источник из API',
      value: entry.source,
    })
    contextParts.push(source)
    accessibleParts.push(source.accessible)
  }

  if (entry.messengerPlatform) {
    const messengerPlatform = getAuditTokenPresentation({
      dictionary: resources.audit.messengerPlatformLabels,
      knownPrefix: 'Мессенджер',
      unknownPrefix: 'Мессенджер из API',
      value: entry.messengerPlatform,
    })
    contextParts.push(messengerPlatform)
    accessibleParts.push(messengerPlatform.accessible)
  }

  return {
    description,
    descriptionAccessibleLabel: accessibleParts.join('. '),
    contextText: contextParts.map((part) => part.visible).join(' · '),
    actorText: userLogin ? `${entry.userName} · ${userLogin}` : entry.userName,
    actorAccessibleLabel: formatUserLabel(entry),
  }
}

function getAuditDescription(entry: AuditLogEntry) {
  const description = entry.description

  return description.trim() ? description : 'Описание не передано'
}

function getAuditTokenPresentation({
  dictionary,
  knownPrefix,
  unknownPrefix,
  value,
}: {
  dictionary: Record<string, string>
  knownPrefix: string
  unknownPrefix: string
  value: string
}): AuditTokenPresentation {
  const label = dictionary[value]

  if (label) {
    return {
      visible: label,
      accessible: `${knownPrefix}: ${label}`,
    }
  }

  return {
    visible: value,
    accessible: `${unknownPrefix}: ${value}`,
  }
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
