import {
  API_ENDPOINTS,
  ATTENDANCE_CLIENT_PAYLOAD_KEYS,
  ATTENDANCE_GROUP_PAYLOAD_KEYS,
  DEFAULT_CLIENT_GROUP_NAME,
} from './endpoints'
import {
  buildDisplayNameFromParts,
  deriveHasActivePaidMembership,
  deriveMembershipWarning,
  mapClientGroups,
  mapClientMembership,
  mapClientPhoto,
  normalizeIsoDateValue,
} from './mappers'
import {
  extractArrayPayload,
  extractRecordPayload,
  isRecord,
  readBoolean,
  readString,
} from './read-helpers'
import { request } from './transport'
import type {
  AttendanceClient,
  AttendanceClientPayload,
  AttendanceGroup,
  AttendanceGroupPayload,
  AttendanceRosterResponse,
  ClientResponsePayload,
  SaveAttendanceMarksRequest,
} from './types'

export async function getAttendanceGroups(signal?: AbortSignal) {
  const payload = await request<unknown>(API_ENDPOINTS.attendance.groups, { signal })

  return extractArrayPayload<AttendanceGroupPayload>(
    payload,
    ATTENDANCE_GROUP_PAYLOAD_KEYS,
  )
    .map(mapAttendanceGroup)
    .filter((group): group is AttendanceGroup => group !== null)
}

export async function getAttendanceGroupClients(
  groupId: string,
  trainingDate: string,
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams()
  searchParams.set('trainingDate', trainingDate)

  const payload = await request<unknown>(
    `${API_ENDPOINTS.attendance.groupClients(groupId)}?${searchParams.toString()}`,
    { signal },
  )

  const responseGroupId =
    (isRecord(payload)
      ? readString(payload, ['groupId', 'GroupId'])
      : undefined) ?? groupId
  const responseTrainingDate =
    normalizeIsoDateValue(
      (isRecord(payload)
        ? readString(payload, ['trainingDate', 'TrainingDate'])
        : undefined) ?? trainingDate,
    ) ?? trainingDate

  return {
    groupId: responseGroupId,
    trainingDate: responseTrainingDate,
    clients: extractArrayPayload<AttendanceClientPayload>(
      payload,
      ATTENDANCE_CLIENT_PAYLOAD_KEYS,
    )
      .map((client) => mapAttendanceClient(client, responseTrainingDate))
      .filter((client): client is AttendanceClient => client !== null),
  } satisfies AttendanceRosterResponse
}

export async function saveAttendanceMarks(
  groupId: string,
  payload: SaveAttendanceMarksRequest,
) {
  await request<unknown>(API_ENDPOINTS.attendance.groupMarks(groupId), {
    method: 'POST',
    body: JSON.stringify({
      TrainingDate: payload.trainingDate,
      AttendanceMarks: payload.attendanceMarks.map((mark) => ({
        ClientId: mark.clientId,
        IsPresent: mark.isPresent,
      })),
    }),
  })
}

function mapAttendanceGroup(payload: AttendanceGroupPayload): AttendanceGroup | null {
  const id =
    payload.id?.trim() ??
    payload.groupId?.trim() ??
    ''

  if (!id) {
    return null
  }

  return {
    id,
    name:
      payload.name?.trim() ??
      payload.groupName?.trim() ??
      DEFAULT_CLIENT_GROUP_NAME,
    trainingStartTime: payload.trainingStartTime?.trim() ?? undefined,
    scheduleText: payload.scheduleText?.trim() ?? undefined,
    clientCount:
      typeof payload.clientCount === 'number' ? payload.clientCount : undefined,
  }
}

function mapAttendanceClient(
  payload: AttendanceClientPayload,
  trainingDate: string,
): AttendanceClient | null {
  if (!isRecord(payload)) {
    return null
  }

  const id =
    readString(payload, ['clientId', 'ClientId', 'id', 'Id']) ?? ''

  if (!id) {
    return null
  }

  const fullName =
    readString(payload, ['fullName', 'FullName']) ??
    buildDisplayNameFromParts(
      readString(payload, ['lastName', 'LastName']),
      readString(payload, ['firstName', 'FirstName']),
      readString(payload, ['middleName', 'MiddleName']),
    ) ??
    'Без имени'
  const currentMembership = mapClientMembership(
    extractRecordPayload(payload, [
      'currentMembership',
      'CurrentMembership',
      'membership',
      'Membership',
      'membershipData',
      'MembershipData',
    ]),
  )
  const warningMessage =
    readString(payload, [
      'warning',
      'Warning',
      'warningMessage',
      'WarningMessage',
      'membershipWarningMessage',
      'MembershipWarningMessage',
      'membershipStatusMessage',
      'MembershipStatusMessage',
    ]) ?? undefined
  const hasActivePaidMembership =
    readBoolean(payload, [
      'hasActivePaidMembership',
      'HasActivePaidMembership',
    ]) ?? deriveHasActivePaidMembership(currentMembership, trainingDate)
  const hasUnpaidCurrentMembership =
    readBoolean(payload, [
      'hasUnpaidCurrentMembership',
      'HasUnpaidCurrentMembership',
    ]) ?? (currentMembership ? !currentMembership.isPaid : false)
  const membershipWarning =
    readBoolean(payload, [
      'hasWarning',
      'HasWarning',
      'membershipWarning',
      'MembershipWarning',
      'hasMembershipWarning',
      'HasMembershipWarning',
      'membershipWarningVisible',
      'MembershipWarningVisible',
      'hasMembershipIssue',
      'HasMembershipIssue',
    ]) ??
    (Boolean(warningMessage) ||
      deriveMembershipWarning(
        currentMembership,
        hasUnpaidCurrentMembership,
        trainingDate,
      ))

  return {
    id,
    fullName,
    groups: mapClientGroups(payload as ClientResponsePayload),
    photo: mapClientPhoto(payload as ClientResponsePayload),
    isPresent:
      readBoolean(payload, ['isPresent', 'IsPresent', 'present', 'Present']) ??
      false,
    hasActivePaidMembership,
    hasUnpaidCurrentMembership,
    membershipWarning,
    membershipWarningMessage: warningMessage,
    currentMembership,
  }
}
