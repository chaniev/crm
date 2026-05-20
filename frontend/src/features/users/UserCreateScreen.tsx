import { useState } from 'react'
import {
  Group,
  Paper,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import {
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
import { showAppNotification } from '../shared/notifications'
import {
  Button,
  ErrorState,
  PageLayout,
  PageSection,
  ResponsiveButtonGroup,
  SectionHeader,
} from '../shared/ux'
import { UserFormFields, UserCreateCredentialsFields, type CreateUserFormValues } from './UserFormFields'
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
      messengerPlatform: null,
      messengerPlatformUserId: '',
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

      showAppNotification({
        id: 'user-create-success',
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
    <PageLayout
      actions={
        <Button
          leftSection={<IconArrowLeft size={18} />}
          onClick={onCancel}
          variant="default"
        >
          {resources.users.create.backAction}
        </Button>
      }
      title={resources.users.create.title}
    >
      <PageSection>
        <Stack gap="lg">
          <SectionHeader
            description={resources.users.create.sectionDescription}
            eyebrow={
              <ThemeIcon color="brand.7" radius="xl" size={34} variant="light">
                <IconUserPlus size={18} />
              </ThemeIcon>
            }
            title={resources.users.create.sectionTitle}
          />

          {formError ? (
            <ErrorState
              message={formError}
              title={resources.users.create.errorTitle}
            />
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
      </PageSection>
    </PageLayout>
  )
}
