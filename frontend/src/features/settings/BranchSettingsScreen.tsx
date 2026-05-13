import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
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
  MetricCard,
  PageCard,
  PageHeader,
  RefreshButton,
  ResponsiveButtonGroup,
} from '../shared/ux'

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
            : 'Не удалось загрузить филиалы и залы.',
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
  const activeBranchCount = branches.filter((branch) => !branch.isArchived).length
  const activeHallCount = halls.filter((hall) => !hall.isArchived).length

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

      notifications.show({
        title:
          branchModal.mode === 'create'
            ? 'Филиал создан'
            : 'Филиал обновлен',
        message: `Филиал «${savedBranch.name}» сохранен.`,
        color: 'teal',
      })
    } catch (error) {
      if (error instanceof ApiError) {
        branchForm.setErrors(applyFieldErrors(error.fieldErrors))
        setActionError(error.message)
        return
      }

      setActionError('Не удалось сохранить филиал.')
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

      notifications.show({
        title: hallModal.mode === 'create' ? 'Зал создан' : 'Зал обновлен',
        message: `Зал «${savedHall.name}» сохранен.`,
        color: 'teal',
      })
      setReloadKey((currentKey) => currentKey + 1)
    } catch (error) {
      if (error instanceof ApiError) {
        hallForm.setErrors(applyFieldErrors(error.fieldErrors))
        setActionError(error.message)
        return
      }

      setActionError('Не удалось сохранить зал.')
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
      notifications.show({
        title: updatedBranch.isArchived
          ? 'Филиал архивирован'
          : 'Филиал возвращен',
        message: `Филиал «${updatedBranch.name}» обновлен.`,
        color: 'teal',
      })
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Не удалось изменить статус филиала.',
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
      notifications.show({
        title: updatedHall.isArchived ? 'Зал архивирован' : 'Зал возвращен',
        message: `Зал «${updatedHall.name}» обновлен.`,
        color: 'teal',
      })
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Не удалось изменить статус зала.',
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
      notifications.show({
        title: 'Зал удален',
        message: `Зал «${hallToDelete.name}» удален из филиала.`,
        color: 'teal',
      })
      setHallToDelete(null)
      setReloadKey((currentKey) => currentKey + 1)
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Не удалось удалить зал.',
      )
      setHallToDelete(null)
    } finally {
      setHallPendingId(null)
    }
  }

  return (
    <Stack
      className={embedded ? undefined : 'dashboard-stack'}
      data-testid={embedded ? undefined : 'settings-screen'}
      gap="xl"
      mt={embedded ? 'xl' : undefined}
    >
      <PageCard className={embedded ? undefined : 'page-header-card'}>
        <PageHeader
          actions={(
            <ResponsiveButtonGroup>
              <Button
                color="accent.5"
                leftSection={<IconPlus size={18} />}
                onClick={openCreateBranch}
              >
                Добавить филиал
              </Button>
              <RefreshButton
                disabled={loading}
                label="Обновить"
                onClick={() => setReloadKey((currentKey) => currentKey + 1)}
              />
            </ResponsiveButtonGroup>
          )}
          description="Управляйте филиалами и залами, которые затем выбираются в клиентах и тренировочных группах."
          eyebrow={
            embedded
              ? undefined
              : (
                  <Badge color="brand.1" radius="xl" size="lg" variant="light">
                    Настройки CRM
                  </Badge>
                )
          }
          title="Филиалы и залы"
        />
      </PageCard>

      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <MetricCard
          description="Всего заведенных филиалов"
          label="Филиалы"
          value={String(branches.length)}
        />
        <MetricCard
          description="Филиалы, доступные для рабочих форм"
          label="Активные филиалы"
          value={String(activeBranchCount)}
        />
        <MetricCard
          description="Активные залы во всех филиалах"
          label="Активные залы"
          value={String(activeHallCount)}
        />
      </SimpleGrid>

      <PageCard>
        <Stack gap="lg">
          {actionError ? (
            <Alert
              color="red"
              icon={<IconAlertCircle size={18} />}
              title="Действие не выполнено"
              variant="light"
            >
              {actionError}
            </Alert>
          ) : null}

          {loading ? <LoadingState label="Загружаем филиалы и залы..." /> : null}

          {!loading && loadError ? (
            <ErrorState
              action={(
                <Button
                  leftSection={<IconRefresh size={18} />}
                  onClick={() => setReloadKey((currentKey) => currentKey + 1)}
                  variant="pill"
                >
                  Повторить
                </Button>
              )}
              message={loadError}
              title="Настройки не загрузились"
            />
          ) : null}

          {!loading && !loadError && branches.length === 0 ? (
            <EmptyState
              action={(
                <Button leftSection={<IconPlus size={18} />} onClick={openCreateBranch}>
                  Добавить филиал
                </Button>
              )}
              description="После создания филиала можно будет добавить залы и использовать их в формах CRM."
              icon={<IconBuildingStore size={24} />}
              title="Филиалы пока не созданы"
            />
          ) : null}

          {!loading && !loadError && branches.length > 0 ? (
            <div className="settings-branches-layout">
              <Stack gap="sm">
                {branches.map((branch) => {
                  const selected = branch.id === selectedBranchId

                  return (
                    <Paper
                      aria-label={`Открыть филиал ${branch.name}`}
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
                              {branch.isArchived ? 'Архивный' : 'Активный'}
                            </Badge>
                          </Group>
                          <Text c="dimmed" size="sm">
                            {branch.address || 'Адрес не указан'}
                          </Text>
                          <Text c="dimmed" size="sm">
                            Залов: {branch.hallCount} · Групп: {branch.groupCount} · Клиентов: {branch.clientCount}
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
      </PageCard>

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
        confirmLabel="Удалить зал"
        description={
          hallToDelete
            ? `Backend не удалит зал «${hallToDelete.name}», если он уже используется группами.`
            : 'Удалить выбранный зал?'
        }
        onClose={() => setHallToDelete(null)}
        onConfirm={() => void confirmDeleteHall()}
        opened={Boolean(hallToDelete)}
        pending={hallPendingId === hallToDelete?.id}
        title="Удалить зал?"
      />
    </Stack>
  )
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
          Выберите филиал в списке.
        </Text>
      </Paper>
    )
  }

  return (
    <Paper className="settings-branch-details" withBorder>
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon color="brand.7" radius="xl" size={40} variant="light">
              <IconBuildingStore size={20} />
            </ThemeIcon>
            <div>
              <Text fw={800}>{branch.name}</Text>
              <Text c="dimmed" size="sm">
                {branch.address || 'Адрес не указан'}
              </Text>
            </div>
          </Group>

          <ResponsiveButtonGroup justify="flex-end">
            <Button
              leftSection={<IconEdit size={18} />}
              onClick={() => onEditBranch(branch)}
              variant="pill"
            >
              Редактировать
            </Button>
            <Button
              color={branch.isArchived ? 'teal' : 'gray'}
              leftSection={
                branch.isArchived ? <IconRefresh size={18} /> : <IconArchive size={18} />
              }
              loading={branchPending === branch.id}
              onClick={() => onArchiveBranch(branch)}
              variant="pill"
            >
              {branch.isArchived ? 'Вернуть' : 'В архив'}
            </Button>
          </ResponsiveButtonGroup>
        </Group>

        {branch.description ? (
          <Text size="sm">{branch.description}</Text>
        ) : (
          <Text c="dimmed" size="sm">
            Описание филиала пока не добавлено.
          </Text>
        )}

        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <BranchStat label="Залы" value={String(branch.hallCount)} />
          <BranchStat label="Группы" value={String(branch.groupCount)} />
          <BranchStat label="Клиенты" value={String(branch.clientCount)} />
        </SimpleGrid>

        <Group justify="space-between" wrap="wrap">
          <div>
            <Text fw={800}>Залы филиала</Text>
            <Text c="dimmed" size="sm">
              Зал выбирается в форме тренировочной группы.
            </Text>
          </div>
          <Button
            disabled={branch.isArchived}
            leftSection={<IconPlus size={18} />}
            onClick={() => onCreateHall(branch.id)}
            variant="pill"
          >
            Добавить зал
          </Button>
        </Group>

        {halls.length === 0 ? (
          <EmptyState
            action={
              branch.isArchived ? null : (
                <Button
                  leftSection={<IconPlus size={18} />}
                  onClick={() => onCreateHall(branch.id)}
                >
                  Добавить зал
                </Button>
              )
            }
            description="Создайте первый зал, чтобы группы могли ссылаться на место тренировок."
            icon={<IconMapPin size={24} />}
            title="Залы пока не созданы"
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
                        {hall.isArchived ? 'Архивный' : 'Активный'}
                      </Badge>
                      <Badge color="brand.1" radius="sm" variant="light">
                        Групп: {hall.groupCount}
                      </Badge>
                    </Group>
                    <Text c="dimmed" size="sm">
                      {hall.description || 'Описание не добавлено'}
                    </Text>
                  </Stack>

                  <Group gap="xs" wrap="nowrap">
                    <ActionIcon
                      aria-label={`Редактировать зал ${hall.name}`}
                      onClick={() => onEditHall(hall)}
                      variant="light"
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      aria-label={
                        hall.isArchived
                          ? `Вернуть зал ${hall.name}`
                          : `Архивировать зал ${hall.name}`
                      }
                      color={hall.isArchived ? 'teal' : 'gray'}
                      loading={hallPending === hall.id}
                      onClick={() => onArchiveHall(hall)}
                      variant="light"
                    >
                      {hall.isArchived ? (
                        <IconRefresh size={16} />
                      ) : (
                        <IconArchive size={16} />
                      )}
                    </ActionIcon>
                    <ActionIcon
                      aria-label={`Удалить зал ${hall.name}`}
                      color="red"
                      disabled={hallPending === hall.id}
                      onClick={() => onDeleteHall(hall)}
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
      title={modal?.mode === 'edit' ? 'Редактировать филиал' : 'Новый филиал'}
      withCloseButton={!pending}
    >
      <form onSubmit={form.onSubmit((values) => void onSubmit(values))}>
        <Stack gap="md">
          <TextInput
            label="Название филиала"
            placeholder="Например, Центр"
            {...form.getInputProps('name')}
          />
          <TextInput
            label="Адрес"
            placeholder="Город, улица, дом"
            {...form.getInputProps('address')}
          />
          <Textarea
            autosize
            label="Описание"
            minRows={3}
            placeholder="Короткая заметка для администраторов"
            {...form.getInputProps('description')}
          />

          <ResponsiveButtonGroup justify="space-between">
            <Button disabled={pending} onClick={onClose} type="button" variant="ghost">
              Отменить
            </Button>
            <Button
              leftSection={<IconDeviceFloppy size={18} />}
              loading={pending}
              type="submit"
            >
              Сохранить
            </Button>
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
      title={modal?.mode === 'edit' ? 'Редактировать зал' : 'Новый зал'}
      withCloseButton={!pending}
    >
      <form onSubmit={form.onSubmit((values) => void onSubmit(values))}>
        <Stack gap="md">
          <Paper className="hint-card" radius="8px" withBorder>
            <Text c="dimmed" size="sm">
              Филиал: {selectedBranch?.name ?? 'Не выбран'}
            </Text>
          </Paper>
          <TextInput
            label="Название зала"
            placeholder="Например, Основной зал"
            {...form.getInputProps('name')}
          />
          <Textarea
            autosize
            label="Описание"
            minRows={3}
            placeholder="Покрытие, вместимость или служебная заметка"
            {...form.getInputProps('description')}
          />

          <ResponsiveButtonGroup justify="space-between">
            <Button disabled={pending} onClick={onClose} type="button" variant="ghost">
              Отменить
            </Button>
            <Button
              leftSection={<IconDeviceFloppy size={18} />}
              loading={pending}
              type="submit"
            >
              Сохранить
            </Button>
          </ResponsiveButtonGroup>
        </Stack>
      </form>
    </Modal>
  )
}

type BranchStatProps = {
  label: string
  value: string
}

function BranchStat({ label, value }: BranchStatProps) {
  return (
    <Paper className="hint-card" radius="8px" withBorder>
      <Stack gap={2}>
        <Text c="dimmed" fw={600} size="xs">
          {label}
        </Text>
        <Text fw={800}>{value}</Text>
      </Stack>
    </Paper>
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
