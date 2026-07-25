import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Badge,
  Group,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useMediaQuery } from '@mantine/hooks'
import {
  IconAlertCircle,
  IconEdit,
  IconRefresh,
  IconUserCheck,
  IconUserOff,
  IconUserPlus,
} from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  cancelGroupTrainerSubstitution,
  createGroupTrainerSubstitution,
  getGroupTrainerSubstitutions,
  updateGroupTrainerSubstitution,
  type GroupTrainerSubstitution,
  type GroupTrainerSubstitutionsResponse,
  type TrainerOption,
} from '../../lib/api'
import {
  Button,
  ConfirmActionModal,
  EmptyState,
  LoadingState,
  ResponsiveButtonGroup,
  SectionHeader,
} from '../shared/ux'
import { showAppNotification } from '../shared/notifications'

const HISTORY_TAKE = 20
const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

type GroupTrainerSubstitutionsSectionProps = {
  groupId: string
  trainerOptions: TrainerOption[]
}

type SubstitutionModalState =
  | { mode: 'create' }
  | { mode: 'edit'; substitution: GroupTrainerSubstitution }
  | null

type SubstitutionFormValues = {
  substituteTrainerId: string
  startsOn: string
  endsOn: string
}

const STATUS_LABELS: Record<GroupTrainerSubstitution['status'], string> = {
  Active: 'Активно',
  Upcoming: 'Запланировано',
  Expired: 'Завершено',
  Cancelled: 'Отменено',
}

const STATUS_COLORS: Record<GroupTrainerSubstitution['status'], string> = {
  Active: 'teal',
  Upcoming: 'brand.1',
  Expired: 'gray',
  Cancelled: 'red',
}

export function GroupTrainerSubstitutionsSection({
  groupId,
  trainerOptions,
}: GroupTrainerSubstitutionsSectionProps) {
  const [data, setData] = useState<GroupTrainerSubstitutionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [historyOpened, setHistoryOpened] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [modalState, setModalState] = useState<SubstitutionModalState>(null)
  const [cancelTarget, setCancelTarget] = useState<GroupTrainerSubstitution | null>(null)
  const [cancelPending, setCancelPending] = useState(false)

  const loadFirstPage = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setLoadError(null)

    try {
      const nextData = await getGroupTrainerSubstitutions(
        groupId,
        { historySkip: 0, historyTake: HISTORY_TAKE },
        signal,
      )
      setData(nextData)
    } catch (error) {
      if (signal?.aborted) {
        return
      }

      setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить замещения.')
    } finally {
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }, [groupId])

  useEffect(() => {
    const controller = new AbortController()

    void loadFirstPage(controller.signal)

    return () => controller.abort()
  }, [groupId, loadFirstPage])

  async function loadMoreHistory() {
    if (!data || historyLoading) {
      return
    }

    setHistoryLoading(true)
    setActionError(null)

    try {
      const nextData = await getGroupTrainerSubstitutions(groupId, {
        historySkip: data.history.items.length,
        historyTake: HISTORY_TAKE,
      })
      setData({
        ...nextData,
        history: {
          ...nextData.history,
          items: [...data.history.items, ...nextData.history.items],
          totalCount: nextData.history.totalCount,
          skip: 0,
          take: data.history.items.length + nextData.history.items.length,
        },
      })
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Не удалось загрузить историю замещений.',
      )
    } finally {
      setHistoryLoading(false)
    }
  }

  async function refetchAfterMutation() {
    await loadFirstPage()
  }

  function openCreateModal() {
    setActionError(null)
    setModalState({ mode: 'create' })
  }

  function openEditModal(substitution: GroupTrainerSubstitution) {
    setActionError(null)
    setModalState({ mode: 'edit', substitution })
  }

  async function cancelSubstitution() {
    if (!cancelTarget) {
      return
    }

    setCancelPending(true)
    setActionError(null)

    try {
      await cancelGroupTrainerSubstitution(groupId, cancelTarget.id)
      setCancelTarget(null)
      await refetchAfterMutation()
      showAppNotification({
        id: `group-trainer-substitution-cancel-${cancelTarget.id}`,
        title: 'Замещение отменено',
        message: `Временный доступ тренера «${cancelTarget.substituteTrainer.fullName}» отозван.`,
        color: 'teal',
      })
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Не удалось отменить замещение.',
      )
    } finally {
      setCancelPending(false)
    }
  }

  const historyItems = data?.history.items ?? []
  const historyTotalCount = data?.history.totalCount ?? 0
  const hasMoreHistory = data
    ? data.history.items.length < data.history.totalCount
    : false

  return (
    <section aria-labelledby="group-trainer-substitutions-title">
      <Stack gap="lg">
        <SectionHeader
          actions={(
            <Button
              disabled={loading || !data?.canCreate}
              leftSection={<IconUserPlus size={18} />}
              onClick={openCreateModal}
              title={data?.createUnavailableReason?.message}
            >
              Назначить замещение
            </Button>
          )}
          description="Временный доступ тренера действует только на выбранный период и не меняет основных тренеров группы."
          title="Временные замещения"
          titleId="group-trainer-substitutions-title"
        />

        {loading ? (
          <LoadingState label="Загружаем временные замещения..." />
        ) : null}

        {!loading && loadError ? (
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            role="alert"
            title="Замещения не загрузились"
            variant="light"
          >
            <Stack gap="sm">
              <Text>{loadError}</Text>
              <ResponsiveButtonGroup>
                <Button
                  leftSection={<IconRefresh size={18} />}
                  onClick={() => void loadFirstPage()}
                  variant="secondary"
                >
                  Повторить загрузку замещений
                </Button>
              </ResponsiveButtonGroup>
            </Stack>
          </Alert>
        ) : null}

        {actionError ? (
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            role="alert"
            title="Действие не выполнено"
            variant="light"
          >
            {actionError}
          </Alert>
        ) : null}

        {!loading && !loadError && data ? (
          <Stack gap="md">
            {data.createUnavailableReason && !data.canCreate ? (
              <Alert color="gray" variant="light">
                {data.createUnavailableReason.message}
              </Alert>
            ) : null}

            <Stack gap="sm">
              <Text component="h3" fw={700} size="md">
                Текущие и будущие
              </Text>

              {data.current.length === 0 ? (
                <EmptyState
                  description="Текущие и будущие временные назначения появятся здесь после создания."
                  icon={<IconUserCheck size={24} />}
                  title="Текущих и будущих замещений нет"
                />
              ) : (
                <Stack aria-label="Текущие и будущие замещения" gap="sm" role="list">
                  {data.current.map((substitution) => (
                    <SubstitutionCard
                      key={substitution.id}
                      onCancel={() => setCancelTarget(substitution)}
                      onEdit={() => openEditModal(substitution)}
                      substitution={substitution}
                    />
                  ))}
                </Stack>
              )}
            </Stack>

            <Stack gap="sm">
              <Group justify="space-between" wrap="wrap">
                <Stack gap={2}>
                  <Text component="h3" fw={700} size="md">
                    История
                  </Text>
                  <Text c="dimmed" size="sm">
                    Показано {historyItems.length} из {historyTotalCount}
                  </Text>
                </Stack>
                <Button
                  aria-controls="group-trainer-substitutions-history"
                  aria-expanded={historyOpened}
                  disabled={historyTotalCount === 0}
                  onClick={() => setHistoryOpened((opened) => !opened)}
                  variant="subtle"
                >
                  {historyOpened ? 'Скрыть историю замещений' : 'Показать историю замещений'}
                </Button>
              </Group>

              {historyOpened ? (
                <Stack
                  aria-label="История временных замещений"
                  gap="sm"
                  id="group-trainer-substitutions-history"
                  role="list"
                >
                  {historyItems.map((substitution) => (
                    <SubstitutionCard
                      key={substitution.id}
                      onCancel={() => setCancelTarget(substitution)}
                      onEdit={() => openEditModal(substitution)}
                      substitution={substitution}
                    />
                  ))}

                  {hasMoreHistory ? (
                    <ResponsiveButtonGroup>
                      <Button
                        loading={historyLoading}
                        onClick={() => void loadMoreHistory()}
                        variant="secondary"
                      >
                        Показать ещё
                      </Button>
                    </ResponsiveButtonGroup>
                  ) : null}
                </Stack>
              ) : null}
            </Stack>
          </Stack>
        ) : null}

        <SubstitutionFormModal
          groupId={groupId}
          modalState={modalState}
          onClose={() => setModalState(null)}
          onSuccess={() => void refetchAfterMutation()}
          trainerOptions={trainerOptions}
        />

        <ConfirmActionModal
          confirmColor="red"
          confirmLabel="Отозвать замещение"
          description={
            cancelTarget
              ? `Временное основание доступа тренера «${cancelTarget.substituteTrainer.fullName}» будет отозвано сразу. Основные тренеры группы не изменятся.`
              : ''
          }
          onClose={() => {
            if (!cancelPending) {
              setCancelTarget(null)
            }
          }}
          onConfirm={() => void cancelSubstitution()}
          opened={Boolean(cancelTarget)}
          pending={cancelPending}
          title="Отменить временное замещение"
        />
      </Stack>
    </section>
  )
}

type SubstitutionCardProps = {
  substitution: GroupTrainerSubstitution
  onEdit: () => void
  onCancel: () => void
}

function SubstitutionCard({
  substitution,
  onEdit,
  onCancel,
}: SubstitutionCardProps) {
  const actionPeriodLabel = `${substitution.startsOn} - ${substitution.endsOn}`

  return (
    <Paper
      className="list-row-card group-trainer-substitution-row"
      data-testid={`group-trainer-substitution-${substitution.id}`}
      radius="24px"
      role="listitem"
      withBorder
    >
      <Stack gap="md">
        <Group align="flex-start" justify="space-between" wrap="wrap">
          <Stack gap={6}>
            <Group gap="sm" wrap="wrap">
              <Text fw={700}>{substitution.substituteTrainer.fullName}</Text>
              <Badge color={STATUS_COLORS[substitution.status]} radius="xl" variant="light">
                {STATUS_LABELS[substitution.status]}
              </Badge>
              {!substitution.substituteTrainer.isActive ? (
                <Badge color="gray" radius="xl" variant="outline">
                  Неактивный тренер
                </Badge>
              ) : null}
            </Group>
            <Text c="dimmed" size="sm">
              Логин: {substitution.substituteTrainer.login}
            </Text>
            <Text c="dimmed" size="sm">
              <time dateTime={substitution.startsOn}>
                с {formatDateOnly(substitution.startsOn)}
              </time>
              {' - '}
              <time dateTime={substitution.endsOn}>
                по {formatDateOnly(substitution.endsOn)} включительно
              </time>
            </Text>
          </Stack>

          <ResponsiveButtonGroup justify="flex-end">
            {substitution.allowedActions.canEdit ? (
              <Button
                aria-label={`Изменить замещение ${substitution.substituteTrainer.fullName}, период ${actionPeriodLabel}`}
                className="group-trainer-substitution-row__action"
                leftSection={<IconEdit size={18} />}
                onClick={onEdit}
                variant="secondary"
              >
                Изменить
              </Button>
            ) : null}
            {substitution.allowedActions.canCancel ? (
              <Button
                aria-label={`Отменить замещение ${substitution.substituteTrainer.fullName}, период ${actionPeriodLabel}`}
                className="group-trainer-substitution-row__action"
                leftSection={<IconUserOff size={18} />}
                onClick={onCancel}
                variant="subtle"
              >
                Отменить
              </Button>
            ) : null}
          </ResponsiveButtonGroup>
        </Group>
      </Stack>
    </Paper>
  )
}

type SubstitutionFormModalProps = {
  groupId: string
  modalState: SubstitutionModalState
  trainerOptions: TrainerOption[]
  onClose: () => void
  onSuccess: () => void
}

function SubstitutionFormModal({
  groupId,
  modalState,
  trainerOptions,
  onClose,
  onSuccess,
}: SubstitutionFormModalProps) {
  const isMobile = useMediaQuery('(max-width: 48em)')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<SubstitutionFormValues>({
    initialValues: {
      substituteTrainerId: '',
      startsOn: '',
      endsOn: '',
    },
    validate: {
      substituteTrainerId: (value) =>
        value ? null : 'Выберите замещающего тренера.',
      startsOn: validateDateOnly,
      endsOn: validateDateOnly,
    },
  })
  const formRef = useRef(form)
  formRef.current = form

  useEffect(() => {
    if (!modalState) {
      return
    }

    setFormError(null)
    const currentForm = formRef.current
    currentForm.clearErrors()

    if (modalState.mode === 'create') {
      currentForm.setValues({
        substituteTrainerId: '',
        startsOn: '',
        endsOn: '',
      })
      return
    }

    currentForm.setValues({
      substituteTrainerId: modalState.substitution.substituteTrainer.id,
      startsOn: modalState.substitution.startsOn,
      endsOn: modalState.substitution.endsOn,
    })
  }, [modalState])

  if (!modalState) {
    return null
  }

  async function submit(values: SubstitutionFormValues) {
    if (!modalState) {
      return
    }

    setSubmitting(true)
    setFormError(null)
    form.clearErrors()

    const payload = {
      substituteTrainerId: values.substituteTrainerId,
      startsOn: values.startsOn,
      endsOn: values.endsOn,
    }

    try {
      const saved = modalState.mode === 'create'
        ? await createGroupTrainerSubstitution(groupId, payload)
        : await updateGroupTrainerSubstitution(groupId, modalState.substitution.id, payload)

      showAppNotification({
        id: `group-trainer-substitution-${modalState.mode}-${saved.id}`,
        title: modalState.mode === 'create'
          ? 'Замещение назначено'
          : 'Замещение обновлено',
        message: `Тренер «${saved.substituteTrainer.fullName}» указан для выбранного периода.`,
        color: 'teal',
      })
      onClose()
      onSuccess()
    } catch (error) {
      if (error instanceof ApiError) {
        form.setErrors(applyFieldErrors(error.fieldErrors))
        setFormError(error.message)
        return
      }

      setFormError('Не удалось сохранить замещение.')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedTrainer = modalState.mode === 'edit'
    ? modalState.substitution.substituteTrainer
    : null
  const selectData = mergeTrainerOptions(trainerOptions, selectedTrainer).map((trainer) => ({
    value: trainer.id,
    label: `${trainer.fullName} (${trainer.login})`,
  }))

  return (
    <Modal
      centered={!isMobile}
      fullScreen={isMobile}
      onClose={submitting ? () => undefined : onClose}
      opened
      radius="24px"
      title={modalState.mode === 'create' ? 'Новое временное замещение' : 'Редактирование замещения'}
      withCloseButton={!submitting}
    >
      <form onSubmit={form.onSubmit((values) => void submit(values))}>
        <Stack gap="lg">
          {formError ? (
            <Alert
              color="red"
              icon={<IconAlertCircle size={18} />}
              role="alert"
              title="Сохранение не выполнено"
              variant="light"
            >
              {formError}
            </Alert>
          ) : null}

          <Select
            data={selectData}
            label="Замещающий тренер"
            placeholder="Выберите тренера"
            searchable
            {...form.getInputProps('substituteTrainerId')}
          />

          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label="Начало периода"
              type="date"
              {...form.getInputProps('startsOn')}
            />
            <TextInput
              label="Окончание периода"
              type="date"
              {...form.getInputProps('endsOn')}
            />
          </SimpleGrid>

          <ResponsiveButtonGroup justify="flex-end">
            <Button disabled={submitting} onClick={onClose} type="button" variant="secondary">
              Отменить
            </Button>
            <Button loading={submitting} type="submit">
              {modalState.mode === 'create' ? 'Создать замещение' : 'Сохранить замещение'}
            </Button>
          </ResponsiveButtonGroup>
        </Stack>
      </form>
    </Modal>
  )
}

function mergeTrainerOptions(
  trainerOptions: TrainerOption[],
  selectedTrainer: GroupTrainerSubstitution['substituteTrainer'] | null,
) {
  if (!selectedTrainer || trainerOptions.some((trainer) => trainer.id === selectedTrainer.id)) {
    return trainerOptions
  }

  return [
    ...trainerOptions,
    {
      id: selectedTrainer.id,
      fullName: selectedTrainer.fullName,
      login: selectedTrainer.login,
    },
  ]
}

function validateDateOnly(value: string) {
  if (!value) {
    return 'Укажите дату.'
  }

  return ISO_DATE_ONLY_PATTERN.test(value)
    ? null
    : 'Укажите дату в формате ГГГГ-ММ-ДД.'
}

function formatDateOnly(value: string) {
  const [year, month, day] = value.split('-')

  return year && month && day ? `${day}.${month}.${year}` : value
}
