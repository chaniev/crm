import type { AppRoute } from '../../lib/appRoutes'
import {
  createDefaultGroupListFilters,
  normalizeGroupListFilters,
  normalizeGroupSearchQuery,
  sanitizePositivePage,
  type GroupListFilters,
} from './groupListQuery'

const GROUP_LIST_RETURN_STATE_KEY = 'crmGroupListReturnState'
const GROUP_LIST_RETURN_STATE_VERSION = 1
const MAX_RETURN_DEPTH = 8

export type GroupListReturnFocusTarget =
  | 'selected-group'
  | 'first-visible-row'
  | 'results-region'
  | 'recovery-action'

export type GroupListReturnSnapshot = {
  version: typeof GROUP_LIST_RETURN_STATE_VERSION
  filters: GroupListFilters
  searchDraft: string
  page: number
  selectedGroupId: string | null
  anchorGroupId: string | null
  scrollY: number
  focusTarget: GroupListReturnFocusTarget
  originEntryKey: string
  returnDepth: number
  ui: Record<string, never>
}

export type GroupListReturnSnapshotInput = {
  filters: GroupListFilters
  searchDraft: string
  page: number
  selectedGroupId: string | null
  anchorGroupId?: string | null
  scrollY: number
  focusTarget?: GroupListReturnFocusTarget
  originEntryKey: string
  returnDepth?: number
}

type GroupListReturnStateShape = {
  [GROUP_LIST_RETURN_STATE_KEY]?: unknown
}

export function readGroupListReturnSnapshot(historyState: unknown) {
  if (!isRecord(historyState)) {
    return null
  }

  return parseGroupListReturnSnapshot(historyState[GROUP_LIST_RETURN_STATE_KEY])
}

export function createGroupListReturnSnapshot(
  input: GroupListReturnSnapshotInput,
): GroupListReturnSnapshot {
  const filters = normalizeGroupListFilters(input.filters)
  const normalizedDraft = normalizeGroupSearchQuery(input.searchDraft)
  const hasPendingDraft = normalizedDraft !== filters.appliedQuery
  const appliedFilters = hasPendingDraft
    ? normalizeGroupListFilters({ ...filters, appliedQuery: normalizedDraft })
    : filters
  const selectedGroupId = sanitizeOptionalString(input.selectedGroupId)
  const anchorGroupId = sanitizeOptionalString(input.anchorGroupId ?? selectedGroupId)

  return {
    version: GROUP_LIST_RETURN_STATE_VERSION,
    filters: appliedFilters,
    searchDraft: appliedFilters.appliedQuery,
    page: hasPendingDraft ? 1 : sanitizePositivePage(input.page),
    selectedGroupId,
    anchorGroupId,
    scrollY: sanitizeScrollY(input.scrollY),
    focusTarget: input.focusTarget ?? (selectedGroupId ? 'selected-group' : 'results-region'),
    originEntryKey: sanitizeEntryKey(input.originEntryKey) ?? createGroupListEntryKey(),
    returnDepth: sanitizeReturnDepth(input.returnDepth ?? 0),
    ui: {},
  }
}

export function createDefaultGroupListReturnSnapshot() {
  return createGroupListReturnSnapshot({
    filters: createDefaultGroupListFilters(),
    searchDraft: '',
    page: 1,
    selectedGroupId: null,
    scrollY: 0,
    focusTarget: 'results-region',
    originEntryKey: createGroupListEntryKey(),
    returnDepth: 0,
  })
}

export function mergeGroupListReturnSnapshotIntoHistoryState(
  historyState: unknown,
  snapshot: GroupListReturnSnapshot,
) {
  return {
    ...copyHistoryStateRecord(historyState),
    [GROUP_LIST_RETURN_STATE_KEY]: serializeGroupListReturnSnapshot(snapshot),
  }
}

export function stripGroupListReturnSnapshotFromHistoryState(historyState: unknown) {
  const nextState = copyHistoryStateRecord(historyState) as GroupListReturnStateShape
  delete nextState[GROUP_LIST_RETURN_STATE_KEY]
  return nextState
}

export function getGroupListReturnHistoryStateForRoute(
  historyState: unknown,
  route: AppRoute,
  snapshot: GroupListReturnSnapshot | null,
) {
  if (!isGroupListReturnRoute(route) || !snapshot) {
    return stripGroupListReturnSnapshotFromHistoryState(historyState)
  }

  return mergeGroupListReturnSnapshotIntoHistoryState(historyState, snapshot)
}

export function isGroupListReturnRoute(route: AppRoute) {
  return (
    (route.kind === 'section' && route.section === 'Groups') ||
    route.kind === 'groupEdit'
  )
}

export function isGroupListOriginRoute(route: AppRoute) {
  return route.kind === 'section' && route.section === 'Groups'
}

export function withGroupListReturnDepth(
  snapshot: GroupListReturnSnapshot,
  returnDepth: number,
) {
  return {
    ...snapshot,
    returnDepth: sanitizeReturnDepth(returnDepth),
  }
}

export function getNextGroupListReturnDepth(
  currentRoute: AppRoute,
  snapshot: GroupListReturnSnapshot | null,
) {
  if (isGroupListOriginRoute(currentRoute)) {
    return 1
  }

  return sanitizeReturnDepth(snapshot?.returnDepth ?? 1)
}

export function createGroupListEntryKey() {
  const randomValue =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)

  return `groups:${Date.now().toString(36)}:${randomValue}`
}

function parseGroupListReturnSnapshot(payload: unknown) {
  if (!isRecord(payload) || payload.version !== GROUP_LIST_RETURN_STATE_VERSION) {
    return null
  }

  const originEntryKey = sanitizeEntryKey(payload.originEntryKey)
  if (!originEntryKey) {
    return null
  }

  return createGroupListReturnSnapshot({
    filters: sanitizeGroupListFilters(payload.filters),
    searchDraft: typeof payload.searchDraft === 'string' ? payload.searchDraft : '',
    page: sanitizePositivePage(payload.page),
    selectedGroupId: sanitizeOptionalString(payload.selectedGroupId),
    anchorGroupId: sanitizeOptionalString(payload.anchorGroupId),
    scrollY: sanitizeScrollY(payload.scrollY),
    focusTarget: sanitizeFocusTarget(payload.focusTarget),
    originEntryKey,
    returnDepth: sanitizeReturnDepth(payload.returnDepth),
  })
}

function serializeGroupListReturnSnapshot(snapshot: GroupListReturnSnapshot) {
  return {
    version: snapshot.version,
    filters: { ...snapshot.filters },
    searchDraft: snapshot.searchDraft,
    page: snapshot.page,
    selectedGroupId: snapshot.selectedGroupId,
    anchorGroupId: snapshot.anchorGroupId,
    scrollY: snapshot.scrollY,
    focusTarget: snapshot.focusTarget,
    originEntryKey: snapshot.originEntryKey,
    returnDepth: snapshot.returnDepth,
    ui: {},
  }
}

function sanitizeGroupListFilters(payload: unknown) {
  if (!isRecord(payload)) {
    return createDefaultGroupListFilters()
  }

  return normalizeGroupListFilters({
    appliedQuery:
      typeof payload.appliedQuery === 'string'
        ? payload.appliedQuery
        : '',
    isActive:
      typeof payload.isActive === 'boolean'
        ? payload.isActive
        : null,
    withoutTrainer:
      typeof payload.withoutTrainer === 'boolean'
        ? payload.withoutTrainer
        : false,
  })
}

function sanitizeFocusTarget(value: unknown): GroupListReturnFocusTarget {
  return value === 'selected-group' ||
    value === 'first-visible-row' ||
    value === 'results-region' ||
    value === 'recovery-action'
    ? value
    : 'results-region'
}

function sanitizeOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function sanitizeEntryKey(value: unknown) {
  const entryKey = sanitizeOptionalString(value)
  return entryKey?.startsWith('groups:') ? entryKey : null
}

function sanitizeScrollY(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0
}

function sanitizeReturnDepth(value: unknown) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return 0
  }

  return Math.min(value, MAX_RETURN_DEPTH)
}

function copyHistoryStateRecord(historyState: unknown) {
  return isRecord(historyState) ? { ...historyState } : {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
