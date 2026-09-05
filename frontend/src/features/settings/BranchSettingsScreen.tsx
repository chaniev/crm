import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import {
  IconAlertCircle,
  IconArchive,
  IconBuildingStore,
  IconDeviceFloppy,
  IconEdit,
  IconMapPin,
  IconPlus,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  archiveBranch,
  archiveHall,
  createBranch,
  createHall,
  deleteHall,
  getBranches,
  getHalls,
  restoreBranch,
  restoreHall,
  updateBranch,
  updateHall,
  type Branch,
  type Hall,
} from '../../lib/api'
import {
  Button,
  ConfirmActionModal,
  EmptyState,
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
  ResponsiveButtonGroup,
  TaskToolbarAction,
  TaskToolbarActions,
  TaskToolbarRefreshAction,
} from '../shared/ux'
import { showAppNotification } from '../shared/notifications'
import { fe10SettingsBranchesShellText } from '../../resources/fe-10-settings-branches-shell'


type BranchFormValues = {
  name: string
  address: string
  description: string
}

type HallFormValues = {
  name: string
  description: string
}

type BranchModalState =
  | { mode: 'create' }
  | { mode: 'edit'; branch: Branch }
  | null

type HallModalState =
  | { mode: 'create'; branchId: string }
  | { mode: 'edit'; hall: Hall }
  | null

type BranchSettingsScreenProps = {
  embedded?: boolean
}

export function BranchSettingsScreen({
  embedded = false,
}: BranchSettingsScreenProps) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [halls, setHalls] = useState<Hall[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [branchModal, setBranchModal] = useState<BranchModalState>(null)
  const [hallModal, setHallModal] = useState<HallModalState>(null)
  const [hallToDelete, setHallToDelete] = useState<Hall | null>(null)
  const [branchPendingId, setBranchPendingId] = useState<string | null>(null)
  const [hallPendingId, setHallPendingId] = useState<string | null>(null)
  const [branchSubmitting, setBranchSubmitting] = useState(false)
  const [hallSubmitting, setHallSubmitting] = useState(false)
  const branchForm = useForm<BranchFormValues>({
    initialValues: {
      name: '',
      address: '',
      description: '',
    },
  })
  const hallForm = useForm<HallFormValues>({
    initialValues: {
      name: '',
      description: '',
    },
  })

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setLoadError(null)
      setActionError(null)

      try {
        const [nextBranches, nextHalls] = await Promise.all([
          getBranches({ includeArchived: true }, controller.signal),
          getHalls({ includeArchived: true }, controller.signal),
        ])

        setBranches(nextBranches)
        setHalls(nextHalls)
        setSelectedBranchId((currentBranchId) => {
          if (
            currentBranchId &&
            nextBranches.some((branch) => branch.id === currentBranchId)
          ) {
            return currentBranchId
          }

          return (
            nextBranches.find((branch) => !branch.isArchived)?.id ??
            nextBranches[0]?.id ??
            null
          )
        })
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : fe10SettingsBranchesShellText.branchSettingsScreen_string_bcb7882e,
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

  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId) ?? null
  const selectedBranchHalls = useMemo(
    () =>
      selectedBranch
        ? halls.filter((hall) => hall.branchId === selectedBranch.id)
        : [],
    [halls, selectedBranch],
  )
  function openCreateBranch() {
    branchForm.setValues({
      name: '',
      address: '',
      description: '',
    })
    branchForm.clearErrors()
    setActionError(null)
    setBranchModal({ mode: 'create' })
  }

  function openEditBranch(branch: Branch) {
    branchForm.setValues(toBranchFormValues(branch))
    branchForm.clearErrors()
    setActionError(null)
    setBranchModal({ mode: 'edit', branch })
  }

  function openCreateHall(branchId: string) {
    hallForm.setValues({
      name: '',
      description: '',
    })
    hallForm.clearErrors()
    setActionError(null)
    setHallModal({ mode: 'create', branchId })
  }

  function openEditHall(hall: Hall) {
    hallForm.setValues(toHallFormValues(hall))
    hallForm.clearErrors()
    setActionError(null)
    setHallModal({ mode: 'edit', hall })
  }

  async function submitBranch(values: BranchFormValues) {
    if (!branchModal) {
      return
    }

    setBranchSubmitting(true)
    setActionError(null)
    branchForm.clearErrors()

    try {
      const payload = toBranchPayload(values)
      const savedBranch =
        branchModal.mode === 'create'
          ? await createBranch(payload)
          : await updateBranch(branchModal.branch.id, payload)

      setBranches((currentBranches) =>
        upsertById(currentBranches, savedBranch),
      )
      setSelectedBranchId(savedBranch.id)
      setBranchModal(null)

      showAppNotification({
        id: `settings-branch-${branchModal.mode}`,
        title:
          branchModal.mode === 'create'
            ? fe10SettingsBranchesShellText.branchSettingsScreen_string_e5873c80
            : fe10SettingsBranchesShellText.branchSettingsScreen_string_a3a972ea,
        message: fe10SettingsBranchesShellText.branchSettingsScreen_message_6443763c(savedBranch.name),
        color: 'teal',
      })
    } catch (error) {
      if (error instanceof ApiError) {
        branchForm.setErrors(applyFieldErrors(error.fieldErrors))
        setActionError(error.message)
        return
      }

      setActionError(fe10SettingsBranchesShellText.branchSettingsScreen_setActionError_edc2801e)
    } finally {
      setBranchSubmitting(false)
    }
  }

  async function submitHall(values: HallFormValues) {
    if (!hallModal) {
      return
    }

    setHallSubmitting(true)
    setActionError(null)
    hallForm.clearErrors()

    try {
      const branchId =
        hallModal.mode === 'create'
          ? hallModal.branchId
          : hallModal.hall.branchId
      const payload = {
        ...toHallPayload(values),
        branchId,
      }
      const savedHall =
        hallModal.mode === 'create'
          ? await createHall(payload)
          : await updateHall(hallModal.hall.id, payload)

      setHalls((currentHalls) => upsertById(currentHalls, savedHall))
      setSelectedBranchId(savedHall.branchId)
      setHallModal(null)

      showAppNotification({
        id: `settings-hall-${hallModal.mode}`,
        title: hallModal.mode === 'create' ? fe10SettingsBranchesShellText.branchSettingsScreen_string_b6a816b2 : fe10SettingsBranchesShellText.branchSettingsScreen_string_0143b43b,
        message: fe10SettingsBranchesShellText.branchSettingsScreen_message_9055dca1(savedHall.name),
        color: 'teal',
      })
      setReloadKey((currentKey) => currentKey + 1)
    } catch (error) {
      if (error instanceof ApiError) {
        hallForm.setErrors(applyFieldErrors(error.fieldErrors))
        setActionError(error.message)
        return
      }

      setActionError(fe10SettingsBranchesShellText.branchSettingsScreen_setActionError_860660d3)
    } finally {
      setHallSubmitting(false)
    }
  }

  async function toggleBranchArchive(branch: Branch) {
    setBranchPendingId(branch.id)
    setActionError(null)

    try {
      const updatedBranch = branch.isArchived
        ? await restoreBranch(branch.id)
        : await archiveBranch(branch.id)

      setBranches((currentBranches) => upsertById(currentBranches, updatedBranch))
      showAppNotification({
        id: `settings-branch-archive-${branch.id}`,
        title: updatedBranch.isArchived
          ? fe10SettingsBranchesShellText.branchSettingsScreen_string_47862d95
          : fe10SettingsBranchesShellText.branchSettingsScreen_string_fdb40bc2,
        message: fe10SettingsBranchesShellText.branchSettingsScreen_message_f9bc60e6(updatedBranch.name),
        color: 'teal',
      })
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : fe10SettingsBranchesShellText.branchSettingsScreen_string_866cb8e4,
      )
    } finally {
      setBranchPendingId(null)
    }
  }

  async function toggleHallArchive(hall: Hall) {
    setHallPendingId(hall.id)
    setActionError(null)

    try {
      const updatedHall = hall.isArchived
        ? await restoreHall(hall.id)
        : await archiveHall(hall.id)

      setHalls((currentHalls) => upsertById(currentHalls, updatedHall))
      showAppNotification({
        id: `settings-hall-archive-${hall.id}`,
        title: updatedHall.isArchived ? fe10SettingsBranchesShellText.branchSettingsScreen_string_4824b8e0 : fe10SettingsBranchesShellText.branchSettingsScreen_string_da34740b,
        message: fe10SettingsBranchesShellText.branchSettingsScreen_message_cf9f9867(updatedHall.name),
        color: 'teal',
      })
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : fe10SettingsBranchesShellText.branchSettingsScreen_string_b1511003,
      )
    } finally {
      setHallPendingId(null)
    }
  }

  async function confirmDeleteHall() {
    if (!hallToDelete) {
      return
    }

    setHallPendingId(hallToDelete.id)
    setActionError(null)

    try {
      await deleteHall(hallToDelete.id)
      setHalls((currentHalls) =>
        currentHalls.filter((hall) => hall.id !== hallToDelete.id),
      )
      showAppNotification({
        id: `settings-hall-delete-${hallToDelete.id}`,
        title: fe10SettingsBranchesShellText.branchSettingsScreen_title_4229f026,
        message: fe10SettingsBranchesShellText.branchSettingsScreen_message_204edcc3(hallToDelete.name),
        color: 'teal',
      })
      setHallToDelete(null)
      setReloadKey((currentKey) => currentKey + 1)
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : fe10SettingsBranchesShellText.branchSettingsScreen_string_a2ba13b7,
      )
      setHallToDelete(null)
    } finally {
      setHallPendingId(null)
    }
  }

  const headerActions = (
    <TaskToolbarActions
      frequentActions={(
        <TaskToolbarRefreshAction
          label={fe10SettingsBranchesShellText.branchSettingsScreen_label_603e460b}
          loading={loading}
          onClick={() => setReloadKey((currentKey) => currentKey + 1)}
        />
      )}
      primaryAction={(
        <TaskToolbarAction
          icon={<IconPlus size={18} />}
          label={fe10SettingsBranchesShellText.branchSettingsScreen_label_4a7c4927}
          onClick={openCreateBranch}
          priority="primary"
        />
      )}
    />
  )

  const content = (
    <>
      <PageSection>
        <Stack gap="lg">
          {embedded ? headerActions : null}

          {actionError ? (
            <Alert
              color="red"
              icon={<IconAlertCircle size={18} />}
              title={fe10SettingsBranchesShellText.branchSettingsScreen_title_7530f803}
              variant="light"
            >
              {actionError}
            </Alert>
          ) : null}

          {loading ? <LoadingState label={fe10SettingsBranchesShellText.branchSettingsScreen_label_9b4fd5a5} /> : null}

          {!loading && loadError ? (
            <ErrorState
              action={(
                <Button
                  leftSection={<IconRefresh size={18} />}
                  onClick={() => setReloadKey((currentKey) => currentKey + 1)}
                  variant="pill"
                >
                  {fe10SettingsBranchesShellText.branchSettingsScreen_jsxText_5189135a}</Button>
              )}
              message={loadError}
              title={fe10SettingsBranchesShellText.branchSettingsScreen_title_b1c39526}
            />
          ) : null}

          {!loading && !loadError && branches.length === 0 ? (
            <EmptyState
              description={fe10SettingsBranchesShellText.branchSettingsScreen_description_c4393b12}
              icon={<IconBuildingStore size={24} />}
              title={fe10SettingsBranchesShellText.branchSettingsScreen_title_82d9adbb}
            />
          ) : null}

          {!loading && !loadError && branches.length > 0 ? (
            <div className="settings-branches-layout">
              <Stack gap="sm">
                {branches.map((branch) => {
                  const selected = branch.id === selectedBranchId

                  return (
                    <Paper
                      aria-label={fe10SettingsBranchesShellText.branchSettingsScreen_template_47c56444(branch.name)}
                      aria-selected={selected}
                      className="settings-branch-row"
                      data-selected={selected || undefined}
                      key={branch.id}
                      onClick={() => setSelectedBranchId(branch.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedBranchId(branch.id)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      withBorder
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Stack gap={4}>
                          <Group gap="xs" wrap="wrap">
                            <Text fw={800}>{branch.name}</Text>
                            <Badge
                              color={branch.isArchived ? 'gray' : 'teal'}
                              radius="sm"
                              variant="light"
                            >
                              {branch.isArchived ? fe10SettingsBranchesShellText.branchSettingsScreen_string_0909dfc7 : fe10SettingsBranchesShellText.branchSettingsScreen_string_be6881d5}
                            </Badge>
                          </Group>
                          <Text c="dimmed" size="sm">
                            {branch.address || fe10SettingsBranchesShellText.branchSettingsScreen_string_51f4db1b}
                          </Text>
                          <Text c="dimmed" size="sm">
                            {fe10SettingsBranchesShellText.branchSettingsScreen_jsxText_f8d072c0}{branch.hallCount} {fe10SettingsBranchesShellText.branchSettingsScreen_jsxText_0d7606f3}{branch.groupCount} {fe10SettingsBranchesShellText.branchSettingsScreen_jsxText_6ea69b07}{branch.clientCount}
                          </Text>
                        </Stack>
                      </Group>
                    </Paper>
                  )
                })}
              </Stack>

              <BranchDetailsPanel
                branch={selectedBranch}
                branchPending={branchPendingId}
                hallPending={hallPendingId}
                halls={selectedBranchHalls}
                onArchiveBranch={(branch) => void toggleBranchArchive(branch)}
                onArchiveHall={(hall) => void toggleHallArchive(hall)}
                onCreateHall={openCreateHall}
                onDeleteHall={setHallToDelete}
                onEditBranch={openEditBranch}
                onEditHall={openEditHall}
              />
            </div>
          ) : null}
        </Stack>
      </PageSection>

      <BranchFormModal
        form={branchForm}
        modal={branchModal}
        pending={branchSubmitting}
        onClose={() => setBranchModal(null)}
        onSubmit={submitBranch}
      />

      <HallFormModal
        form={hallForm}
        modal={hallModal}
        pending={hallSubmitting}
        selectedBranch={branches.find((branch) =>
          hallModal?.mode === 'create'
            ? branch.id === hallModal.branchId
            : branch.id === hallModal?.hall.branchId,
        ) ?? null}
        onClose={() => setHallModal(null)}
        onSubmit={submitHall}
      />

      <ConfirmActionModal
        confirmColor="red"
        confirmLabel={fe10SettingsBranchesShellText.branchSettingsScreen_confirmLabel_d15a5f04}
        description={
          hallToDelete
            ? fe10SettingsBranchesShellText.branchSettingsScreen_template_978bfaa1(hallToDelete.name)
            : fe10SettingsBranchesShellText.branchSettingsScreen_string_4e52991b
        }
        onClose={() => setHallToDelete(null)}
        onConfirm={() => void confirmDeleteHall()}
        opened={Boolean(hallToDelete)}
        pending={hallPendingId === hallToDelete?.id}
        title={fe10SettingsBranchesShellText.branchSettingsScreen_title_137fecae}
      />
    </>
  )

  if (!embedded) {
    return (
      <PageLayout
        actions={headerActions}
        data-testid="settings-screen"
        title={fe10SettingsBranchesShellText.branchSettingsScreen_title_3e453a66}
      >
        {content}
      </PageLayout>
    )
  }

  return <Stack gap="xl">{content}</Stack>
}

type BranchDetailsPanelProps = {
  branch: Branch | null
  branchPending: string | null
  hallPending: string | null
  halls: Hall[]
  onArchiveBranch: (branch: Branch) => void
  onArchiveHall: (hall: Hall) => void
  onCreateHall: (branchId: string) => void
  onDeleteHall: (hall: Hall) => void
  onEditBranch: (branch: Branch) => void
  onEditHall: (hall: Hall) => void
}

function BranchDetailsPanel({
  branch,
  branchPending,
  hallPending,
  halls,
  onArchiveBranch,
  onArchiveHall,
  onCreateHall,
  onDeleteHall,
  onEditBranch,
  onEditHall,
}: BranchDetailsPanelProps) {
  if (!branch) {
    return (
      <Paper className="settings-branch-details" withBorder>
        <Text c="dimmed" size="sm">
          {fe10SettingsBranchesShellText.branchSettingsScreen_jsxText_5ef59352}</Text>
      </Paper>
    )
  }

  return (
    <Paper className="settings-branch-details" withBorder>
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon color="var(--crm-action-primary)" radius="xl" size={40} variant="light">
              <IconBuildingStore size={20} />
            </ThemeIcon>
            <div>
              <Text fw={800}>{branch.name}</Text>
              <Text c="dimmed" size="sm">
                {branch.address || fe10SettingsBranchesShellText.branchSettingsScreen_string_51f4db1b}
              </Text>
            </div>
          </Group>

          <ResponsiveButtonGroup justify="flex-end">
            <Button
              leftSection={<IconEdit size={18} />}
              onClick={() => onEditBranch(branch)}
              variant="pill"
            >
              {fe10SettingsBranchesShellText.branchSettingsScreen_jsxText_59792556}</Button>
            <Button
              color={branch.isArchived ? 'teal' : 'gray'}
              leftSection={
                branch.isArchived ? <IconRefresh size={18} /> : <IconArchive size={18} />
              }
              loading={branchPending === branch.id}
              onClick={() => onArchiveBranch(branch)}
              variant="pill"
            >
              {branch.isArchived ? fe10SettingsBranchesShellText.branchSettingsScreen_string_5ae0e885 : fe10SettingsBranchesShellText.branchSettingsScreen_string_1ca66519}
            </Button>
          </ResponsiveButtonGroup>
        </Group>

        {branch.description ? (
          <Text size="sm">{branch.description}</Text>
        ) : (
          <Text c="dimmed" size="sm">
            {fe10SettingsBranchesShellText.branchSettingsScreen_jsxText_5ae41424}</Text>
        )}

        <Group justify="space-between" wrap="wrap">
          <div>
            <Text fw={800}>{fe10SettingsBranchesShellText.branchSettingsScreen_jsxText_a7076496}</Text>
            <Text c="dimmed" size="sm">
              {fe10SettingsBranchesShellText.branchSettingsScreen_jsxText_a47c0b9b}</Text>
          </div>
          <Button
            disabled={branch.isArchived}
            leftSection={<IconPlus size={18} />}
            onClick={() => onCreateHall(branch.id)}
            variant="pill"
          >
            {fe10SettingsBranchesShellText.branchSettingsScreen_jsxText_fd79d4d5}</Button>
        </Group>

        {halls.length === 0 ? (
          <EmptyState
            description={fe10SettingsBranchesShellText.branchSettingsScreen_description_29f03982}
            icon={<IconMapPin size={24} />}
            title={fe10SettingsBranchesShellText.branchSettingsScreen_title_387e19a9}
          />
        ) : (
          <Stack gap="sm">
            {halls.map((hall) => (
              <Paper className="list-row-card settings-hall-row" key={hall.id} withBorder>
                <Group justify="space-between" wrap="wrap">
                  <Stack gap={5}>
                    <Group gap="xs" wrap="wrap">
                      <Text fw={700}>{hall.name}</Text>
                      <Badge
                        color={hall.isArchived ? 'gray' : 'teal'}
                        radius="sm"
                        variant="light"
                      >
                        {hall.isArchived ? fe10SettingsBranchesShellText.branchSettingsScreen_string_0909dfc7 : fe10SettingsBranchesShellText.branchSettingsScreen_string_be6881d5}
                      </Badge>
                      <Badge color="var(--crm-brand-primary-soft)" radius="sm" variant="light">
                        {fe10SettingsBranchesShellText.branchSettingsScreen_jsxText_c72164c0}{hall.groupCount}
                      </Badge>
                    </Group>
                    <Text c="dimmed" size="sm">
                      {hall.description || fe10SettingsBranchesShellText.branchSettingsScreen_string_15106c19}
                    </Text>
                  </Stack>

                  <Group gap={8} wrap="nowrap">
                    <ActionIcon
                      aria-label={fe10SettingsBranchesShellText.branchSettingsScreen_template_1b633f97(hall.name)}
                      onClick={() => onEditHall(hall)}
                      size={44}
                      variant="light"
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      aria-label={
                        hall.isArchived
                          ? fe10SettingsBranchesShellText.branchSettingsScreen_template_c34fa15a(hall.name)
                          : fe10SettingsBranchesShellText.branchSettingsScreen_template_1cc27ebf(hall.name)
                      }
                      color={hall.isArchived ? 'teal' : 'gray'}
                      loading={hallPending === hall.id}
                      onClick={() => onArchiveHall(hall)}
                      size={44}
                      variant="light"
                    >
                      {hall.isArchived ? (
                        <IconRefresh size={16} />
                      ) : (
                        <IconArchive size={16} />
                      )}
                    </ActionIcon>
                    <ActionIcon
                      aria-label={fe10SettingsBranchesShellText.branchSettingsScreen_template_723fe81a(hall.name)}
                      color="red"
                      disabled={hallPending === hall.id}
                      onClick={() => onDeleteHall(hall)}
                      size={44}
                      variant="light"
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  )
}

type BranchFormModalProps = {
  form: ReturnType<typeof useForm<BranchFormValues>>
  modal: BranchModalState
  pending: boolean
  onClose: () => void
  onSubmit: (values: BranchFormValues) => Promise<void>
}

function BranchFormModal({
  form,
  modal,
  pending,
  onClose,
  onSubmit,
}: BranchFormModalProps) {
  return (
    <Modal
      centered
      onClose={onClose}
      opened={Boolean(modal)}
      radius="8px"
      title={modal?.mode === 'edit' ? fe10SettingsBranchesShellText.branchSettingsScreen_string_0cafa321 : fe10SettingsBranchesShellText.branchSettingsScreen_string_53340e79}
      withCloseButton={!pending}
    >
      <form onSubmit={form.onSubmit((values) => void onSubmit(values))}>
        <Stack gap="md">
          <TextInput
            label={fe10SettingsBranchesShellText.branchSettingsScreen_label_13653782}
            placeholder={fe10SettingsBranchesShellText.branchSettingsScreen_placeholder_e61a6c67}
            {...form.getInputProps('name')}
          />
          <TextInput
            label={fe10SettingsBranchesShellText.branchSettingsScreen_label_da82e805}
            placeholder={fe10SettingsBranchesShellText.branchSettingsScreen_placeholder_00fbfc3f}
            {...form.getInputProps('address')}
          />
          <Textarea
            autosize
            label={fe10SettingsBranchesShellText.branchSettingsScreen_label_b3680f2c}
            minRows={3}
            placeholder={fe10SettingsBranchesShellText.branchSettingsScreen_placeholder_fcff79af}
            {...form.getInputProps('description')}
          />

          <ResponsiveButtonGroup justify="space-between">
            <Button disabled={pending} onClick={onClose} type="button" variant="ghost">
              {fe10SettingsBranchesShellText.branchSettingsScreen_jsxText_7c47f729}</Button>
            <Button
              leftSection={<IconDeviceFloppy size={18} />}
              loading={pending}
              type="submit"
            >
              {fe10SettingsBranchesShellText.branchSettingsScreen_jsxText_b4d30cae}</Button>
          </ResponsiveButtonGroup>
        </Stack>
      </form>
    </Modal>
  )
}

type HallFormModalProps = {
  form: ReturnType<typeof useForm<HallFormValues>>
  modal: HallModalState
  pending: boolean
  selectedBranch: Branch | null
  onClose: () => void
  onSubmit: (values: HallFormValues) => Promise<void>
}

function HallFormModal({
  form,
  modal,
  pending,
  selectedBranch,
  onClose,
  onSubmit,
}: HallFormModalProps) {
  return (
    <Modal
      centered
      onClose={onClose}
      opened={Boolean(modal)}
      radius="8px"
      title={modal?.mode === 'edit' ? fe10SettingsBranchesShellText.branchSettingsScreen_string_b199b4ab : fe10SettingsBranchesShellText.branchSettingsScreen_string_58270ae4}
      withCloseButton={!pending}
    >
      <form onSubmit={form.onSubmit((values) => void onSubmit(values))}>
        <Stack gap="md">
          <Paper className="hint-card" radius="8px" withBorder>
            <Text c="dimmed" size="sm">
              {fe10SettingsBranchesShellText.branchSettingsScreen_jsxText_40c98d2e}{selectedBranch?.name ?? fe10SettingsBranchesShellText.branchSettingsScreen_string_d77dfdcd}
            </Text>
          </Paper>
          <TextInput
            label={fe10SettingsBranchesShellText.branchSettingsScreen_label_7f077277}
            placeholder={fe10SettingsBranchesShellText.branchSettingsScreen_placeholder_4b0e7dac}
            {...form.getInputProps('name')}
          />
          <Textarea
            autosize
            label={fe10SettingsBranchesShellText.branchSettingsScreen_label_b3680f2c}
            minRows={3}
            placeholder={fe10SettingsBranchesShellText.branchSettingsScreen_placeholder_caae3b66}
            {...form.getInputProps('description')}
          />

          <ResponsiveButtonGroup justify="space-between">
            <Button disabled={pending} onClick={onClose} type="button" variant="ghost">
              {fe10SettingsBranchesShellText.branchSettingsScreen_jsxText_7c47f729}</Button>
            <Button
              leftSection={<IconDeviceFloppy size={18} />}
              loading={pending}
              type="submit"
            >
              {fe10SettingsBranchesShellText.branchSettingsScreen_jsxText_b4d30cae}</Button>
          </ResponsiveButtonGroup>
        </Stack>
      </form>
    </Modal>
  )
}

function toBranchFormValues(branch: Branch): BranchFormValues {
  return {
    name: branch.name,
    address: branch.address ?? '',
    description: branch.description ?? '',
  }
}

function toHallFormValues(hall: Hall): HallFormValues {
  return {
    name: hall.name,
    description: hall.description ?? '',
  }
}

function toBranchPayload(values: BranchFormValues) {
  return {
    name: values.name.trim(),
    address: values.address.trim() || null,
    description: values.description.trim() || null,
  }
}

function toHallPayload(values: HallFormValues) {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
  }
}

function upsertById<TItem extends { id: string }>(
  items: TItem[],
  nextItem: TItem,
) {
  const nextItems = items.some((item) => item.id === nextItem.id)
    ? items.map((item) => (item.id === nextItem.id ? nextItem : item))
    : [...items, nextItem]

  return [...nextItems].sort((left, right) =>
    left.id === nextItem.id && !('isArchived' in left)
      ? -1
      : String(
          'isArchived' in left ? Number(left.isArchived) : 0,
        ).localeCompare(String('isArchived' in right ? Number(right.isArchived) : 0)) ||
        ('name' in left && 'name' in right
          ? String(left.name).localeCompare(String(right.name), 'ru')
          : 0),
  )
}
