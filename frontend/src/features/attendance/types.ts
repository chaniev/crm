import type { AttendanceClient, AttendanceState } from '../../lib/api'

export type AttendanceSaveState = 'idle' | 'pending' | 'saved' | 'failed'

export type AttendanceClientRowState = {
  client: AttendanceClient
  displayedState: AttendanceState
  persistedState: AttendanceState
  saveState: AttendanceSaveState
  attemptedState: AttendanceState | null
  errorMessage: string | null
}
