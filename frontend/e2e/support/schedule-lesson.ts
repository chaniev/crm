import type { ScheduleLesson } from '../../src/lib/api'

export function lesson(overrides: Partial<ScheduleLesson>): ScheduleLesson {
  return {
    lessonOccurrenceId: 'occ-morning',
    sourceKind: 'Recurring',
    isMaterialized: false,
    lessonSeriesId: 'series-1',
    lessonDate: '2026-08-20',
    startTime: '08:00',
    durationMinutes: 50,
    endTime: '08:50',
    groupId: 'group-1',
    groupName: 'Утренняя база',
    groupTypeId: 'type-1',
    groupTypeName: 'Кардио',
    branchId: 'branch-1',
    branchName: 'Центр',
    hallId: 'hall-1',
    hallName: 'Основной зал',
    effectiveTrainers: [{
      trainerId: 'trainer-1',
      fullName: 'Алиса',
      kind: 'Permanent',
      replacedTrainerId: null,
      substitutionId: null,
    }],
    status: 'Scheduled',
    hasAttendanceMarks: false,
    allowedActions: buildAllowedActions(),
    revision: 'revision-1',
    ...overrides,
  }
}

export function buildAllowedActions(overrides: Partial<ScheduleLesson['allowedActions']> = {}) {
  return {
    viewAttendance: overrides.viewAttendance ?? { allowed: true, reason: null },
    editAttendance: overrides.editAttendance ?? { allowed: true, reason: null },
    edit: overrides.edit ?? { allowed: false, reason: 'not-wired' },
    move: overrides.move ?? { allowed: false, reason: 'not-wired' },
    cancel: overrides.cancel ?? { allowed: false, reason: 'not-wired' },
    restore: overrides.restore ?? { allowed: false, reason: 'not-cancelled' },
    assignTrainerSubstitution: overrides.assignTrainerSubstitution ?? { allowed: false, reason: 'not-wired' },
    cancelTrainerSubstitution: overrides.cancelTrainerSubstitution ?? { allowed: false, reason: 'no-substitution' },
  }
}
