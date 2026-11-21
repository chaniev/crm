import type {
  AttendanceClient, AttendanceTodayLesson, AuthenticatedUser, SaveAttendanceMarksRequest,
} from '../../../frontend/src/lib/api/types'
export { ApiError } from '../../../frontend/src/lib/api/errors'

export const today = '2026-11-20'

function occurrence(id: string, groupId: string, name: string, startTime: string, endTime: string,
  options: { date?: string; note?: string; readOnlyReason?: string } = {}) {
  return {
    lessonOccurrenceId: id, lessonDate: options.date ?? today, groupId, groupName: name,
    startTime, endTime, note: options.note, readOnlyReason: options.readOnlyReason,
  }
}

const juniors = 'Самбо · Юниоры'
export const lessons = [
  occurrence('morning', 'juniors', juniors, '08:00', '09:00'),
  occurrence('single', 'beginners', 'Дзюдо · Начальная подготовка', '08:00', '09:00', { note: 'Разовое занятие' }),
  occurrence('evening', 'juniors', juniors, '18:30', '19:30', { note: 'Перенесено с 17:00 на 18:30' }),
  occurrence('long', 'senior', 'Спортивная гимнастика · Старшая группа углублённой подготовки к соревнованиям', '19:00', '20:30'),
  occurrence('future', 'juniors', juniors, '10:00', '11:00', { date: '2026-11-21', readOnlyReason: 'future-lesson' }),
]
export type Lesson = (typeof lessons)[number]

export const user: AuthenticatedUser = {
  id: 'coach', login: 'demo', fullName: 'Главный тренер', role: 'HeadCoach', isActive: true,
  mustChangePassword: false, landingScreen: 'Attendance', allowedSections: ['Attendance', 'Schedule'],
  permissions: { canManageUsers: false, canManageClients: true, canManageGroups: true, canManageSettings: false,
    canMarkAttendance: true, canViewAuditLog: false, canViewFinancialReports: false },
  assignedGroupIds: [], attendanceScope: { kind: 'Global', groupIds: [] }, branchId: null,
}

const names = ['Волков Максим Дмитриевич', 'Власова Мария Олеговна', 'Кузнецов Дмитрий Александрович', 'Лебедева Анна Игоревна']
const rosters = new Map(lessons.map(lesson => [lesson.lessonOccurrenceId, names.map((fullName, i): AttendanceClient => ({
  id: 'client-' + i, fullName, state: 'Unmarked', groups: [], photo: null, currentMemberships: [],
  isProfessional: false, professionalComment: null, hasActiveMembership: i !== 0, membershipWarning: i === 0,
}))]))

export function findLesson(id: string, date: string) {
  return lessons.find(lesson => lesson.lessonOccurrenceId === id && lesson.lessonDate === date)
}

export async function getAttendanceTodayLessons() {
  const items: AttendanceTodayLesson[] = lessons.filter(lesson => lesson.lessonDate === today).map(lesson => ({
    ...lesson, branchName: 'Центральный', hallName: lesson.groupId === 'beginners' ? 'Зал 2' : 'Зал 1',
    effectiveTrainers: [{ trainerId: 'coach', fullName: 'Алексей Соколов', kind: 'Permanent' as const }],
    openAttendance: { allowed: true, reason: null },
    unmarkedClientCount: rosters.get(lesson.lessonOccurrenceId)!.filter(client => client.state === 'Unmarked').length,
  })).filter(lesson => lesson.unmarkedClientCount)
  return { today, items, partial: false }
}

export async function getScheduleLesson(id: string, date: string) {
  const lesson = findLesson(id, date)
  if (!lesson) throw new Error('Занятие недоступно.')
  return {
    ...lesson,
    allowedActions: {
      viewAttendance: { allowed: true, reason: null },
      editAttendance: { allowed: !lesson.readOnlyReason, reason: lesson.readOnlyReason ?? null },
    },
  }
}

export async function getAttendanceLessonClients(id: string, date: string) {
  const lesson = findLesson(id, date)
  if (!lesson) throw new Error('Занятие недоступно.')
  return {
    lessonOccurrenceId: id, lessonDate: date, trainingDate: date, today, groupId: lesson.groupId,
    minTrainingDate: null, maxTrainingDate: today,
    canEditAttendance: { allowed: !lesson.readOnlyReason, reason: lesson.readOnlyReason ?? null },
    clients: rosters.get(id)!.map(client => ({ ...client })),
  }
}

export async function saveAttendanceLessonMarks(id: string, payload: SaveAttendanceMarksRequest) {
  await new Promise(resolve => setTimeout(resolve, 350))
  const roster = await getAttendanceLessonClients(id, payload.trainingDate)
  if (!roster.canEditAttendance.allowed) throw new Error('Отметки недоступны.')
  for (const mark of payload.attendanceMarks) {
    const client = rosters.get(id)!.find(item => item.id === mark.clientId)
    if (client) client.state = mark.state
  }
  return { ...roster, attendanceMarks: payload.attendanceMarks }
}

// The review only mounts the occurrence path of AttendanceWorkspace.
function unsupported(): never { throw new Error('Сценарий вне прототипа TASK-205.') }
export { unsupported as getAttendanceGroups, unsupported as getAttendanceGroupClients, unsupported as saveAttendanceMarks }
