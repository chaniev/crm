import type { AppSection, AuthenticatedUser } from './api'

export type AppRoute =
  | { kind: 'section'; section: AppSection }
  | { kind: 'password' }
  | { kind: 'attendanceLesson'; lessonOccurrenceId: string; lessonDate: string }
  | { kind: 'scheduleLessonDetail'; lessonOccurrenceId: string; lessonDate: string }
  | { kind: 'scheduleLessonCreate' }
  | { kind: 'scheduleLessonEdit'; lessonOccurrenceId: string; lessonDate: string; scope: 'occurrence' }
  | { kind: 'scheduleLessonMove'; lessonOccurrenceId: string; lessonDate: string }
  | {
    kind: 'scheduleSeriesEdit'
    lessonSeriesId: string
    scope: 'this-and-future' | 'entire'
    groupId?: string | null
    lessonOccurrenceId?: string | null
    lessonDate?: string | null
  }
  | { kind: 'clientCreate' }
  | { kind: 'clientPreview'; clientId: string }
  | { kind: 'clientDetails'; clientId: string }
  | { kind: 'clientEdit'; clientId: string }
  | { kind: 'groupCreate' }
  | { kind: 'groupEdit'; groupId: string }
  | { kind: 'userCreate' }
  | { kind: 'userEdit'; userId: string }

export type NotFoundRoute = {
  kind: 'not-found'
  path: string
}

export type ParsedRoute = AppRoute | NotFoundRoute

export type RouteAccessReason = {
  kind: 'section' | 'operation'
  label: string
}

export type RouteRecoveryDestination = {
  recoveryPath: string
  recoveryLabel: string
}

export type RouteAccessAllowed = {
  kind: 'allowed'
  requestedPath: string
  route: AppRoute
  requestedDestinationLabel: string
}

export type RouteAccessRestricted = {
  kind: 'restricted'
  requestedPath: string
  route: AppRoute
  requestedDestinationLabel: string
  reason: RouteAccessReason
  recoveryPath: string
  recoveryLabel: string
}

export type RouteAccessNotFound = {
  kind: 'not-found'
  requestedPath: string
  recoveryPath: string
  recoveryLabel: string
}

export type RouteAccessResolution =
  | RouteAccessAllowed
  | RouteAccessRestricted
  | RouteAccessNotFound

function assertNeverRoute(value: never): never {
  throw new Error(`Unhandled app route: ${JSON.stringify(value)}`)
}

const PASSWORD_PATH = '/password'
const CLIENT_CREATE_PATH = '/clients/new'
const GROUP_CREATE_PATH = '/groups/new'
const USER_CREATE_PATH = '/coaches/new'
const ATTENDANCE_LESSON_ROUTE_PATTERN = /^\/attendance\/([^/]+)$/
const SCHEDULE_LESSON_CREATE_PATH = '/schedule/lessons/new'
const SCHEDULE_LESSON_DETAIL_ROUTE_PATTERN = /^\/schedule\/lessons\/([^/]+)$/
const SCHEDULE_LESSON_EDIT_ROUTE_PATTERN = /^\/schedule\/lessons\/([^/]+)\/edit$/
const SCHEDULE_LESSON_MOVE_ROUTE_PATTERN = /^\/schedule\/lessons\/([^/]+)\/move$/
const SCHEDULE_SERIES_EDIT_ROUTE_PATTERN = /^\/schedule\/series\/([^/]+)\/edit$/
const CLIENT_EDIT_ROUTE_PATTERN = /^\/clients\/([^/]+)\/edit$/
const CLIENT_PREVIEW_ROUTE_PATTERN = /^\/clients\/([^/]+)\/preview$/
const GROUP_EDIT_ROUTE_PATTERN = /^\/groups\/([^/]+)\/edit$/
const USER_EDIT_ROUTE_PATTERN = /^\/coaches\/([^/]+)\/edit$/
const CLIENT_DETAILS_ROUTE_PATTERN = /^\/clients\/([^/]+)$/

export const APP_SECTION_LABELS: Record<AppSection, string> = {
  Attendance: 'Посещения',
  Attention: 'Внимание',
  Schedule: 'Расписание',
  Clients: 'Клиенты',
  Groups: 'Группы',
  Users: 'Тренеры',
  Audit: 'Журнал',
  Finance: 'Финансы',
  Settings: 'Настройки',
}

export const APP_SECTION_PATHS: Record<AppSection, string> = {
  Attendance: '/attendance',
  Attention: '/attention',
  Schedule: '/schedule',
  Clients: '/clients',
  Groups: '/groups',
  Users: '/coaches',
  Audit: '/audit',
  Finance: '/finance',
  Settings: '/settings',
}

export const APP_NAVIGATION_SECTIONS: AppSection[] = [
  'Attendance',
  'Attention',
  'Schedule',
  'Clients',
  'Groups',
  'Users',
  'Audit',
  'Finance',
  'Settings',
]

const MOBILE_PRIMARY_NAVIGATION_CANDIDATES: AppSection[] = [
  'Attendance',
  'Attention',
  'Schedule',
]
const MOBILE_ADAPTIVE_FOURTH_CANDIDATE: AppSection = 'Clients'
const MOBILE_PRIMARY_NAVIGATION_LIMIT = 4

const sectionPathEntries = Object.entries(APP_SECTION_PATHS) as Array<
  [AppSection, string]
>

function isNavigationSectionAllowed(
  user: AuthenticatedUser,
  section: AppSection,
) {
  if (section === 'Groups' && !user.permissions.canManageGroups) {
    return false
  }

  if (section === 'Users' && !user.permissions.canManageUsers) {
    return false
  }

  if (section === 'Audit' && !user.permissions.canViewAuditLog) {
    return false
  }

  if (section === 'Finance') {
    return (
      user.permissions.canViewFinancialReports &&
      user.allowedSections.includes('Finance')
    )
  }

  if (section === 'Settings') {
    return user.permissions.canManageSettings && user.allowedSections.includes('Settings')
  }

  return user.allowedSections.includes(section)
}

function isClientWriteRoute(route: AppRoute) {
  return route.kind === 'clientCreate' || route.kind === 'clientEdit'
}

function isGroupManagementRoute(route: AppRoute) {
  return route.kind === 'groupCreate' || route.kind === 'groupEdit'
}

function isUsersRoute(route: AppRoute, section: AppSection | null) {
  return route.kind === 'userCreate' || route.kind === 'userEdit' || section === 'Users'
}

export function normalizePathname(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1)
  }

  return pathname || '/'
}

export function getSectionPath(section: AppSection) {
  return APP_SECTION_PATHS[section]
}

function safeDecodePathComponent(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function splitRequestedPath(pathname: string) {
  const searchSeparatorIndex = pathname.indexOf('?')

  if (searchSeparatorIndex === -1) {
    return {
      requestedPath: pathname,
      routePathname: pathname,
    }
  }

  return {
    requestedPath: pathname,
    routePathname: pathname.slice(0, searchSeparatorIndex),
  }
}

function getQueryValue(requestedPath: string, key: string) {
  const searchSeparatorIndex = requestedPath.indexOf('?')

  if (searchSeparatorIndex === -1) {
    return null
  }

  return new URLSearchParams(requestedPath.slice(searchSeparatorIndex + 1)).get(key)
}

function isIsoDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

export function getAccessibleNavigationSections(user: AuthenticatedUser) {
  const sections: AppSection[] = APP_NAVIGATION_SECTIONS.filter((section) =>
    isNavigationSectionAllowed(user, section),
  )

  return sections
}

export function getMobileNavigationSections(
  accessibleSections: readonly AppSection[],
  currentSection: AppSection | null = null,
) {
  const primarySections: AppSection[] = MOBILE_PRIMARY_NAVIGATION_CANDIDATES
    .filter((section) => accessibleSections.includes(section))

  const canonicalFourth = accessibleSections.includes(MOBILE_ADAPTIVE_FOURTH_CANDIDATE)
    ? MOBILE_ADAPTIVE_FOURTH_CANDIDATE
    : accessibleSections.find((section) => !primarySections.includes(section)) ?? null
  const shouldPromoteCurrent =
    currentSection &&
    accessibleSections.includes(currentSection) &&
    !primarySections.includes(currentSection) &&
    currentSection !== canonicalFourth

  if (shouldPromoteCurrent) {
    primarySections.push(currentSection)
  } else if (canonicalFourth && primarySections.length < MOBILE_PRIMARY_NAVIGATION_LIMIT) {
    primarySections.push(canonicalFourth)
  }

  if (primarySections.length < MOBILE_PRIMARY_NAVIGATION_LIMIT) {
    for (const section of accessibleSections) {
      if (primarySections.length >= MOBILE_PRIMARY_NAVIGATION_LIMIT) {
        break
      }

      if (!primarySections.includes(section)) {
        primarySections.push(section)
      }
    }
  }

  const constrainedPrimarySections = primarySections.slice(0, MOBILE_PRIMARY_NAVIGATION_LIMIT)
  const primarySectionSet = new Set(constrainedPrimarySections)
  const overflowSections = accessibleSections.filter(
    (section) => !primarySectionSet.has(section),
  )

  return {
    primarySections: constrainedPrimarySections,
    overflowSections,
  }
}

function isRouteOperationRestrictedBySectionAccess(
  user: AuthenticatedUser,
  route: AppRoute,
) {
  if (isGroupManagementRoute(route) && !user.permissions.canManageGroups) {
    return true
  }

  if (isClientWriteRoute(route) && !user.permissions.canManageClients) {
    return true
  }

  if (isUsersRoute(route, null) && !user.permissions.canManageUsers) {
    return true
  }

  return false
}

export function isSectionAllowed(
  user: AuthenticatedUser,
  section: AppSection,
) {
  return isNavigationSectionAllowed(user, section)
}

export function getRoutePath(route: AppRoute) {
  switch (route.kind) {
    case 'section':
      return getSectionPath(route.section)
    case 'password':
      return PASSWORD_PATH
    case 'attendanceLesson':
      return `/attendance/${encodeURIComponent(route.lessonOccurrenceId)}?lessonDate=${encodeURIComponent(route.lessonDate)}`
    case 'scheduleLessonDetail':
      return `/schedule/lessons/${encodeURIComponent(route.lessonOccurrenceId)}?lessonDate=${encodeURIComponent(route.lessonDate)}`
    case 'scheduleLessonCreate':
      return SCHEDULE_LESSON_CREATE_PATH
    case 'scheduleLessonEdit':
      return `/schedule/lessons/${encodeURIComponent(route.lessonOccurrenceId)}/edit?lessonDate=${encodeURIComponent(route.lessonDate)}&scope=${encodeURIComponent(route.scope)}`
    case 'scheduleLessonMove':
      return `/schedule/lessons/${encodeURIComponent(route.lessonOccurrenceId)}/move?lessonDate=${encodeURIComponent(route.lessonDate)}`
    case 'scheduleSeriesEdit':
    {
      const searchParams = new URLSearchParams()
      searchParams.set('scope', route.scope)
      if (route.groupId) {
        searchParams.set('groupId', route.groupId)
      }
      if (route.lessonOccurrenceId) {
        searchParams.set('lessonOccurrenceId', route.lessonOccurrenceId)
      }
      if (route.lessonDate) {
        searchParams.set('lessonDate', route.lessonDate)
      }
      return `/schedule/series/${encodeURIComponent(route.lessonSeriesId)}/edit?${searchParams.toString()}`
    }
    case 'clientCreate':
      return CLIENT_CREATE_PATH
    case 'clientPreview':
      return `/clients/${encodeURIComponent(route.clientId)}/preview`
    case 'clientDetails':
      return `/clients/${encodeURIComponent(route.clientId)}`
    case 'clientEdit':
      return `/clients/${encodeURIComponent(route.clientId)}/edit`
    case 'groupCreate':
      return GROUP_CREATE_PATH
    case 'groupEdit':
      return `/groups/${encodeURIComponent(route.groupId)}/edit`
    case 'userCreate':
      return USER_CREATE_PATH
    case 'userEdit':
      return `/coaches/${encodeURIComponent(route.userId)}/edit`
  }

  return assertNeverRoute(route)
}

export function parseRoute(pathname: string): ParsedRoute {
  const { requestedPath, routePathname } = splitRequestedPath(pathname)
  const normalizedPathname = normalizePathname(routePathname)
  const normalizedRequestedPath = splitRequestedPath(normalizedPathname).routePathname

  if (normalizedRequestedPath === PASSWORD_PATH) {
    return { kind: 'password' }
  }

  if (normalizedRequestedPath === CLIENT_CREATE_PATH) {
    return { kind: 'clientCreate' }
  }

  if (normalizedRequestedPath === GROUP_CREATE_PATH) {
    return { kind: 'groupCreate' }
  }

  if (normalizedRequestedPath === USER_CREATE_PATH) {
    return { kind: 'userCreate' }
  }

  if (normalizedRequestedPath === SCHEDULE_LESSON_CREATE_PATH) {
    return { kind: 'scheduleLessonCreate' }
  }

  const attendanceLessonMatch = normalizedRequestedPath.match(ATTENDANCE_LESSON_ROUTE_PATTERN)
  if (attendanceLessonMatch) {
    const lessonDate = getQueryValue(requestedPath, 'lessonDate')

    if (isIsoDate(lessonDate)) {
      return {
        kind: 'attendanceLesson',
        lessonOccurrenceId: safeDecodePathComponent(attendanceLessonMatch[1]),
        lessonDate: lessonDate!,
      }
    }

    return { kind: 'not-found', path: requestedPath }
  }

  const scheduleLessonDetailMatch = normalizedRequestedPath.match(SCHEDULE_LESSON_DETAIL_ROUTE_PATTERN)
  if (scheduleLessonDetailMatch) {
    const lessonDate = getQueryValue(requestedPath, 'lessonDate')

    if (isIsoDate(lessonDate)) {
      return {
        kind: 'scheduleLessonDetail',
        lessonOccurrenceId: safeDecodePathComponent(scheduleLessonDetailMatch[1]),
        lessonDate: lessonDate!,
      }
    }

    return { kind: 'not-found', path: requestedPath }
  }

  const scheduleLessonEditMatch = normalizedRequestedPath.match(SCHEDULE_LESSON_EDIT_ROUTE_PATTERN)
  if (scheduleLessonEditMatch) {
    const lessonDate = getQueryValue(requestedPath, 'lessonDate')
    const scope = getQueryValue(requestedPath, 'scope')

    if (isIsoDate(lessonDate) && scope === 'occurrence') {
      return {
        kind: 'scheduleLessonEdit',
        lessonOccurrenceId: safeDecodePathComponent(scheduleLessonEditMatch[1]),
        lessonDate: lessonDate!,
        scope,
      }
    }

    return { kind: 'not-found', path: requestedPath }
  }

  const scheduleLessonMoveMatch = normalizedRequestedPath.match(SCHEDULE_LESSON_MOVE_ROUTE_PATTERN)
  if (scheduleLessonMoveMatch) {
    const lessonDate = getQueryValue(requestedPath, 'lessonDate')

    if (isIsoDate(lessonDate)) {
      return {
        kind: 'scheduleLessonMove',
        lessonOccurrenceId: safeDecodePathComponent(scheduleLessonMoveMatch[1]),
        lessonDate: lessonDate!,
      }
    }

    return { kind: 'not-found', path: requestedPath }
  }

  const scheduleSeriesEditMatch = normalizedRequestedPath.match(SCHEDULE_SERIES_EDIT_ROUTE_PATTERN)
  if (scheduleSeriesEditMatch) {
    const scope = getQueryValue(requestedPath, 'scope')
    const lessonDate = getQueryValue(requestedPath, 'lessonDate')

    if ((scope === 'this-and-future' || scope === 'entire') && (!lessonDate || isIsoDate(lessonDate))) {
      const groupId = getQueryValue(requestedPath, 'groupId')
      const lessonOccurrenceId = getQueryValue(requestedPath, 'lessonOccurrenceId')
      const route: AppRoute = {
        kind: 'scheduleSeriesEdit',
        lessonSeriesId: safeDecodePathComponent(scheduleSeriesEditMatch[1]),
        scope,
      }

      if (groupId) {
        route.groupId = groupId
      }
      if (lessonOccurrenceId) {
        route.lessonOccurrenceId = lessonOccurrenceId
      }
      if (lessonDate) {
        route.lessonDate = lessonDate
      }

      return {
        ...route,
      }
    }

    return { kind: 'not-found', path: requestedPath }
  }

  const clientEditMatch = normalizedRequestedPath.match(CLIENT_EDIT_ROUTE_PATTERN)
  if (clientEditMatch) {
    return {
      kind: 'clientEdit',
      clientId: safeDecodePathComponent(clientEditMatch[1]),
    }
  }

  const clientPreviewMatch = normalizedRequestedPath.match(
    CLIENT_PREVIEW_ROUTE_PATTERN,
  )
  if (clientPreviewMatch) {
    return {
      kind: 'clientPreview',
      clientId: safeDecodePathComponent(clientPreviewMatch[1]),
    }
  }

  const groupEditMatch = normalizedRequestedPath.match(GROUP_EDIT_ROUTE_PATTERN)
  if (groupEditMatch) {
    return {
      kind: 'groupEdit',
      groupId: safeDecodePathComponent(groupEditMatch[1]),
    }
  }

  const userEditMatch = normalizedRequestedPath.match(USER_EDIT_ROUTE_PATTERN)
  if (userEditMatch) {
    return {
      kind: 'userEdit',
      userId: safeDecodePathComponent(userEditMatch[1]),
    }
  }

  const clientDetailsMatch = normalizedRequestedPath.match(CLIENT_DETAILS_ROUTE_PATTERN)
  if (clientDetailsMatch) {
    return {
      kind: 'clientDetails',
      clientId: safeDecodePathComponent(clientDetailsMatch[1]),
    }
  }

  const sectionEntry = sectionPathEntries.find(([, path]) => path === normalizedPathname)

  if (sectionEntry) {
    return {
      kind: 'section',
      section: sectionEntry[0],
    }
  }

  return {
    kind: 'not-found',
    path: `${routePathname}${requestedPath.includes('?') ? requestedPath.slice(routePathname.length) : ''}`,
  }
}

export function isRouteAllowedByPermission(user: AuthenticatedUser, route: AppRoute) {
  if (route.kind === 'password') {
    return true
  }

  const routeSection = getRouteSection(route)

  if (!routeSection) {
    return true
  }

  if (isUsersRoute(route, routeSection) && !user.permissions.canManageUsers) {
    return false
  }

  if (routeSection === 'Audit' && !user.permissions.canViewAuditLog) {
    return false
  }

  if (routeSection === 'Groups' && !user.permissions.canManageGroups) {
    return false
  }

  if (routeSection === 'Finance') {
    return (
      user.permissions.canViewFinancialReports &&
      user.allowedSections.includes('Finance')
    )
  }

  if (routeSection === 'Settings') {
    return user.permissions.canManageSettings && user.allowedSections.includes('Settings')
  }

  if (isRouteOperationRestrictedBySectionAccess(user, route)) {
    return false
  }

  return user.allowedSections.includes(routeSection)
}

function getRouteAccessReason(route: AppRoute): RouteAccessReason {
  switch (route.kind) {
    case 'section':
      return {
        kind: 'section',
        label: APP_SECTION_LABELS[route.section],
      }
    case 'password':
      return { kind: 'operation', label: 'Смена пароля' }
    case 'attendanceLesson':
      return { kind: 'section', label: APP_SECTION_LABELS.Attendance }
    case 'scheduleLessonDetail':
    case 'scheduleLessonCreate':
    case 'scheduleLessonEdit':
    case 'scheduleLessonMove':
    case 'scheduleSeriesEdit':
      return { kind: 'section', label: APP_SECTION_LABELS.Schedule }
    case 'clientCreate':
      return { kind: 'operation', label: 'Новый клиент' }
    case 'clientEdit':
      return { kind: 'operation', label: 'Редактирование клиента' }
    case 'clientDetails':
    case 'clientPreview':
      return { kind: 'section', label: APP_SECTION_LABELS.Clients }
    case 'groupCreate':
      return { kind: 'operation', label: 'Новая группа' }
    case 'groupEdit':
      return { kind: 'operation', label: 'Редактирование группы' }
    case 'userCreate':
      return { kind: 'operation', label: 'Новый тренер' }
    case 'userEdit':
      return { kind: 'operation', label: 'Редактирование тренера' }
  }

  return assertNeverRoute(route)
}

export function getDefaultRouteRecoveryDestination(
  user: AuthenticatedUser,
): RouteRecoveryDestination {
  const accessibleSections = getAccessibleNavigationSections(user)
  const fallbackSection =
    (accessibleSections.includes(user.landingScreen) ? user.landingScreen : null)
    ?? accessibleSections[0]

  if (!fallbackSection) {
    throw new Error('Route recovery requires at least one accessible section.')
  }

  return {
    recoveryPath: getSectionPath(fallbackSection),
    recoveryLabel: APP_SECTION_LABELS[fallbackSection],
  }
}

function getRecoveryDestination(user: AuthenticatedUser, route: AppRoute) {
  const fallbackRecovery = getDefaultRouteRecoveryDestination(user)

  if (
    route.kind === 'clientCreate' ||
    route.kind === 'clientEdit' ||
    route.kind === 'clientDetails' ||
    route.kind === 'clientPreview'
  ) {
    if (isSectionAllowed(user, 'Clients')) {
      return {
        recoveryPath: getSectionPath('Clients'),
        recoveryLabel: APP_SECTION_LABELS.Clients,
      }
    }

    return fallbackRecovery
  }

  if (route.kind === 'attendanceLesson') {
    if (isSectionAllowed(user, 'Attendance')) {
      return {
        recoveryPath: getSectionPath('Attendance'),
        recoveryLabel: APP_SECTION_LABELS.Attendance,
      }
    }

    return fallbackRecovery
  }

  if (
    route.kind === 'scheduleLessonDetail' ||
    route.kind === 'scheduleLessonCreate' ||
    route.kind === 'scheduleLessonEdit' ||
    route.kind === 'scheduleLessonMove' ||
    route.kind === 'scheduleSeriesEdit'
  ) {
    if (isSectionAllowed(user, 'Schedule')) {
      return {
        recoveryPath: getSectionPath('Schedule'),
        recoveryLabel: APP_SECTION_LABELS.Schedule,
      }
    }

    return fallbackRecovery
  }

  if (route.kind === 'groupCreate' || route.kind === 'groupEdit') {
    if (isSectionAllowed(user, 'Groups')) {
      return {
        recoveryPath: getSectionPath('Groups'),
        recoveryLabel: APP_SECTION_LABELS.Groups,
      }
    }

    return fallbackRecovery
  }

  if (route.kind === 'userCreate' || route.kind === 'userEdit') {
    if (isSectionAllowed(user, 'Users')) {
      return {
        recoveryPath: getSectionPath('Users'),
        recoveryLabel: APP_SECTION_LABELS.Users,
      }
    }

    return fallbackRecovery
  }

  return fallbackRecovery
}

export function resolveRouteAccess(
  user: AuthenticatedUser,
  route: ParsedRoute,
): RouteAccessResolution {
  const requestedPath = route.kind === 'not-found'
    ? route.path
    : getRoutePath(route)

  if (route.kind === 'not-found') {
    const recovery = getDefaultRouteRecoveryDestination(user)

    return {
      kind: 'not-found',
      requestedPath,
      recoveryPath: recovery.recoveryPath,
      recoveryLabel: recovery.recoveryLabel,
    }
  }

  if (isRouteAllowedByPermission(user, route)) {
    return {
      kind: 'allowed',
      requestedPath,
      requestedDestinationLabel: getRouteAccessReason(route).label,
      route,
    }
  }

  const recovery = getRecoveryDestination(user, route)

  return {
    kind: 'restricted',
    requestedPath,
    requestedDestinationLabel: getRouteAccessReason(route).label,
    reason: getRouteAccessReason(route),
    recoveryPath: recovery.recoveryPath,
    recoveryLabel: recovery.recoveryLabel,
    route,
  }
}

export function getRouteSection(route: AppRoute): AppSection | null {
  switch (route.kind) {
    case 'section':
      return route.section
    case 'attendanceLesson':
      return 'Attendance'
    case 'scheduleLessonDetail':
    case 'scheduleLessonCreate':
    case 'scheduleLessonEdit':
    case 'scheduleLessonMove':
    case 'scheduleSeriesEdit':
      return 'Schedule'
    case 'clientCreate':
    case 'clientPreview':
    case 'clientDetails':
    case 'clientEdit':
      return 'Clients'
    case 'groupCreate':
    case 'groupEdit':
      return 'Groups'
    case 'userCreate':
    case 'userEdit':
      return 'Users'
    case 'password':
      return null
  }

  return assertNeverRoute(route)
}

export function resolveAccessibleRoutePath(
  user: AuthenticatedUser,
  route: AppRoute,
) {
  const access = resolveRouteAccess(user, route)

  if (access.kind === 'allowed') {
    return access.requestedPath
  }

  return access.recoveryPath
}
