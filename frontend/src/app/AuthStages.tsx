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
import { fe1AppShellAuthText } from '../resources/fe-1-app-shell-auth'


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
      login: (value) => (value.trim() ? null : fe1AppShellAuthText.authStages_string_c9715294),
      password: (value) => (value ? null : fe1AppShellAuthText.authStages_string_24155137),
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

      setFormError(fe1AppShellAuthText.authStages_setFormError_5e80ed29)
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
            {fe1AppShellAuthText.authStages_jsxText_389f991b}</Title>
        </Stack>

        {formError ? (
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            title={fe1AppShellAuthText.authStages_title_e0d7dae9}
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
              label={fe1AppShellAuthText.authStages_label_5be12bfe}
              leftSection={<IconUserCircle size={20} />}
              placeholder={fe1AppShellAuthText.authStages_placeholder_468937a8}
              {...form.getInputProps('login')}
            />
            <PasswordInput
              autoComplete="current-password"
              disabled={pending}
              label={fe1AppShellAuthText.authStages_label_cb1a2074}
              leftSection={<IconLockPassword size={20} />}
              placeholder={fe1AppShellAuthText.authStages_placeholder_f741291a}
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
              {fe1AppShellAuthText.authStages_jsxText_8fc9ab2e}</Button>

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
      <summary>{fe1AppShellAuthText.authStages_jsxText_709f75be}</summary>
      <Stack className="setup-disclosure__content" gap="xs">
        <Group gap="xs">
          <ThemeIcon color="var(--crm-action-primary)" radius="xl" size={28} variant="light">
            <IconSparkles size={16} />
          </ThemeIcon>
          <Text fw={700}>{fe1AppShellAuthText.authStages_jsxText_6c1c312c}</Text>
        </Group>
        <Text c="dimmed" size="sm">
          {fe1AppShellAuthText.authStages_jsxText_a415bb3d}<code>headcoach</code>{fe1AppShellAuthText.authStages_jsxText_4c52deff}<code>{fe1AppShellAuthText.authStages_jsxText_ef797c81}</code>{fe1AppShellAuthText.authStages_jsxText_cdb4ee2a}</Text>
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
      currentPassword: (value) => (value ? null : fe1AppShellAuthText.authStages_string_d1843171),
      newPassword: (value) => (value ? null : fe1AppShellAuthText.authStages_string_55d5440a),
      confirmPassword: (value, values) =>
        value === values.newPassword ? null : fe1AppShellAuthText.authStages_string_65289257,
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

      setFormError(fe1AppShellAuthText.authStages_setFormError_fbaf8203)
    }
  }

  const title =
    mode === 'forced'
      ? fe1AppShellAuthText.authStages_string_8783d8ab
      : fe1AppShellAuthText.authStages_string_8715c92b
  const description =
    mode === 'forced'
      ? fe1AppShellAuthText.authStages_string_5e511732
      : fe1AppShellAuthText.authStages_string_468abab8

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
              {fe1AppShellAuthText.authStages_jsxText_1a9fb1f3}</Button>
          ) : null}
        </Group>

        {formError ? (
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            title={fe1AppShellAuthText.authStages_title_36349dab}
            variant="light"
          >
            {formError}
          </Alert>
        ) : null}

        <form onSubmit={form.onSubmit((values) => void submit(values))}>
          <Stack gap="md">
            <PasswordInput
              autoComplete="current-password"
              label={fe1AppShellAuthText.authStages_label_d83e5a22}
              placeholder={fe1AppShellAuthText.authStages_placeholder_b45783ad}
              {...form.getInputProps('currentPassword')}
            />
            <PasswordInput
              autoComplete="new-password"
              label={fe1AppShellAuthText.authStages_label_f104cf99}
              placeholder={fe1AppShellAuthText.authStages_placeholder_63cd6ea9}
              {...form.getInputProps('newPassword')}
            />
            <PasswordInput
              autoComplete="new-password"
              label={fe1AppShellAuthText.authStages_label_fb22627c}
              placeholder={fe1AppShellAuthText.authStages_label_fb22627c}
              {...form.getInputProps('confirmPassword')}
            />

            <Button
              loading={pending}
              rightSection={<IconLockPassword size={18} />}
              size="md"
              type="submit"
            >
              {mode === 'forced' ? fe1AppShellAuthText.authStages_string_40402c8b : fe1AppShellAuthText.authStages_string_4a13b77b}
            </Button>

            {mode === 'utility' ? (
              <Paper className="hint-card" radius="24px" withBorder>
                <Stack gap={6}>
                  <Group gap="xs">
                    <ThemeIcon color="var(--crm-action-primary)" radius="xl" size={28} variant="light">
                      <IconShieldCheck size={16} />
                    </ThemeIcon>
                    <Text fw={700}>{fe1AppShellAuthText.authStages_jsxText_71f070e5}</Text>
                  </Group>
                  <Text c="dimmed" size="sm">
                    {fe1AppShellAuthText.authStages_jsxText_7814c992}</Text>
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
  const title = fe1AppShellAuthText.authStages_title_144a149c(clubName)

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
              {fe1AppShellAuthText.authStages_jsxText_74b94887}</Text>
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
