const WEEKDAY_LABELS: Record<number, string> = {
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

export function formatGroupSchedule(
  weekdays?: readonly number[] | null,
  durationMinutes?: number | null,
) {
  return `${formatWeekdays(weekdays)} · ${formatDurationMinutes(durationMinutes)}`
}
