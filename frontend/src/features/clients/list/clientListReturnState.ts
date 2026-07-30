import type { AppRoute } from '../../../lib/appRoutes'
import {
  createDefaultClientListFilters,
  normalizeClientListFilters,
  type ClientListFilterValues,
} from './clientListFilters'

const CLIENT_LIST_RETURN_STATE_KEY = 'crmClientListReturnState'
const CLIENT_LIST_RETURN_STATE_VERSION = 1
const MAX_RETURN_DEPTH = 8

type ClientListReturnFocusTarget =
  | 'selected-client'
  | 'first-visible-row'
  | 'results-region'
  | 'recovery-action'

export type ClientListReturnSnapshot = {
  version: typeof CLIENT_LIST_RETURN_STATE_VERSION
  filters: ClientListFilterValues
  searchDraft: string
  page: number
  selectedClientId: string | null
  anchorClientId: string | null
  scrollY: number
  focusTarget: ClientListReturnFocusTarget
  originEntryKey: string
  returnDepth: number
  ui: Record<string, never>
}

export type ClientListReturnCapabilities = {
  canSeeWithoutGroup: boolean
}

export type ClientListReturnSnapshotInput = {
  filters: ClientListFilterValues
  searchDraft: string
  page: number
  selectedClientId: string | null
  anchorClientId?: string | null
  scrollY: number
  focusTarget?: ClientListReturnFocusTarget
  originEntryKey: string
  returnDepth?: number
}

type ClientListReturnStateShape = {
  [CLIENT_LIST_RETURN_STATE_KEY]?: unknown
}

export function readClientListReturnSnapshot(
  historyState: unknown,
  capabilities: ClientListReturnCapabilities,
) {
  if (!isRecord(historyState)) {
    return null
  }

  return parseClientListReturnSnapshot(
    historyState[CLIENT_LIST_RETURN_STATE_KEY],
    capabilities,
  )
}

export function createClientListReturnSnapshot(
  input: ClientListReturnSnapshotInput,
  capabilities: ClientListReturnCapabilities,
): ClientListReturnSnapshot {
  const filters = sanitizeClientListFilters(input.filters, capabilities)
  const normalizedDraft = normalizeSearchDraft(input.searchDraft)
  const hasPendingDraft = normalizedDraft !== filters.query
  const appliedFilters = hasPendingDraft
    ? sanitizeClientListFilters({ ...filters, query: normalizedDraft }, capabilities)
    : filters
  const selectedClientId = sanitizeOptionalString(input.selectedClientId)
  const anchorClientId = sanitizeOptionalString(input.anchorClientId ?? selectedClientId)

  return {
    version: CLIENT_LIST_RETURN_STATE_VERSION,
    filters: appliedFilters,
    searchDraft: appliedFilters.query,
    page: hasPendingDraft ? 1 : sanitizePositiveInteger(input.page, 1),
    selectedClientId,
    anchorClientId,
    scrollY: sanitizeScrollY(input.scrollY),
    focusTarget: input.focusTarget ?? (selectedClientId ? 'selected-client' : 'results-region'),
    originEntryKey: sanitizeEntryKey(input.originEntryKey) ?? createClientListEntryKey(),
    returnDepth: sanitizeReturnDepth(input.returnDepth ?? 0),
    ui: {},
  }
}

export function createDefaultClientListReturnSnapshot(
  capabilities: ClientListReturnCapabilities,
) {
  return createClientListReturnSnapshot(
    {
      filters: createDefaultClientListFilters(),
      searchDraft: '',
      page: 1,
      selectedClientId: null,
      scrollY: 0,
      focusTarget: 'results-region',
      originEntryKey: createClientListEntryKey(),
      returnDepth: 0,
    },
    capabilities,
  )
}

export function mergeClientListReturnSnapshotIntoHistoryState(
  historyState: unknown,
  snapshot: ClientListReturnSnapshot,
) {
  return {
    ...copyHistoryStateRecord(historyState),
    [CLIENT_LIST_RETURN_STATE_KEY]: serializeClientListReturnSnapshot(snapshot),
  }
}

export function stripClientListReturnSnapshotFromHistoryState(historyState: unknown) {
  const nextState = copyHistoryStateRecord(historyState) as ClientListReturnStateShape
  delete nextState[CLIENT_LIST_RETURN_STATE_KEY]
  return nextState
}

export function getClientListReturnHistoryStateForRoute(
  historyState: unknown,
  route: AppRoute,
  snapshot: ClientListReturnSnapshot | null,
) {
  if (!isClientListReturnRoute(route) || !snapshot) {
    return stripClientListReturnSnapshotFromHistoryState(historyState)
  }

  return mergeClientListReturnSnapshotIntoHistoryState(historyState, snapshot)
}

export function isClientListReturnRoute(route: AppRoute) {
  return (
    (route.kind === 'section' && route.section === 'Clients') ||
    route.kind === 'clientPreview' ||
    route.kind === 'clientDetails'
  )
}

export function isClientListOriginRoute(route: AppRoute) {
  return route.kind === 'section' && route.section === 'Clients'
}

export function withClientListReturnDepth(
  snapshot: ClientListReturnSnapshot,
  returnDepth: number,
) {
  return {
    ...snapshot,
    returnDepth: sanitizeReturnDepth(returnDepth),
  }
}

export function getNextClientListReturnDepth(
  currentRoute: AppRoute,
  snapshot: ClientListReturnSnapshot | null,
) {
  if (isClientListOriginRoute(currentRoute)) {
    return 1
  }

  if (currentRoute.kind === 'clientPreview') {
    return sanitizeReturnDepth((snapshot?.returnDepth ?? 1) + 1)
  }

  return sanitizeReturnDepth(snapshot?.returnDepth ?? 1)
}

export function createClientListEntryKey() {
  const randomValue =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)

  return `clients:${Date.now().toString(36)}:${randomValue}`
}

function parseClientListReturnSnapshot(
  payload: unknown,
  capabilities: ClientListReturnCapabilities,
) {
  if (!isRecord(payload) || payload.version !== CLIENT_LIST_RETURN_STATE_VERSION) {
    return null
  }

  const originEntryKey = sanitizeEntryKey(payload.originEntryKey)
  if (!originEntryKey) {
    return null
  }

  return createClientListReturnSnapshot(
    {
      filters: sanitizeClientListFilters(payload.filters, capabilities),
      searchDraft: typeof payload.searchDraft === 'string' ? payload.searchDraft : '',
      page: sanitizePositiveInteger(payload.page, 1),
      selectedClientId: sanitizeOptionalString(payload.selectedClientId),
      anchorClientId: sanitizeOptionalString(payload.anchorClientId),
      scrollY: sanitizeScrollY(payload.scrollY),
      focusTarget: sanitizeFocusTarget(payload.focusTarget),
      originEntryKey,
      returnDepth: sanitizeReturnDepth(payload.returnDepth),
    },
    capabilities,
  )
}

function serializeClientListReturnSnapshot(snapshot: ClientListReturnSnapshot) {
  return {
    version: snapshot.version,
    filters: { ...snapshot.filters },
    searchDraft: snapshot.searchDraft,
    page: snapshot.page,
    selectedClientId: snapshot.selectedClientId,
    anchorClientId: snapshot.anchorClientId,
    scrollY: snapshot.scrollY,
    focusTarget: snapshot.focusTarget,
    originEntryKey: snapshot.originEntryKey,
    returnDepth: snapshot.returnDepth,
    ui: {},
  }
}

function sanitizeClientListFilters(
  payload: unknown,
  capabilities: ClientListReturnCapabilities,
) {
  const defaults = createDefaultClientListFilters()

  if (!isRecord(payload)) {
    return defaults
  }

  return normalizeClientListFilters({
    query: typeof payload.query === 'string' ? payload.query : defaults.query,
    groupId:
      typeof payload.groupId === 'string' && payload.groupId.trim()
        ? payload.groupId
        : defaults.groupId,
    status: isClientStatusFilter(payload.status) ? payload.status : defaults.status,
    membershipExpiresFrom:
      typeof payload.membershipExpiresFrom === 'string'
        ? payload.membershipExpiresFrom
        : defaults.membershipExpiresFrom,
    membershipExpiresTo:
      typeof payload.membershipExpiresTo === 'string'
        ? payload.membershipExpiresTo
        : defaults.membershipExpiresTo,
    withoutPhoto:
      typeof payload.withoutPhoto === 'boolean'
        ? payload.withoutPhoto
        : defaults.withoutPhoto,
    withoutMembership:
      typeof payload.withoutMembership === 'boolean'
        ? payload.withoutMembership
        : defaults.withoutMembership,
    expiringSoon:
      typeof payload.expiringSoon === 'boolean'
        ? payload.expiringSoon
        : defaults.expiringSoon,
    withoutGroup:
      capabilities.canSeeWithoutGroup && typeof payload.withoutGroup === 'boolean'
        ? payload.withoutGroup
        : defaults.withoutGroup,
    trial: typeof payload.trial === 'boolean' ? payload.trial : defaults.trial,
    pageSize: typeof payload.pageSize === 'string' ? payload.pageSize : defaults.pageSize,
  })
}

function isClientStatusFilter(value: unknown) {
  return value === 'all' || value === 'Active' || value === 'Archived'
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

function sanitizePositiveInteger(value: unknown, fallback: number) {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    Number.isFinite(value) &&
    value > 0
    ? value
    : fallback
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

function sanitizeFocusTarget(value: unknown): ClientListReturnFocusTarget {
  if (
    value === 'selected-client' ||
    value === 'first-visible-row' ||
    value === 'results-region' ||
    value === 'recovery-action'
  ) {
    return value
  }

  return 'results-region'
}

function normalizeSearchDraft(value: string) {
  return value.trim()
}

function copyHistoryStateRecord(historyState: unknown) {
  return isRecord(historyState) ? { ...historyState } : {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
