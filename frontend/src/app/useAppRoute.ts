import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { AppSection, AuthenticatedUser, SessionResponse } from '../lib/api'
import {
  APP_SECTION_LABELS,
  getDefaultRouteRecoveryDestination,
  getRoutePath,
  getRouteSection,
  normalizePathname,
  parseRoute,
  resolveRouteAccess,
  type AppRoute,
  type ParsedRoute,
  type RouteAccessResolution,
} from '../lib/appRoutes'
import {
  stripClientListReturnSnapshotFromHistoryState,
} from '../features/clients/list/clientListReturnState'
import {
  stripClientProfileReturnContextFromHistoryState,
  type ClientProfileOriginInput,
} from '../features/clients/clientProfileReturnState'
import {
  stripGroupListReturnSnapshotFromHistoryState,
} from '../features/groups/groupListReturnState'
import {
  stripScheduleReturnSnapshotFromHistoryState,
} from '../features/schedule/scheduleReturnState'
import { fe1AppShellAuthText } from '../resources/fe-1-app-shell-auth'


export type PasswordReturnState = {
  path: string
  access: RouteAccessResolution | null
}

export type PasswordReturnDecision = {
  path: string
  recoveryEvent: Extract<RouteAccessResolution, { kind: 'restricted' }> | null
}

export type PendingClientProfileReturn = {
  originEntryKey: string
  originRoute: AppRoute
}

export type NavigateOptions = {
  replace?: boolean
  state?: unknown
}

type UseAppDocumentTitleOptions = {
  bootstrapError: string | null
  clubName: string
  loadingSession: boolean
  route: ParsedRoute
  routeAccess: RouteAccessResolution | null
  session: SessionResponse | null
}

export function isAppRoute(route: ParsedRoute): route is AppRoute {
  return route.kind !== 'not-found'
}

export function isClientProfileOriginInput(
  value: unknown,
): value is ClientProfileOriginInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    ((value as { kind?: unknown }).kind === 'attendance' ||
      (value as { kind?: unknown }).kind === 'groupEdit')
  )
}

function assertNeverAppRoute(value: never): never {
  throw new Error(`Unhandled app route: ${JSON.stringify(value)}`)
}

export function useAppRoute() {
  const [pathname, setPathname] = useState(() =>
    normalizePathname(`${window.location.pathname}${window.location.search}`),
  )

  useEffect(() => {
    function handlePopState() {
      setPathname(normalizePathname(`${window.location.pathname}${window.location.search}`))
    }

    window.addEventListener('popstate', handlePopState)

    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback(
    (nextRoute: AppRoute | string, options: NavigateOptions = {}) => {
      const nextPath =
        typeof nextRoute === 'string'
          ? normalizePathname(nextRoute)
          : getRoutePath(nextRoute)
      const nextState =
        options.state ?? stripAppReturnSnapshotsFromHistoryState(window.history.state)

      if (nextPath === pathname) {
        return
      }

      if (options.replace) {
        window.history.replaceState(nextState, '', nextPath)
      } else {
        window.history.pushState(nextState, '', nextPath)
      }

      setPathname(nextPath)
      window.scrollTo({ top: 0 })
    },
    [pathname],
  )

  const clearCurrentReturnSnapshots = useCallback(() => {
    window.history.replaceState(
      stripAppReturnSnapshotsFromHistoryState(window.history.state),
      '',
      `${window.location.pathname}${window.location.search}`,
    )
  }, [])

  const route = useMemo(() => parseRoute(pathname), [pathname])

  return useMemo(
    () => ({
      clearCurrentReturnSnapshots,
      navigate,
      pathname,
      route,
    }),
    [clearCurrentReturnSnapshots, navigate, pathname, route],
  )
}

export function useAppDocumentTitle({
  bootstrapError,
  clubName,
  loadingSession,
  route,
  routeAccess,
  session,
}: UseAppDocumentTitleOptions) {
  useEffect(() => {
    document.title = getAppDocumentTitle(
      clubName,
      route,
      routeAccess,
      session,
      loadingSession,
      bootstrapError,
    )
  }, [
    bootstrapError,
    clubName,
    loadingSession,
    route,
    routeAccess,
    session,
  ])
}

export function getPostPasswordReturnDecision(
  user: AuthenticatedUser,
  passwordReturnState: PasswordReturnState | null,
): PasswordReturnDecision {
  if (!passwordReturnState?.path) {
    return {
      path: getDefaultRouteRecoveryDestination(user).recoveryPath,
      recoveryEvent: null,
    }
  }

  const passwordReturnAccess = resolveRouteAccess(
    user,
    parseRoute(passwordReturnState.path),
  )

  if (
    passwordReturnState.access?.kind === 'allowed' &&
    passwordReturnAccess.kind === 'restricted'
  ) {
    return {
      path: passwordReturnAccess.recoveryPath,
      recoveryEvent: passwordReturnAccess,
    }
  }

  return {
    path: passwordReturnAccess.requestedPath,
    recoveryEvent: null,
  }
}

export function getRouteAccessLossNotificationMessage(
  access: Extract<RouteAccessResolution, { kind: 'restricted' }>,
) {
  const deniedSubject =
    access.reason.kind === 'section'
      ? fe1AppShellAuthText.useAppRoute_template_49c566c1(access.requestedDestinationLabel)
      : fe1AppShellAuthText.useAppRoute_template_f613365a(access.requestedDestinationLabel)

  return fe1AppShellAuthText.useAppRoute_template_94c1356c(deniedSubject, access.recoveryLabel)
}

function getRouteDocumentTitle(route: AppRoute) {
  switch (route.kind) {
    case 'section':
      return APP_SECTION_LABELS[route.section]
    case 'password':
      return fe1AppShellAuthText.useAppRoute_string_354d5f5b
    case 'attendanceLesson':
      return fe1AppShellAuthText.useAppRoute_string_5f43e5f1
    case 'scheduleLessonDetail':
      return fe1AppShellAuthText.useAppRoute_string_56995ff3
    case 'scheduleLessonCreate':
      return fe1AppShellAuthText.useAppRoute_string_4196b8be
    case 'scheduleLessonEdit':
      return fe1AppShellAuthText.useAppRoute_string_148e56cb
    case 'scheduleLessonMove':
      return fe1AppShellAuthText.useAppRoute_string_c0c26d68
    case 'scheduleSeriesEdit':
      return fe1AppShellAuthText.useAppRoute_string_cd3e4306
    case 'clientCreate':
      return fe1AppShellAuthText.useAppRoute_string_5a2595c2
    case 'clientPreview':
      return fe1AppShellAuthText.useAppRoute_string_5008cfdc
    case 'clientDetails':
      return fe1AppShellAuthText.useAppRoute_string_a912ec86
    case 'clientEdit':
      return fe1AppShellAuthText.useAppRoute_string_6744d426
    case 'groupCreate':
      return fe1AppShellAuthText.useAppRoute_string_c9fd9fc0
    case 'groupEdit':
      return fe1AppShellAuthText.useAppRoute_string_3f7f75d8
    case 'userCreate':
      return fe1AppShellAuthText.useAppRoute_string_1ae0c0dd
    case 'userEdit':
      return fe1AppShellAuthText.useAppRoute_string_f303a273
  }

  return assertNeverAppRoute(route)
}

export function stripAppReturnSnapshotsFromHistoryState(historyState: unknown) {
  return stripScheduleReturnSnapshotFromHistoryState(
    stripClientProfileReturnContextFromHistoryState(
      stripGroupListReturnSnapshotFromHistoryState(
        stripClientListReturnSnapshotFromHistoryState(historyState),
      ),
    ),
  )
}

export function getAppDocumentTitle(
  clubName: string,
  route: ParsedRoute,
  routeAccess: RouteAccessResolution | null,
  session: SessionResponse | null,
  loadingSession: boolean,
  bootstrapError: string | null,
) {
  if (loadingSession) {
    return fe1AppShellAuthText.useAppRoute_template_144a149c(clubName)
  }

  if (bootstrapError && !session) {
    return fe1AppShellAuthText.useAppRoute_template_eae52a62(clubName)
  }

  if (!session?.isAuthenticated || !session.user) {
    return fe1AppShellAuthText.useAppRoute_template_1ad27b00(clubName)
  }

  if (session.user.mustChangePassword) {
    return fe1AppShellAuthText.useAppRoute_template_eb919eb4(clubName)
  }

  if (routeAccess?.kind === 'restricted') {
    return fe1AppShellAuthText.useAppRoute_template_4e209ac0(routeAccess.requestedDestinationLabel, clubName)
  }

  if (routeAccess?.kind === 'not-found') {
    return fe1AppShellAuthText.useAppRoute_template_ff77bda7(clubName)
  }

  if (route.kind === 'password') {
    return fe1AppShellAuthText.useAppRoute_template_821c2666(clubName)
  }

  if (route.kind === 'section') {
    return `${getRouteDocumentTitle(route)} • ${clubName}`
  }

  if (route.kind === 'not-found') {
    return fe1AppShellAuthText.useAppRoute_template_ff77bda7(clubName)
  }

  return `${getRouteDocumentTitle(route)} • ${clubName}`
}

export function getCurrentSection(
  accessibleRoute: AppRoute | null,
  route: ParsedRoute,
): AppSection | null {
  if (accessibleRoute) {
    return getRouteSection(accessibleRoute)
  }

  if (route.kind === 'not-found' || route.kind === 'password') {
    return null
  }

  return getRouteSection(route)
}
