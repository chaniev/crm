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
  Title,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import {
  IconCalendarWeek,
  IconClockHour4,
  IconFilterOff,
  IconMapPin,
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
  buildScheduleFilterOptions,
  formatDurationMinutes,
  formatTrainingStartTime,
  hasActiveScheduleFilters,
  type ScheduleCalendarDay,
  type ScheduleCalendarEntry,
  type ScheduleFilters,
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
  RefreshButton,
  ResponsiveButtonGroup,
} from '../shared/ux'

const SCHEDULE_GROUPS_PAGE_SIZE = 100
const MOBILE_BREAKPOINT = '(max-width: 47.99em)'
const SCHEDULE_HOUR_HEIGHT_PX = 80
const SCHEDULE_LANE_GAP_PX = 8

type GroupScheduleScreenProps = {
  canManageGroups: boolean
  onEditGroup: (groupId: string) => void
}

export function GroupScheduleScreen(props: GroupScheduleScreenProps) {
  void props

  const [groups, setGroups] = useState<TrainingGroupListItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [filters, setFilters] = useState<ScheduleFilters>(EMPTY_SCHEDULE_FILTERS)
  const [selectedWeekday, setSelectedWeekday] = useState<WeekdayNumber>(1)
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
        setTotalCount(response.totalCount)
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
  const activeFiltersCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters],
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

  return (
    <Stack className="dashboard-stack schedule-screen" data-testid="schedule-screen" gap="xl">
      <PageCard className="page-header-card">
        <PageHeader
          actions={(
            <ResponsiveButtonGroup justify="flex-end">
              <RefreshButton
                label="Обновить"
                loading={loading || refreshing}
                onClick={() => setReloadKey((currentKey) => currentKey + 1)}
              />
            </ResponsiveButtonGroup>
          )}
          description="Групповые занятия по дням, времени, филиалам и залам."
          eyebrow={(
            <Group gap="sm">
              <Badge color="brand.1" radius="xl" size="lg" variant="light">
                Групповые занятия
              </Badge>
              <Badge color="sand" radius="xl" size="lg" variant="light">
                Показано {filteredGroups.length} из {totalCount}
              </Badge>
              {activeFiltersCount > 0 ? (
                <Badge color="brand.7" radius="xl" size="lg" variant="light">
                  Фильтры: {activeFiltersCount}
                </Badge>
              ) : null}
            </Group>
          )}
          title="Расписание"
        />
      </PageCard>

      <PageCard className="schedule-filters-card" data-testid="schedule-filters">
        <Stack gap="lg">
          <PageHeader title="Фильтры" />

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
                onClick={() => setReloadKey((currentKey) => currentKey + 1)}
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
          ) : isMobile ? (
            <ScheduleMobileList
              days={calendarWeek.days}
              selectedWeekday={selectedWeekday}
              setSelectedWeekday={setSelectedWeekday}
            />
          ) : (
            <ScheduleDesktopGrid
              days={calendarWeek.days}
              visibleHourRange={calendarWeek.visibleHourRange}
            />
          )}
        </Paper>
      ) : null}
    </Stack>
  )
}

type ScheduleDesktopGridProps = {
  days: ScheduleCalendarDay<TrainingGroupListItem>[]
  visibleHourRange: ScheduleVisibleHourRange
}

function ScheduleDesktopGrid({
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
          <div
            className="schedule-weekly-grid__day-header"
            data-testid={`schedule-day-header-${day.weekday}`}
            key={day.weekday}
          >
            <Text fw={800} size="sm">
              {day.label}
            </Text>
            <Text c="dimmed" size="xs">
              {day.entries.length} занятий
            </Text>
          </div>
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
  days: ScheduleCalendarDay<TrainingGroupListItem>[]
  selectedWeekday: WeekdayNumber
  setSelectedWeekday: (weekday: WeekdayNumber) => void
}

function ScheduleMobileList({
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

      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <ThemeIcon color="brand.7" radius="xl" size={36} variant="light">
            <IconCalendarWeek size={18} />
          </ThemeIcon>
          <Stack gap={0}>
            <Title order={3}>{selectedDay.label}</Title>
          </Stack>
        </Group>
        <Badge data-testid={`schedule-day-count-${selectedDay.weekday}`} radius="xl" variant="light">
          {selectedDay.entries.length}
        </Badge>
      </Group>

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
  const style = mode === 'calendar' && visibleHourRange
    ? buildCalendarEntryStyle(entry, visibleHourRange)
    : undefined

  return (
    <article
      className={[
        'schedule-event-card',
        mode === 'calendar'
          ? 'schedule-event-card--calendar'
          : 'schedule-event-card--list',
      ].join(' ')}
      data-testid={`schedule-card-${entry.weekday}-${group.id}`}
      style={style}
    >
      <Stack gap="xs">
        <Group align="flex-start" justify="space-between" wrap="nowrap">
          <Stack className="schedule-event-card__copy" gap={3}>
            <Text className="schedule-event-card__time" fw={800}>
              {formatTrainingStartTime(group.trainingStartTime)}
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

        <Group className="schedule-event-card__badges" gap={6}>
          <Badge color="brand.1" radius="xl" size="sm" variant="light">
            {group.groupTypeName}
          </Badge>
          <Badge color="sand" radius="xl" size="sm" variant="light">
            {formatDurationMinutes(group.durationMinutes)}
          </Badge>
          <Badge color="gray" radius="xl" size="sm" variant="light">
            {group.clientCount} чел.
          </Badge>
        </Group>

        <Group className="schedule-event-card__meta" gap="xs" wrap="nowrap">
          <IconMapPin size={14} />
          <Text size="xs">
            {group.branchName} · {group.hallName}
          </Text>
        </Group>

        <Group className="schedule-event-card__meta" gap="xs" wrap="nowrap">
          <IconUsers size={14} />
          <Text className="schedule-event-card__trainers" size="xs">
            {formatTrainerNames(group)}
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

function buildCalendarEntryStyle(
  entry: ScheduleCalendarEntry<TrainingGroupListItem>,
  visibleHourRange: ScheduleVisibleHourRange,
) {
  const top = ((entry.startMinutes - (visibleHourRange.startHour * 60)) / 60) *
    SCHEDULE_HOUR_HEIGHT_PX
  const height = ((entry.endMinutes - entry.startMinutes) / 60) * SCHEDULE_HOUR_HEIGHT_PX
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

function formatTrainerNames(group: TrainingGroupListItem) {
  if (group.trainerNames.length > 0) {
    return `Тренеры: ${group.trainerNames.join(', ')}`
  }

  if (group.trainers.length > 0) {
    return `Тренеры: ${group.trainers.map((trainer) => trainer.fullName).join(', ')}`
  }

  return 'Тренеры пока не назначены'
}
