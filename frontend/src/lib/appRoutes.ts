import type { AppSection, AuthenticatedUser } from './api'

export type AppRoute =
  | { kind: 'section'; section: AppSection }
  | { kind: 'password' }
  | { kind: 'clientCreate' }
  | { kind: 'clientDetails'; clientId: string }
  | { kind: 'clientEdit'; clientId: string }
  | { kind: 'groupCreate' }
  | { kind: 'groupEdit'; groupId: string }
  | { kind: 'userCreate' }
  | { kind: 'userEdit'; userId: string }

const PASSWORD_PATH = '/password'
const CLIENT_CREATE_PATH = '/clients/new'
const GROUP_CREATE_PATH = '/groups/new'
const USER_CREATE_PATH = '/users/new'
const CLIENT_EDIT_ROUTE_PATTERN = /^\/clients\/([^/]+)\/edit$/
const GROUP_EDIT_ROUTE_PATTERN = /^\/groups\/([^/]+)\/edit$/
const USER_EDIT_ROUTE_PATTERN = /^\/users\/([^/]+)\/edit$/
const CLIENT_DETAILS_ROUTE_PATTERN = /^\/clients\/([^/]+)$/

export const APP_SECTION_LABELS: Record<AppSection, string> = {
  Home: 'Главная',
  Attendance: 'Посещения',
  Clients: 'Клиенты',
  Groups: 'Группы',
  Users: 'Пользователи',
  Audit: 'Журнал',
}

export const APP_SECTION_PATHS: Record<AppSection, string> = {
  Home: '/',
  Attendance: '/attendance',
  Clients: '/clients',
  Groups: '/groups',
  Users: '/users',
  Audit: '/audit',
}

const sectionPathEntries = Object.entries(APP_SECTION_PATHS) as Array<
  [AppSection, string]
>

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

export function getRoutePath(route: AppRoute) {
  switch (route.kind) {
    case 'section':
      return getSectionPath(route.section)
    case 'password':
      return PASSWORD_PATH
    case 'clientCreate':
      return CLIENT_CREATE_PATH
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
      return `/users/${encodeURIComponent(route.userId)}/edit`
  }
}

export function parseRoute(pathname: string): AppRoute {
  const normalizedPathname = normalizePathname(pathname)

  if (normalizedPathname === PASSWORD_PATH) {
    return { kind: 'password' }
  }

  if (normalizedPathname === CLIENT_CREATE_PATH) {
    return { kind: 'clientCreate' }
  }

  if (normalizedPathname === GROUP_CREATE_PATH) {
    return { kind: 'groupCreate' }
  }

  if (normalizedPathname === USER_CREATE_PATH) {
    return { kind: 'userCreate' }
  }

  const clientEditMatch = normalizedPathname.match(CLIENT_EDIT_ROUTE_PATTERN)
  if (clientEditMatch) {
    return {
      kind: 'clientEdit',
      clientId: decodeURIComponent(clientEditMatch[1]),
    }
  }

  const groupEditMatch = normalizedPathname.match(GROUP_EDIT_ROUTE_PATTERN)
  if (groupEditMatch) {
    return {
      kind: 'groupEdit',
      groupId: decodeURIComponent(groupEditMatch[1]),
    }
  }

  const userEditMatch = normalizedPathname.match(USER_EDIT_ROUTE_PATTERN)
  if (userEditMatch) {
    return {
      kind: 'userEdit',
      userId: decodeURIComponent(userEditMatch[1]),
    }
  }

  const clientDetailsMatch = normalizedPathname.match(CLIENT_DETAILS_ROUTE_PATTERN)
  if (clientDetailsMatch) {
    return {
      kind: 'clientDetails',
      clientId: decodeURIComponent(clientDetailsMatch[1]),
    }
  }

  const sectionEntry = sectionPathEntries.find(([, path]) => path === normalizedPathname)

  if (sectionEntry) {
    return {
      kind: 'section',
      section: sectionEntry[0],
    }
  }

  return { kind: 'section', section: 'Home' }
}

export function getRouteSection(route: AppRoute): AppSection | null {
  switch (route.kind) {
    case 'section':
      return route.section
    case 'clientCreate':
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
}

export function resolveAccessibleRoutePath(
  user: AuthenticatedUser,
  route: AppRoute,
) {
  const fallbackPath = getSectionPath(user.landingScreen)
  const routeSection = getRouteSection(route)

  if (!routeSection) {
    return fallbackPath
  }

  if (isUsersRoute(route, routeSection) && !user.permissions.canManageUsers) {
    return fallbackPath
  }

  if (isClientWriteRoute(route) && !user.permissions.canManageClients) {
    return user.allowedSections.includes('Clients')
      ? getSectionPath('Clients')
      : fallbackPath
  }

  if (isGroupManagementRoute(route) && !user.permissions.canManageGroups) {
    return fallbackPath
  }

  if (!user.allowedSections.includes(routeSection)) {
    return fallbackPath
  }

  return getRoutePath(route)
}
