import { useState } from 'react'
import {
  Alert,
  Button,
  Group,
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
  IconCheck,
  IconDeviceFloppy,
  IconUserPlus,
} from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  createUser,
  type UserDetails,
} from '../../lib/api'
import { resources } from '../../lib/resources'
import { ResponsiveButtonGroup } from '../shared/ux'
import { UserFormFields, UserCreateCredentialsFields, type CreateUserFormValues } from './UserFormFields'
import { UserManagementHero } from './UserManagementHero'
import { userRoleOptions } from './UserManagement.constants'
import { toCreateUserPayload } from './UserManagement.mappers'

type UserCreateScreenProps = {
  onCancel: () => void
  onCreated: (user: UserDetails) => void
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
      fullName: (value) =>
        value.trim() ? null : resources.users.form.validation.fullNameRequired,
      login: (value) =>
        value.trim() ? null : resources.users.form.validation.loginRequired,
      password: (value) =>
        value ? null : resources.users.form.validation.passwordRequired,
      role: (value) =>
        value ? null : resources.users.form.validation.roleRequired,
    },
  })

  async function submit(values: CreateUserFormValues) {
    setSubmitting(true)
    setFormError(null)
    form.clearErrors()

    try {
      const createdUser = await createUser(toCreateUserPayload(values))

      notifications.show({
        title: resources.users.create.successTitle,
        message: resources.users.create.successMessage,
        color: 'teal',
      })

      onCreated(createdUser)
    } catch (error) {
      if (error instanceof ApiError) {
        form.setErrors(applyFieldErrors(error.fieldErrors))
        setFormError(error.message)
      } else {
        setFormError(resources.users.create.fallbackError)
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
            onClick={onCancel}
            variant="default"
          >
            {resources.users.create.backAction}
          </Button>
        }
        badge={resources.users.create.badge}
        description={resources.users.create.description}
        title={resources.users.create.title}
      />

      <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
        <Stack gap="lg">
          <Group gap="xs">
            <ThemeIcon color="brand.7" radius="xl" size={34} variant="light">
              <IconUserPlus size={18} />
            </ThemeIcon>
            <div>
              <Text fw={700}>{resources.users.create.sectionTitle}</Text>
              <Text c="dimmed" size="sm">
                {resources.users.create.sectionDescription}
              </Text>
            </div>
          </Group>

          {formError ? (
            <Alert
              color="red"
              icon={<IconAlertCircle size={18} />}
              title={resources.users.create.errorTitle}
              variant="light"
            >
              {formError}
            </Alert>
          ) : null}

          <form onSubmit={form.onSubmit((values) => void submit(values))}>
            <Stack gap="lg">
              <UserFormFields
                credentialsFields={<UserCreateCredentialsFields form={form} />}
                form={form}
                roleOptions={userRoleOptions}
              />

              <Paper className="hint-card" radius="24px" withBorder>
                <Stack gap={6}>
                  <Group gap="xs">
                    <ThemeIcon color="accent.5" radius="xl" size={28} variant="light">
                      <IconCheck size={16} />
                    </ThemeIcon>
                    <Text fw={700}>{resources.users.create.loadingHintTitle}</Text>
                  </Group>
                  <Text c="dimmed" size="sm">
                    {resources.users.create.loadingHintDescription}
                  </Text>
                </Stack>
              </Paper>

              <ResponsiveButtonGroup justify="space-between">
                <Button onClick={onCancel} variant="subtle">
                  {resources.common.actions.cancel}
                </Button>
                <Button
                  leftSection={<IconDeviceFloppy size={18} />}
                  loading={submitting}
                  type="submit"
                >
                  {resources.users.create.submit}
                </Button>
              </ResponsiveButtonGroup>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Stack>
  )
}
