import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Drawer,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { IconAlertTriangle, IconCalendarPlus } from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  createScheduleOneOffLesson,
  previewScheduleOneOffLesson,
  type ScheduleLesson,
  type ScheduleOneOffLessonPreviewResponse,
  type ScheduleOneOffLessonRequest,
} from '../../lib/api'
import { formatScheduleProblemCode } from './scheduleActionReasons'
import { StickyFormActions } from '../shared/ux'

type ScheduleOneOffCreateDrawerProps = {
  defaultDate: string
  filterOptions: {
    groups: Array<{ value: string; label: string }>
    halls: Array<{ value: string; label: string }>
  }
  filters: {
    groupId: string | null
    hallId: string | null
  }
  opened: boolean
  onClose: () => void
  onCreated: (lesson: ScheduleLesson) => void
}

export type ScheduleOneOffCreateFormProps = Omit<
  ScheduleOneOffCreateDrawerProps,
  'opened' | 'onClose'
> & {
  active?: boolean
  footerClassName?: string
  onCancel: () => void
}

type OneOffDraft = {
  groupId: string
  lessonDate: string
  startTime: string
  durationMinutes: number | ''
  hallId: string
}

type OneOffFieldErrors = Partial<Record<keyof OneOffDraft, string>>

const FIELD_ALIASES = {
  groupId: 'groupId',
  lessonDate: 'lessonDate',
  startTime: 'startTime',
  durationMinutes: 'durationMinutes',
  hallId: 'hallId',
} satisfies Record<string, keyof OneOffDraft>

export function ScheduleOneOffCreateDrawer({
  defaultDate,
  filterOptions,
  filters,
  opened,
  onClose,
  onCreated,
}: ScheduleOneOffCreateDrawerProps) {
  return (
    <Drawer
      className="schedule-create-drawer"
      onClose={onClose}
      opened={opened}
      position="bottom"
      size="auto"
      title="Разовое занятие"
      withinPortal
    >
      <ScheduleOneOffCreateForm
        active={opened}
        defaultDate={defaultDate}
        filterOptions={filterOptions}
        filters={filters}
        footerClassName="schedule-create-drawer__footer"
        onCancel={onClose}
        onCreated={onCreated}
      />
    </Drawer>
  )
}

export function ScheduleOneOffCreateForm({
  active = true,
  defaultDate,
  filterOptions,
  filters,
  footerClassName,
  onCancel,
  onCreated,
}: ScheduleOneOffCreateFormProps) {
  const [draft, setDraft] = useState<OneOffDraft>(() =>
    buildInitialDraft(defaultDate, filterOptions, filters),
  )
  const [fieldErrors, setFieldErrors] = useState<OneOffFieldErrors>({})
  const [preview, setPreview] = useState<ScheduleOneOffLessonPreviewResponse | null>(null)
  const [submitting, setSubmitting] = useState<'preview' | 'execute' | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const groupRef = useRef<HTMLInputElement | null>(null)
  const dateRef = useRef<HTMLInputElement | null>(null)
  const timeRef = useRef<HTMLInputElement | null>(null)
  const durationRef = useRef<HTMLInputElement | null>(null)
  const hallRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!active) {
      return
    }

    setDraft((current) => {
      if (hasDraftInput(current)) {
        return current
      }

      return buildInitialDraft(defaultDate, filterOptions, filters)
    })
    setFieldErrors({})
    setFormError(null)
    setPreview(null)
    setDirty(false)
  }, [active, defaultDate, filterOptions, filters])

  const pending = submitting !== null
  const request = toOneOffRequest(draft)

  function updateDraft<Field extends keyof OneOffDraft>(
    field: Field,
    value: OneOffDraft[Field],
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
      const response = await previewScheduleOneOffLesson(request)
      setPreview(response)
    } catch (error) {
      handleFormError(error)
    } finally {
      setSubmitting(null)
    }
  }

  async function confirmCreate() {
    if (!preview) {
      return
    }

    setSubmitting('execute')
    setFieldErrors({})
    setFormError(null)

    try {
      const created = await createScheduleOneOffLesson({
        ...request,
        confirmationToken: preview.confirmationToken,
      })
      setDraft(buildInitialDraft(defaultDate, filterOptions, filters))
      setDirty(false)
      setPreview(null)
      onCreated(created)
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
        'Не удалось проверить разовое занятие. Проверьте поля и попробуйте снова.',
      )
      return
    }

    setFormError('Не удалось проверить разовое занятие.')
  }

  function focusFirstInvalidField(errors: OneOffFieldErrors) {
    const firstInvalid = (Object.keys(FIELD_ALIASES) as Array<keyof OneOffDraft>)
      .find((field) => errors[field])

    const refs = {
      groupId: groupRef,
      lessonDate: dateRef,
      startTime: timeRef,
      durationMinutes: durationRef,
      hallId: hallRef,
    }

    if (firstInvalid) {
      window.requestAnimationFrame(() => refs[firstInvalid].current?.focus())
    }
  }

  function cancel() {
    if (dirty && !window.confirm('Отменить создание занятия и потерять черновик?')) {
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
          <Select
            data={filterOptions.groups}
            error={fieldErrors.groupId}
            label="Группа"
            onChange={(value) => updateDraft('groupId', value ?? '')}
            placeholder="Выберите группу"
            ref={groupRef}
            searchable
            value={draft.groupId || null}
          />
          <Group align="flex-start" grow>
            <TextInput
              error={fieldErrors.lessonDate}
              label="Дата"
              max="9999-12-31"
              min="1900-01-01"
              onChange={(event) => updateDraft('lessonDate', event.currentTarget.value)}
              ref={dateRef}
              type="date"
              value={draft.lessonDate}
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
              data={filterOptions.halls}
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
            <Paper className="schedule-create-preview" radius="md" withBorder>
              <Stack gap="sm">
                <Stack gap={2}>
                  <Text fw={900}>Проверьте занятие перед созданием</Text>
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
                        {warning.message || 'Проверьте предупреждение перед подтверждением.'}
                      </Alert>
                    ))}
                  </Stack>
                ) : null}
                <Text c="dimmed" size="sm">
                  Подтвердить можно до {formatExpiresAt(preview.expiresAt)}.
                </Text>
              </Stack>
            </Paper>
          ) : null}

          <StickyFormActions
            className={footerClassName}
            surface={footerClassName?.includes('drawer') ? 'drawer' : 'page'}
            primaryAction={preview ? (
              <Button
                leftSection={<IconCalendarPlus size={18} />}
                loading={submitting === 'execute'}
                onClick={() => void confirmCreate()}
                type="button"
              >
                Создать занятие
              </Button>
            ) : (
              <Button
                leftSection={<IconCalendarPlus size={18} />}
                loading={submitting === 'preview'}
                type="submit"
              >
                {formError ? 'Обновить предпросмотр' : 'Получить предпросмотр'}
              </Button>
            )}
            secondaryAction={<Button disabled={pending} onClick={cancel} type="button" variant="light">
              Отмена
            </Button>}
          />
        </Stack>
      </form>
  )
}

function buildInitialDraft(
  defaultDate: string,
  filterOptions: ScheduleOneOffCreateDrawerProps['filterOptions'],
  filters: ScheduleOneOffCreateDrawerProps['filters'],
): OneOffDraft {
  return {
    groupId: filters.groupId && hasOption(filterOptions.groups, filters.groupId)
      ? filters.groupId
      : filterOptions.groups.length === 1
        ? filterOptions.groups[0].value
        : '',
    lessonDate: defaultDate,
    startTime: '12:00',
    durationMinutes: 60,
    hallId: filters.hallId && hasOption(filterOptions.halls, filters.hallId)
      ? filters.hallId
      : filterOptions.halls.length === 1
        ? filterOptions.halls[0].value
        : '',
  }
}

function hasDraftInput(draft: OneOffDraft) {
  return Boolean(
    draft.groupId ||
    draft.hallId ||
    draft.lessonDate ||
    draft.startTime ||
    draft.durationMinutes,
  )
}

function hasOption(options: Array<{ value: string }>, value: string) {
  return options.some((option) => option.value === value)
}

function toOneOffRequest(draft: OneOffDraft): ScheduleOneOffLessonRequest {
  return {
    groupId: draft.groupId || null,
    lessonDate: draft.lessonDate,
    startTime: draft.startTime,
    durationMinutes: typeof draft.durationMinutes === 'number' ? draft.durationMinutes : null,
    hallId: draft.hallId || null,
  }
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
