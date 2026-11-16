import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Drawer, Group, Paper, Select, Stack, Text, TextInput } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  applyScheduleLessonTrainerSubstitution,
  applyScheduleLessonTrainerSubstitutionCancellation,
  previewScheduleLessonTrainerSubstitution,
  previewScheduleLessonTrainerSubstitutionCancellation,
  type ScheduleLesson,
  type ScheduleLessonTrainerSubstitutionCancellationPreviewResponse,
  type ScheduleLessonTrainerSubstitutionPreviewResponse,
} from '../../lib/api'
import { fe2ScheduleCoreText } from '../../resources/fe-2-schedule-core'
import { formatScheduleProblemCode } from './scheduleActionReasons'
import { formatExpiresAt, formatLongDate, formatShortDate, formatTimeRange } from './scheduleDateTime'
import type { FilterOption } from './scheduleFilterOptions'
import { WarningList } from './ScheduleWarnings'

export function ScheduleTrainerSubstitutionDrawer({
  action,
  lesson,
  opened,
  onChanged,
  onClose,
  trainerOptions,
}: {
  action: 'Assign' | 'Cancel' | null
  lesson: ScheduleLesson | null
  opened: boolean
  onChanged: (lesson: ScheduleLesson) => void
  onClose: () => void
  trainerOptions: FilterOption[]
}) {
  const [replacedTrainerId, setReplacedTrainerId] = useState('')
  const [substituteTrainerId, setSubstituteTrainerId] = useState('')
  const [substitutionId, setSubstitutionId] = useState('')
  const [reason, setReason] = useState('')
  const [preview, setPreview] =
    useState<ScheduleLessonTrainerSubstitutionPreviewResponse |
    ScheduleLessonTrainerSubstitutionCancellationPreviewResponse | null>(null)
  const [fieldErrors, setFieldErrors] = useState<SubstitutionFieldErrors>({})
  const [submitting, setSubmitting] = useState<'preview' | 'execute' | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const replacedRef = useRef<HTMLInputElement | null>(null)
  const substituteRef = useRef<HTMLInputElement | null>(null)
  const substitutionRef = useRef<HTMLInputElement | null>(null)

  const permanentTrainers = useMemo(
    () => lesson?.effectiveTrainers.filter((trainer) => trainer.kind === 'Permanent') ?? [],
    [lesson],
  )
  const activeSubstitutions = useMemo(
    () => lesson?.effectiveTrainers.filter((trainer) =>
      trainer.kind === 'Substitute' && Boolean(trainer.substitutionId)) ?? [],
    [lesson],
  )

  useEffect(() => {
    if (!opened || !lesson) {
      return
    }

    setReplacedTrainerId(permanentTrainers[0]?.trainerId ?? '')
    setSubstituteTrainerId('')
    setSubstitutionId(activeSubstitutions[0]?.substitutionId ?? '')
    setReason('')
    setPreview(null)
    setFieldErrors({})
    setFormError(null)
    setSubmitting(null)
    setDirty(false)
  }, [activeSubstitutions, lesson, opened, permanentTrainers])

  if (!lesson || !action) {
    return null
  }

  const activeLesson = lesson
  const pending = submitting !== null
  const isAssign = action === 'Assign'
  const copy = isAssign
    ? {
      title: fe2ScheduleCoreText.groupScheduleScreen_title_1a4e8dc8,
      preview: fe2ScheduleCoreText.groupScheduleScreen_string_857a90c1,
      confirm: fe2ScheduleCoreText.groupScheduleScreen_confirm_1fad63df,
    }
    : {
      title: fe2ScheduleCoreText.groupScheduleScreen_title_37c25119,
      preview: fe2ScheduleCoreText.groupScheduleScreen_string_857a90c1,
      confirm: fe2ScheduleCoreText.groupScheduleScreen_jsxText_ab7a9be4,
    }
  const replacementOptions = permanentTrainers.map((trainer) => ({
    value: trainer.trainerId,
    label: trainer.fullName,
  }))
  const substituteOptions = trainerOptions
    .filter((option) => option.value !== replacedTrainerId)
  const activeSubstitutionOptions = activeSubstitutions.map((trainer) => ({
    value: trainer.substitutionId!,
    label: fe2ScheduleCoreText.groupScheduleScreen_label_0c96696a(trainer.fullName, trainer.replacedTrainerId ? fe2ScheduleCoreText.groupScheduleScreen_template_ee5718b6(findTrainerName(activeLesson, trainer.replacedTrainerId)) : ''),
  }))

  function markDirty() {
    setDirty(true)
    setPreview(null)
    setFormError(null)
  }

  async function submitPreview() {
    setSubmitting('preview')
    setFieldErrors({})
    setFormError(null)

    try {
      const response = isAssign
        ? await previewScheduleLessonTrainerSubstitution({
          replacedTrainerId: replacedTrainerId || null,
          substituteTrainerId: substituteTrainerId || null,
          targets: [buildSubstitutionTarget(activeLesson)],
        })
        : await previewScheduleLessonTrainerSubstitutionCancellation({
          targets: [{
            ...buildSubstitutionTarget(activeLesson),
            substitutionId,
          }],
          reason: reason.trim() || null,
        })

      setPreview(response)
    } catch (previewError) {
      handleSubstitutionFormError(previewError)
    } finally {
      setSubmitting(null)
    }
  }

  async function confirmSubstitution() {
    if (!preview) {
      return
    }

    setSubmitting('execute')
    setFieldErrors({})
    setFormError(null)

    try {
      const response = isAssign
        ? await applyScheduleLessonTrainerSubstitution({
          replacedTrainerId: replacedTrainerId || null,
          substituteTrainerId: substituteTrainerId || null,
          targets: [buildSubstitutionTarget(activeLesson)],
          confirmationToken: preview.confirmationToken,
        })
        : await applyScheduleLessonTrainerSubstitutionCancellation({
          targets: [{
            ...buildSubstitutionTarget(activeLesson),
            substitutionId,
          }],
          reason: reason.trim() || null,
          confirmationToken: preview.confirmationToken,
        })
      const changedLesson = response.lessons[0]
      if (changedLesson) {
        setDirty(false)
        setPreview(null)
        onChanged(changedLesson)
      }
    } catch (executeError) {
      if (executeError instanceof ApiError) {
        const recoveryMessage = formatScheduleProblemCode(executeError.code)
        if (recoveryMessage) {
          setPreview(null)
          setFormError(recoveryMessage)
          return
        }
      }

      handleSubstitutionFormError(executeError)
    } finally {
      setSubmitting(null)
    }
  }

  function handleSubstitutionFormError(formErrorValue: unknown) {
    setPreview(null)

    if (formErrorValue instanceof ApiError) {
      const nextErrors = applyFieldErrors(formErrorValue.fieldErrors, SUBSTITUTION_FIELD_ALIASES)
      setFieldErrors(nextErrors)
      focusFirstSubstitutionInvalidField(nextErrors)
      setFormError(
        formatScheduleProblemCode(formErrorValue.code) ??
        fe2ScheduleCoreText.groupScheduleScreen_string_3e7f6ab3,
      )
      return
    }

    setFormError(fe2ScheduleCoreText.groupScheduleScreen_string_3e7f6ab3)
  }

  function focusFirstSubstitutionInvalidField(errors: SubstitutionFieldErrors) {
    const refs = {
      replacedTrainerId: replacedRef,
      substituteTrainerId: substituteRef,
      substitutionId: substitutionRef,
    }
    const firstInvalid = (Object.keys(refs) as Array<keyof typeof refs>)
      .find((field) => errors[field])

    if (firstInvalid) {
      window.requestAnimationFrame(() => refs[firstInvalid].current?.focus())
    }
  }

  function cancel() {
    if (dirty && !window.confirm(fe2ScheduleCoreText.groupScheduleScreen_windowConfirm_f4d4ec01)) {
      return
    }

    onClose()
  }

  return (
    <Drawer
      className="schedule-substitution-drawer"
      onClose={cancel}
      opened={opened}
      position="bottom"
      size="auto"
      title={copy.title}
      withinPortal
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submitPreview()
        }}
      >
        <Stack gap="md">
          <Stack gap={4}>
            <Text fw={900}>{lesson.groupName}</Text>
            <Text c="dimmed" size="sm">
              {formatLongDate(lesson.lessonDate)} {fe2ScheduleCoreText.groupScheduleScreen_jsxText_a137f17a}{formatTimeRange(lesson)}
            </Text>
            <Text c="dimmed" size="sm">
              {lesson.hallName} {fe2ScheduleCoreText.groupScheduleScreen_jsxText_a137f17a}{lesson.branchName}
            </Text>
          </Stack>

          {isAssign ? (
            <>
              <Select
                data={replacementOptions}
                disabled={pending}
                error={fieldErrors.replacedTrainerId}
                label={fe2ScheduleCoreText.groupScheduleScreen_label_8809248a}
                onChange={(value) => {
                  setReplacedTrainerId(value ?? '')
                  markDirty()
                }}
                placeholder={fe2ScheduleCoreText.groupScheduleScreen_placeholder_d014731e}
                ref={replacedRef}
                searchable
                value={replacedTrainerId || null}
              />
              <Select
                data={substituteOptions}
                disabled={pending}
                error={fieldErrors.substituteTrainerId}
                label={fe2ScheduleCoreText.groupScheduleScreen_label_19aac587}
                onChange={(value) => {
                  setSubstituteTrainerId(value ?? '')
                  markDirty()
                }}
                placeholder={fe2ScheduleCoreText.groupScheduleScreen_placeholder_5f1f1111}
                ref={substituteRef}
                searchable
                value={substituteTrainerId || null}
              />
            </>
          ) : (
            <>
              <Select
                data={activeSubstitutionOptions}
                disabled={pending}
                error={fieldErrors.substitutionId}
                label={fe2ScheduleCoreText.groupScheduleScreen_label_5db04205}
                onChange={(value) => {
                  setSubstitutionId(value ?? '')
                  markDirty()
                }}
                placeholder={fe2ScheduleCoreText.groupScheduleScreen_placeholder_53042571}
                ref={substitutionRef}
                searchable
                value={substitutionId || null}
              />
              <TextInput
                disabled={pending}
                label={fe2ScheduleCoreText.groupScheduleScreen_label_442e7ad5}
                onChange={(event) => {
                  setReason(event.currentTarget.value)
                  markDirty()
                }}
                value={reason}
              />
            </>
          )}

          {formError ? (
            <Alert color="yellow" icon={<IconAlertTriangle size={18} />}>
              {formError}
            </Alert>
          ) : null}

          {preview ? (
            <SubstitutionPreviewPanel preview={preview} />
          ) : null}

          <Group className="schedule-substitution-drawer__footer" grow>
            {preview ? (
              <Button
                loading={submitting === 'execute'}
                onClick={() => void confirmSubstitution()}
                type="button"
              >
                {copy.confirm}
              </Button>
            ) : (
              <Button loading={submitting === 'preview'} type="submit">
                {formError ? fe2ScheduleCoreText.groupScheduleScreen_string_62b92aa4 : copy.preview}
              </Button>
            )}
            <Button disabled={pending} onClick={cancel} type="button" variant="light">
              {fe2ScheduleCoreText.groupScheduleScreen_jsxText_8fbe9b75}</Button>
          </Group>
        </Stack>
      </form>
    </Drawer>
  )
}

type SubstitutionFieldErrors = Partial<
  Record<'replacedTrainerId' | 'substituteTrainerId' | 'substitutionId' | 'reason', string>
>

const SUBSTITUTION_FIELD_ALIASES = {
  replacedTrainerId: 'replacedTrainerId',
  substituteTrainerId: 'substituteTrainerId',
  substitutionId: 'substitutionId',
  reason: 'reason',
  'targets.0.substitutionId': 'substitutionId',
} satisfies Record<string, keyof SubstitutionFieldErrors>

function SubstitutionPreviewPanel({
  preview,
}: {
  preview: ScheduleLessonTrainerSubstitutionPreviewResponse |
    ScheduleLessonTrainerSubstitutionCancellationPreviewResponse
}) {
  const target = preview.targets[0]

  return (
    <Paper className="schedule-substitution-preview" data-testid="schedule-substitution-preview" radius="md" withBorder>
      <Stack gap="sm">
        <Stack gap={2}>
          <Text fw={900}>{fe2ScheduleCoreText.groupScheduleScreen_jsxText_05b83392}</Text>
          {target ? (
            <Text c="dimmed" size="sm">
              {target.groupName} {fe2ScheduleCoreText.groupScheduleScreen_jsxText_a137f17a}{formatShortDate(target.lessonDate)}
            </Text>
          ) : null}
          <Text c="dimmed" size="sm">
            {fe2ScheduleCoreText.groupScheduleScreen_jsxText_cce698e3}{formatExpiresAt(preview.expiresAt)}{fe2ScheduleCoreText.groupScheduleScreen_jsxText_cdb4ee2a}</Text>
        </Stack>
        {preview.warnings.length > 0 ? <WarningList warnings={preview.warnings} /> : null}
        {target?.warnings.length ? <WarningList warnings={target.warnings} /> : null}
      </Stack>
    </Paper>
  )
}

function buildSubstitutionTarget(lesson: ScheduleLesson) {
  return {
    lessonOccurrenceId: lesson.lessonOccurrenceId,
    lessonDate: lesson.lessonDate,
    expectedRevision: lesson.revision,
  }
}

function findTrainerName(lesson: ScheduleLesson, trainerId: string) {
  return lesson.effectiveTrainers.find((trainer) => trainer.trainerId === trainerId)?.fullName ?? fe2ScheduleCoreText.groupScheduleScreen_string_10e82072
}

