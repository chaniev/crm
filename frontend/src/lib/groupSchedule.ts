import type { TrainingGroupListItem } from './api'

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const

export type WeekdayNumber = (typeof WEEKDAYS)[number]

export type GroupScheduleDay<TGroup = TrainingGroupListItem> = {
  weekday: WeekdayNumber
  label: string
  entries: TGroup[]
}

export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Пн',
  2: 'Вт',
  3: 'Ср',
  4: 'Чт',
  5: 'Пт',
  6: 'Сб',
  7: 'Вс',
}

export const WEEKDAY_OPTIONS = Object.entries(WEEKDAY_LABELS).map(
  ([value, label]) => ({
    value,
    label,
  }),
)

export function formatWeekdays(weekdays?: readonly number[] | null) {
  if (!weekdays || weekdays.length === 0) {
    return 'Дни не заданы'
  }

  return weekdays
    .map((weekday) => WEEKDAY_LABELS[weekday] ?? String(weekday))
    .join(', ')
}

export function formatDurationMinutes(durationMinutes?: number | null) {
  if (typeof durationMinutes !== 'number') {
    return 'Длительность не задана'
  }

  return `${durationMinutes} мин`
}

export function formatTrainingStartTime(trainingStartTime?: string | null) {
  const value = trainingStartTime?.trim()

  if (!value) {
    return 'Время не задано'
  }

  const match = value.match(/^(\d{1,2}):(\d{2})/)

  if (!match) {
    return value
  }

  return `${match[1].padStart(2, '0')}:${match[2]}`
}

export function formatGroupSchedule(
  weekdays?: readonly number[] | null,
  durationMinutes?: number | null,
) {
  return `${formatWeekdays(weekdays)} · ${formatDurationMinutes(durationMinutes)}`
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

function compareScheduleGroups<TGroup extends Pick<
  TrainingGroupListItem,
  'name' | 'trainingStartTime'
>>(first: TGroup, second: TGroup) {
  const timeCompare = first.trainingStartTime.localeCompare(second.trainingStartTime)

  if (timeCompare !== 0) {
    return timeCompare
  }

  return first.name.localeCompare(second.name, 'ru')
}
