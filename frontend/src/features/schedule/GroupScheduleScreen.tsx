import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from 'react'
import {
  Badge,
  Group,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import {
  IconCalendarWeek,
  IconClockHour4,
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
  WEEKDAY_OPTIONS,
  applyScheduleFilters,
  buildScheduleCalendarWeek,
  buildScheduleDayCounts,
  buildScheduleFilterOptions,
  buildScheduleTodaySummary,
  buildScheduleTypeLegend,
  formatScheduleEntryTimeRange,
  getCurrentScheduleWeekday,
  getScheduleTypeKey,
  getScheduleTypePalette,
  hasActiveScheduleFilters,
  type ScheduleCalendarDay,
  type ScheduleCalendarEntry,
  type ScheduleFilters,
  type ScheduleHallLoadItem,
  type ScheduleTodaySummary,
  type ScheduleTypeLegendItem,
  type ScheduleTypePalette,
  type ScheduleVisibleHourRange,
  type WeekdayNumber,
} from '../../lib/groupSchedule'
import { Button } from '../shared/Button'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageCard,
  PageHeader,
  IconButton,
  RefreshButton,
  ResponsiveButtonGroup,
} from '../shared/ux'

const SCHEDULE_GROUPS_PAGE_SIZE = 100
const MOBILE_BREAKPOINT = '(max-width: 47.99em)'
const SCHEDULE_HOUR_HEIGHT_PX = 80
const SCHEDULE_LANE_GAP_PX = 8
const SCHEDULE_AUTO_REFRESH_MS = 60_000

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
  const [now, setNow] = useState(() => new Date())
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null)
  const [selectedWeekday, setSelectedWeekday] = useState<WeekdayNumber>(() =>
    getCurrentScheduleWeekday(),
  )
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
  const todaySummary = useMemo(
    () => buildScheduleTodaySummary(calendarWeek.days, currentWeekday),
    [calendarWeek.days, currentWeekday],
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
  const requestReload = () => {
    setNow(new Date())
    setReloadKey((currentKey) => currentKey + 1)
  }

  return (
    <Stack className="dashboard-stack schedule-screen" data-testid="schedule-screen" gap="xl">
      <PageCard className="schedule-filters-card" data-testid="schedule-filters">
        <Stack gap="lg">
          <PageHeader
            description="Недельный шаблон занятий по филиалам, залам, тренерам и группам."
            actions={(
              <ScheduleRefreshPanel
                lastLoadedAt={lastLoadedAt}
                loading={loading || refreshing}
                onRefresh={requestReload}
              />
            )}
            title="Расписание"
          />

          <div className="filter-toolbar schedule-filter-toolbar">
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
          </div>
        </Stack>
      </PageCard>

      {isInitialLoading ? (
        <PageCard>
          <LoadingState label="Загружаем расписание..." />
        </PageCard>
      ) : null}

      {!isInitialLoading && error ? (
        <PageCard>
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
        </PageCard>
      ) : null}

      {!isInitialLoading && (!error || hasStaleSchedule) ? (
        <Paper
          className="surface-card surface-card--wide schedule-board"
          data-testid="schedule-board"
          radius="var(--radius-card)"
          withBorder
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
              <ScheduleOverviewStrip
                summary={todaySummary}
                totalVisibleEntries={visibleEntries.length}
              />

              {isMobile ? (
                <ScheduleMobileList
                  currentWeekday={currentWeekday}
                  dayCounts={dayCounts}
                  days={calendarWeek.days}
                  selectedWeekday={selectedWeekday}
                  setSelectedWeekday={setSelectedWeekday}
                />
              ) : (
                <ScheduleDesktopGrid
                  currentWeekday={currentWeekday}
                  dayCounts={dayCounts}
                  days={calendarWeek.days}
                  visibleHourRange={calendarWeek.visibleHourRange}
                />
              )}

              <ScheduleTypeLegend legend={typeLegend} />
            </Stack>
          )}
        </Paper>
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
    <Group className="schedule-refresh-panel" gap="sm" justify="flex-end" wrap="wrap">
      <Group
        className="status-pill schedule-refresh-status"
        data-testid="schedule-auto-refresh-status"
        gap={7}
        wrap="nowrap"
      >
        <span aria-hidden="true" className="status-pill__dot" />
        <Stack gap={0}>
          <Text fw={800} size="sm">
            Обновляется автоматически
          </Text>
          <Text c="dimmed" size="xs">
            {lastLoadedAt
              ? `последнее обновление ${formatClockTime(lastLoadedAt)}`
              : 'каждую минуту'}
          </Text>
        </Stack>
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

type ScheduleOverviewStripProps = {
  summary: ScheduleTodaySummary
  totalVisibleEntries: number
}

function ScheduleOverviewStrip({
  summary,
  totalVisibleEntries,
}: ScheduleOverviewStripProps) {
  return (
    <div className="compact-summary-strip schedule-overview" data-testid="schedule-overview">
      <section className="compact-summary-card" data-testid="schedule-today-summary">
        <Text c="dimmed" fw={700} size="xs">
          Сегодня
        </Text>
        <Group align="baseline" gap={6} wrap="nowrap">
          <Text className="compact-summary-card__value" fw={900}>
            {summary.totalEntries}
          </Text>
          <Text c="dimmed" fw={700} size="sm">
            {formatLessonWord(summary.totalEntries)}
          </Text>
        </Group>
        <Text c="dimmed" size="xs">
          из {formatEntryCount(totalVisibleEntries)} в видимой неделе
        </Text>
      </section>

      <section className="compact-summary-card" data-testid="schedule-today-type-summary">
        <Text c="dimmed" fw={700} size="xs">
          Типы сегодня
        </Text>
        <ScheduleTypeTokenList emptyLabel="Нет занятий" items={summary.typeItems} />
      </section>

      <section className="compact-summary-card" data-testid="schedule-hall-load">
        <Text c="dimmed" fw={700} size="xs">
          Залы сегодня
        </Text>
        <ScheduleHallLoadList items={summary.hallItems} />
      </section>
    </div>
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

function ScheduleHallLoadList({
  items,
}: {
  items: ScheduleHallLoadItem[]
}) {
  if (items.length === 0) {
    return (
      <Text c="dimmed" size="sm">
        Нет занятий
      </Text>
    )
  }

  return (
    <Stack gap={5}>
      {items.map((item) => (
        <Group className="schedule-hall-load-item" gap="xs" key={item.key} wrap="nowrap">
          <Text className="schedule-hall-load-item__label" fw={800} size="sm">
            {item.label}
          </Text>
          <Text c="dimmed" size="sm">
            {formatEntryCount(item.count)}
          </Text>
        </Group>
      ))}
    </Stack>
  )
}

type ScheduleDesktopGridProps = {
  currentWeekday: WeekdayNumber
  dayCounts: Record<WeekdayNumber, number>
  days: ScheduleCalendarDay<TrainingGroupListItem>[]
  visibleHourRange: ScheduleVisibleHourRange
}

function ScheduleDesktopGrid({
  currentWeekday,
  dayCounts,
  days,
  visibleHourRange,
}: ScheduleDesktopGridProps) {
  const hourMarks = buildHourMarks(visibleHourRange)
  const gridHeight = (visibleHourRange.endHour - visibleHourRange.startHour) *
    SCHEDULE_HOUR_HEIGHT_PX

  return (
    <div className="schedule-weekly-grid" data-testid="schedule-calendar-grid">
      <div className="schedule-weekly-grid__header">
        <div className="schedule-weekly-grid__time-spacer" />
        {days.map((day) => (
          <ScheduleDayHeader
            className="schedule-weekly-grid__day-header"
            count={dayCounts[day.weekday]}
            isCurrent={day.weekday === currentWeekday}
            key={day.weekday}
            label={day.label}
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
              style={{ top: `${index * SCHEDULE_HOUR_HEIGHT_PX}px` }}
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
                style={{ top: `${index * SCHEDULE_HOUR_HEIGHT_PX}px` }}
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
  days: ScheduleCalendarDay<TrainingGroupListItem>[]
  selectedWeekday: WeekdayNumber
  setSelectedWeekday: (weekday: WeekdayNumber) => void
}

function ScheduleMobileList({
  currentWeekday,
  dayCounts,
  days,
  selectedWeekday,
  setSelectedWeekday,
}: ScheduleMobileListProps) {
  const selectedDay = days.find((day) => day.weekday === selectedWeekday) ?? days[0]

  return (
    <Stack className="schedule-mobile-list" data-testid="schedule-mobile-day-list" gap="lg">
      <SegmentedControl
        aria-label="День недели"
        className="schedule-mobile-list__switcher"
        data={WEEKDAY_OPTIONS}
        fullWidth
        onChange={(value) => setSelectedWeekday(Number(value) as WeekdayNumber)}
        value={String(selectedDay.weekday)}
      />

      <ScheduleDayHeader
        className="schedule-mobile-list__day-header"
        count={dayCounts[selectedDay.weekday]}
        isCurrent={selectedDay.weekday === currentWeekday}
        label={selectedDay.label}
        testId={`schedule-mobile-day-header-${selectedDay.weekday}`}
        weekday={selectedDay.weekday}
      />

      <div data-testid={`schedule-mobile-day-${selectedDay.weekday}`}>
        {selectedDay.entries.length === 0 ? (
          <ScheduleDayEmpty />
        ) : (
          <Stack gap="sm">
            {selectedDay.entries.map((entry) => (
              <ScheduleCalendarCard entry={entry} key={entry.key} mode="list" />
            ))}
          </Stack>
        )}
      </div>
    </Stack>
  )
}

type ScheduleDayHeaderProps = {
  className?: string
  count: number
  isCurrent: boolean
  label: string
  testId: string
  weekday: WeekdayNumber
}

function ScheduleDayHeader({
  className,
  count,
  isCurrent,
  label,
  testId,
  weekday,
}: ScheduleDayHeaderProps) {
  return (
    <div
      aria-label={`${label}: ${formatEntryCount(count)}${isCurrent ? ', текущий день недели' : ''}`}
      className={['schedule-day-header', className].filter(Boolean).join(' ')}
      data-current={isCurrent ? 'true' : undefined}
      data-testid={testId}
    >
      <Group gap="xs" justify="space-between" wrap="nowrap">
        <Group gap={7} wrap="nowrap">
          {isCurrent ? <span aria-hidden="true" className="schedule-day-header__dot" /> : null}
          <Text fw={800} size="sm">
            {label}
          </Text>
        </Group>
        <Badge
          data-testid={`schedule-day-count-${weekday}`}
          radius="xl"
          size="sm"
          variant="light"
        >
          {formatEntryCount(count)}
        </Badge>
      </Group>
    </div>
  )
}

type ScheduleCalendarCardProps = {
  entry: ScheduleCalendarEntry<TrainingGroupListItem>
  mode: 'calendar' | 'list'
  visibleHourRange?: ScheduleVisibleHourRange
}

function ScheduleCalendarCard({
  entry,
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
    ...(mode === 'calendar' && visibleHourRange
      ? buildCalendarEntryStyle(entry, visibleHourRange)
      : {}),
    ...buildScheduleTypeStyle(typePalette),
  } satisfies ScheduleEventCardStyle

  return (
    <article
      className={[
        'schedule-event-card',
        mode === 'calendar'
          ? 'schedule-event-card--calendar'
          : 'schedule-event-card--list',
      ].join(' ')}
      data-compact={mode === 'calendar' && entry.laneCount > 1 ? 'true' : undefined}
      data-schedule-type={getScheduleTypeKey(group)}
      data-testid={`schedule-card-${entry.weekday}-${group.id}`}
      style={style}
    >
      <Stack gap="xs">
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
            {group.hallName}
          </Text>
        </Group>

        <Group className="schedule-event-card__meta" gap="xs" wrap="nowrap">
          <IconUsers size={14} />
          <Text className="schedule-event-card__trainers" size="xs" title={formatTrainerNames(group)}>
            {formatScheduleClientCount(group.clientCount)}
            {mode === 'list' ? ` · ${formatTrainerNames(group)}` : ''}
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

function buildHourMarks(visibleHourRange: ScheduleVisibleHourRange) {
  const totalHours = visibleHourRange.endHour - visibleHourRange.startHour

  return Array.from(
    { length: totalHours + 1 },
    (_, index) => visibleHourRange.startHour + index,
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
) {
  const top = ((entry.startMinutes - (visibleHourRange.startHour * 60)) / 60) *
    SCHEDULE_HOUR_HEIGHT_PX
  const height = ((entry.endMinutes - entry.startMinutes) / 60) * SCHEDULE_HOUR_HEIGHT_PX

  if (entry.laneCount > 1) {
    const leftOffset = entry.lane * SCHEDULE_LANE_GAP_PX
    const topOffset = entry.lane * 52

    return {
      top: `${top + topOffset}px`,
      height: `${Math.max(48, Math.min(height, 52))}px`,
      left: `${leftOffset}px`,
      width: `calc(100% - ${leftOffset}px)`,
      zIndex: entry.lane + 1,
    } satisfies CSSProperties
  }

  const widthPercent = 100 / entry.laneCount
  const widthGapOffset = ((entry.laneCount - 1) * SCHEDULE_LANE_GAP_PX) / entry.laneCount
  const leftGapOffset = (entry.lane * SCHEDULE_LANE_GAP_PX) / entry.laneCount

  return {
    top: `${top}px`,
    height: `${height}px`,
    left: `calc(${entry.lane * widthPercent}% + ${leftGapOffset}px)`,
    width: `calc(${widthPercent}% - ${widthGapOffset}px)`,
  } satisfies CSSProperties
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
