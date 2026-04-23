import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconArrowLeft,
  IconDeviceFloppy,
  IconUserCog,
} from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  getUser,
  updateUser,
  type UserDetails,
} from '../../lib/api'
import { resources } from '../../lib/resources'
import { ResponsiveButtonGroup } from '../shared/ux'
import {
  UserEditCredentialsFields,
  UserFormFields,
  type EditUserFormValues,
} from './UserFormFields'
import { UserManagementHero } from './UserManagementHero'
import {
  headCoachRoleOptions,
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
  const form = useForm<EditUserFormValues>({
    initialValues: {
      fullName: '',
      login: '',
      role: null,
      mustChangePassword: false,
      isActive: true,
    },
    validate: {
      fullName: (value) =>
        value.trim() ? null : resources.users.form.validation.fullNameRequired,
      role: (value) =>
        value ? null : resources.users.form.validation.roleRequired,
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
        form.setValues(toEditUserFormValues(nextUser))
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
  }, [form, userId])

  async function submit(values: EditUserFormValues) {
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

      notifications.show({
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
    <Stack className="dashboard-stack" gap="xl">
      <UserManagementHero
        action={
          <Button
            leftSection={<IconArrowLeft size={18} />}
            onClick={onBack}
            variant="default"
          >
            {resources.users.edit.backAction}
          </Button>
        }
        badge={resources.users.edit.badge}
        description={resources.users.edit.description}
        title={user?.fullName ?? resources.users.edit.fallbackTitle}
      />

      <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
        <Stack gap="lg">
          <Group gap="xs">
            <ThemeIcon color="brand.7" radius="xl" size={34} variant="light">
              <IconUserCog size={18} />
            </ThemeIcon>
            <div>
              <Text fw={700}>{resources.users.edit.sectionTitle}</Text>
              <Text c="dimmed" size="sm">
                {resources.users.edit.sectionDescription}
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
              title={resources.users.edit.loadingErrorTitle}
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
                  title={resources.users.edit.errorTitle}
                  variant="light"
                >
                  {formError}
                </Alert>
              ) : null}

              <form onSubmit={form.onSubmit((values) => void submit(values))}>
                <Stack gap="lg">
                  <UserFormFields
                    credentialsFields={<UserEditCredentialsFields form={form} />}
                    form={form}
                    isActiveDisabled={user?.role === 'HeadCoach'}
                    roleDisabled={user?.role === 'HeadCoach'}
                    roleOptions={
                      user?.role === 'HeadCoach'
                        ? headCoachRoleOptions
                        : userRoleOptions
                    }
                  />

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
                    <Button
                      leftSection={<IconDeviceFloppy size={18} />}
                      loading={submitting}
                      type="submit"
                    >
                      {resources.users.edit.submit}
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
