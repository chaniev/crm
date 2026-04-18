import { startTransition, useEffect, useState, type ReactNode } from 'react'
import {
  Alert,
  AppShell,
  Badge,
  Button,
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
  IconMapPin,
  IconProgressCheck,
  IconShieldCheck,
  IconSparkles,
  IconUserCircle,
} from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  type AppSection,
  changePassword,
  loadSession,
  login,
  logout,
  type AccessPermissions,
  type AuthenticatedUser,
  type ChangePasswordRequest,
  type LoginRequest,
  type SessionResponse,
} from './lib/api'
import './App.css'

type ShellView = 'dashboard' | 'password'
type PasswordMode = 'forced' | 'utility'

type RolePresentation = {
  roleLabel: string
  roleHint: string
}

const sectionLabelMap: Record<AppSection, string> = {
  Home: 'Главная',
  Attendance: 'Посещения',
  Clients: 'Клиенты',
  Groups: 'Группы',
  Users: 'Пользователи',
  Audit: 'Журнал',
}

const rolePresentationMap: Record<AuthenticatedUser['role'], RolePresentation> = {
  HeadCoach: {
    roleLabel: 'Главный тренер',
    roleHint: 'Полный управленческий доступ к MVP CRM.',
  },
  Administrator: {
    roleLabel: 'Администратор',
    roleHint: 'Работа с клиентами, группами и операционными задачами без управления пользователями.',
  },
  Coach: {
    roleLabel: 'Тренер',
    roleHint: 'Рабочий поток тренера стартует с посещений и видит только доступный scope.',
  },
}

function getAllowedPermissionLabels(permissions: AccessPermissions) {
  return [
    permissions.canManageUsers ? 'Управление пользователями' : null,
    permissions.canManageClients ? 'Управление клиентами' : null,
    permissions.canManageGroups ? 'Управление группами' : null,
    permissions.canMarkAttendance ? 'Отметка посещений' : null,
    permissions.canViewAuditLog ? 'Просмотр журнала действий' : null,
  ].filter((value): value is string => Boolean(value))
}

function App() {
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const [shellView, setShellView] = useState<ShellView>('dashboard')
  const [loginPending, setLoginPending] = useState(false)
  const [passwordPending, setPasswordPending] = useState(false)
  const [logoutPending, setLogoutPending] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    async function bootstrap() {
      setLoadingSession(true)
      setBootstrapError(null)

      try {
        const currentSession = await loadSession(controller.signal)

        startTransition(() => {
          setSession(currentSession)
          setShellView('dashboard')
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

  async function retrySessionLoad() {
    setLoadingSession(true)
    setBootstrapError(null)

    try {
      const currentSession = await loadSession()

      startTransition(() => {
        setSession(currentSession)
        setShellView('dashboard')
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

  async function handleLogin(values: LoginRequest) {
    setLoginPending(true)

    try {
      const currentSession = await login(values)

      startTransition(() => {
        setSession(currentSession)
        setShellView('dashboard')
      })
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
        setShellView('dashboard')
      })

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
        setShellView('dashboard')
      })

      notifications.show({
        title: 'Сессия завершена',
        message: 'Вы вышли из CRM.',
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

  if (loadingSession) {
    return <LoadingState />
  }

  if (bootstrapError && !session) {
    return (
      <StageFrame
        eyebrow="Stage 3"
        title="Backend пока не отвечает"
        description="Frontend не смог получить начальную сессию, CSRF-токен и backend-driven access-context."
        accent="Проверьте backend и перезапустите загрузку, чтобы продолжить вход и проверить матрицу ролей."
        bullets={[
          'Cookie-auth и forced first login живут на backend.',
          'Права и доступные секции теперь приходят из API.',
          'После восстановления соединения можно сразу проверить role-aware shell.',
        ]}
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

            <Button onClick={() => void retrySessionLoad()} rightSection={<IconArrowRight size={18} />}>
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
        eyebrow="Stage 3"
        title="Вход в CRM для спортивного зала"
        description="Cookie-based авторизация, CSRF-защита, роли и backend-enforced access model уже связаны в единый поток."
        accent="Для bootstrap-пользователя backend создает обязательную смену пароля, а после входа выдает role-aware shell."
        bullets={[
          'Логин первого пользователя берется из конфигурации backend, по умолчанию это `headcoach`.',
          'Стартовый пароль для первого входа: `12345678`.',
          'После успешного входа frontend получает доступные секции и разрешения прямо из API.',
        ]}
      >
        <LoginScreen pending={loginPending} onSubmit={handleLogin} />
      </StageFrame>
    )
  }

  if (session.user.mustChangePassword) {
    return (
      <StageFrame
        eyebrow="Forced First Login"
        title="Смена пароля обязательна перед началом работы"
        description="Пока флаг `MustChangePassword` активен, backend пропускает только безопасный auth-flow и не дает выйти в рабочие API."
        accent="После успешной смены пароля сессия будет перевыпущена, а интерфейс откроет роль-подходящий landing."
        bullets={[
          'Изменение пароля проходит через тот же endpoint, который потом будет доступен из профиля.',
          'CSRF-токен уже получен и автоматически подставляется в изменяющие запросы.',
          'Аудит пишет login, logout и password change без хранения паролей или их хешей.',
        ]}
      >
        <PasswordScreen
          mode="forced"
          pending={passwordPending}
          onSubmit={handleChangePassword}
        />
      </StageFrame>
    )
  }

  return (
    <AuthenticatedShell
      logoutPending={logoutPending}
      onLogout={handleLogout}
      onOpenPassword={() => setShellView('password')}
      user={session.user}
    >
      {shellView === 'password' ? (
        <PasswordScreen
          mode="utility"
          pending={passwordPending}
          onBack={() => setShellView('dashboard')}
          onSubmit={handleChangePassword}
        />
      ) : (
        <RoleDashboard
          onOpenPassword={() => setShellView('password')}
          user={session.user}
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
    <div className="crm-page">
      <Container className="auth-layout" size="xl">
        <Paper className="story-panel" radius="36px" shadow="lg">
          <div className="story-panel__glow" />
          <Stack className="story-panel__content" gap="xl">
            <Group gap="sm">
              <Badge color="accent.5" radius="xl" size="lg" variant="filled">
                {eyebrow}
              </Badge>
              <Badge color="brand.1" radius="xl" size="lg" variant="light">
                CRM MVP
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
  user: AuthenticatedUser
  logoutPending: boolean
  onOpenPassword: () => void
  onLogout: () => Promise<void>
  children: ReactNode
}

function AuthenticatedShell({
  user,
  logoutPending,
  onOpenPassword,
  onLogout,
  children,
}: AuthenticatedShellProps) {
  const presentation = rolePresentationMap[user.role]
  const landingLabel = sectionLabelMap[user.landingScreen]

  return (
    <AppShell
      className="app-shell"
      header={{ height: 88 }}
      padding={{ base: 'md', md: 'xl' }}
    >
      <AppShell.Header className="app-shell__header">
        <Container className="app-shell__header-inner" size="xl">
          <Group justify="space-between" wrap="wrap">
            <Stack gap={2}>
              <Group gap="sm">
                <ThemeIcon color="brand.7" radius="xl" size={36} variant="filled">
                  <IconProgressCheck size={20} />
                </ThemeIcon>
                <div>
                  <Text fw={800}>Gym CRM MVP</Text>
                  <Text c="dimmed" size="sm">
                    {presentation.roleLabel} • landing: {landingLabel}
                  </Text>
                </div>
              </Group>
            </Stack>

            <Group className="app-shell__actions" gap="sm">
              {user.allowedSections.map((section) => (
                <Badge
                  className="nav-badge"
                  color={section === user.landingScreen ? 'brand' : 'sand'}
                  key={section}
                  radius="xl"
                  size="lg"
                  variant={section === user.landingScreen ? 'filled' : 'light'}
                >
                  {sectionLabelMap[section]}
                </Badge>
              ))}

              <Menu position="bottom-end" shadow="md" width={250}>
                <Menu.Target>
                  <Button
                    leftSection={<IconUserCircle size={18} />}
                    variant="light"
                  >
                    {user.fullName}
                  </Button>
                </Menu.Target>

                <Menu.Dropdown>
                  <Menu.Label>{presentation.roleLabel}</Menu.Label>
                  <Menu.Item
                    leftSection={<IconLockPassword size={16} />}
                    onClick={onOpenPassword}
                  >
                    Смена пароля
                  </Menu.Item>
                  <Menu.Item
                    color="red"
                    leftSection={<IconDoorExit size={16} />}
                    onClick={() => void onLogout()}
                  >
                    {logoutPending ? 'Завершаем сессию...' : 'Выход'}
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Main className="app-shell__main">
        <Container size="xl">{children}</Container>
      </AppShell.Main>
    </AppShell>
  )
}

type RoleDashboardProps = {
  user: AuthenticatedUser
  onOpenPassword: () => void
}

function RoleDashboard({ user, onOpenPassword }: RoleDashboardProps) {
  const presentation = rolePresentationMap[user.role]
  const landingLabel = sectionLabelMap[user.landingScreen]
  const allowedPermissionLabels = getAllowedPermissionLabels(user.permissions)
  const coachScopeLabel =
    user.role === 'Coach'
      ? `Назначенных групп: ${user.assignedGroupIds.length}`
      : 'Полноролевой backend scope'

  return (
    <Stack className="dashboard-stack" gap="xl">
      <Paper className="dashboard-hero" radius="36px" shadow="lg">
        <div className="dashboard-hero__glow" />
        <Stack className="dashboard-hero__content" gap="lg">
          <Group gap="sm">
            <Badge color="accent.5" radius="xl" size="lg" variant="filled">
              Этап 3 закрывает роли и права
            </Badge>
            <Badge color="brand.1" radius="xl" size="lg" variant="light">
              {presentation.roleLabel}
            </Badge>
          </Group>

          <Stack gap="sm">
            <Title c="white" className="dashboard-hero__title" order={1}>
              Сессия активна, а backend уже выдает role-aware access scope
            </Title>
            <Text className="dashboard-hero__description" size="lg">
              {presentation.roleHint} После первого входа маршрут выводит вас в
              секцию «{landingLabel}», а shell берет доступные разделы и
              базовые разрешения из ответа backend.
            </Text>
          </Stack>

          <Group gap="md" wrap="wrap">
            <Button
              color="accent.5"
              onClick={onOpenPassword}
              rightSection={<IconLockPassword size={18} />}
              variant="white"
            >
              Проверить utility-flow смены пароля
            </Button>
            <Badge color="brand.1" radius="xl" size="lg" variant="light">
              Login: {user.login}
            </Badge>
            <Badge color="sand" radius="xl" size="lg" variant="light">
              {coachScopeLabel}
            </Badge>
          </Group>
        </Stack>
      </Paper>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Paper className="surface-card" radius="28px" withBorder>
          <Stack gap="md">
            <Group gap="xs">
              <ThemeIcon color="brand.7" radius="xl" size={34} variant="light">
                <IconMapPin size={18} />
              </ThemeIcon>
              <div>
                <Text fw={700}>Ролевой landing</Text>
                <Text c="dimmed" size="sm">
                  Какие разделы backend разрешает этой роли после auth-flow
                </Text>
              </div>
            </Group>

            <List
              icon={
                <ThemeIcon color="brand.7" radius="xl" size={24} variant="light">
                  <IconCheck size={14} />
                </ThemeIcon>
              }
              spacing="sm"
            >
              {user.allowedSections.map((section) => (
                <List.Item key={section}>{sectionLabelMap[section]}</List.Item>
              ))}
            </List>
          </Stack>
        </Paper>

        <Paper className="surface-card" radius="28px" withBorder>
          <Stack gap="md">
            <Group gap="xs">
              <ThemeIcon color="accent.5" radius="xl" size={34} variant="light">
                <IconShieldCheck size={18} />
              </ThemeIcon>
              <div>
                <Text fw={700}>Что backend разрешает этой роли</Text>
                <Text c="dimmed" size="sm">
                  Политики доступа и базовый scope для следующих этапов
                </Text>
              </div>
            </Group>

            <List
              icon={
                <ThemeIcon color="teal" radius="xl" size={24} variant="light">
                  <IconCheck size={14} />
                </ThemeIcon>
              }
              spacing="sm"
            >
              {allowedPermissionLabels.map((permission) => (
                <List.Item key={permission}>{permission}</List.Item>
              ))}
              <List.Item>`HttpOnly` auth-cookie вместо JWT</List.Item>
              <List.Item>CSRF header `X-CSRF-TOKEN` на изменяющих запросах</List.Item>
              <List.Item>Блокировка API, пока не сброшен `MustChangePassword`</List.Item>
            </List>
          </Stack>
        </Paper>
      </SimpleGrid>

      <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Text fw={700}>Следующий вертикальный шаг</Text>
              <Text c="dimmed" size="sm">
                Роли и backend access model уже собраны. Следом можно
                безопасно наращивать CRUD-экраны пользователей и групп.
              </Text>
            </div>

            <Badge color="brand.7" radius="xl" size="lg" variant="light">
              Следующий этап: управление пользователями
            </Badge>
          </Group>

          <Divider />

          <Group gap="sm" wrap="wrap">
            <Badge radius="xl" size="lg" variant="light">
              {presentation.roleLabel}
            </Badge>
            <Badge radius="xl" size="lg" variant="light">
              Landing: {landingLabel}
            </Badge>
            <Badge radius="xl" size="lg" variant="light">
              Screen foundation: Mantine + Onest
            </Badge>
          </Group>
        </Stack>
      </Paper>
    </Stack>
  )
}

function LoadingState() {
  return (
    <div className="crm-page">
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
