import {
  ApiError,
  getAttendanceLessonClients,
  getScheduleLesson,
  type AttendanceRosterResponse,
  type ScheduleLesson,
} from '../../lib/api'
import { fe4AttendanceText as text } from '../../resources/fe-4-attendance'

export class AttendanceLessonContextError extends Error {}

export function isLessonUnavailable(error: unknown) {
  return error instanceof ApiError && (error.status === 403 || error.status === 404)
}

export function matchesLessonRoster(lesson: ScheduleLesson, roster: AttendanceRosterResponse) {
  return roster.groupId === lesson.groupId &&
    roster.trainingDate === lesson.lessonDate &&
    (roster.lessonDate === undefined || roster.lessonDate === lesson.lessonDate) &&
    (roster.lessonOccurrenceId === undefined || roster.lessonOccurrenceId === lesson.lessonOccurrenceId)
}

export async function readAttendanceLesson(id: string, date: string, signal: AbortSignal) {
  const [detail, roster] = await Promise.allSettled([
    getScheduleLesson(id, date, signal),
    getAttendanceLessonClients(id, date, signal),
  ])

  if ((detail.status === 'rejected' && isLessonUnavailable(detail.reason)) ||
      (roster.status === 'rejected' && isLessonUnavailable(roster.reason)) ||
      (detail.status === 'fulfilled' && detail.value?.allowedActions?.viewAttendance?.allowed === false)) {
    return null
  }
  if (detail.status === 'rejected') throw detail.reason
  if (roster.status === 'rejected') throw roster.reason

  const lesson = detail.value
  const clockTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/
  if (!lesson || lesson.lessonOccurrenceId !== id || lesson.lessonDate !== date ||
      !lesson.groupId || !lesson.groupName?.trim() ||
      !clockTime.test(lesson.startTime) || !clockTime.test(lesson.endTime) ||
      lesson.allowedActions?.viewAttendance?.allowed !== true ||
      typeof lesson.allowedActions.editAttendance?.allowed !== 'boolean' ||
      !matchesLessonRoster(lesson, roster.value)) {
    throw new AttendanceLessonContextError(text.lessonLoadError)
  }

  return { lesson, roster: roster.value }
}

export function getLessonEditDeniedReason(lesson: ScheduleLesson, roster: Pick<AttendanceRosterResponse, 'canEditAttendance' | 'today'>) {
  const denial = !lesson.allowedActions.editAttendance.allowed
    ? lesson.allowedActions.editAttendance
    : roster.canEditAttendance
  if (!denial || denial.allowed) return null
  if (lesson.lessonDate > roster.today) return text.attendanceScreen_string_e978a33c
  if (denial.reason === 'lesson-cancelled') return text.attendanceScreen_string_cbea104a
  return text.lessonReadOnly
}
