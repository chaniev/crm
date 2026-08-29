import { useState } from 'react'
import {
  Stack,
  ThemeIcon,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import {
  IconArrowLeft,
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
  StickyFormActions,
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
      branchId: '',
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
    },
  })

  async function submit(values: CreateUserFormValues) {
    setSubmitting(true)
    setFormError(null)
    form.clearErrors()

    try {
      const createdUser = await createUser(toCreateUserPayload({
        ...values,
        role: 'Coach',
        branchId: '',
      }))

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
              <ThemeIcon color="var(--crm-action-primary)" radius="xl" size={34} variant="light">
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
                showRoleField={false}
              />

              <StickyFormActions
                secondaryAction={<Button onClick={onCancel} type="button" variant="subtle">
                  {resources.common.actions.cancel}
                </Button>}
                primaryAction={<Button
                  leftSection={<IconDeviceFloppy size={18} />}
                  loading={submitting}
                  type="submit"
                >
                  {resources.users.create.submit}
                </Button>}
              />
            </Stack>
          </form>
        </Stack>
      </PageSection>
    </PageLayout>
  )
}
