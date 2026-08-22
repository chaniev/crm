import { useState, type CSSProperties, type ReactNode } from 'react'
import {
  Alert,
  Button,
  Container,
  Group,
  Loader,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconArrowRight,
  IconLockPassword,
  IconShieldCheck,
  IconSparkles,
  IconUserCircle,
} from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  type ChangePasswordRequest,
  type LoginRequest,
} from '../lib/api'
import type { AuthStageBackground } from '../theme'

export type PasswordMode = 'forced' | 'utility'

type StageFrameProps = {
  authBackground: AuthStageBackground
  children: ReactNode
}

export function StageFrame({ authBackground, children }: StageFrameProps) {
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

export function LoginScreen({
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

export function PasswordScreen({
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

type LoadingStateProps = {
  authBackground: AuthStageBackground
  clubName: string
}

export function LoadingState({ authBackground, clubName }: LoadingStateProps) {
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
