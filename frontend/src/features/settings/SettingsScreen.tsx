import { useEffect, useState } from 'react'
import {
  Alert,
  Badge,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useMediaQuery } from '@mantine/hooks'
import {
  IconAlertCircle,
  IconDeviceFloppy,
  IconEdit,
  IconRefresh,
  IconSettings,
  IconTags,
  IconTrash,
  IconUserCog,
  IconUserPlus,
} from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  createAdministrator,
  createGroupType,
  deleteGroupType,
  getAdministrators,
  getGroupTypes,
  updateAdministrator,
  updateGroupType,
  type GroupType,
  type UserListItem,
} from '../../lib/api'
import {
  Button,
  ConfirmActionModal,
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  PageLayout,
  PageSection,
  PageTabsPanel,
  RefreshButton,
  ResponsiveButtonGroup,
  SectionHeader,
} from '../shared/ux'
import { showAppNotification } from '../shared/notifications'
import {
  UserCreateCredentialsFields,
  UserEditCredentialsFields,
  UserFormFields,
  type CreateUserFormValues,
  type EditUserFormValues,
} from '../users/UserFormFields'
import { userRoleLabels } from '../users/UserManagement.constants'
import {
  toCreateUserPayload,
  toEditUserFormValues,
  toUpdateUserPayload,
} from '../users/UserManagement.mappers'
import { BranchSettingsScreen } from './BranchSettingsScreen'

type SettingsTab = 'group-types' | 'branches' | 'administrators'

const administratorRoleOptions = [
  { value: 'Administrator' as const, label: userRoleLabels.Administrator },
]

export function SettingsScreen() {
  const isMobile = useMediaQuery('(max-width: 48em)')

  return (
    <PageLayout data-testid="settings-screen" title="Настройки">
      <Tabs defaultValue="group-types" keepMounted={false}>
        <PageSection>
          <Tabs.List grow={isMobile}>
            <Tabs.Tab
              leftSection={<IconTags size={18} />}
              value={'group-types' satisfies SettingsTab}
            >
              Типы групп
            </Tabs.Tab>
            <Tabs.Tab
              leftSection={<IconSettings size={18} />}
              value={'branches' satisfies SettingsTab}
            >
              Филиалы и залы
            </Tabs.Tab>
            <Tabs.Tab
              leftSection={<IconUserCog size={18} />}
              value={'administrators' satisfies SettingsTab}
            >
              Администраторы
            </Tabs.Tab>
          </Tabs.List>
        </PageSection>

        <PageTabsPanel value={'group-types' satisfies SettingsTab}>
          <GroupTypesSettingsPanel />
        </PageTabsPanel>

        <PageTabsPanel value={'branches' satisfies SettingsTab}>
          <BranchSettingsScreen embedded />
        </PageTabsPanel>

        <PageTabsPanel value={'administrators' satisfies SettingsTab}>
          <AdministratorsSettingsPanel />
        </PageTabsPanel>
      </Tabs>
    </PageLayout>
  )
}

type GroupTypeFormValues = {
  name: string
  description: string
}

type GroupTypeModalState =
  | { mode: 'create' }
  | { mode: 'edit'; groupType: GroupType }
  | null

function GroupTypesSettingsPanel() {
  const [groupTypes, setGroupTypes] = useState<GroupType[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [modalState, setModalState] = useState<GroupTypeModalState>(null)
  const [submitting, setSubmitting] = useState(false)
  const [groupTypeToDelete, setGroupTypeToDelete] = useState<GroupType | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  const form = useForm<GroupTypeFormValues>({
    initialValues: {
      name: '',
      description: '',
    },
    validate: {
      name: (value) => (value.trim() ? null : 'Введите название типа.'),
    },
  })

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setLoadError(null)

      try {
        setGroupTypes(await getGroupTypes(controller.signal))
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить типы групп.',
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

  function openCreateModal() {
    form.setValues({ name: '', description: '' })
    form.clearErrors()
    setFormError(null)
    setModalState({ mode: 'create' })
  }

  function openEditModal(groupType: GroupType) {
    form.setValues({
      name: groupType.name,
      description: groupType.description ?? '',
    })
    form.clearErrors()
    setFormError(null)
    setModalState({ mode: 'edit', groupType })
  }

  async function submit(values: GroupTypeFormValues) {
    if (!modalState) {
      return
    }

    setSubmitting(true)
    setFormError(null)
    form.clearErrors()

    try {
      const payload = {
        name: values.name.trim(),
        description: values.description.trim() || null,
      }
      const savedGroupType =
        modalState.mode === 'create'
          ? await createGroupType(payload)
          : await updateGroupType(modalState.groupType.id, payload)

      setGroupTypes((current) =>
        modalState.mode === 'create'
          ? [...current, savedGroupType].sort(compareGroupTypes)
          : current
              .map((groupType) =>
                groupType.id === savedGroupType.id ? savedGroupType : groupType,
              )
              .sort(compareGroupTypes),
      )
      setModalState(null)

      showAppNotification({
        id: `settings-group-type-${modalState.mode}`,
        title: modalState.mode === 'create' ? 'Тип группы создан' : 'Тип группы обновлен',
        message: `Справочник «${savedGroupType.name}» сохранен.`,
        color: 'teal',
      })
    } catch (error) {
      if (error instanceof ApiError) {
        form.setErrors(applyFieldErrors(error.fieldErrors))
        setFormError(error.message)
        return
      }

      setFormError('Не удалось сохранить тип группы.')
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmDeleteGroupType() {
    if (!groupTypeToDelete) {
      return
    }

    setDeletePending(true)

    try {
      await deleteGroupType(groupTypeToDelete.id)
      setGroupTypes((current) =>
        current.filter((groupType) => groupType.id !== groupTypeToDelete.id),
      )
      showAppNotification({
        id: 'settings-group-type-delete-success',
        title: 'Тип группы удален',
        message: `Справочник «${groupTypeToDelete.name}» удален.`,
        color: 'teal',
      })
      setGroupTypeToDelete(null)
    } catch (error) {
      showAppNotification({
        id: 'settings-group-type-delete-error',
        title: 'Удаление не выполнено',
        message:
          error instanceof Error
            ? error.message
            : 'Не удалось удалить тип группы.',
        color: 'red',
      })
    } finally {
      setDeletePending(false)
    }
  }

  return (
    <Stack gap="xl">
      <PageSection>
        <Stack gap="lg">
          <SectionHeader
            actions={(
              <ResponsiveButtonGroup>
                <Button
                  color="accent.5"
                  leftSection={<IconTags size={18} />}
                  onClick={openCreateModal}
                >
                  Добавить тип
                </Button>
                <RefreshButton onClick={() => setReloadKey((key) => key + 1)} />
              </ResponsiveButtonGroup>
            )}
            description="Справочник используется при создании и редактировании тренировочных групп."
            title="Типы групп"
          />

          {loading ? <LoadingState label="Загружаем типы групп..." /> : null}

          {!loading && loadError ? (
            <ErrorState message={loadError} title="Типы групп не загрузились" />
          ) : null}

          {!loading && !loadError && groupTypes.length === 0 ? (
            <EmptyState
              action={<Button onClick={openCreateModal}>Добавить тип</Button>}
              icon={<IconTags size={24} />}
              title="Типы групп пока не заведены"
            />
          ) : null}

          {!loading && !loadError && groupTypes.length > 0 ? (
            <Stack gap="md">
              {groupTypes.map((groupType) => (
                <Paper
                  className="list-row-card"
                  data-testid={`group-type-card-${groupType.id}`}
                  key={groupType.id}
                  radius="24px"
                  withBorder
                >
                  <Group justify="space-between" wrap="wrap">
                    <Stack gap={8}>
                      <Group gap="sm" wrap="wrap">
                        <Text fw={700}>{groupType.name}</Text>
                        <Badge color="brand.1" radius="xl" variant="light">
                          Групп: {groupType.groupCount}
                        </Badge>
                      </Group>
                      {groupType.description ? (
                        <Text c="dimmed" size="sm">
                          {groupType.description}
                        </Text>
                      ) : null}
                    </Stack>

                    <ResponsiveButtonGroup justify="flex-end">
                      <Button
                        leftSection={<IconEdit size={18} />}
                        onClick={() => openEditModal(groupType)}
                        variant="pill"
                      >
                        Редактировать
                      </Button>
                      <Button
                        color="red"
                        disabled={groupType.groupCount > 0}
                        leftSection={<IconTrash size={18} />}
                        onClick={() => setGroupTypeToDelete(groupType)}
                        variant="pill"
                      >
                        Удалить
                      </Button>
                    </ResponsiveButtonGroup>
                  </Group>
                </Paper>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </PageSection>

      <Modal
        centered
        onClose={() => setModalState(null)}
        opened={Boolean(modalState)}
        radius="24px"
        title={modalState?.mode === 'create' ? 'Новый тип группы' : 'Редактирование типа'}
      >
        <form onSubmit={form.onSubmit((values) => void submit(values))}>
          <Stack gap="lg">
            {formError ? (
              <Alert
                color="red"
                icon={<IconAlertCircle size={18} />}
                title="Сохранение не выполнено"
                variant="light"
              >
                {formError}
              </Alert>
            ) : null}
            <TextInput
              label="Название"
              placeholder="Например, Детская группа"
              {...form.getInputProps('name')}
            />
            <Textarea
              autosize
              label="Описание"
              minRows={3}
              placeholder="Краткое пояснение для администраторов"
              {...form.getInputProps('description')}
            />

            <ResponsiveButtonGroup justify="flex-end">
              <Button onClick={() => setModalState(null)} variant="secondary">
                Отменить
              </Button>
              <Button
                leftSection={<IconDeviceFloppy size={18} />}
                loading={submitting}
                type="submit"
              >
                Сохранить
              </Button>
            </ResponsiveButtonGroup>
          </Stack>
        </form>
      </Modal>

      <ConfirmActionModal
        confirmColor="red"
        confirmLabel="Удалить"
        description={`Тип «${groupTypeToDelete?.name ?? ''}» будет удален из справочника.`}
        onClose={() => setGroupTypeToDelete(null)}
        onConfirm={() => void confirmDeleteGroupType()}
        opened={Boolean(groupTypeToDelete)}
        pending={deletePending}
        title="Удалить тип группы?"
      />
    </Stack>
  )
}

type AdministratorModalState =
  | { mode: 'create' }
  | { mode: 'edit'; administrator: UserListItem }
  | null

function AdministratorsSettingsPanel() {
  const [administrators, setAdministrators] = useState<UserListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [modalState, setModalState] = useState<AdministratorModalState>(null)
  const [submitting, setSubmitting] = useState(false)
  const createForm = useForm<CreateUserFormValues>({
    initialValues: {
      fullName: '',
      login: '',
      password: '',
      role: 'Administrator',
      messengerPlatform: null,
      messengerPlatformUserId: '',
      mustChangePassword: true,
      isActive: true,
    },
  })
  const editForm = useForm<EditUserFormValues>({
    initialValues: {
      fullName: '',
      login: '',
      role: 'Administrator',
      messengerPlatform: null,
      messengerPlatformUserId: '',
      mustChangePassword: false,
      isActive: true,
    },
  })

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setLoadError(null)

      try {
        setAdministrators(await getAdministrators(controller.signal))
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить администраторов.',
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

  function openCreateModal() {
    createForm.setValues({
      fullName: '',
      login: '',
      password: '',
      role: 'Administrator',
      messengerPlatform: null,
      messengerPlatformUserId: '',
      mustChangePassword: true,
      isActive: true,
    })
    createForm.clearErrors()
    setFormError(null)
    setModalState({ mode: 'create' })
  }

  function openEditModal(administrator: UserListItem) {
    editForm.setValues({
      ...toEditUserFormValues(administrator),
      role: 'Administrator',
    })
    editForm.clearErrors()
    setFormError(null)
    setModalState({ mode: 'edit', administrator })
  }

  async function submitCreate(values: CreateUserFormValues) {
    setSubmitting(true)
    setFormError(null)
    createForm.clearErrors()

    try {
      const payload = toCreateUserPayload({
        ...values,
        role: 'Administrator',
      })
      const createdAdministrator = await createAdministrator({
        fullName: payload.fullName,
        login: payload.login,
        password: payload.password,
        mustChangePassword: payload.mustChangePassword,
        isActive: payload.isActive,
        messengerPlatform: payload.messengerPlatform,
        messengerPlatformUserId: payload.messengerPlatformUserId,
      })
      setAdministrators((current) =>
        [...current, createdAdministrator].sort(compareUsers),
      )
      setModalState(null)
      showAppNotification({
        id: 'settings-administrator-create-success',
        title: 'Администратор создан',
        message: `Пользователь «${createdAdministrator.fullName}» добавлен.`,
        color: 'teal',
      })
    } catch (error) {
      if (error instanceof ApiError) {
        createForm.setErrors(applyFieldErrors(error.fieldErrors))
        setFormError(error.message)
        return
      }

      setFormError('Не удалось создать администратора.')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitEdit(values: EditUserFormValues) {
    if (!modalState || modalState.mode !== 'edit') {
      return
    }

    setSubmitting(true)
    setFormError(null)
    editForm.clearErrors()

    try {
      const payload = toUpdateUserPayload({
        ...values,
        role: 'Administrator',
      })
      const updatedAdministrator = await updateAdministrator(
        modalState.administrator.id,
        {
          fullName: payload.fullName,
          login: payload.login,
          mustChangePassword: payload.mustChangePassword,
          isActive: payload.isActive,
          messengerPlatform: payload.messengerPlatform,
          messengerPlatformUserId: payload.messengerPlatformUserId,
        },
      )
      setAdministrators((current) =>
        current
          .map((administrator) =>
            administrator.id === updatedAdministrator.id
              ? updatedAdministrator
              : administrator,
          )
          .sort(compareUsers),
      )
      setModalState(null)
      showAppNotification({
        id: `settings-administrator-edit-success-${modalState.administrator.id}`,
        title: 'Администратор обновлен',
        message: `Изменения «${updatedAdministrator.fullName}» сохранены.`,
        color: 'teal',
      })
    } catch (error) {
      if (error instanceof ApiError) {
        editForm.setErrors(applyFieldErrors(error.fieldErrors))
        setFormError(error.message)
        return
      }

      setFormError('Не удалось сохранить администратора.')
    } finally {
      setSubmitting(false)
    }
  }

  const activeCount = administrators.filter((administrator) => administrator.isActive).length
  const passwordRotationCount = administrators.filter(
    (administrator) => administrator.mustChangePassword,
  ).length

  return (
    <Stack gap="xl">
      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <MetricCard
          description="Пользователи с ролью администратора"
          label="Администраторы"
          value={String(administrators.length)}
        />
        <MetricCard
          description="Могут входить в CRM"
          label="Активные"
          value={String(activeCount)}
        />
        <MetricCard
          description="Должны сменить пароль при входе"
          label="Смена пароля"
          value={String(passwordRotationCount)}
        />
      </SimpleGrid>

      <PageSection>
        <Stack gap="lg">
          <SectionHeader
            actions={(
              <ResponsiveButtonGroup>
                <Button
                  color="accent.5"
                  leftSection={<IconUserPlus size={18} />}
                  onClick={openCreateModal}
                >
                  Добавить администратора
                </Button>
                <RefreshButton
                  leftSection={<IconRefresh size={18} />}
                  onClick={() => setReloadKey((key) => key + 1)}
                />
              </ResponsiveButtonGroup>
            )}
            description="Администраторы управляют настройками, клиентами, группами и журналом без доступа к созданию тренеров."
            title="Администраторы"
          />

          {loading ? <LoadingState label="Загружаем администраторов..." /> : null}

          {!loading && loadError ? (
            <ErrorState
              message={loadError}
              title="Администраторы не загрузились"
            />
          ) : null}

          {!loading && !loadError && administrators.length === 0 ? (
            <EmptyState
              action={<Button onClick={openCreateModal}>Добавить администратора</Button>}
              icon={<IconUserCog size={24} />}
              title="Администраторы пока не добавлены"
            />
          ) : null}

          {!loading && !loadError && administrators.length > 0 ? (
            <Stack gap="md">
              {administrators.map((administrator) => (
                <Paper
                  className="list-row-card"
                  data-testid={`administrator-card-${administrator.id}`}
                  key={administrator.id}
                  radius="24px"
                  withBorder
                >
                  <Group justify="space-between" wrap="wrap">
                    <Stack gap={8}>
                      <Group gap="sm" wrap="wrap">
                        <Text fw={700}>{administrator.fullName}</Text>
                        <Badge radius="xl" variant="light">
                          {userRoleLabels.Administrator}
                        </Badge>
                        <Badge
                          color={administrator.isActive ? 'teal' : 'gray'}
                          radius="xl"
                          variant="light"
                        >
                          {administrator.isActive ? 'Активен' : 'Отключен'}
                        </Badge>
                      </Group>
                      <Text c="dimmed" size="sm">
                        Логин: {administrator.login}
                      </Text>
                      {administrator.messengerPlatformUserId ? (
                        <Text c="dimmed" size="sm">
                          Telegram ID: {administrator.messengerPlatformUserId}
                        </Text>
                      ) : null}
                    </Stack>

                    <Button
                      leftSection={<IconEdit size={18} />}
                      onClick={() => openEditModal(administrator)}
                      variant="pill"
                    >
                      Редактировать
                    </Button>
                  </Group>
                </Paper>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </PageSection>

      <Modal
        centered
        onClose={() => setModalState(null)}
        opened={Boolean(modalState)}
        radius="24px"
        title={
          modalState?.mode === 'create'
            ? 'Новый администратор'
            : 'Редактирование администратора'
        }
      >
        {modalState?.mode === 'create' ? (
          <form onSubmit={createForm.onSubmit((values) => void submitCreate(values))}>
            <Stack gap="lg">
              <AdministratorFormError message={formError} />
              <UserFormFields
                credentialsFields={<UserCreateCredentialsFields form={createForm} />}
                form={createForm}
                roleDisabled
                roleOptions={administratorRoleOptions}
              />
              <SettingsFormActions
                onCancel={() => setModalState(null)}
                submitting={submitting}
              />
            </Stack>
          </form>
        ) : null}

        {modalState?.mode === 'edit' ? (
          <form onSubmit={editForm.onSubmit((values) => void submitEdit(values))}>
            <Stack gap="lg">
              <AdministratorFormError message={formError} />
              <UserFormFields
                credentialsFields={<UserEditCredentialsFields form={editForm} />}
                form={editForm}
                roleDisabled
                roleOptions={administratorRoleOptions}
              />
              <SettingsFormActions
                onCancel={() => setModalState(null)}
                submitting={submitting}
              />
            </Stack>
          </form>
        ) : null}
      </Modal>
    </Stack>
  )
}

function AdministratorFormError({ message }: { message: string | null }) {
  if (!message) {
    return null
  }

  return (
    <Alert
      color="red"
      icon={<IconAlertCircle size={18} />}
      title="Сохранение не выполнено"
      variant="light"
    >
      {message}
    </Alert>
  )
}

function SettingsFormActions({
  onCancel,
  submitting,
}: {
  onCancel: () => void
  submitting: boolean
}) {
  return (
    <ResponsiveButtonGroup justify="flex-end">
      <Button onClick={onCancel} variant="secondary">
        Отменить
      </Button>
      <Button
        leftSection={<IconDeviceFloppy size={18} />}
        loading={submitting}
        type="submit"
      >
        Сохранить
      </Button>
    </ResponsiveButtonGroup>
  )
}

function compareGroupTypes(left: GroupType, right: GroupType) {
  return left.name.localeCompare(right.name, 'ru')
}

function compareUsers(left: UserListItem, right: UserListItem) {
  return left.fullName.localeCompare(right.fullName, 'ru')
}
