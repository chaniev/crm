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
import { fe14GroupStaffingText } from '../../resources/fe-14-group-staffing'


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

const GENERIC_ASSIGNMENT_ERROR = fe14GroupStaffingText.groupTrainerAssignmentsSection_gENERICASSIGNMENTERROR_b044e028

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
        label: fe14GroupStaffingText.groupTrainerAssignmentsSection_label_a0ff92dd(trainer.fullName, trainer.login),
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
      setFormError(fe14GroupStaffingText.groupTrainerAssignmentsSection_setFormError_8c90a577)
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
        title: fe14GroupStaffingText.groupTrainerAssignmentsSection_title_759d829a,
        message: fe14GroupStaffingText.groupTrainerAssignmentsSection_message_7a7b41bd,
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
          ? fe14GroupStaffingText.groupTrainerAssignmentsSection_string_bd7d6747
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
            {fe14GroupStaffingText.groupTrainerAssignmentsSection_jsxText_a43d49ca}{drafts.length}
          </Badge>
        )}
        description={fe14GroupStaffingText.groupTrainerAssignmentsSection_description_72d93054}
        title={fe14GroupStaffingText.groupTrainerAssignmentsSection_title_6f2a21ca}
      />

      {formError ? (
        <Alert
          color="red"
          icon={<IconAlertCircle size={18} />}
          ref={recoveryRef}
          tabIndex={-1}
          title={fe14GroupStaffingText.groupTrainerAssignmentsSection_title_7530f803}
          variant="light"
        >
          {formError}
        </Alert>
      ) : null}

      {drafts.length === 0 ? (
        <EmptyState
          description={fe14GroupStaffingText.groupTrainerAssignmentsSection_description_b5251bc5}
          icon={<IconUserStar size={24} />}
          title={fe14GroupStaffingText.groupTrainerAssignmentsSection_title_eb93958c}
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
                  label={fe14GroupStaffingText.groupTrainerAssignmentsSection_template_07b8af35(index + 1)}
                  onChange={(trainerId) =>
                    updateDraft(draft.key, 'trainerId', trainerId ?? '')
                  }
                  placeholder={fe14GroupStaffingText.groupTrainerAssignmentsSection_placeholder_3928a7cc}
                  searchable
                  value={draft.trainerId || null}
                />
                <TextInput
                  disabled={pending}
                  error={fieldErrors[`${index}.validFrom`]}
                  label={fe14GroupStaffingText.groupTrainerAssignmentsSection_template_bb0c93bf(index + 1)}
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
                  label={fe14GroupStaffingText.groupTrainerAssignmentsSection_template_b016d5be(index + 1)}
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
                    {fe14GroupStaffingText.groupTrainerAssignmentsSection_jsxText_be99b136}</Button>
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
              <Text fw={700}>{fe14GroupStaffingText.groupTrainerAssignmentsSection_jsxText_e9be6ac7}</Text>
              <Badge color="teal" variant="light">
                {fe14GroupStaffingText.groupTrainerAssignmentsSection_jsxText_672a522d}{preview.impact.totalAffectedOccurrences}
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
              <Text c="dimmed" size="sm">{fe14GroupStaffingText.groupTrainerAssignmentsSection_jsxText_f853b1ba}</Text>
            )}
            {preview.impact.examples.length > 0 ? (
              <Stack gap={4}>
                {preview.impact.examples.map((example) => (
                  <Text key={example.lessonOccurrenceId} size="sm">
                    {formatDateOnly(example.lessonDate)} {fe14GroupStaffingText.groupTrainerAssignmentsSection_jsxText_a137f17a}{example.startTime} {fe14GroupStaffingText.groupTrainerAssignmentsSection_jsxText_a137f17a}{example.hallName}
                  </Text>
                ))}
              </Stack>
            ) : null}
            <Text c="dimmed" size="xs">
              {fe14GroupStaffingText.groupTrainerAssignmentsSection_jsxText_fb7dfed4}{formatDateTime(preview.expiresAt)}{fe14GroupStaffingText.groupTrainerAssignmentsSection_jsxText_cdb4ee2a}</Text>
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
          {fe14GroupStaffingText.groupTrainerAssignmentsSection_jsxText_0918d565}</Button>
        <Button
          leftSection={<IconRefresh size={18} />}
          loading={pendingAction === 'preview'}
          onClick={() => void requestPreview()}
          type="button"
          variant="secondary"
        >
          {fe14GroupStaffingText.groupTrainerAssignmentsSection_jsxText_857a90c1}</Button>
        <Button
          disabled={!preview || pendingAction === 'preview'}
          leftSection={<IconDeviceFloppy size={18} />}
          loading={pendingAction === 'execute'}
          onClick={() => void executeAssignments()}
          type="button"
        >
          {fe14GroupStaffingText.groupTrainerAssignmentsSection_jsxText_8b3890f6}</Button>
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
    formError = fe14GroupStaffingText.groupTrainerAssignmentsSection_string_eed7cd02
  }

  drafts.forEach((draft, index) => {
    if (!draft.trainerId) {
      fieldErrors[`${index}.trainerId`] = fe14GroupStaffingText.groupTrainerAssignmentsSection_string_11da4ac5
    }
    if (!isValidDateOnly(draft.validFrom)) {
      fieldErrors[`${index}.validFrom`] = fe14GroupStaffingText.groupTrainerAssignmentsSection_string_eb4a0393
    }
    if (draft.validTo && !isValidDateOnly(draft.validTo)) {
      fieldErrors[`${index}.validTo`] = fe14GroupStaffingText.groupTrainerAssignmentsSection_string_8858264c
    }
    if (
      isValidDateOnly(draft.validFrom) &&
      isValidDateOnly(draft.validTo) &&
      draft.validTo < draft.validFrom
    ) {
      fieldErrors[`${index}.validTo`] = fe14GroupStaffingText.groupTrainerAssignmentsSection_string_a9adf0fb
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
