import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import {
  Alert,
  Button,
  Container,
  Group,
  Loader,
  Menu,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconArrowRight,
  IconChevronDown,
  IconCheck,
  IconDoorExit,
  IconLockPassword,
  IconShieldCheck,
  IconSparkles,
  IconUserCircle,
} from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  changePassword,
  loadSession,
  login,
  logout,
  type AppConfigResponse,
  type AppSection,
  type AuthenticatedUser,
  type ChangePasswordRequest,
  type LoginRequest,
  type SessionResponse,
} from './lib/api'
import type { AuthStageBackground } from './theme'
import {
  APP_SECTION_LABELS,
  getAccessibleNavigationSections,
  getDefaultRouteRecoveryDestination,
  getRoutePath,
  getRouteSection,
  getSectionPath,
  normalizePathname,
  parseRoute,
  resolveRouteAccess,
  type ParsedRoute,
  type RouteAccessResolution,
  type AppRoute,
} from './lib/appRoutes'
import {
  getClientListReturnHistoryStateForRoute,
  getNextClientListReturnDepth,
  isClientListReturnRoute,
  mergeClientListReturnSnapshotIntoHistoryState,
  readClientListReturnSnapshot,
  stripClientListReturnSnapshotFromHistoryState,
  withClientListReturnDepth,
  type ClientListReturnSnapshot,
} from './features/clients/list/clientListReturnState'
import {
  ClientCreateScreen,
  ClientDetailScreen,
  ClientEditScreen,
  ClientsListScreen,
} from './features/clients/ClientManagement'
import { HomeDashboard } from './features/home/HomeDashboard'
import { GroupScheduleScreen } from './features/schedule/GroupScheduleScreen'
import {
  GroupCreateScreen,
  GroupEditScreen,
  GroupsListScreen,
} from './features/groups/GroupManagement'
import {
  getGroupListReturnHistoryStateForRoute,
  getNextGroupListReturnDepth,
  isGroupListReturnRoute,
  mergeGroupListReturnSnapshotIntoHistoryState,
  readGroupListReturnSnapshot,
  stripGroupListReturnSnapshotFromHistoryState,
  withGroupListReturnDepth,
  type GroupListReturnSnapshot,
} from './features/groups/groupListReturnState'
import {
  UserCreateScreen,
  UserEditScreen,
  UsersListScreen,
} from './features/users/UserManagement'
import { AuditLogScreen } from './features/audit/AuditLogScreen'
import { FinanceReportsScreen } from './features/finance/FinanceReportsScreen'
import { SettingsScreen } from './features/settings/SettingsScreen'
import {
  AppLayout,
  Header,
  MobileBottomNavigation,
  NavigationTabs,
  PageLayout,
  PageSection,
} from './features/shared/ux'
import { RestrictedState } from './features/shared/RestrictedState'
import {
  showAppNotification,
  showPoliteStatusNotification,
} from './features/shared/notifications'
import './App.css'

type PasswordMode = 'forced' | 'utility'

type PasswordReturnState = {
  path: string
  access: RouteAccessResolution | null
}

type PasswordReturnDecision = {
  path: string
  recoveryEvent: Extract<RouteAccessResolution, { kind: 'restricted' }> | null
}

type RolePresentation = {
  roleLabel: string
}

function assertNeverAppRoute(value: never): never {
  throw new Error(`Unhandled app route: ${JSON.stringify(value)}`)
}

function isAppRoute(route: ParsedRoute): route is AppRoute {
  return route.kind !== 'not-found'
}

type NavigateOptions = {
  replace?: boolean
  state?: unknown
}

const rolePresentationMap: Record<AuthenticatedUser['role'], RolePresentation> = {
  HeadCoach: {
    roleLabel: 'Главный тренер',
  },
  SuperAdministrator: {
    roleLabel: 'Суперадминистратор',
  },
  Administrator: {
    roleLabel: 'Администратор',
  },
  Coach: {
    roleLabel: 'Тренер',
  },
}

function useAppRoute() {
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

  function navigate(nextRoute: AppRoute | string, options: NavigateOptions = {}) {
    const nextPath =
      typeof nextRoute === 'string'
        ? normalizePathname(nextRoute)
        : getRoutePath(nextRoute)
    const nextState = options.state ?? stripAppReturnSnapshotsFromHistoryState(window.history.state)

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
  }

  return {
    navigate,
    pathname,
    route: parseRoute(pathname),
  }
}

function getPostPasswordReturnDecision(
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

function getRouteAccessLossNotificationMessage(
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

function getCurrentClientListReturnDepth(
  route: ParsedRoute,
  snapshot: ClientListReturnSnapshot,
) {
  if (route.kind === 'not-found' || route.kind === 'password') {
    return snapshot.returnDepth
  }

  if (route.kind === 'section' && route.section === 'Clients') {
    return 0
  }

  if (route.kind === 'clientPreview') {
    return Math.max(1, snapshot.returnDepth)
  }

  return snapshot.returnDepth
}

function getCurrentGroupListReturnDepth(
  route: ParsedRoute,
  snapshot: GroupListReturnSnapshot,
) {
  if (route.kind === 'not-found' || route.kind === 'password') {
    return snapshot.returnDepth
  }

  if (route.kind === 'section' && route.section === 'Groups') {
    return 0
  }

  return snapshot.returnDepth
}

function stripAppReturnSnapshotsFromHistoryState(historyState: unknown) {
  return stripGroupListReturnSnapshotFromHistoryState(
    stripClientListReturnSnapshotFromHistoryState(historyState),
  )
}

function getAppDocumentTitle(
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

export type AppProps = {
  appConfig: AppConfigResponse
  authBackground: AuthStageBackground
}

export function App({ appConfig, authBackground }: AppProps) {
  const { navigate, pathname, route } = useAppRoute()
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const [loginPending, setLoginPending] = useState(false)
  const [passwordPending, setPasswordPending] = useState(false)
  const [logoutPending, setLogoutPending] = useState(false)
  const [passwordReturnState, setPasswordReturnState] = useState<PasswordReturnState | null>(
    null,
  )
  const authenticatedUserBoundaryRef = useRef<string | null>(null)
  const routeAccessBoundaryRef = useRef<RouteAccessResolution | null>(null)
  const displayedClubName = appConfig.clubName

  const routeAccess = useMemo(() => {
    if (!session?.isAuthenticated || !session.user || session.user.mustChangePassword) {
      return null
    }

    return resolveRouteAccess(session.user, route)
  }, [route, session])

  const routeClientListReturnSnapshot = readClientListReturnSnapshot(
    window.history.state,
    {
      canSeeWithoutGroup: session?.user?.permissions.canManageClients ?? false,
    },
  )

  const activeClientListReturnSnapshot = routeClientListReturnSnapshot
  const routeGroupListReturnSnapshot = readGroupListReturnSnapshot(
    window.history.state,
  )
  const activeGroupListReturnSnapshot = routeGroupListReturnSnapshot

  function getClientListHistoryState(
    nextRoute: AppRoute,
    snapshot: ClientListReturnSnapshot | null,
  ) {
    return stripGroupListReturnSnapshotFromHistoryState(
      getClientListReturnHistoryStateForRoute(
        window.history.state,
        nextRoute,
        snapshot,
      ),
    )
  }

  function saveClientListReturnState(snapshot: ClientListReturnSnapshot) {
    const entrySnapshot = withClientListReturnDepth(
      snapshot,
      getCurrentClientListReturnDepth(route, snapshot),
    )

    window.history.replaceState(
      mergeClientListReturnSnapshotIntoHistoryState(
        stripGroupListReturnSnapshotFromHistoryState(window.history.state),
        entrySnapshot,
      ),
      '',
      window.location.pathname,
    )
  }

  function navigateWithClientListReturnState(
    nextRoute: AppRoute,
    snapshot: ClientListReturnSnapshot | null,
    options: Omit<NavigateOptions, 'state'> = {},
  ) {
    if (
      snapshot &&
      ((route.kind === 'section' && route.section === 'Clients') ||
        route.kind === 'clientPreview')
    ) {
      saveClientListReturnState(snapshot)
    }

    const targetSnapshot = snapshot
      ? withClientListReturnDepth(
          snapshot,
          isAppRoute(route)
            ? getNextClientListReturnDepth(route, snapshot)
            : snapshot.returnDepth,
        )
      : null
    const nextState = getClientListHistoryState(nextRoute, targetSnapshot)

    navigate(nextRoute, {
      ...options,
      state: nextState,
    })
  }

  function getGroupListHistoryState(
    nextRoute: AppRoute,
    snapshot: GroupListReturnSnapshot | null,
  ) {
    return stripClientListReturnSnapshotFromHistoryState(
      getGroupListReturnHistoryStateForRoute(
        window.history.state,
        nextRoute,
        snapshot,
      ),
    )
  }

  function saveGroupListReturnState(snapshot: GroupListReturnSnapshot) {
    const entrySnapshot = withGroupListReturnDepth(
      snapshot,
      getCurrentGroupListReturnDepth(route, snapshot),
    )

    window.history.replaceState(
      mergeGroupListReturnSnapshotIntoHistoryState(
        stripClientListReturnSnapshotFromHistoryState(window.history.state),
        entrySnapshot,
      ),
      '',
      window.location.pathname,
    )
  }

  function navigateWithGroupListReturnState(
    nextRoute: AppRoute,
    snapshot: GroupListReturnSnapshot | null,
    options: Omit<NavigateOptions, 'state'> = {},
  ) {
    if (snapshot && route.kind === 'section' && route.section === 'Groups') {
      saveGroupListReturnState(snapshot)
    }

    const targetSnapshot = snapshot
      ? withGroupListReturnDepth(
          snapshot,
          isAppRoute(route)
            ? getNextGroupListReturnDepth(route, snapshot)
            : snapshot.returnDepth,
        )
      : null
    const nextState = getGroupListHistoryState(nextRoute, targetSnapshot)

    navigate(nextRoute, {
      ...options,
      state: nextState,
    })
  }

  function returnToClients() {
    if (
      (route.kind === 'clientDetails' || route.kind === 'clientPreview') &&
      activeClientListReturnSnapshot &&
      activeClientListReturnSnapshot.returnDepth > 0
    ) {
      window.history.go(-activeClientListReturnSnapshot.returnDepth)
      return
    }

    navigate(
      { kind: 'section', section: 'Clients' },
      {
        replace: route.kind === 'clientDetails' || route.kind === 'clientPreview',
        state: stripAppReturnSnapshotsFromHistoryState(window.history.state),
      },
    )
  }

  function returnToGroups() {
    if (
      route.kind === 'groupEdit' &&
      activeGroupListReturnSnapshot &&
      activeGroupListReturnSnapshot.returnDepth > 0
    ) {
      window.history.go(-activeGroupListReturnSnapshot.returnDepth)
      return
    }

    navigate(
      { kind: 'section', section: 'Groups' },
      {
        replace: route.kind === 'groupEdit',
        state: stripAppReturnSnapshotsFromHistoryState(window.history.state),
      },
    )
  }

  useEffect(() => {
    if (
      !isAppRoute(route) ||
      (!isClientListReturnRoute(route) && !isGroupListReturnRoute(route))
    ) {
      return
    }

    const previousScrollRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'

    return () => {
      window.history.scrollRestoration = previousScrollRestoration
    }
  }, [route])

  useEffect(() => {
    if (loadingSession) {
      return
    }

    const authenticatedUserId =
      session?.isAuthenticated && session.user ? session.user.id : null
    const previousAuthenticatedUserId = authenticatedUserBoundaryRef.current
    const crossedUserBoundary =
      authenticatedUserId === null ||
      (previousAuthenticatedUserId !== null &&
        previousAuthenticatedUserId !== authenticatedUserId)

    if (crossedUserBoundary) {
      window.history.replaceState(
        stripAppReturnSnapshotsFromHistoryState(window.history.state),
        '',
        window.location.pathname,
      )
      routeAccessBoundaryRef.current = null
    }

    authenticatedUserBoundaryRef.current = authenticatedUserId
  }, [loadingSession, session])

  useEffect(() => {
    const controller = new AbortController()

    async function bootstrap() {
      setLoadingSession(true)
      setBootstrapError(null)

      try {
        const currentSession = await loadSession(controller.signal)

        startTransition(() => {
          setSession(currentSession)
        })
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setBootstrapError(
          error instanceof Error
            ? error.message
            : 'Не удалось связаться с сервером.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoadingSession(false)
        }
      }
    }

    void bootstrap()

    return () => controller.abort()
  }, [])

  useEffect(() => {
    document.title = getAppDocumentTitle(
      displayedClubName,
      route,
      routeAccess,
      session,
      loadingSession,
      bootstrapError,
    )
  }, [
    bootstrapError,
    displayedClubName,
    loadingSession,
    route,
    routeAccess,
    session,
  ])

  useEffect(() => {
    if (!session?.isAuthenticated || !session.user || !routeAccess) {
      return
    }

    const previousRouteAccess = routeAccessBoundaryRef.current

    if (
      previousRouteAccess?.kind === 'allowed' &&
      routeAccess.kind === 'restricted' &&
      previousRouteAccess.requestedPath === routeAccess.requestedPath &&
      previousRouteAccess.requestedPath === pathname
    ) {
      routeAccessBoundaryRef.current = routeAccess

      showPoliteStatusNotification({
        id: `route-access-denied-${session.user.id}-${routeAccess.requestedPath}`,
        title: 'Открыт доступный раздел',
        message: getRouteAccessLossNotificationMessage(routeAccess),
        color: 'yellow',
      })

      navigate(routeAccess.recoveryPath, { replace: true })
      return
    }

    routeAccessBoundaryRef.current = routeAccess
  }, [navigate, pathname, routeAccess, session])

  async function retrySessionLoad() {
    setLoadingSession(true)
    setBootstrapError(null)

    try {
      const currentSession = await loadSession()

      startTransition(() => {
        setSession(currentSession)
      })
    } catch (error) {
      setBootstrapError(
        error instanceof Error
          ? error.message
          : 'Не удалось связаться с сервером.',
      )
    } finally {
      setLoadingSession(false)
    }
  }

  async function refreshSessionState() {
    const currentSession = await loadSession()

    startTransition(() => {
      setSession(currentSession)
    })

    return currentSession
  }

  async function handleLogin(values: LoginRequest) {
    setLoginPending(true)

    try {
      const currentSession = await login(values)

      startTransition(() => {
        setSession(currentSession)
      })

      if (currentSession.user && !currentSession.user.mustChangePassword) {
        navigate(getSectionPath(currentSession.user.landingScreen), {
          replace: true,
        })
      }
    } finally {
      setLoginPending(false)
    }
  }

  async function handleChangePassword(
    values: ChangePasswordRequest,
    mode: PasswordMode,
  ) {
    setPasswordPending(true)

    try {
      const currentSession = await changePassword(values)

      startTransition(() => {
        setSession(currentSession)
      })

      const nextSessionUser = currentSession.user
      if (nextSessionUser) {
        const postPasswordDecision = getPostPasswordReturnDecision(
          nextSessionUser,
          passwordReturnState,
        )

        navigate(postPasswordDecision.path, {
          replace: true,
        })
        setPasswordReturnState(null)

        if (postPasswordDecision.recoveryEvent) {
          showPoliteStatusNotification({
            id: 'auth-password-access-recovery',
            title: 'Пароль обновлен, открыт доступный раздел',
            message: `Пароль обновлен. ${getRouteAccessLossNotificationMessage(
              postPasswordDecision.recoveryEvent,
            )}`,
            color: 'yellow',
          })
          return
        }
      }

      showAppNotification({
        id: `auth-password-${mode}`,
        title: mode === 'forced' ? 'Первый вход завершен' : 'Пароль обновлен',
        message:
          mode === 'forced'
            ? 'Новая сессия уже активна, можно продолжать работу.'
            : 'Изменение сохранено и применено к текущей сессии.',
        color: 'teal',
      })
    } finally {
      setPasswordPending(false)
    }
  }

  async function handleLogout() {
    setLogoutPending(true)

    try {
      const currentSession = await logout()

      startTransition(() => {
        setSession(currentSession)
      })

      setPasswordReturnState(null)
      navigate('/', { replace: true })

      showAppNotification({
        id: 'auth-logout-success',
        title: 'Сессия завершена',
        message: `Вы вышли из ${displayedClubName}.`,
        color: 'gray',
      })
    } catch (error) {
      showAppNotification({
        id: 'auth-logout-error',
        title: 'Не удалось завершить сессию',
        message:
          error instanceof Error
            ? error.message
            : 'Попробуйте выполнить выход еще раз.',
        color: 'red',
      })
    } finally {
      setLogoutPending(false)
    }
  }

  function openUtilityPassword() {
    if (!session?.user || !routeAccess) {
      return
    }

    const nextReturnAccess = routeAccess

    setPasswordReturnState((route.kind === 'password')
      ? passwordReturnState
      : {
        path: pathname,
        access: nextReturnAccess,
      })
    navigate({ kind: 'password' })
  }

  if (loadingSession) {
    return <LoadingState authBackground={authBackground} clubName={displayedClubName} />
  }

  if (bootstrapError && !session) {
    return (
      <StageFrame authBackground={authBackground}>
        <Paper className="stage-card stage-card--error" radius="32px" shadow="lg" withBorder>
          <Stack gap="lg">
            <Stack gap={6}>
              <Text c="dimmed" fw={600} size="sm">
                Вход временно недоступен
              </Text>
              <Title order={2}>Не удалось открыть экран входа</Title>
              <Text c="dimmed">
                Проверьте подключение к сервису и повторите загрузку.
              </Text>
            </Stack>

            <Alert
              color="red"
              icon={<IconAlertCircle size={18} />}
              title="Сервис недоступен"
              variant="light"
            >
              {bootstrapError}
            </Alert>

            <Button
              onClick={() => void retrySessionLoad()}
              rightSection={<IconArrowRight size={18} />}
            >
              Повторить загрузку
            </Button>
          </Stack>
        </Paper>
      </StageFrame>
    )
  }

  if (!session?.isAuthenticated || !session.user) {
    return (
      <StageFrame authBackground={authBackground}>
        <LoginScreen
          clubName={displayedClubName}
          pending={loginPending}
          showSetupHelp={Boolean(session?.bootstrapMode)}
          onSubmit={handleLogin}
        />
      </StageFrame>
    )
  }

  if (session.user.mustChangePassword) {
    return (
      <StageFrame authBackground={authBackground}>
        <PasswordScreen
          mode="forced"
          pending={passwordPending}
          onSubmit={handleChangePassword}
        />
      </StageFrame>
    )
  }

  if (!routeAccess) {
    return null
  }

  const accessibleRoute = routeAccess?.kind === 'allowed' ? routeAccess.route : null
  const viewportRoute: Exclude<AppRoute, { kind: 'password' }> =
    accessibleRoute && accessibleRoute.kind !== 'password'
      ? accessibleRoute
      : { kind: 'section', section: 'Home' }
  const currentSection = accessibleRoute
    ? getRouteSection(accessibleRoute)
    : route.kind === 'not-found' || route.kind === 'password'
      ? null
      : getRouteSection(route)
  const authenticatedUser = session.user
  const recoveryPath = routeAccess.kind === 'restricted' || routeAccess.kind === 'not-found'
    ? routeAccess.recoveryPath
    : getDefaultRouteRecoveryDestination(authenticatedUser).recoveryPath

  return (
    <AuthenticatedShell
      clubName={displayedClubName}
      currentSection={currentSection}
      logoutPending={logoutPending}
      onLogout={handleLogout}
      onNavigateSection={(section) => navigate({ kind: 'section', section })}
      onOpenPassword={openUtilityPassword}
      user={authenticatedUser}
    >
      {route.kind === 'password' ? (
        <PasswordScreen
          mode="utility"
          onBack={() => {
            const postPasswordDecision = getPostPasswordReturnDecision(
              authenticatedUser,
              passwordReturnState,
            )

            navigate(postPasswordDecision.path, {
              replace: true,
            })
            setPasswordReturnState(null)

            if (postPasswordDecision.recoveryEvent) {
              showPoliteStatusNotification({
                id: 'auth-password-back-access-recovery',
                title: 'Открыт доступный раздел',
                message: getRouteAccessLossNotificationMessage(
                  postPasswordDecision.recoveryEvent,
                ),
                color: 'yellow',
              })
            }
          }}
          pending={passwordPending}
          onSubmit={handleChangePassword}
        />
      ) : routeAccess?.kind === 'restricted' ? (
        <RouteAccessState
          access={routeAccess}
          onRecovery={() => navigate(recoveryPath, { replace: true })}
        />
      ) : routeAccess?.kind === 'not-found' ? (
        <RouteNotFoundState
          onRecovery={() => navigate(recoveryPath, { replace: true })}
          recoveryLabel={routeAccess.recoveryLabel}
        />
      ) : (
        <RouteViewport
          onCreateClient={() => navigate({ kind: 'clientCreate' })}
          onEditClient={(clientId) => navigate({ kind: 'clientEdit', clientId })}
          onOpenClient={(clientId, returnSnapshot) =>
            navigateWithClientListReturnState(
              { kind: 'clientDetails', clientId },
              returnSnapshot ?? activeClientListReturnSnapshot,
            )
          }
          onPreviewClient={(clientId, returnSnapshot) =>
            navigateWithClientListReturnState(
              { kind: 'clientPreview', clientId },
              returnSnapshot ?? activeClientListReturnSnapshot,
            )
          }
          onCreateGroup={() => navigate({ kind: 'groupCreate' })}
          currentUserId={authenticatedUser.id}
          onEditGroup={(groupId, returnSnapshot) =>
            navigateWithGroupListReturnState(
              { kind: 'groupEdit', groupId },
              returnSnapshot ?? activeGroupListReturnSnapshot,
            )
          }
          onCreateUser={() => navigate({ kind: 'userCreate' })}
          onEditUser={(userId) => navigate({ kind: 'userEdit', userId })}
          onRefreshSession={refreshSessionState}
          onReturnToClients={returnToClients}
          onReturnToGroups={returnToGroups}
          onReturnToUsers={() => navigate({ kind: 'section', section: 'Users' })}
          clientListReturnSnapshot={activeClientListReturnSnapshot}
          groupListReturnSnapshot={activeGroupListReturnSnapshot}
          onSaveClientListReturnState={saveClientListReturnState}
          onSaveGroupListReturnState={saveGroupListReturnState}
          route={viewportRoute}
          user={authenticatedUser}
        />
      )}
    </AuthenticatedShell>
  )
}

type StageFrameProps = {
  authBackground: AuthStageBackground
  children: ReactNode
}

function StageFrame({ authBackground, children }: StageFrameProps) {
  return (
    <div
      className={getAuthPageClassName(authBackground)}
      style={getAuthBackgroundStyle(authBackground)}
    >
      <main className="auth-layout">{children}</main>
    </div>
  )
}

type LoginScreenProps = {
  clubName: string
  pending: boolean
  showSetupHelp: boolean
  onSubmit: (values: LoginRequest) => Promise<void>
}

function LoginScreen({
  clubName,
  pending,
  showSetupHelp,
  onSubmit,
}: LoginScreenProps) {
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<LoginRequest>({
    initialValues: {
      login: '',
      password: '',
    },
    validate: {
      login: (value) => (value.trim() ? null : 'Введите логин.'),
      password: (value) => (value ? null : 'Введите пароль.'),
    },
  })

  async function submit(values: LoginRequest) {
    setFormError(null)
    form.clearErrors()

    try {
      await onSubmit({
        login: values.login.trim(),
        password: values.password,
      })
    } catch (error) {
      if (error instanceof ApiError) {
        form.setErrors(applyFieldErrors(error.fieldErrors))
        setFormError(error.message)
        return
      }

      setFormError('Не удалось выполнить вход. Попробуйте еще раз.')
    }
  }

  return (
    <Paper className="stage-card stage-card--login" radius="32px" shadow="lg" withBorder>
      <Stack className="login-card__body" gap="xl">
        <Stack className="login-card__header" gap="md">
          <Text className="login-card__brand" fw={800} title={clubName}>
            {clubName}
          </Text>
          <Title className="login-card__title" order={1}>
            Добро пожаловать!
          </Title>
        </Stack>

        {formError ? (
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            title="Вход не выполнен"
            variant="light"
          >
            {formError}
          </Alert>
        ) : null}

        <form className="login-form" onSubmit={form.onSubmit((values) => void submit(values))}>
          <Stack gap="md">
            <TextInput
              autoComplete="username"
              disabled={pending}
              label="Логин"
              leftSection={<IconUserCircle size={20} />}
              placeholder="Введите логин"
              {...form.getInputProps('login')}
            />
            <PasswordInput
              autoComplete="current-password"
              disabled={pending}
              label="Пароль"
              leftSection={<IconLockPassword size={20} />}
              placeholder="Введите пароль"
              {...form.getInputProps('password')}
            />

            <Button
              className="auth-submit-button"
              fullWidth
              loading={pending}
              rightSection={<IconArrowRight size={18} />}
              size="md"
              type="submit"
            >
              Войти
            </Button>

            {showSetupHelp ? <SetupDisclosure /> : null}
          </Stack>
        </form>
      </Stack>
    </Paper>
  )
}

function SetupDisclosure() {
  return (
    <details className="setup-disclosure">
      <summary>Первый запуск системы</summary>
      <Stack className="setup-disclosure__content" gap="xs">
        <Group gap="xs">
          <ThemeIcon color="var(--crm-action-primary)" radius="xl" size={28} variant="light">
            <IconSparkles size={16} />
          </ThemeIcon>
          <Text fw={700}>Стартовые данные</Text>
        </Group>
        <Text c="dimmed" size="sm">
          Если логин первого пользователя не переопределен на сервере,
          используйте <code>headcoach</code>. Стартовый пароль: <code>12345678</code>.
        </Text>
      </Stack>
    </details>
  )
}

type PasswordScreenProps = {
  mode: PasswordMode
  pending: boolean
  onSubmit: (
    values: ChangePasswordRequest,
    mode: PasswordMode,
  ) => Promise<void>
  onBack?: () => void
}

type PasswordFormValues = ChangePasswordRequest & {
  confirmPassword: string
}

function PasswordScreen({
  mode,
  pending,
  onSubmit,
  onBack,
}: PasswordScreenProps) {
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<PasswordFormValues>({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validate: {
      currentPassword: (value) => (value ? null : 'Введите текущий пароль.'),
      newPassword: (value) => (value ? null : 'Введите новый пароль.'),
      confirmPassword: (value, values) =>
        value === values.newPassword ? null : 'Пароли должны совпадать.',
    },
  })

  async function submit(values: PasswordFormValues) {
    setFormError(null)
    form.clearErrors()

    try {
      await onSubmit(
        {
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        },
        mode,
      )
    } catch (error) {
      if (error instanceof ApiError) {
        form.setErrors(applyFieldErrors(error.fieldErrors))
        setFormError(error.message)
        return
      }

      setFormError('Не удалось сохранить новый пароль. Попробуйте еще раз.')
    }
  }

  const title =
    mode === 'forced'
      ? 'Смените пароль'
      : 'Смена пароля из профиля'
  const description =
    mode === 'forced'
      ? 'Введите текущий временный пароль и задайте новый для дальнейшей работы.'
      : 'Обновите пароль, который будете использовать при следующих входах.'

  return (
    <Paper
      className={mode === 'forced' ? 'stage-card' : 'utility-card'}
      radius="32px"
      shadow="lg"
      withBorder
    >
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap">
          <Stack gap={6}>
            <Title order={mode === 'forced' ? 1 : 2}>{title}</Title>
            <Text c="dimmed">{description}</Text>
          </Stack>

          {mode === 'utility' && onBack ? (
            <Button
              leftSection={<IconArrowLeft size={18} />}
              onClick={onBack}
              variant="subtle"
            >
              Назад
            </Button>
          ) : null}
        </Group>

        {formError ? (
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            title="Изменение не сохранено"
            variant="light"
          >
            {formError}
          </Alert>
        ) : null}

        <form onSubmit={form.onSubmit((values) => void submit(values))}>
          <Stack gap="md">
            <PasswordInput
              autoComplete="current-password"
              label="Текущий пароль"
              placeholder="Введите текущий пароль"
              {...form.getInputProps('currentPassword')}
            />
            <PasswordInput
              autoComplete="new-password"
              label="Новый пароль"
              placeholder="Придумайте новый пароль"
              {...form.getInputProps('newPassword')}
            />
            <PasswordInput
              autoComplete="new-password"
              label="Повторите новый пароль"
              placeholder="Повторите новый пароль"
              {...form.getInputProps('confirmPassword')}
            />

            <Button
              loading={pending}
              rightSection={<IconLockPassword size={18} />}
              size="md"
              type="submit"
            >
              {mode === 'forced' ? 'Сменить пароль и продолжить' : 'Сохранить новый пароль'}
            </Button>

            {mode === 'utility' ? (
              <Paper className="hint-card" radius="24px" withBorder>
                <Stack gap={6}>
                  <Group gap="xs">
                    <ThemeIcon color="var(--crm-action-primary)" radius="xl" size={28} variant="light">
                      <IconShieldCheck size={16} />
                    </ThemeIcon>
                    <Text fw={700}>Пароль обновится сразу</Text>
                  </Group>
                  <Text c="dimmed" size="sm">
                    Используйте новый пароль при следующих входах.
                  </Text>
                </Stack>
              </Paper>
            ) : null}
          </Stack>
        </form>
      </Stack>
    </Paper>
  )
}

type AuthenticatedShellProps = {
  clubName: string
  user: AuthenticatedUser
  currentSection: AppSection | null
  logoutPending: boolean
  onNavigateSection: (section: AppSection) => void
  onOpenPassword: () => void
  onLogout: () => Promise<void>
  children: ReactNode
}

function AuthenticatedShell({
  clubName,
  user,
  currentSection,
  logoutPending,
  onNavigateSection,
  onOpenPassword,
  onLogout,
  children,
}: AuthenticatedShellProps) {
  const presentation = rolePresentationMap[user.role]
  const landingLabel = APP_SECTION_LABELS[user.landingScreen]
  const navigationSections = getAccessibleNavigationSections(user)

  function handleSectionNavigation(section: AppSection) {
    onNavigateSection(section)
  }

  function handleOpenPassword() {
    onOpenPassword()
  }

  async function handleLogoutAction() {
    await onLogout()
  }

  const profileControl = (
    <Menu position="bottom-end" shadow="md" width={250}>
      <Menu.Target>
        <UnstyledButton
          aria-label={`Открыть профильное меню пользователя ${user.fullName}`}
          className="app-shell__profile-trigger"
        >
          <IconUserCircle size={18} />
          <span className="app-shell__profile-name">{user.fullName}</span>
          <IconChevronDown className="app-shell__profile-chevron" size={16} />
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>{user.fullName}</Menu.Label>
        <Menu.Label>{presentation.roleLabel}</Menu.Label>
        <Menu.Item
          leftSection={<IconLockPassword size={16} />}
          onClick={handleOpenPassword}
        >
          Смена пароля
        </Menu.Item>
        <Menu.Item
          color="red"
          disabled={logoutPending}
          leftSection={<IconDoorExit size={16} />}
          onClick={() => void handleLogoutAction()}
        >
          {logoutPending ? 'Завершаем сессию...' : 'Выход'}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )

  const shellNavigation = (
    <div className="app-shell__navbar-inner">
      <NavigationTabs
        className="app-shell__side-nav"
        currentSection={currentSection}
        onNavigate={handleSectionNavigation}
        orientation="vertical"
        sections={navigationSections}
      />
    </div>
  )

  return (
    <>
      <AppLayout
        header={(
          <Header
            brandTitle={clubName}
            brandMeta={`${presentation.roleLabel} • стартовый раздел: ${landingLabel}`}
            brandMetaCompact={presentation.roleLabel}
            profileControl={profileControl}
          />
        )}
        navbar={shellNavigation}
      >
        {children}
      </AppLayout>

      <MobileBottomNavigation
        currentSection={currentSection}
        onNavigate={handleSectionNavigation}
        sections={navigationSections}
      />
    </>
  )
}

type RouteViewportProps = {
  route: Exclude<AppRoute, { kind: 'password' }>
  user: AuthenticatedUser
  currentUserId: string
  onCreateGroup: () => void
  onEditGroup: (
    groupId: string,
    returnSnapshot?: GroupListReturnSnapshot | null,
  ) => void
  onCreateClient: () => void
  onEditClient: (clientId: string) => void
  clientListReturnSnapshot: ClientListReturnSnapshot | null
  groupListReturnSnapshot: GroupListReturnSnapshot | null
  onOpenClient: (
    clientId: string,
    returnSnapshot?: ClientListReturnSnapshot | null,
  ) => void
  onPreviewClient: (
    clientId: string,
    returnSnapshot?: ClientListReturnSnapshot | null,
  ) => void
  onCreateUser: () => void
  onEditUser: (userId: string) => void
  onRefreshSession: () => Promise<unknown>
  onReturnToClients: () => void
  onReturnToGroups: () => void
  onReturnToUsers: () => void
  onSaveClientListReturnState: (snapshot: ClientListReturnSnapshot) => void
  onSaveGroupListReturnState: (snapshot: GroupListReturnSnapshot) => void
}

function RouteViewport({
  route,
  user,
  currentUserId,
  clientListReturnSnapshot,
  groupListReturnSnapshot,
  onCreateClient,
  onEditClient,
  onOpenClient,
  onPreviewClient,
  onCreateGroup,
  onEditGroup,
  onCreateUser,
  onEditUser,
  onRefreshSession,
  onReturnToClients,
  onReturnToGroups,
  onReturnToUsers,
  onSaveClientListReturnState,
  onSaveGroupListReturnState,
}: RouteViewportProps) {
  const isUsersWorkflow =
    route.kind === 'userCreate' ||
    route.kind === 'userEdit' ||
    (route.kind === 'section' && route.section === 'Users')

  if (isUsersWorkflow) {
    return (
      <UsersWorkflowViewport
        currentUserId={currentUserId}
        onCreateUser={onCreateUser}
        onEditUser={onEditUser}
        onRefreshSession={onRefreshSession}
        onReturnToUsers={onReturnToUsers}
        route={route}
      />
    )
  }

  if (route.kind === 'clientCreate') {
    return (
      <ClientCreateScreen
        onCancel={onReturnToClients}
        onCreated={(clientId) => {
          if (clientId) {
            onOpenClient(clientId)
            return
          }

          onReturnToClients()
        }}
      />
    )
  }

  if (route.kind === 'clientDetails') {
    return (
      <ClientDetailScreen
        canManage={user.permissions.canManageClients}
        clientId={route.clientId}
        onBack={onReturnToClients}
        onEdit={onEditClient}
      />
    )
  }

  if (route.kind === 'clientPreview') {
    return (
      <ClientsListScreen
        canManage={user.permissions.canManageClients}
        canSeeWithoutGroupQuickFilter={user.permissions.canManageClients}
        currentUserBranchId={user.branchId}
        initialReturnSnapshot={clientListReturnSnapshot}
        key={`client-preview:${route.clientId}`}
        onCreate={onCreateClient}
        onOpen={onOpenClient}
        onPreview={onPreviewClient}
        previewClientId={route.clientId}
        onSaveReturnState={onSaveClientListReturnState}
      />
    )
  }

  if (route.kind === 'clientEdit') {
    return (
      <ClientEditScreen
        clientId={route.clientId}
        onBack={() => onOpenClient(route.clientId)}
        onUpdated={onOpenClient}
      />
    )
  }

  if (route.kind === 'groupCreate') {
    return (
      <GroupCreateScreen
        onCancel={onReturnToGroups}
        onCreated={onReturnToGroups}
      />
    )
  }

  if (route.kind === 'groupEdit') {
    return (
      <GroupEditScreen
        groupId={route.groupId}
        onBack={onReturnToGroups}
        onUpdated={onReturnToGroups}
      />
    )
  }

  if (route.section === 'Clients') {
    return (
      <ClientsListScreen
        canManage={user.permissions.canManageClients}
        canSeeWithoutGroupQuickFilter={user.permissions.canManageClients}
        currentUserBranchId={user.branchId}
        initialReturnSnapshot={clientListReturnSnapshot}
        key="clients-list"
        onCreate={onCreateClient}
        onOpen={onOpenClient}
        onPreview={onPreviewClient}
        onSaveReturnState={onSaveClientListReturnState}
      />
    )
  }

  if (route.section === 'Groups') {
    return (
      <GroupsListScreen
        initialReturnSnapshot={groupListReturnSnapshot}
        onCreate={onCreateGroup}
        onEdit={onEditGroup}
        onSaveReturnState={onSaveGroupListReturnState}
      />
    )
  }

  if (route.section === 'Schedule') {
    return (
      <GroupScheduleScreen
        canManageGroups={user.permissions.canManageGroups}
        onEditGroup={onEditGroup}
        viewerRole={user.role}
      />
    )
  }

  if (route.section === 'Audit') {
    return <AuditLogScreen user={user} />
  }

  if (route.section === 'Finance') {
    return <FinanceReportsScreen user={user} />
  }

  if (route.section === 'Settings') {
    return <SettingsScreen user={user} />
  }

  if (route.section === 'Home') {
    return <HomeDashboard onOpenClient={onOpenClient} user={user} />
  }

  return <SectionPlaceholder />
}

type UsersWorkflowViewportProps = {
  currentUserId: string
  onCreateUser: () => void
  onEditUser: (userId: string) => void
  onRefreshSession: () => Promise<unknown>
  onReturnToUsers: () => void
  route: Exclude<AppRoute, { kind: 'password' }>
}

function UsersWorkflowViewport({
  currentUserId,
  onCreateUser,
  onEditUser,
  onRefreshSession,
  onReturnToUsers,
  route,
}: UsersWorkflowViewportProps) {
  const [trainerQuery, setTrainerQuery] = useState('')

  if (route.kind === 'userCreate') {
    return (
      <UserCreateScreen
        onCancel={onReturnToUsers}
        onCreated={onReturnToUsers}
      />
    )
  }

  if (route.kind === 'userEdit') {
    return (
      <UserEditScreen
        currentUserId={currentUserId}
        onBack={onReturnToUsers}
        onRefreshSession={onRefreshSession}
        userId={route.userId}
      />
    )
  }

  return (
    <UsersListScreen
      onCreate={onCreateUser}
      onEdit={onEditUser}
      onQueryChange={setTrainerQuery}
      query={trainerQuery}
    />
  )
}

type RouteAccessStateProps = {
  access: Extract<RouteAccessResolution, { kind: 'restricted' }>
  onRecovery: () => void
}

function RouteAccessState({ access, onRecovery }: RouteAccessStateProps) {
  const description =
    access.reason.kind === 'section'
      ? `У вас нет доступа к разделу «${access.requestedDestinationLabel}».`
      : `У вас нет доступа к операции «${access.requestedDestinationLabel}».`

  return (
    <PageLayout
      className="route-state-layout"
      renderHiddenHeading={false}
      showHeader={false}
      title="Нет доступа"
    >
      <RestrictedState
        className="route-state"
        description={description}
        focusOnMount="heading"
        primaryAction={(
          <Button fullWidth onClick={onRecovery}>
            Открыть {access.recoveryLabel}
          </Button>
        )}
        title="Нет доступа"
        titleOrder={1}
      />
    </PageLayout>
  )
}

type RouteNotFoundStateProps = {
  onRecovery: () => void
  recoveryLabel: string
}

function RouteNotFoundState({
  onRecovery,
  recoveryLabel,
}: RouteNotFoundStateProps) {
  return (
    <PageLayout
      className="route-state-layout"
      renderHiddenHeading={false}
      showHeader={false}
      title="Страница не найдена"
    >
      <RestrictedState
        className="route-state"
        description="Такой страницы нет или ссылка устарела."
        focusOnMount="heading"
        primaryAction={(
          <Button fullWidth onClick={onRecovery}>
            Открыть {recoveryLabel}
          </Button>
        )}
        title="Страница не найдена"
        titleOrder={1}
      />
    </PageLayout>
  )
}

function SectionPlaceholder() {
  return (
    <PageLayout title="Раздел">
      <PageSection>
        <Stack gap="md">
          <Alert
            color="blue"
            icon={<IconCheck size={18} />}
            title="Раздел пока недоступен"
            variant="light"
          >
            Экран будет подключен отдельным обновлением.
          </Alert>
        </Stack>
      </PageSection>
    </PageLayout>
  )
}

type LoadingStateProps = {
  authBackground: AuthStageBackground
  clubName: string
}

function LoadingState({ authBackground, clubName }: LoadingStateProps) {
  const title = `Открываем ${clubName}`

  return (
    <div
      className={getAuthPageClassName(authBackground)}
      style={getAuthBackgroundStyle(authBackground)}
    >
      <Container className="loading-layout" size="sm">
        <Paper className="loading-card" radius="32px" shadow="lg" withBorder>
          <Stack align="center" gap="md">
            <Loader color="var(--crm-action-primary)" size="lg" />
            <Title className="brand-heading" order={3} title={title}>
              {title}
            </Title>
            <Text c="dimmed" ta="center">
              Проверяем, есть ли активный вход, и готовим экран авторизации.
            </Text>
          </Stack>
        </Paper>
      </Container>
    </div>
  )
}

function getAuthPageClassName(authBackground: AuthStageBackground) {
  return authBackground.asset
    ? 'gym-crm-page gym-crm-page--auth gym-crm-page--auth-image'
    : 'gym-crm-page gym-crm-page--auth gym-crm-page--auth-solid'
}

function getAuthBackgroundStyle(authBackground: AuthStageBackground) {
  return {
    '--crm-auth-background-image': authBackground.asset
      ? `url("${authBackground.asset}")`
      : 'none',
    '--crm-auth-background-position': `${authBackground.focalPoint.xPercent}% ${authBackground.focalPoint.yPercent}%`,
  } as CSSProperties
}

export default App
