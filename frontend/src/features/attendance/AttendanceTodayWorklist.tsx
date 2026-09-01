import { useEffect, useRef, useState } from 'react'
import { Alert, Stack, Text } from '@mantine/core'
import { IconAlertTriangle, IconCalendarCheck } from '@tabler/icons-react'
import {
  ApiError,
  getAttendanceTodayLessons,
  type AttendanceTodayLesson,
} from '../../lib/api'
import { resources } from '../../lib/resources'
import { Button } from '../shared/Button'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageSection,
  TaskToolbarActions,
  TaskToolbarRefreshAction,
} from '../shared/ux'
import {
  readAttendanceTodayReturnSnapshot,
  withAttendanceTodayReturnSnapshot,
  withoutAttendanceTodayReturnSnapshot,
} from './attendanceTodayReturnState'

type AttendanceTodayWorklistProps = {
  onOpenLesson: (lessonOccurrenceId: string, lessonDate: string) => void
}

export function AttendanceTodayWorklist({ onOpenLesson }: AttendanceTodayWorklistProps) {
  const [lessons, setLessons] = useState<AttendanceTodayLesson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [partial, setPartial] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const returnSnapshotRef = useRef(readAttendanceTodayReturnSnapshot())

  useEffect(() => {
    const controller = new AbortController()

    void getAttendanceTodayLessons(controller.signal)
      .then((response) => {
        setLessons(response.items)
        setPartial(response.partial)
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) {
          return
        }

        setLessons([])
        setPartial(false)
        setError(
          loadError instanceof ApiError
            ? loadError.message
            : resources.attendance.today.loadingErrorMessage,
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [reloadKey])

  useEffect(() => {
    const snapshot = returnSnapshotRef.current
    if (loading || !snapshot) {
      return
    }

    returnSnapshotRef.current = null
    const availableIds = new Set(lessons.map((lesson) => lesson.lessonOccurrenceId))
    const focusId = availableIds.has(snapshot.anchorLessonOccurrenceId)
      ? snapshot.anchorLessonOccurrenceId
      : snapshot.nextLessonOccurrenceId && availableIds.has(snapshot.nextLessonOccurrenceId)
        ? snapshot.nextLessonOccurrenceId
        : lessons[0]?.lessonOccurrenceId ?? null

    window.history.replaceState(
      withoutAttendanceTodayReturnSnapshot(window.history.state),
      '',
      `${window.location.pathname}${window.location.search}${window.location.hash}`,
    )

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: snapshot.scrollY })
      const target = focusId
        ? document.getElementById(`attendance-today-row-${focusId}`)
        : document.querySelector<HTMLElement>('[data-testid="attendance-today-refresh"]')
      target?.focus({ preventScroll: true })
    })
  }, [lessons, loading])

  const refresh = () => {
    setLoading(true)
    setError(null)
    setPartial(false)
    setReloadKey((key) => key + 1)
  }

  const openLesson = (lesson: AttendanceTodayLesson, index: number) => {
    window.history.replaceState(
      withAttendanceTodayReturnSnapshot(window.history.state, {
        version: 1,
        anchorLessonOccurrenceId: lesson.lessonOccurrenceId,
        nextLessonOccurrenceId: lessons[index + 1]?.lessonOccurrenceId ?? null,
        scrollY: Math.max(0, window.scrollY),
      }),
      '',
      `${window.location.pathname}${window.location.search}${window.location.hash}`,
    )
    onOpenLesson(lesson.lessonOccurrenceId, lesson.lessonDate)
  }

  return (
    <PageSection className="attendance-today-section" variant="plain">
      <Stack gap="md">
        <TaskToolbarActions
          className="attendance-today-toolbar"
          frequentActions={(
            <TaskToolbarRefreshAction
              data-testid="attendance-today-refresh"
              label={resources.attendance.today.refresh}
              loading={loading}
              onClick={refresh}
            />
          )}
        />

        {partial ? (
          <Alert
            color="yellow"
            icon={<IconAlertTriangle size={18} />}
            role="alert"
            title={resources.attendance.today.partialTitle}
          >
            <Stack gap="sm">
              <Text size="sm">{resources.attendance.today.partialMessage}</Text>
              <Button onClick={refresh} variant="secondary">
                {resources.attendance.today.retry}
              </Button>
            </Stack>
          </Alert>
        ) : null}

        {loading ? (
          <LoadingState label={resources.attendance.today.loading} />
        ) : error ? (
          <ErrorState
            action={<Button onClick={refresh} variant="secondary">{resources.attendance.today.retry}</Button>}
            message={error}
            title={resources.attendance.today.loadingErrorTitle}
          />
        ) : lessons.length === 0 ? (
          <EmptyState
            description={resources.attendance.today.emptyDescription}
            icon={<IconCalendarCheck size={24} />}
            title={resources.attendance.today.emptyTitle}
          />
        ) : (
          <div
            aria-label={resources.attendance.today.listLabel}
            className="attendance-today-list"
            role="list"
          >
            <div aria-hidden="true" className="attendance-today-list__header">
              <span>{resources.attendance.today.columns.time}</span>
              <span>{resources.attendance.today.columns.group}</span>
              <span>{resources.attendance.today.columns.details}</span>
              <span>{resources.attendance.today.columns.remaining}</span>
              <span>{resources.attendance.today.columns.action}</span>
            </div>
            {lessons.map((lesson, index) => (
              <AttendanceTodayRow
                key={lesson.lessonOccurrenceId}
                lesson={lesson}
                onOpen={() => openLesson(lesson, index)}
              />
            ))}
          </div>
        )}
      </Stack>
    </PageSection>
  )
}

function AttendanceTodayRow({
  lesson,
  onOpen,
}: {
  lesson: AttendanceTodayLesson
  onOpen: () => void
}) {
  const trainers = lesson.effectiveTrainers.map((trainer) => trainer.fullName).join(', ')

  return (
    <article
      className="attendance-today-row"
      data-attendance-today-row={lesson.lessonOccurrenceId}
      data-testid={`attendance-today-row-${lesson.lessonOccurrenceId}`}
      id={`attendance-today-row-${lesson.lessonOccurrenceId}`}
      role="listitem"
      tabIndex={-1}
    >
      <Text className="attendance-today-row__time" fw={800}>
        {lesson.startTime}–{lesson.endTime}
      </Text>
      <Text className="attendance-today-row__group" fw={800}>
        {lesson.groupName}
      </Text>
      <div className="attendance-today-row__details">
        <Text size="sm">{lesson.branchName} · {lesson.hallName}</Text>
        <Text c="dimmed" size="sm">{trainers}</Text>
      </div>
      <Text className="attendance-today-row__count" fw={700} size="sm">
        {resources.attendance.today.unmarkedCount} {lesson.unmarkedClientCount}
      </Text>
      <Button
        aria-label={`${resources.attendance.today.open}: ${lesson.groupName}, ${lesson.startTime}`}
        className="attendance-today-row__action"
        onClick={onOpen}
        variant="secondary"
      >
        {resources.attendance.today.open}
      </Button>
    </article>
  )
}
