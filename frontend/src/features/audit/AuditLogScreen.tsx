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
import { fe16AuditText } from '../../resources/fe-16-audit'


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
            : fe16AuditText.auditLogScreen_string_3c961410
        const currentSnapshot = responseSnapshotRef.current

        if (currentSnapshot?.key === requestKey) {
          setStaleError(fe16AuditText.auditLogScreen_setStaleError_13cc8e2d)
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
      <PageLayout data-testid="audit-screen" showHeader={false} title={fe16AuditText.auditLogScreen_title_97c459a6}>
        <PageSection>
          <ErrorState
            message={fe16AuditText.auditLogScreen_message_9d346056}
            title={fe16AuditText.auditLogScreen_title_509cc0db}
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
    label: fe16AuditText.auditLogScreen_label_0ce02910(auditUser.fullName, auditUser.login),
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
      label: fe16AuditText.auditLogScreen_label_2a5c42af,
      render: () => (
        <Select
          clearable
          data={userSelectOptions}
          label={fe16AuditText.auditLogScreen_label_2a5c42af}
          leftSection={<IconSearch size={16} />}
          onChange={(value) => updateFilters({ userId: value })}
          placeholder={fe16AuditText.auditLogScreen_placeholder_f92b5e39}
          searchable
          value={filters.userId}
        />
      ),
    },
    {
      key: 'actionType',
      label: fe16AuditText.auditLogScreen_label_6fd845da,
      render: () => (
        <Select
          clearable
          data={actionTypeOptions}
          label={fe16AuditText.auditLogScreen_label_6fd845da}
          onChange={(value) => updateFilters({ actionType: value })}
          placeholder={fe16AuditText.auditLogScreen_placeholder_ca80a4db}
          searchable
          value={filters.actionType}
        />
      ),
    },
    {
      key: 'dateFrom',
      label: fe16AuditText.auditLogScreen_label_adf428d2,
      render: () => (
        <TextInput
          label={fe16AuditText.auditLogScreen_label_adf428d2}
          leftSection={<IconCalendarEvent size={16} />}
          onChange={(event) => updateFilters({ dateFrom: event.currentTarget.value })}
          type="date"
          value={filters.dateFrom}
        />
      ),
    },
    {
      key: 'dateTo',
      label: fe16AuditText.auditLogScreen_label_1c084473,
      render: () => (
        <TextInput
          label={fe16AuditText.auditLogScreen_label_1c084473}
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
      label: fe16AuditText.auditLogScreen_label_56e46960,
      render: () => (
        <Select
          clearable
          data={sourceOptions}
          label={fe16AuditText.auditLogScreen_label_56e46960}
          onChange={(value) => updateFilters({ source: value })}
          placeholder={fe16AuditText.auditLogScreen_placeholder_71e214e1}
          searchable
          value={filters.source}
        />
      ),
    },
    {
      key: 'messengerPlatform',
      label: fe16AuditText.auditLogScreen_label_8cfeb847,
      render: () => (
        <Select
          clearable
          data={messengerPlatformOptions}
          label={fe16AuditText.auditLogScreen_label_8cfeb847}
          onChange={(value) => updateFilters({ messengerPlatform: value })}
          placeholder={fe16AuditText.auditLogScreen_placeholder_1627d7ae}
          searchable
          value={filters.messengerPlatform}
        />
      ),
    },
    {
      key: 'entityType',
      label: fe16AuditText.auditLogScreen_label_802e7822,
      render: () => (
        <Select
          clearable
          data={entityTypeOptions}
          label={fe16AuditText.auditLogScreen_label_802e7822}
          onChange={(value) => updateFilters({ entityType: value })}
          placeholder={fe16AuditText.auditLogScreen_placeholder_520f22d9}
          searchable
          value={filters.entityType}
        />
      ),
    },
  ] satisfies CompactFilterItem[]

  return (
    <PageLayout data-testid="audit-screen" showHeader={false} title={fe16AuditText.auditLogScreen_title_97c459a6}>
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
            <LoadingState label={fe16AuditText.auditLogScreen_label_141826fe} />
          ) : null}

          {!loading && error ? (
            <ErrorState
              action={
                <Button onClick={handleRefresh} variant="secondary">
                  {fe16AuditText.auditLogScreen_jsxText_5189135a}</Button>
              }
              message={error}
              title={fe16AuditText.auditLogScreen_title_900936e9}
            />
          ) : null}

          {!loading && !error && entries.length === 0 ? (
            <EmptyState
              action={
                hasActiveFilters ? (
                  <Button onClick={handleResetFilters} variant="secondary">
                    {fe16AuditText.auditLogScreen_jsxText_cd45ec78}</Button>
                ) : null
              }
              description={
                hasActiveFilters
                  ? fe16AuditText.auditLogScreen_string_27e93106
                  : fe16AuditText.auditLogScreen_string_d0563fd0
              }
              title={
                hasActiveFilters
                  ? fe16AuditText.auditLogScreen_string_1ab37d8d
                  : fe16AuditText.auditLogScreen_string_3cedc553
              }
            />
          ) : null}

          {!error && staleError ? (
            <ErrorState
              action={
                <Button onClick={handleRefresh} variant="secondary">
                  {fe16AuditText.auditLogScreen_jsxText_5189135a}</Button>
              }
              message={staleError}
              title={fe16AuditText.auditLogScreen_title_207b3102}
            />
          ) : null}

          {!error && entries.length > 0 ? (
            <div
              aria-label={fe16AuditText.auditLogScreen_ariaLabel_ac5dad76}
              className="audit-log-grid audit-log-list"
              data-testid="audit-log-grid"
              role="table"
            >
              <div className="audit-log-header" role="row">
                <div role="columnheader">{fe16AuditText.auditLogScreen_jsxText_232a0ead}</div>
                <div role="columnheader">{fe16AuditText.auditLogScreen_jsxText_b3680f2c}</div>
                <div role="columnheader">{fe16AuditText.auditLogScreen_label_2a5c42af}</div>
                <div role="columnheader">{fe16AuditText.auditLogScreen_jsxText_773190d8}</div>
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
              label={fe16AuditText.auditLogScreen_label_273ec7a8}
              nextLabel={getAuditPaginationControlLabel('next')}
              onChange={handlePageChange}
              page={page}
              pageLabel={(pageNumber) => fe16AuditText.auditLogScreen_template_4fbaec54(pageNumber)}
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
        aria-label={fe16AuditText.auditLogScreen_template_c1129cd4(presentation.actorAccessibleLabel)}
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
          aria-label={fe16AuditText.auditLogScreen_template_f73af74a(presentation.description)}
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
          {fe16AuditText.auditLogScreen_jsxText_773190d8}</Button>
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
        'aria-label': fe16AuditText.auditLogScreen_ariaLabel_8f65a33f,
        autoFocus: true,
      }}
      closeOnEscape={false}
      onClose={onClose}
      opened={Boolean(entry)}
      returnFocus
      size="xl"
      title={fe16AuditText.auditLogScreen_title_a4383fdb}
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
                  {fe16AuditText.auditLogScreen_jsxText_7a4effe6}{entry.entityId}
                </Text>
              ) : null}
            </Group>
          </Stack>

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <JsonPanel
              emptyLabel={fe16AuditText.auditLogScreen_emptyLabel_7ec59469}
              title={fe16AuditText.auditLogScreen_title_b1ac9321}
              value={entry.oldValueJson}
            />
            <JsonPanel
              emptyLabel={fe16AuditText.auditLogScreen_emptyLabel_745d0810}
              title={fe16AuditText.auditLogScreen_title_e4283670}
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
    return fe16AuditText.auditLogScreen_template_58747b6a(response.page, getTotalPages(response))
  }

  return fe16AuditText.auditLogScreen_template_5456888e(response.page)
}

function getAuditPaginationControlLabel(
  control: 'first' | 'previous' | 'last' | 'next',
) {
  if (control === 'first') {
    return fe16AuditText.auditLogScreen_string_045eef2d
  }

  if (control === 'previous') {
    return fe16AuditText.auditLogScreen_string_f94be165
  }

  if (control === 'next') {
    return fe16AuditText.auditLogScreen_string_d04b363e
  }

  return fe16AuditText.auditLogScreen_string_b2c30064
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
    knownPrefix: fe16AuditText.auditLogScreen_knownPrefix_6b53aafe,
    unknownPrefix: fe16AuditText.auditLogScreen_unknownPrefix_6faaa941,
    value: entry.actionType,
  })
  const entity = getAuditTokenPresentation({
    dictionary: resources.audit.entityLabels,
    knownPrefix: fe16AuditText.auditLogScreen_knownPrefix_cedecb91,
    unknownPrefix: fe16AuditText.auditLogScreen_unknownPrefix_ee943359,
    value: entry.entityType,
  })
  const contextParts = [action, entity]
  const accessibleParts = [fe16AuditText.auditLogScreen_template_41f458cd(description), action.accessible, entity.accessible]

  if (entry.entityId) {
    contextParts.push({
      visible: entry.entityId,
      accessible: fe16AuditText.auditLogScreen_accessible_279b9ae5(entry.entityId),
    })
    accessibleParts.push(fe16AuditText.auditLogScreen_accessible_279b9ae5(entry.entityId))
  }

  if (entry.source) {
    const source = getAuditTokenPresentation({
      dictionary: resources.audit.sourceLabels,
      knownPrefix: fe16AuditText.auditLogScreen_label_56e46960,
      unknownPrefix: fe16AuditText.auditLogScreen_unknownPrefix_6ce2dabd,
      value: entry.source,
    })
    contextParts.push(source)
    accessibleParts.push(source.accessible)
  }

  if (entry.messengerPlatform) {
    const messengerPlatform = getAuditTokenPresentation({
      dictionary: resources.audit.messengerPlatformLabels,
      knownPrefix: fe16AuditText.auditLogScreen_label_8cfeb847,
      unknownPrefix: fe16AuditText.auditLogScreen_unknownPrefix_597bec43,
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

  return description.trim() ? description : fe16AuditText.auditLogScreen_string_65ab7b28
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
      date: fe16AuditText.auditLogScreen_date_732063f1,
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
