import { useState } from 'react'
import { Alert, Button, Stack } from '@mantine/core'
import { IconCheck } from '@tabler/icons-react'
import type { AuthenticatedUser, ScheduleLesson } from '../lib/api'
import type { AppRoute, RouteAccessResolution } from '../lib/appRoutes'
import type { ClientProfileOriginInput, ClientProfileReturnContext } from '../features/clients/clientProfileReturnState'
import type { ClientListReturnSnapshot } from '../features/clients/list/clientListReturnState'
import type { GroupListReturnSnapshot } from '../features/groups/groupListReturnState'
import {
  ClientCreateScreen,
  ClientDetailScreen,
  ClientEditScreen,
  ClientsListScreen,
} from '../features/clients/ClientManagement'
import { AttendanceScreen } from '../features/attendance/AttendanceScreen'
import { AttentionDashboard } from '../features/attention/AttentionDashboard'
import {
  GroupScheduleScreen,
  ScheduleLessonChangeRouteScreen,
  ScheduleLessonCreateScreen,
  ScheduleLessonDetailScreen,
  ScheduleSeriesEditScreen,
} from '../features/schedule/GroupScheduleScreen'
import {
  GroupCreateScreen,
  GroupEditScreen,
  GroupsListScreen,
} from '../features/groups/GroupManagement'
import {
  UserCreateScreen,
  UserEditScreen,
  UsersListScreen,
  type TrainerListReturnRequest,
} from '../features/users/UserManagement'
import {
  DEFAULT_TRAINER_LIST_FILTERS,
  type TrainerListFilters,
} from '../features/users/trainerListSearch'
import { AuditLogScreen } from '../features/audit/AuditLogScreen'
import { FinanceReportsScreen } from '../features/finance/FinanceReportsScreen'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { PageLayout, PageSection } from '../features/shared/ux'
import { RestrictedState } from '../features/shared/RestrictedState'
import { fe1AppShellAuthText } from '../resources/fe-1-app-shell-auth'


type RouteViewportProps = {
  route: Exclude<AppRoute, { kind: 'password' }>
  user: AuthenticatedUser
  currentUserId: string
  onCreateGroup: () => void
  onCreateScheduleLesson: () => void
  onEditScheduleLesson: (lessonOccurrenceId: string, lessonDate: string) => void
  onEditScheduleSeries: (lesson: ScheduleLesson, scope: 'this-and-future' | 'entire') => void
  onMoveScheduleLesson: (lessonOccurrenceId: string, lessonDate: string) => void
  onOpenAttendanceLesson: (lessonOccurrenceId: string, lessonDate: string) => void
  onOpenAttendanceTodayLesson: (lessonOccurrenceId: string, lessonDate: string) => void
  onOpenScheduleLesson: (lessonOccurrenceId: string, lessonDate: string) => void
  onEditGroup: (
    groupId: string,
    returnSnapshot?: GroupListReturnSnapshot | null,
  ) => void
  onCreateClient: () => void
  onEditClient: (clientId: string) => void
  clientListReturnSnapshot: ClientListReturnSnapshot | null
  clientProfileReturnContext: ClientProfileReturnContext | null
  clientProfileReturnLabel: string
  groupListReturnSnapshot: GroupListReturnSnapshot | null
  onOpenClient: (
    clientId: string,
    returnSnapshotOrOrigin?: ClientListReturnSnapshot | ClientProfileOriginInput | null,
  ) => void
  onPreviewClient: (
    clientId: string,
    returnSnapshot?: ClientListReturnSnapshot | null,
  ) => void
  onCreateUser: () => void
  onEditUser: (userId: string) => void
  onRefreshSession: () => Promise<unknown>
  onReturnToClients: () => void
  onReturnToGroups: () => void
  onReturnToSchedule: () => void
  onReturnToUsers: () => void
  onSaveClientListReturnState: (snapshot: ClientListReturnSnapshot) => void
  onSaveGroupListReturnState: (snapshot: GroupListReturnSnapshot) => void
}

export function RouteViewport({
  route,
  user,
  currentUserId,
  clientListReturnSnapshot,
  clientProfileReturnContext,
  clientProfileReturnLabel,
  groupListReturnSnapshot,
  onCreateClient,
  onEditClient,
  onOpenClient,
  onOpenAttendanceLesson,
  onOpenAttendanceTodayLesson,
  onOpenScheduleLesson,
  onPreviewClient,
  onCreateGroup,
  onCreateScheduleLesson,
  onEditScheduleLesson,
  onEditScheduleSeries,
  onMoveScheduleLesson,
  onEditGroup,
  onCreateUser,
  onEditUser,
  onRefreshSession,
  onReturnToClients,
  onReturnToGroups,
  onReturnToSchedule,
  onReturnToUsers,
  onSaveClientListReturnState,
  onSaveGroupListReturnState,
}: RouteViewportProps) {
  const isUsersWorkflow =
    route.kind === 'userCreate' ||
    route.kind === 'userEdit' ||
    (route.kind === 'section' && route.section === 'Users')

  if (isUsersWorkflow) {
    return (
      <UsersWorkflowViewport
        currentUserId={currentUserId}
        onCreateUser={onCreateUser}
        onEditUser={onEditUser}
        onRefreshSession={onRefreshSession}
        onReturnToUsers={onReturnToUsers}
        route={route}
      />
    )
  }

  if (route.kind === 'clientCreate') {
    return (
      <ClientCreateScreen
        onCancel={onReturnToClients}
        onCreated={(clientId) => {
          if (clientId) {
            onOpenClient(clientId)
            return
          }

          onReturnToClients()
        }}
      />
    )
  }

  if (route.kind === 'clientDetails') {
    return (
      <ClientDetailScreen
        canManage={user.permissions.canManageClients}
        backLabel={clientProfileReturnLabel}
        clientId={route.clientId}
        onBack={onReturnToClients}
        onEdit={onEditClient}
      />
    )
  }

  if (route.kind === 'clientPreview') {
    return (
      <ClientsListScreen
        canManage={user.permissions.canManageClients}
        canSeeWithoutGroupQuickFilter={user.permissions.canManageClients}
        currentUserBranchId={user.branchId}
        initialReturnSnapshot={clientListReturnSnapshot}
        key={`client-preview:${route.clientId}`}
        onCreate={onCreateClient}
        onOpen={onOpenClient}
        onPreview={onPreviewClient}
        previewClientId={route.clientId}
        onSaveReturnState={onSaveClientListReturnState}
      />
    )
  }

  if (route.kind === 'clientEdit') {
    return (
      <ClientEditScreen
        clientId={route.clientId}
        onBack={() => onOpenClient(route.clientId)}
        onUpdated={onOpenClient}
      />
    )
  }

  if (route.kind === 'groupCreate') {
    return (
      <GroupCreateScreen
        onCancel={onReturnToGroups}
        onCreated={onReturnToGroups}
      />
    )
  }

  if (route.kind === 'groupEdit') {
    return (
      <GroupEditScreen
        groupId={route.groupId}
        initialReturnContext={clientProfileReturnContext}
        onBack={onReturnToGroups}
        onOpenClient={onOpenClient}
        onUpdated={onReturnToGroups}
      />
    )
  }

  if (route.kind === 'attendanceLesson') {
    return (
      <AttendanceScreen
        initialReturnContext={clientProfileReturnContext}
        lessonTarget={{
          lessonOccurrenceId: route.lessonOccurrenceId,
          lessonDate: route.lessonDate,
        }}
        onOpenClient={onOpenClient}
        user={user}
      />
    )
  }

  if (route.kind === 'scheduleLessonDetail') {
    return (
      <ScheduleLessonDetailScreen
        lessonDate={route.lessonDate}
        lessonOccurrenceId={route.lessonOccurrenceId}
        onEditLesson={onEditScheduleLesson}
        onEditSeries={onEditScheduleSeries}
        onMoveLesson={onMoveScheduleLesson}
        onOpenAttendance={onOpenAttendanceLesson}
        onOpenLessonDetail={onOpenScheduleLesson}
      />
    )
  }

  if (route.kind === 'scheduleLessonCreate') {
    return (
      <ScheduleLessonCreateScreen
        onBack={onReturnToSchedule}
        onCreated={(lesson) => onOpenScheduleLesson(lesson.lessonOccurrenceId, lesson.lessonDate)}
      />
    )
  }

  if (route.kind === 'scheduleLessonEdit') {
    return (
      <ScheduleLessonChangeRouteScreen
        lessonDate={route.lessonDate}
        lessonOccurrenceId={route.lessonOccurrenceId}
        mode="edit"
        onBack={onReturnToSchedule}
        onChanged={(lesson) => onOpenScheduleLesson(lesson.lessonOccurrenceId, lesson.lessonDate)}
      />
    )
  }

  if (route.kind === 'scheduleLessonMove') {
    return (
      <ScheduleLessonChangeRouteScreen
        lessonDate={route.lessonDate}
        lessonOccurrenceId={route.lessonOccurrenceId}
        mode="move"
        onBack={onReturnToSchedule}
        onChanged={(lesson) => onOpenScheduleLesson(lesson.lessonOccurrenceId, lesson.lessonDate)}
      />
    )
  }

  if (route.kind === 'scheduleSeriesEdit') {
    return (
      <ScheduleSeriesEditScreen
        groupId={route.groupId}
        lessonDate={route.lessonDate}
        lessonSeriesId={route.lessonSeriesId}
        lessonOccurrenceId={route.lessonOccurrenceId}
        onBack={onReturnToSchedule}
        onSaved={() => {
          if (route.lessonOccurrenceId && route.lessonDate) {
            onOpenScheduleLesson(route.lessonOccurrenceId, route.lessonDate)
            return
          }

          onReturnToSchedule()
        }}
        scope={route.scope}
      />
    )
  }

  if (route.section === 'Clients') {
    return (
      <ClientsListScreen
        canManage={user.permissions.canManageClients}
        canSeeWithoutGroupQuickFilter={user.permissions.canManageClients}
        currentUserBranchId={user.branchId}
        initialReturnSnapshot={clientListReturnSnapshot}
        key="clients-list"
        onCreate={onCreateClient}
        onOpen={onOpenClient}
        onPreview={onPreviewClient}
        onSaveReturnState={onSaveClientListReturnState}
      />
    )
  }

  if (route.section === 'Groups') {
    return (
      <GroupsListScreen
        initialReturnSnapshot={groupListReturnSnapshot}
        onCreate={onCreateGroup}
        onEdit={onEditGroup}
        onSaveReturnState={onSaveGroupListReturnState}
      />
    )
  }

  if (route.section === 'Schedule') {
    return (
      <GroupScheduleScreen
        canManageGroups={user.permissions.canManageGroups}
        onCreateLesson={onCreateScheduleLesson}
        onEditLesson={onEditScheduleLesson}
        onEditSeries={onEditScheduleSeries}
        onMoveLesson={onMoveScheduleLesson}
        onOpenAttendance={onOpenAttendanceLesson}
        onOpenLessonDetail={onOpenScheduleLesson}
        onEditGroup={onEditGroup}
        viewerRole={user.role}
      />
    )
  }

  if (route.section === 'Audit') {
    return <AuditLogScreen user={user} />
  }

  if (route.section === 'Finance') {
    return <FinanceReportsScreen user={user} />
  }

  if (route.section === 'Settings') {
    return <SettingsScreen user={user} />
  }

  if (route.section === 'Attendance') {
    return (
      <AttendanceScreen
        initialReturnContext={clientProfileReturnContext}
        onOpenClient={onOpenClient}
        onOpenLesson={onOpenAttendanceTodayLesson}
        user={user}
      />
    )
  }

  if (route.section === 'Attention') {
    return (
      <AttentionDashboard
        onOpenClient={onOpenClient}
      />
    )
  }

  return <SectionPlaceholder />
}

type UsersWorkflowViewportProps = {
  currentUserId: string
  onCreateUser: () => void
  onEditUser: (userId: string) => void
  onRefreshSession: () => Promise<unknown>
  onReturnToUsers: () => void
  route: Exclude<AppRoute, { kind: 'password' }>
}

function UsersWorkflowViewport({
  currentUserId,
  onCreateUser,
  onEditUser,
  onRefreshSession,
  onReturnToUsers,
  route,
}: UsersWorkflowViewportProps) {
  const [trainerQuery, setTrainerQuery] = useState('')
  const [trainerFilters, setTrainerFilters] = useState<TrainerListFilters>(
    DEFAULT_TRAINER_LIST_FILTERS,
  )
  const [returnFocusRequest, setReturnFocusRequest] =
    useState<TrainerListReturnRequest | null>(null)

  function editTrainerFromList(userId: string) {
    setReturnFocusRequest({
      trainerId: userId,
      scrollY: window.scrollY,
    })
    onEditUser(userId)
  }

  function returnFromTrainerEdit() {
    setReturnFocusRequest((currentRequest) => currentRequest ?? {
      trainerId: null,
      scrollY: 0,
    })
    onReturnToUsers()
  }

  if (route.kind === 'userCreate') {
    return (
      <UserCreateScreen
        onCancel={onReturnToUsers}
        onCreated={onReturnToUsers}
      />
    )
  }

  if (route.kind === 'userEdit') {
    return (
      <UserEditScreen
        currentUserId={currentUserId}
        onBack={returnFromTrainerEdit}
        onRefreshSession={onRefreshSession}
        userId={route.userId}
      />
    )
  }

  return (
    <UsersListScreen
      filters={trainerFilters}
      onCreate={onCreateUser}
      onEdit={editTrainerFromList}
      onFiltersChange={setTrainerFilters}
      onQueryChange={setTrainerQuery}
      onReturnFocusConsumed={() => setReturnFocusRequest(null)}
      query={trainerQuery}
      returnFocusRequest={returnFocusRequest}
    />
  )
}

type RouteAccessStateProps = {
  access: Extract<RouteAccessResolution, { kind: 'restricted' }>
  onRecovery: () => void
}

export function RouteAccessState({ access, onRecovery }: RouteAccessStateProps) {
  const description =
    access.reason.kind === 'section'
      ? fe1AppShellAuthText.routeViewport_template_c832959f(access.requestedDestinationLabel)
      : fe1AppShellAuthText.routeViewport_template_4bb78ad0(access.requestedDestinationLabel)

  return (
    <PageLayout
      className="route-state-layout"
      renderHiddenHeading={false}
      showHeader={false}
      title={fe1AppShellAuthText.routeViewport_title_28e033b4}
    >
      <RestrictedState
        className="route-state"
        description={description}
        focusOnMount="heading"
        primaryAction={(
          <Button fullWidth onClick={onRecovery}>
            {fe1AppShellAuthText.routeViewport_jsxText_ea1f4082}{access.recoveryLabel}
          </Button>
        )}
        title={fe1AppShellAuthText.routeViewport_title_28e033b4}
        titleOrder={1}
      />
    </PageLayout>
  )
}

type RouteNotFoundStateProps = {
  onRecovery: () => void
  recoveryLabel: string
}

export function RouteNotFoundState({
  onRecovery,
  recoveryLabel,
}: RouteNotFoundStateProps) {
  return (
    <PageLayout
      className="route-state-layout"
      renderHiddenHeading={false}
      showHeader={false}
      title={fe1AppShellAuthText.routeViewport_title_af9d3306}
    >
      <RestrictedState
        className="route-state"
        description={fe1AppShellAuthText.routeViewport_description_b66231cd}
        focusOnMount="heading"
        primaryAction={(
          <Button fullWidth onClick={onRecovery}>
            {fe1AppShellAuthText.routeViewport_jsxText_ea1f4082}{recoveryLabel}
          </Button>
        )}
        title={fe1AppShellAuthText.routeViewport_title_af9d3306}
        titleOrder={1}
      />
    </PageLayout>
  )
}

function SectionPlaceholder() {
  return (
    <PageLayout title={fe1AppShellAuthText.routeViewport_title_cd7d7203}>
      <PageSection>
        <Stack gap="md">
          <Alert
            color="blue"
            icon={<IconCheck size={18} />}
            title={fe1AppShellAuthText.routeViewport_title_8b737d65}
            variant="light"
          >
            {fe1AppShellAuthText.routeViewport_jsxText_d1441734}</Alert>
        </Stack>
      </PageSection>
    </PageLayout>
  )
}
