import type { AppRoute, ParsedRoute } from '../../lib/appRoutes'

const KEY = 'crmGroupScheduleReturn'
export type GroupScheduleReturnContext = {
  version: 1
  kind: 'groupEdit'
  groupId: string
  seriesId: string
  originEntryKey: string
  entry: 'group' | 'editor'
  scrollY: number
}

export type SeriesEditorOrigin =
  | { kind: 'groupEdit'; context: GroupScheduleReturnContext }
  | { kind: 'lesson'; lessonOccurrenceId: string; lessonDate: string }
  | { kind: 'calendar' }

export function createGroupScheduleReturnContext(groupId: string, seriesId: string, scrollY: number): GroupScheduleReturnContext {
  return { version: 1, kind: 'groupEdit', groupId, seriesId,
    originEntryKey: `group-schedule:${crypto.randomUUID()}`, entry: 'group', scrollY: Math.max(0, scrollY) }
}

export function readGroupScheduleReturnContext(historyState: unknown, route: ParsedRoute): GroupScheduleReturnContext | null {
  if (!isRecord(historyState)) return null
  const value = historyState[KEY]
  if (!isRecord(value) || value.version !== 1 || value.kind !== 'groupEdit' ||
    !isIdentifier(value.groupId) || !isIdentifier(value.seriesId) || !isIdentifier(value.originEntryKey) ||
    !value.originEntryKey.startsWith('group-schedule:') ||
    typeof value.scrollY !== 'number' || !Number.isFinite(value.scrollY) || value.scrollY < 0) return null
  const matches = (value.entry === 'group' && route.kind === 'groupEdit' && route.groupId === value.groupId) ||
    (value.entry === 'editor' && route.kind === 'scheduleSeriesEdit' &&
      route.groupId === value.groupId && route.lessonSeriesId === value.seriesId)
  if (!matches) return null
  return { version: 1, kind: 'groupEdit', groupId: value.groupId, seriesId: value.seriesId,
    originEntryKey: value.originEntryKey, entry: value.entry as 'group' | 'editor', scrollY: value.scrollY }
}

export function mergeGroupScheduleReturnContext(historyState: unknown, context: GroupScheduleReturnContext) {
  return { ...(isRecord(historyState) ? historyState : {}), [KEY]: context }
}

export function stripGroupScheduleReturnContext(historyState: unknown) {
  const state = { ...(isRecord(historyState) ? historyState : {}) }
  delete state[KEY]
  return state
}

export function resolveSeriesEditorOrigin(route: Extract<AppRoute, { kind: 'scheduleSeriesEdit' }>, state: unknown): SeriesEditorOrigin {
  const context = readGroupScheduleReturnContext(state, route)
  if (context) return { kind: 'groupEdit', context }
  if (route.lessonOccurrenceId && route.lessonDate) {
    return { kind: 'lesson', lessonOccurrenceId: route.lessonOccurrenceId, lessonDate: route.lessonDate }
  }
  return { kind: 'calendar' }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 200 && value.trim() === value
}
