import { Title } from '@mantine/core'
import { IconArrowLeft, IconCalendar, IconClock } from '@tabler/icons-react'
import { useEffect, useRef } from 'react'
import type { ScheduleLesson } from '../../lib/api'
import { fe4AttendanceText as text } from '../../resources/fe-4-attendance'
import { Button, ErrorState, LoadingState, PageSection } from '../shared/ux'

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
})

export type AttendanceLessonContext =
  | { status: 'loading' | 'error' | 'unavailable' }
  | { status: 'ready'; lesson: ScheduleLesson }

type AttendanceLessonHeaderProps = {
  context: AttendanceLessonContext
  onBack?: () => void
  onRetry: () => void
  returnToSchedule: boolean
}

export function AttendanceLessonHeader({
  context, onBack, onRetry, returnToSchedule,
}: AttendanceLessonHeaderProps) {
  const heading = useRef<HTMLHeadingElement>(null)
  const retryRequested = useRef(false)

  useEffect(() => {
    if (context.status === 'ready' && (retryRequested.current || document.activeElement === document.body)) {
      heading.current?.focus({ preventScroll: true })
      retryRequested.current = false
    }
  }, [context.status])

  function renderIdentity() {
    switch (context.status) {
      case 'loading':
        return <LoadingState label={text.lessonLoading} />
      case 'unavailable':
        return <ErrorState title={text.lessonUnavailable} message={text.lessonChooseAnother} />
      case 'error':
        return (
          <ErrorState
            title={text.lessonLoadError}
            message={text.lessonRetryHint}
            action={
              <Button variant="secondary" onClick={() => {
                retryRequested.current = true
                onRetry()
              }}>
                {text.attendanceSaveStatus_jsxText_5189135a}
              </Button>
            }
          />
        )
      case 'ready': {
        const { groupName, lessonDate, startTime, endTime } = context.lesson
        const date = dateFormatter.format(new Date(lessonDate + 'T00:00:00Z')).replace(/\s*г\.$/, '')
        return (
          <>
            <Title order={1} ref={heading} tabIndex={-1}>{groupName}</Title>
            <div className="lesson-context__when">
              <span><IconCalendar aria-hidden="true" size={18} /><time dateTime={lessonDate}>{date}</time></span>
              <span><IconClock aria-hidden="true" size={18} />{startTime}–{endTime}</span>
            </div>
          </>
        )
      }
    }
  }

  return (
    <PageSection className="lesson-context" density="compact">
      {context.status !== 'ready' && <Title className="visually-hidden" order={1}>{text.attendanceScreen_jsxText_1c26bf07}</Title>}
      <div className="lesson-context__layout">
        <div className="lesson-context__identity">{renderIdentity()}</div>
        <Button className="lesson-context__back" variant="secondary" leftSection={<IconArrowLeft aria-hidden="true" size={18} />} onClick={onBack}>
          {returnToSchedule ? text.lessonBackToSchedule : text.lessonBackToToday}
        </Button>
      </div>
    </PageSection>
  )
}
