import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Paper,
  Select,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconArrowLeft, IconDeviceFloppy, IconUserCog } from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  getBranches,
  getUser,
  updateUser,
  type Branch,
  type UserDetails,
} from '../../lib/api'
import { resources } from '../../lib/resources'
import { showAppNotification } from '../shared/notifications'
import {
  Button,
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
  ResponsiveButtonGroup,
  SectionHeader,
} from '../shared/ux'
import {
  UserEditCredentialsFields,
  UserFormFields,
  type EditUserFormValues,
} from './UserFormFields'
import {
  toUserRoleOptions,
  userRoleOptions,
} from './UserManagement.constants'
import {
  toEditUserFormValues,
  toUpdateUserPayload,
} from './UserManagement.mappers'

type UserEditScreenProps = {
  currentUserId: string
  onBack: () => void
  onRefreshSession: () => Promise<unknown>
  userId: string
}

export function UserEditScreen({
  currentUserId,
  onBack,
  onRefreshSession,
  userId,
}: UserEditScreenProps) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [user, setUser] = useState<UserDetails | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const form = useForm<EditUserFormValues>({
    initialValues: {
      fullName: '',
      login: '',
      role: null,
      branchId: '',
      messengerPlatform: null,
      messengerPlatformUserId: '',
      mustChangePassword: false,
      isActive: true,
    },
    validate: {
      fullName: (value) =>
        value.trim() ? null : resources.users.form.validation.fullNameRequired,
      role: (value) =>
        value ? null : resources.users.form.validation.roleRequired,
      branchId: (value, values) =>
        values.role === 'Administrator' && !value
          ? 'Выберите филиал администратора.'
          : null,
    },
  })
  const formRef = useRef(form)

  useEffect(() => {
    formRef.current = form
  }, [form])

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setLoadError(null)
      setFormError(null)

      try {
        const nextUser = await getUser(userId, controller.signal)

        setUser(nextUser)
        formRef.current.setValues(toEditUserFormValues(nextUser))
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : resources.users.edit.loadingErrorMessage,
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [userId])

  useEffect(() => {
    if (user?.role !== 'Administrator' && !user?.roleOptions?.includes('Administrator')) {
      return
    }

    const controller = new AbortController()

    void getBranches({ includeArchived: true }, controller.signal)
      .then((nextBranches) => {
        if (controller.signal.aborted) {
          return
        }

        setBranches(nextBranches)
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setBranches([])
        }
      })

    return () => controller.abort()
  }, [user])

  async function submit(values: EditUserFormValues) {
    if (!canMutateUser(user)) {
      return
    }

    setSubmitting(true)
    setFormError(null)
    form.clearErrors()

    try {
      const updatedUser = await updateUser(userId, toUpdateUserPayload(values))

      if (userId === currentUserId) {
        await onRefreshSession()
      }

      setUser(updatedUser)
      form.setValues(toEditUserFormValues(updatedUser))

      showAppNotification({
        id: `user-edit-success-${userId}`,
        title: resources.users.edit.successTitle,
        message: resources.users.edit.successMessage,
        color: 'teal',
      })

      onBack()
    } catch (error) {
      if (error instanceof ApiError) {
        form.setErrors(applyFieldErrors(error.fieldErrors))
        setFormError(error.message)
      } else {
        setFormError(resources.users.edit.fallbackError)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageLayout
      actions={
        <Button
          leftSection={<IconArrowLeft size={18} />}
          onClick={onBack}
          variant="default"
        >
          {resources.users.edit.backAction}
        </Button>
      }
      title={user?.fullName ?? resources.users.edit.fallbackTitle}
    >
      <PageSection>
        <Stack gap="lg">
          <SectionHeader
            description={resources.users.edit.sectionDescription}
            eyebrow={
              <ThemeIcon color="var(--crm-action-primary)" radius="xl" size={34} variant="light">
                <IconUserCog size={18} />
              </ThemeIcon>
            }
            title={resources.users.edit.sectionTitle}
          />

          {loading ? (
            <LoadingState label="Загружаем карточку тренера..." />
          ) : null}

          {!loading && loadError ? (
            <ErrorState
              message={loadError}
              title={resources.users.edit.loadingErrorTitle}
            />
          ) : null}

          {!loading && !loadError ? (
            <>
              {user && !canMutateUser(user) ? (
                <Alert color="gray" title="Карточка доступна только для просмотра" variant="light">
                  Backend не разрешил действия изменения для этой учетной записи.
                </Alert>
              ) : null}

              {formError ? (
                <ErrorState
                  message={formError}
                  title={resources.users.edit.errorTitle}
                />
              ) : null}

              <form onSubmit={form.onSubmit((values) => void submit(values))}>
                <Stack gap="lg">
                  <UserFormFields
                    credentialsFields={<UserEditCredentialsFields form={form} />}
                    form={form}
                    isActiveDisabled={!canMutateUser(user)}
                    roleDisabled={!canMutateUser(user)}
                    roleOptions={resolveEditRoleOptions(user)}
                  />
                  {form.values.role === 'Administrator' ? (
                    <Select
                      allowDeselect={false}
                      data={buildBranchOptions(branches, user)}
                      disabled={!canMutateUser(user)}
                      error={form.errors.branchId}
                      label="Филиал администратора"
                      onChange={(value) => form.setFieldValue('branchId', value ?? '')}
                      value={form.values.branchId || null}
                    />
                  ) : null}

                  <Paper className="hint-card" radius="24px" withBorder>
                    <Stack gap={6}>
                      <Text fw={700}>{resources.users.edit.permissionsHintTitle}</Text>
                      <Text c="dimmed" size="sm">
                        {resources.users.edit.permissionsHintDescription}
                      </Text>
                    </Stack>
                  </Paper>

                  <ResponsiveButtonGroup justify="space-between">
                    <Button onClick={onBack} variant="subtle">
                      {resources.users.edit.listAction}
                    </Button>
                    {canMutateUser(user) ? (
                      <Button
                        leftSection={<IconDeviceFloppy size={18} />}
                        loading={submitting}
                        type="submit"
                      >
                        {resources.users.edit.submit}
                      </Button>
                    ) : null}
                  </ResponsiveButtonGroup>
                </Stack>
              </form>
            </>
          ) : null}
        </Stack>
      </PageSection>
    </PageLayout>
  )
}

function canMutateUser(user: UserDetails | null) {
  if (!user) {
    return false
  }

  if (user.allowedActions === undefined) {
    return true
  }

  return user.allowedActions.includes('Edit') || user.allowedActions.includes('Update')
}

function resolveEditRoleOptions(user: UserDetails | null) {
  if (user?.roleOptions?.length) {
    return toUserRoleOptions(user.roleOptions)
  }

  if (user) {
    return toUserRoleOptions([user.role])
  }

  return userRoleOptions
}

function buildBranchOptions(branches: Branch[], user: UserDetails | null) {
  const activeOptions = branches
    .filter((branch) => !branch.isArchived)
    .map((branch) => ({ value: branch.id, label: branch.name }))

  if (
    user?.branchId &&
    !activeOptions.some((option) => option.value === user.branchId)
  ) {
    activeOptions.push({
      value: user.branchId,
      label: user.branchName ? `${user.branchName} (архивный)` : 'Архивный филиал',
    })
  }

  return activeOptions
}
