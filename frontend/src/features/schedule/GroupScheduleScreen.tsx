import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Drawer,
  Group,
  NumberInput,
  Paper,
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
  IconAlertTriangle,
  IconChevronLeft,
  IconChevronRight,
  IconEdit,
  IconPlus,
  IconRefresh,
  IconSettings,
  IconUsers,
} from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  applyGroupLessonSeries,
  applyScheduleLessonTrainerSubstitution,
  applyScheduleLessonTrainerSubstitutionCancellation,
  getGroupLessonSeries,
  getScheduleLessons,
  getScheduleLesson,
  previewGroupLessonSeries,
  previewScheduleLessonTrainerSubstitution,
  previewScheduleLessonTrainerSubstitutionCancellation,
  type GroupLessonSeriesPreviewResponse,
  type GroupLessonSeriesReadResponse,
  type GroupLessonSeriesRequest,
  type GroupLessonSeriesScope,
  type ScheduleAction,
  type ScheduleLesson,
  type ScheduleLessonCancellationAction,
  type ScheduleLessonTrainerSubstitutionCancellationPreviewResponse,
  type ScheduleLessonTrainerSubstitutionPreviewResponse,
  type ScheduleWarning,
  type UserRole,
} from '../../lib/api'
import { resources } from '../../lib/resources'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
  StickyFormActions,
} from '../shared/ux'
import { ScheduleLessonChangeForm } from './ScheduleLessonChangeDrawer'
import { ScheduleLessonCancellationDrawer } from './ScheduleLessonCancellationDrawer'
import { ScheduleOneOffCreateForm } from './ScheduleOneOffCreateDrawer'
import {
  formatScheduleActionUnavailableReason,
  formatScheduleProblemCode,
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

type ScheduleViewMode = 'day' | 'week'

type ScheduleFilters = {
  branchId: string | null
  hallId: string | null
  trainerId: string | null
  groupId: string | null
  groupTypeId: string | null
}

type ScheduleUrlState = ScheduleFilters & {
  date: string
  view: ScheduleViewMode
}

type FilterOption = {
  value: string
  label: string
}

const EMPTY_FILTERS: ScheduleFilters = {
  branchId: null,
  hallId: null,
  trainerId: null,
  groupId: null,
  groupTypeId: null,
}

const FILTER_KEYS = ['branchId', 'hallId', 'trainerId', 'groupId', 'groupTypeId'] as const
const DAY_MS = 24 * 60 * 60 * 1000

export function GroupScheduleScreen({
  onCreateLesson,
  onEditLesson,
  onEditSeries,
  onMoveLesson,
  onOpenAttendance,
  onOpenLessonDetail,
  viewerRole,
}: GroupScheduleScreenProps) {
  const [urlState, setUrlState] = useState(readScheduleUrlState)
  const [lessons, setLessons] = useState<ScheduleLesson[]>([])
  const [capabilities, setCapabilities] = useState<{ createOneOff: ScheduleAction } | null>(null)
  const [filterOptions, setFilterOptions] = useState(() => emptyFilterOptions())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
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
  const isFirstLoadRef = useRef(true)

  useEffect(() => {
    function syncFromHistory() {
      setUrlState(readScheduleUrlState())
    }

    window.addEventListener('popstate', syncFromHistory)

    return () => window.removeEventListener('popstate', syncFromHistory)
  }, [])

  const range = useMemo(
    () => getScheduleRange(urlState.date, urlState.view),
    [urlState.date, urlState.view],
  )

  useEffect(() => {
    const controller = new AbortController()
    const isInitial = isFirstLoadRef.current

    async function loadLessons() {
      if (isInitial) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }
      setError(null)

      try {
        const response = await getScheduleLessons({
          from: range.from,
          to: range.to,
          ...pickScheduleFilters(urlState),
        }, controller.signal)

        if (controller.signal.aborted) {
          return
        }

        setLessons(sortLessons(response.items))
        setCapabilities(response.capabilities)
        setFilterOptions(mapResponseFilterOptions(response.filterOptions))
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        setError(loadError instanceof Error ? loadError.message : fe2ScheduleCoreText.groupScheduleScreen_string_c8822d97)
      } finally {
        if (!controller.signal.aborted) {
          isFirstLoadRef.current = false
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    void loadLessons()

    return () => controller.abort()
  }, [range.from, range.to, reloadKey, urlState])

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

  function applyState(next: Partial<ScheduleUrlState>, options: { replace?: boolean } = {}) {
    setUrlState((current) => {
      const merged = { ...current, ...next }
      writeScheduleUrlState(merged, options)
      return merged
    })
  }

  function moveBy(deltaDays: number) {
    applyState({ date: addIsoDays(urlState.date, deltaDays) })
  }

  function refresh() {
    setReloadKey((key) => key + 1)
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
        {formatLongWeekday(urlState.date)}
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

export function ScheduleSeriesEditScreen({
  groupId,
  lessonDate,
  lessonSeriesId,
  lessonOccurrenceId,
  onBack,
  onSaved,
  scope,
}: {
  groupId?: string | null
  lessonDate?: string | null
  lessonSeriesId: string
  lessonOccurrenceId?: string | null
  onBack: () => void
  onSaved: () => void
  scope: 'this-and-future' | 'entire'
}) {
  const [series, setSeries] = useState<GroupLessonSeriesReadResponse | null>(null)
  const [draft, setDraft] = useState<SeriesDraft | null>(null)
  const [hallOptions, setHallOptions] = useState<FilterOption[]>([])
  const [fieldErrors, setFieldErrors] = useState<SeriesFieldErrors>({})
  const [preview, setPreview] = useState<GroupLessonSeriesPreviewResponse | null>(null)
  const [submitting, setSubmitting] = useState<'preview' | 'execute' | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const effectiveFromRef = useRef<HTMLInputElement | null>(null)
  const endsOnRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadSeries() {
      setLoading(true)
      setError(null)

      try {
        const response = await getGroupLessonSeries(lessonSeriesId, controller.signal)
        let scheduleHalls: FilterOption[] = []
        const optionDate = lessonDate && isRealIsoDate(lessonDate)
          ? lessonDate
          : response.businessDate

        try {
          const optionsResponse = await getScheduleLessons({
            from: optionDate,
            to: optionDate,
            groupId: groupId ?? response.groupId,
          }, controller.signal)
          scheduleHalls = mapResponseFilterOptions(optionsResponse.filterOptions).halls
        } catch {
          scheduleHalls = []
        }

        if (controller.signal.aborted) {
          return
        }

        setSeries(response)
        setDraft(buildSeriesDraft(response, scope, lessonDate))
        setHallOptions(mergeSeriesHallOptions(response, scheduleHalls))
        setPreview(null)
        setFieldErrors({})
        setFormError(null)
        setDirty(false)
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : fe2ScheduleCoreText.groupScheduleScreen_string_1b31d0c9)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadSeries()

    return () => controller.abort()
  }, [groupId, lessonDate, lessonSeriesId, scope])

  const pending = submitting !== null

  function updateDraft<Field extends keyof SeriesDraft>(
    field: Field,
    value: SeriesDraft[Field],
  ) {
    setDraft((current) => current ? { ...current, [field]: value } : current)
    setDirty(true)
    setPreview(null)
    setFormError(null)
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
  }

  function updateSlot<Field extends keyof SeriesSlotDraft>(
    index: number,
    field: Field,
    value: SeriesSlotDraft[Field],
  ) {
    setDraft((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        slots: current.slots.map((slot, slotIndex) =>
          slotIndex === index ? { ...slot, [field]: value } : slot,
        ),
      }
    })
    setDirty(true)
    setPreview(null)
    setFormError(null)
  }

  function addSlot() {
    setDraft((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        slots: [
          ...current.slots,
          buildNewSeriesSlot(
            current.slots.at(-1),
            hallOptions[0],
            current.slots.length,
          ),
        ],
      }
    })
    setDirty(true)
    setPreview(null)
    setFormError(null)
  }

  function removeSlot(index: number) {
    setDraft((current) => {
      if (!current || current.slots.length <= 1) {
        return current
      }

      return {
        ...current,
        slots: current.slots.filter((_, slotIndex) => slotIndex !== index),
      }
    })
    setDirty(true)
    setPreview(null)
    setFormError(null)
  }

  async function submitPreview() {
    if (!series || !draft) {
      return
    }

    setSubmitting('preview')
    setFieldErrors({})
    setFormError(null)

    try {
      const response = await previewGroupLessonSeries(
        lessonSeriesId,
        toSeriesRequest(draft, series),
      )
      setPreview(response)
    } catch (previewError) {
      handleSeriesFormError(previewError)
    } finally {
      setSubmitting(null)
    }
  }

  async function confirmSeriesChange() {
    if (!series || !draft || !preview) {
      return
    }

    setSubmitting('execute')
    setFieldErrors({})
    setFormError(null)

    try {
      await applyGroupLessonSeries(lessonSeriesId, {
        ...toSeriesRequest(draft, series),
        expectedRevision: preview.revision,
        confirmationToken: preview.confirmationToken,
      })
      setDirty(false)
      setPreview(null)
      onSaved()
    } catch (executeError) {
      if (executeError instanceof ApiError) {
        const recoveryMessage = formatScheduleProblemCode(executeError.code)
        if (recoveryMessage) {
          setPreview(null)
          setFormError(recoveryMessage)
          return
        }
      }

      handleSeriesFormError(executeError)
    } finally {
      setSubmitting(null)
    }
  }

  function handleSeriesFormError(formErrorValue: unknown) {
    setPreview(null)

    if (formErrorValue instanceof ApiError) {
      const nextErrors = applyFieldErrors(formErrorValue.fieldErrors, SERIES_FIELD_ALIASES)
      setFieldErrors(nextErrors)
      focusFirstSeriesInvalidField(nextErrors)
      setFormError(
        formatScheduleProblemCode(formErrorValue.code) ??
        fe2ScheduleCoreText.groupScheduleScreen_string_055792ee,
      )
      return
    }

    setFormError(fe2ScheduleCoreText.groupScheduleScreen_string_055792ee)
  }

  function focusFirstSeriesInvalidField(errors: SeriesFieldErrors) {
    const refs = {
      effectiveFrom: effectiveFromRef,
      endsOn: endsOnRef,
    }
    const firstInvalid = (Object.keys(refs) as Array<keyof typeof refs>)
      .find((field) => errors[field])

    if (firstInvalid) {
      window.requestAnimationFrame(() => refs[firstInvalid].current?.focus())
    }
  }

  function cancel() {
    if (dirty && !window.confirm(fe2ScheduleCoreText.groupScheduleScreen_windowConfirm_9ca4aaac)) {
      return
    }

    onBack()
  }

  return (
    <PageLayout
      className="schedule-screen"
      data-testid="schedule-series-edit-screen"
      showHeader
      title={fe2ScheduleCoreText.groupScheduleScreen_title_cd3e4306}
    >
      {loading ? (
        <PageSection>
          <LoadingState label={fe2ScheduleCoreText.groupScheduleScreen_label_82cba72b} />
        </PageSection>
      ) : null}
      {error ? (
        <PageSection>
          <ErrorState
            action={<Button onClick={onBack} variant="light">{fe2ScheduleCoreText.groupScheduleScreen_jsxText_9b431254}</Button>}
            message={error}
            title={fe2ScheduleCoreText.groupScheduleScreen_title_f1cab840}
          />
        </PageSection>
      ) : null}
      {series && draft ? (
        <PageSection>
          <form
            data-testid="schedule-series-edit-form"
            onSubmit={(event) => {
              event.preventDefault()
              void submitPreview()
            }}
          >
            <Stack gap="md">
              <Stack gap={4}>
                <Text fw={900}>{series.groupName}</Text>
                <Text c="dimmed" size="sm">
                  {fe2ScheduleCoreText.groupScheduleScreen_jsxText_4b5f3a17}{formatShortDate(series.startsOn)}
                  {series.endsOn ? fe2ScheduleCoreText.groupScheduleScreen_template_aea1f902(formatShortDate(series.endsOn)) : ''}
                  {lessonOccurrenceId ? fe2ScheduleCoreText.groupScheduleScreen_template_705c7b4e(formatShortDate(lessonDate ?? series.businessDate)) : ''}
                </Text>
              </Stack>

              <SegmentedControl
                aria-label={fe2ScheduleCoreText.groupScheduleScreen_ariaLabel_a6a7cac1}
                data={[
                  { value: 'ThisAndFuture', label: fe2ScheduleCoreText.groupScheduleScreen_label_eafa287c },
                  { value: 'EntireSeries', label: fe2ScheduleCoreText.groupScheduleScreen_label_a2706736 },
                ]}
                disabled={pending}
                onChange={(value) => {
                  const nextScope = value as GroupLessonSeriesScope
                  updateDraft('scope', nextScope)
                  updateDraft(
                    'effectiveFrom',
                    nextScope === 'EntireSeries'
                      ? series.currentVersion.entireSeriesEffectiveFrom
                      : (lessonDate && isRealIsoDate(lessonDate)
                        ? lessonDate
                        : series.currentVersion.thisAndFutureMinEffectiveFrom),
                  )
                }}
                value={draft.scope}
              />

              <Group align="flex-start" grow>
                <TextInput
                  disabled={pending || draft.scope === 'EntireSeries'}
                  error={fieldErrors.effectiveFrom}
                  label={fe2ScheduleCoreText.groupScheduleScreen_label_b8a6c0dc}
                  max="9999-12-31"
                  min="1900-01-01"
                  onChange={(event) => updateDraft('effectiveFrom', event.currentTarget.value)}
                  ref={effectiveFromRef}
                  type="date"
                  value={draft.effectiveFrom}
                />
                <TextInput
                  disabled={pending}
                  error={fieldErrors.endsOn}
                  label={fe2ScheduleCoreText.groupScheduleScreen_label_6ac938c0}
                  max="9999-12-31"
                  min="1900-01-01"
                  onChange={(event) => updateDraft('endsOn', event.currentTarget.value)}
                  ref={endsOnRef}
                  type="date"
                  value={draft.endsOn}
                />
              </Group>

              <Stack gap="sm">
                <Group align="center" justify="space-between">
                  <Text fw={900}>{fe2ScheduleCoreText.groupScheduleScreen_jsxText_38aaedce}</Text>
                  <Button
                    className="schedule-series-slot__action"
                    disabled={pending}
                    leftSection={<IconPlus size={18} />}
                    onClick={addSlot}
                    type="button"
                    variant="light"
                  >
                    {fe2ScheduleCoreText.groupScheduleScreen_jsxText_61f9839e}</Button>
                </Group>
                {draft.slots.length === 0 ? (
                  <Alert color="red" icon={<IconAlertTriangle size={18} />}>
                    {fe2ScheduleCoreText.groupScheduleScreen_jsxText_25d150a9}</Alert>
                ) : draft.slots.map((slot, index) => {
                  const removeDisabled = pending || draft.slots.length <= 1

                  return (
                    <Paper
                      className="schedule-series-slot"
                      data-testid={`schedule-series-slot-${index}`}
                      key={slot.key}
                      radius="md"
                      withBorder
                    >
                      <Stack gap="sm">
                        <Select
                          data={WEEKDAY_OPTIONS}
                          disabled={pending}
                          label={fe2ScheduleCoreText.groupScheduleScreen_label_68c27d77}
                          onChange={(value) =>
                            updateSlot(index, 'isoWeekday', value ? Number(value) : slot.isoWeekday)}
                          value={String(slot.isoWeekday)}
                        />
                        <Group align="flex-start" grow>
                          <TextInput
                            disabled={pending}
                            label={fe2ScheduleCoreText.groupScheduleScreen_label_1635ad1f}
                            onChange={(event) => updateSlot(index, 'startTime', event.currentTarget.value)}
                            type="time"
                            value={trimSeconds(slot.startTime)}
                          />
                          <NumberInput
                            disabled={pending}
                            label={fe2ScheduleCoreText.groupScheduleScreen_label_86301601}
                            min={1}
                            onChange={(value) =>
                              updateSlot(index, 'durationMinutes', typeof value === 'number' ? value : '')}
                            value={slot.durationMinutes}
                          />
                        </Group>
                        <Select
                          data={hallOptions}
                          disabled={pending}
                          label={fe2ScheduleCoreText.groupScheduleScreen_label_182f7c57}
                          onChange={(value) => updateSlot(index, 'hallId', value ?? '')}
                          searchable
                          value={slot.hallId || null}
                        />
                        <Button
                          aria-describedby={removeDisabled ? `schedule-series-remove-reason-${index}` : undefined}
                          className="schedule-series-slot__action"
                          color="red"
                          disabled={removeDisabled}
                          onClick={() => removeSlot(index)}
                          type="button"
                          variant="light"
                        >
                          {fe2ScheduleCoreText.groupScheduleScreen_jsxText_333afd46}</Button>
                        {removeDisabled ? (
                          <Text
                            c="dimmed"
                            id={`schedule-series-remove-reason-${index}`}
                            size="sm"
                          >
                            {fe2ScheduleCoreText.groupScheduleScreen_jsxText_3fbb07c9}</Text>
                        ) : null}
                      </Stack>
                    </Paper>
                  )
                })}
              </Stack>

              {formError ? (
                <Alert color="yellow" icon={<IconAlertTriangle size={18} />}>
                  {formError}
                </Alert>
              ) : null}

              {preview ? (
                <SeriesPreviewPanel preview={preview} />
              ) : null}

              <StickyFormActions
                className="schedule-route-form__footer"
                primaryAction={preview ? (
                  <Button
                    loading={submitting === 'execute'}
                    onClick={() => void confirmSeriesChange()}
                    type="button"
                  >
                    {fe2ScheduleCoreText.groupScheduleScreen_jsxText_8e72e5a3}</Button>
                ) : (
                  <Button loading={submitting === 'preview'} type="submit">
                    {formError ? fe2ScheduleCoreText.groupScheduleScreen_string_62b92aa4 : fe2ScheduleCoreText.groupScheduleScreen_string_857a90c1}
                  </Button>
                )}
                secondaryAction={<Button disabled={pending} onClick={cancel} type="button" variant="light">
                  {fe2ScheduleCoreText.groupScheduleScreen_jsxText_8fbe9b75}</Button>}
              />
            </Stack>
          </form>
        </PageSection>
      ) : null}
    </PageLayout>
  )
}

function ScheduleTrainerSubstitutionDrawer({
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

type SeriesSlotDraft = {
  key: string
  isoWeekday: number
  startTime: string
  durationMinutes: number | ''
  hallId: string
}

type SeriesDraft = {
  scope: GroupLessonSeriesScope
  effectiveFrom: string
  endsOn: string
  slots: SeriesSlotDraft[]
}

type SeriesFieldErrors = Partial<Record<'scope' | 'effectiveFrom' | 'endsOn' | 'slots', string>>

type SubstitutionFieldErrors = Partial<
  Record<'replacedTrainerId' | 'substituteTrainerId' | 'substitutionId' | 'reason', string>
>

const SERIES_FIELD_ALIASES = {
  scope: 'scope',
  effectiveFrom: 'effectiveFrom',
  endsOn: 'endsOn',
  slots: 'slots',
} satisfies Record<string, keyof SeriesFieldErrors>

const SUBSTITUTION_FIELD_ALIASES = {
  replacedTrainerId: 'replacedTrainerId',
  substituteTrainerId: 'substituteTrainerId',
  substitutionId: 'substitutionId',
  reason: 'reason',
  'targets.0.substitutionId': 'substitutionId',
} satisfies Record<string, keyof SubstitutionFieldErrors>

const WEEKDAY_OPTIONS = [
  { value: '1', label: fe2ScheduleCoreText.groupScheduleScreen_label_a59b45a7 },
  { value: '2', label: fe2ScheduleCoreText.groupScheduleScreen_label_cdfa593d },
  { value: '3', label: fe2ScheduleCoreText.groupScheduleScreen_label_d606a9df },
  { value: '4', label: fe2ScheduleCoreText.groupScheduleScreen_label_12be87c8 },
  { value: '5', label: fe2ScheduleCoreText.groupScheduleScreen_label_abbd2e86 },
  { value: '6', label: fe2ScheduleCoreText.groupScheduleScreen_label_ddb0ee8e },
  { value: '7', label: fe2ScheduleCoreText.groupScheduleScreen_label_f4276ba4 },
]

function buildSeriesDraft(
  series: GroupLessonSeriesReadResponse,
  routeScope: 'this-and-future' | 'entire',
  routeLessonDate?: string | null,
): SeriesDraft {
  const scope: GroupLessonSeriesScope =
    routeScope === 'entire' ? 'EntireSeries' : 'ThisAndFuture'
  const fallbackEffectiveFrom = scope === 'EntireSeries'
    ? series.currentVersion.entireSeriesEffectiveFrom
    : series.currentVersion.thisAndFutureMinEffectiveFrom

  return {
    scope,
    effectiveFrom:
      scope === 'ThisAndFuture' && routeLessonDate && isRealIsoDate(routeLessonDate)
        ? routeLessonDate
        : fallbackEffectiveFrom,
    endsOn: series.endsOn ?? '',
    slots: series.currentVersion.slots.map((slot, index) => ({
      key: `${slot.isoWeekday}:${slot.startTime}:${slot.hallId}:${index}`,
      isoWeekday: slot.isoWeekday,
      startTime: trimSeconds(slot.startTime),
      durationMinutes: slot.durationMinutes,
      hallId: slot.hallId,
    })),
  }
}

function buildNewSeriesSlot(
  previousSlot: SeriesSlotDraft | undefined,
  fallbackHall: FilterOption | undefined,
  index: number,
): SeriesSlotDraft {
  return {
    key: `new:${Date.now()}:${index}`,
    isoWeekday: previousSlot?.isoWeekday ?? 1,
    startTime: previousSlot?.startTime ?? '09:00',
    durationMinutes: previousSlot?.durationMinutes ?? 60,
    hallId: previousSlot?.hallId ?? fallbackHall?.value ?? '',
  }
}

function toSeriesRequest(
  draft: SeriesDraft,
  series: GroupLessonSeriesReadResponse,
): GroupLessonSeriesRequest {
  return {
    scope: draft.scope,
    effectiveFrom: draft.scope === 'EntireSeries'
      ? series.currentVersion.entireSeriesEffectiveFrom
      : draft.effectiveFrom || null,
    endsOn: draft.endsOn || null,
    slots: draft.slots.map((slot) => ({
      isoWeekday: slot.isoWeekday,
      startTime: trimSeconds(slot.startTime),
      durationMinutes: typeof slot.durationMinutes === 'number' ? slot.durationMinutes : null,
      hallId: slot.hallId || null,
    })),
    expectedRevision: series.revision,
  }
}

function mergeSeriesHallOptions(
  series: GroupLessonSeriesReadResponse,
  options: FilterOption[],
) {
  const byId = new Map<string, FilterOption>()
  for (const slot of series.currentVersion.slots) {
    byId.set(slot.hallId, { value: slot.hallId, label: slot.hallName })
  }
  for (const option of options) {
    byId.set(option.value, option)
  }

  return [...byId.values()]
}

function SeriesPreviewPanel({ preview }: { preview: GroupLessonSeriesPreviewResponse }) {
  return (
    <Paper className="schedule-series-preview" data-testid="schedule-series-preview" radius="md" withBorder>
      <Stack gap="sm">
        <Stack gap={2}>
          <Text fw={900}>{fe2ScheduleCoreText.groupScheduleScreen_jsxText_d66006ce}</Text>
          <Text c="dimmed" size="sm">
            {fe2ScheduleCoreText.groupScheduleScreen_jsxText_720752c6}{preview.scope === 'EntireSeries' ? fe2ScheduleCoreText.groupScheduleScreen_string_648188fd : fe2ScheduleCoreText.groupScheduleScreen_string_9d63ad76} {fe2ScheduleCoreText.groupScheduleScreen_jsxText_a137f17a}{' '}{fe2ScheduleCoreText.groupScheduleScreen_jsxText_a1f5d39a}{formatShortDate(preview.effectiveFrom)}
            {preview.endsOn ? fe2ScheduleCoreText.groupScheduleScreen_template_855e5a61(formatShortDate(preview.endsOn)) : ''}
          </Text>
          <Text c="dimmed" size="sm">
            {fe2ScheduleCoreText.groupScheduleScreen_jsxText_672a522d}{preview.impact.totalAffectedOccurrences}{fe2ScheduleCoreText.groupScheduleScreen_jsxText_901e768a}{formatExpiresAt(preview.expiresAt)}{fe2ScheduleCoreText.groupScheduleScreen_jsxText_cdb4ee2a}</Text>
        </Stack>
        {preview.warnings.length > 0 ? <WarningList warnings={preview.warnings} /> : null}
        {preview.impact.examples.length > 0 ? (
          <Stack gap={4}>
            <Text fw={800} size="sm">{fe2ScheduleCoreText.groupScheduleScreen_jsxText_4e848f28}</Text>
            {preview.impact.examples.slice(0, 3).map((occurrence) => (
              <Text c="dimmed" key={`${occurrence.lessonOccurrenceId}:${occurrence.lessonDate}`} size="sm">
                {formatShortDate(occurrence.lessonDate)} {fe2ScheduleCoreText.groupScheduleScreen_jsxText_a137f17a}{trimSeconds(occurrence.startTime)} {fe2ScheduleCoreText.groupScheduleScreen_jsxText_a137f17a}{occurrence.hallName}
              </Text>
            ))}
          </Stack>
        ) : null}
        {preview.impact.skipped.length > 0 ? (
          <Stack gap={4}>
            <Text fw={800} size="sm">{fe2ScheduleCoreText.groupScheduleScreen_jsxText_4c414dbf}</Text>
            {preview.impact.skipped.slice(0, 3).map((occurrence) => (
              <Text c="dimmed" key={`${occurrence.lessonOccurrenceId}:${occurrence.lessonDate}`} size="sm">
                {formatShortDate(occurrence.lessonDate)} {fe2ScheduleCoreText.groupScheduleScreen_jsxText_a137f17a}{formatSkippedReason(occurrence.reason)}
              </Text>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  )
}

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

function WarningList({ warnings }: { warnings: ScheduleWarning[] }) {
  return (
    <Alert color="yellow" icon={<IconAlertTriangle size={18} />}>
      <Stack gap={4}>
        {warnings.map((warning) => (
          <Text key={`${warning.code}:${warning.message}`} size="sm">
            {formatScheduleProblemCode(warning.code) ?? warning.message}
          </Text>
        ))}
      </Stack>
    </Alert>
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

function formatSkippedReason(reason: string) {
  return formatScheduleProblemCode(reason) ?? fe2ScheduleCoreText.groupScheduleScreen_string_d2da32db
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

function getScheduleRange(date: string, view: ScheduleViewMode) {
  if (view === 'day') {
    return { from: date, to: date }
  }

  const from = startOfIsoWeek(date)
  return { from, to: addIsoDays(from, 6) }
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

function readScheduleUrlState(): ScheduleUrlState {
  const params = new URLSearchParams(window.location.search)
  const dateParam = params.get('date')
  const viewParam = params.get('view')

  return {
    date: isRealIsoDate(dateParam) ? dateParam : todayIso(),
    view: viewParam === 'week' ? 'week' : 'day',
    branchId: readNullableParam(params, 'branchId'),
    hallId: readNullableParam(params, 'hallId'),
    trainerId: readNullableParam(params, 'trainerId'),
    groupId: readNullableParam(params, 'groupId'),
    groupTypeId: readNullableParam(params, 'groupTypeId'),
  }
}

function writeScheduleUrlState(
  state: ScheduleUrlState,
  options: { replace?: boolean } = {},
) {
  const params = new URLSearchParams()
  params.set('date', state.date)
  params.set('view', state.view)
  for (const key of FILTER_KEYS) {
    const value = state[key]
    if (value) {
      params.set(key, value)
    }
  }

  const nextPath = `/schedule?${params.toString()}`
  if (`${window.location.pathname}${window.location.search}` === nextPath) {
    return
  }

  if (options.replace) {
    window.history.replaceState(window.history.state, '', nextPath)
  } else {
    window.history.pushState(window.history.state, '', nextPath)
  }
}

function readNullableParam(params: URLSearchParams, key: string) {
  const value = params.get(key)?.trim()
  return value ? value : null
}

function pickScheduleFilters(state: ScheduleUrlState): ScheduleFilters {
  return {
    branchId: state.branchId,
    hallId: state.hallId,
    trainerId: state.trainerId,
    groupId: state.groupId,
    groupTypeId: state.groupTypeId,
  }
}

function emptyFilterOptions() {
  return {
    branches: [] as FilterOption[],
    halls: [] as FilterOption[],
    trainers: [] as FilterOption[],
    groups: [] as FilterOption[],
    groupTypes: [] as FilterOption[],
  }
}

function mapResponseFilterOptions(
  options: Awaited<ReturnType<typeof getScheduleLessons>>['filterOptions'],
) {
  return {
    branches: options.branches.map(toFilterOption),
    halls: options.halls.map(toFilterOption),
    trainers: options.trainers.map(toFilterOption),
    groups: options.groups.map(toFilterOption),
    groupTypes: options.groupTypes.map(toFilterOption),
  }
}

function toFilterOption(option: { id: string; name: string }) {
  return { value: option.id, label: option.name }
}

function countActiveFilters(filters: ScheduleFilters) {
  return FILTER_KEYS.filter((key) => Boolean(filters[key])).length
}

function sortLessons(items: readonly ScheduleLesson[]) {
  return [...items].sort((first, second) =>
    first.lessonDate.localeCompare(second.lessonDate) ||
    first.startTime.localeCompare(second.startTime) ||
    first.groupName.localeCompare(second.groupName, 'ru') ||
    first.lessonOccurrenceId.localeCompare(second.lessonOccurrenceId),
  )
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

function formatTimeRange(lesson: ScheduleLesson) {
  return `${trimSeconds(lesson.startTime)}-${trimSeconds(lesson.endTime)}`
}

function trimSeconds(value: string) {
  return value.match(/^\d{2}:\d{2}/)?.[0] ?? value
}

function formatLessonCount(count: number) {
  if (count === 1) return fe2ScheduleCoreText.groupScheduleScreen_string_404398f9
  if (count >= 2 && count <= 4) return fe2ScheduleCoreText.groupScheduleScreen_template_f806750d(count)
  return fe2ScheduleCoreText.groupScheduleScreen_template_73ed7940(count)
}

function formatWeekday(date: string) {
  return new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(parseIsoDate(date))
}

function formatLongWeekday(date: string) {
  return new Intl.DateTimeFormat('ru-RU', { weekday: 'long' }).format(parseIsoDate(date))
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(parseIsoDate(date))
}

function formatLongDate(date: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(parseIsoDate(date))
}

function formatExpiresAt(value: string) {
  const expiresAt = new Date(value)
  if (Number.isNaN(expiresAt.getTime())) {
    return fe2ScheduleCoreText.groupScheduleScreen_string_4371fe93
  }

  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(expiresAt)
}

function todayIso() {
  return formatIsoDate(new Date())
}

function isRealIsoDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  return formatIsoDate(parseIsoDate(value)) === value
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addIsoDays(value: string, days: number) {
  const date = parseIsoDate(value)
  date.setTime(date.getTime() + (days * DAY_MS))
  return formatIsoDate(date)
}

function startOfIsoWeek(value: string) {
  const date = parseIsoDate(value)
  const weekday = date.getDay() === 0 ? 7 : date.getDay()
  date.setDate(date.getDate() - weekday + 1)
  return formatIsoDate(date)
}
