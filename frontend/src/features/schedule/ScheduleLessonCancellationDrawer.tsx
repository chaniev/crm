import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Drawer,
  Group,
  Paper,
  Stack,
  Text,
} from '@mantine/core'
import { IconAlertTriangle, IconBan, IconRefresh } from '@tabler/icons-react'
import {
  ApiError,
  applyScheduleLessonCancellation,
  previewScheduleLessonCancellation,
  type ScheduleLesson,
  type ScheduleLessonCancellationAction,
  type ScheduleLessonCancellationPreviewResponse,
  type ScheduleLessonCancellationRequest,
} from '../../lib/api'
import { formatScheduleProblemCode } from './scheduleActionReasons'

type ScheduleLessonCancellationDrawerProps = {
  action: ScheduleLessonCancellationAction | null
  lesson: ScheduleLesson | null
  opened: boolean
  onCancelledOrRestored: (lesson: ScheduleLesson) => void
  onClose: () => void
}

const GENERIC_CANCELLATION_ERROR =
  'Не удалось проверить действие с занятием. Обновите предпросмотр и попробуйте снова.'

export function ScheduleLessonCancellationDrawer({
  action,
  lesson,
  opened,
  onCancelledOrRestored,
  onClose,
}: ScheduleLessonCancellationDrawerProps) {
  const [preview, setPreview] = useState<ScheduleLessonCancellationPreviewResponse | null>(null)
  const [submitting, setSubmitting] = useState<'preview' | 'execute' | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!opened) {
      return
    }

    setPreview(null)
    setFormError(null)
    setSubmitting(null)
  }, [lesson, opened, action])

  const request = useMemo<ScheduleLessonCancellationRequest | null>(() => {
    if (!lesson || !action) {
      return null
    }

    return {
      action,
      expectedRevision: lesson.revision,
    }
  }, [action, lesson])

  if (!lesson || !action || !request) {
    return null
  }

  const pending = submitting !== null
  const copy = getActionCopy(action)

  async function submitPreview() {
    if (!lesson || !request) {
      return
    }

    setSubmitting('preview')
    setFormError(null)

    try {
      const response = await previewScheduleLessonCancellation(
        lesson.lessonOccurrenceId,
        lesson.lessonDate,
        request,
      )
      setPreview(response)
    } catch (error) {
      handleFormError(error)
    } finally {
      setSubmitting(null)
    }
  }

  async function confirmAction() {
    if (!lesson || !request || !preview) {
      return
    }

    setSubmitting('execute')
    setFormError(null)

    try {
      const changed = await applyScheduleLessonCancellation(
        lesson.lessonOccurrenceId,
        lesson.lessonDate,
        {
          ...request,
          confirmationToken: preview.confirmationToken,
        },
      )
      setPreview(null)
      onCancelledOrRestored(changed)
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
    setPreview(null)

    if (error instanceof ApiError) {
      setFormError(formatScheduleProblemCode(error.code) ?? GENERIC_CANCELLATION_ERROR)
      return
    }

    setFormError(GENERIC_CANCELLATION_ERROR)
  }

  return (
    <Drawer
      className="schedule-cancellation-drawer"
      onClose={onClose}
      opened={opened}
      position="bottom"
      size="auto"
      title={copy.title}
      withinPortal
    >
      <Stack gap="md">
        <Stack gap={4}>
          <Text fw={900}>{lesson.groupName}</Text>
          <Text c="dimmed" size="sm">
            {formatLessonDate(lesson.lessonDate)} · {formatTimeRange(lesson)}
          </Text>
          <Text c="dimmed" size="sm">
            {lesson.hallName} · {lesson.branchName}
          </Text>
        </Stack>

        <Group gap="xs" wrap="wrap">
          <Badge color={lesson.status === 'Cancelled' ? 'gray' : 'green'} variant="light">
            {lesson.status === 'Cancelled' ? 'Отменено' : 'Запланировано'}
          </Badge>
          {lesson.hasAttendanceMarks ? <Badge color="teal" variant="light">Отметки есть</Badge> : null}
        </Group>

        <Alert color={copy.color} icon={copy.icon}>
          {copy.description}
        </Alert>

        {formError ? (
          <Alert color="yellow" icon={<IconAlertTriangle size={18} />}>
            {formError}
          </Alert>
        ) : null}

        {preview ? (
          <Paper className="schedule-cancellation-preview" radius="md" withBorder>
            <Stack gap="sm">
              <Stack gap={2}>
                <Text fw={900}>Проверьте действие перед подтверждением</Text>
                <Text c="dimmed" size="sm">
                  {preview.lesson.groupName} · {formatLessonDate(preview.lesson.lessonDate)} · {formatTimeRange(preview.lesson)}
                </Text>
                <Text c="dimmed" size="sm">
                  После подтверждения: {preview.lesson.status === 'Cancelled' ? 'занятие отменено' : 'занятие восстановлено'}
                </Text>
              </Stack>
              <Text c="dimmed" size="sm">
                Подтвердить можно до {formatExpiresAt(preview.expiresAt)}.
              </Text>
            </Stack>
          </Paper>
        ) : null}

        <Group className="schedule-cancellation-drawer__footer" grow>
          {preview ? (
            <Button
              color={copy.color}
              leftSection={copy.icon}
              loading={submitting === 'execute'}
              onClick={() => void confirmAction()}
              type="button"
            >
              {copy.confirmLabel}
            </Button>
          ) : (
            <Button
              color={copy.color}
              leftSection={copy.icon}
              loading={submitting === 'preview'}
              onClick={() => void submitPreview()}
              type="button"
            >
              {formError ? 'Обновить предпросмотр' : 'Получить предпросмотр'}
            </Button>
          )}
          <Button disabled={pending} onClick={onClose} type="button" variant="light">
            Отмена
          </Button>
        </Group>
      </Stack>
    </Drawer>
  )
}

function getActionCopy(action: ScheduleLessonCancellationAction) {
  if (action === 'Restore') {
    return {
      color: 'green',
      confirmLabel: 'Восстановить занятие',
      description: 'Занятие снова появится как запланированное. Проверьте точное занятие перед подтверждением.',
      icon: <IconRefresh size={18} />,
      title: 'Восстановить занятие',
    } as const
  }

  return {
    color: 'red',
    confirmLabel: 'Отменить занятие',
    description: 'Отменяется только это занятие. Если уже есть отметки посещаемости, сервер попросит сначала разобрать отметки.',
    icon: <IconBan size={18} />,
    title: 'Отменить занятие',
  } as const
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
