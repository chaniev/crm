import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  Alert,
  Button,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconArrowRight,
} from '@tabler/icons-react'
import {
  changePassword,
  loadSession,
  login,
  logout,
  type AppConfigResponse,
  type ChangePasswordRequest,
  type LoginRequest,
  type SessionResponse,
} from './lib/api'
import type { AuthStageBackground } from './theme'
import {
  getDefaultRouteRecoveryDestination,
  getSectionPath,
  resolveRouteAccess,
  type AppRoute,
  type RouteAccessResolution,
} from './lib/appRoutes'
import {
  LoadingState,
  LoginScreen,
  PasswordScreen,
  StageFrame,
  type PasswordMode,
} from './app/AuthStages'
import { AuthenticatedShell } from './app/AuthenticatedShell'
import {
  RouteAccessState,
  RouteNotFoundState,
  RouteViewport,
} from './app/RouteViewport'
import {
  getCurrentSection,
  getPostPasswordReturnDecision,
  getRouteAccessLossNotificationMessage,
  useAppDocumentTitle,
  useAppRoute,
  type PasswordReturnState,
} from './app/useAppRoute'
import {
  getClientProfileBackLabel,
  useAppReturnNavigation,
} from './app/useAppReturnNavigation'
import {
  showAppNotification,
  showPoliteStatusNotification,
} from './features/shared/notifications'
import './App.css'
import { fe1AppShellAuthText } from './resources/fe-1-app-shell-auth'


export type AppProps = {
  appConfig: AppConfigResponse
  authBackground: AuthStageBackground
}

export function App({ appConfig, authBackground }: AppProps) {
  const {
    clearCurrentReturnSnapshots,
    navigate,
    pathname,
    route,
  } = useAppRoute()
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const [loginPending, setLoginPending] = useState(false)
  const [passwordPending, setPasswordPending] = useState(false)
  const [logoutPending, setLogoutPending] = useState(false)
  const [passwordReturnState, setPasswordReturnState] =
    useState<PasswordReturnState | null>(null)
  const authenticatedUserBoundaryRef = useRef<string | null>(null)
  const routeAccessBoundaryRef = useRef<RouteAccessResolution | null>(null)
  const displayedClubName = appConfig.clubName

  const routeAccess = useMemo(() => {
    if (!session?.isAuthenticated || !session.user || session.user.mustChangePassword) {
      return null
    }

    return resolveRouteAccess(session.user, route)
  }, [route, session])

  const {
    activeClientListReturnSnapshot,
    activeClientProfileReturnContext,
    activeGroupListReturnSnapshot,
    editClient,
    openClientDetails,
    returnToClients,
    returnToGroups,
    returnToSchedule,
    saveClientListReturnState,
    saveGroupListReturnState,
    navigateWithClientListReturnState,
    navigateWithGroupListReturnState,
    navigateWithScheduleReturnState,
  } = useAppReturnNavigation({
    canManageClients: session?.user?.permissions.canManageClients ?? false,
    navigate,
    route,
  })

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
      clearCurrentReturnSnapshots()
      routeAccessBoundaryRef.current = null
    }

    authenticatedUserBoundaryRef.current = authenticatedUserId
  }, [clearCurrentReturnSnapshots, loadingSession, session])

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
            : fe1AppShellAuthText.app_string_ac621ca1,
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

  useAppDocumentTitle({
    bootstrapError,
    clubName: displayedClubName,
    loadingSession,
    route,
    routeAccess,
    session,
  })

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
        title: fe1AppShellAuthText.app_title_8eefda54,
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
          : fe1AppShellAuthText.app_string_ac621ca1,
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
            title: fe1AppShellAuthText.app_title_619ea5c7,
            message: fe1AppShellAuthText.app_message_1ffa77b1(getRouteAccessLossNotificationMessage(
              postPasswordDecision.recoveryEvent,
            )),
            color: 'yellow',
          })
          return
        }
      }

      showAppNotification({
        id: `auth-password-${mode}`,
        title: mode === 'forced' ? fe1AppShellAuthText.app_string_44c2ac7c : fe1AppShellAuthText.app_string_3ded90c0,
        message:
          mode === 'forced'
            ? fe1AppShellAuthText.app_string_8ad4d05f
            : fe1AppShellAuthText.app_string_e9d1ffdc,
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
        title: fe1AppShellAuthText.app_title_311bf7c1,
        message: fe1AppShellAuthText.app_message_1cfdd5fd(displayedClubName),
        color: 'gray',
      })
    } catch (error) {
      showAppNotification({
        id: 'auth-logout-error',
        title: fe1AppShellAuthText.app_title_7d2f9bda,
        message:
          error instanceof Error
            ? error.message
            : fe1AppShellAuthText.app_string_125fb9c9,
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

  function returnFromUtilityPassword() {
    if (!session?.user) {
      return
    }

    const postPasswordDecision = getPostPasswordReturnDecision(
      session.user,
      passwordReturnState,
    )

    navigate(postPasswordDecision.path, {
      replace: true,
    })
    setPasswordReturnState(null)

    if (postPasswordDecision.recoveryEvent) {
      showPoliteStatusNotification({
        id: 'auth-password-back-access-recovery',
        title: fe1AppShellAuthText.app_title_8eefda54,
        message: getRouteAccessLossNotificationMessage(
          postPasswordDecision.recoveryEvent,
        ),
        color: 'yellow',
      })
    }
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
                {fe1AppShellAuthText.app_jsxText_9e550fe5}</Text>
              <Title order={2}>{fe1AppShellAuthText.app_jsxText_2bf6591e}</Title>
              <Text c="dimmed">
                {fe1AppShellAuthText.app_jsxText_10995e5b}</Text>
            </Stack>

            <Alert
              color="red"
              icon={<IconAlertCircle size={18} />}
              title={fe1AppShellAuthText.app_title_42260baf}
              variant="light"
            >
              {bootstrapError}
            </Alert>

            <Button
              onClick={() => void retrySessionLoad()}
              rightSection={<IconArrowRight size={18} />}
            >
              {fe1AppShellAuthText.app_jsxText_298e4132}</Button>
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

  const authenticatedUser = session.user
  const accessibleRoute = routeAccess.kind === 'allowed' ? routeAccess.route : null
  const viewportRoute: Exclude<AppRoute, { kind: 'password' }> =
    accessibleRoute && accessibleRoute.kind !== 'password'
      ? accessibleRoute
      : { kind: 'section', section: authenticatedUser.landingScreen }
  const currentSection = getCurrentSection(accessibleRoute, route)
  const recoveryPath = routeAccess.kind === 'restricted' || routeAccess.kind === 'not-found'
    ? routeAccess.recoveryPath
    : getDefaultRouteRecoveryDestination(authenticatedUser).recoveryPath
  const mainLabel = getMainLandmarkLabel(routeAccess)

  return (
    <AuthenticatedShell
      clubName={displayedClubName}
      currentSection={currentSection}
      logoutPending={logoutPending}
      onLogout={handleLogout}
      onNavigateSection={(section) => navigate({ kind: 'section', section })}
      onOpenPassword={openUtilityPassword}
      mainLabel={mainLabel}
      user={authenticatedUser}
    >
      {route.kind === 'password' ? (
        <PasswordScreen
          mode="utility"
          onBack={returnFromUtilityPassword}
          pending={passwordPending}
          onSubmit={handleChangePassword}
        />
      ) : routeAccess.kind === 'restricted' ? (
        <RouteAccessState
          access={routeAccess}
          onRecovery={() => navigate(recoveryPath, { replace: true })}
        />
      ) : routeAccess.kind === 'not-found' ? (
        <RouteNotFoundState
          onRecovery={() => navigate(recoveryPath, { replace: true })}
          recoveryLabel={routeAccess.recoveryLabel}
        />
      ) : (
        <RouteViewport
          onCreateClient={() => navigate({ kind: 'clientCreate' })}
          onEditClient={editClient}
          onOpenClient={openClientDetails}
          onPreviewClient={(clientId, returnSnapshot) =>
            navigateWithClientListReturnState(
              { kind: 'clientPreview', clientId },
              returnSnapshot ?? activeClientListReturnSnapshot,
            )
          }
          onCreateGroup={() => navigate({ kind: 'groupCreate' })}
          onCreateScheduleLesson={() =>
            navigateWithScheduleReturnState({ kind: 'scheduleLessonCreate' })
          }
          currentUserId={authenticatedUser.id}
          onEditScheduleLesson={(lessonOccurrenceId, lessonDate) =>
            navigateWithScheduleReturnState({
              kind: 'scheduleLessonEdit',
              lessonOccurrenceId,
              lessonDate,
              scope: 'occurrence',
            }, lessonOccurrenceId)
          }
          onEditScheduleSeries={(lesson, scope) => {
            if (!lesson.lessonSeriesId) {
              return
            }

            navigateWithScheduleReturnState({
              kind: 'scheduleSeriesEdit',
              lessonSeriesId: lesson.lessonSeriesId,
              scope,
              groupId: lesson.groupId,
              lessonOccurrenceId: lesson.lessonOccurrenceId,
              lessonDate: lesson.lessonDate,
            }, lesson.lessonOccurrenceId)
          }}
          onMoveScheduleLesson={(lessonOccurrenceId, lessonDate) =>
            navigateWithScheduleReturnState(
              { kind: 'scheduleLessonMove', lessonOccurrenceId, lessonDate },
              lessonOccurrenceId,
            )
          }
          onOpenAttendanceLesson={(lessonOccurrenceId, lessonDate) =>
            navigateWithScheduleReturnState(
              { kind: 'attendanceLesson', lessonOccurrenceId, lessonDate },
              lessonOccurrenceId,
            )
          }
          onOpenAttendanceTodayLesson={(lessonOccurrenceId, lessonDate) =>
            navigate({ kind: 'attendanceLesson', lessonOccurrenceId, lessonDate })
          }
          onOpenScheduleLesson={(lessonOccurrenceId, lessonDate) =>
            navigateWithScheduleReturnState(
              { kind: 'scheduleLessonDetail', lessonOccurrenceId, lessonDate },
              lessonOccurrenceId,
            )
          }
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
          onReturnToSchedule={returnToSchedule}
          onReturnToUsers={() => navigate({ kind: 'section', section: 'Users' })}
          clientListReturnSnapshot={activeClientListReturnSnapshot}
          clientProfileReturnContext={activeClientProfileReturnContext}
          clientProfileReturnLabel={getClientProfileBackLabel(
            route,
            activeClientProfileReturnContext,
          )}
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

export default App

function getMainLandmarkLabel(routeAccess: RouteAccessResolution) {
  if (routeAccess.kind === 'restricted') {
    return fe1AppShellAuthText.app_string_28e033b4
  }

  if (routeAccess.kind === 'not-found') {
    return fe1AppShellAuthText.app_string_af9d3306
  }

  return routeAccess.requestedDestinationLabel
}
