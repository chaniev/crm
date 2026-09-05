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
import { fe3ScheduleMutationsText } from '../../resources/fe-3-schedule-mutations'


type ScheduleLessonCancellationDrawerProps = {
  action: ScheduleLessonCancellationAction | null
  lesson: ScheduleLesson | null
  opened: boolean
  onCancelledOrRestored: (lesson: ScheduleLesson) => void
  onClose: () => void
}

const GENERIC_CANCELLATION_ERROR =
  fe3ScheduleMutationsText.scheduleLessonCancellationDrawer_gENERICCANCELLATIONERROR_d585b2a5

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
            {formatLessonDate(lesson.lessonDate)} {fe3ScheduleMutationsText.scheduleLessonCancellationDrawer_jsxText_a137f17a}{formatTimeRange(lesson)}
          </Text>
          <Text c="dimmed" size="sm">
            {lesson.hallName} {fe3ScheduleMutationsText.scheduleLessonCancellationDrawer_jsxText_a137f17a}{lesson.branchName}
          </Text>
        </Stack>

        <Group gap="xs" wrap="wrap">
          <Badge color={lesson.status === 'Cancelled' ? 'gray' : 'green'} variant="light">
            {lesson.status === 'Cancelled' ? fe3ScheduleMutationsText.scheduleLessonCancellationDrawer_string_23a2a9bf : fe3ScheduleMutationsText.scheduleLessonCancellationDrawer_string_c4c9abc1}
          </Badge>
          {lesson.hasAttendanceMarks ? <Badge color="teal" variant="light">{fe3ScheduleMutationsText.scheduleLessonCancellationDrawer_jsxText_0d7d0a5f}</Badge> : null}
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
                <Text fw={900}>{fe3ScheduleMutationsText.scheduleLessonCancellationDrawer_jsxText_756d6c50}</Text>
                <Text c="dimmed" size="sm">
                  {preview.lesson.groupName} {fe3ScheduleMutationsText.scheduleLessonCancellationDrawer_jsxText_a137f17a}{formatLessonDate(preview.lesson.lessonDate)} {fe3ScheduleMutationsText.scheduleLessonCancellationDrawer_jsxText_a137f17a}{formatTimeRange(preview.lesson)}
                </Text>
                <Text c="dimmed" size="sm">
                  {fe3ScheduleMutationsText.scheduleLessonCancellationDrawer_jsxText_8b575c5b}{preview.lesson.status === 'Cancelled' ? fe3ScheduleMutationsText.scheduleLessonCancellationDrawer_string_f6756db0 : fe3ScheduleMutationsText.scheduleLessonCancellationDrawer_string_2d57c90a}
                </Text>
              </Stack>
              <Text c="dimmed" size="sm">
                {fe3ScheduleMutationsText.scheduleLessonCancellationDrawer_jsxText_cce698e3}{formatExpiresAt(preview.expiresAt)}{fe3ScheduleMutationsText.scheduleLessonCancellationDrawer_jsxText_cdb4ee2a}</Text>
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
              {formError ? fe3ScheduleMutationsText.scheduleLessonCancellationDrawer_string_62b92aa4 : fe3ScheduleMutationsText.scheduleLessonCancellationDrawer_string_857a90c1}
            </Button>
          )}
          <Button disabled={pending} onClick={onClose} type="button" variant="light">
            {fe3ScheduleMutationsText.scheduleLessonCancellationDrawer_jsxText_8fbe9b75}</Button>
        </Group>
      </Stack>
    </Drawer>
  )
}

function getActionCopy(action: ScheduleLessonCancellationAction) {
  if (action === 'Restore') {
    return {
      color: 'green',
      confirmLabel: fe3ScheduleMutationsText.scheduleLessonCancellationDrawer_confirmLabel_b7179b95,
      description: fe3ScheduleMutationsText.scheduleLessonCancellationDrawer_description_06aebb09,
      icon: <IconRefresh size={18} />,
      title: fe3ScheduleMutationsText.scheduleLessonCancellationDrawer_confirmLabel_b7179b95,
    } as const
  }

  return {
    color: 'red',
    confirmLabel: fe3ScheduleMutationsText.scheduleLessonCancellationDrawer_confirmLabel_563bed0c,
    description: fe3ScheduleMutationsText.scheduleLessonCancellationDrawer_description_c3c2aa40,
    icon: <IconBan size={18} />,
    title: fe3ScheduleMutationsText.scheduleLessonCancellationDrawer_confirmLabel_563bed0c,
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
    return fe3ScheduleMutationsText.scheduleLessonCancellationDrawer_string_4371fe93
  }

  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(expiresAt)
}
