import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from 'react'
import {
  Badge,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import {
  IconAdjustmentsHorizontal,
  IconCalendarWeek,
  IconClockHour4,
  IconFilter,
  IconFilterOff,
  IconMapPin,
  IconRefresh,
  IconUsers,
} from '@tabler/icons-react'
import {
  getScheduleGroups,
  type TrainingGroupListItem,
} from '../../lib/api'
import {
  EMPTY_SCHEDULE_FILTERS,
  applyScheduleFilters,
  buildScheduleCalendarWeek,
  buildScheduleDayCounts,
  buildScheduleFilterOptions,
  buildScheduleHourMarks,
  buildScheduleTypeLegend,
  buildScheduleWeekdayLabels,
  formatScheduleEntryTimeRange,
  getCurrentScheduleWeekday,
  getScheduleEntryGridMetrics,
  getScheduleTypeKey,
  getScheduleTypePalette,
  hasActiveScheduleFilters,
  type ScheduleCalendarDay,
  type ScheduleCalendarEntry,
  type ScheduleFilterOptions,
  type ScheduleFilters,
  type ScheduleTypeLegendItem,
  type ScheduleTypePalette,
  type ScheduleVisibleHourRange,
  type ScheduleWeekdayLabel,
  type WeekdayNumber,
} from '../../lib/groupSchedule'
import { Button } from '../shared/Button'
import {
  EmptyState,
  ErrorState,
  FilterToolbar,
  LoadingState,
  IconButton,
  PageSection,
  RefreshButton,
  ResponsiveButtonGroup,
} from '../shared/ux'

const SCHEDULE_GROUPS_PAGE_SIZE = 100
const MOBILE_BREAKPOINT = '(max-width: 47.99em)'
const SCHEDULE_DESKTOP_HOUR_HEIGHT_PX = 76
const SCHEDULE_MOBILE_HOUR_HEIGHT_PX = 96
const SCHEDULE_LANE_GAP_PX = 8
const SCHEDULE_AUTO_REFRESH_MS = 60_000
const WEEKDAY_BY_INDEX = [1, 2, 3, 4, 5, 6, 7] as const satisfies readonly WeekdayNumber[]
const WEEKDAY_INDEX_BY_NUMBER: Record<WeekdayNumber, number> = {
  1: 0,
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
}

type GroupScheduleScreenProps = {
  canManageGroups: boolean
  onEditGroup: (groupId: string) => void
}

export function GroupScheduleScreen(props: GroupScheduleScreenProps) {
  void props

  const [groups, setGroups] = useState<TrainingGroupListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [filters, setFilters] = useState<ScheduleFilters>(EMPTY_SCHEDULE_FILTERS)
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null)
  const [selectedWeekday, setSelectedWeekday] = useState<WeekdayNumber>(() =>
    getCurrentScheduleWeekday(),
  )
  const filterPanelId = useId()
  const firstLoadRef = useRef(true)
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT)

  useEffect(() => {
    const controller = new AbortController()
    const isInitialLoad = firstLoadRef.current

    async function load() {
      if (isInitialLoad) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      setError(null)

      try {
        const response = await getAllScheduleGroups(controller.signal)

        setGroups(response.items)
        setLastLoadedAt(new Date())
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Не удалось загрузить расписание.',
        )
      } finally {
        if (!controller.signal.aborted) {
          firstLoadRef.current = false
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [reloadKey])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date())
      setReloadKey((currentKey) => currentKey + 1)
    }, SCHEDULE_AUTO_REFRESH_MS)

    return () => window.clearInterval(intervalId)
  }, [])

  const filterOptions = useMemo(
    () => buildScheduleFilterOptions(groups, filters),
    [filters, groups],
  )
  const filteredGroups = useMemo(
    () => applyScheduleFilters(groups, filters),
    [filters, groups],
  )
  const calendarWeek = useMemo(
    () => buildScheduleCalendarWeek(filteredGroups),
    [filteredGroups],
  )
  const currentWeekday = useMemo(() => getCurrentScheduleWeekday(now), [now])
  const dayLabels = useMemo(() => buildScheduleWeekdayLabels(now), [now])
  const dayCounts = useMemo(
    () => buildScheduleDayCounts(calendarWeek.days),
    [calendarWeek.days],
  )
  const visibleEntries = useMemo(
    () => calendarWeek.days.flatMap((day) => day.entries),
    [calendarWeek.days],
  )
  const typeLegend = useMemo(
    () => buildScheduleTypeLegend(visibleEntries),
    [visibleEntries],
  )
  useEffect(() => {
    setFilters((currentFilters) => {
      const nextFilters = {
        branchId: retainFilterValue(currentFilters.branchId, filterOptions.branches),
        hallId: retainFilterValue(currentFilters.hallId, filterOptions.halls),
        trainerId: retainFilterValue(currentFilters.trainerId, filterOptions.trainers),
        groupId: retainFilterValue(currentFilters.groupId, filterOptions.groups),
      } satisfies ScheduleFilters

      return areScheduleFiltersEqual(currentFilters, nextFilters)
        ? currentFilters
        : nextFilters
    })
  }, [filterOptions])

  const isInitialLoading = loading && groups.length === 0
  const hasStaleSchedule = groups.length > 0
  const hasActiveFilters = hasActiveScheduleFilters(filters)
  const activeFilterCount = countActiveScheduleFilters(filters)
  const requestReload = () => {
    setNow(new Date())
    setReloadKey((currentKey) => currentKey + 1)
  }

  return (
    <Stack
      className="page-layout schedule-screen"
      data-testid="schedule-screen"
      gap="var(--page-section-gap)"
    >
      <div className="schedule-screen__status-row">
        <ScheduleRefreshPanel
          lastLoadedAt={lastLoadedAt}
          loading={loading || refreshing}
          onRefresh={requestReload}
        />
      </div>

      <div className="schedule-screen__filter-row" data-testid="schedule-filters">
        <h1 className="schedule-screen__title">Расписание</h1>
        <ScheduleFilterActions
          activeFilterCount={activeFilterCount}
          filterPanelId={filterPanelId}
          filtersExpanded={filtersExpanded}
          onToggleFilters={() => setFiltersExpanded((isExpanded) => !isExpanded)}
        />
      </div>

      {filtersExpanded ? (
        <PageSection
          className="schedule-filters-panel"
          data-testid="schedule-filter-panel"
          density="compact"
        >
          <div id={filterPanelId}>
            <ScheduleFiltersToolbar
              filterOptions={filterOptions}
              filters={filters}
              hasActiveFilters={hasActiveFilters}
              setFilters={setFilters}
            />
          </div>
        </PageSection>
      ) : null}

      {isInitialLoading ? (
        <PageSection>
          <LoadingState label="Загружаем расписание..." />
        </PageSection>
      ) : null}

      {!isInitialLoading && error ? (
        <PageSection>
          <ErrorState
            action={(
              <RefreshButton
                label="Повторить"
                loading={refreshing}
                onClick={requestReload}
                variant="secondary"
              />
            )}
            message={error}
            title={
              hasStaleSchedule
                ? 'Не удалось обновить расписание'
                : 'Расписание не загрузилось'
            }
          />
        </PageSection>
      ) : null}

      {!isInitialLoading && (!error || hasStaleSchedule) ? (
        <PageSection
          className="schedule-board"
          data-testid="schedule-board"
          density="compact"
        >
          {groups.length === 0 ? (
            <EmptyState
              description="Группы появятся здесь после создания расписания."
              icon={<IconCalendarWeek size={24} />}
              title="Расписание пока пустое"
            />
          ) : filteredGroups.length === 0 ? (
            <EmptyState
              description="Сбросьте часть фильтров, чтобы снова увидеть занятия в календаре."
              icon={<IconClockHour4 size={24} />}
              title="По выбранным фильтрам занятий нет"
            />
          ) : (
            <Stack gap="md">
              {isMobile ? (
                <ScheduleMobileList
                  currentWeekday={currentWeekday}
                  dayCounts={dayCounts}
                  dayLabels={dayLabels}
                  days={calendarWeek.days}
                  selectedWeekday={selectedWeekday}
                  setSelectedWeekday={setSelectedWeekday}
                  visibleHourRange={calendarWeek.visibleHourRange}
                />
              ) : (
                <div className="schedule-board__viewport">
                  <ScheduleDesktopGrid
                    currentWeekday={currentWeekday}
                    dayCounts={dayCounts}
                    dayLabels={dayLabels}
                    days={calendarWeek.days}
                    visibleHourRange={calendarWeek.visibleHourRange}
                  />
                </div>
              )}

              <ScheduleTypeLegend legend={typeLegend} />
            </Stack>
          )}
        </PageSection>
      ) : null}
    </Stack>
  )
}

type ScheduleRefreshPanelProps = {
  lastLoadedAt: Date | null
  loading: boolean
  onRefresh: () => void
}

function ScheduleRefreshPanel({
  lastLoadedAt,
  loading,
  onRefresh,
}: ScheduleRefreshPanelProps) {
  return (
    <Group
      className="schedule-refresh-panel"
      gap="sm"
      justify="flex-end"
      wrap="wrap"
    >
      <Group
        className="status-pill schedule-refresh-status"
        data-testid="schedule-auto-refresh-status"
        gap={7}
        wrap="nowrap"
      >
        <span aria-hidden="true" className="status-pill__dot" />
        <Text fw={800} size="sm">
          {lastLoadedAt
            ? `Обновлено автоматически ${formatClockTime(lastLoadedAt)}`
            : 'Обновляется автоматически'}
        </Text>
      </Group>

      <IconButton
        icon={<IconRefresh size={18} />}
        label="Обновить"
        disabled={loading}
        onClick={onRefresh}
        size={42}
      />
    </Group>
  )
}

type ScheduleFilterActionsProps = {
  activeFilterCount: number
  filterPanelId: string
  filtersExpanded: boolean
  onToggleFilters: () => void
}

function ScheduleFilterActions({
  activeFilterCount,
  filterPanelId,
  filtersExpanded,
  onToggleFilters,
}: ScheduleFilterActionsProps) {
  return (
    <Group
      className="schedule-header-actions"
      gap="sm"
      justify="flex-end"
      wrap="nowrap"
    >
      <Button
        aria-controls={filterPanelId}
        aria-expanded={filtersExpanded}
        className="schedule-filter-toggle"
        leftSection={<IconFilter size={18} />}
        onClick={onToggleFilters}
        variant={filtersExpanded || activeFilterCount > 0 ? 'primary' : 'secondary'}
      >
        <span>Фильтры</span>
        {activeFilterCount > 0 ? (
          <span aria-hidden="true" className="schedule-filter-toggle__count">
            {activeFilterCount}
          </span>
        ) : null}
      </Button>

      <IconButton
        aria-controls={filterPanelId}
        aria-expanded={filtersExpanded}
        className="schedule-filter-settings-button"
        icon={<IconAdjustmentsHorizontal size={18} />}
        label="Настроить фильтры"
        onClick={onToggleFilters}
        size={42}
      />
    </Group>
  )
}

type ScheduleFiltersToolbarProps = {
  filterOptions: ScheduleFilterOptions
  filters: ScheduleFilters
  hasActiveFilters: boolean
  setFilters: Dispatch<SetStateAction<ScheduleFilters>>
}

function ScheduleFiltersToolbar({
  filterOptions,
  filters,
  hasActiveFilters,
  setFilters,
}: ScheduleFiltersToolbarProps) {
  return (
    <FilterToolbar
      actions={
        <ResponsiveButtonGroup justify="flex-end">
          <Button
            disabled={!hasActiveFilters}
            leftSection={<IconFilterOff size={17} />}
            onClick={() => setFilters(EMPTY_SCHEDULE_FILTERS)}
            variant="secondary"
          >
            Сбросить фильтры
          </Button>
        </ResponsiveButtonGroup>
      }
      className="schedule-filter-toolbar"
    >
      <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
        <Select
          clearable
          data={filterOptions.branches}
          label="Филиал"
          onChange={(value) => updateFilter(setFilters, 'branchId', value)}
          placeholder="Все филиалы"
          searchable
          value={filters.branchId}
        />
        <Select
          clearable
          data={filterOptions.halls}
          label="Зал"
          onChange={(value) => updateFilter(setFilters, 'hallId', value)}
          placeholder="Все залы"
          searchable
          value={filters.hallId}
        />
        <Select
          clearable
          data={filterOptions.trainers}
          label="Тренер"
          onChange={(value) => updateFilter(setFilters, 'trainerId', value)}
          placeholder="Все тренеры"
          searchable
          value={filters.trainerId}
        />
        <Select
          clearable
          data={filterOptions.groups}
          label="Группа"
          onChange={(value) => updateFilter(setFilters, 'groupId', value)}
          placeholder="Все группы"
          searchable
          value={filters.groupId}
        />
      </SimpleGrid>
    </FilterToolbar>
  )
}

function ScheduleTypeLegend({
  legend,
}: {
  legend: ScheduleTypeLegendItem[]
}) {
  if (legend.length === 0) {
    return null
  }

  return (
    <div className="schedule-type-legend" data-testid="schedule-type-legend">
      <Text c="dimmed" fw={800} size="xs">
        Типы занятий
      </Text>
      <ScheduleTypeTokenList items={legend} />
    </div>
  )
}

function ScheduleTypeTokenList({
  emptyLabel,
  items,
}: {
  emptyLabel?: string
  items: ScheduleTypeLegendItem[]
}) {
  if (items.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        {emptyLabel ?? 'Типы не найдены'}
      </Text>
    )
  }

  return (
    <Group className="metadata-chip-list" gap="xs">
      {items.map((item) => (
        <span
          className="metadata-chip schedule-type-token"
          data-testid={`schedule-type-token-${item.key}`}
          key={item.key}
          style={buildScheduleTypeStyle(item.palette)}
        >
          <span aria-hidden="true" className="metadata-chip__dot" />
          <span>{item.label}</span>
          <span className="metadata-chip__count">{item.count}</span>
        </span>
      ))}
    </Group>
  )
}

type ScheduleDesktopGridProps = {
  currentWeekday: WeekdayNumber
  dayCounts: Record<WeekdayNumber, number>
  dayLabels: ScheduleWeekdayLabel[]
  days: ScheduleCalendarDay<TrainingGroupListItem>[]
  visibleHourRange: ScheduleVisibleHourRange
}

function ScheduleDesktopGrid({
  currentWeekday,
  dayCounts,
  dayLabels,
  days,
  visibleHourRange,
}: ScheduleDesktopGridProps) {
  const hourMarks = buildScheduleHourMarks(visibleHourRange)
  const gridHeight = (visibleHourRange.endHour - visibleHourRange.startHour) *
    SCHEDULE_DESKTOP_HOUR_HEIGHT_PX
  const labelByWeekday = buildDayLabelMap(dayLabels)

  return (
    <div className="schedule-weekly-grid" data-testid="schedule-calendar-grid">
      <div className="schedule-weekly-grid__header">
        <div className="schedule-weekly-grid__time-spacer" />
        {days.map((day) => (
          <ScheduleDayHeader
            className="schedule-weekly-grid__day-header"
            count={dayCounts[day.weekday]}
            dateLabel={labelByWeekday.get(day.weekday)?.dateLabel ?? ''}
            isCurrent={day.weekday === currentWeekday}
            key={day.weekday}
            label={labelByWeekday.get(day.weekday)?.label ?? day.label}
            testId={`schedule-day-header-${day.weekday}`}
            weekday={day.weekday}
          />
        ))}
      </div>

      <div className="schedule-weekly-grid__body">
        <div
          className="schedule-weekly-grid__time-axis"
          style={{ height: `${gridHeight}px` }}
        >
          {hourMarks.map((hour, index) => (
            <div
              className="schedule-weekly-grid__time-slot"
              key={hour}
              style={{ top: `${index * SCHEDULE_DESKTOP_HOUR_HEIGHT_PX}px` }}
            >
              {formatHourMark(hour)}
            </div>
          ))}
        </div>

        {days.map((day) => (
          <div
            className="schedule-weekly-grid__day-column"
            data-current={day.weekday === currentWeekday ? 'true' : undefined}
            data-testid={`schedule-day-${day.weekday}`}
            key={day.weekday}
            style={{ height: `${gridHeight}px` }}
          >
            {hourMarks.slice(0, -1).map((hour, index) => (
              <div
                className="schedule-weekly-grid__hour-line"
                key={`${day.weekday}-${hour}`}
                style={{ top: `${index * SCHEDULE_DESKTOP_HOUR_HEIGHT_PX}px` }}
              />
            ))}

            {day.entries.length === 0 ? (
              <Text c="dimmed" className="schedule-weekly-grid__empty-day" size="sm">
                Занятий нет
              </Text>
            ) : null}

            {day.entries.map((entry) => (
              <ScheduleCalendarCard
                entry={entry}
                hourHeight={SCHEDULE_DESKTOP_HOUR_HEIGHT_PX}
                key={entry.key}
                mode="calendar"
                visibleHourRange={visibleHourRange}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

type ScheduleMobileListProps = {
  currentWeekday: WeekdayNumber
  dayCounts: Record<WeekdayNumber, number>
  dayLabels: ScheduleWeekdayLabel[]
  days: ScheduleCalendarDay<TrainingGroupListItem>[]
  selectedWeekday: WeekdayNumber
  setSelectedWeekday: (weekday: WeekdayNumber) => void
  visibleHourRange: ScheduleVisibleHourRange
}

function ScheduleMobileList({
  currentWeekday,
  dayCounts,
  dayLabels,
  days,
  selectedWeekday,
  setSelectedWeekday,
  visibleHourRange,
}: ScheduleMobileListProps) {
  const selectedDay = days.find((day) => day.weekday === selectedWeekday) ?? days[0]
  const hourMarks = buildScheduleHourMarks(visibleHourRange)
  const gridHeight = (visibleHourRange.endHour - visibleHourRange.startHour) *
    SCHEDULE_MOBILE_HOUR_HEIGHT_PX
  const selectWeekday = (weekday: WeekdayNumber) => setSelectedWeekday(weekday)

  return (
    <Stack className="schedule-mobile-list" data-testid="schedule-mobile-day-list" gap="md">
      <div
        aria-label="День недели"
        className="schedule-mobile-day-strip"
        data-testid="schedule-mobile-day-strip"
        role="tablist"
      >
        {dayLabels.map((day) => (
          <button
            aria-selected={day.weekday === selectedDay.weekday}
            className="schedule-mobile-day-strip__button"
            data-current={day.weekday === currentWeekday ? 'true' : undefined}
            data-testid={`schedule-mobile-day-tab-${day.weekday}`}
            key={day.weekday}
            onClick={() => selectWeekday(day.weekday)}
            onKeyDown={(event) => handleScheduleDayStripKeyDown(
              event,
              day.weekday,
              selectWeekday,
            )}
            role="tab"
            type="button"
          >
            <span className="schedule-mobile-day-strip__weekday">{day.label}</span>
            <span className="schedule-mobile-day-strip__date">{day.dateLabel}</span>
            <span
              className="schedule-day-header__count"
              data-testid={`schedule-day-count-${day.weekday}`}
            >
              {formatEntryCount(dayCounts[day.weekday])}
            </span>
          </button>
        ))}
      </div>

      <div
        className="schedule-mobile-time-grid"
        data-testid={`schedule-mobile-day-${selectedDay.weekday}`}
        style={{ '--schedule-grid-height': `${gridHeight}px` } as CSSProperties}
      >
        <div className="schedule-mobile-time-grid__body">
          <div className="schedule-mobile-time-grid__time-axis">
            {hourMarks.map((hour, index) => (
              <div
                className="schedule-mobile-time-grid__time-slot"
                key={hour}
                style={{ top: `${index * SCHEDULE_MOBILE_HOUR_HEIGHT_PX}px` }}
              >
                {formatHourMark(hour)}
              </div>
            ))}
          </div>

          <div className="schedule-mobile-time-grid__events">
            {hourMarks.slice(0, -1).map((hour, index) => (
              <div
                className="schedule-mobile-time-grid__hour-line"
                key={`${selectedDay.weekday}-${hour}`}
                style={{ top: `${index * SCHEDULE_MOBILE_HOUR_HEIGHT_PX}px` }}
              />
            ))}

            {selectedDay.entries.length === 0 ? (
              <ScheduleDayEmpty />
            ) : null}

            {selectedDay.entries.map((entry) => (
              <ScheduleCalendarCard
                entry={entry}
                hourHeight={SCHEDULE_MOBILE_HOUR_HEIGHT_PX}
                key={entry.key}
                mode="mobile-grid"
                visibleHourRange={visibleHourRange}
              />
            ))}
          </div>
        </div>
      </div>
    </Stack>
  )
}

type ScheduleDayHeaderProps = {
  className?: string
  count: number
  dateLabel: string
  isCurrent: boolean
  label: string
  testId: string
  weekday: WeekdayNumber
}

function ScheduleDayHeader({
  className,
  count,
  dateLabel,
  isCurrent,
  label,
  testId,
  weekday,
}: ScheduleDayHeaderProps) {
  return (
    <div
      aria-label={`${label} ${dateLabel}: ${formatEntryCount(count)}${isCurrent ? ', текущий день недели' : ''}`}
      className={['schedule-day-header', className].filter(Boolean).join(' ')}
      data-current={isCurrent ? 'true' : undefined}
      data-testid={testId}
    >
      <Text className="schedule-day-header__weekday" fw={900}>
        {label}
      </Text>
      <Text className="schedule-day-header__date" fw={800}>
        {dateLabel}
      </Text>
      <span
        className="schedule-day-header__count"
        data-testid={`schedule-day-count-${weekday}`}
      >
        {formatEntryCount(count)}
      </span>
    </div>
  )
}

type ScheduleCalendarCardProps = {
  entry: ScheduleCalendarEntry<TrainingGroupListItem>
  hourHeight: number
  mode: 'calendar' | 'mobile-grid'
  visibleHourRange?: ScheduleVisibleHourRange
}

function ScheduleCalendarCard({
  entry,
  hourHeight,
  mode,
  visibleHourRange,
}: ScheduleCalendarCardProps) {
  const group = entry.group
  const typePalette = getScheduleTypePalette(group)
  const timeRange = formatScheduleEntryTimeRange(entry)
  const timeLabel = mode === 'calendar' && entry.laneCount > 1
    ? timeRange.split(' - ')[0]
    : timeRange
  const style = {
    ...(visibleHourRange
      ? buildCalendarEntryStyle(entry, visibleHourRange, hourHeight)
      : {}),
    ...buildScheduleTypeStyle(typePalette),
  } satisfies ScheduleEventCardStyle

  return (
    <article
      className={[
        'schedule-event-card',
        mode === 'calendar'
          ? 'schedule-event-card--calendar'
          : 'schedule-event-card--mobile-grid',
      ].join(' ')}
      data-compact={mode === 'calendar' && entry.laneCount > 1 ? 'true' : undefined}
      data-schedule-type={getScheduleTypeKey(group)}
      data-testid={`schedule-card-${entry.weekday}-${group.id}`}
      style={style}
    >
      <Stack gap={mode === 'mobile-grid' ? 'xs' : 4}>
        <Group align="flex-start" justify="space-between" wrap="nowrap">
          <Stack className="schedule-event-card__copy" gap={3}>
            <Text className="schedule-event-card__time" fw={800}>
              {timeLabel}
            </Text>
            <Text className="schedule-event-card__title" fw={800}>
              {group.name}
            </Text>
          </Stack>
          {!group.isActive ? (
            <Badge color="gray" radius="xl" size="xs" variant="light">
              Неактивна
            </Badge>
          ) : null}
        </Group>

        <Group className="schedule-event-card__meta schedule-event-card__meta--primary" gap={6}>
          <span className="schedule-event-card__type-chip">
            {group.groupTypeName}
          </span>
        </Group>

        <Group className="schedule-event-card__meta" gap="xs" wrap="nowrap">
          <IconMapPin size={14} />
          <Text size="xs">
            {group.hallName} · {formatTrainerNamesInline(group)}
          </Text>
        </Group>

        <Group className="schedule-event-card__meta schedule-event-card__participants" gap="xs" wrap="nowrap">
          <IconUsers size={14} />
          <Text className="schedule-event-card__trainers" size="xs" title={formatTrainerNames(group)}>
            {formatScheduleClientCount(group.clientCount)}
          </Text>
        </Group>
      </Stack>
    </article>
  )
}

function ScheduleDayEmpty() {
  return (
    <div className="schedule-day-empty">
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon color="gray" radius="xl" size={34} variant="light">
          <IconClockHour4 size={18} />
        </ThemeIcon>
        <Stack gap={2}>
          <Text fw={700} size="sm">
            Занятий нет
          </Text>
          <Text c="dimmed" size="xs">
            День свободен для выбранных фильтров.
          </Text>
        </Stack>
      </Group>
    </div>
  )
}

async function getAllScheduleGroups(signal: AbortSignal) {
  const firstPage = await getScheduleGroups(
    { skip: 0, take: SCHEDULE_GROUPS_PAGE_SIZE },
    signal,
  )
  const items = [...firstPage.items]
  let totalCount = firstPage.totalCount

  while (items.length < totalCount) {
    const nextPage = await getScheduleGroups(
      { skip: items.length, take: SCHEDULE_GROUPS_PAGE_SIZE },
      signal,
    )

    if (nextPage.items.length === 0) {
      break
    }

    items.push(...nextPage.items)
    totalCount = Math.max(totalCount, nextPage.totalCount)
  }

  return {
    items,
    totalCount,
  }
}

function updateFilter(
  setFilters: Dispatch<SetStateAction<ScheduleFilters>>,
  key: keyof ScheduleFilters,
  value: string | null,
) {
  setFilters((currentFilters) => ({
    ...currentFilters,
    [key]: value,
  }))
}

function retainFilterValue(
  value: string | null,
  options: ReadonlyArray<{ value: string }>,
) {
  if (!value) {
    return null
  }

  return options.some((option) => option.value === value) ? value : null
}

function areScheduleFiltersEqual(
  first: ScheduleFilters,
  second: ScheduleFilters,
) {
  return (
    first.branchId === second.branchId &&
    first.hallId === second.hallId &&
    first.trainerId === second.trainerId &&
    first.groupId === second.groupId
  )
}

function formatHourMark(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`
}

type ScheduleEventCardStyle = CSSProperties & {
  '--metadata-chip-bg'?: string
  '--metadata-chip-border'?: string
  '--metadata-chip-color'?: string
  '--schedule-type-bg'?: string
  '--schedule-type-border'?: string
  '--schedule-type-color'?: string
}

function buildScheduleTypeStyle(palette: ScheduleTypePalette): ScheduleEventCardStyle {
  return {
    '--metadata-chip-bg': palette.background,
    '--metadata-chip-border': palette.border,
    '--metadata-chip-color': palette.color,
    '--schedule-type-bg': palette.background,
    '--schedule-type-border': palette.border,
    '--schedule-type-color': palette.color,
  }
}

function buildCalendarEntryStyle(
  entry: ScheduleCalendarEntry<TrainingGroupListItem>,
  visibleHourRange: ScheduleVisibleHourRange,
  hourHeight: number,
) {
  const metrics = getScheduleEntryGridMetrics(entry, visibleHourRange)
  const totalGridHeight = (visibleHourRange.endHour - visibleHourRange.startHour) *
    hourHeight
  const top = (metrics.topPercent / 100) * totalGridHeight
  const height = (metrics.heightPercent / 100) * totalGridHeight
  const laneCount = Math.max(1, entry.laneCount)
  const widthGapOffset = ((laneCount - 1) * SCHEDULE_LANE_GAP_PX) / laneCount
  const leftGapOffset = (entry.lane * SCHEDULE_LANE_GAP_PX) / laneCount

  return {
    top: `${top}px`,
    height: `${Math.max(54, height)}px`,
    left: `calc(${metrics.laneLeftPercent}% + ${leftGapOffset}px)`,
    width: `calc(${metrics.laneWidthPercent}% - ${widthGapOffset}px)`,
    zIndex: entry.lane + 1,
  } satisfies CSSProperties
}

function buildDayLabelMap(dayLabels: ScheduleWeekdayLabel[]) {
  return new Map(dayLabels.map((day) => [day.weekday, day]))
}

function handleScheduleDayStripKeyDown(
  event: KeyboardEvent<HTMLButtonElement>,
  weekday: WeekdayNumber,
  selectWeekday: (weekday: WeekdayNumber) => void,
) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
    return
  }

  event.preventDefault()

  const direction = event.key === 'ArrowRight' ? 1 : -1
  const nextIndex = (WEEKDAY_INDEX_BY_NUMBER[weekday] + direction + 7) % 7
  const nextWeekday = WEEKDAY_BY_INDEX[nextIndex] ?? weekday

  selectWeekday(nextWeekday)
}

function countActiveScheduleFilters(filters: ScheduleFilters) {
  return Object.values(filters).filter(Boolean).length
}

function formatClockTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatEntryCount(count: number) {
  return `${count} ${formatLessonWord(count)}`
}

function formatLessonWord(count: number) {
  const absCount = Math.abs(count)
  const lastDigit = absCount % 10
  const lastTwoDigits = absCount % 100

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'занятий'
  }

  if (lastDigit === 1) {
    return 'занятие'
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'занятия'
  }

  return 'занятий'
}

function formatScheduleClientCount(clientCount: number) {
  const absCount = Math.abs(clientCount)
  const lastDigit = absCount % 10
  const lastTwoDigits = absCount % 100
  let word = 'участников'

  if (lastTwoDigits < 11 || lastTwoDigits > 14) {
    if (lastDigit === 1) {
      word = 'участник'
    } else if (lastDigit >= 2 && lastDigit <= 4) {
      word = 'участника'
    }
  }

  return `${clientCount} ${word}`
}

function formatTrainerNames(group: TrainingGroupListItem) {
  if (group.trainerNames.length > 0) {
    return `Тренеры: ${group.trainerNames.join(', ')}`
  }

  if (group.trainers.length > 0) {
    return `Тренеры: ${group.trainers.map((trainer) => trainer.fullName).join(', ')}`
  }

  return 'Тренеры пока не назначены'
}

function formatTrainerNamesInline(group: TrainingGroupListItem) {
  if (group.trainerNames.length > 0) {
    return group.trainerNames.join(', ')
  }

  if (group.trainers.length > 0) {
    return group.trainers.map((trainer) => trainer.fullName).join(', ')
  }

  return 'тренер не назначен'
}
