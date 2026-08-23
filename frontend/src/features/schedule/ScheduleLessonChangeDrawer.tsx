import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Drawer,
  Group,
  NumberInput,
  Paper,
  Select,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { IconAlertTriangle, IconEdit } from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  changeScheduleLesson,
  previewScheduleLessonChange,
  type ScheduleLesson,
  type ScheduleLessonChangePreviewResponse,
  type ScheduleLessonChangeRequest,
  type ScheduleWarning,
} from '../../lib/api'
import {
  formatScheduleActionUnavailableReason,
  formatScheduleProblemCode,
} from './scheduleActionReasons'

type ScheduleLessonChangeDrawerProps = {
  hallOptions: Array<{ value: string; label: string }>
  lesson: ScheduleLesson | null
  opened: boolean
  onChanged: (lesson: ScheduleLesson) => void
  onClose: () => void
}

export type ScheduleLessonChangeFormProps = Omit<
  ScheduleLessonChangeDrawerProps,
  'opened' | 'onClose'
> & {
  active?: boolean
  footerClassName?: string
  initialScope?: ScheduleLessonChangeRequest['scope']
  lockScope?: boolean
  onCancel: () => void
}

type ChangeDraft = {
  scope: ScheduleLessonChangeRequest['scope']
  newLessonDate: string
  startTime: string
  durationMinutes: number | ''
  hallId: string
}

type ChangeFieldErrors = Partial<Record<keyof ChangeDraft, string>>

const FIELD_ALIASES = {
  scope: 'scope',
  newLessonDate: 'newLessonDate',
  lessonDate: 'newLessonDate',
  startTime: 'startTime',
  durationMinutes: 'durationMinutes',
  hallId: 'hallId',
} satisfies Record<string, keyof ChangeDraft>

export function ScheduleLessonChangeDrawer({
  hallOptions,
  lesson,
  opened,
  onChanged,
  onClose,
}: ScheduleLessonChangeDrawerProps) {
  return (
    <Drawer
      className="schedule-change-drawer"
      onClose={onClose}
      opened={opened}
      position="bottom"
      size="auto"
      title="Изменить занятие"
      withinPortal
    >
      <ScheduleLessonChangeForm
        active={opened}
        footerClassName="schedule-change-drawer__footer"
        hallOptions={hallOptions}
        lesson={lesson}
        onCancel={onClose}
        onChanged={onChanged}
      />
    </Drawer>
  )
}

export function ScheduleLessonChangeForm({
  active = true,
  footerClassName,
  hallOptions,
  initialScope = 'Occurrence',
  lesson,
  lockScope = false,
  onCancel,
  onChanged,
}: ScheduleLessonChangeFormProps) {
  const [draft, setDraft] = useState<ChangeDraft>(() => buildInitialDraft(lesson))
  const [fieldErrors, setFieldErrors] = useState<ChangeFieldErrors>({})
  const [preview, setPreview] = useState<ScheduleLessonChangePreviewResponse | null>(null)
  const [submitting, setSubmitting] = useState<'preview' | 'execute' | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const dateRef = useRef<HTMLInputElement | null>(null)
  const timeRef = useRef<HTMLInputElement | null>(null)
  const durationRef = useRef<HTMLInputElement | null>(null)
  const hallRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!active) {
      return
    }

    setDraft(buildInitialDraft(lesson, initialScope))
    setFieldErrors({})
    setFormError(null)
    setPreview(null)
    setDirty(false)
  }, [active, initialScope, lesson])

  if (!lesson) {
    return null
  }

  const activeLesson = lesson
  const pending = submitting !== null
  const options = mergeCurrentHall(hallOptions, activeLesson)
  const request = toChangeRequest(draft, activeLesson.revision)

  function updateDraft<Field extends keyof ChangeDraft>(
    field: Field,
    value: ChangeDraft[Field],
  ) {
    setDraft((current) => ({ ...current, [field]: value }))
    setDirty(true)
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
    setFormError(null)
    setPreview(null)
  }

  async function submitPreview() {
    setSubmitting('preview')
    setFieldErrors({})
    setFormError(null)

    try {
      const response = await previewScheduleLessonChange(
        activeLesson.lessonOccurrenceId,
        activeLesson.lessonDate,
        request,
      )
      setPreview(response)
    } catch (error) {
      handleFormError(error)
    } finally {
      setSubmitting(null)
    }
  }

  async function confirmChange() {
    if (!preview) {
      return
    }

    setSubmitting('execute')
    setFieldErrors({})
    setFormError(null)

    try {
      const changed = await changeScheduleLesson(
        activeLesson.lessonOccurrenceId,
        activeLesson.lessonDate,
        {
          ...request,
          confirmationToken: preview.confirmationToken,
        },
      )
      setPreview(null)
      setDirty(false)
      onChanged(changed)
    } catch (error) {
      if (error instanceof ApiError) {
        const recoveryMessage = formatScheduleProblemCode(error.code)
        if (recoveryMessage) {
          setPreview(null)
          setFormError(recoveryMessage)
          return
        }
      }

      handleFormError(error)
    } finally {
      setSubmitting(null)
    }
  }

  function handleFormError(error: unknown) {
    if (error instanceof ApiError) {
      const nextErrors = applyFieldErrors(error.fieldErrors, FIELD_ALIASES)
      setFieldErrors(nextErrors)
      focusFirstInvalidField(nextErrors)
      setFormError(
        formatScheduleProblemCode(error.code) ??
        'Не удалось проверить изменение занятия. Проверьте поля и попробуйте снова.',
      )
      return
    }

    setFormError('Не удалось проверить изменение занятия. Проверьте поля и попробуйте снова.')
  }

  function focusFirstInvalidField(errors: ChangeFieldErrors) {
    const refs = {
      newLessonDate: dateRef,
      startTime: timeRef,
      durationMinutes: durationRef,
      hallId: hallRef,
    }
    const firstInvalid = (Object.keys(refs) as Array<keyof typeof refs>)
      .find((field) => errors[field])

    if (firstInvalid) {
      window.requestAnimationFrame(() => refs[firstInvalid].current?.focus())
    }
  }

  function cancel() {
    if (dirty && !window.confirm('Отменить изменение занятия и потерять черновик?')) {
      return
    }

    onCancel()
  }

  return (
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submitPreview()
        }}
      >
        <Stack gap="md">
          <Stack gap={2}>
            <Text fw={900}>{lesson.groupName}</Text>
            <Text c="dimmed" size="sm">
              Сейчас: {formatLessonDate(lesson.lessonDate)} · {formatTimeRange(lesson)}
            </Text>
          </Stack>
          <SegmentedControl
            aria-label="Область изменения расписания"
            data={[
              { value: 'Occurrence', label: 'Это занятие' },
              { value: 'ThisAndFuture', label: 'С этого дня' },
              { value: 'EntireSeries', label: 'Вся серия' },
            ]}
            disabled={lockScope}
            onChange={(value) =>
              updateDraft('scope', value as ScheduleLessonChangeRequest['scope'])}
            value={draft.scope}
          />
          {draft.scope !== 'Occurrence' ? (
            <Alert color="blue" icon={<IconAlertTriangle size={18} />}>
              Изменяются параметры серии занятий. Поля тренеров здесь не меняются.
            </Alert>
          ) : null}
          <Group align="flex-start" grow>
            <TextInput
              error={fieldErrors.newLessonDate}
              label="Дата"
              max="9999-12-31"
              min="1900-01-01"
              onChange={(event) => updateDraft('newLessonDate', event.currentTarget.value)}
              ref={dateRef}
              type="date"
              value={draft.newLessonDate}
            />
            <TextInput
              error={fieldErrors.startTime}
              label="Время"
              onChange={(event) => updateDraft('startTime', event.currentTarget.value)}
              ref={timeRef}
              type="time"
              value={draft.startTime}
            />
          </Group>
          <Group align="flex-start" grow>
            <NumberInput
              allowDecimal={false}
              error={fieldErrors.durationMinutes}
              label="Длительность"
              max={180}
              min={1}
              onChange={(value) =>
                updateDraft('durationMinutes', typeof value === 'number' ? value : '')
              }
              ref={durationRef}
              suffix=" мин"
              value={draft.durationMinutes}
            />
            <Select
              data={options}
              error={fieldErrors.hallId}
              label="Зал"
              onChange={(value) => updateDraft('hallId', value ?? '')}
              placeholder="Выберите зал"
              ref={hallRef}
              searchable
              value={draft.hallId || null}
            />
          </Group>

          {formError ? (
            <Alert color="yellow" icon={<IconAlertTriangle size={18} />}>
              {formError}
            </Alert>
          ) : null}

          {preview ? (
            <Paper className="schedule-change-preview" radius="md" withBorder>
              <Stack gap="sm">
                <Stack gap={2}>
                  <Text fw={900}>Проверьте изменение перед сохранением</Text>
                  <Text c="dimmed" size="sm">
                    {preview.lesson.groupName} · {formatLessonDate(preview.lesson.lessonDate)} · {formatTimeRange(preview.lesson)}
                  </Text>
                  <Text c="dimmed" size="sm">
                    {preview.lesson.hallName} · {preview.lesson.branchName}
                  </Text>
                </Stack>
                {preview.warnings.length > 0 ? (
                  <Stack gap="xs">
                    {preview.warnings.map((warning, index) => (
                      <Alert
                        color="yellow"
                        icon={<IconAlertTriangle size={18} />}
                        key={`${warning.code}:${index}`}
                      >
                        {formatWarning(warning)}
                      </Alert>
                    ))}
                  </Stack>
                ) : null}
                <Text c="dimmed" size="sm">
                  Подтвердить можно до {formatExpiresAt(preview.expiresAt)}.
                </Text>
                <SeriesImpactSummary impact={preview.impact} />
              </Stack>
            </Paper>
          ) : null}

          <Group className={footerClassName} grow>
            {preview ? (
              <Button
                leftSection={<IconEdit size={18} />}
                loading={submitting === 'execute'}
                onClick={() => void confirmChange()}
                type="button"
              >
                Сохранить изменение
              </Button>
            ) : (
              <Button
                leftSection={<IconEdit size={18} />}
                loading={submitting === 'preview'}
                type="submit"
              >
                {formError ? 'Обновить предпросмотр' : 'Получить предпросмотр'}
              </Button>
            )}
            <Button disabled={pending} onClick={cancel} type="button" variant="light">
              Отмена
            </Button>
          </Group>
        </Stack>
      </form>
  )
}

function buildInitialDraft(
  lesson: ScheduleLesson | null,
  scope: ScheduleLessonChangeRequest['scope'] = 'Occurrence',
): ChangeDraft {
  return {
    scope,
    newLessonDate: lesson?.lessonDate ?? '',
    startTime: trimSeconds(lesson?.startTime ?? ''),
    durationMinutes: lesson?.durationMinutes ?? '',
    hallId: lesson?.hallId ?? '',
  }
}

function toChangeRequest(
  draft: ChangeDraft,
  expectedRevision: string,
): ScheduleLessonChangeRequest {
  return {
    scope: draft.scope,
    newLessonDate: draft.newLessonDate,
    startTime: draft.startTime,
    durationMinutes: typeof draft.durationMinutes === 'number' ? draft.durationMinutes : null,
    hallId: draft.hallId || null,
    expectedRevision,
  }
}

function SeriesImpactSummary({
  impact,
}: {
  impact: ScheduleLessonChangePreviewResponse['impact']
}) {
  if (!impact) {
    return null
  }

  const skippedCount = impact.skipped.length

  return (
    <Stack gap="xs">
      <Text fw={800} size="sm">
        Область: {formatScopeLabel(impact.scope)}
      </Text>
      <Text c="dimmed" size="sm">
        Изменение применяется с {formatLessonDate(impact.startsOn)}.
        {impact.affectsFutureProjection ? ' Будущие занятия будут пересчитаны.' : ''}
      </Text>
      {skippedCount > 0 ? (
        <Alert color="yellow" icon={<IconAlertTriangle size={18} />}>
          Пропущено занятий: {skippedCount}. Первое: {formatLessonDate(impact.skipped[0].lessonDate)} — {formatSkippedReason(impact.skipped[0].reason)}.
        </Alert>
      ) : null}
    </Stack>
  )
}

function formatScopeLabel(scope: ScheduleLessonChangeRequest['scope']) {
  if (scope === 'ThisAndFuture') {
    return 'с этого дня'
  }

  if (scope === 'EntireSeries') {
    return 'вся серия'
  }

  return 'только это занятие'
}

function formatSkippedReason(reason: string) {
  return formatScheduleProblemCode(reason) ??
    formatScheduleActionUnavailableReason(reason)
}

function mergeCurrentHall(
  hallOptions: Array<{ value: string; label: string }>,
  lesson: ScheduleLesson,
) {
  if (hallOptions.some((option) => option.value === lesson.hallId)) {
    return hallOptions
  }

  return [{ value: lesson.hallId, label: lesson.hallName }, ...hallOptions]
}

function formatWarning(warning: ScheduleWarning) {
  return warning.message || formatScheduleActionUnavailableReason(warning.code)
}

function formatTimeRange(lesson: ScheduleLesson) {
  return `${trimSeconds(lesson.startTime)}-${trimSeconds(lesson.endTime)}`
}

function trimSeconds(value: string) {
  return value.match(/^\d{2}:\d{2}/)?.[0] ?? value
}

function formatLessonDate(date: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(parseIsoDate(date))
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatExpiresAt(value: string) {
  const expiresAt = new Date(value)
  if (Number.isNaN(expiresAt.getTime())) {
    return 'окончания срока предпросмотра'
  }

  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(expiresAt)
}
