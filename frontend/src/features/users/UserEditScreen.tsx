import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Stack,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  getUser,
  updateUser,
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
  StickyFormActions,
} from '../shared/ux'
import {
  UserEditCredentialsFields,
  UserFormFields,
  type EditUserFormValues,
} from './UserFormFields'
import {
  toEditUserFormValues,
  toUpdateUserPayload,
} from './UserManagement.mappers'
import { fe11SettingsUsersText } from '../../resources/fe-11-settings-users'


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
      branchId: '',
      messengerPlatform: null,
      messengerPlatformUserId: '',
      mustChangePassword: false,
      isActive: true,
    },
    validate: {
      fullName: (value) =>
        value.trim() ? null : resources.users.form.validation.fullNameRequired,
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

  async function submit(values: EditUserFormValues) {
    if (!canMutateUser(user)) {
      return
    }

    setSubmitting(true)
    setFormError(null)
    form.clearErrors()

    try {
      const updatedUser = await updateUser(userId, toUpdateUserPayload({
        ...values,
        role: 'Coach',
        branchId: '',
      }))

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

  const userCanMutate = canMutateUser(user)

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
          {loading ? (
            <LoadingState label={fe11SettingsUsersText.userEditScreen_label_aba60338} />
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
                <Alert color="gray" title={fe11SettingsUsersText.userEditScreen_title_ee98a5ee} variant="light">
                  {fe11SettingsUsersText.userEditScreen_jsxText_36d97fdf}</Alert>
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
                    isActiveDisabled={!userCanMutate}
                    roleOptions={[]}
                    showRoleField={false}
                  />

                  {userCanMutate ? (
                    <StickyFormActions
                      primaryAction={<Button
                        leftSection={<IconDeviceFloppy size={18} />}
                        loading={submitting}
                        type="submit"
                      >
                        {resources.users.edit.submit}
                      </Button>}
                    />
                  ) : null}
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
