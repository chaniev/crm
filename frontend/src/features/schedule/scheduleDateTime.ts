import type { ScheduleLesson } from '../../lib/api'
import { fe2ScheduleCoreText } from '../../resources/fe-2-schedule-core'

const DAY_MS = 24 * 60 * 60 * 1000

export function formatTimeRange(lesson: ScheduleLesson) {
  return `${trimSeconds(lesson.startTime)}-${trimSeconds(lesson.endTime)}`
}

export function trimSeconds(value: string) {
  return value.match(/^\d{2}:\d{2}/)?.[0] ?? value
}

export function formatWeekday(date: string) {
  return new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(parseIsoDate(date))
}

export function formatLongWeekday(date: string) {
  return new Intl.DateTimeFormat('ru-RU', { weekday: 'long' }).format(parseIsoDate(date))
}

export function formatShortDate(date: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(parseIsoDate(date))
}

export function formatLongDate(date: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(parseIsoDate(date))
}

export function formatExpiresAt(value: string) {
  const expiresAt = new Date(value)
  if (Number.isNaN(expiresAt.getTime())) {
    return fe2ScheduleCoreText.groupScheduleScreen_string_4371fe93
  }

  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(expiresAt)
}

export function todayIso() {
  return formatIsoDate(new Date())
}

export function isRealIsoDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  return formatIsoDate(parseIsoDate(value)) === value
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addIsoDays(value: string, days: number) {
  const date = parseIsoDate(value)
  date.setTime(date.getTime() + (days * DAY_MS))
  return formatIsoDate(date)
}

export function startOfIsoWeek(value: string) {
  const date = parseIsoDate(value)
  const weekday = date.getDay() === 0 ? 7 : date.getDay()
  date.setDate(date.getDate() - weekday + 1)
  return formatIsoDate(date)
}
