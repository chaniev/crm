import type { ScheduleLesson } from '../../lib/api'

export type ScheduleTimeGroup = {
  id: string
  startTime: string
  endTime: string
  /** Exact interval label, e.g. `08:00-08:50`, used as the group heading. */
  label: string
  lessons: ScheduleLesson[]
}

/**
 * Groups one day's occurrences by the exact `(startTime, endTime)` pair.
 * The input is expected to be sorted chronologically already; grouping preserves
 * that order and keeps every occurrence a separate card identity.
 */
export function buildScheduleTimeGroups(
  date: string,
  lessons: readonly ScheduleLesson[],
): ScheduleTimeGroup[] {
  const groups = new Map<string, ScheduleTimeGroup>()

  for (const lesson of lessons) {
    const key = `${lesson.startTime}|${lesson.endTime}`
    const existing = groups.get(key)
    if (existing) {
      existing.lessons.push(lesson)
      continue
    }

    groups.set(key, {
      id: getScheduleTimeGroupAnchorId(date, lesson.startTime, lesson.endTime),
      startTime: lesson.startTime,
      endTime: lesson.endTime,
      label: formatInterval(lesson.startTime, lesson.endTime),
      lessons: [lesson],
    })
  }

  return [...groups.values()].sort((first, second) =>
    first.startTime.localeCompare(second.startTime) ||
    first.endTime.localeCompare(second.endTime),
  )
}

export function getScheduleTimeGroupAnchorId(
  date: string,
  startTime: string,
  endTime: string,
) {
  return `schedule-time-group-${date}-${trimSeconds(startTime)}-${trimSeconds(endTime)}`
}

export function getScheduleCardAnchorId(lessonOccurrenceId: string) {
  return `schedule-card-anchor-${lessonOccurrenceId}`
}

function formatInterval(startTime: string, endTime: string) {
  return `${trimSeconds(startTime)}-${trimSeconds(endTime)}`
}

function trimSeconds(value: string) {
  return value.match(/^\d{2}:\d{2}/)?.[0] ?? value
}
