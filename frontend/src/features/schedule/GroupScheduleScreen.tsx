import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react'
import {
  ActionIcon,
  Badge,
  Button,
  Drawer,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import {
  IconBan,
  IconCalendarEvent,
  IconChevronLeft,
  IconChevronRight,
  IconEdit,
  IconPlus,
  IconRefresh,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react'
import {
  getScheduleLessons,
  getScheduleLesson,
  type ScheduleAction,
  type ScheduleLesson,
  type ScheduleLessonCancellationAction,
  type UserRole,
} from '../../lib/api'
import { resources } from '../../lib/resources'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
} from '../shared/ux'
import { ScheduleLessonChangeForm } from './ScheduleLessonChangeDrawer'
import { ScheduleLessonCancellationDrawer } from './ScheduleLessonCancellationDrawer'
import { ScheduleOneOffCreateForm } from './ScheduleOneOffCreateDrawer'
import {
  formatScheduleActionUnavailableReason,
} from './scheduleActionReasons'
import { readScheduleReturnSnapshot } from './scheduleReturnState'
import {
  buildScheduleTimeGroups,
  getScheduleCardAnchorId,
} from './scheduleTimeGroups'
import {
  buildScheduleDeferredActions,
} from './scheduleDeferredActions'
import {
  ScheduleMoreActionsSurface,
} from './ScheduleMoreActionsSurface'
import { fe2ScheduleCoreText } from '../../resources/fe-2-schedule-core'
import { useScheduleUrlState } from './useScheduleUrlState'
import { useScheduleCalendar } from './useScheduleCalendar'
import {
  EMPTY_FILTERS,
  countActiveFilters,
  type ScheduleFilters,
  type ScheduleUrlState,
  type ScheduleViewMode,
} from './scheduleUrlState'
import { ScheduleTrainerSubstitutionDrawer } from './ScheduleTrainerSubstitutionDrawer'
import { emptyFilterOptions, mapResponseFilterOptions, type FilterOption } from './scheduleFilterOptions'
import {
  addIsoDays,
  formatLongDate,
  formatLongWeekday,
  formatShortDate,
  formatTimeRange,
  formatWeekday,
  isRealIsoDate,
  todayIso,
} from './scheduleDateTime'

export { ScheduleSeriesEditScreen } from './ScheduleSeriesEditScreen'


type GroupScheduleScreenProps = {
  canManageGroups: boolean
  onEditGroup: (groupId: string) => void
  onCreateLesson: () => void
  onEditLesson: (lessonOccurrenceId: string, lessonDate: string) => void
  onMoveLesson: (lessonOccurrenceId: string, lessonDate: string) => void
  onEditSeries: (lesson: ScheduleLesson, scope: 'this-and-future' | 'entire') => void
  onOpenAttendance: (lessonOccurrenceId: string, lessonDate: string) => void
  onOpenLessonDetail: (lessonOccurrenceId: string, lessonDate: string) => void
  viewerRole: UserRole
}

type ScheduleLessonDetailScreenProps = {
  lessonOccurrenceId: string
  lessonDate: string
  onEditLesson: (lessonOccurrenceId: string, lessonDate: string) => void
  onMoveLesson: (lessonOccurrenceId: string, lessonDate: string) => void
  onEditSeries: (lesson: ScheduleLesson, scope: 'this-and-future' | 'entire') => void
  onOpenAttendance: (lessonOccurrenceId: string, lessonDate: string) => void
  onOpenLessonDetail: (lessonOccurrenceId: string, lessonDate: string) => void
}

export function GroupScheduleScreen({
  onCreateLesson,
  onEditLesson,
  onEditSeries,
  onMoveLesson,
  onOpenAttendance,
  onOpenLessonDetail,
  viewerRole,
}: GroupScheduleScreenProps) {
  const { urlState, applyState } = useScheduleUrlState()
  const {
    lessons, capabilities, filterOptions, loading, refreshing, error, range, refresh,
  } = useScheduleCalendar(urlState)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [cancellationTarget, setCancellationTarget] = useState<{
    action: ScheduleLessonCancellationAction
    lesson: ScheduleLesson
  } | null>(null)
  const [substitutionTarget, setSubstitutionTarget] = useState<{
    action: 'Assign' | 'Cancel'
    lesson: ScheduleLesson
  } | null>(null)
  const toolsTriggerRef = useRef<HTMLButtonElement | null>(null)
  const createTriggerRef = useRef<HTMLButtonElement | null>(null)

  const restoredEntryKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (loading) {
      return
    }

    const snapshot = readScheduleReturnSnapshot(window.history.state)
    if (!snapshot || restoredEntryKeyRef.current === snapshot.originEntryKey) {
      return
    }

    restoredEntryKeyRef.current = snapshot.originEntryKey
    window.scrollTo({ top: snapshot.scrollY })
    if (snapshot.focusTarget === 'card' && snapshot.cardAnchorId) {
      document.getElementById(snapshot.cardAnchorId)?.focus()
    }
  }, [loading])

  const activeFilterCount = countActiveFilters(urlState)
  const activeFilters = activeFilterCount > 0
  const createOneOffAllowed = capabilities?.createOneOff.allowed === true
  const visibleLessons = useMemo(
    () => lessons.filter((lesson) =>
      urlState.view === 'week' || lesson.lessonDate === urlState.date,
    ),
    [lessons, urlState.date, urlState.view],
  )
  const days = useMemo(
    () => buildScheduleDays(range.from, range.to, lessons),
    [lessons, range.from, range.to],
  )
  const hasStaleLessons = lessons.length > 0

  function moveBy(deltaDays: number) {
    applyState({ date: addIsoDays(urlState.date, deltaDays) })
  }

  function goToday() {
    applyState({ date: todayIso() })
    setToolsOpen(false)
  }

  function setView(view: string) {
    if (view !== 'day' && view !== 'week') {
      return
    }

    applyState({ view })
    setToolsOpen(false)
  }

  function resetFilters() {
    applyState(EMPTY_FILTERS)
  }

  const toolbar = (
    <ScheduleToolbar
      createCapabilityState={getCreateCapabilityState(capabilities)}
      date={urlState.date}
      disabled={loading || refreshing}
      onCreate={createOneOffAllowed ? onCreateLesson : null}
      onDateChange={(date) => applyState({ date })}
      onNext={() => moveBy(urlState.view === 'week' ? 7 : 1)}
      onPrevious={() => moveBy(urlState.view === 'week' ? -7 : -1)}
      createTriggerRef={createTriggerRef}
      view={urlState.view}
    />
  )

  const daySummary = (
    <div className="schedule-day-summary" data-testid="schedule-day-summary">
      <Text className="schedule-day-summary__weekday" fw={800}>
        {urlState.view === 'day' ? formatLongDate(urlState.date) : formatLongWeekday(urlState.date)}
      </Text>
      <Badge className="schedule-day-summary__count" variant="light">
        {formatLessonCount(visibleLessons.length)}
      </Badge>
      <Button
        aria-label={
          activeFilterCount > 0
            ? fe2ScheduleCoreText.groupScheduleScreen_template_99ecdb89(activeFilterCount)
            : fe2ScheduleCoreText.groupScheduleScreen_string_1d51e161
        }
        className="schedule-day-summary__filter"
        data-active={activeFilterCount > 0 ? 'true' : undefined}
        data-target-size="44"
        data-testid="schedule-tools-trigger"
        onClick={() => setToolsOpen(true)}
        ref={toolsTriggerRef}
        type="button"
        variant="light"
        leftSection={<IconSettings size={18} />}
      >
        {fe2ScheduleCoreText.groupScheduleScreen_jsxText_a69757b1}{activeFilterCount > 0 ? (
          <span className="schedule-day-summary__filter-count">{activeFilterCount}</span>
        ) : null}
      </Button>
    </div>
  )

  return (
    <PageLayout
      className="schedule-screen"
      data-testid="schedule-screen"
      showHeader={false}
      title={fe2ScheduleCoreText.groupScheduleScreen_title_92431022}
    >
      {toolbar}
      {daySummary}

      <CalendarToolsSurface
        activeFilters={activeFilters}
        filterOptions={filterOptions}
        filters={urlState}
        opened={toolsOpen}
        onClose={() => {
          setToolsOpen(false)
          toolsTriggerRef.current?.focus()
        }}
        onFilterChange={(key, value) => applyState({ [key]: value } as Partial<ScheduleUrlState>)}
        onRefresh={() => {
          refresh()
          setToolsOpen(false)
        }}
        onResetFilters={resetFilters}
        onToday={goToday}
        onViewChange={setView}
        refreshDisabled={loading || refreshing}
        view={urlState.view}
      />

      <ScheduleLessonCancellationDrawer
        action={cancellationTarget?.action ?? null}
        lesson={cancellationTarget?.lesson ?? null}
        onCancelledOrRestored={(lesson) => {
          setCancellationTarget(null)
          onOpenLessonDetail(lesson.lessonOccurrenceId, lesson.lessonDate)
        }}
        onClose={() => setCancellationTarget(null)}
        opened={Boolean(cancellationTarget)}
      />
      <ScheduleTrainerSubstitutionDrawer
        action={substitutionTarget?.action ?? null}
        lesson={substitutionTarget?.lesson ?? null}
        onChanged={(lesson) => {
          setSubstitutionTarget(null)
          onOpenLessonDetail(lesson.lessonOccurrenceId, lesson.lessonDate)
        }}
        onClose={() => setSubstitutionTarget(null)}
        opened={Boolean(substitutionTarget)}
        trainerOptions={filterOptions.trainers}
      />

      {loading && lessons.length === 0 ? (
        <PageSection
          aria-busy="true"
          aria-label={fe2ScheduleCoreText.groupScheduleScreen_ariaLabel_b645736b}
          className="schedule-board--occurrences"
        >
          <div className="schedule-skeleton-list" data-testid="schedule-skeleton-list">
            {[0, 1, 2].map((index) => (
              <div
                className="schedule-skeleton"
                data-testid="schedule-card-skeleton"
                key={index}
              >
                <div className="schedule-skeleton__line schedule-skeleton__line--title" />
                <div className="schedule-skeleton__line" />
                <div className="schedule-skeleton__line schedule-skeleton__line--short" />
                <div className="schedule-skeleton__actions">
                  <div className="schedule-skeleton__action" />
                  <div className="schedule-skeleton__action" />
                </div>
              </div>
            ))}
          </div>
        </PageSection>
      ) : null}

      {error ? (
        <PageSection>
          <ErrorState
            action={<Button onClick={refresh} variant="light">{fe2ScheduleCoreText.groupScheduleScreen_jsxText_5189135a}</Button>}
            message={error}
            title={hasStaleLessons ? fe2ScheduleCoreText.groupScheduleScreen_string_7ee7c6c8 : fe2ScheduleCoreText.groupScheduleScreen_string_4edf0ecf}
          />
        </PageSection>
      ) : null}

      {error && hasStaleLessons && !loading ? (
        <Text
          className="schedule-stale-banner"
          c="dimmed"
          data-testid="schedule-stale-banner"
          fw={700}
          size="sm"
        >
          {fe2ScheduleCoreText.groupScheduleScreen_jsxText_bd4bec1c}</Text>
      ) : null}

      {!loading && (!error || hasStaleLessons) ? (
        <PageSection
          aria-label={fe2ScheduleCoreText.groupScheduleScreen_ariaLabel_1be1fa3b}
          className="schedule-board schedule-board--occurrences"
          data-testid="schedule-board"
          density="compact"
        >
          {lessons.length === 0 ? (
            <ScheduleEmptyState
              activeFilters={activeFilters}
              viewerRole={viewerRole}
            />
          ) : visibleLessons.length === 0 ? (
            <ScheduleDayList
              date={urlState.date}
              lessons={[]}
              onCancelOrRestoreLesson={(lesson, action) =>
                setCancellationTarget({ lesson, action })}
              onChangeLesson={(lesson) => onEditLesson(lesson.lessonOccurrenceId, lesson.lessonDate)}
              onEditSeries={onEditSeries}
              onMoveLesson={(lesson) => onMoveLesson(lesson.lessonOccurrenceId, lesson.lessonDate)}
              onOpenDetail={onOpenLessonDetail}
              onOpenAttendance={onOpenAttendance}
              onTrainerSubstitution={(lesson, action) =>
                setSubstitutionTarget({ lesson, action })}
              title={null}
            />
          ) : urlState.view === 'day' ? (
            <ScheduleDayList
              date={urlState.date}
              lessons={visibleLessons}
              onCancelOrRestoreLesson={(lesson, action) =>
                setCancellationTarget({ lesson, action })}
              onChangeLesson={(lesson) => onEditLesson(lesson.lessonOccurrenceId, lesson.lessonDate)}
              onEditSeries={onEditSeries}
              onMoveLesson={(lesson) => onMoveLesson(lesson.lessonOccurrenceId, lesson.lessonDate)}
              onOpenDetail={onOpenLessonDetail}
              onOpenAttendance={onOpenAttendance}
              onTrainerSubstitution={(lesson, action) =>
                setSubstitutionTarget({ lesson, action })}
              title={null}
            />
          ) : (
            <ScheduleWeekView
              days={days}
              onCancelOrRestoreLesson={(lesson, action) =>
                setCancellationTarget({ lesson, action })}
              onChangeLesson={(lesson) => onEditLesson(lesson.lessonOccurrenceId, lesson.lessonDate)}
              onEditSeries={onEditSeries}
              onMoveLesson={(lesson) => onMoveLesson(lesson.lessonOccurrenceId, lesson.lessonDate)}
              onOpenDetail={onOpenLessonDetail}
              onOpenAttendance={onOpenAttendance}
              onTrainerSubstitution={(lesson, action) =>
                setSubstitutionTarget({ lesson, action })}
            />
          )}
        </PageSection>
      ) : null}
    </PageLayout>
  )
}

export function ScheduleLessonDetailScreen({
  lessonDate,
  lessonOccurrenceId,
  onEditLesson,
  onEditSeries,
  onMoveLesson,
  onOpenAttendance,
  onOpenLessonDetail,
}: ScheduleLessonDetailScreenProps) {
  const [lesson, setLesson] = useState<ScheduleLesson | null>(null)
  const [filterOptions, setFilterOptions] = useState(() => emptyFilterOptions())
  const [cancellationAction, setCancellationAction] =
    useState<ScheduleLessonCancellationAction | null>(null)
  const [substitutionAction, setSubstitutionAction] = useState<'Assign' | 'Cancel' | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadLesson() {
      setLoading(true)
      setError(null)

      try {
        const [response, optionsResponse] = await Promise.all([
          getScheduleLesson(
            lessonOccurrenceId,
            lessonDate,
            controller.signal,
          ),
          getScheduleLessons({
            from: lessonDate,
            to: lessonDate,
          }, controller.signal),
        ])

        if (!controller.signal.aborted) {
          setLesson(response)
          setFilterOptions(mapResponseFilterOptions(optionsResponse.filterOptions))
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : fe2ScheduleCoreText.groupScheduleScreen_string_314ea9f7)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadLesson()

    return () => controller.abort()
  }, [lessonDate, lessonOccurrenceId])

  return (
    <PageLayout
      className="schedule-screen"
      data-testid="schedule-lesson-detail-screen"
      showHeader
      title={fe2ScheduleCoreText.groupScheduleScreen_title_56995ff3}
    >
      {loading ? (
        <PageSection>
          <LoadingState label={fe2ScheduleCoreText.groupScheduleScreen_label_ef0c9403} />
        </PageSection>
      ) : null}
      {error ? (
        <PageSection>
          <ErrorState message={error} title={fe2ScheduleCoreText.groupScheduleScreen_title_c2de061e} />
        </PageSection>
      ) : null}
      {lesson ? (
        <PageSection>
          <Stack gap="md">
            <Stack gap={4}>
              <Text fw={900} size="xl">{lesson.groupName}</Text>
              <Text c="dimmed" fw={700}>
                {formatLongDate(lesson.lessonDate)} {fe2ScheduleCoreText.groupScheduleScreen_jsxText_a137f17a}{formatTimeRange(lesson)}
              </Text>
            </Stack>
            <Group gap="xs" wrap="wrap">
              {lesson.status === 'Cancelled' ? <Badge color="gray">{fe2ScheduleCoreText.groupScheduleScreen_jsxText_23a2a9bf}</Badge> : null}
              {lesson.hasAttendanceMarks ? <Badge color="teal">{fe2ScheduleCoreText.groupScheduleScreen_jsxText_0d7d0a5f}</Badge> : null}
              <Badge variant="light">{lesson.groupTypeName}</Badge>
            </Group>
            <Text>{lesson.hallName} {fe2ScheduleCoreText.groupScheduleScreen_jsxText_a137f17a}{lesson.branchName}</Text>
            <Text>{formatEffectiveTrainers(lesson)}</Text>
            <Group gap="sm" wrap="wrap">
              {lesson.allowedActions.edit.allowed ? (
                <Button
                  leftSection={<IconEdit size={18} />}
                  onClick={() => onEditLesson(lesson.lessonOccurrenceId, lesson.lessonDate)}
                  type="button"
                  variant="light"
                >
                  {fe2ScheduleCoreText.groupScheduleScreen_jsxText_b8b151d4}</Button>
              ) : null}
              {lesson.allowedActions.move.allowed ? (
                <Button
                  leftSection={<IconChevronRight size={18} />}
                  onClick={() => onMoveLesson(lesson.lessonOccurrenceId, lesson.lessonDate)}
                  type="button"
                  variant="light"
                >
                  {fe2ScheduleCoreText.groupScheduleScreen_jsxText_758cc605}</Button>
              ) : null}
              {lesson.lessonSeriesId && lesson.allowedActions.edit.allowed ? (
                <Button
                  leftSection={<IconSettings size={18} />}
                  onClick={() => onEditSeries(lesson, 'this-and-future')}
                  type="button"
                  variant="light"
                >
                  {fe2ScheduleCoreText.groupScheduleScreen_jsxText_a7bdff84}</Button>
              ) : null}
              {lesson.allowedActions.assignTrainerSubstitution.allowed ? (
                <Button
                  leftSection={<IconUsers size={18} />}
                  onClick={() => setSubstitutionAction('Assign')}
                  type="button"
                  variant="light"
                >
                  {fe2ScheduleCoreText.groupScheduleScreen_jsxText_9b994009}</Button>
              ) : null}
              {lesson.allowedActions.cancelTrainerSubstitution.allowed ? (
                <Button
                  leftSection={<IconRefresh size={18} />}
                  onClick={() => setSubstitutionAction('Cancel')}
                  type="button"
                  variant="light"
                >
                  {fe2ScheduleCoreText.groupScheduleScreen_jsxText_ab7a9be4}</Button>
              ) : null}
              {lesson.allowedActions.cancel.allowed ? (
                <Button
                  color="red"
                  leftSection={<IconBan size={18} />}
                  onClick={() => setCancellationAction('Cancel')}
                  type="button"
                  variant="light"
                >
                  {fe2ScheduleCoreText.groupScheduleScreen_jsxText_7c47f729}</Button>
              ) : null}
              {lesson.allowedActions.restore.allowed ? (
                <Button
                  color="green"
                  leftSection={<IconRefresh size={18} />}
                  onClick={() => setCancellationAction('Restore')}
                  type="button"
                  variant="light"
                >
                  {fe2ScheduleCoreText.groupScheduleScreen_jsxText_76f55a98}</Button>
              ) : null}
              <Button
                disabled={!lesson.allowedActions.viewAttendance.allowed}
                leftSection={<IconUsers size={18} />}
                onClick={() => onOpenAttendance(lesson.lessonOccurrenceId, lesson.lessonDate)}
              >
                {fe2ScheduleCoreText.groupScheduleScreen_jsxText_9a72d56b}</Button>
            </Group>
          </Stack>
        </PageSection>
      ) : null}
      <ScheduleLessonCancellationDrawer
        action={cancellationAction}
        lesson={lesson}
        onCancelledOrRestored={(changedLesson) => {
          setCancellationAction(null)
          setLesson(changedLesson)
          onOpenLessonDetail(changedLesson.lessonOccurrenceId, changedLesson.lessonDate)
        }}
        onClose={() => setCancellationAction(null)}
        opened={Boolean(cancellationAction)}
      />
      <ScheduleTrainerSubstitutionDrawer
        action={substitutionAction}
        lesson={lesson}
        onChanged={(changedLesson) => {
          setSubstitutionAction(null)
          setLesson(changedLesson)
          onOpenLessonDetail(changedLesson.lessonOccurrenceId, changedLesson.lessonDate)
        }}
        onClose={() => setSubstitutionAction(null)}
        opened={Boolean(substitutionAction)}
        trainerOptions={filterOptions.trainers}
      />
    </PageLayout>
  )
}

export function ScheduleLessonCreateScreen({
  onBack,
  onCreated,
}: {
  onBack: () => void
  onCreated: (lesson: ScheduleLesson) => void
}) {
  const [filterOptions, setFilterOptions] = useState(() => emptyFilterOptions())
  const [createAllowed, setCreateAllowed] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const defaultDate = todayIso()

  useEffect(() => {
    const controller = new AbortController()

    async function loadOptions() {
      setLoading(true)
      setError(null)

      try {
        const response = await getScheduleLessons({
          from: defaultDate,
          to: defaultDate,
        }, controller.signal)

        if (!controller.signal.aborted) {
          setFilterOptions(mapResponseFilterOptions(response.filterOptions))
          setCreateAllowed(response.capabilities.createOneOff.allowed)
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : fe2ScheduleCoreText.groupScheduleScreen_string_d993628b)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadOptions()

    return () => controller.abort()
  }, [defaultDate])

  return (
    <PageLayout
      className="schedule-screen"
      data-testid="schedule-lesson-create-screen"
      showHeader
      title={fe2ScheduleCoreText.groupScheduleScreen_title_4196b8be}
    >
      {loading ? (
        <PageSection>
          <LoadingState label={fe2ScheduleCoreText.groupScheduleScreen_label_45868810} />
        </PageSection>
      ) : null}
      {error ? (
        <PageSection>
          <ErrorState message={error} title={fe2ScheduleCoreText.groupScheduleScreen_title_3ea07537} />
        </PageSection>
      ) : null}
      {!loading && !error && createAllowed === false ? (
        <PageSection>
          <ErrorState
            action={<Button onClick={onBack} variant="light">{fe2ScheduleCoreText.groupScheduleScreen_jsxText_9b431254}</Button>}
            message={fe2ScheduleCoreText.groupScheduleScreen_message_0fe8ae69}
            title={fe2ScheduleCoreText.groupScheduleScreen_title_d17d52ca}
          />
        </PageSection>
      ) : null}
      {!loading && !error && createAllowed ? (
        <PageSection>
          <ScheduleOneOffCreateForm
            defaultDate={defaultDate}
            filterOptions={{
              groups: filterOptions.groups,
              halls: filterOptions.halls,
            }}
            footerClassName="schedule-route-form__footer"
            filters={{
              groupId: null,
              hallId: null,
            }}
            onCancel={onBack}
            onCreated={onCreated}
          />
        </PageSection>
      ) : null}
    </PageLayout>
  )
}

export function ScheduleLessonChangeRouteScreen({
  lessonDate,
  lessonOccurrenceId,
  mode,
  onBack,
  onChanged,
}: {
  lessonDate: string
  lessonOccurrenceId: string
  mode: 'edit' | 'move'
  onBack: () => void
  onChanged: (lesson: ScheduleLesson) => void
}) {
  const [lesson, setLesson] = useState<ScheduleLesson | null>(null)
  const [filterOptions, setFilterOptions] = useState(() => emptyFilterOptions())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadLesson() {
      setLoading(true)
      setError(null)

      try {
        const [response, optionsResponse] = await Promise.all([
          getScheduleLesson(
            lessonOccurrenceId,
            lessonDate,
            controller.signal,
          ),
          getScheduleLessons({
            from: lessonDate,
            to: lessonDate,
          }, controller.signal),
        ])

        if (!controller.signal.aborted) {
          setLesson(response)
          setFilterOptions(mapResponseFilterOptions(optionsResponse.filterOptions))
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : fe2ScheduleCoreText.groupScheduleScreen_string_314ea9f7)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadLesson()

    return () => controller.abort()
  }, [lessonDate, lessonOccurrenceId])

  const actionAllowed = lesson
    ? mode === 'move'
      ? lesson.allowedActions.move.allowed
      : lesson.allowedActions.edit.allowed
    : false
  const unavailableReason = lesson
    ? mode === 'move'
      ? lesson.allowedActions.move.reason
      : lesson.allowedActions.edit.reason
    : null
  const title = mode === 'move' ? fe2ScheduleCoreText.groupScheduleScreen_string_c0c26d68 : fe2ScheduleCoreText.groupScheduleScreen_string_148e56cb

  return (
    <PageLayout
      className="schedule-screen"
      data-testid={`schedule-lesson-${mode}-screen`}
      showHeader
      title={title}
    >
      {loading ? (
        <PageSection>
          <LoadingState label={fe2ScheduleCoreText.groupScheduleScreen_label_ef0c9403} />
        </PageSection>
      ) : null}
      {error ? (
        <PageSection>
          <ErrorState message={error} title={fe2ScheduleCoreText.groupScheduleScreen_title_c2de061e} />
        </PageSection>
      ) : null}
      {lesson && !actionAllowed ? (
        <PageSection>
          <ErrorState
            action={<Button onClick={onBack} variant="light">{fe2ScheduleCoreText.groupScheduleScreen_jsxText_9b431254}</Button>}
            message={
              formatScheduleActionUnavailableReason(unavailableReason) ??
              fe2ScheduleCoreText.groupScheduleScreen_string_ad9d22f9
            }
            title={mode === 'move' ? fe2ScheduleCoreText.groupScheduleScreen_string_cc2b2849 : fe2ScheduleCoreText.groupScheduleScreen_string_b1bdd1a5}
          />
        </PageSection>
      ) : null}
      {lesson && actionAllowed ? (
        <PageSection>
          <ScheduleLessonChangeForm
            footerClassName="schedule-route-form__footer"
            hallOptions={filterOptions.halls}
            initialScope="Occurrence"
            lesson={lesson}
            lockScope
            onCancel={onBack}
            onChanged={onChanged}
          />
        </PageSection>
      ) : null}
    </PageLayout>
  )
}

type ScheduleToolbarProps = {
  createTriggerRef: Ref<HTMLButtonElement>
  createCapabilityState: 'available' | 'unavailable' | 'unknown'
  date: string
  disabled: boolean
  onCreate: (() => void) | null
  onDateChange: (date: string) => void
  onNext: () => void
  onPrevious: () => void
  view: ScheduleViewMode
}

function ScheduleToolbar({
  createTriggerRef,
  createCapabilityState,
  date,
  disabled,
  onCreate,
  onDateChange,
  onNext,
  onPrevious,
  view,
}: ScheduleToolbarProps) {
  return (
    <div
      className="schedule-toolbar"
      data-create-capability={createCapabilityState}
      data-testid="schedule-toolbar"
      data-tools-placement="day-summary"
      data-view={view}
    >
      <div className="schedule-toolbar__date-group">
        <ActionIcon
          aria-label={view === 'week' ? fe2ScheduleCoreText.groupScheduleScreen_string_bdc4bb60 : fe2ScheduleCoreText.groupScheduleScreen_string_2bb606b0}
          className="schedule-toolbar__button"
          disabled={disabled}
          onClick={onPrevious}
          size={44}
          type="button"
          variant="light"
        >
          <IconChevronLeft size={20} />
        </ActionIcon>
        <TextInput
          aria-label={fe2ScheduleCoreText.groupScheduleScreen_ariaLabel_5c290213}
          className="schedule-toolbar__date-input"
          leftSection={<IconCalendarEvent size={18} />}
          max="9999-12-31"
          min="1900-01-01"
          onChange={(event) => {
            if (isRealIsoDate(event.currentTarget.value)) {
              onDateChange(event.currentTarget.value)
            }
          }}
          type="date"
          value={date}
        />
        <ActionIcon
          aria-label={view === 'week' ? fe2ScheduleCoreText.groupScheduleScreen_string_904286db : fe2ScheduleCoreText.groupScheduleScreen_string_5ad6c3a3}
          className="schedule-toolbar__button"
          disabled={disabled}
          onClick={onNext}
          size={44}
          type="button"
          variant="light"
        >
          <IconChevronRight size={20} />
        </ActionIcon>
      </div>
      {onCreate ? (
        <Button
          aria-label={fe2ScheduleCoreText.groupScheduleScreen_ariaLabel_ce0f52ac}
          className="schedule-toolbar__create"
          data-testid="schedule-create-trigger"
          leftSection={<IconPlus size={18} />}
          onClick={onCreate}
          ref={createTriggerRef}
          type="button"
        >
          {fe2ScheduleCoreText.groupScheduleScreen_jsxText_e2be3497}</Button>
      ) : null}
    </div>
  )
}

type CalendarToolsSurfaceProps = {
  activeFilters: boolean
  filterOptions: ReturnType<typeof emptyFilterOptions>
  filters: ScheduleUrlState
  opened: boolean
  onClose: () => void
  onFilterChange: (key: keyof ScheduleFilters, value: string | null) => void
  onRefresh: () => void
  onResetFilters: () => void
  onToday: () => void
  onViewChange: (view: string) => void
  refreshDisabled: boolean
  view: ScheduleViewMode
}

function CalendarToolsSurface({
  activeFilters,
  filterOptions,
  filters,
  opened,
  onClose,
  onFilterChange,
  onRefresh,
  onResetFilters,
  onToday,
  onViewChange,
  refreshDisabled,
  view,
}: CalendarToolsSurfaceProps) {
  return (
    <Drawer
      className="schedule-tools-drawer"
      onClose={onClose}
      opened={opened}
      position="bottom"
      size="auto"
      title={fe2ScheduleCoreText.groupScheduleScreen_string_1d51e161}
      withinPortal
    >
      <Stack gap="md">
        <Group grow>
          <Button leftSection={<IconCalendarEvent size={18} />} onClick={onToday} variant="light">
            {fe2ScheduleCoreText.groupScheduleScreen_jsxText_b688b4c0}</Button>
          <Button
            disabled={refreshDisabled}
            leftSection={<IconRefresh size={18} />}
            onClick={onRefresh}
            variant="light"
          >
            {fe2ScheduleCoreText.groupScheduleScreen_jsxText_603e460b}</Button>
        </Group>
        <SegmentedControl
          aria-label={fe2ScheduleCoreText.groupScheduleScreen_ariaLabel_d9fc5a1d}
          data={[
            { value: 'day', label: fe2ScheduleCoreText.groupScheduleScreen_label_63ad4f82 },
            { value: 'week', label: fe2ScheduleCoreText.groupScheduleScreen_label_ff2e564d },
          ]}
          onChange={onViewChange}
          value={view}
        />
        <Stack gap="sm">
          <ScheduleFilterSelect
            data={filterOptions.branches}
            label={fe2ScheduleCoreText.groupScheduleScreen_label_2f17c4d2}
            onChange={(value) => onFilterChange('branchId', value)}
            value={filters.branchId}
          />
          <ScheduleFilterSelect
            data={filterOptions.halls}
            label={fe2ScheduleCoreText.groupScheduleScreen_label_182f7c57}
            onChange={(value) => onFilterChange('hallId', value)}
            value={filters.hallId}
          />
          <ScheduleFilterSelect
            data={filterOptions.trainers}
            label={fe2ScheduleCoreText.groupScheduleScreen_label_894d7ecc}
            onChange={(value) => onFilterChange('trainerId', value)}
            value={filters.trainerId}
          />
          <ScheduleFilterSelect
            data={filterOptions.groups}
            label={fe2ScheduleCoreText.groupScheduleScreen_label_907efbd4}
            onChange={(value) => onFilterChange('groupId', value)}
            value={filters.groupId}
          />
          <ScheduleFilterSelect
            data={filterOptions.groupTypes}
            label={fe2ScheduleCoreText.groupScheduleScreen_label_a642a677}
            onChange={(value) => onFilterChange('groupTypeId', value)}
            value={filters.groupTypeId}
          />
        </Stack>
        <Group className="schedule-tools-drawer__footer" grow>
          <Button onClick={onClose}>{fe2ScheduleCoreText.groupScheduleScreen_jsxText_ef05d579}</Button>
          <Button disabled={!activeFilters} onClick={onResetFilters} variant="light">
            {fe2ScheduleCoreText.groupScheduleScreen_jsxText_cd45ec78}</Button>
        </Group>
      </Stack>
    </Drawer>
  )
}

function ScheduleFilterSelect({
  data,
  label,
  onChange,
  value,
}: {
  data: FilterOption[]
  label: string
  onChange: (value: string | null) => void
  value: string | null
}) {
  return (
    <Select
      clearable
      data={data}
      label={label}
      onChange={onChange}
      searchable
      value={value}
    />
  )
}

function ScheduleWeekView({
  days,
  onCancelOrRestoreLesson,
  onChangeLesson,
  onEditSeries,
  onMoveLesson,
  onOpenDetail,
  onOpenAttendance,
  onTrainerSubstitution,
}: {
  days: Array<{ date: string; lessons: ScheduleLesson[] }>
  onCancelOrRestoreLesson: (lesson: ScheduleLesson, action: ScheduleLessonCancellationAction) => void
  onChangeLesson: (lesson: ScheduleLesson) => void
  onEditSeries: (lesson: ScheduleLesson, scope: 'this-and-future' | 'entire') => void
  onMoveLesson: (lesson: ScheduleLesson) => void
  onOpenDetail: (lessonOccurrenceId: string, lessonDate: string) => void
  onOpenAttendance: (lessonOccurrenceId: string, lessonDate: string) => void
  onTrainerSubstitution: (lesson: ScheduleLesson, action: 'Assign' | 'Cancel') => void
}) {
  return (
    <div className="schedule-week-view" data-testid="schedule-week-view">
      {days.map((day) => (
        <ScheduleDayList
          date={day.date}
          key={day.date}
          lessons={day.lessons}
          onCancelOrRestoreLesson={onCancelOrRestoreLesson}
          onChangeLesson={onChangeLesson}
          onEditSeries={onEditSeries}
          onMoveLesson={onMoveLesson}
          onOpenDetail={onOpenDetail}
          onOpenAttendance={onOpenAttendance}
          onTrainerSubstitution={onTrainerSubstitution}
          title={`${formatWeekday(day.date)}, ${formatShortDate(day.date)}`}
        />
      ))}
    </div>
  )
}

function ScheduleDayList({
  date,
  lessons,
  onCancelOrRestoreLesson,
  onChangeLesson,
  onEditSeries,
  onMoveLesson,
  onOpenDetail,
  onOpenAttendance,
  onTrainerSubstitution,
  title,
}: {
  date: string
  lessons: ScheduleLesson[]
  onCancelOrRestoreLesson: (lesson: ScheduleLesson, action: ScheduleLessonCancellationAction) => void
  onChangeLesson: (lesson: ScheduleLesson) => void
  onEditSeries: (lesson: ScheduleLesson, scope: 'this-and-future' | 'entire') => void
  onMoveLesson: (lesson: ScheduleLesson) => void
  onOpenDetail: (lessonOccurrenceId: string, lessonDate: string) => void
  onOpenAttendance: (lessonOccurrenceId: string, lessonDate: string) => void
  onTrainerSubstitution: (lesson: ScheduleLesson, action: 'Assign' | 'Cancel') => void
  title: string | null
}) {
  return (
    <section
      {...(title
        ? { 'aria-labelledby': `schedule-day-${date}` }
        : { 'aria-label': formatLongDate(date) })}
      className="schedule-day-section"
      data-testid={`schedule-day-section-${date}`}
    >
      {title ? (
        <Group align="center" className="schedule-day-section__header" justify="space-between">
          <Text component="h2" fw={900} id={`schedule-day-${date}`} size="lg">
            {title}
          </Text>
          <Badge variant="light">{formatLessonCount(lessons.length)}</Badge>
        </Group>
      ) : null}
      {lessons.length === 0 ? (
        <div className="schedule-day-section__empty">
          <Text c="dimmed" fw={600} size="sm">{fe2ScheduleCoreText.groupScheduleScreen_jsxText_61b682d8}</Text>
        </div>
      ) : (
        <Stack gap="sm">
          {buildScheduleTimeGroups(date, lessons).map((timeGroup) => (
            <section
              aria-labelledby={`${timeGroup.id}-heading`}
              className="schedule-time-group"
              data-testid={timeGroup.id}
              id={timeGroup.id}
              key={timeGroup.id}
            >
              <Text
                className="schedule-time-group__heading"
                component="h3"
                fw={900}
                id={`${timeGroup.id}-heading`}
              >
                {timeGroup.label}
                <Text className="schedule-time-group__count" component="span" size="sm">
                  {formatLessonCount(timeGroup.lessons.length)}
                </Text>
              </Text>
              <div className="crm-list-row-surface schedule-time-group__cards">
                {timeGroup.lessons.map((lesson) => (
                  <ScheduleOccurrenceCard
                    key={`${lesson.lessonOccurrenceId}:${lesson.lessonDate}`}
                    lesson={lesson}
                    onCancelOrRestoreLesson={onCancelOrRestoreLesson}
                    onChangeLesson={onChangeLesson}
                    onEditSeries={onEditSeries}
                    onMoveLesson={onMoveLesson}
                    onOpenDetail={onOpenDetail}
                    onOpenAttendance={onOpenAttendance}
                    onTrainerSubstitution={onTrainerSubstitution}
                  />
                ))}
              </div>
            </section>
          ))}
        </Stack>
      )}
    </section>
  )
}

function ScheduleOccurrenceCard({
  lesson,
  onCancelOrRestoreLesson,
  onChangeLesson,
  onEditSeries,
  onMoveLesson,
  onOpenDetail,
  onOpenAttendance,
  onTrainerSubstitution,
}: {
  lesson: ScheduleLesson
  onCancelOrRestoreLesson: (lesson: ScheduleLesson, action: ScheduleLessonCancellationAction) => void
  onChangeLesson: (lesson: ScheduleLesson) => void
  onEditSeries: (lesson: ScheduleLesson, scope: 'this-and-future' | 'entire') => void
  onMoveLesson: (lesson: ScheduleLesson) => void
  onOpenDetail: (lessonOccurrenceId: string, lessonDate: string) => void
  onOpenAttendance: (lessonOccurrenceId: string, lessonDate: string) => void
  onTrainerSubstitution: (lesson: ScheduleLesson, action: 'Assign' | 'Cancel') => void
}) {
  const bodyRef = useRef<HTMLButtonElement | null>(null)
  const useDesktopRowActions = useMediaQuery('(min-width: 48.0625em) and (hover: hover) and (pointer: fine)')
  const attendanceAllowed = lesson.allowedActions.viewAttendance.allowed
  const attendanceReasonId = `schedule-attendance-reason-${lesson.lessonOccurrenceId}`
  const attendanceReason = attendanceAllowed
    ? null
    : getActionUnavailableReason(lesson.allowedActions.viewAttendance.reason)
  const trainers = formatEffectiveTrainers(lesson)
  const isCancelled = lesson.status === 'Cancelled'
  const timeRange = formatTimeRange(lesson)
  const accessibleContext = fe2ScheduleCoreText.groupScheduleScreen_accessibleContext_fc66225b(lesson.groupName, timeRange)
  const deferredActions = buildScheduleDeferredActions(lesson, {
    onMoveLesson,
    onEditSeries,
    onTrainerSubstitution,
    onCancelOrRestoreLesson,
  })
  const rowActions = lesson.allowedActions.edit.allowed && !useDesktopRowActions
    ? [{
        id: 'edit' as const,
        label: fe2ScheduleCoreText.groupScheduleScreen_jsxText_b8b151d4,
        accessibleName: fe2ScheduleCoreText.groupScheduleScreen_accessibleName_0c4c88a4(accessibleContext),
        icon: <IconEdit size={18} />,
        danger: false,
        run: () => onChangeLesson(lesson),
      }, ...deferredActions]
    : deferredActions

  return (
    <article
      className="schedule-occurrence-card"
      data-mobile-density={useDesktopRowActions ? undefined : 'compact-row'}
      data-lesson-date={lesson.lessonDate}
      data-lesson-occurrence-id={lesson.lessonOccurrenceId}
      data-testid={`schedule-card-${lesson.lessonOccurrenceId}`}
      id={getScheduleCardAnchorId(lesson.lessonOccurrenceId)}
      tabIndex={-1}
    >
      <button
        aria-label={fe2ScheduleCoreText.groupScheduleScreen_template_5aec8f4b(accessibleContext)}
        className="schedule-occurrence-card__body"
        onClick={() => onOpenDetail(lesson.lessonOccurrenceId, lesson.lessonDate)}
        ref={bodyRef}
        type="button"
      >
        <Stack gap={6}>
          <Group align="flex-start" className="schedule-occurrence-card__heading" justify="space-between" wrap="nowrap">
            <Stack gap={2}>
              <Text className="schedule-occurrence-card__title" fw={useDesktopRowActions ? 900 : 700}>
                {lesson.groupName}
              </Text>
              <Text c="dimmed" data-testid="schedule-location" size="sm">
                {lesson.hallName} {fe2ScheduleCoreText.groupScheduleScreen_jsxText_a137f17a}{lesson.branchName}
              </Text>
              <Text c="dimmed" data-testid="schedule-trainers" size="sm">
                {trainers}
              </Text>
            </Stack>
            <span
              aria-hidden="true"
              className="schedule-occurrence-card__chevron"
              data-direction="forward"
              data-testid="schedule-detail-affordance"
            >
              <IconChevronRight size={18} />
            </span>
          </Group>
          {isCancelled || useDesktopRowActions ? (
            <Group gap={6} wrap="wrap">
              {isCancelled ? <Badge color="gray" variant="light">{fe2ScheduleCoreText.groupScheduleScreen_jsxText_23a2a9bf}</Badge> : null}
              {useDesktopRowActions ? <Badge variant="light">{lesson.groupTypeName}</Badge> : null}
              {useDesktopRowActions ? (
                <Badge variant="outline">{lesson.sourceKind === 'OneOff' ? fe2ScheduleCoreText.groupScheduleScreen_string_301ca990 : fe2ScheduleCoreText.groupScheduleScreen_string_274aa551}</Badge>
              ) : null}
            </Group>
          ) : null}
        </Stack>
      </button>
      <Group className="schedule-occurrence-card__actions" gap="xs">
        <Badge className="schedule-occurrence-card__attendance-status" color="gray" variant="light">
          {lesson.hasAttendanceMarks ? fe2ScheduleCoreText.groupScheduleScreen_jsxText_0d7d0a5f : fe2ScheduleCoreText.groupScheduleScreen_string_ffa4f44c}
        </Badge>
        <Button
          aria-describedby={attendanceReason ? attendanceReasonId : undefined}
          className="schedule-occurrence-card__attendance"
          disabled={!attendanceAllowed}
          leftSection={<IconUsers size={18} />}
          onClick={() => onOpenAttendance(lesson.lessonOccurrenceId, lesson.lessonDate)}
          type="button"
          variant="light"
        >
          {resources.schedule.actions.attendance}
        </Button>
        {lesson.allowedActions.edit.allowed && useDesktopRowActions ? (
          <Button
            aria-label={fe2ScheduleCoreText.groupScheduleScreen_accessibleName_0c4c88a4(accessibleContext)}
            className="schedule-occurrence-card__secondary"
            leftSection={<IconEdit size={18} />}
            onClick={() => onChangeLesson(lesson)}
            type="button"
            variant="light"
          >
            {fe2ScheduleCoreText.groupScheduleScreen_jsxText_b8b151d4}</Button>
        ) : null}
        <ScheduleMoreActionsSurface
          accessibleContext={accessibleContext}
          actions={rowActions}
          context={{
            groupName: lesson.groupName,
            interval: timeRange,
            hallLine: `${lesson.hallName} · ${lesson.branchName}`,
            trainers,
          }}
          fallbackFocusRef={bodyRef}
          onSelectAction={(action) => action.run()}
        />
        {attendanceReason ? (
          <Text c="dimmed" id={attendanceReasonId} size="sm">
            {attendanceReason}
          </Text>
        ) : null}
      </Group>
    </article>
  )
}

function ScheduleEmptyState({
  activeFilters,
  viewerRole,
}: {
  activeFilters: boolean
  viewerRole: UserRole
}) {
  if (activeFilters) {
    return (
      <EmptyState
        description={fe2ScheduleCoreText.groupScheduleScreen_description_e328b6b5}
        icon={<IconCalendarEvent size={24} />}
        title={fe2ScheduleCoreText.groupScheduleScreen_title_87f0bc93}
      />
    )
  }

  if (viewerRole === 'Coach') {
    return (
      <EmptyState
        description={fe2ScheduleCoreText.groupScheduleScreen_description_8fd05e01}
        icon={<IconCalendarEvent size={24} />}
        title={fe2ScheduleCoreText.groupScheduleScreen_title_53c1cb1e}
      />
    )
  }

  return (
    <EmptyState
      description={fe2ScheduleCoreText.groupScheduleScreen_description_222a0bea}
      icon={<IconCalendarEvent size={24} />}
      title={fe2ScheduleCoreText.groupScheduleScreen_title_8c75c82d}
    />
  )
}

function getCreateCapabilityState(
  capabilities: { createOneOff: ScheduleAction } | null,
) {
  if (!capabilities) {
    return 'unknown'
  }

  return capabilities.createOneOff.allowed ? 'available' : 'unavailable'
}

function buildScheduleDays(from: string, to: string, lessons: readonly ScheduleLesson[]) {
  const dates: string[] = []
  let current = from
  while (current <= to) {
    dates.push(current)
    current = addIsoDays(current, 1)
  }

  return dates.map((date) => ({
    date,
    lessons: lessons.filter((lesson) => lesson.lessonDate === date),
  }))
}

function formatEffectiveTrainers(lesson: ScheduleLesson) {
  if (lesson.effectiveTrainers.length === 0) {
    return fe2ScheduleCoreText.groupScheduleScreen_string_a674b477
  }

  return lesson.effectiveTrainers
    .map((trainer) =>
      trainer.kind === 'Substitute'
        ? fe2ScheduleCoreText.groupScheduleScreen_template_23948761(trainer.fullName)
        : trainer.fullName,
    )
    .join(', ')
}

function getActionUnavailableReason(reason: string | null) {
  return formatScheduleActionUnavailableReason(reason)
}

function formatLessonCount(count: number) {
  if (count === 1) return fe2ScheduleCoreText.groupScheduleScreen_string_404398f9
  if (count >= 2 && count <= 4) return fe2ScheduleCoreText.groupScheduleScreen_template_f806750d(count)
  return fe2ScheduleCoreText.groupScheduleScreen_template_73ed7940(count)
}
