import { startTransition, useEffect, useState, type ReactNode } from 'react'
import {
  Alert,
  AppShell,
  Badge,
  Button,
  Burger,
  Container,
  Divider,
  Group,
  List,
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
  IconCheck,
  IconDoorExit,
  IconLockPassword,
  IconProgressCheck,
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
            : 'Не удалось связаться с backend.',
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
          : 'Не удалось связаться с backend.',
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
        accent="Проверьте backend и перезапустите загрузку, чтобы продолжить вход и проверить матрицу ролей."
        bullets={[
          'Cookie-auth и forced first login живут на backend.',
          'Права и доступные секции приходят из API.',
          'После восстановления соединения можно открыть route-level users flow.',
        ]}
        description="Frontend не смог получить начальную сессию, CSRF-токен и backend-driven access-context."
        eyebrow="Stage 4"
        title="Backend пока не отвечает"
      >
        <Paper className="stage-card" radius="32px" shadow="lg" withBorder>
          <Stack gap="lg">
            <Alert
              color="red"
              icon={<IconAlertCircle size={18} />}
              title="Нет соединения с API"
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
        accent="Для bootstrap-пользователя backend создает обязательную смену пароля, а после входа выдает role-aware shell."
        bullets={[
          'Логин первого пользователя берется из конфигурации backend, по умолчанию это `headcoach`.',
          'Стартовый пароль для первого входа: `12345678`.',
          'После успешного входа frontend получает доступные секции и разрешения прямо из API.',
        ]}
        description="Cookie-based авторизация, CSRF-защита, роли и route-aware shell уже связаны в единый поток."
        eyebrow="Stage 4"
        title="Вход в Gym CRM для спортивного зала"
      >
        <LoginScreen pending={loginPending} onSubmit={handleLogin} />
      </StageFrame>
    )
  }

  if (session.user.mustChangePassword) {
    return (
      <StageFrame
        accent="После успешной смены пароля сессия будет перевыпущена, а интерфейс откроет роль-подходящий landing."
        bullets={[
          'Изменение пароля проходит через тот же endpoint, который доступен из профиля.',
          'CSRF-токен уже получен и автоматически подставляется в изменяющие запросы.',
          'Аудит пишет login, logout и password change без хранения паролей или их хешей.',
        ]}
        description="Пока флаг `MustChangePassword` активен, backend пропускает только безопасный auth-flow и не дает выйти в рабочие API."
        eyebrow="Forced First Login"
        title="Смена пароля обязательна перед началом работы"
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
      activePath={pathname}
      currentSection={currentSection}
      currentViewLabel={
        route.kind === 'password'
          ? 'Смена пароля'
          : currentSection
            ? APP_SECTION_LABELS[currentSection]
            : APP_SECTION_LABELS[authenticatedUser.landingScreen]
      }
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
  eyebrow: string
  title: string
  description: string
  accent: string
  bullets: string[]
  children: ReactNode
}

function StageFrame({
  eyebrow,
  title,
  description,
  accent,
  bullets,
  children,
}: StageFrameProps) {
  return (
    <div className="gym-crm-page">
      <Container className="auth-layout" size="xl">
        <Paper className="story-panel" radius="36px" shadow="lg">
          <div className="story-panel__glow" />
          <Stack className="story-panel__content" gap="xl">
            <Group gap="sm">
              <Badge color="accent.5" radius="xl" size="lg" variant="filled">
                {eyebrow}
              </Badge>
              <Badge color="brand.1" radius="xl" size="lg" variant="light">
                Gym CRM MVP
              </Badge>
            </Group>

            <Stack gap="md">
              <Title c="white" className="story-panel__title" order={1}>
                {title}
              </Title>
              <Text className="story-panel__description" size="lg">
                {description}
              </Text>
              <Text className="story-panel__accent" fw={600}>
                {accent}
              </Text>
            </Stack>

            <List
              className="story-panel__list"
              icon={
                <ThemeIcon color="accent.5" radius="xl" size={26}>
                  <IconCheck size={16} />
                </ThemeIcon>
              }
              spacing="md"
            >
              {bullets.map((bullet) => (
                <List.Item key={bullet}>{bullet}</List.Item>
              ))}
            </List>
          </Stack>
        </Paper>

        {children}
      </Container>
    </div>
  )
}

type LoginScreenProps = {
  pending: boolean
  onSubmit: (values: LoginRequest) => Promise<void>
}

function LoginScreen({ pending, onSubmit }: LoginScreenProps) {
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
          <Title order={2}>Войти в систему</Title>
          <Text c="dimmed">
            Backend установит `HttpOnly` cookie, а frontend продолжит работу в
            том же origin через dev proxy.
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
              placeholder="headcoach"
              {...form.getInputProps('login')}
            />
            <PasswordInput
              autoComplete="current-password"
              label="Пароль"
              placeholder="Введите пароль"
              {...form.getInputProps('password')}
            />

            <Paper className="hint-card" radius="24px" withBorder>
              <Stack gap={6}>
                <Group gap="xs">
                  <ThemeIcon color="brand.7" radius="xl" size={28} variant="light">
                    <IconSparkles size={16} />
                  </ThemeIcon>
                  <Text fw={700}>Подсказка для первого запуска</Text>
                </Group>
                <Text c="dimmed" size="sm">
                  Если backend не переопределил login bootstrap-пользователя,
                  используйте `headcoach`. Стартовый пароль: `12345678`.
                </Text>
              </Stack>
            </Paper>

            <Button
              loading={pending}
              rightSection={<IconArrowRight size={18} />}
              size="md"
              type="submit"
            >
              Войти
            </Button>
          </Stack>
        </form>
      </Stack>
    </Paper>
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
      ? 'Текущий временный пароль нужен один раз, чтобы завершить инициализацию учетной записи.'
      : 'После сохранения backend перевыпустит cookie и оставит вас в активной сессии.'

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

            <Paper className="hint-card" radius="24px" withBorder>
              <Stack gap={6}>
                <Group gap="xs">
                  <ThemeIcon color="brand.7" radius="xl" size={28} variant="light">
                    <IconShieldCheck size={16} />
                  </ThemeIcon>
                  <Text fw={700}>Что произойдет после сохранения</Text>
                </Group>
                <Text c="dimmed" size="sm">
                  Backend сбросит флаг `MustChangePassword`, запишет событие в
                  `AuditLog` и перевыпустит auth-cookie с актуальной версией
                  пользователя.
                </Text>
              </Stack>
            </Paper>

            <Button
              loading={pending}
              rightSection={<IconLockPassword size={18} />}
              size="md"
              type="submit"
            >
              {mode === 'forced' ? 'Сменить пароль и продолжить' : 'Сохранить новый пароль'}
            </Button>
          </Stack>
        </form>
      </Stack>
    </Paper>
  )
}

type AuthenticatedShellProps = {
  activePath: string
  user: AuthenticatedUser
  currentSection: AppSection | null
  currentViewLabel: string
  logoutPending: boolean
  onNavigateSection: (section: AppSection) => void
  onOpenPassword: () => void
  onLogout: () => Promise<void>
  children: ReactNode
}

function AuthenticatedShell({
  activePath,
  user,
  currentSection,
  currentViewLabel,
  logoutPending,
  onNavigateSection,
  onOpenPassword,
  onLogout,
  children,
}: AuthenticatedShellProps) {
  const [mobileNavigationPath, setMobileNavigationPath] = useState<string | null>(null)
  const presentation = rolePresentationMap[user.role]
  const landingLabel = APP_SECTION_LABELS[user.landingScreen]
  const navigationSections = user.allowedSections.filter(
    (section) =>
      (section !== 'Users' || user.permissions.canManageUsers) &&
      (section !== 'Audit' || user.permissions.canViewAuditLog),
  )
  const mobileNavigationOpened = mobileNavigationPath === activePath

  function handleSectionNavigation(section: AppSection) {
    setMobileNavigationPath(null)
    onNavigateSection(section)
  }

  function handleOpenPassword() {
    setMobileNavigationPath(null)
    onOpenPassword()
  }

  async function handleLogoutAction() {
    setMobileNavigationPath(null)
    await onLogout()
  }

  return (
    <AppShell
      className="app-shell"
      header={{ height: { base: 116, lg: 144 } }}
      navbar={{
        width: 320,
        breakpoint: 'lg',
        collapsed: { desktop: true, mobile: !mobileNavigationOpened },
      }}
      padding={{ base: 'sm', sm: 'md', lg: 'xl' }}
    >
      <AppShell.Header className="app-shell__header">
        <Container className="app-shell__header-inner" size="xl">
          <div className="app-shell__header-top">
            <Group className="app-shell__brand" gap="sm" wrap="nowrap">
              <Burger
                aria-label={
                  mobileNavigationOpened ? 'Скрыть навигацию' : 'Показать навигацию'
                }
                className="app-shell__burger"
                data-testid="app-navigation-toggle"
                hiddenFrom="lg"
                onClick={() =>
                  setMobileNavigationPath((currentPath) =>
                    currentPath === activePath ? null : activePath,
                  )
                }
                opened={mobileNavigationOpened}
                size="sm"
              />
              <ThemeIcon color="brand.7" radius="xl" size={36} variant="filled">
                <IconProgressCheck size={20} />
              </ThemeIcon>
              <div className="app-shell__brand-copy">
                <Text className="app-shell__brand-title" fw={800}>
                  Gym CRM MVP
                </Text>
                <Text c="dimmed" className="app-shell__brand-meta" hiddenFrom="lg" size="sm">
                  {presentation.roleLabel}
                </Text>
                <Text c="dimmed" className="app-shell__brand-meta" visibleFrom="lg" size="sm">
                  {presentation.roleLabel} • landing: {landingLabel}
                </Text>
              </div>
            </Group>

            <Menu position="bottom-end" shadow="md" width={250}>
              <Menu.Target>
                <UnstyledButton
                  aria-label={`Открыть профильное меню пользователя ${user.fullName}`}
                  className="app-shell__profile-trigger"
                >
                  <IconUserCircle size={18} />
                  <span className="app-shell__profile-name">{user.fullName}</span>
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
          </div>

          <Group className="app-shell__mobile-context" gap="xs" hiddenFrom="lg">
            <Badge className="nav-badge app-shell__current-view" radius="xl" variant="light">
              {currentViewLabel}
            </Badge>
          </Group>

          <Group className="app-shell__desktop-nav" gap="xs" visibleFrom="lg" wrap="wrap">
            {navigationSections.map((section) => (
              <Button
                aria-current={section === currentSection ? 'page' : undefined}
                className="app-shell__nav-button"
                key={section}
                onClick={() => handleSectionNavigation(section)}
                radius="xl"
                size="sm"
                variant={section === currentSection ? 'filled' : 'light'}
              >
                {APP_SECTION_LABELS[section]}
              </Button>
            ))}
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Navbar className="app-shell__navbar" data-testid="app-navigation" p="md">
        <AppShell.Section>
          <Stack gap="xs">
            <Text c="dimmed" fw={700} size="sm">
              Рабочие разделы
            </Text>
            {navigationSections.map((section) => (
              <Button
                aria-current={section === currentSection ? 'page' : undefined}
                className="app-shell__mobile-nav-button"
                fullWidth
                key={section}
                onClick={() => handleSectionNavigation(section)}
                radius="xl"
                size="md"
                variant={section === currentSection ? 'filled' : 'light'}
              >
                {APP_SECTION_LABELS[section]}
              </Button>
            ))}
          </Stack>
        </AppShell.Section>

        <AppShell.Section className="app-shell__navbar-footer">
          <Divider className="app-shell__navbar-divider" />
          <Paper className="hint-card app-shell__mobile-menu-hint" radius="24px" withBorder>
            <Stack gap={6}>
              <Text fw={700}>{user.fullName}</Text>
              <Text c="dimmed" size="sm">
                {presentation.roleLabel}
              </Text>
              <Text c="dimmed" size="sm">
                Смена пароля и выход доступны через профильное меню справа сверху.
              </Text>
            </Stack>
          </Paper>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main className="app-shell__main">
        <Container size="xl">{children}</Container>
      </AppShell.Main>
    </AppShell>
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
            <Badge color="accent.5" radius="xl" size="lg" variant="filled">
              Этап 6a
            </Badge>
            <Badge color="brand.1" radius="xl" size="lg" variant="light">
              Клиенты для тренера
            </Badge>
          </Group>

          <Stack gap="sm">
            <Title className="page-header-card__title" order={1}>
              Список клиентов для тренера еще закрыт, но detail route уже может открываться backend-ом
            </Title>
            <Text className="page-header-card__description" size="sm">
              В текущем этапе management API клиентов по-прежнему открыт только
              для `HeadCoach` и `Administrator`, поэтому раздел остается
              безопасным placeholder без списка и CRUD.
            </Text>
          </Stack>
        </Stack>
      </Paper>

      <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
        <Stack gap="lg">
          <Alert
            color="blue"
            icon={<IconAlertCircle size={18} />}
            title="Раздел пока работает как безопасный placeholder"
            variant="light"
          >
            На следующем этапе сюда будет подключен ограниченный просмотр
            клиентов назначенных групп без CRUD-действий и без чувствительных
            полей.
          </Alert>

          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <Paper className="hint-card" radius="24px" withBorder>
              <Stack gap={6}>
                <Text fw={700}>Что уже готово</Text>
                <Text c="dimmed" size="sm">
                  У менеджерских ролей доступен полный flow списка, карточки,
                  создания, редактирования и архива клиентов.
                </Text>
              </Stack>
            </Paper>

            <Paper className="hint-card" radius="24px" withBorder>
              <Stack gap={6}>
                <Text fw={700}>Почему так</Text>
                <Text c="dimmed" size="sm">
                  Инвариант проекта сохраняется: права остаются источником истины
                  на backend, а frontend не пытается обойти запреты доступа.
                </Text>
              </Stack>
            </Paper>

            <Paper className="hint-card" radius="24px" withBorder>
              <Stack gap={6}>
                <Text fw={700}>Следующий шаг</Text>
                <Text c="dimmed" size="sm">
                  Ограниченный список тренера будет добавлен отдельным шагом.
                  При этом route-level карточка клиента уже может открываться из
                  backend-driven сценариев и показывает только разрешенные данные.
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
            <Badge color="accent.5" radius="xl" size="lg" variant="filled">
              Route-level shell
            </Badge>
            <Badge color="brand.1" radius="xl" size="lg" variant="light">
              {APP_SECTION_LABELS[section]}
            </Badge>
          </Group>

          <Stack gap="sm">
            <Title className="page-header-card__title" order={1}>
              Раздел {APP_SECTION_LABELS[section]} уже встроен в навигацию shell
            </Title>
            <Text className="page-header-card__description" size="sm">
              Текущий инкремент уже реализует flows клиентов, пользователей и групп. Этот
              маршрут оставлен как безопасный placeholder до следующего этапа.
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
              <Text fw={700}>Почему здесь placeholder</Text>
              <Text c="dimmed" size="sm">
                Маршрут уже учитывает права роли {presentation.roleLabel}, но
                прикладной экран запланирован на следующий этап плана.
              </Text>
            </div>
          </Group>

          <Alert
            color="blue"
            icon={<IconCheck size={18} />}
            title="Навигация уже собрана"
            variant="light"
          >
            Shell умеет открывать route-level экраны, а запрет на недоступные
            секции остается backend-driven и дополнительно дублируется
            redirect-логикой во frontend.
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
            <Title order={3}>Подготавливаем auth-сессию</Title>
            <Text c="dimmed" ta="center">
              Получаем начальный CSRF-токен и проверяем, есть ли активная
              cookie-сессия.
            </Text>
          </Stack>
        </Paper>
      </Container>
    </div>
  )
}

export default App
