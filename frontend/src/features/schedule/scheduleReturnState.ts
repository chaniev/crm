const SCHEDULE_RETURN_STATE_KEY = 'crmScheduleReturnState'
const SCHEDULE_RETURN_STATE_VERSION = 1
const MAX_RETURN_DEPTH = 8

export type ScheduleReturnFocusTarget = 'card' | 'time-group' | 'board'

export type ScheduleReturnSnapshot = {
  version: typeof SCHEDULE_RETURN_STATE_VERSION
  /** Full schedule list URL including `date`, `view` and filter params. */
  path: string
  timeGroupAnchorId: string | null
  cardAnchorId: string | null
  scrollY: number
  focusTarget: ScheduleReturnFocusTarget
  originEntryKey: string
  returnDepth: number
}

type ScheduleReturnStateShape = {
  [SCHEDULE_RETURN_STATE_KEY]?: unknown
}

/**
 * Captures the current schedule origin (URL, anchors, scroll) from the live
 * document. Must be called while the schedule screen is the active entry.
 */
export function createScheduleReturnSnapshot(
  lessonOccurrenceId?: string | null,
  options: {
    timeGroupAnchorId?: string | null
    focusTarget?: ScheduleReturnFocusTarget
    originEntryKey?: string
    returnDepth?: number
  } = {},
): ScheduleReturnSnapshot {
  const path = `${window.location.pathname}${window.location.search}`

  return {
    version: SCHEDULE_RETURN_STATE_VERSION,
    path,
    timeGroupAnchorId: sanitizeOptionalString(options.timeGroupAnchorId ?? null),
    cardAnchorId: lessonOccurrenceId
      ? `schedule-card-anchor-${lessonOccurrenceId}`
      : sanitizeOptionalString(null),
    scrollY: sanitizeScrollY(window.scrollY),
    focusTarget: options.focusTarget ?? (lessonOccurrenceId ? 'card' : 'board'),
    originEntryKey: sanitizeEntryKey(options.originEntryKey) ?? createScheduleEntryKey(),
    returnDepth: sanitizeReturnDepth(options.returnDepth ?? 0),
  }
}

export function readScheduleReturnSnapshot(
  historyState: unknown,
): ScheduleReturnSnapshot | null {
  if (!isRecord(historyState)) {
    return null
  }

  return parseScheduleReturnSnapshot(historyState[SCHEDULE_RETURN_STATE_KEY])
}

export function mergeScheduleReturnSnapshotIntoHistoryState(
  historyState: unknown,
  snapshot: ScheduleReturnSnapshot,
) {
  return {
    ...copyHistoryStateRecord(historyState),
    [SCHEDULE_RETURN_STATE_KEY]: serializeScheduleReturnSnapshot(snapshot),
  }
}

export function stripScheduleReturnSnapshotFromHistoryState(historyState: unknown) {
  const nextState = copyHistoryStateRecord(historyState) as ScheduleReturnStateShape
  delete nextState[SCHEDULE_RETURN_STATE_KEY]
  return nextState
}

export function withScheduleReturnDepth(
  snapshot: ScheduleReturnSnapshot,
  returnDepth: number,
) {
  return {
    ...snapshot,
    returnDepth: sanitizeReturnDepth(returnDepth),
  }
}

export function getScheduleReturnPath(snapshot: ScheduleReturnSnapshot) {
  return snapshot.path
}

export function isScheduleSectionPath(pathname: string) {
  return pathname === '/schedule' || pathname.startsWith('/schedule?')
}

export function createScheduleEntryKey() {
  const randomValue =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)

  return `schedule:${Date.now().toString(36)}:${randomValue}`
}

function parseScheduleReturnSnapshot(payload: unknown): ScheduleReturnSnapshot | null {
  if (!isRecord(payload) || payload.version !== SCHEDULE_RETURN_STATE_VERSION) {
    return null
  }

  const path = typeof payload.path === 'string' ? payload.path : ''
  if (!isScheduleSectionPath(path)) {
    return null
  }

  const originEntryKey = sanitizeEntryKey(payload.originEntryKey)
  if (!originEntryKey) {
    return null
  }

  return {
    version: SCHEDULE_RETURN_STATE_VERSION,
    path,
    timeGroupAnchorId: sanitizeOptionalString(payload.timeGroupAnchorId),
    cardAnchorId: sanitizeOptionalString(payload.cardAnchorId),
    scrollY: sanitizeScrollY(payload.scrollY),
    focusTarget: sanitizeFocusTarget(payload.focusTarget),
    originEntryKey,
    returnDepth: sanitizeReturnDepth(payload.returnDepth),
  }
}

function serializeScheduleReturnSnapshot(snapshot: ScheduleReturnSnapshot) {
  return {
    version: snapshot.version,
    path: snapshot.path,
    timeGroupAnchorId: snapshot.timeGroupAnchorId,
    cardAnchorId: snapshot.cardAnchorId,
    scrollY: snapshot.scrollY,
    focusTarget: snapshot.focusTarget,
    originEntryKey: snapshot.originEntryKey,
    returnDepth: snapshot.returnDepth,
  }
}

function sanitizeOptionalString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function sanitizeEntryKey(value: unknown) {
  const trimmed = sanitizeOptionalString(value)
  return trimmed && trimmed.length <= 200 ? trimmed : null
}

function sanitizeScrollY(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : 0
}

function sanitizeReturnDepth(value: unknown) {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return 0
  }

  return Math.min(value, MAX_RETURN_DEPTH)
}

function sanitizeFocusTarget(value: unknown): ScheduleReturnFocusTarget {
  return value === 'card' || value === 'time-group' ? value : 'board'
}

function copyHistoryStateRecord(historyState: unknown) {
  return isRecord(historyState) ? { ...historyState } : {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
