import { describe, expect, test } from 'vitest'
import {
  readAttendanceTodayReturnSnapshot,
  withAttendanceTodayReturnSnapshot,
  withoutAttendanceTodayReturnSnapshot,
} from './attendanceTodayReturnState'

const snapshot = {
  version: 1 as const,
  anchorLessonOccurrenceId: 'occurrence-1',
  nextLessonOccurrenceId: 'occurrence-2',
  scrollY: 320,
}

describe('attendanceTodayReturnState', () => {
  test('merges and reads a valid snapshot without losing unrelated route state', () => {
    const state = withAttendanceTodayReturnSnapshot({ routeKey: 'source' }, snapshot)

    expect(readAttendanceTodayReturnSnapshot(state)).toEqual(snapshot)
    expect(state.routeKey).toBe('source')
  })

  test('strips only the attendance snapshot', () => {
    const state = withAttendanceTodayReturnSnapshot({ routeKey: 'source' }, snapshot)

    expect(withoutAttendanceTodayReturnSnapshot(state)).toEqual({ routeKey: 'source' })
  })

  test('rejects malformed or unsafe snapshots', () => {
    expect(readAttendanceTodayReturnSnapshot({ attendanceTodayReturn: { ...snapshot, scrollY: -1 } })).toBeNull()
    expect(readAttendanceTodayReturnSnapshot({ attendanceTodayReturn: { ...snapshot, version: 2 } })).toBeNull()
  })
})
