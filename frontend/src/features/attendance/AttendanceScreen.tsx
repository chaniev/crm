import { useEffect, useRef, useState } from 'react'
import { Button, Stack, Text } from '@mantine/core'
import { IconCircleCheck, IconUsers, IconUsersGroup } from '@tabler/icons-react'
import {
  ApiError,
  getAttendanceGroupClients,
  getAttendanceGroups,
  getAttendanceLessonClients,
  saveAttendanceMarks,
  saveAttendanceLessonMarks,
  type AttendanceClient,
  type AttendanceGroup,
  type AttendanceState,
  type AuthenticatedUser,
} from '../../lib/api'
import type {
  ClientProfileOriginInput,
  ClientProfileReturnContext,
} from '../clients/clientProfileReturnState'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageLayout,
  PageSection,
  TaskToolbarActions,
  TaskToolbarRefreshAction,
} from '../shared/ux'
import { AttendanceClientRow } from './AttendanceClientRow'
import { AttendanceContextControls } from './AttendanceContextControls'
import { AttendanceProgress } from './AttendanceProgress'
import {
  AttendanceRosterViewControl,
  type AttendanceRosterView,
} from './AttendanceRosterViewControl'
import type { AttendanceClientRowState } from './types'

type AttendanceScreenProps = {
  initialReturnContext?: ClientProfileReturnContext | null
  lessonTarget?: AttendanceLessonTarget | null
  onOpenClient?: (clientId: string, origin: ClientProfileOriginInput) => void
  user: AuthenticatedUser
}

type AttendanceLessonTarget = {
  lessonOccurrenceId: string
  lessonDate: string
}

export function AttendanceScreen({
  initialReturnContext = null,
  lessonTarget = null,
  onOpenClient,
  user,
}: AttendanceScreenProps) {
  if (!lessonTarget) {
    return (
      <PageLayout data-testid="attendance-screen" showHeader={false} title="Посещения">
        <PageSection>
          <EmptyState
            action={<Button component="a" href="/schedule" variant="light">Открыть расписание</Button>}
            description="Выберите конкретное занятие в расписании и откройте его посещаемость."
            icon={<IconUsersGroup size={24} />}
            title="Посещаемость открывается из занятия"
          />
        </PageSection>
      </PageLayout>
    )
  }

  return (
    <PageLayout data-testid="attendance-screen" showHeader={false} title="Посещения">
      <AttendanceWorkspace
        initialReturnContext={initialReturnContext}
        lessonTarget={lessonTarget}
        onOpenClient={onOpenClient}
        user={user}
      />
    </PageLayout>
  )
}

type AttendanceWorkspaceProps = {
  initialReturnContext?: ClientProfileReturnContext | null
  lessonTarget?: AttendanceLessonTarget | null
  onOpenClient?: (clientId: string, origin: ClientProfileOriginInput) => void
  user: AuthenticatedUser
}

export function AttendanceWorkspace({
  initialReturnContext = null,
  lessonTarget = null,
  onOpenClient,
  user,
}: AttendanceWorkspaceProps) {
  const [groups, setGroups] = useState<AttendanceGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [groupsError, setGroupsError] = useState<string | null>(null)
  const [scopeChangeMessage, setScopeChangeMessage] = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [currentRosterGroupId, setCurrentRosterGroupId] = useState<string | null>(null)
  const [trainingDate, setTrainingDate] = useState('')
  const [today, setToday] = useState('')
  const [minTrainingDate, setMinTrainingDate] = useState<string | null>(null)
  const [maxTrainingDate, setMaxTrainingDate] = useState('')
  const [rows, setRows] = useState<Record<string, AttendanceClientRowState>>({})
  const [rosterLoading, setRosterLoading] = useState(false)
  const [rosterLoaded, setRosterLoaded] = useState(false)
  const [rosterError, setRosterError] = useState<string | null>(null)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [groupsReloadKey, setGroupsReloadKey] = useState(0)
  const [rosterView, setRosterView] = useState<AttendanceRosterView>('unmarked')
  const [rosterRefreshError, setRosterRefreshError] = useState(false)
  const [attendanceEditDeniedReason, setAttendanceEditDeniedReason] = useState<string | null>(null)
  const [returnFocusClientId, setReturnFocusClientId] = useState<string | null>(
    initialReturnContext?.origin.kind === 'attendance'
      ? initialReturnContext.origin.anchorClientId
      : null,
  )
  const contextVersionRef = useRef(0)
  const actionVersionsRef = useRef<Record<string, number>>({})
  const contextKeyRef = useRef('')
  const initialReturnContextAppliedRef = useRef(false)

  useEffect(() => {
    if (lessonTarget) {
      setGroupsLoading(false)
      setGroupsError(null)
      setGroups([])
      setSelectedGroupId(null)
      setTrainingDate(lessonTarget.lessonDate)
      return
    }

    const controller = new AbortController()

    async function loadGroups() {
      setGroupsLoading(true)
      setGroupsError(null)
      try {
        const response = await getAttendanceGroups(controller.signal)
        if (controller.signal.aborted) return
        const restored = getRestoredAttendanceContext(
          initialReturnContextAppliedRef.current ? null : initialReturnContext,
          response.groups,
          response.today,
          response.minTrainingDate,
          response.maxTrainingDate,
        )
        initialReturnContextAppliedRef.current = true

        setGroups(response.groups)
        setToday(response.today)
        setMinTrainingDate(response.minTrainingDate)
        setMaxTrainingDate(response.maxTrainingDate)
        if (restored) {
          setTrainingDate(restored.trainingDate)
          setRosterView(restored.rosterView)
          setScopeChangeMessage(restored.message)
          setReturnFocusClientId(restored.anchorClientId)
          setSelectedGroupId(restored.groupId)
        } else {
          setTrainingDate((currentDate) => currentDate || response.today)
          setSelectedGroupId((current) =>
            current && response.groups.some((group) => group.id === current)
              ? current
              : response.groups[0]?.id ?? null,
          )
        }
      } catch (error) {
        if (controller.signal.aborted) return
        setGroups([])
        setGroupsError(error instanceof Error ? error.message : 'Не удалось загрузить доступные группы для посещений.')
      } finally {
        if (!controller.signal.aborted) setGroupsLoading(false)
      }
    }

    void loadGroups()
    return () => controller.abort()
  }, [groupsReloadKey, initialReturnContext, lessonTarget])

  useEffect(() => {
    if ((!selectedGroupId && !lessonTarget) || !trainingDate) {
      setRows({})
      setRosterLoaded(false)
      setRosterError(null)
      setCurrentRosterGroupId(null)
      return
    }

    const controller = new AbortController()
    const contextVersion = ++contextVersionRef.current
    const contextKey = lessonTarget
      ? `${lessonTarget.lessonOccurrenceId}:${trainingDate}`
      : `${selectedGroupId}:${trainingDate}`
    const isContextChange = contextKeyRef.current !== contextKey
    contextKeyRef.current = contextKey
    if (isContextChange) {
      actionVersionsRef.current = {}
      setRows({})
      setRosterLoaded(false)
    }

    async function loadRoster() {
      setRosterLoading(true)
      setRosterError(null)
      try {
        const response = lessonTarget
          ? await getAttendanceLessonClients(
              lessonTarget.lessonOccurrenceId,
              trainingDate,
              controller.signal,
            )
          : await getAttendanceGroupClients(
              selectedGroupId!,
              trainingDate,
              controller.signal,
            )
        if (controller.signal.aborted || contextVersion !== contextVersionRef.current) return
        setTrainingDate(response.lessonDate ?? response.trainingDate)
        setCurrentRosterGroupId(response.groupId)
        setToday(response.today)
        setMinTrainingDate(response.minTrainingDate)
        setMaxTrainingDate(response.maxTrainingDate)
        setAttendanceEditDeniedReason(
          response.canEditAttendance && !response.canEditAttendance.allowed
            ? getAttendanceEditDeniedReason(response.canEditAttendance.reason)
            : null,
        )
        setRows((current) =>
          isContextChange
            ? buildRowState(response.clients)
            : mergeManualRefresh(current, response.clients),
        )
        setRosterRefreshError(false)
        setRosterLoaded(true)
      } catch (error) {
        if (controller.signal.aborted || contextVersion !== contextVersionRef.current) return
        setRows({})
        setRosterLoaded(false)
        if (isAttendanceGroupForbidden(error)) {
          handleScopeChanged()
          return
        }

        setRosterError(error instanceof Error ? error.message : 'Не удалось загрузить клиентов группы на выбранную дату.')
      } finally {
        if (!controller.signal.aborted && contextVersion === contextVersionRef.current) setRosterLoading(false)
      }
    }

    void loadRoster()
    return () => controller.abort()
  }, [lessonTarget, selectedGroupId, trainingDate, refreshVersion])

  async function saveClientState(clientId: string, attemptedState: AttendanceState) {
    if ((!selectedGroupId && !lessonTarget) || !trainingDate || attendanceEditDeniedReason) return
    const contextKey = lessonTarget
      ? `${lessonTarget.lessonOccurrenceId}:${trainingDate}`
      : `${selectedGroupId}:${trainingDate}`
    const actionVersion = (actionVersionsRef.current[clientId] ?? 0) + 1
    actionVersionsRef.current[clientId] = actionVersion

    setRows((current) => updateRow(current, clientId, (row) => ({
      ...row,
      displayedState: attemptedState,
      saveState: 'pending',
      attemptedState,
      errorMessage: null,
    })))

    try {
      const response = lessonTarget
        ? await saveAttendanceLessonMarks(lessonTarget.lessonOccurrenceId, {
            lessonDate: trainingDate,
            trainingDate,
            attendanceMarks: [{ clientId, state: attemptedState }],
          })
        : await saveAttendanceMarks(selectedGroupId!, {
            trainingDate,
            attendanceMarks: [{ clientId, state: attemptedState }],
          })
      if (contextKeyRef.current !== contextKey || actionVersionsRef.current[clientId] !== actionVersion) return
      setCurrentRosterGroupId(response.groupId)
      const authoritativeState = response.attendanceMarks.find((mark) => mark.clientId === clientId)?.state
      if (!authoritativeState) throw new Error('Сервер не вернул сохраненное состояние.')
      setMaxTrainingDate(response.maxTrainingDate)
      setToday(response.today)
      setMinTrainingDate(response.minTrainingDate)
      setRows((current) => updateRow(current, clientId, (row) => ({
        ...row,
        displayedState: authoritativeState,
        persistedState: authoritativeState,
        saveState: 'saved',
        attemptedState: null,
        errorMessage: null,
      })))
      void refreshRosterAfterSave(trainingDate, contextKey, clientId, actionVersion)
    } catch (error) {
      if (contextKeyRef.current !== contextKey || actionVersionsRef.current[clientId] !== actionVersion) return
      if (isAttendanceGroupForbidden(error)) {
        handleScopeChanged()
        return
      }

      setRows((current) => updateRow(current, clientId, (row) => ({
        ...row,
        saveState: 'failed',
        attemptedState,
        errorMessage: error instanceof Error ? error.message : 'Не удалось сохранить отметку.',
      })))
    }
  }

  async function refreshRosterAfterSave(
    date: string,
    contextKey: string,
    clientId: string,
    actionVersion: number,
  ) {
    try {
      const response = lessonTarget
        ? await getAttendanceLessonClients(lessonTarget.lessonOccurrenceId, date)
        : await getAttendanceGroupClients(selectedGroupId!, date)
      if (
        contextKeyRef.current !== contextKey ||
        actionVersionsRef.current[clientId] !== actionVersion
      ) return
      setRows((current) => mergeRefreshedRows(current, response.clients))
      setCurrentRosterGroupId(response.groupId)
      setMaxTrainingDate(response.maxTrainingDate)
      setToday(response.today)
      setMinTrainingDate(response.minTrainingDate)
      setRosterRefreshError(false)
    } catch {
      if (
        contextKeyRef.current !== contextKey ||
        actionVersionsRef.current[clientId] !== actionVersion
      ) return
      setRosterRefreshError(true)
    }
  }

  function changeContext(nextGroupId: string | null, nextDate: string) {
    if (lessonTarget) {
      setTrainingDate(nextDate)
      return
    }

    const nextKey = nextGroupId && nextDate ? `${nextGroupId}:${nextDate}` : ''
    if (nextKey !== contextKeyRef.current) {
      contextKeyRef.current = nextKey
      contextVersionRef.current += 1
      actionVersionsRef.current = {}
      setRows({})
      setRosterLoaded(false)
      setCurrentRosterGroupId(null)
      setRosterError(null)
      setRosterView('unmarked')
      setRosterRefreshError(false)
    }
    setSelectedGroupId(nextGroupId)
    setTrainingDate(nextDate)
  }

  function handleScopeChanged() {
    contextVersionRef.current += 1
    actionVersionsRef.current = {}
    setSelectedGroupId(null)
    setCurrentRosterGroupId(null)
    setRows({})
    setRosterLoaded(false)
    setRosterLoading(false)
    setRosterError(null)
    setRosterRefreshError(false)
    setScopeChangeMessage('Доступ к группе изменился')
    setGroupsReloadKey((key) => key + 1)
  }

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null
  const allRows = Object.values(rows)
  const visibleRows = rosterView === 'all'
    ? allRows
    : allRows.filter((row) => row.persistedState === 'Unmarked')
  const markedCount = allRows.filter((row) => row.persistedState !== 'Unmarked').length
  const hasPendingSave = allRows.some((row) => row.saveState === 'pending')
  const refreshRoster = () => setRefreshVersion((current) => current + 1)
  const progressControl = selectedGroup ? (
    <AttendanceProgress compact marked={markedCount} total={allRows.length} />
  ) : undefined
  const rosterViewControl = selectedGroup ? (
    <AttendanceRosterViewControl compact onChange={setRosterView} value={rosterView} />
  ) : undefined
  const refreshAction = selectedGroup ? (
    <TaskToolbarActions
      className="attendance-roster-refresh"
      frequentActions={(
        <TaskToolbarRefreshAction
          disabled={hasPendingSave}
          label="Обновить список"
          loading={rosterLoading && rosterLoaded}
          onClick={refreshRoster}
        />
      )}
    />
  ) : null

  useEffect(() => {
    if (!returnFocusClientId || rosterLoading || !rosterLoaded) {
      return
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      const action = document.querySelector<HTMLElement>(
        `[data-client-profile-action-id="${escapeCssIdentifier(returnFocusClientId)}"]`,
      )
      const fallback =
        document.querySelector<HTMLElement>('[data-testid="attendance-roster-view-control"] input:checked') ??
        document.querySelector<HTMLElement>('[data-testid="attendance-roster-view-control"] input') ??
        document.querySelector<HTMLElement>('[data-testid="attendance-roster"]')

      action?.scrollIntoView({ block: 'center' })
      ;(action ?? fallback)?.focus({ preventScroll: true })
      setReturnFocusClientId(null)
    })

    return () => window.cancelAnimationFrame(animationFrameId)
  }, [returnFocusClientId, rosterLoaded, rosterLoading, visibleRows])

  function openClient(clientId: string) {
    if ((!selectedGroupId && !lessonTarget) || !trainingDate || !onOpenClient) {
      return
    }
    const row = rows[clientId]
    const originGroupId = selectedGroupId ?? currentRosterGroupId ?? row?.client.groups[0]?.id
    if (!originGroupId) {
      return
    }

    onOpenClient(clientId, {
      kind: 'attendance',
      route: lessonTarget
        ? {
            kind: 'attendanceLesson',
            lessonOccurrenceId: lessonTarget.lessonOccurrenceId,
            lessonDate: trainingDate,
          }
        : { kind: 'section', section: 'Attendance' },
      groupId: originGroupId,
      lessonOccurrenceId: lessonTarget?.lessonOccurrenceId,
      lessonDate: lessonTarget ? trainingDate : undefined,
      trainingDate,
      rosterView,
      anchorClientId: clientId,
    })
  }

  return (
    <Stack data-testid="attendance-workspace" gap="var(--page-section-gap)">
      {lessonTarget ? (
        <PageSection>
          <Stack gap={4}>
            <Text fw={800}>Посещаемость занятия</Text>
            <Text c="dimmed" size="sm">
              {formatAttendanceLessonContext(trainingDate)}
            </Text>
          </Stack>
        </PageSection>
      ) : null}
      {groupsError ? (
        <PageSection>
          <ErrorState
            action={<Button onClick={() => setGroupsReloadKey((key) => key + 1)} variant="light">Повторить загрузку групп</Button>}
            message={groupsError}
            title="Группы для посещений не загрузились"
          />
        </PageSection>
      ) : null}
      {scopeChangeMessage ? (
        <PageSection>
          <ErrorState message="Список доступных групп обновлен." title={scopeChangeMessage} />
        </PageSection>
      ) : null}
      {groupsLoading ? <PageSection><LoadingState label="Загружаем доступные группы..." /></PageSection> : null}
      {!lessonTarget && !groupsLoading && !groupsError && groups.length === 0 ? (
        <PageSection>
          <EmptyState
            description={getEmptyAttendanceDescription(user)}
            icon={<IconUsersGroup size={24} />}
            title={getEmptyAttendanceTitle(user)}
          />
        </PageSection>
      ) : null}

      {!groupsLoading && !groupsError && groups.length > 0 ? (
        <AttendanceContextControls
          groups={groups}
          minTrainingDate={minTrainingDate}
          maxTrainingDate={maxTrainingDate}
          onGroupChange={(groupId) => changeContext(groupId, trainingDate)}
          onTrainingDateChange={(value) => {
            if (
              !value ||
              (
                value <= maxTrainingDate &&
                (!minTrainingDate || value >= minTrainingDate)
              )
            ) {
              changeContext(selectedGroupId, value)
            }
          }}
          progress={progressControl}
          refreshAction={refreshAction}
          rosterViewControl={rosterViewControl}
          selectedGroupId={selectedGroupId}
          trainingDate={trainingDate}
          today={today}
        />
      ) : null}

      {!groupsLoading && !groupsError && (selectedGroup || lessonTarget) ? (
        <PageSection className="attendance-roster-section" variant="plain">
          <Stack gap="lg">
            {attendanceEditDeniedReason ? (
              <Text c="dimmed" fw={600} size="sm">
                {attendanceEditDeniedReason}
              </Text>
            ) : null}
            {rosterRefreshError ? (
              <div aria-live="polite" className="attendance-roster-stale">
                <Text fw={600} size="sm">Не удалось обновить список после сохранения.</Text>
                <Button onClick={refreshRoster} variant="light">Повторить обновление списка</Button>
              </div>
            ) : null}
            {rosterError ? <ErrorState message={rosterError} title="Список клиентов не загрузился" /> : null}
            {rosterLoading && !rosterLoaded ? <LoadingState label="Загружаем состав группы..." /> : null}
            {!rosterLoading && !rosterError && rosterLoaded && allRows.length === 0 ? (
              <EmptyState description="Состав группы на эту дату пуст." icon={<IconUsers size={24} />} title="В выбранной группе пока нет клиентов" />
            ) : null}
            {!rosterLoading && !rosterError && rosterLoaded && allRows.length > 0 && visibleRows.length === 0 && rosterView === 'unmarked' ? (
              <div aria-live="polite">
                <EmptyState
                  action={<Button onClick={() => setRosterView('all')} variant="light">Показать всех</Button>}
                  description="Можно проверить сохраненные отметки или изменить их в полном списке."
                  icon={<IconCircleCheck size={24} />}
                  title="Все клиенты отмечены"
                />
              </div>
            ) : null}
            {rosterLoaded && visibleRows.length > 0 ? (
              <Stack data-testid="attendance-roster" gap="sm">
                {visibleRows.map((row) => (
                  <AttendanceClientRow
                    key={row.client.id}
                    disabledReason={attendanceEditDeniedReason}
                    onChange={(state) => void saveClientState(row.client.id, state)}
                    onOpenClient={onOpenClient ? openClient : undefined}
                    onRetry={() => row.attemptedState && void saveClientState(row.client.id, row.attemptedState)}
                    row={row}
                  />
                ))}
              </Stack>
            ) : null}
          </Stack>
        </PageSection>
      ) : null}
    </Stack>
  )
}

type RestoredAttendanceContext = {
  anchorClientId: string
  groupId: string
  message: string | null
  rosterView: AttendanceRosterView
  trainingDate: string
}

function getRestoredAttendanceContext(
  context: ClientProfileReturnContext | null,
  groups: AttendanceGroup[],
  today: string,
  minTrainingDate: string | null,
  maxTrainingDate: string,
): RestoredAttendanceContext | null {
  if (
    context?.origin.kind !== 'attendance' ||
    context.origin.route.kind !== 'section' ||
    groups.length === 0
  ) {
    return null
  }

  const origin = context.origin
  const groupAllowed = groups.some((group) => group.id === origin.groupId)
  const dateAllowed = isTrainingDateAllowed(
    origin.trainingDate,
    minTrainingDate,
    maxTrainingDate,
  )
  const groupId = groupAllowed ? origin.groupId : groups[0]?.id
  const trainingDate = dateAllowed ? origin.trainingDate : today

  if (!groupId || !trainingDate) {
    return null
  }

  const changedFields = [
    groupAllowed ? null : 'группа изменена',
    dateAllowed ? null : 'дата изменена',
  ].filter(Boolean)
  const message =
    changedFields.length === 0
      ? null
      : `${changedFields.join(' и ')}. Контекст посещений выбран заново.`

  return {
    anchorClientId: origin.anchorClientId,
    groupId,
    message,
    rosterView: origin.rosterView,
    trainingDate,
  }
}

function isTrainingDateAllowed(
  trainingDate: string,
  minTrainingDate: string | null,
  maxTrainingDate: string,
) {
  return (
    trainingDate <= maxTrainingDate &&
    (!minTrainingDate || trainingDate >= minTrainingDate)
  )
}

function escapeCssIdentifier(value: string) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value)
  }

  return value.replace(/["\\]/g, '\\$&')
}

function buildRowState(clients: AttendanceClient[]): Record<string, AttendanceClientRowState> {
  return Object.fromEntries(clients.map((client) => [client.id, {
    client,
    displayedState: client.state,
    persistedState: client.state,
    saveState: 'idle' as const,
    attemptedState: null,
    errorMessage: null,
  }]))
}

function updateRow(
  rows: Record<string, AttendanceClientRowState>,
  clientId: string,
  update: (row: AttendanceClientRowState) => AttendanceClientRowState,
) {
  const row = rows[clientId]
  return row ? { ...rows, [clientId]: update(row) } : rows
}

function mergeRefreshedRows(
  rows: Record<string, AttendanceClientRowState>,
  clients: AttendanceClient[],
) {
  const refreshed = new Map(clients.map((client) => [client.id, client]))
  return Object.fromEntries(Object.entries(rows).map(([clientId, row]) => {
    const client = refreshed.get(clientId)
    if (!client) return [clientId, row]
    return [clientId, { ...row, client: { ...client, state: row.persistedState } }]
  }))
}

function mergeManualRefresh(
  rows: Record<string, AttendanceClientRowState>,
  clients: AttendanceClient[],
) {
  const next = buildRowState(clients)
  for (const [clientId, row] of Object.entries(rows)) {
    if (row.saveState === 'pending' || row.saveState === 'failed') {
      const refreshedClient = next[clientId]?.client
      next[clientId] = refreshedClient
        ? { ...row, client: { ...refreshedClient, state: row.persistedState } }
        : row
    }
  }
  return next
}

function getEmptyAttendanceTitle(user: AuthenticatedUser) {
  if (user.role === 'Administrator') {
    return 'Нет групп для отметки посещений'
  }

  if (user.role === 'Coach') {
    return 'Назначенные группы отсутствуют'
  }

  return 'Доступные группы пока отсутствуют'
}

function getEmptyAttendanceDescription(user: AuthenticatedUser) {
  if (user.role === 'Administrator') {
    return 'Главный тренер или суперадминистратор назначит группы, после этого они появятся здесь.'
  }

  if (user.role === 'Coach') {
    return 'Когда вам назначат группу, экран посещений автоматически покажет рабочий список.'
  }

  return 'Создайте группу и добавьте в нее клиентов, чтобы открыть сценарий отметки посещений.'
}

function isAttendanceGroupForbidden(error: unknown) {
  return error instanceof ApiError && error.status === 403
}

function getAttendanceEditDeniedReason(reason: string | null) {
  switch (reason) {
    case 'future-lesson':
    case 'attendance-future-read-only':
      return 'Будущее занятие доступно только для просмотра.'
    case 'lesson-cancelled':
      return 'Отмененное занятие доступно только для просмотра.'
    case 'forbidden':
    case 'attendance-forbidden':
      return 'Сервер не разрешил изменять посещаемость этого занятия.'
    default:
      return reason
        ? `Редактирование недоступно: ${reason}.`
        : 'Редактирование посещаемости недоступно.'
  }
}

function formatAttendanceLessonContext(lessonDate: string) {
  return `Дата ${lessonDate}`
}
