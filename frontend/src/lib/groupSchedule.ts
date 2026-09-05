import type { TrainingGroupListItem } from './api'
import { fe17SharedRoutingThemeText } from '../resources/fe-17-shared-routing-theme'


export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const
const DEFAULT_VISIBLE_START_HOUR = 8
const DEFAULT_VISIBLE_END_HOUR = 21

export type WeekdayNumber = (typeof WEEKDAYS)[number]

export type GroupScheduleDay<TGroup = TrainingGroupListItem> = {
  weekday: WeekdayNumber
  label: string
  entries: TGroup[]
}

export type ScheduleFilters = {
  branchId: string | null
  hallId: string | null
  trainerId: string | null
  groupId: string | null
}

export type ScheduleFilterOption = {
  value: string
  label: string
}

export type ScheduleFilterOptions = {
  branches: ScheduleFilterOption[]
  halls: ScheduleFilterOption[]
  trainers: ScheduleFilterOption[]
  groups: ScheduleFilterOption[]
}

export type ScheduleVisibleHourRange = {
  startHour: number
  endHour: number
}

export type ScheduleWeekdayLabel = {
  weekday: WeekdayNumber
  label: string
  dateLabel: string
}

export type ScheduleTypePalette = {
  name: string
  color: string
  background: string
  border: string
}

export type ScheduleCalendarEntry<TGroup = TrainingGroupListItem> = {
  key: string
  weekday: WeekdayNumber
  group: TGroup
  startMinutes: number
  endMinutes: number
  lane: number
  laneCount: number
}

export type ScheduleCalendarDay<TGroup = TrainingGroupListItem> = {
  weekday: WeekdayNumber
  label: string
  entries: ScheduleCalendarEntry<TGroup>[]
}

export type ScheduleCalendarWeek<TGroup = TrainingGroupListItem> = {
  days: ScheduleCalendarDay<TGroup>[]
  visibleHourRange: ScheduleVisibleHourRange
}

export type ScheduleTypeLegendItem = {
  key: string
  label: string
  count: number
  palette: ScheduleTypePalette
}

export type ScheduleHallLoadItem = {
  key: string
  label: string
  count: number
  totalMinutes: number
}

export type ScheduleTodaySummary = {
  weekday: WeekdayNumber
  totalEntries: number
  typeItems: ScheduleTypeLegendItem[]
  hallItems: ScheduleHallLoadItem[]
}

export type ScheduleEntryGridMetrics = {
  topPercent: number
  heightPercent: number
  laneLeftPercent: number
  laneWidthPercent: number
}

export type ScheduleVisualDisclosureGroup<TGroup = TrainingGroupListItem> = {
  key: string
  entries: ScheduleCalendarEntry<TGroup>[]
  startMinutes: number
  endMinutes: number
  count: number
}

export type ScheduleVisualDisclosureOptions = {
  dayContentWidthPx: number | null
  disclosureNaturalHeightPxByKey?: ReadonlyMap<string, number>
  hourHeightPx: number
  laneGapPx: number
}

export const SCHEDULE_DENSE_CLUSTER_MIN_LANE_COUNT = 3
export const SCHEDULE_MIN_READABLE_LANE_WIDTH_PX = 112
export const SCHEDULE_MIN_READABLE_CARD_HEIGHT_PX = 84
export const SCHEDULE_MIN_VISUAL_CARD_HEIGHT_PX = 54

export const WEEKDAY_LABELS: Record<number, string> = {
  1: fe17SharedRoutingThemeText.groupSchedule_string_31a8ee2f,
  2: fe17SharedRoutingThemeText.groupSchedule_string_839b2d5c,
  3: fe17SharedRoutingThemeText.groupSchedule_string_7ec16b9e,
  4: fe17SharedRoutingThemeText.groupSchedule_string_95661872,
  5: fe17SharedRoutingThemeText.groupSchedule_string_4ca114c2,
  6: fe17SharedRoutingThemeText.groupSchedule_string_95dab017,
  7: fe17SharedRoutingThemeText.groupSchedule_string_7971972c,
}

export const WEEKDAY_OPTIONS = Object.entries(WEEKDAY_LABELS).map(
  ([value, label]) => ({
    value,
    label,
  }),
)

export const EMPTY_SCHEDULE_FILTERS: ScheduleFilters = {
  branchId: null,
  hallId: null,
  trainerId: null,
  groupId: null,
}

export const SCHEDULE_TYPE_PALETTE = [
  {
    name: 'emerald',
    color: 'var(--crm-accent-1-fg)',
    background: 'var(--crm-accent-1-bg)',
    border: 'var(--crm-accent-1-border)',
  },
  {
    name: 'amber',
    color: 'var(--crm-accent-2-fg)',
    background: 'var(--crm-accent-2-bg)',
    border: 'var(--crm-accent-2-border)',
  },
  {
    name: 'blue',
    color: 'var(--crm-accent-3-fg)',
    background: 'var(--crm-accent-3-bg)',
    border: 'var(--crm-accent-3-border)',
  },
  {
    name: 'violet',
    color: 'var(--crm-accent-4-fg)',
    background: 'var(--crm-accent-4-bg)',
    border: 'var(--crm-accent-4-border)',
  },
  {
    name: 'rose',
    color: 'var(--crm-status-danger)',
    background: 'var(--crm-status-danger-bg)',
    border: 'var(--crm-status-danger-border)',
  },
  {
    name: 'slate',
    color: 'var(--crm-status-neutral)',
    background: 'var(--crm-status-neutral-bg)',
    border: 'var(--crm-status-neutral-border)',
  },
] as const satisfies readonly ScheduleTypePalette[]

export type ScheduleGroupLike = Pick<
  TrainingGroupListItem,
  | 'id'
  | 'name'
  | 'branchId'
  | 'branchName'
  | 'hallId'
  | 'hallName'
  | 'groupTypeId'
  | 'groupTypeName'
  | 'trainingStartTime'
  | 'durationMinutes'
  | 'weekdays'
  | 'trainerIds'
  | 'trainerNames'
  | 'trainers'
  | 'clientCount'
>

export function formatWeekdays(weekdays?: readonly number[] | null) {
  if (!weekdays || weekdays.length === 0) {
    return fe17SharedRoutingThemeText.groupSchedule_string_f783a57e
  }

  return weekdays
    .map((weekday) => WEEKDAY_LABELS[weekday] ?? String(weekday))
    .join(', ')
}

export function formatDurationMinutes(durationMinutes?: number | null) {
  if (typeof durationMinutes !== 'number') {
    return fe17SharedRoutingThemeText.groupSchedule_string_97041ad9
  }

  return fe17SharedRoutingThemeText.groupSchedule_template_08b196b8(durationMinutes)
}

export function formatTrainingStartTime(trainingStartTime?: string | null) {
  const parsedTime = parseTrainingStartTime(trainingStartTime)

  if (!parsedTime) {
    return trainingStartTime?.trim() || fe17SharedRoutingThemeText.groupSchedule_string_8d62fb15
  }

  return parsedTime.label
}

export function parseTrainingStartTime(trainingStartTime?: string | null) {
  const value = trainingStartTime?.trim()

  if (!value) {
    return null
  }

  const match = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)

  if (!match) {
    return null
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null
  }

  return {
    hours,
    minutes,
    totalMinutes: (hours * 60) + minutes,
    label: fe17SharedRoutingThemeText.groupSchedule_label_6fdf41c8(String(hours).padStart(2, '0'), String(minutes).padStart(2, '0')),
  }
}

export function getCurrentScheduleWeekday(now = new Date()): WeekdayNumber {
  const weekday = now.getDay()

  return (weekday === 0 ? 7 : weekday) as WeekdayNumber
}

export function buildScheduleWeekdayLabels(now = new Date()): ScheduleWeekdayLabel[] {
  const weekStart = getLocalScheduleWeekStart(now)

  return WEEKDAYS.map((weekday, index) => {
    const date = new Date(weekStart)

    date.setDate(weekStart.getDate() + index)

    return {
      weekday,
      label: WEEKDAY_LABELS[weekday],
      dateLabel: formatScheduleDateLabel(date),
    }
  })
}

export function buildScheduleHourMarks(visibleHourRange: ScheduleVisibleHourRange) {
  const totalHours = visibleHourRange.endHour - visibleHourRange.startHour

  return Array.from(
    { length: totalHours + 1 },
    (_, index) => visibleHourRange.startHour + index,
  )
}

export function getScheduleEntryGridMetrics<TGroup>(
  entry: Pick<
    ScheduleCalendarEntry<TGroup>,
    'startMinutes' | 'endMinutes' | 'lane' | 'laneCount'
  >,
  visibleHourRange: ScheduleVisibleHourRange,
): ScheduleEntryGridMetrics {
  const rangeMinutes = Math.max(
    1,
    (visibleHourRange.endHour - visibleHourRange.startHour) * 60,
  )
  const laneCount = Math.max(1, entry.laneCount)
  const laneWidthPercent = 100 / laneCount

  return {
    topPercent: ((entry.startMinutes - (visibleHourRange.startHour * 60)) / rangeMinutes) * 100,
    heightPercent: ((entry.endMinutes - entry.startMinutes) / rangeMinutes) * 100,
    laneLeftPercent: entry.lane * laneWidthPercent,
    laneWidthPercent,
  }
}

export function buildScheduleVisualDisclosureGroups<TGroup>(
  entries: readonly ScheduleCalendarEntry<TGroup>[],
  options: ScheduleVisualDisclosureOptions,
): ScheduleVisualDisclosureGroup<TGroup>[] {
  const orderedEntries = [...entries].sort(compareScheduleCalendarEntriesByTime)
  const clusters = buildScheduleOverlapClusters(orderedEntries)
  const denseRanges = clusters
    .filter((cluster) => isUnreadableOverlapCluster(cluster, options))
    .map((cluster) => ({
      startIndex: cluster.startIndex,
      endIndex: cluster.endIndex,
    }))

  if (denseRanges.length === 0) {
    return []
  }

  const mergedRanges = mergeIntersectingDisclosureRanges(
    orderedEntries,
    denseRanges,
    options,
  )

  return mergedRanges.map((range) => {
    const groupEntries = orderedEntries.slice(range.startIndex, range.endIndex + 1)
    const startMinutes = Math.min(...groupEntries.map((entry) => entry.startMinutes))
    const endMinutes = Math.max(...groupEntries.map((entry) => entry.endMinutes))

    return {
      key: buildScheduleDisclosureKey(groupEntries, startMinutes, endMinutes),
      entries: groupEntries,
      startMinutes,
      endMinutes,
      count: groupEntries.length,
    }
  })
}

export function buildScheduleDayCounts<TGroup>(
  days: readonly ScheduleCalendarDay<TGroup>[],
) {
  return days.reduce<Record<WeekdayNumber, number>>((counts, day) => {
    counts[day.weekday] = day.entries.length

    return counts
  }, {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
  })
}

export function getScheduleTypeKey(group: Pick<ScheduleGroupLike, 'groupTypeId'>) {
  const groupTypeId = group.groupTypeId.trim()

  return groupTypeId || 'unknown'
}

export function getScheduleTypeLabel(group: Pick<ScheduleGroupLike, 'groupTypeName'>) {
  return group.groupTypeName.trim() || fe17SharedRoutingThemeText.groupSchedule_string_e93b045d
}

export function getScheduleTypePalette(groupOrKey: Pick<
  ScheduleGroupLike,
  'groupTypeId'
> | string): ScheduleTypePalette {
  const key = typeof groupOrKey === 'string'
    ? groupOrKey
    : getScheduleTypeKey(groupOrKey)

  return SCHEDULE_TYPE_PALETTE[getStablePaletteIndex(key)]
}

export function buildScheduleTypeLegend<TGroup extends Pick<
  ScheduleGroupLike,
  'groupTypeId' | 'groupTypeName'
>>(
  entries: readonly Pick<ScheduleCalendarEntry<TGroup>, 'group'>[],
): ScheduleTypeLegendItem[] {
  const items = new Map<string, ScheduleTypeLegendItem>()

  for (const entry of entries) {
    const key = getScheduleTypeKey(entry.group)
    const existingItem = items.get(key)

    if (existingItem) {
      existingItem.count += 1
      continue
    }

    items.set(key, {
      key,
      label: getScheduleTypeLabel(entry.group),
      count: 1,
      palette: getScheduleTypePalette(key),
    })
  }

  return [...items.values()].sort((first, second) => {
    const labelCompare = first.label.localeCompare(second.label, 'ru')

    return labelCompare === 0
      ? first.key.localeCompare(second.key, 'ru')
      : labelCompare
  })
}

export function buildScheduleTodaySummary<TGroup extends Pick<
  ScheduleGroupLike,
  | 'groupTypeId'
  | 'groupTypeName'
  | 'hallId'
  | 'hallName'
>>(
  days: readonly ScheduleCalendarDay<TGroup>[],
  weekday: WeekdayNumber,
): ScheduleTodaySummary {
  const day = days.find((item) => item.weekday === weekday)
  const entries = day?.entries ?? []

  return {
    weekday,
    totalEntries: entries.length,
    typeItems: buildScheduleTypeLegend(entries),
    hallItems: buildScheduleHallLoad(entries),
  }
}

export function formatScheduleEntryTimeRange<TGroup>(
  entry: Pick<ScheduleCalendarEntry<TGroup>, 'startMinutes' | 'endMinutes'>,
) {
  return `${formatMinutesAsTime(entry.startMinutes)} - ${formatMinutesAsTime(entry.endMinutes)}`
}

export function formatGroupSchedule(
  weekdays?: readonly number[] | null,
  durationMinutes?: number | null,
) {
  return `${formatWeekdays(weekdays)} · ${formatDurationMinutes(durationMinutes)}`
}

export function hasActiveScheduleFilters(filters: ScheduleFilters) {
  return Object.values(filters).some(Boolean)
}

export function applyScheduleFilters<TGroup extends ScheduleGroupLike>(
  groups: readonly TGroup[],
  filters: ScheduleFilters,
) {
  return groups.filter((group) => (
    (!filters.branchId || group.branchId === filters.branchId) &&
    (!filters.hallId || group.hallId === filters.hallId) &&
    (!filters.groupId || group.id === filters.groupId) &&
    (
      !filters.trainerId ||
      group.trainerIds.includes(filters.trainerId) ||
      group.trainers.some((trainer) => trainer.id === filters.trainerId) ||
      group.trainerNames.includes(filters.trainerId)
    )
  ))
}

export function buildScheduleFilterOptions<TGroup extends ScheduleGroupLike>(
  groups: readonly TGroup[],
  filters: ScheduleFilters,
): ScheduleFilterOptions {
  return {
    branches: toSortedOptions(
      applyScheduleFilters(groups, {
        ...filters,
        branchId: null,
      }).map((group) => ({
        value: group.branchId,
        label: group.branchName,
      })),
    ),
    halls: toSortedOptions(
      applyScheduleFilters(groups, {
        ...filters,
        hallId: null,
      }).map((group) => ({
        value: group.hallId,
        label: fe17SharedRoutingThemeText.groupSchedule_label_eaceb28c(group.hallName, group.branchName),
      })),
    ),
    trainers: toSortedOptions(
      applyScheduleFilters(groups, {
        ...filters,
        trainerId: null,
      }).flatMap((group) => {
        if (group.trainers.length > 0) {
          return group.trainers.map((trainer) => ({
            value: trainer.id,
            label: trainer.fullName,
          }))
        }

        return group.trainerNames.map((trainerName) => ({
          value: trainerName,
          label: trainerName,
        }))
      }),
    ),
    groups: toSortedOptions(
      applyScheduleFilters(groups, {
        ...filters,
        groupId: null,
      }).map((group) => ({
        value: group.id,
        label: group.name,
      })),
    ),
  }
}

export function getVisibleScheduleHourRange<TGroup = TrainingGroupListItem>(
  entries: readonly ScheduleCalendarEntry<TGroup>[],
): ScheduleVisibleHourRange {
  if (entries.length === 0) {
    return {
      startHour: DEFAULT_VISIBLE_START_HOUR,
      endHour: DEFAULT_VISIBLE_END_HOUR,
    }
  }

  const minStartMinutes = Math.min(...entries.map((entry) => entry.startMinutes))
  const maxEndMinutes = Math.max(...entries.map((entry) => entry.endMinutes))
  const startHour = Math.max(0, Math.floor(minStartMinutes / 60))
  const endHour = Math.min(24, Math.ceil(maxEndMinutes / 60))

  return {
    startHour,
    endHour: Math.max(startHour + 1, endHour),
  }
}

export function buildScheduleCalendarWeek<TGroup extends ScheduleGroupLike>(
  groups: readonly TGroup[],
): ScheduleCalendarWeek<TGroup> {
  const days = WEEKDAYS.map((weekday) => ({
    weekday,
    label: WEEKDAY_LABELS[weekday],
    entries: layoutScheduleEntries(
      groups
        .filter((group) => group.weekdays.includes(weekday))
        .map((group) => toScheduleCalendarEntry(group, weekday))
        .filter((entry): entry is ScheduleCalendarEntry<TGroup> => entry !== null),
    ),
  }))

  return {
    days,
    visibleHourRange: getVisibleScheduleHourRange(days.flatMap((day) => day.entries)),
  }
}

export function buildGroupWeekSchedule<TGroup extends Pick<
  TrainingGroupListItem,
  'name' | 'trainingStartTime' | 'weekdays'
>>(groups: readonly TGroup[]): GroupScheduleDay<TGroup>[] {
  return WEEKDAYS.map((weekday) => ({
    weekday,
    label: WEEKDAY_LABELS[weekday],
    entries: groups
      .filter((group) => group.weekdays.includes(weekday))
      .sort(compareScheduleGroups),
  }))
}

function toScheduleCalendarEntry<TGroup extends ScheduleGroupLike>(
  group: TGroup,
  weekday: WeekdayNumber,
) {
  const parsedTime = parseTrainingStartTime(group.trainingStartTime)

  if (!parsedTime) {
    return null
  }

  const durationMinutes = Math.max(1, group.durationMinutes)

  return {
    key: `${weekday}-${group.id}`,
    weekday,
    group,
    startMinutes: parsedTime.totalMinutes,
    endMinutes: parsedTime.totalMinutes + durationMinutes,
    lane: 0,
    laneCount: 1,
  } satisfies ScheduleCalendarEntry<TGroup>
}

function layoutScheduleEntries<TGroup extends Pick<
  TrainingGroupListItem,
  'name' | 'trainingStartTime'
>>(
  entries: readonly ScheduleCalendarEntry<TGroup>[],
) {
  const positionedEntries = [...entries].sort(compareScheduleCalendarEntries)
  const activeEntries: ScheduleCalendarEntry<TGroup>[] = []
  let clusterEntries: ScheduleCalendarEntry<TGroup>[] = []
  let clusterLaneCount = 1

  for (const entry of positionedEntries) {
    for (let index = activeEntries.length - 1; index >= 0; index -= 1) {
      if (activeEntries[index].endMinutes <= entry.startMinutes) {
        activeEntries.splice(index, 1)
      }
    }

    if (activeEntries.length === 0 && clusterEntries.length > 0) {
      finalizeCluster(clusterEntries, clusterLaneCount)
      clusterEntries = []
      clusterLaneCount = 1
    }

    const occupiedLanes = new Set(activeEntries.map((activeEntry) => activeEntry.lane))
    let lane = 0

    while (occupiedLanes.has(lane)) {
      lane += 1
    }

    entry.lane = lane
    clusterLaneCount = Math.max(clusterLaneCount, lane + 1)
    activeEntries.push(entry)
    clusterEntries.push(entry)
  }

  if (clusterEntries.length > 0) {
    finalizeCluster(clusterEntries, clusterLaneCount)
  }

  return positionedEntries
}

type ScheduleOverlapCluster<TGroup> = {
  entries: ScheduleCalendarEntry<TGroup>[]
  startIndex: number
  endIndex: number
  laneCount: number
}

function buildScheduleOverlapClusters<TGroup>(
  entries: readonly ScheduleCalendarEntry<TGroup>[],
): ScheduleOverlapCluster<TGroup>[] {
  const clusters: ScheduleOverlapCluster<TGroup>[] = []
  let clusterEntries: ScheduleCalendarEntry<TGroup>[] = []
  let clusterStartIndex = 0
  let clusterEndMinutes = 0

  entries.forEach((entry, index) => {
    if (clusterEntries.length === 0) {
      clusterEntries = [entry]
      clusterStartIndex = index
      clusterEndMinutes = entry.endMinutes
      return
    }

    if (entry.startMinutes < clusterEndMinutes) {
      clusterEntries.push(entry)
      clusterEndMinutes = Math.max(clusterEndMinutes, entry.endMinutes)
      return
    }

    clusters.push(toScheduleOverlapCluster(clusterEntries, clusterStartIndex))
    clusterEntries = [entry]
    clusterStartIndex = index
    clusterEndMinutes = entry.endMinutes
  })

  if (clusterEntries.length > 0) {
    clusters.push(toScheduleOverlapCluster(clusterEntries, clusterStartIndex))
  }

  return clusters
}

function toScheduleOverlapCluster<TGroup>(
  entries: ScheduleCalendarEntry<TGroup>[],
  startIndex: number,
): ScheduleOverlapCluster<TGroup> {
  return {
    entries,
    startIndex,
    endIndex: startIndex + entries.length - 1,
    laneCount: Math.max(...entries.map((entry) => entry.laneCount), 1),
  }
}

function isUnreadableOverlapCluster<TGroup>(
  cluster: ScheduleOverlapCluster<TGroup>,
  options: ScheduleVisualDisclosureOptions,
) {
  if (cluster.entries.length <= 1) {
    return false
  }

  if (cluster.laneCount >= SCHEDULE_DENSE_CLUSTER_MIN_LANE_COUNT) {
    return true
  }

  if (options.dayContentWidthPx === null) {
    return true
  }

  const effectiveLaneWidth = (
    options.dayContentWidthPx - ((cluster.laneCount - 1) * options.laneGapPx)
  ) / cluster.laneCount

  if (effectiveLaneWidth < SCHEDULE_MIN_READABLE_LANE_WIDTH_PX) {
    return true
  }

  return cluster.entries.some((entry) =>
    getScheduleEntryTemporalHeightPx(entry, options.hourHeightPx) <
      SCHEDULE_MIN_READABLE_CARD_HEIGHT_PX,
  )
}

function mergeIntersectingDisclosureRanges<TGroup>(
  entries: readonly ScheduleCalendarEntry<TGroup>[],
  initialRanges: Array<{ startIndex: number; endIndex: number }>,
  options: ScheduleVisualDisclosureOptions,
) {
  let ranges = mergeRanges(initialRanges)
  let changed = true

  while (changed) {
    changed = false

    ranges = ranges.map((range) => {
      let nextRange = { ...range }
      let expanded = true

      while (expanded) {
        expanded = false

        if (
          nextRange.startIndex > 0 &&
          visualRectsIntersect(
            getDisclosureRangeRect(entries, nextRange, options),
            getEntryVisualRect(entries[nextRange.startIndex - 1], options.hourHeightPx),
          )
        ) {
          nextRange = {
            ...nextRange,
            startIndex: nextRange.startIndex - 1,
          }
          expanded = true
          changed = true
        }

        if (
          nextRange.endIndex < entries.length - 1 &&
          visualRectsIntersect(
            getDisclosureRangeRect(entries, nextRange, options),
            getEntryVisualRect(entries[nextRange.endIndex + 1], options.hourHeightPx),
          )
        ) {
          nextRange = {
            ...nextRange,
            endIndex: nextRange.endIndex + 1,
          }
          expanded = true
          changed = true
        }
      }

      return nextRange
    })

    const mergedRanges = mergeRanges(ranges)

    if (mergedRanges.length !== ranges.length) {
      changed = true
    }

    ranges = mergedRanges
  }

  return ranges
}

function mergeRanges(ranges: Array<{ startIndex: number; endIndex: number }>) {
  const sortedRanges = [...ranges].sort((first, second) =>
    first.startIndex - second.startIndex || first.endIndex - second.endIndex,
  )
  const mergedRanges: Array<{ startIndex: number; endIndex: number }> = []

  for (const range of sortedRanges) {
    const previousRange = mergedRanges.at(-1)

    if (!previousRange || range.startIndex > previousRange.endIndex) {
      mergedRanges.push({ ...range })
      continue
    }

    previousRange.endIndex = Math.max(previousRange.endIndex, range.endIndex)
  }

  return mergedRanges
}

function getDisclosureRangeRect<TGroup>(
  entries: readonly ScheduleCalendarEntry<TGroup>[],
  range: { startIndex: number; endIndex: number },
  options: ScheduleVisualDisclosureOptions,
) {
  const rangeEntries = entries.slice(range.startIndex, range.endIndex + 1)
  const topMinutes = Math.min(...rangeEntries.map((entry) => entry.startMinutes))
  const bottomMinutes = Math.max(...rangeEntries.map((entry) => entry.endMinutes))
  const key = buildScheduleDisclosureKey(rangeEntries, topMinutes, bottomMinutes)
  const top = (topMinutes / 60) * options.hourHeightPx
  const temporalHeight = ((bottomMinutes - topMinutes) / 60) * options.hourHeightPx
  const measuredHeight = options.disclosureNaturalHeightPxByKey?.get(key) ?? 0

  return {
    top,
    bottom: top + Math.max(
      SCHEDULE_MIN_VISUAL_CARD_HEIGHT_PX,
      temporalHeight,
      measuredHeight,
    ),
  }
}

function getEntryVisualRect<TGroup>(
  entry: ScheduleCalendarEntry<TGroup>,
  hourHeightPx: number,
) {
  return toVisualRect(entry.startMinutes, entry.endMinutes, hourHeightPx)
}

function toVisualRect(
  startMinutes: number,
  endMinutes: number,
  hourHeightPx: number,
) {
  const top = (startMinutes / 60) * hourHeightPx
  const naturalBottom = (endMinutes / 60) * hourHeightPx

  return {
    top,
    bottom: Math.max(top + SCHEDULE_MIN_VISUAL_CARD_HEIGHT_PX, naturalBottom),
  }
}

function visualRectsIntersect(
  first: { top: number; bottom: number },
  second: { top: number; bottom: number },
) {
  return first.top < second.bottom && second.top < first.bottom
}

function getScheduleEntryTemporalHeightPx<TGroup>(
  entry: ScheduleCalendarEntry<TGroup>,
  hourHeightPx: number,
) {
  return ((entry.endMinutes - entry.startMinutes) / 60) * hourHeightPx
}

function buildScheduleDisclosureKey<TGroup>(
  entries: readonly ScheduleCalendarEntry<TGroup>[],
  startMinutes: number,
  endMinutes: number,
) {
  const entryKeys = entries.map((entry) => entry.key).sort((first, second) =>
    first.localeCompare(second, 'ru'),
  )
  const weekday = entries[0]?.weekday ?? 0

  return [
    'schedule-disclosure',
    weekday,
    startMinutes,
    endMinutes,
    ...entryKeys,
  ].join('__')
}

function finalizeCluster<TGroup>(
  entries: readonly ScheduleCalendarEntry<TGroup>[],
  laneCount: number,
) {
  for (const entry of entries) {
    entry.laneCount = laneCount
  }
}

function compareScheduleCalendarEntries<TGroup extends Pick<
  TrainingGroupListItem,
  'name' | 'trainingStartTime'
>>(
  first: ScheduleCalendarEntry<TGroup>,
  second: ScheduleCalendarEntry<TGroup>,
) {
  const startTimeCompare = first.startMinutes - second.startMinutes

  if (startTimeCompare !== 0) {
    return startTimeCompare
  }

  const groupCompare = compareScheduleGroups(first.group, second.group)

  if (groupCompare !== 0) {
    return groupCompare
  }

  const endTimeCompare = first.endMinutes - second.endMinutes

  if (endTimeCompare !== 0) {
    return endTimeCompare
  }

  return 0
}

function compareScheduleCalendarEntriesByTime<TGroup>(
  first: ScheduleCalendarEntry<TGroup>,
  second: ScheduleCalendarEntry<TGroup>,
) {
  return first.startMinutes - second.startMinutes ||
    first.endMinutes - second.endMinutes ||
    first.key.localeCompare(second.key, 'ru')
}

function compareScheduleGroups<TGroup extends Pick<
  TrainingGroupListItem,
  'name' | 'trainingStartTime'
>>(first: TGroup, second: TGroup) {
  const firstTime = parseTrainingStartTime(first.trainingStartTime)
  const secondTime = parseTrainingStartTime(second.trainingStartTime)

  if (firstTime && secondTime) {
    const timeCompare = firstTime.totalMinutes - secondTime.totalMinutes

    if (timeCompare !== 0) {
      return timeCompare
    }
  } else {
    const timeCompare = first.trainingStartTime.localeCompare(second.trainingStartTime)

    if (timeCompare !== 0) {
      return timeCompare
    }
  }

  return first.name.localeCompare(second.name, 'ru')
}

function toSortedOptions(options: ScheduleFilterOption[]) {
  const uniqueOptions = new Map<string, ScheduleFilterOption>()

  for (const option of options) {
    if (!option.value) {
      continue
    }

    if (!uniqueOptions.has(option.value)) {
      uniqueOptions.set(option.value, option)
    }
  }

  return [...uniqueOptions.values()].sort((first, second) =>
    first.label.localeCompare(second.label, 'ru'),
  )
}

function buildScheduleHallLoad<TGroup extends Pick<
  ScheduleGroupLike,
  'hallId' | 'hallName'
>>(
  entries: readonly ScheduleCalendarEntry<TGroup>[],
): ScheduleHallLoadItem[] {
  const items = new Map<string, ScheduleHallLoadItem>()

  for (const entry of entries) {
    const key = entry.group.hallId.trim() || 'unknown'
    const label = entry.group.hallName.trim() || fe17SharedRoutingThemeText.groupSchedule_string_0b7f45bb
    const existingItem = items.get(key)

    if (existingItem) {
      existingItem.count += 1
      existingItem.totalMinutes += Math.max(0, entry.endMinutes - entry.startMinutes)
      continue
    }

    items.set(key, {
      key,
      label,
      count: 1,
      totalMinutes: Math.max(0, entry.endMinutes - entry.startMinutes),
    })
  }

  return [...items.values()].sort((first, second) => {
    const countCompare = second.count - first.count

    return countCompare === 0
      ? first.label.localeCompare(second.label, 'ru')
      : countCompare
  })
}

function formatMinutesAsTime(totalMinutes: number) {
  const normalizedMinutes = Math.max(0, totalMinutes)
  const hours = Math.floor(normalizedMinutes / 60)
  const minutes = normalizedMinutes % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function getLocalScheduleWeekStart(now: Date) {
  const weekStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  )
  const weekday = getCurrentScheduleWeekday(now)

  weekStart.setDate(weekStart.getDate() - (weekday - 1))

  return weekStart
}

function formatScheduleDateLabel(date: Date) {
  return [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
  ].join('.')
}

function getStablePaletteIndex(key: string) {
  let hash = 0

  for (const character of key) {
    hash = ((hash * 31) + character.charCodeAt(0)) >>> 0
  }

  return hash % SCHEDULE_TYPE_PALETTE.length
}
