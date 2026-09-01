export type AttendanceTodayReturnSnapshot = {
  version: 1
  anchorLessonOccurrenceId: string
  nextLessonOccurrenceId: string | null
  scrollY: number
}

const ATTENDANCE_TODAY_RETURN_KEY = 'attendanceTodayReturn'

export function readAttendanceTodayReturnSnapshot(
  state: unknown = window.history.state,
): AttendanceTodayReturnSnapshot | null {
  if (!isRecord(state)) {
    return null
  }

  const snapshot = state[ATTENDANCE_TODAY_RETURN_KEY]
  if (
    !isRecord(snapshot) ||
    snapshot.version !== 1 ||
    typeof snapshot.anchorLessonOccurrenceId !== 'string' ||
    !snapshot.anchorLessonOccurrenceId ||
    (snapshot.nextLessonOccurrenceId !== null &&
      typeof snapshot.nextLessonOccurrenceId !== 'string') ||
    typeof snapshot.scrollY !== 'number' ||
    !Number.isFinite(snapshot.scrollY) ||
    snapshot.scrollY < 0
  ) {
    return null
  }

  return snapshot as AttendanceTodayReturnSnapshot
}

export function withAttendanceTodayReturnSnapshot(
  state: unknown,
  snapshot: AttendanceTodayReturnSnapshot,
): Record<string, unknown> {
  return {
    ...(isRecord(state) ? state : {}),
    [ATTENDANCE_TODAY_RETURN_KEY]: snapshot,
  }
}

export function withoutAttendanceTodayReturnSnapshot(
  state: unknown,
): Record<string, unknown> | null {
  if (!isRecord(state)) {
    return null
  }

  const nextState = { ...state }
  delete nextState[ATTENDANCE_TODAY_RETURN_KEY]
  return Object.keys(nextState).length > 0 ? nextState : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
