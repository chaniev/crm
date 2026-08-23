import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent,
  type MutableRefObject,
  type SetStateAction,
} from 'react'
import {
  Badge,
  Group,
  Select,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import {
  IconBuilding,
  IconCalendarWeek,
  IconClockHour4,
  IconDoor,
  IconMapPin,
  IconUser,
  IconUsers,
} from '@tabler/icons-react'
import {
  getScheduleGroups,
  type TrainingGroupListItem,
  type UserRole,
} from '../../lib/api'
import {
  EMPTY_SCHEDULE_FILTERS,
  applyScheduleFilters,
  buildScheduleCalendarWeek,
  buildScheduleDayCounts,
  buildScheduleFilterOptions,
  buildScheduleHourMarks,
  buildScheduleTypeLegend,
  buildScheduleVisualDisclosureGroups,
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
  type ScheduleVisualDisclosureGroup,
  type ScheduleVisibleHourRange,
  type ScheduleWeekdayLabel,
  type WeekdayNumber,
} from '../../lib/groupSchedule'
import {
  CompactFilterPanel,
  EmptyState,
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
  RefreshButton,
  TaskToolbarRefreshAction,
  type CompactFilterItem,
} from '../shared/ux'
import {
  ScheduleEventsDisclosure,
} from './ScheduleEventsDisclosure'
import {
  formatScheduleClientCount,
  formatScheduleEntryCount,
} from './schedulePresentation'

const SCHEDULE_GROUPS_PAGE_SIZE = 100
const MOBILE_BREAKPOINT = '(max-width: 47.99em), (max-height: 30rem) and (pointer: coarse)'
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
  viewerRole: UserRole
}

export function GroupScheduleScreen(props: GroupScheduleScreenProps) {
  const [groups, setGroups] = useState<TrainingGroupListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [filters, setFilters] = useState<ScheduleFilters>(EMPTY_SCHEDULE_FILTERS)
  const [now, setNow] = useState(() => new Date())
  const [selectedWeekday, setSelectedWeekday] = useState<WeekdayNumber>(() =>
    getCurrentScheduleWeekday(),
  )
  const firstLoadRef = useRef(true)

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
  const hasActiveFilters = hasActiveScheduleFilters(filters)
  const isCoachViewer = props.viewerRole === 'Coach'
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
  const isCoachZeroScopeEmpty =
    isCoachViewer && !isInitialLoading && !error && groups.length === 0
  const requestReload = () => {
    setNow(new Date())
    setReloadKey((currentKey) => currentKey + 1)
  }

  return (
    <PageLayout
      showHeader={false}
      title="Расписание"
      className="schedule-screen"
      data-testid="schedule-screen"
    >
      {isCoachZeroScopeEmpty ? (
        <ScheduleRefreshToolbar
          onRefresh={requestReload}
          refreshDisabled={loading || refreshing}
        />
      ) : (
        <ScheduleFiltersToolbar
          filterOptions={filterOptions}
          filters={filters}
          onRefresh={requestReload}
          refreshDisabled={loading || refreshing}
          setFilters={setFilters}
        />
      )}

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
          aria-label="Доска расписания"
          className="schedule-board"
          data-testid="schedule-board"
          density="compact"
          {...({ tabIndex: -1 } as { tabIndex: number })}
        >
          {groups.length === 0 ? (
            isCoachViewer ? (
              <EmptyState
                description="Когда вас назначат на группу или временную замену, занятия появятся здесь."
                icon={<IconCalendarWeek size={24} />}
                title="Для вас занятий в расписании нет"
              />
            ) : (
              <EmptyState
                description="Группы появятся здесь после создания расписания."
                icon={<IconCalendarWeek size={24} />}
                title="Расписание пока пустое"
              />
            )
          ) : filteredGroups.length === 0 ? (
            <EmptyState
              description="Сбросьте часть фильтров, чтобы снова увидеть занятия в календаре."
              icon={<IconClockHour4 size={24} />}
              title="По выбранным фильтрам занятий нет"
            />
          ) : (
            <Stack gap="md">
              <ResponsiveScheduleContent
                currentWeekday={currentWeekday}
                dayCounts={dayCounts}
                dayLabels={dayLabels}
                days={calendarWeek.days}
                selectedWeekday={selectedWeekday}
                viewerRole={props.viewerRole}
                hasActiveFilters={hasActiveFilters}
                setSelectedWeekday={setSelectedWeekday}
                visibleHourRange={calendarWeek.visibleHourRange}
              />

              <ScheduleTypeLegend legend={typeLegend} />
            </Stack>
          )}
        </PageSection>
      ) : null}
    </PageLayout>
  )
}

type ScheduleFiltersToolbarProps = {
  filterOptions: ScheduleFilterOptions
  filters: ScheduleFilters
  onRefresh: () => void
  refreshDisabled: boolean
  setFilters: Dispatch<SetStateAction<ScheduleFilters>>
}

function ScheduleFiltersToolbar({
  filterOptions,
  filters,
  onRefresh,
  refreshDisabled,
  setFilters,
}: ScheduleFiltersToolbarProps) {
  const filterItems = [
    {
      key: 'branchId',
      label: 'Филиал',
      render: () => (
        <Select
          clearable
          data={filterOptions.branches}
          label="Филиал"
          leftSection={<IconBuilding size={16} />}
          onChange={(value) => updateFilter(setFilters, 'branchId', value)}
          placeholder="Все филиалы"
          searchable
          value={filters.branchId}
        />
      ),
    },
    {
      key: 'hallId',
      label: 'Зал',
      render: () => (
        <Select
          clearable
          data={filterOptions.halls}
          label="Зал"
          leftSection={<IconDoor size={16} />}
          onChange={(value) => updateFilter(setFilters, 'hallId', value)}
          placeholder="Все залы"
          searchable
          value={filters.hallId}
        />
      ),
    },
    {
      key: 'trainerId',
      label: 'Тренер',
      render: () => (
        <Select
          clearable
          data={filterOptions.trainers}
          label="Тренер"
          leftSection={<IconUser size={16} />}
          onChange={(value) => updateFilter(setFilters, 'trainerId', value)}
          placeholder="Все тренеры"
          searchable
          value={filters.trainerId}
        />
      ),
    },
    {
      key: 'groupId',
      label: 'Группа',
      render: () => (
        <Select
          clearable
          data={filterOptions.groups}
          label="Группа"
          leftSection={<IconUsers size={16} />}
          onChange={(value) => updateFilter(setFilters, 'groupId', value)}
          placeholder="Все группы"
          searchable
          value={filters.groupId}
        />
      ),
    },
  ] satisfies CompactFilterItem[]

  return (
    <CompactFilterPanel
      actions={(
        <TaskToolbarRefreshAction
          disabled={refreshDisabled}
          label="Обновить"
          onClick={onRefresh}
        />
      )}
      className="schedule-filter-toolbar"
      data-testid="schedule-filter-panel"
      onReset={() => setFilters(EMPTY_SCHEDULE_FILTERS)}
      primary={filterItems}
      resetLabel="Сбросить"
    />
  )
}

type ScheduleRefreshToolbarProps = {
  onRefresh: () => void
  refreshDisabled: boolean
}

function ScheduleRefreshToolbar({
  onRefresh,
  refreshDisabled,
}: ScheduleRefreshToolbarProps) {
  return (
    <div
      className="schedule-filter-toolbar schedule-refresh-toolbar"
      data-testid="schedule-filter-panel"
    >
      <TaskToolbarRefreshAction
        disabled={refreshDisabled}
        label="Обновить"
        onClick={onRefresh}
      />
    </div>
  )
}

type ResponsiveScheduleContentProps = {
  currentWeekday: WeekdayNumber
  dayCounts: Record<WeekdayNumber, number>
  dayLabels: ScheduleWeekdayLabel[]
  days: ScheduleCalendarDay<TrainingGroupListItem>[]
  selectedWeekday: WeekdayNumber
  setSelectedWeekday: (weekday: WeekdayNumber) => void
  hasActiveFilters: boolean
  visibleHourRange: ScheduleVisibleHourRange
  viewerRole: UserRole
}

function ResponsiveScheduleContent({
  currentWeekday,
  dayCounts,
  dayLabels,
  days,
  selectedWeekday,
  setSelectedWeekday,
  viewerRole,
  hasActiveFilters,
  visibleHourRange,
}: ResponsiveScheduleContentProps) {
  const isMobile = useScheduleMobileViewport()

  if (isMobile) {
    return (
      <ScheduleMobileList
        currentWeekday={currentWeekday}
        dayCounts={dayCounts}
        dayLabels={dayLabels}
        days={days}
        selectedWeekday={selectedWeekday}
        viewerRole={viewerRole}
        hasActiveFilters={hasActiveFilters}
        setSelectedWeekday={setSelectedWeekday}
        visibleHourRange={visibleHourRange}
      />
    )
  }

  return (
    <div className="schedule-board__viewport">
      <ScheduleDesktopGrid
        currentWeekday={currentWeekday}
        dayCounts={dayCounts}
        dayLabels={dayLabels}
        days={days}
        hasActiveFilters={hasActiveFilters}
        visibleHourRange={visibleHourRange}
        viewerRole={viewerRole}
      />
    </div>
  )
}

function useScheduleMobileViewport() {
  return useMediaQuery(MOBILE_BREAKPOINT)
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
  hasActiveFilters: boolean
  visibleHourRange: ScheduleVisibleHourRange
  viewerRole: UserRole
}

function ScheduleDesktopGrid({
  currentWeekday,
  dayCounts,
  dayLabels,
  days,
  hasActiveFilters,
  visibleHourRange,
  viewerRole,
}: ScheduleDesktopGridProps) {
  const [openedDisclosureKey, setOpenedDisclosureKey] = useState<string | null>(null)
  const [measuredDayColumnNode, setMeasuredDayColumnNode] = useState<HTMLDivElement | null>(null)
  const [disclosureNaturalHeightPxByKey, setDisclosureNaturalHeightPxByKey] = useState(
    () => new Map<string, number>(),
  )
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>())
  const measuredDayColumnWidth = useElementWidth(measuredDayColumnNode)
  const dayContentWidthPx = measuredDayColumnWidth === null
    ? null
    : Math.max(0, measuredDayColumnWidth - 12)
  const hourMarks = buildScheduleHourMarks(visibleHourRange)
  const gridHeight = (visibleHourRange.endHour - visibleHourRange.startHour) *
    SCHEDULE_DESKTOP_HOUR_HEIGHT_PX
  const labelByWeekday = buildDayLabelMap(dayLabels)
  const disclosureGroupsByWeekday = useMemo(() => new Map(days.map((day) => [
    day.weekday,
    buildScheduleVisualDisclosureGroups(day.entries, {
      dayContentWidthPx,
      disclosureNaturalHeightPxByKey,
      hourHeightPx: SCHEDULE_DESKTOP_HOUR_HEIGHT_PX,
      laneGapPx: SCHEDULE_LANE_GAP_PX,
    }),
  ])), [dayContentWidthPx, days, disclosureNaturalHeightPxByKey])
  const disclosureKeys = useMemo(() => new Set(
    [...disclosureGroupsByWeekday.values()]
      .flatMap((groups) => groups.map((group) => group.key)),
  ), [disclosureGroupsByWeekday])
  const closeDisclosure = (key: string) => {
    setOpenedDisclosureKey(null)
    triggerRefs.current.get(key)?.focus()
  }
  const handleDisclosureNaturalHeight = (key: string, heightPx: number) => {
    if (heightPx <= 0) {
      return
    }

    setDisclosureNaturalHeightPxByKey((currentHeights) => {
      const currentHeight = currentHeights.get(key) ?? 0

      if (Math.abs(currentHeight - heightPx) <= 0.5) {
        return currentHeights
      }

      const nextHeights = new Map(currentHeights)

      nextHeights.set(key, heightPx)

      return nextHeights
    })
  }

  useEffect(() => {
    if (!openedDisclosureKey || disclosureKeys.has(openedDisclosureKey)) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      setOpenedDisclosureKey(null)
      document.querySelector<HTMLElement>('[data-testid="schedule-board"]')?.focus()
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [disclosureKeys, openedDisclosureKey])

  return (
    <div
      aria-label="Недельное расписание"
      className="schedule-weekly-grid"
      data-testid="schedule-calendar-grid"
      tabIndex={-1}
    >
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

        {days.map((day, index) => (
          <ScheduleDesktopDayColumn
            day={day}
            disclosureGroups={disclosureGroupsByWeekday.get(day.weekday) ?? []}
            gridHeight={gridHeight}
            hasActiveFilters={hasActiveFilters}
            hourMarks={hourMarks}
            isCurrent={day.weekday === currentWeekday}
            key={day.weekday}
            labelByWeekday={labelByWeekday}
            measureRef={index === 0 ? setMeasuredDayColumnNode : undefined}
            onCloseDisclosure={closeDisclosure}
            onDisclosureNaturalHeight={handleDisclosureNaturalHeight}
            openedDisclosureKey={openedDisclosureKey}
            setOpenedDisclosureKey={setOpenedDisclosureKey}
            triggerRefs={triggerRefs}
            viewerRole={viewerRole}
            visibleHourRange={visibleHourRange}
          />
        ))}
      </div>
    </div>
  )
}

type ScheduleDesktopDayColumnProps = {
  day: ScheduleCalendarDay<TrainingGroupListItem>
  disclosureGroups: ScheduleVisualDisclosureGroup<TrainingGroupListItem>[]
  gridHeight: number
  hasActiveFilters: boolean
  hourMarks: number[]
  isCurrent: boolean
  labelByWeekday: Map<WeekdayNumber, ScheduleWeekdayLabel>
  measureRef?: (node: HTMLDivElement | null) => void
  onCloseDisclosure: (key: string) => void
  onDisclosureNaturalHeight: (key: string, heightPx: number) => void
  openedDisclosureKey: string | null
  setOpenedDisclosureKey: Dispatch<SetStateAction<string | null>>
  triggerRefs: MutableRefObject<Map<string, HTMLButtonElement>>
  viewerRole: UserRole
  visibleHourRange: ScheduleVisibleHourRange
}

function ScheduleDesktopDayColumn({
  day,
  disclosureGroups,
  gridHeight,
  hasActiveFilters,
  hourMarks,
  isCurrent,
  labelByWeekday,
  measureRef,
  onCloseDisclosure,
  onDisclosureNaturalHeight,
  openedDisclosureKey,
  setOpenedDisclosureKey,
  triggerRefs,
  viewerRole,
  visibleHourRange,
}: ScheduleDesktopDayColumnProps) {
  const hiddenEntryKeys = useMemo(() => new Set(disclosureGroups.flatMap((group) =>
    group.entries.map((entry) => entry.key),
  )), [disclosureGroups])
  const renderItems = useMemo(() => ([
    ...day.entries
      .filter((entry) => !hiddenEntryKeys.has(entry.key))
      .map((entry) => ({
        type: 'entry' as const,
        key: entry.key,
        startMinutes: entry.startMinutes,
        entry,
      })),
    ...disclosureGroups.map((group) => ({
      type: 'disclosure' as const,
      key: group.key,
      startMinutes: group.startMinutes,
      group,
    })),
  ].sort((first, second) =>
    first.startMinutes - second.startMinutes || first.key.localeCompare(second.key, 'ru'),
  )), [day.entries, disclosureGroups, hiddenEntryKeys])
  const dayLabel = labelByWeekday.get(day.weekday)

  return (
    <div
      className="schedule-weekly-grid__day-column"
      data-current={isCurrent ? 'true' : undefined}
      data-testid={`schedule-day-${day.weekday}`}
      ref={measureRef}
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
          {getScheduleDayEmptyCopy(viewerRole, hasActiveFilters).title}
        </Text>
      ) : null}

      {renderItems.map((item) => item.type === 'entry' ? (
        <ScheduleCalendarCard
          entry={item.entry}
          hourHeight={SCHEDULE_DESKTOP_HOUR_HEIGHT_PX}
          key={item.key}
          mode="calendar"
          visibleHourRange={visibleHourRange}
        />
      ) : (
        <ScheduleEventsDisclosure
          dateLabel={dayLabel?.dateLabel ?? ''}
          group={item.group}
          hourHeight={SCHEDULE_DESKTOP_HOUR_HEIGHT_PX}
          isOpen={openedDisclosureKey === item.group.key}
          key={item.key}
          onClose={() => onCloseDisclosure(item.group.key)}
          onNaturalHeight={onDisclosureNaturalHeight}
          onToggle={() => setOpenedDisclosureKey((currentKey) =>
            currentKey === item.group.key ? null : item.group.key,
          )}
          triggerRefs={triggerRefs}
          visibleHourRange={visibleHourRange}
          weekdayLabel={dayLabel?.label ?? day.label}
        />
      ))}
    </div>
  )
}

type ScheduleMobileListProps = {
  currentWeekday: WeekdayNumber
  dayCounts: Record<WeekdayNumber, number>
  dayLabels: ScheduleWeekdayLabel[]
  days: ScheduleCalendarDay<TrainingGroupListItem>[]
  hasActiveFilters: boolean
  selectedWeekday: WeekdayNumber
  setSelectedWeekday: (weekday: WeekdayNumber) => void
  visibleHourRange: ScheduleVisibleHourRange
  viewerRole: UserRole
}

function ScheduleMobileList({
  currentWeekday,
  dayCounts,
  dayLabels,
  days,
  hasActiveFilters,
  selectedWeekday,
  setSelectedWeekday,
  visibleHourRange,
  viewerRole,
}: ScheduleMobileListProps) {
  const selectedDay = days.find((day) => day.weekday === selectedWeekday) ?? days[0]
  const hourMarks = buildScheduleHourMarks(visibleHourRange)
  const gridHeight = (visibleHourRange.endHour - visibleHourRange.startHour) *
    SCHEDULE_MOBILE_HOUR_HEIGHT_PX
  const tabRefs = useRef(new Map<WeekdayNumber, HTMLButtonElement>())
  const selectWeekday = (
    weekday: WeekdayNumber,
    options: { focus?: boolean } = {},
  ) => {
    setSelectedWeekday(weekday)

    if (options.focus) {
      window.requestAnimationFrame(() => {
        tabRefs.current.get(weekday)?.focus()
      })
    }
  }

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
            ref={(node) => {
              if (node) {
                tabRefs.current.set(day.weekday, node)
              } else {
                tabRefs.current.delete(day.weekday)
              }
            }}
            role="tab"
            type="button"
          >
            <span className="schedule-mobile-day-strip__weekday">{day.label}</span>
            <span className="schedule-mobile-day-strip__date">{day.dateLabel}</span>
            <span
              className="schedule-day-header__count"
              data-testid={`schedule-day-count-${day.weekday}`}
            >
              {formatScheduleEntryCount(dayCounts[day.weekday])}
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
              <ScheduleDayEmpty
                hasActiveFilters={hasActiveFilters}
                viewerRole={viewerRole}
              />
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
      aria-label={`${label} ${dateLabel}: ${formatScheduleEntryCount(count)}${isCurrent ? ', текущий день недели' : ''}`}
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
        {formatScheduleEntryCount(count)}
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
      data-schedule-type={getScheduleTypeKey(group)}
      data-testid={`schedule-card-${entry.weekday}-${group.id}`}
      style={style}
    >
      <Stack gap={mode === 'mobile-grid' ? 'xs' : 4}>
        <Group align="flex-start" justify="space-between" wrap="nowrap">
          <Stack className="schedule-event-card__copy" gap={3}>
            <Text className="schedule-event-card__time" fw={800}>
              {timeRange}
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

function ScheduleDayEmpty({
  hasActiveFilters,
  viewerRole,
}: {
  hasActiveFilters: boolean
  viewerRole: UserRole
}) {
  const copy = getScheduleDayEmptyCopy(viewerRole, hasActiveFilters)

  return (
    <div className="schedule-day-empty">
      <Group gap="sm" wrap="nowrap">
        <ThemeIcon color="gray" radius="xl" size={34} variant="light">
          <IconClockHour4 size={18} />
        </ThemeIcon>
        <Stack gap={2}>
          <Text fw={700} size="sm">
            {copy.title}
          </Text>
          <Text c="dimmed" size="xs">
            {copy.description}
          </Text>
        </Stack>
      </Group>
    </div>
  )
}

function getScheduleDayEmptyCopy(
  viewerRole: UserRole,
  hasActiveFilters: boolean,
) {
  if (hasActiveFilters) {
    return {
      title: 'Занятий нет',
      description: 'День свободен для выбранных фильтров.',
    }
  }

  if (viewerRole === 'Coach') {
    return {
      title: 'В этот день у вас занятий нет',
      description: 'На выбранный день в вашем расписании нет занятий.',
    }
  }

  return {
    title: 'Занятий нет',
    description: 'В этот день в расписании нет занятий.',
  }
}

function useElementWidth(node: HTMLElement | null) {
  const [width, setWidth] = useState<number | null>(null)

  useEffect(() => {
    if (!node || typeof ResizeObserver === 'undefined') {
      const frameId = window.requestAnimationFrame(() => {
        setWidth(node?.clientWidth ? node.clientWidth : null)
      })

      return () => window.cancelAnimationFrame(frameId)
    }

    const updateWidth = (nextWidth: number) => {
      setWidth((currentWidth) =>
        Math.abs((currentWidth ?? 0) - nextWidth) > 0.5 ? nextWidth : currentWidth,
      )
    }
    const observer = new ResizeObserver(([entry]) => {
      updateWidth(entry?.contentRect.width ?? node.clientWidth)
    })

    updateWidth(node.clientWidth)
    observer.observe(node)

    return () => observer.disconnect()
  }, [node])

  return width && width > 0 ? width : null
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
  selectWeekday: (
    weekday: WeekdayNumber,
    options?: { focus?: boolean },
  ) => void,
) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
    return
  }

  event.preventDefault()

  const direction = event.key === 'ArrowRight' ? 1 : -1
  const nextIndex = (WEEKDAY_INDEX_BY_NUMBER[weekday] + direction + 7) % 7
  const nextWeekday = WEEKDAY_BY_INDEX[nextIndex] ?? weekday

  selectWeekday(nextWeekday, { focus: true })
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
