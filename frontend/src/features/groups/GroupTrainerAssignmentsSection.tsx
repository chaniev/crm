import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Badge,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconDeviceFloppy,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconUserStar,
} from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  applyGroupTrainerAssignments,
  previewGroupTrainerAssignments,
  type GroupTrainerAssignmentPeriod,
  type GroupTrainerAssignmentPeriodRequest,
  type GroupTrainerAssignmentsPreviewResponse,
  type TrainerOption,
} from '../../lib/api'
import {
  formatScheduleActionUnavailableReason,
  formatScheduleProblemCode,
} from '../schedule/scheduleActionReasons'
import { showAppNotification } from '../shared/notifications'
import {
  Button,
  EmptyState,
  ResponsiveButtonGroup,
  SectionHeader,
} from '../shared/ux'

type GroupTrainerAssignmentsSectionProps = {
  groupId: string
  initialPeriods: GroupTrainerAssignmentPeriod[]
  initialRevision: string
  trainerOptions: TrainerOption[]
}

type AssignmentDraft = {
  key: string
  trainerId: string
  validFrom: string
  validTo: string
}

type AssignmentFieldErrors = Record<string, string>

const GENERIC_ASSIGNMENT_ERROR = 'Не удалось сохранить назначения тренеров.'

export function GroupTrainerAssignmentsSection({
  groupId,
  initialPeriods,
  initialRevision,
  trainerOptions,
}: GroupTrainerAssignmentsSectionProps) {
  const [drafts, setDrafts] = useState<AssignmentDraft[]>(() =>
    toDraftAssignments(initialPeriods),
  )
  const [revision, setRevision] = useState(initialRevision)
  const [preview, setPreview] = useState<GroupTrainerAssignmentsPreviewResponse | null>(null)
  const [pendingAction, setPendingAction] = useState<'preview' | 'execute' | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<AssignmentFieldErrors>({})
  const recoveryRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setDrafts(toDraftAssignments(initialPeriods))
    setRevision(initialRevision)
    setPreview(null)
    setFormError(null)
    setFieldErrors({})
  }, [initialPeriods, initialRevision])

  const trainerData = useMemo(
    () =>
      trainerOptions.map((trainer) => ({
        value: trainer.id,
        label: `${trainer.fullName} (${trainer.login})`,
      })),
    [trainerOptions],
  )

  const pending = pendingAction !== null

  function updateDraft(
    key: string,
    field: keyof Omit<AssignmentDraft, 'key'>,
    value: string,
  ) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.key === key ? { ...draft, [field]: value } : draft,
      ),
    )
    setPreview(null)
    setFormError(null)
    setFieldErrors({})
  }

  function addDraft() {
    setDrafts((current) => [
      ...current,
      {
        key: createDraftKey(),
        trainerId: '',
        validFrom: todayIso(),
        validTo: '',
      },
    ])
    setPreview(null)
    setFormError(null)
    setFieldErrors({})
  }

  function removeDraft(key: string) {
    setDrafts((current) => current.filter((draft) => draft.key !== key))
    setPreview(null)
    setFormError(null)
    setFieldErrors({})
  }

  async function requestPreview() {
    const validation = validateDrafts(drafts)
    setFieldErrors(validation.fieldErrors)
    setFormError(validation.formError)
    setPreview(null)
    if (validation.formError || Object.keys(validation.fieldErrors).length > 0) {
      focusRecovery()
      return
    }

    setPendingAction('preview')
    try {
      const nextPreview = await previewGroupTrainerAssignments(groupId, {
        assignments: toRequestAssignments(drafts),
        expectedRevision: revision,
      })
      setPreview(nextPreview)
      setRevision(nextPreview.revision)
      setFieldErrors({})
      setFormError(null)
    } catch (error) {
      handleApiError(error)
    } finally {
      setPendingAction(null)
    }
  }

  async function executeAssignments() {
    if (!preview) {
      setFormError('Сначала получите предпросмотр назначений.')
      focusRecovery()
      return
    }

    setPendingAction('execute')
    try {
      const result = await applyGroupTrainerAssignments(groupId, {
        assignments: toRequestAssignments(drafts),
        expectedRevision: revision,
        confirmationToken: preview.confirmationToken,
      })

      setRevision(result.revision)
      setDrafts(toDraftAssignments(result.assignments))
      setPreview(null)
      setFieldErrors({})
      setFormError(null)

      showAppNotification({
        id: `group-trainer-assignments-${groupId}`,
        title: 'Назначения тренеров сохранены',
        message: 'Постоянные периоды тренеров применены к группе.',
        color: 'teal',
      })
    } catch (error) {
      handleApiError(error)
    } finally {
      setPendingAction(null)
    }
  }

  function handleApiError(error: unknown) {
    if (error instanceof ApiError) {
      const { fieldErrors: nextFieldErrors, generalError } =
        mapAssignmentFieldErrors(error.fieldErrors)
      const codeMessage =
        formatScheduleProblemCode(error.code) ??
        formatScheduleActionUnavailableReason(error.code)
      setFieldErrors(nextFieldErrors)
      setFormError(
        Object.keys(nextFieldErrors).length > 0
          ? 'Проверьте поля назначений.'
          : generalError ?? codeMessage ?? GENERIC_ASSIGNMENT_ERROR,
      )
      setPreview(null)
      focusRecovery()
      return
    }

    setPreview(null)
    setFormError(GENERIC_ASSIGNMENT_ERROR)
    focusRecovery()
  }

  function focusRecovery() {
    window.requestAnimationFrame(() => {
      const invalidField = document.querySelector<HTMLElement>(
        '.group-trainer-assignments-card [aria-invalid="true"]',
      )
      ;(invalidField ?? recoveryRef.current)?.focus({ preventScroll: false })
    })
  }

  return (
    <Stack className="group-trainer-assignments-card" gap="lg">
      <SectionHeader
        actions={(
          <Badge color="var(--crm-brand-primary-soft)" radius="xl" variant="light">
            Периодов: {drafts.length}
          </Badge>
        )}
        description="Постоянные тренеры меняются отдельным подтверждаемым действием. Основные данные группы сохраняются выше без расписания и списка тренеров."
        title="Постоянные назначения тренеров"
      />

      {formError ? (
        <Alert
          color="red"
          icon={<IconAlertCircle size={18} />}
          ref={recoveryRef}
          tabIndex={-1}
          title="Действие не выполнено"
          variant="light"
        >
          {formError}
        </Alert>
      ) : null}

      {drafts.length === 0 ? (
        <EmptyState
          description="Добавьте хотя бы один период, затем получите предпросмотр влияния на занятия."
          icon={<IconUserStar size={24} />}
          title="Периоды тренеров не заданы"
        />
      ) : (
        <Stack gap="sm">
          {drafts.map((draft, index) => (
            <Paper
              className="group-trainer-assignments-row"
              key={draft.key}
              radius="20px"
              withBorder
            >
              <SimpleGrid cols={{ base: 1, md: 4 }}>
                <Select
                  data={trainerData}
                  disabled={pending}
                  error={fieldErrors[`${index}.trainerId`]}
                  label={`Тренер периода ${index + 1}`}
                  onChange={(trainerId) =>
                    updateDraft(draft.key, 'trainerId', trainerId ?? '')
                  }
                  placeholder="Выберите тренера"
                  searchable
                  value={draft.trainerId || null}
                />
                <TextInput
                  disabled={pending}
                  error={fieldErrors[`${index}.validFrom`]}
                  label={`Начало периода ${index + 1}`}
                  max="9999-12-31"
                  min="1900-01-01"
                  onChange={(event) =>
                    updateDraft(draft.key, 'validFrom', event.currentTarget.value)
                  }
                  type="date"
                  value={draft.validFrom}
                />
                <TextInput
                  disabled={pending}
                  error={fieldErrors[`${index}.validTo`]}
                  label={`Окончание периода ${index + 1}`}
                  max="9999-12-31"
                  min="1900-01-01"
                  onChange={(event) =>
                    updateDraft(draft.key, 'validTo', event.currentTarget.value)
                  }
                  type="date"
                  value={draft.validTo}
                />
                <Group align="end" justify="flex-end">
                  <Button
                    disabled={pending}
                    leftSection={<IconTrash size={18} />}
                    onClick={() => removeDraft(draft.key)}
                    type="button"
                    variant="subtle"
                  >
                    Удалить
                  </Button>
                </Group>
              </SimpleGrid>
            </Paper>
          ))}
        </Stack>
      )}

      {preview ? (
        <Paper className="group-trainer-assignments-preview" radius="20px" withBorder>
          <Stack gap="sm">
            <Group justify="space-between">
              <Text fw={700}>Предпросмотр изменений</Text>
              <Badge color="teal" variant="light">
                Затронуто занятий: {preview.impact.totalAffectedOccurrences}
              </Badge>
            </Group>
            {preview.warnings.length > 0 ? (
              <Stack gap={4}>
                {preview.warnings.map((warning) => (
                  <Text c="orange" key={warning.code} size="sm">
                    {formatScheduleProblemCode(warning.code) ??
                      formatScheduleActionUnavailableReason(warning.code)}
                  </Text>
                ))}
              </Stack>
            ) : (
              <Text c="dimmed" size="sm">Предупреждений нет.</Text>
            )}
            {preview.impact.examples.length > 0 ? (
              <Stack gap={4}>
                {preview.impact.examples.map((example) => (
                  <Text key={example.lessonOccurrenceId} size="sm">
                    {formatDateOnly(example.lessonDate)} · {example.startTime} · {example.hallName}
                  </Text>
                ))}
              </Stack>
            ) : null}
            <Text c="dimmed" size="xs">
              Подтверждение действует до {formatDateTime(preview.expiresAt)}.
            </Text>
          </Stack>
        </Paper>
      ) : null}

      <ResponsiveButtonGroup justify="space-between">
        <Button
          disabled={pending}
          leftSection={<IconPlus size={18} />}
          onClick={addDraft}
          type="button"
          variant="secondary"
        >
          Добавить период
        </Button>
        <Button
          leftSection={<IconRefresh size={18} />}
          loading={pendingAction === 'preview'}
          onClick={() => void requestPreview()}
          type="button"
          variant="secondary"
        >
          Получить предпросмотр
        </Button>
        <Button
          disabled={!preview || pendingAction === 'preview'}
          leftSection={<IconDeviceFloppy size={18} />}
          loading={pendingAction === 'execute'}
          onClick={() => void executeAssignments()}
          type="button"
        >
          Сохранить назначения
        </Button>
      </ResponsiveButtonGroup>
    </Stack>
  )
}

function toDraftAssignments(periods: GroupTrainerAssignmentPeriod[]): AssignmentDraft[] {
  return periods.map((period, index) => ({
    key: `${period.trainerId}-${period.validFrom}-${period.validTo ?? 'open'}-${index}`,
    trainerId: period.trainerId,
    validFrom: period.validFrom,
    validTo: period.validTo ?? '',
  }))
}

function toRequestAssignments(
  drafts: AssignmentDraft[],
): GroupTrainerAssignmentPeriodRequest[] {
  return drafts.map((draft) => ({
    trainerId: draft.trainerId || null,
    validFrom: draft.validFrom,
    validTo: draft.validTo || null,
  }))
}

function validateDrafts(drafts: AssignmentDraft[]) {
  const fieldErrors: AssignmentFieldErrors = {}
  let formError: string | null = null

  if (drafts.length === 0) {
    formError = 'Добавьте хотя бы один период назначения.'
  }

  drafts.forEach((draft, index) => {
    if (!draft.trainerId) {
      fieldErrors[`${index}.trainerId`] = 'Выберите тренера.'
    }
    if (!isValidDateOnly(draft.validFrom)) {
      fieldErrors[`${index}.validFrom`] = 'Укажите корректную дату начала.'
    }
    if (draft.validTo && !isValidDateOnly(draft.validTo)) {
      fieldErrors[`${index}.validTo`] = 'Укажите корректную дату окончания.'
    }
    if (
      isValidDateOnly(draft.validFrom) &&
      isValidDateOnly(draft.validTo) &&
      draft.validTo < draft.validFrom
    ) {
      fieldErrors[`${index}.validTo`] = 'Дата окончания не может быть раньше начала.'
    }
  })

  return { fieldErrors, formError }
}

function mapAssignmentFieldErrors(fieldErrors: Record<string, string[]>) {
  const mapped = applyFieldErrors(fieldErrors)
  const assignmentErrors: AssignmentFieldErrors = {}
  let generalError: string | null = null

  Object.entries(mapped).forEach(([field, message]) => {
    const match = field.match(/^assignments\.(\d+)\.(trainerId|validFrom|validTo)$/)
    if (match) {
      assignmentErrors[`${match[1]}.${match[2]}`] = message
      return
    }

    if (field === 'assignments') {
      generalError = message
    }
  })

  return { fieldErrors: assignmentErrors, generalError }
}

function createDraftKey() {
  return globalThis.crypto?.randomUUID?.() ?? `assignment-${Date.now()}`
}

function isValidDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function todayIso() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatDateOnly(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
