import {
  API_ENDPOINTS,
  ATTENDANCE_CLIENT_PAYLOAD_KEYS,
  ATTENDANCE_GROUP_PAYLOAD_KEYS,
  DEFAULT_CLIENT_GROUP_NAME,
} from './endpoints'
import {
  buildDisplayNameFromParts,
  deriveHasActiveMembership,
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
  AttendanceGroupsResponse,
  AttendanceRosterResponse,
  AttendanceState,
  ClientResponsePayload,
  SaveAttendanceMarksRequest,
  SaveAttendanceMarksResponse,
} from './types'

export async function getAttendanceGroups(signal?: AbortSignal) {
  const payload = await request<unknown>(API_ENDPOINTS.attendance.groups, { signal })
  const envelope = requireRecord(payload, 'Некорректный ответ списка групп посещений.')
  const today = requireIsoDate(envelope, ['today', 'Today'])
  const maxTrainingDate = requireIsoDate(envelope, [
    'maxTrainingDate',
    'MaxTrainingDate',
  ])

  return {
    groups: extractArrayPayload<AttendanceGroupPayload>(
      payload,
      ATTENDANCE_GROUP_PAYLOAD_KEYS,
    )
      .map(mapAttendanceGroup)
      .filter((group): group is AttendanceGroup => group !== null),
    today,
    maxTrainingDate,
  } satisfies AttendanceGroupsResponse
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
  const envelope = requireRecord(payload, 'Некорректный ответ состава группы.')

  return {
    groupId: responseGroupId,
    trainingDate: responseTrainingDate,
    today: requireIsoDate(envelope, ['today', 'Today']),
    maxTrainingDate: requireIsoDate(envelope, [
      'maxTrainingDate',
      'MaxTrainingDate',
    ]),
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
  const response = await request<unknown>(API_ENDPOINTS.attendance.groupMarks(groupId), {
    method: 'POST',
    body: JSON.stringify({
      TrainingDate: payload.trainingDate,
      AttendanceMarks: payload.attendanceMarks.map((mark) => ({
        ClientId: mark.clientId,
        State: mark.state,
      })),
    }),
  })

  return mapSaveAttendanceResponse(response)
}

function mapSaveAttendanceResponse(payload: unknown): SaveAttendanceMarksResponse {
  const envelope = requireRecord(payload, 'Некорректный ответ сохранения посещения.')
  const groupId = readString(envelope, ['groupId', 'GroupId'])
  const trainingDate = requireIsoDate(envelope, ['trainingDate', 'TrainingDate'])

  if (!groupId) {
    throw new Error('Ответ сохранения посещения не содержит группу.')
  }

  const attendanceMarks = extractArrayPayload<Record<string, unknown>>(
    payload,
    ['attendanceMarks', 'AttendanceMarks'],
  ).map((mark) => {
    const clientId = readString(mark, ['clientId', 'ClientId'])
    const state = readAttendanceState(mark)

    if (!clientId || !state) {
      throw new Error('Ответ сохранения посещения содержит некорректную отметку.')
    }

    return { clientId, state }
  })

  return {
    groupId,
    trainingDate,
    today: requireIsoDate(envelope, ['today', 'Today']),
    maxTrainingDate: requireIsoDate(envelope, [
      'maxTrainingDate',
      'MaxTrainingDate',
    ]),
    attendanceMarks,
  }
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
    durationMinutes:
      typeof payload.durationMinutes === 'number'
        ? payload.durationMinutes
        : undefined,
    weekdays: Array.isArray(payload.weekdays) ? payload.weekdays : undefined,
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

  const state = readAttendanceState(payload)
  if (!state) {
    throw new Error('Ответ состава группы содержит некорректное состояние посещения.')
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
  const isProfessional =
    readBoolean(payload, ['isProfessional', 'IsProfessional']) ?? false
  const professionalComment =
    readString(payload, ['professionalComment', 'ProfessionalComment']) ?? null
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
  const hasActiveMembership =
    readBoolean(payload, [
      'hasActiveMembership',
      'HasActiveMembership',
    ]) ??
    (isProfessional
      ? true
      : deriveHasActiveMembership(currentMembership, trainingDate))
  const derivedMembershipWarning =
    !isProfessional &&
    (Boolean(warningMessage) ||
      deriveMembershipWarning(
        currentMembership,
        trainingDate,
      ))
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
    ]) ?? derivedMembershipWarning

  return {
    id,
    fullName,
    groups: mapClientGroups(payload as ClientResponsePayload),
    photo: mapClientPhoto(payload as ClientResponsePayload),
    state,
    isProfessional,
    professionalComment,
    hasActiveMembership,
    membershipWarning,
    membershipWarningMessage: warningMessage,
    currentMembership,
  }
}

function readAttendanceState(payload: Record<string, unknown>): AttendanceState | undefined {
  const state = readString(payload, ['state', 'State'])

  return state === 'Unmarked' || state === 'Present' || state === 'Absent'
    ? state
    : undefined
}

function requireRecord(payload: unknown, message: string) {
  if (!isRecord(payload)) {
    throw new Error(message)
  }

  return payload
}

function requireIsoDate(
  payload: Record<string, unknown>,
  keys: readonly string[],
) {
  const value = normalizeIsoDateValue(readString(payload, keys) ?? '')

  if (!value) {
    throw new Error('Ответ посещений не содержит календарную дату клуба.')
  }

  return value
}
