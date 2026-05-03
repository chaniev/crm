import { startTransition, useEffect, useState, type ReactNode } from 'react'
import {
  Alert,
  Badge,
  Button,
  Container,
  Group,
  Loader,
  Menu,
  Paper,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconArrowRight,
  IconChevronDown,
  IconCheck,
  IconDoorExit,
  IconLockPassword,
  IconRoute,
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
  type AppSection,
  type AuthenticatedUser,
  type ChangePasswordRequest,
  type LoginRequest,
  type SessionResponse,
} from './lib/api'
import {
  APP_SECTION_LABELS,
  getAccessibleNavigationSections,
  getRoutePath,
  getRouteSection,
  getSectionPath,
  normalizePathname,
  parseRoute,
  resolveAccessibleRoutePath,
  type AppRoute,
} from './lib/appRoutes'
import {
  ClientCreateScreen,
  ClientDetailScreen,
  ClientEditScreen,
  ClientsListScreen,
} from './features/clients/ClientManagement'
import { AttendanceScreen } from './features/attendance/AttendanceScreen'
import { HomeDashboard } from './features/home/HomeDashboard'
import {
  GroupCreateScreen,
  GroupEditScreen,
  GroupsListScreen,
} from './features/groups/GroupManagement'
import {
  UserCreateScreen,
  UserEditScreen,
  UsersListScreen,
} from './features/users/UserManagement'
import { AuditLogScreen } from './features/audit/AuditLogScreen'
import { AppLayout, Header, NavigationTabs } from './features/shared/ux'
import './App.css'

type PasswordMode = 'forced' | 'utility'

type RolePresentation = {
  roleLabel: string
}

type NavigateOptions = {
  replace?: boolean
}

const rolePresentationMap: Record<AuthenticatedUser['role'], RolePresentation> = {
  HeadCoach: {
    roleLabel: 'Главный тренер',
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

    if (nextPath === pathname) {
      return
    }

    if (options.replace) {
      window.history.replaceState(window.history.state, '', nextPath)
    } else {
      window.history.pushState(window.history.state, '', nextPath)
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

function getPostPasswordPath(
  user: AuthenticatedUser,
  passwordReturnPath: string | null,
) {
  if (!passwordReturnPath) {
    return getSectionPath(user.landingScreen)
  }

  return resolveAccessibleRoutePath(user, parseRoute(passwordReturnPath))
}

function App() {
  const { navigate, pathname, route } = useAppRoute()
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const [loginPending, setLoginPending] = useState(false)
  const [passwordPending, setPasswordPending] = useState(false)
  const [logoutPending, setLogoutPending] = useState(false)
  const [passwordReturnPath, setPasswordReturnPath] = useState<string | null>(null)

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
    if (!session?.isAuthenticated || !session.user || session.user.mustChangePassword) {
      return
    }

    const accessiblePath = resolveAccessibleRoutePath(session.user, route)
    if (accessiblePath !== pathname) {
      navigate(accessiblePath, { replace: true })
    }
  }, [navigate, pathname, route, session])

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

      if (currentSession.user) {
        navigate(getPostPasswordPath(currentSession.user, passwordReturnPath), {
          replace: true,
        })
      }

      setPasswordReturnPath(null)

      notifications.show({
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

      setPasswordReturnPath(null)
      navigate('/', { replace: true })

      notifications.show({
        title: 'Сессия завершена',
        message: 'Вы вышли из Gym CRM.',
        color: 'gray',
      })
    } catch (error) {
      notifications.show({
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
    setPasswordReturnPath(route.kind === 'password' ? passwordReturnPath : pathname)
    navigate({ kind: 'password' })
  }

  if (loadingSession) {
    return <LoadingState />
  }

  if (bootstrapError && !session) {
    return (
      <StageFrame
        storyDescription="Работа с клиентами, расписанием и командой в одном интерфейсе."
        storyPoints={[
          'Клиенты и абонементы',
          'Расписание и посещаемость',
          'Команда и роли доступа',
        ]}
        storyTitle="Gym CRM для спортивного клуба"
      >
        <Paper className="stage-card" radius="32px" shadow="lg" withBorder>
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
      <StageFrame
        storyDescription="Работа с клиентами, расписанием и командой в одном интерфейсе."
        storyPoints={[
          'Клиенты и абонементы',
          'Расписание и посещаемость',
          'Команда и роли доступа',
        ]}
        storyTitle="Gym CRM для спортивного клуба"
      >
        <LoginScreen
          pending={loginPending}
          showSetupHelp={Boolean(session?.bootstrapMode)}
          onSubmit={handleLogin}
        />
      </StageFrame>
    )
  }

  if (session.user.mustChangePassword) {
    return (
      <StageFrame
        storyDescription="После обновления пароля откроется рабочий интерфейс с доступными разделами."
        storyPoints={[
          'Персональный доступ для сотрудника',
          'Понятные роли в команде',
          'Безопасное начало работы',
        ]}
        storyTitle="Защитите учетную запись"
      >
        <PasswordScreen
          mode="forced"
          pending={passwordPending}
          onSubmit={handleChangePassword}
        />
      </StageFrame>
    )
  }

  const currentSection = getRouteSection(route)
  const authenticatedUser = session.user

  return (
    <AuthenticatedShell
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
            navigate(getPostPasswordPath(authenticatedUser, passwordReturnPath), {
              replace: true,
            })
            setPasswordReturnPath(null)
          }}
          pending={passwordPending}
          onSubmit={handleChangePassword}
        />
      ) : (
        <RouteViewport
          onCreateClient={() => navigate({ kind: 'clientCreate' })}
          onEditClient={(clientId) => navigate({ kind: 'clientEdit', clientId })}
          onOpenClient={(clientId) => navigate({ kind: 'clientDetails', clientId })}
          onCreateGroup={() => navigate({ kind: 'groupCreate' })}
          currentUserId={authenticatedUser.id}
          onEditGroup={(groupId) => navigate({ kind: 'groupEdit', groupId })}
          onCreateUser={() => navigate({ kind: 'userCreate' })}
          onEditUser={(userId) => navigate({ kind: 'userEdit', userId })}
          onRefreshSession={refreshSessionState}
          onReturnToClients={() => navigate({ kind: 'section', section: 'Clients' })}
          onReturnToGroups={() => navigate({ kind: 'section', section: 'Groups' })}
          onReturnToUsers={() => navigate({ kind: 'section', section: 'Users' })}
          route={route}
          user={authenticatedUser}
        />
      )}
    </AuthenticatedShell>
  )
}

type StageFrameProps = {
  storyTitle: string
  storyDescription: string
  storyPoints: string[]
  children: ReactNode
}

function StageFrame({
  storyTitle,
  storyDescription,
  storyPoints,
  children,
}: StageFrameProps) {
  return (
    <div className="gym-crm-page">
      <Container className="auth-layout" size="xl">
        {children}

        <Paper className="story-panel" radius="36px" shadow="lg">
          <Stack className="story-panel__content" gap="xl">
            <Stack gap="md">
              <Text className="story-panel__kicker" fw={700}>
                Gym CRM
              </Text>
              <Title c="white" className="story-panel__title" order={1}>
                {storyTitle}
              </Title>
              <Text className="story-panel__description" size="lg">
                {storyDescription}
              </Text>
            </Stack>

            <Stack className="story-panel__value-list" gap="sm">
              {storyPoints.map((point) => (
                <Group className="story-panel__value-item" gap="sm" key={point}>
                  <ThemeIcon color="accent.5" radius="xl" size={26}>
                    <IconCheck size={16} />
                  </ThemeIcon>
                  <Text fw={600}>{point}</Text>
                </Group>
              ))}
            </Stack>
          </Stack>
        </Paper>
      </Container>
    </div>
  )
}

type LoginScreenProps = {
  pending: boolean
  showSetupHelp: boolean
  onSubmit: (values: LoginRequest) => Promise<void>
}

function LoginScreen({
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
    <Paper className="stage-card" radius="32px" shadow="lg" withBorder>
      <Stack gap="lg">
        <Stack gap={6}>
          <Text c="dimmed" fw={600} size="sm">
            Авторизация
          </Text>
          <Title order={2}>Войти в Gym CRM</Title>
          <Text c="dimmed">
            Используйте логин и пароль, выданные администратором клуба.
          </Text>
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

        <form onSubmit={form.onSubmit((values) => void submit(values))}>
          <Stack gap="md">
            <TextInput
              autoComplete="username"
              label="Логин"
              placeholder="Введите логин"
              {...form.getInputProps('login')}
            />
            <PasswordInput
              autoComplete="current-password"
              label="Пароль"
              placeholder="Введите пароль"
              {...form.getInputProps('password')}
            />

            <Button
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
          <ThemeIcon color="brand.7" radius="xl" size={28} variant="light">
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
      ? 'Задайте новый пароль для первого входа'
      : 'Смена пароля из профиля'
  const description =
    mode === 'forced'
      ? 'Введите текущий временный пароль и задайте новый для дальнейшей работы.'
      : 'Обновите пароль, который будете использовать при следующих входах.'
  const afterSaveDescription =
    mode === 'forced'
      ? 'После сохранения откроется рабочий интерфейс с доступными вам разделами.'
      : 'Новый пароль начнет действовать сразу после сохранения.'

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
            <Text c="dimmed" fw={600} size="sm">
              Смена пароля
            </Text>
            <Title order={2}>{title}</Title>
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

            <Paper className="hint-card" radius="24px" withBorder>
              <Stack gap={6}>
                <Group gap="xs">
                  <ThemeIcon color="brand.7" radius="xl" size={28} variant="light">
                    <IconShieldCheck size={16} />
                  </ThemeIcon>
                  <Text fw={700}>Что будет дальше</Text>
                </Group>
                <Text c="dimmed" size="sm">
                  {afterSaveDescription}
                </Text>
              </Stack>
            </Paper>
          </Stack>
        </form>
      </Stack>
    </Paper>
  )
}

type AuthenticatedShellProps = {
  user: AuthenticatedUser
  currentSection: AppSection | null
  logoutPending: boolean
  onNavigateSection: (section: AppSection) => void
  onOpenPassword: () => void
  onLogout: () => Promise<void>
  children: ReactNode
}

function AuthenticatedShell({
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

  return (
    <AppLayout
      header={(
        <Header
          brandMeta={`${presentation.roleLabel} • стартовый раздел: ${landingLabel}`}
          brandMetaCompact={presentation.roleLabel}
          navigation={(
            <NavigationTabs
              currentSection={currentSection}
              onNavigate={handleSectionNavigation}
              sections={navigationSections}
            />
          )}
          profileControl={profileControl}
        />
      )}
    >
      {children}
    </AppLayout>
  )
}

type RouteViewportProps = {
  route: Exclude<AppRoute, { kind: 'password' }>
  user: AuthenticatedUser
  currentUserId: string
  onCreateGroup: () => void
  onEditGroup: (groupId: string) => void
  onCreateClient: () => void
  onEditClient: (clientId: string) => void
  onOpenClient: (clientId: string) => void
  onCreateUser: () => void
  onEditUser: (userId: string) => void
  onRefreshSession: () => Promise<unknown>
  onReturnToClients: () => void
  onReturnToGroups: () => void
  onReturnToUsers: () => void
}

function RouteViewport({
  route,
  user,
  currentUserId,
  onCreateClient,
  onEditClient,
  onOpenClient,
  onCreateGroup,
  onEditGroup,
  onCreateUser,
  onEditUser,
  onRefreshSession,
  onReturnToClients,
  onReturnToGroups,
  onReturnToUsers,
}: RouteViewportProps) {
  if (
    !user.permissions.canManageClients &&
    (route.kind === 'clientCreate' || route.kind === 'clientEdit')
  ) {
    return <ClientsReadOnlyPlaceholder />
  }

  if (
    !user.permissions.canManageGroups &&
    (route.kind === 'groupCreate' || route.kind === 'groupEdit')
  ) {
    return <RouteRedirectPlaceholder />
  }

  if (route.kind === 'section' && route.section === 'Groups' && !user.permissions.canManageGroups) {
    return <RouteRedirectPlaceholder />
  }

  if (
    !user.permissions.canManageUsers &&
    (route.kind === 'userCreate' || route.kind === 'userEdit')
  ) {
    return <RouteRedirectPlaceholder />
  }

  if (route.kind === 'section' && route.section === 'Users' && !user.permissions.canManageUsers) {
    return <RouteRedirectPlaceholder />
  }

  if (route.kind === 'section' && route.section === 'Audit' && !user.permissions.canViewAuditLog) {
    return <RouteRedirectPlaceholder />
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

  if (route.section === 'Clients') {
    return (
      <ClientsListScreen
        canManage={user.permissions.canManageClients}
        onCreate={onCreateClient}
        onOpen={onOpenClient}
      />
    )
  }

  if (route.section === 'Users') {
    return <UsersListScreen onCreate={onCreateUser} onEdit={onEditUser} />
  }

  if (route.section === 'Groups') {
    return <GroupsListScreen onCreate={onCreateGroup} onEdit={onEditGroup} />
  }

  if (route.section === 'Attendance') {
    return <AttendanceScreen user={user} />
  }

  if (route.section === 'Audit') {
    return <AuditLogScreen user={user} />
  }

  if (route.section === 'Home') {
    return <HomeDashboard onOpenClient={onOpenClient} user={user} />
  }

  return <SectionPlaceholder section={route.section} user={user} />
}

function ClientsReadOnlyPlaceholder() {
  return (
    <Stack className="dashboard-stack" gap="xl">
      <Paper className="surface-card surface-card--wide page-header-card" radius="28px" withBorder>
        <Stack className="page-header-card__content" gap="md">
          <Group gap="sm">
            <Badge color="brand.1" radius="xl" size="lg" variant="light">
              Клиенты для тренера
            </Badge>
          </Group>

          <Stack gap="sm">
            <Title className="page-header-card__title" order={1}>
              Раздел клиентов для тренера готовится к запуску
            </Title>
            <Text className="page-header-card__description" size="sm">
              Сейчас полный список клиентов доступен управленческим ролям. Для
              тренера здесь появится ограниченный просмотр клиентов назначенных групп.
            </Text>
          </Stack>
        </Stack>
      </Paper>

      <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
        <Stack gap="lg">
          <Alert
            color="blue"
            icon={<IconAlertCircle size={18} />}
            title="Раздел скоро будет доступен"
            variant="light"
          >
            Для тренера будет показан только разрешенный список клиентов без
            лишних персональных данных и действий управления.
          </Alert>

          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <Paper className="hint-card" radius="24px" withBorder>
              <Stack gap={6}>
                <Text fw={700}>Что уже готово</Text>
                <Text c="dimmed" size="sm">
                  Главный тренер и администратор уже могут вести список клиентов,
                  открывать карточки, создавать, редактировать и архивировать записи.
                </Text>
              </Stack>
            </Paper>

            <Paper className="hint-card" radius="24px" withBorder>
              <Stack gap={6}>
                <Text fw={700}>Почему так</Text>
                <Text c="dimmed" size="sm">
                  Тренеру будут доступны только клиенты его групп, чтобы сохранить
                  приватность данных клуба.
                </Text>
              </Stack>
            </Paper>

            <Paper className="hint-card" radius="24px" withBorder>
              <Stack gap={6}>
                <Text fw={700}>Следующий шаг</Text>
                <Text c="dimmed" size="sm">
                  После подключения раздела тренер сможет быстро открывать
                  разрешенные карточки клиентов из своих групп.
                </Text>
              </Stack>
            </Paper>
          </SimpleGrid>
        </Stack>
      </Paper>
    </Stack>
  )
}

function RouteRedirectPlaceholder() {
  return (
    <Stack className="dashboard-stack" gap="xl">
      <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
        <Group justify="center" py="xl">
          <Loader color="brand.7" />
        </Group>
      </Paper>
    </Stack>
  )
}

type SectionPlaceholderProps = {
  section: Exclude<AppSection, 'Home' | 'Clients' | 'Users' | 'Groups'>
  user: AuthenticatedUser
}

function SectionPlaceholder({
  section,
  user,
}: SectionPlaceholderProps) {
  const presentation = rolePresentationMap[user.role]

  return (
    <Stack className="dashboard-stack" gap="xl">
      <Paper className="surface-card surface-card--wide page-header-card" radius="28px" withBorder>
        <Stack className="page-header-card__content" gap="md">
          <Group gap="sm">
            <Badge color="brand.1" radius="xl" size="lg" variant="light">
              {APP_SECTION_LABELS[section]}
            </Badge>
          </Group>

          <Stack gap="sm">
            <Title className="page-header-card__title" order={1}>
              Раздел {APP_SECTION_LABELS[section]} появится здесь
            </Title>
            <Text className="page-header-card__description" size="sm">
              Клиенты, пользователи и группы уже доступны в рабочем меню. Этот
              раздел будет подключен отдельным обновлением.
            </Text>
          </Stack>
        </Stack>
      </Paper>

      <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
        <Stack gap="md">
          <Group gap="xs">
            <ThemeIcon color="brand.7" radius="xl" size={34} variant="light">
              <IconRoute size={18} />
            </ThemeIcon>
            <div>
              <Text fw={700}>Почему раздел недоступен</Text>
              <Text c="dimmed" size="sm">
                Для роли {presentation.roleLabel} экран пока не опубликован в
                рабочем интерфейсе.
              </Text>
            </div>
          </Group>

          <Alert
            color="blue"
            icon={<IconCheck size={18} />}
            title="Навигация уже собрана"
            variant="light"
          >
            Меню уже показывает доступные разделы и скрывает то, что не входит в
            права текущей роли.
          </Alert>
        </Stack>
      </Paper>
    </Stack>
  )
}

function LoadingState() {
  return (
    <div className="gym-crm-page">
      <Container className="loading-layout" size="sm">
        <Paper className="loading-card" radius="32px" shadow="lg" withBorder>
          <Stack align="center" gap="md">
            <Loader color="brand.7" size="lg" />
            <Title order={3}>Открываем Gym CRM</Title>
            <Text c="dimmed" ta="center">
              Проверяем, есть ли активный вход, и готовим экран авторизации.
            </Text>
          </Stack>
        </Paper>
      </Container>
    </div>
  )
}

export default App
