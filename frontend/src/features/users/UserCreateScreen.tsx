import { useEffect, useState } from 'react'
import {
  Group,
  Paper,
  Select,
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
  getBranches,
  type Branch,
  type UserDetails,
  type UserRole,
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
import { toUserRoleOptions, userRoleOptions } from './UserManagement.constants'
import { toCreateUserPayload } from './UserManagement.mappers'

type UserCreateScreenProps = {
  createRoleOptions?: UserRole[]
  onCancel: () => void
  onCreated: (user: UserDetails) => void
}

export function UserCreateScreen({
  createRoleOptions,
  onCancel,
  onCreated,
}: UserCreateScreenProps) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const resolvedRoleOptions = createRoleOptions?.length
    ? toUserRoleOptions(createRoleOptions)
    : userRoleOptions
  const initialRole = resolvedRoleOptions[0]?.value ?? 'Coach'
  const form = useForm<CreateUserFormValues>({
    initialValues: {
      fullName: '',
      login: '',
      password: '',
      role: initialRole,
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
      role: (value) =>
        value ? null : resources.users.form.validation.roleRequired,
      branchId: (value, values) =>
        values.role === 'Administrator' && !value
          ? 'Выберите филиал администратора.'
          : null,
    },
  })

  useEffect(() => {
    if (!createRoleOptions?.includes('Administrator')) {
      return
    }

    const controller = new AbortController()

    void getBranches({ includeArchived: false }, controller.signal)
      .then((nextBranches) => {
        if (controller.signal.aborted) {
          return
        }

        const activeBranches = nextBranches.filter((branch) => !branch.isArchived)
        setBranches(activeBranches)
        if (!form.values.branchId) {
          form.setFieldValue('branchId', activeBranches[0]?.id || '')
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setBranches([])
        }
      })

    return () => controller.abort()
  }, [createRoleOptions, form])

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
                roleOptions={resolvedRoleOptions}
                showRoleField={resolvedRoleOptions.length > 1}
              />
              {form.values.role === 'Administrator' ? (
                <Select
                  allowDeselect={false}
                  data={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
                  error={form.errors.branchId}
                  label="Филиал администратора"
                  onChange={(value) => form.setFieldValue('branchId', value ?? '')}
                  value={form.values.branchId || null}
                />
              ) : null}

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
