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
    normalizePathname(window.location.pathname),
  )

  useEffect(() => {
    function handlePopState() {
      setPathname(normalizePathname(window.location.pathname))
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
      window.location.pathname,
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
      ? `Раздел «${access.requestedDestinationLabel}»`
      : `Операция «${access.requestedDestinationLabel}»`

  return `Больше нет доступа: ${deniedSubject}. Открыт доступный раздел «${access.recoveryLabel}».`
}

function getRouteDocumentTitle(route: AppRoute) {
  switch (route.kind) {
    case 'section':
      return APP_SECTION_LABELS[route.section]
    case 'password':
      return 'Смена пароля'
    case 'clientCreate':
      return 'Новый клиент'
    case 'clientPreview':
      return 'Краткая карточка клиента'
    case 'clientDetails':
      return 'Карточка клиента'
    case 'clientEdit':
      return 'Редактирование клиента'
    case 'groupCreate':
      return 'Новая группа'
    case 'groupEdit':
      return 'Редактирование группы'
    case 'userCreate':
      return 'Новый тренер'
    case 'userEdit':
      return 'Редактирование тренера'
  }

  return assertNeverAppRoute(route)
}

export function stripAppReturnSnapshotsFromHistoryState(historyState: unknown) {
  return stripClientProfileReturnContextFromHistoryState(
    stripGroupListReturnSnapshotFromHistoryState(
      stripClientListReturnSnapshotFromHistoryState(historyState),
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
    return `Открываем ${clubName}`
  }

  if (bootstrapError && !session) {
    return `Вход недоступен • ${clubName}`
  }

  if (!session?.isAuthenticated || !session.user) {
    return `Войти в ${clubName}`
  }

  if (session.user.mustChangePassword) {
    return `Смените пароль • ${clubName}`
  }

  if (routeAccess?.kind === 'restricted') {
    return `${routeAccess.requestedDestinationLabel} — нет доступа • ${clubName}`
  }

  if (routeAccess?.kind === 'not-found') {
    return `Страница не найдена • ${clubName}`
  }

  if (route.kind === 'password') {
    return `Смена пароля • ${clubName}`
  }

  if (route.kind === 'section') {
    return `${getRouteDocumentTitle(route)} • ${clubName}`
  }

  if (route.kind === 'not-found') {
    return `Страница не найдена • ${clubName}`
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
