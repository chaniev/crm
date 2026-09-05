import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Badge,
  Group,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useMediaQuery } from '@mantine/hooks'
import {
  IconAlertCircle,
  IconDeviceFloppy,
  IconEdit,
  IconRefresh,
  IconUserCog,
  IconUserPlus,
  IconUsersGroup,
} from '@tabler/icons-react'
import type { MouseEvent, ReactNode } from 'react'
import {
  ApiError,
  applyFieldErrors,
  createAdministrator,
  getAdministrators,
  getBranches,
  updateAdministrator,
  type AdministrativeUserRole,
  type Branch,
  type UserListItem,
  type UserRole,
} from '../../lib/api'
import { showAppNotification } from '../shared/notifications'
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageSection,
  ResponsiveButtonGroup,
  TaskToolbarAction,
  TaskToolbarActions,
  TaskToolbarRefreshAction,
  TemporarySurfaceFooter,
} from '../shared/ux'
import {
  UserCreateCredentialsFields,
  UserEditCredentialsFields,
  UserFormFields,
  type CreateUserFormValues,
  type EditUserFormValues,
} from '../users/UserFormFields'
import { toUserRoleOptions, userRoleLabels } from '../users/UserManagement.constants'
import {
  toCreateUserPayload,
  toEditUserFormValues,
  toUpdateUserPayload,
} from '../users/UserManagement.mappers'
import { AdministratorAttendanceScopeModal } from './AdministratorAttendanceScopeModal'
import { fe11SettingsUsersText } from '../../resources/fe-11-settings-users'


type AdministratorModalState =
  | { mode: 'create' }
  | { mode: 'edit'; administrator: UserListItem }
  | null

type AdministratorsSettingsPanelProps = {
  onOpenBranches?: () => void
}

export function AdministratorsSettingsPanel({
  onOpenBranches,
}: AdministratorsSettingsPanelProps) {
  const isMobile = useMediaQuery(
    '(max-width: 47.99375em), (max-height: 47.99375em) and (pointer: coarse)',
  )
  const [administrators, setAdministrators] = useState<UserListItem[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchesLoading, setBranchesLoading] = useState(true)
  const [branchesError, setBranchesError] = useState<string | null>(null)
  const [createRoleOptions, setCreateRoleOptions] = useState<UserRole[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [branchesReloadKey, setBranchesReloadKey] = useState(0)
  const [modalState, setModalState] = useState<AdministratorModalState>(null)
  const [scopeAdministrator, setScopeAdministrator] = useState<UserListItem | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const modalOpenerRef = useRef<HTMLElement | null>(null)
  const activeBranches = useMemo(
    () => branches.filter((branch) => !branch.isArchived),
    [branches],
  )
  const canCreateAdministrator = createRoleOptions.length > 0
  const createForm = useForm<CreateUserFormValues>({
    initialValues: buildCreateInitialValues('Administrator', ''),
    validate: {
      fullName: (value) => (value.trim() ? null : fe11SettingsUsersText.administratorsSettingsPanel_string_9447dd32),
      login: (value) => (value.trim() ? null : fe11SettingsUsersText.administratorsSettingsPanel_string_c9715294),
      password: (value) => (value ? null : fe11SettingsUsersText.administratorsSettingsPanel_string_ae1e2dac),
      role: (value) => (value ? null : fe11SettingsUsersText.administratorsSettingsPanel_string_e7040772),
      branchId: (value, values) =>
        values.role === 'Administrator' && !value
          ? fe11SettingsUsersText.administratorsSettingsPanel_string_14c70922
          : null,
    },
  })
  const editForm = useForm<EditUserFormValues>({
    initialValues: {
      fullName: '',
      login: '',
      role: 'Administrator',
      branchId: '',
      messengerPlatform: null,
      messengerPlatformUserId: '',
      mustChangePassword: false,
      isActive: true,
    },
    validate: {
      fullName: (value) => (value.trim() ? null : fe11SettingsUsersText.administratorsSettingsPanel_string_9447dd32),
      role: (value) => (value ? null : fe11SettingsUsersText.administratorsSettingsPanel_string_e7040772),
      branchId: (value, values) =>
        values.role === 'Administrator' && !value
          ? fe11SettingsUsersText.administratorsSettingsPanel_string_14c70922
          : null,
    },
  })

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setLoadError(null)

      try {
        const nextAdministrators = await getAdministrators(controller.signal)
        setAdministrators(nextAdministrators.items)
        setCreateRoleOptions(nextAdministrators.createRoleOptions)
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : fe11SettingsUsersText.administratorsSettingsPanel_string_d64134c2,
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

  useEffect(() => {
    const controller = new AbortController()

    async function loadBranches() {
      setBranchesLoading(true)
      setBranchesError(null)

      try {
        setBranches(await getBranches({ includeArchived: true }, controller.signal))
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) {
          return
        }

        setBranches([])
        setBranchesError(
          error instanceof Error
            ? error.message
            : fe11SettingsUsersText.administratorsSettingsPanel_string_eb5b2e75,
        )
      } finally {
        if (!controller.signal.aborted) {
          setBranchesLoading(false)
        }
      }
    }

    void loadBranches()

    return () => controller.abort()
  }, [branchesReloadKey])

  useEffect(() => {
    if (modalState?.mode !== 'create') {
      return
    }

    if (branchesLoading || branchesError) {
      return
    }

    if (createForm.values.role !== 'Administrator' || createForm.values.branchId) {
      return
    }

    if (activeBranches.length === 1) {
      createForm.setFieldValue('branchId', activeBranches[0].id)
    }
  }, [
    activeBranches,
    branchesError,
    branchesLoading,
    createForm,
    createForm.values.branchId,
    createForm.values.role,
    modalState?.mode,
  ])

  function openCreateModal(event: MouseEvent<HTMLButtonElement>) {
    modalOpenerRef.current = event.currentTarget
    const role = resolveInitialCreateRole(createRoleOptions)
    createForm.setValues(buildCreateInitialValues(role, resolveInitialBranchId(role, activeBranches)))
    createForm.clearErrors()
    setFormError(null)
    setFormErrorCode(null)
    setModalState({ mode: 'create' })
  }

  function openEditModal(administrator: UserListItem, opener: HTMLButtonElement) {
    modalOpenerRef.current = opener
    editForm.setValues(toEditUserFormValues(administrator))
    editForm.clearErrors()
    setFormError(null)
    setFormErrorCode(null)
    setModalState({ mode: 'edit', administrator })
  }

  function closeModal() {
    if (submitting) {
      return
    }

    setModalState(null)
    setFormError(null)
    setFormErrorCode(null)
    setSubmitting(false)
    restoreModalOpenerFocus(modalOpenerRef.current)
  }

  function handleCreateRoleChange(role: AdministrativeUserRole | null) {
    createForm.setFieldValue('role', role)
    createForm.setFieldValue('branchId', resolveInitialBranchId(role, activeBranches))
  }

  function handleEditRoleChange(role: AdministrativeUserRole | null) {
    editForm.setFieldValue('role', role)
    if (role === 'SuperAdministrator') {
      editForm.setFieldValue('branchId', '')
      return
    }

    if (role === 'Administrator' && !isSelectableBranch(editForm.values.branchId, activeBranches)) {
      editForm.setFieldValue('branchId', resolveInitialBranchId(role, activeBranches))
    }
  }

  async function submitCreate(values: CreateUserFormValues) {
    if (submittingRef.current) {
      return
    }

    submittingRef.current = true
    setSubmitting(true)
    setFormError(null)
    setFormErrorCode(null)
    createForm.clearErrors()

    try {
      const payload = toCreateUserPayload(values)
      const createdAdministrator = await createAdministrator({
        fullName: payload.fullName,
        login: payload.login,
        password: payload.password,
        role: payload.role as AdministrativeUserRole,
        mustChangePassword: payload.mustChangePassword,
        isActive: payload.isActive,
        messengerPlatform: payload.messengerPlatform,
        messengerPlatformUserId: payload.messengerPlatformUserId,
        branchId: payload.branchId,
      })
      setAdministrators((current) =>
        [...current, createdAdministrator].sort(compareUsers),
      )
      setModalState(null)
      showAppNotification({
        id: `settings-administrator-create-success-${createdAdministrator.id}`,
        title: fe11SettingsUsersText.administratorsSettingsPanel_title_baf4888f(userRoleLabels[createdAdministrator.role]),
        message: fe11SettingsUsersText.administratorsSettingsPanel_message_4fb25546(createdAdministrator.fullName),
        color: 'teal',
      })
    } catch (error) {
      if (error instanceof ApiError) {
        createForm.setErrors(applyFieldErrors(error.fieldErrors))
        setFormError(error.message)
        setFormErrorCode(error.code)
        focusFirstInvalidAdministratorField()
        return
      }

      setFormError(fe11SettingsUsersText.administratorsSettingsPanel_setFormError_7b41d62c)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  async function submitEdit(values: EditUserFormValues) {
    if (!modalState || modalState.mode !== 'edit') {
      return
    }

    if (submittingRef.current) {
      return
    }

    submittingRef.current = true
    setSubmitting(true)
    setFormError(null)
    setFormErrorCode(null)
    editForm.clearErrors()

    try {
      const payload = toUpdateUserPayload(values)
      const updatedAdministrator = await updateAdministrator(
        modalState.administrator.id,
        {
          fullName: payload.fullName,
          login: payload.login,
          role: payload.role as AdministrativeUserRole,
          mustChangePassword: payload.mustChangePassword,
          isActive: payload.isActive,
          messengerPlatform: payload.messengerPlatform,
          messengerPlatformUserId: payload.messengerPlatformUserId,
          branchId: payload.branchId,
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
        id: `settings-administrator-edit-success-${updatedAdministrator.id}`,
        title: fe11SettingsUsersText.administratorsSettingsPanel_title_7ccf0bed(userRoleLabels[updatedAdministrator.role]),
        message: fe11SettingsUsersText.administratorsSettingsPanel_message_00a3576f(updatedAdministrator.fullName),
        color: 'teal',
      })
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === 'staff_not_found') {
          setModalState(null)
          setReloadKey((key) => key + 1)
          showAppNotification({
            id: `settings-administrator-stale-${modalState.administrator.id}`,
            title: fe11SettingsUsersText.administratorsSettingsPanel_title_8bb025fe,
            message: fe11SettingsUsersText.administratorsSettingsPanel_message_435c8ca7,
            color: 'yellow',
          })
          return
        }

        editForm.setErrors(applyFieldErrors(error.fieldErrors))
        setFormError(error.message)
        setFormErrorCode(error.code)
        focusFirstInvalidAdministratorField()
        return
      }

      setFormError(fe11SettingsUsersText.administratorsSettingsPanel_setFormError_1cfc073d)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  return (
    <Stack data-testid="administrators-settings-panel" gap="xl">
      <PageSection>
        <Stack gap="lg">
          <TaskToolbarActions
            frequentActions={(
              <TaskToolbarRefreshAction
                loading={loading}
                onClick={() => setReloadKey((key) => key + 1)}
              />
            )}
            primaryAction={canCreateAdministrator ? (
              <TaskToolbarAction
                icon={<IconUserPlus size={18} />}
                label={fe11SettingsUsersText.administratorsSettingsPanel_label_d8506f3e}
                onClick={openCreateModal}
                priority="primary"
              />
            ) : null}
          />

          {loading ? (
            <LoadingState label={fe11SettingsUsersText.administratorsSettingsPanel_label_6fbc47d4} />
          ) : null}

          {!loading && loadError ? (
            <ErrorState
              message={loadError}
              title={fe11SettingsUsersText.administratorsSettingsPanel_title_9d13455a}
            />
          ) : null}

          {!loading && !loadError && administrators.length === 0 ? (
            <EmptyState
              icon={<IconUserCog size={24} />}
              title={fe11SettingsUsersText.administratorsSettingsPanel_title_f3d522b4}
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
                          {userRoleLabels[administrator.role]}
                        </Badge>
                        <Badge
                          color={administrator.isActive ? 'teal' : 'gray'}
                          radius="xl"
                          variant="light"
                        >
                          {administrator.isActive ? fe11SettingsUsersText.administratorsSettingsPanel_string_a87a4b39 : fe11SettingsUsersText.administratorsSettingsPanel_string_c62edde1}
                        </Badge>
                      </Group>
                      <Text c="dimmed" size="sm">
                        {fe11SettingsUsersText.administratorsSettingsPanel_jsxText_8541e28c}{administrator.login}
                      </Text>
                      {administrator.role === 'Administrator' ? (
                        <>
                          <Text c="dimmed" size="sm">
                            {fe11SettingsUsersText.administratorsSettingsPanel_jsxText_40c98d2e}{administrator.branchName ?? fe11SettingsUsersText.administratorsSettingsPanel_string_b921a80b}
                          </Text>
                          <Text c="dimmed" size="sm">
                            {formatAttendanceScopeSummary(administrator)}
                          </Text>
                        </>
                      ) : (
                        <Text c="dimmed" size="sm">
                          {fe11SettingsUsersText.administratorsSettingsPanel_jsxText_9f488310}</Text>
                      )}
                      {administrator.messengerPlatformUserId ? (
                        <Text c="dimmed" size="sm">
                          {fe11SettingsUsersText.administratorsSettingsPanel_jsxText_a19c2c9d}{administrator.messengerPlatformUserId}
                        </Text>
                      ) : null}
                    </Stack>

                    {canEditStaffTarget(administrator) || canManageAttendanceScope(administrator) ? (
                      <ResponsiveButtonGroup justify="flex-end">
                        {canManageAttendanceScope(administrator) ? (
                          <Button
                            leftSection={<IconUsersGroup size={18} />}
                            onClick={() => setScopeAdministrator(administrator)}
                            variant="pill"
                          >
                            {fe11SettingsUsersText.administratorsSettingsPanel_jsxText_c50470cc}</Button>
                        ) : null}
                        {canEditStaffTarget(administrator) ? (
                          <Button
                            leftSection={<IconEdit size={18} />}
                            onClick={(event) => openEditModal(administrator, event.currentTarget)}
                            variant="pill"
                          >
                            {fe11SettingsUsersText.administratorsSettingsPanel_jsxText_59792556}</Button>
                        ) : null}
                      </ResponsiveButtonGroup>
                    ) : (
                      <Badge color="gray" radius="xl" variant="light">
                        {fe11SettingsUsersText.administratorsSettingsPanel_jsxText_65329f77}</Badge>
                    )}
                  </Group>
                </Paper>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </PageSection>

      <Modal
        centered={!isMobile}
        classNames={{
          body: 'administrator-form-modal__body',
          content: 'administrator-form-modal__content',
        }}
        closeOnClickOutside={!submitting}
        closeOnEscape={!submitting}
        fullScreen={isMobile}
        onClose={closeModal}
        opened={Boolean(modalState)}
        radius={isMobile ? 0 : '16px'}
        size={640}
        title={resolveModalTitle(modalState, editForm.values.role)}
        transitionProps={{ duration: 0 }}
        withCloseButton={!submitting}
      >
        {modalState?.mode === 'create' ? (
          <form onSubmit={createForm.onSubmit((values) => void submitCreate(values))}>
            <Stack className="administrator-form-modal__stack" gap="lg">
              <AdministratorFormError message={formError} />
              <UserFormFields
                credentialsFields={<UserCreateCredentialsFields form={createForm} />}
                form={createForm}
                fullNameInputProps={{ autoFocus: true, 'data-autofocus': true }}
                isActiveLabel={resolveActiveLabel(createForm.values.role)}
                onRoleChange={(value) => handleCreateRoleChange(value as AdministrativeUserRole | null)}
                roleOptions={toUserRoleOptions(createRoleOptions)}
                scopeFields={(
                  <AdministratorBranchField
                    activeBranches={activeBranches}
                    branches={branches}
                    branchesError={branchesError}
                    branchesLoading={branchesLoading}
                    error={createForm.errors.branchId}
                    isBlocked={isAdministratorBranchBlocked(
                      createForm.values.role,
                      activeBranches,
                      branchesError,
                    )}
                    onOpenBranches={onOpenBranches}
                    onRetry={() => setBranchesReloadKey((key) => key + 1)}
                    onChange={(value) => createForm.setFieldValue('branchId', value)}
                    role={createForm.values.role}
                    value={createForm.values.branchId}
                  />
                )}
                showRoleField={createRoleOptions.length > 1}
              />
              <SettingsFormActions
                onCancel={closeModal}
                submitting={submitting}
                submitDisabled={isAdministratorBranchBlocked(
                  createForm.values.role,
                  activeBranches,
                  branchesError,
                )}
              />
            </Stack>
          </form>
        ) : null}

        {modalState?.mode === 'edit' ? (
          <form onSubmit={editForm.onSubmit((values) => void submitEdit(values))}>
            <Stack className="administrator-form-modal__stack" gap="lg">
              <AdministratorFormError
                message={formError}
                onOpenAttendanceScope={
                  formErrorCode === 'attendance_grants_must_be_revoked' &&
                  modalState.administrator.role === 'Administrator'
                    ? () => setScopeAdministrator(modalState.administrator)
                    : undefined
                }
              />
              <UserFormFields
                credentialsFields={<UserEditCredentialsFields form={editForm} />}
                form={editForm}
                fullNameInputProps={{ autoFocus: true, 'data-autofocus': true }}
                isActiveLabel={resolveActiveLabel(editForm.values.role)}
                onRoleChange={(value) => handleEditRoleChange(value as AdministrativeUserRole | null)}
                roleOptions={toUserRoleOptions(resolveEditRoleOptions(modalState.administrator))}
                scopeFields={(
                  <AdministratorBranchField
                    activeBranches={activeBranches}
                    administrator={modalState.administrator}
                    branches={branches}
                    branchesError={branchesError}
                    branchesLoading={branchesLoading}
                    error={editForm.errors.branchId}
                    isBlocked={isAdministratorBranchBlocked(
                      editForm.values.role,
                      activeBranches,
                      branchesError,
                      editForm.values.branchId,
                      modalState.administrator,
                    )}
                    onOpenBranches={onOpenBranches}
                    onRetry={() => setBranchesReloadKey((key) => key + 1)}
                    onChange={(value) => editForm.setFieldValue('branchId', value)}
                    role={editForm.values.role}
                    value={editForm.values.branchId}
                  />
                )}
                showRoleField={resolveEditRoleOptions(modalState.administrator).length > 1}
              />
              <SettingsFormActions
                onCancel={closeModal}
                submitting={submitting}
                submitDisabled={isAdministratorBranchBlocked(
                  editForm.values.role,
                  activeBranches,
                  branchesError,
                  editForm.values.branchId,
                  modalState.administrator,
                )}
              />
            </Stack>
          </form>
        ) : null}
      </Modal>

      <AdministratorAttendanceScopeModal
        administrator={scopeAdministrator}
        onClose={() => setScopeAdministrator(null)}
        onSaved={(administratorId, grantedGroupCount) =>
          setAdministrators((current) =>
            current.map((administrator) =>
              administrator.id === administratorId
                ? { ...administrator, attendanceGroupGrantCount: grantedGroupCount }
                : administrator,
            ),
          )
        }
      />
    </Stack>
  )
}

function AdministratorFormError({
  message,
  onOpenAttendanceScope,
}: {
  message: string | null
  onOpenAttendanceScope?: () => void
}) {
  if (!message) {
    return null
  }

  return (
    <Alert
      color="red"
      icon={<IconAlertCircle size={18} />}
      title={fe11SettingsUsersText.administratorsSettingsPanel_title_09e1875e}
      variant="light"
    >
      <Stack gap="sm">
        <Text size="sm">{message}</Text>
        {onOpenAttendanceScope ? (
          <div>
            <Button
              leftSection={<IconUsersGroup size={18} />}
              onClick={onOpenAttendanceScope}
              variant="secondary"
            >
              {fe11SettingsUsersText.administratorsSettingsPanel_jsxText_5336bb8f}</Button>
          </div>
        ) : null}
      </Stack>
    </Alert>
  )
}

function AdministratorBranchField({
  activeBranches,
  administrator,
  branches,
  branchesError,
  branchesLoading,
  error,
  isBlocked,
  onChange,
  onOpenBranches,
  onRetry,
  role,
  value,
}: {
  activeBranches: Branch[]
  administrator?: UserListItem
  branches: Branch[]
  branchesError: string | null
  branchesLoading: boolean
  error?: ReactNode
  isBlocked: boolean
  onChange: (value: string) => void
  onOpenBranches?: () => void
  onRetry: () => void
  role: UserRole | null
  value: string
}) {
  if (role !== 'Administrator') {
    return null
  }

  if (branchesError) {
    return (
      <Alert
        color="red"
        icon={<IconAlertCircle size={18} />}
        title={fe11SettingsUsersText.administratorsSettingsPanel_title_9d518c0f}
        variant="light"
      >
        <Stack gap="sm">
          <Text size="sm">{branchesError}</Text>
          <div>
            <Button leftSection={<IconRefresh size={18} />} onClick={onRetry} variant="secondary">
              {fe11SettingsUsersText.administratorsSettingsPanel_jsxText_5189135a}</Button>
          </div>
        </Stack>
      </Alert>
    )
  }

  if (!branchesLoading && isBlocked && activeBranches.length === 0) {
    return (
      <Alert
        color="yellow"
        icon={<IconAlertCircle size={18} />}
        title={fe11SettingsUsersText.administratorsSettingsPanel_title_1f20f670}
        variant="light"
      >
        <Stack gap="sm">
          <Text fw={700} size="sm">
            {fe11SettingsUsersText.administratorsSettingsPanel_jsxText_b934965b}</Text>
          <Text size="sm">
            {fe11SettingsUsersText.administratorsSettingsPanel_jsxText_af8fd683}</Text>
          {onOpenBranches ? (
            <div>
              <Button onClick={onOpenBranches} variant="secondary">
                {fe11SettingsUsersText.administratorsSettingsPanel_jsxText_1ec6f510}</Button>
            </div>
          ) : (
            <Text c="dimmed" size="sm">
              {fe11SettingsUsersText.administratorsSettingsPanel_jsxText_c1f3ef35}</Text>
          )}
        </Stack>
      </Alert>
    )
  }

  return (
    <Select
      allowDeselect={false}
      data={buildAdministratorBranchOptions(branches, administrator)}
      disabled={branchesLoading}
      error={error}
      label={fe11SettingsUsersText.administratorsSettingsPanel_label_3301ad7a}
      onChange={(nextValue) => onChange(nextValue ?? '')}
      placeholder={branchesLoading ? fe11SettingsUsersText.administratorsSettingsPanel_string_13116bcf : fe11SettingsUsersText.administratorsSettingsPanel_string_4c5ee5d8}
      value={value || null}
    />
  )
}

function SettingsFormActions({
  onCancel,
  submitDisabled,
  submitting,
}: {
  onCancel: () => void
  submitDisabled?: boolean
  submitting: boolean
}) {
  return (
    <TemporarySurfaceFooter
      primaryAction={(
        <Button
          disabled={submitDisabled}
          leftSection={<IconDeviceFloppy size={18} />}
          loading={submitting}
          type="submit"
        >
          {fe11SettingsUsersText.administratorsSettingsPanel_jsxText_b4d30cae}</Button>
      )}
      secondaryAction={(
        <Button disabled={submitting} onClick={onCancel} variant="secondary">
          {fe11SettingsUsersText.administratorsSettingsPanel_jsxText_7c47f729}</Button>
      )}
    />
  )
}

function buildCreateInitialValues(
  role: AdministrativeUserRole | null,
  branchId: string,
): CreateUserFormValues {
  return {
    fullName: '',
    login: '',
    password: '',
    role,
    branchId,
    messengerPlatform: null,
    messengerPlatformUserId: '',
    mustChangePassword: true,
    isActive: true,
  }
}

function resolveInitialCreateRole(roles: readonly UserRole[]): AdministrativeUserRole {
  if (roles.includes('Administrator')) {
    return 'Administrator'
  }

  return (roles[0] as AdministrativeUserRole | undefined) ?? 'Administrator'
}

function resolveInitialBranchId(
  role: UserRole | null,
  activeBranches: readonly Branch[],
) {
  if (role !== 'Administrator') {
    return ''
  }

  return activeBranches.length === 1 ? activeBranches[0].id : ''
}

function resolveEditRoleOptions(administrator: UserListItem) {
  return administrator.roleOptions?.length ? administrator.roleOptions : [administrator.role]
}

function resolveModalTitle(
  modalState: AdministratorModalState,
  role: UserRole | null,
) {
  if (modalState?.mode === 'create') {
    return fe11SettingsUsersText.administratorsSettingsPanel_string_c1351bd6
  }

  if (modalState?.mode === 'edit') {
    return role === 'SuperAdministrator'
      ? fe11SettingsUsersText.administratorsSettingsPanel_string_7ff6dab6
      : fe11SettingsUsersText.administratorsSettingsPanel_string_22f2b253
  }

  return undefined
}

function resolveActiveLabel(role: UserRole | null) {
  return role === 'SuperAdministrator'
    ? fe11SettingsUsersText.administratorsSettingsPanel_string_d9ac9f77
    : fe11SettingsUsersText.administratorsSettingsPanel_string_b7e3374d
}

function isAdministratorBranchBlocked(
  role: UserRole | null,
  activeBranches: readonly Branch[],
  branchesError: string | null,
  branchId = '',
  administrator?: UserListItem,
) {
  if (role !== 'Administrator') {
    return false
  }

  if (branchesError) {
    return true
  }

  if (activeBranches.length === 0) {
    return !isExistingAdministratorBranch(branchId, administrator)
  }

  return false
}

function isSelectableBranch(branchId: string, activeBranches: readonly Branch[]) {
  return Boolean(branchId) && activeBranches.some((branch) => branch.id === branchId)
}

function isExistingAdministratorBranch(branchId: string, administrator?: UserListItem) {
  return (
    Boolean(branchId) &&
    administrator?.role === 'Administrator' &&
    administrator.branchId === branchId
  )
}

function compareUsers(left: UserListItem, right: UserListItem) {
  return left.fullName.localeCompare(right.fullName, 'ru')
}

function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.message.toLowerCase().includes('signal is aborted'))
  )
}

function focusFirstInvalidAdministratorField() {
  window.setTimeout(() => {
    const field = document.querySelector<HTMLElement>(
      '.administrator-form-modal__body [aria-invalid="true"]',
    )

    field?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    field?.focus({ preventScroll: true })
  }, 0)
}

function restoreModalOpenerFocus(opener: HTMLElement | null) {
  window.setTimeout(() => {
    if (opener?.isConnected) {
      opener.focus()
    }
  }, 0)
}

function canEditStaffTarget(user: UserListItem) {
  return user.allowedActions?.some((action) => action === 'Edit' || action === 'Update') === true
}

function canManageAttendanceScope(user: UserListItem) {
  return user.allowedActions?.includes('ManageAttendanceScope') === true
}

function formatAttendanceScopeSummary(user: UserListItem) {
  const count = user.attendanceGroupGrantCount ?? 0

  return count > 0
    ? fe11SettingsUsersText.administratorsSettingsPanel_template_8a059471(formatGroupWord(count))
    : fe11SettingsUsersText.administratorsSettingsPanel_string_9a4fb41a
}

function formatGroupWord(count: number) {
  const mod10 = count % 10
  const mod100 = count % 100

  if (mod10 === 1 && mod100 !== 11) {
    return fe11SettingsUsersText.administratorsSettingsPanel_template_67192921(count)
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return fe11SettingsUsersText.administratorsSettingsPanel_template_2c46082c(count)
  }

  return fe11SettingsUsersText.administratorsSettingsPanel_template_8b720813(count)
}

function buildAdministratorBranchOptions(
  branches: Branch[],
  administrator?: UserListItem,
) {
  const options = branches
    .filter((branch) => !branch.isArchived)
    .map((branch) => ({ value: branch.id, label: branch.name }))

  if (
    administrator?.role === 'Administrator' &&
    administrator.branchId &&
    !options.some((option) => option.value === administrator.branchId)
  ) {
    options.push({
      value: administrator.branchId,
      label: administrator.branchName
        ? fe11SettingsUsersText.administratorsSettingsPanel_template_cc8da12a(administrator.branchName)
        : fe11SettingsUsersText.administratorsSettingsPanel_string_0a14a43a,
    })
  }

  return options
}
