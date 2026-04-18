import { useEffect, useState, type ReactNode } from 'react'
import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  PasswordInput,
  Select,
  SimpleGrid,
  Stack,
  Switch,
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
  IconCheck,
  IconDeviceFloppy,
  IconPlus,
  IconRefresh,
  IconUserCog,
  IconUserEdit,
  IconUserPlus,
  IconUsers,
} from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  createUser,
  getUser,
  getUsers,
  updateUser,
  type CreateUserRequest,
  type UpdateUserRequest,
  type UserDetails,
  type UserListItem,
  type UserRole,
} from '../../lib/api'
import { ResponsiveButtonGroup } from '../shared/ux'

const roleLabels: Record<UserRole, string> = {
  HeadCoach: 'Главный тренер',
  Administrator: 'Администратор',
  Coach: 'Тренер',
}

const roleOptions = [
  { value: 'Administrator', label: roleLabels.Administrator },
  { value: 'Coach', label: roleLabels.Coach },
]

type BaseUserFormValues = {
  fullName: string
  role: UserRole | null
  mustChangePassword: boolean
  isActive: boolean
}

type CreateUserFormValues = BaseUserFormValues & {
  login: string
  password: string
}

type EditUserFormValues = BaseUserFormValues & {
  login: string
}

type UsersListScreenProps = {
  onCreate: () => void
  onEdit: (userId: string) => void
}

export function UsersListScreen({
  onCreate,
  onEdit,
}: UsersListScreenProps) {
  const [users, setUsers] = useState<UserListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const nextUsers = await getUsers(controller.signal)
        setUsers(nextUsers)
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Не удалось загрузить список пользователей.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [reloadKey])

  const activeUsersCount = users.filter((user) => user.isActive).length
  const passwordRotationCount = users.filter((user) => user.mustChangePassword).length

  return (
    <Stack className="dashboard-stack" gap="xl">
      <Paper className="dashboard-hero" radius="36px" shadow="lg">
        <div className="dashboard-hero__glow" />
        <Stack className="dashboard-hero__content" gap="lg">
          <Group gap="sm">
            <Badge color="accent.5" radius="xl" size="lg" variant="filled">
              Этап 4
            </Badge>
            <Badge color="brand.1" radius="xl" size="lg" variant="light">
              Route-level users flow
            </Badge>
          </Group>

          <Stack gap="sm">
            <Title c="white" className="dashboard-hero__title" order={1}>
              Пользователи и роли теперь управляются из shell
            </Title>
            <Text className="dashboard-hero__description" size="lg">
              Экран списка показывает состав команды, статус активности и
              пользователей, которым backend еще требует сменить пароль.
            </Text>
          </Stack>

          <ResponsiveButtonGroup>
            <Button
              color="accent.5"
              leftSection={<IconPlus size={18} />}
              onClick={onCreate}
              variant="white"
            >
              Создать пользователя
            </Button>
            <Button
              leftSection={<IconRefresh size={18} />}
              onClick={() => setReloadKey((currentKey) => currentKey + 1)}
              variant="light"
            >
              Обновить список
            </Button>
          </ResponsiveButtonGroup>
        </Stack>
      </Paper>

      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <MetricCard
          description="Всего доступных учетных записей"
          label="Пользователи"
          value={String(users.length)}
        />
        <MetricCard
          description="Активные учетные записи"
          label="Активные"
          value={String(activeUsersCount)}
        />
        <MetricCard
          description="Нужна обязательная смена пароля"
          label="MustChangePassword"
          value={String(passwordRotationCount)}
        />
      </SimpleGrid>

      <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
        <Stack gap="lg">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Text fw={700}>Список пользователей</Text>
              <Text c="dimmed" size="sm">
                Редактирование открывается как отдельный route-level экран.
              </Text>
            </div>

            <Badge color="brand.1" radius="xl" size="lg" variant="light">
              Только для роли HeadCoach
            </Badge>
          </Group>

          {loading ? (
            <Group justify="center" py="xl">
              <Loader color="brand.7" />
            </Group>
          ) : null}

          {!loading && error ? (
            <Alert
              color="red"
              icon={<IconAlertCircle size={18} />}
              title="Список не загрузился"
              variant="light"
            >
              {error}
            </Alert>
          ) : null}

          {!loading && !error && users.length === 0 ? (
            <Paper className="hint-card" radius="24px" withBorder>
              <Stack gap="sm">
                <Group gap="xs">
                  <ThemeIcon color="brand.7" radius="xl" size={30} variant="light">
                    <IconUsers size={16} />
                  </ThemeIcon>
                  <Text fw={700}>Пользователи пока не заведены</Text>
                </Group>
                <Text c="dimmed" size="sm">
                  Создайте администратора или тренера, чтобы выдать доступ к
                  рабочим сценариям Gym CRM.
                </Text>
              </Stack>
            </Paper>
          ) : null}

          {!loading && !error && users.length > 0 ? (
            <Stack gap="md">
              {users.map((user) => (
                <Paper
                  className="list-row-card"
                  key={user.id}
                  radius="24px"
                  withBorder
                >
                  <Group justify="space-between" wrap="wrap">
                    <Stack gap={8}>
                      <Group gap="sm" wrap="wrap">
                        <Text fw={700}>{user.fullName}</Text>
                        <Badge radius="xl" variant="light">
                          {roleLabels[user.role]}
                        </Badge>
                        <Badge
                          color={user.isActive ? 'teal' : 'gray'}
                          radius="xl"
                          variant="light"
                        >
                          {user.isActive ? 'Активен' : 'Отключен'}
                        </Badge>
                        <Badge
                          color={user.mustChangePassword ? 'accent.6' : 'brand.6'}
                          radius="xl"
                          variant="light"
                        >
                          {user.mustChangePassword
                            ? 'Требуется смена пароля'
                            : 'Пароль актуален'}
                        </Badge>
                      </Group>
                      <Text c="dimmed" size="sm">
                        Логин: {user.login}
                      </Text>
                    </Stack>

                    <Button
                      leftSection={<IconUserEdit size={18} />}
                      onClick={() => onEdit(user.id)}
                      variant="light"
                    >
                      Редактировать
                    </Button>
                  </Group>
                </Paper>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </Paper>
    </Stack>
  )
}

type UserCreateScreenProps = {
  onCancel: () => void
  onCreated: () => void
}

export function UserCreateScreen({
  onCancel,
  onCreated,
}: UserCreateScreenProps) {
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const form = useForm<CreateUserFormValues>({
    initialValues: {
      fullName: '',
      login: '',
      password: '',
      role: 'Coach',
      mustChangePassword: true,
      isActive: true,
    },
    validate: {
      fullName: (value) => (value.trim() ? null : 'Введите ФИО пользователя.'),
      login: (value) => (value.trim() ? null : 'Введите логин.'),
      password: (value) => (value ? null : 'Введите стартовый пароль.'),
      role: (value) => (value ? null : 'Выберите роль.'),
    },
  })

  async function submit(values: CreateUserFormValues) {
    setSubmitting(true)
    setFormError(null)
    form.clearErrors()

    try {
      await createUser(toCreateUserPayload(values))

      notifications.show({
        title: 'Пользователь создан',
        message: 'Новая учетная запись сохранена в системе.',
        color: 'teal',
      })

      onCreated()
    } catch (error) {
      if (error instanceof ApiError) {
        form.setErrors(applyFieldErrors(error.fieldErrors))
        setFormError(error.message)
      } else {
        setFormError('Не удалось создать пользователя. Попробуйте еще раз.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Stack className="dashboard-stack" gap="xl">
      <UserFormHero
        action={
          <Button
            leftSection={<IconArrowLeft size={18} />}
            onClick={onCancel}
            variant="white"
          >
            Назад к списку
          </Button>
        }
        badge="Создание пользователя"
        description="Главный тренер может сразу выдать роль, активность и флаг обязательной смены пароля."
        title="Новая учетная запись"
      />

      <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
        <Stack gap="lg">
          <Group gap="xs">
            <ThemeIcon color="brand.7" radius="xl" size={34} variant="light">
              <IconUserPlus size={18} />
            </ThemeIcon>
            <div>
              <Text fw={700}>Данные пользователя</Text>
              <Text c="dimmed" size="sm">
                Логин меняется только на этапе создания.
              </Text>
            </div>
          </Group>

          {formError ? (
            <Alert
              color="red"
              icon={<IconAlertCircle size={18} />}
              title="Создание не выполнено"
              variant="light"
            >
              {formError}
            </Alert>
          ) : null}

          <form onSubmit={form.onSubmit((values) => void submit(values))}>
            <Stack gap="lg">
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                <TextInput
                  label="ФИО"
                  placeholder="Иван Петров"
                  {...form.getInputProps('fullName')}
                />
                <Select
                  allowDeselect={false}
                  data={roleOptions}
                  label="Роль"
                  {...form.getInputProps('role')}
                />
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, md: 2 }}>
                <TextInput
                  autoComplete="username"
                  label="Логин"
                  placeholder="coach.petrov"
                  {...form.getInputProps('login')}
                />
                <PasswordInput
                  autoComplete="new-password"
                  label="Стартовый пароль"
                  placeholder="Введите пароль"
                  {...form.getInputProps('password')}
                />
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, md: 2 }}>
                <Switch
                  label="Пользователь активен"
                  {...form.getInputProps('isActive', { type: 'checkbox' })}
                />
                <Switch
                  label="Требовать смену пароля при входе"
                  {...form.getInputProps('mustChangePassword', {
                    type: 'checkbox',
                  })}
                />
              </SimpleGrid>

              <Paper className="hint-card" radius="24px" withBorder>
                <Stack gap={6}>
                  <Group gap="xs">
                    <ThemeIcon color="accent.5" radius="xl" size={28} variant="light">
                      <IconCheck size={16} />
                    </ThemeIcon>
                    <Text fw={700}>Поведение после сохранения</Text>
                  </Group>
                  <Text c="dimmed" size="sm">
                    Backend сам проверяет права, сохраняет роль, активность и
                    аудит события создания пользователя.
                  </Text>
                </Stack>
              </Paper>

              <ResponsiveButtonGroup justify="space-between">
                <Button onClick={onCancel} variant="subtle">
                  Отменить
                </Button>
                <Button
                  leftSection={<IconDeviceFloppy size={18} />}
                  loading={submitting}
                  type="submit"
                >
                  Сохранить пользователя
                </Button>
              </ResponsiveButtonGroup>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Stack>
  )
}

type UserEditScreenProps = {
  userId: string
  onBack: () => void
  currentUserId: string
  onRefreshSession: () => Promise<unknown>
}

export function UserEditScreen({
  userId,
  onBack,
  currentUserId,
  onRefreshSession,
}: UserEditScreenProps) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [user, setUser] = useState<UserDetails | null>(null)
  const form = useForm<EditUserFormValues>({
    initialValues: {
      fullName: '',
      login: '',
      role: null,
      mustChangePassword: false,
      isActive: true,
    },
    validate: {
      fullName: (value) => (value.trim() ? null : 'Введите ФИО пользователя.'),
      role: (value) => (value ? null : 'Выберите роль.'),
    },
  })

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setLoadError(null)
      setFormError(null)

      try {
        const nextUser = await getUser(userId, controller.signal)

        setUser(nextUser)
        form.setValues({
          fullName: nextUser.fullName,
          login: nextUser.login,
          role: nextUser.role,
          mustChangePassword: nextUser.mustChangePassword,
          isActive: nextUser.isActive,
        })
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить пользователя.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [form, userId])

  async function submit(values: EditUserFormValues) {
    setSubmitting(true)
    setFormError(null)
    form.clearErrors()

    try {
      await updateUser(userId, toUpdateUserPayload(values))

      if (userId === currentUserId) {
        await onRefreshSession()
      }

      notifications.show({
        title: 'Изменения сохранены',
        message: 'Карточка пользователя обновлена.',
        color: 'teal',
      })

      setUser((currentUser) =>
        currentUser
          ? {
              ...currentUser,
              fullName: values.fullName.trim(),
              login: values.login,
              role: values.role ?? currentUser.role,
              mustChangePassword: values.mustChangePassword,
              isActive: values.isActive,
            }
          : currentUser,
      )

      onBack()
    } catch (error) {
      if (error instanceof ApiError) {
        form.setErrors(applyFieldErrors(error.fieldErrors))
        setFormError(error.message)
      } else {
        setFormError('Не удалось сохранить пользователя. Попробуйте еще раз.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Stack className="dashboard-stack" gap="xl">
      <UserFormHero
        action={
          <Button
            leftSection={<IconArrowLeft size={18} />}
            onClick={onBack}
            variant="white"
          >
            Назад к списку
          </Button>
        }
        badge="Редактирование пользователя"
        description="Логин остается read-only, а изменения роли, активности и `MustChangePassword` уходят в backend через `PUT /users/{id}`."
        title={user ? user.fullName : 'Карточка пользователя'}
      />

      <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
        <Stack gap="lg">
          <Group gap="xs">
            <ThemeIcon color="brand.7" radius="xl" size={34} variant="light">
              <IconUserCog size={18} />
            </ThemeIcon>
            <div>
              <Text fw={700}>Редактирование доступа</Text>
              <Text c="dimmed" size="sm">
                Изменение логина запрещено по контракту этапа 4.
              </Text>
            </div>
          </Group>

          {loading ? (
            <Group justify="center" py="xl">
              <Loader color="brand.7" />
            </Group>
          ) : null}

          {!loading && loadError ? (
            <Alert
              color="red"
              icon={<IconAlertCircle size={18} />}
              title="Карточка не загрузилась"
              variant="light"
            >
              {loadError}
            </Alert>
          ) : null}

          {!loading && !loadError ? (
            <>
              {formError ? (
                <Alert
                  color="red"
                  icon={<IconAlertCircle size={18} />}
                  title="Изменения не сохранены"
                  variant="light"
                >
                  {formError}
                </Alert>
              ) : null}

              <form onSubmit={form.onSubmit((values) => void submit(values))}>
                <Stack gap="lg">
                  <SimpleGrid cols={{ base: 1, md: 2 }}>
                    <TextInput
                      label="ФИО"
                      placeholder="Иван Петров"
                      {...form.getInputProps('fullName')}
                    />
                    <Select
                      allowDeselect={false}
                      data={
                        user?.role === 'HeadCoach'
                          ? [
                              {
                                value: 'HeadCoach',
                                label: roleLabels.HeadCoach,
                              },
                            ]
                          : roleOptions
                      }
                      disabled={user?.role === 'HeadCoach'}
                      label="Роль"
                      {...form.getInputProps('role')}
                    />
                  </SimpleGrid>

                  <TextInput
                    label="Логин"
                    readOnly
                    {...form.getInputProps('login')}
                  />

                  <SimpleGrid cols={{ base: 1, md: 2 }}>
                    <Switch
                      disabled={user?.role === 'HeadCoach'}
                      label="Пользователь активен"
                      {...form.getInputProps('isActive', { type: 'checkbox' })}
                    />
                    <Switch
                      label="Требовать смену пароля при входе"
                      {...form.getInputProps('mustChangePassword', {
                        type: 'checkbox',
                      })}
                    />
                  </SimpleGrid>

                  <Paper className="hint-card" radius="24px" withBorder>
                    <Stack gap={6}>
                      <Text fw={700}>Что можно менять на этом экране</Text>
                      <Text c="dimmed" size="sm">
                        Доступны ФИО, роль, активность и флаг обязательной смены
                        пароля. Логин остается только для просмотра.
                      </Text>
                    </Stack>
                  </Paper>

                  <ResponsiveButtonGroup justify="space-between">
                    <Button onClick={onBack} variant="subtle">
                      К списку
                    </Button>
                    <Button
                      leftSection={<IconDeviceFloppy size={18} />}
                      loading={submitting}
                      type="submit"
                    >
                      Сохранить изменения
                    </Button>
                  </ResponsiveButtonGroup>
                </Stack>
              </form>
            </>
          ) : null}
        </Stack>
      </Paper>
    </Stack>
  )
}

type MetricCardProps = {
  description: string
  label: string
  value: string
}

function MetricCard({
  description,
  label,
  value,
}: MetricCardProps) {
  return (
    <Paper className="surface-card metric-card" radius="28px" withBorder>
      <Stack gap={6}>
        <Text c="dimmed" fw={600} size="sm">
          {label}
        </Text>
        <Title order={3}>{value}</Title>
        <Text c="dimmed" size="sm">
          {description}
        </Text>
      </Stack>
    </Paper>
  )
}

type UserFormHeroProps = {
  action: ReactNode
  badge: string
  description: string
  title: string
}

function UserFormHero({
  action,
  badge,
  description,
  title,
}: UserFormHeroProps) {
  return (
    <Paper className="dashboard-hero" radius="36px" shadow="lg">
      <div className="dashboard-hero__glow" />
      <Stack className="dashboard-hero__content" gap="lg">
        <Group gap="sm">
          <Badge color="accent.5" radius="xl" size="lg" variant="filled">
            Этап 4
          </Badge>
          <Badge color="brand.1" radius="xl" size="lg" variant="light">
            {badge}
          </Badge>
        </Group>

        <Stack gap="sm">
          <Title c="white" className="dashboard-hero__title" order={1}>
            {title}
          </Title>
          <Text className="dashboard-hero__description" size="lg">
            {description}
          </Text>
        </Stack>

        <Group className="management-hero__actions" gap="sm" wrap="wrap">
          {action}
        </Group>
      </Stack>
    </Paper>
  )
}

function toCreateUserPayload(
  values: CreateUserFormValues,
): CreateUserRequest {
  return {
    fullName: values.fullName.trim(),
    login: values.login.trim(),
    password: values.password,
    role: values.role ?? 'Coach',
    mustChangePassword: values.mustChangePassword,
    isActive: values.isActive,
  }
}

function toUpdateUserPayload(
  values: EditUserFormValues,
): UpdateUserRequest {
  return {
    fullName: values.fullName.trim(),
    login: values.login.trim(),
    role: values.role ?? 'Coach',
    mustChangePassword: values.mustChangePassword,
    isActive: values.isActive,
  }
}
