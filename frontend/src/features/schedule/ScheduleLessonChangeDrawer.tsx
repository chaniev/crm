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
import { StickyFormActions } from '../shared/ux'
import { fe3ScheduleMutationsText } from '../../resources/fe-3-schedule-mutations'


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
      title={fe3ScheduleMutationsText.scheduleLessonChangeDrawer_title_06a7be8a}
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
        fe3ScheduleMutationsText.scheduleLessonChangeDrawer_string_7242539b,
      )
      return
    }

    setFormError(fe3ScheduleMutationsText.scheduleLessonChangeDrawer_string_7242539b)
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
    if (dirty && !window.confirm(fe3ScheduleMutationsText.scheduleLessonChangeDrawer_windowConfirm_762d3769)) {
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
              {fe3ScheduleMutationsText.scheduleLessonChangeDrawer_jsxText_2aa98ec1}{formatLessonDate(lesson.lessonDate)} {fe3ScheduleMutationsText.scheduleLessonChangeDrawer_jsxText_a137f17a}{formatTimeRange(lesson)}
            </Text>
          </Stack>
          <SegmentedControl
            aria-label={fe3ScheduleMutationsText.scheduleLessonChangeDrawer_ariaLabel_594acbf8}
            data={[
              { value: 'Occurrence', label: fe3ScheduleMutationsText.scheduleLessonChangeDrawer_label_66e7112f },
              { value: 'ThisAndFuture', label: fe3ScheduleMutationsText.scheduleLessonChangeDrawer_label_eafa287c },
              { value: 'EntireSeries', label: fe3ScheduleMutationsText.scheduleLessonChangeDrawer_label_a2706736 },
            ]}
            disabled={lockScope}
            onChange={(value) =>
              updateDraft('scope', value as ScheduleLessonChangeRequest['scope'])}
            value={draft.scope}
          />
          {draft.scope !== 'Occurrence' ? (
            <Alert color="blue" icon={<IconAlertTriangle size={18} />}>
              {fe3ScheduleMutationsText.scheduleLessonChangeDrawer_jsxText_c26ffc1f}</Alert>
          ) : null}
          <Group align="flex-start" grow>
            <TextInput
              error={fieldErrors.newLessonDate}
              label={fe3ScheduleMutationsText.scheduleLessonChangeDrawer_label_232a0ead}
              max="9999-12-31"
              min="1900-01-01"
              onChange={(event) => updateDraft('newLessonDate', event.currentTarget.value)}
              ref={dateRef}
              type="date"
              value={draft.newLessonDate}
            />
            <TextInput
              error={fieldErrors.startTime}
              label={fe3ScheduleMutationsText.scheduleLessonChangeDrawer_label_6711f073}
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
              label={fe3ScheduleMutationsText.scheduleLessonChangeDrawer_label_2a326071}
              max={180}
              min={1}
              onChange={(value) =>
                updateDraft('durationMinutes', typeof value === 'number' ? value : '')
              }
              ref={durationRef}
              suffix={fe3ScheduleMutationsText.scheduleLessonChangeDrawer_suffix_84d5d93d}
              value={draft.durationMinutes}
            />
            <Select
              data={options}
              error={fieldErrors.hallId}
              label={fe3ScheduleMutationsText.scheduleLessonChangeDrawer_label_182f7c57}
              onChange={(value) => updateDraft('hallId', value ?? '')}
              placeholder={fe3ScheduleMutationsText.scheduleLessonChangeDrawer_placeholder_d52c67f8}
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
                  <Text fw={900}>{fe3ScheduleMutationsText.scheduleLessonChangeDrawer_jsxText_6cce5c5e}</Text>
                  <Text c="dimmed" size="sm">
                    {preview.lesson.groupName} {fe3ScheduleMutationsText.scheduleLessonChangeDrawer_jsxText_a137f17a}{formatLessonDate(preview.lesson.lessonDate)} {fe3ScheduleMutationsText.scheduleLessonChangeDrawer_jsxText_a137f17a}{formatTimeRange(preview.lesson)}
                  </Text>
                  <Text c="dimmed" size="sm">
                    {preview.lesson.hallName} {fe3ScheduleMutationsText.scheduleLessonChangeDrawer_jsxText_a137f17a}{preview.lesson.branchName}
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
                  {fe3ScheduleMutationsText.scheduleLessonChangeDrawer_jsxText_cce698e3}{formatExpiresAt(preview.expiresAt)}{fe3ScheduleMutationsText.scheduleLessonChangeDrawer_jsxText_cdb4ee2a}</Text>
                <SeriesImpactSummary impact={preview.impact} />
              </Stack>
            </Paper>
          ) : null}

          <StickyFormActions
            className={footerClassName}
            surface={footerClassName?.includes('drawer') ? 'drawer' : 'page'}
            primaryAction={preview ? (
              <Button
                leftSection={<IconEdit size={18} />}
                loading={submitting === 'execute'}
                onClick={() => void confirmChange()}
                type="button"
              >
                {fe3ScheduleMutationsText.scheduleLessonChangeDrawer_jsxText_3c2e873d}</Button>
            ) : (
              <Button
                leftSection={<IconEdit size={18} />}
                loading={submitting === 'preview'}
                type="submit"
              >
                {formError ? fe3ScheduleMutationsText.scheduleLessonChangeDrawer_string_62b92aa4 : fe3ScheduleMutationsText.scheduleLessonChangeDrawer_string_857a90c1}
              </Button>
            )}
            secondaryAction={<Button disabled={pending} onClick={cancel} type="button" variant="light">
              {fe3ScheduleMutationsText.scheduleLessonChangeDrawer_jsxText_8fbe9b75}</Button>}
          />
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
        {fe3ScheduleMutationsText.scheduleLessonChangeDrawer_jsxText_720752c6}{formatScopeLabel(impact.scope)}
      </Text>
      <Text c="dimmed" size="sm">
        {fe3ScheduleMutationsText.scheduleLessonChangeDrawer_jsxText_247c84d3}{formatLessonDate(impact.startsOn)}{fe3ScheduleMutationsText.scheduleLessonChangeDrawer_jsxText_cdb4ee2a}{impact.affectsFutureProjection ? fe3ScheduleMutationsText.scheduleLessonChangeDrawer_string_ab0f3256 : ''}
      </Text>
      {skippedCount > 0 ? (
        <Alert color="yellow" icon={<IconAlertTriangle size={18} />}>
          {fe3ScheduleMutationsText.scheduleLessonChangeDrawer_jsxText_ed0812c0}{skippedCount}{fe3ScheduleMutationsText.scheduleLessonChangeDrawer_jsxText_fc3d1d5a}{formatLessonDate(impact.skipped[0].lessonDate)} {fe3ScheduleMutationsText.scheduleLessonChangeDrawer_jsxText_bda05058}{formatSkippedReason(impact.skipped[0].reason)}{fe3ScheduleMutationsText.scheduleLessonChangeDrawer_jsxText_cdb4ee2a}</Alert>
      ) : null}
    </Stack>
  )
}

function formatScopeLabel(scope: ScheduleLessonChangeRequest['scope']) {
  if (scope === 'ThisAndFuture') {
    return fe3ScheduleMutationsText.scheduleLessonChangeDrawer_string_9d63ad76
  }

  if (scope === 'EntireSeries') {
    return fe3ScheduleMutationsText.scheduleLessonChangeDrawer_string_648188fd
  }

  return fe3ScheduleMutationsText.scheduleLessonChangeDrawer_string_5e90afd8
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
    return fe3ScheduleMutationsText.scheduleLessonChangeDrawer_string_4371fe93
  }

  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(expiresAt)
}
