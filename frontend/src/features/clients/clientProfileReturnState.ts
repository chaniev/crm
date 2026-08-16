import type { AppRoute } from '../../lib/appRoutes'
import type { AttendanceRosterView } from '../attendance/AttendanceRosterViewControl'

const CLIENT_PROFILE_RETURN_STATE_KEY = 'crmClientProfileReturnContext'
const CLIENT_PROFILE_RETURN_STATE_VERSION = 1
const MAX_RETURN_DEPTH = 8
const MAX_STRING_LENGTH = 200

export type ClientProfileAttendanceOrigin = {
  kind: 'attendance'
  route: { kind: 'section'; section: 'Home' }
  groupId: string
  trainingDate: string
  rosterView: AttendanceRosterView
  anchorClientId: string
}

export type ClientProfileGroupEditOrigin = {
  kind: 'groupEdit'
  route: { kind: 'groupEdit'; groupId: string }
  anchorClientId: string
}

export type ClientProfileOrigin =
  | ClientProfileAttendanceOrigin
  | ClientProfileGroupEditOrigin

export type ClientProfileOriginInput = ClientProfileOrigin

export type ClientProfileReturnContext = {
  version: typeof CLIENT_PROFILE_RETURN_STATE_VERSION
  origin: ClientProfileOrigin
  originEntryKey: string
  returnDepth: number
}

export type ClientProfileReturnContextInput = {
  origin: ClientProfileOriginInput
  originEntryKey?: string
  returnDepth?: number
}

type ClientProfileReturnStateShape = {
  [CLIENT_PROFILE_RETURN_STATE_KEY]?: unknown
}

export function createClientProfileReturnContext(
  input: ClientProfileReturnContextInput,
): ClientProfileReturnContext {
  const origin = sanitizeOrigin(input.origin)

  if (!origin) {
    throw new Error('Invalid client profile return origin.')
  }

  return {
    version: CLIENT_PROFILE_RETURN_STATE_VERSION,
    origin,
    originEntryKey:
      sanitizeEntryKey(input.originEntryKey) ?? createClientProfileEntryKey(origin.kind),
    returnDepth: sanitizeReturnDepth(input.returnDepth ?? 0),
  }
}

export function readClientProfileReturnContext(
  historyState: unknown,
): ClientProfileReturnContext | null {
  if (!isRecord(historyState)) {
    return null
  }

  return parseClientProfileReturnContext(
    historyState[CLIENT_PROFILE_RETURN_STATE_KEY],
  )
}

export function mergeClientProfileReturnContextIntoHistoryState(
  historyState: unknown,
  context: ClientProfileReturnContext,
) {
  return {
    ...copyHistoryStateRecord(historyState),
    [CLIENT_PROFILE_RETURN_STATE_KEY]: serializeClientProfileReturnContext(context),
  }
}

export function stripClientProfileReturnContextFromHistoryState(historyState: unknown) {
  const nextState = copyHistoryStateRecord(historyState) as ClientProfileReturnStateShape
  delete nextState[CLIENT_PROFILE_RETURN_STATE_KEY]
  return nextState
}

export function getClientProfileReturnHistoryStateForRoute(
  historyState: unknown,
  route: AppRoute,
  context: ClientProfileReturnContext | null,
) {
  if (!context || !isClientProfileReturnRoute(route, context)) {
    return stripClientProfileReturnContextFromHistoryState(historyState)
  }

  return mergeClientProfileReturnContextIntoHistoryState(historyState, context)
}

export function getClientProfileOriginRoute(context: ClientProfileReturnContext) {
  return context.origin.route
}

export function withClientProfileReturnDepth(
  context: ClientProfileReturnContext,
  returnDepth: number,
): ClientProfileReturnContext {
  return {
    ...context,
    returnDepth: sanitizeReturnDepth(returnDepth),
  }
}

export function getNextClientProfileReturnDepth(
  currentRoute: AppRoute,
  context: ClientProfileReturnContext | null,
) {
  if (!context) {
    return 1
  }

  if (isClientProfileOriginRoute(currentRoute, context)) {
    return 1
  }

  if (isClientProfileScopedRoute(currentRoute, context)) {
    return sanitizeReturnDepth(context.returnDepth + 1)
  }

  return sanitizeReturnDepth(context.returnDepth || 1)
}

export function isClientProfileScopedRoute(
  route: AppRoute,
  context: ClientProfileReturnContext,
) {
  return (
    (route.kind === 'clientDetails' || route.kind === 'clientEdit') &&
    route.clientId === context.origin.anchorClientId
  )
}

export function isClientProfileOriginRoute(
  route: AppRoute,
  context: ClientProfileReturnContext,
) {
  if (context.origin.kind === 'attendance') {
    return route.kind === 'section' && route.section === 'Home'
  }

  return route.kind === 'groupEdit' && route.groupId === context.origin.route.groupId
}

function isClientProfileReturnRoute(
  route: AppRoute,
  context: ClientProfileReturnContext,
) {
  return (
    isClientProfileOriginRoute(route, context) ||
    isClientProfileScopedRoute(route, context)
  )
}

function parseClientProfileReturnContext(
  payload: unknown,
): ClientProfileReturnContext | null {
  if (
    !isRecord(payload) ||
    payload.version !== CLIENT_PROFILE_RETURN_STATE_VERSION
  ) {
    return null
  }

  const origin = sanitizeOrigin(payload.origin)
  const originEntryKey = sanitizeEntryKey(payload.originEntryKey)
  const returnDepth = sanitizeReturnDepth(payload.returnDepth)

  if (!origin || !originEntryKey || returnDepth !== payload.returnDepth) {
    return null
  }

  return {
    version: CLIENT_PROFILE_RETURN_STATE_VERSION,
    origin,
    originEntryKey,
    returnDepth,
  }
}

function serializeClientProfileReturnContext(context: ClientProfileReturnContext) {
  return {
    version: context.version,
    origin: { ...context.origin, route: { ...context.origin.route } },
    originEntryKey: context.originEntryKey,
    returnDepth: context.returnDepth,
  }
}

function sanitizeOrigin(payload: unknown): ClientProfileOrigin | null {
  if (!isRecord(payload)) {
    return null
  }

  if (payload.kind === 'attendance') {
    const route = sanitizeAttendanceRoute(payload.route)
    const groupId = sanitizeRequiredString(payload.groupId)
    const trainingDate = sanitizeIsoDate(payload.trainingDate)
    const rosterView = sanitizeRosterView(payload.rosterView)
    const anchorClientId = sanitizeRequiredString(payload.anchorClientId)

    if (!route || !groupId || !trainingDate || !rosterView || !anchorClientId) {
      return null
    }

    return {
      kind: 'attendance',
      route,
      groupId,
      trainingDate,
      rosterView,
      anchorClientId,
    }
  }

  if (payload.kind === 'groupEdit') {
    const route = sanitizeGroupEditRoute(payload.route)
    const anchorClientId = sanitizeRequiredString(payload.anchorClientId)

    if (!route || !anchorClientId) {
      return null
    }

    return {
      kind: 'groupEdit',
      route,
      anchorClientId,
    }
  }

  return null
}

function sanitizeAttendanceRoute(payload: unknown): ClientProfileAttendanceOrigin['route'] | null {
  if (
    isRecord(payload) &&
    payload.kind === 'section' &&
    payload.section === 'Home'
  ) {
    return { kind: 'section', section: 'Home' }
  }

  return null
}

function sanitizeGroupEditRoute(payload: unknown): ClientProfileGroupEditOrigin['route'] | null {
  if (!isRecord(payload) || payload.kind !== 'groupEdit') {
    return null
  }

  const groupId = sanitizeRequiredString(payload.groupId)
  return groupId ? { kind: 'groupEdit', groupId } : null
}

function sanitizeRequiredString(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed && trimmed.length <= MAX_STRING_LENGTH ? trimmed : null
}

function sanitizeEntryKey(value: unknown) {
  const trimmed = sanitizeRequiredString(value)
  return trimmed?.startsWith('client-profile:') ? trimmed : null
}

function sanitizeIsoDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }

  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? null
    : value
}

function sanitizeRosterView(value: unknown): AttendanceRosterView | null {
  return value === 'all' || value === 'unmarked' ? value : null
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

function createClientProfileEntryKey(kind: ClientProfileOrigin['kind']) {
  const randomValue =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)

  return `client-profile:${kind}:${Date.now().toString(36)}:${randomValue}`
}

function copyHistoryStateRecord(historyState: unknown) {
  return isRecord(historyState) ? { ...historyState } : {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
