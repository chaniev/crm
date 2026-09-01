import {
  API_ENDPOINTS,
  ATTENDANCE_CLIENT_PAYLOAD_KEYS,
  ATTENDANCE_GROUP_PAYLOAD_KEYS,
  DEFAULT_CLIENT_GROUP_NAME,
} from './endpoints'
import {
  buildDisplayNameFromParts,
  mapClientGroups,
  mapClientCurrentMemberships,
  mapClientPhoto,
  normalizeIsoDateValue,
} from './mappers'
import {
  extractArrayPayload,
  isRecord,
  readBoolean,
  readNumber,
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
  AttendanceTodayLesson,
  AttendanceTodayLessonsResponse,
  AttendanceTodayTrainer,
  ClientResponsePayload,
  SaveAttendanceMarksRequest,
  SaveAttendanceMarksResponse,
} from './types'

const ATTENDANCE_TODAY_ITEM_KEYS = ['items', 'Items'] as const

export async function getAttendanceTodayLessons(
  signal?: AbortSignal,
): Promise<AttendanceTodayLessonsResponse> {
  const payload = await request<unknown>(API_ENDPOINTS.attendance.todayLessons, { signal })
  const envelope = requireRecord(payload, 'Некорректный ответ списка занятий на сегодня.')
  const mappedItems = extractArrayPayload<unknown>(payload, ATTENDANCE_TODAY_ITEM_KEYS)
    .map(mapAttendanceTodayLesson)
  const items = mappedItems.filter((item): item is AttendanceTodayLesson => item !== null)

  return {
    today: requireIsoDate(envelope, ['today', 'Today']),
    items,
    partial: items.length !== mappedItems.length,
  }
}

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
    minTrainingDate: readNullableIsoDate(envelope, [
      'minTrainingDate',
      'MinTrainingDate',
    ]),
    maxTrainingDate,
  } satisfies AttendanceGroupsResponse
}

export async function getAttendanceGroupClients(
  groupId: string,
  trainingDate: string,
  signal?: AbortSignal,
): Promise<AttendanceRosterResponse> {
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
    minTrainingDate: readNullableIsoDate(envelope, [
      'minTrainingDate',
      'MinTrainingDate',
    ]),
    maxTrainingDate: requireIsoDate(envelope, [
      'maxTrainingDate',
      'MaxTrainingDate',
    ]),
    clients: extractArrayPayload<AttendanceClientPayload>(
      payload,
      ATTENDANCE_CLIENT_PAYLOAD_KEYS,
    )
      .map((client) => mapAttendanceClient(client))
      .filter((client): client is AttendanceClient => client !== null),
  } satisfies AttendanceRosterResponse
}

export async function getAttendanceLessonClients(
  lessonOccurrenceId: string,
  lessonDate: string,
  signal?: AbortSignal,
): Promise<AttendanceRosterResponse> {
  const searchParams = new URLSearchParams()
  searchParams.set('lessonDate', lessonDate)

  const payload = await request<unknown>(
    `${API_ENDPOINTS.attendance.lessonClients(lessonOccurrenceId)}?${searchParams.toString()}`,
    { signal },
  )

  return mapAttendanceRosterResponse(payload, {
    lessonOccurrenceId,
    lessonDate,
  })
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

export async function saveAttendanceLessonMarks(
  lessonOccurrenceId: string,
  payload: SaveAttendanceMarksRequest,
) {
  const lessonDate = payload.lessonDate ?? payload.trainingDate
  const searchParams = new URLSearchParams()
  searchParams.set('lessonDate', lessonDate)

  const response = await request<unknown>(
    `${API_ENDPOINTS.attendance.lessonMarks(lessonOccurrenceId)}?${searchParams.toString()}`,
    {
      method: 'POST',
      body: JSON.stringify({
        LessonDate: lessonDate,
        AttendanceMarks: payload.attendanceMarks.map((mark) => ({
          ClientId: mark.clientId,
          State: mark.state,
        })),
      }),
    },
  )

  return mapSaveAttendanceResponse(response, {
    lessonOccurrenceId,
    lessonDate,
  })
}

function mapAttendanceRosterResponse(
  payload: unknown,
  fallback: {
    groupId?: string
    lessonOccurrenceId?: string
    lessonDate?: string
    trainingDate?: string
  },
): AttendanceRosterResponse {
  const envelope = requireRecord(payload, 'Некорректный ответ сохранения посещения.')
  const groupId = readString(envelope, ['groupId', 'GroupId']) ?? fallback.groupId ?? ''
  const trainingDate =
    normalizeIsoDateValue(
      readString(envelope, ['trainingDate', 'TrainingDate']) ??
      readString(envelope, ['lessonDate', 'LessonDate']) ??
      fallback.trainingDate ??
      fallback.lessonDate,
    ) ?? ''

  if (!groupId) {
    throw new Error('Ответ состава группы не содержит группу.')
  }

  if (!trainingDate) {
    throw new Error('Ответ состава группы не содержит дату занятия.')
  }

  const lessonDate = normalizeIsoDateValue(
    readString(envelope, ['lessonDate', 'LessonDate']) ??
    fallback.lessonDate ??
    trainingDate,
  ) ?? trainingDate
  const lessonOccurrenceId =
    readString(envelope, ['lessonOccurrenceId', 'LessonOccurrenceId']) ??
    fallback.lessonOccurrenceId
  const canEditAttendance = readScheduleAction(envelope, [
    'canEditAttendance',
    'CanEditAttendance',
  ])

  return {
    groupId,
    trainingDate,
    lessonOccurrenceId,
    lessonDate,
    canEditAttendance,
    today: requireIsoDate(envelope, ['today', 'Today']),
    minTrainingDate: readNullableIsoDate(envelope, [
      'minTrainingDate',
      'MinTrainingDate',
    ]),
    maxTrainingDate: requireIsoDate(envelope, [
      'maxTrainingDate',
      'MaxTrainingDate',
    ]),
    clients: extractArrayPayload<AttendanceClientPayload>(
      payload,
      ATTENDANCE_CLIENT_PAYLOAD_KEYS,
    )
      .map((client) => mapAttendanceClient(client))
      .filter((client): client is AttendanceClient => client !== null),
  } satisfies AttendanceRosterResponse
}

function mapSaveAttendanceResponse(
  payload: unknown,
  fallback: {
    lessonOccurrenceId?: string
    lessonDate?: string
  } = {},
): SaveAttendanceMarksResponse {
  const envelope = requireRecord(payload, 'Некорректный ответ сохранения посещения.')
  const groupId = readString(envelope, ['groupId', 'GroupId'])
  const trainingDate =
    normalizeIsoDateValue(
      readString(envelope, ['trainingDate', 'TrainingDate']) ??
      readString(envelope, ['lessonDate', 'LessonDate']) ??
      fallback.lessonDate,
    ) ?? ''

  if (!groupId) {
    throw new Error('Ответ сохранения посещения не содержит группу.')
  }

  if (!trainingDate) {
    throw new Error('Ответ сохранения посещения не содержит дату.')
  }

  const lessonDate = normalizeIsoDateValue(
    readString(envelope, ['lessonDate', 'LessonDate']) ??
    fallback.lessonDate ??
    trainingDate,
  ) ?? trainingDate
  const lessonOccurrenceId =
    readString(envelope, ['lessonOccurrenceId', 'LessonOccurrenceId']) ??
    fallback.lessonOccurrenceId
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
    lessonOccurrenceId,
    lessonDate,
    today: requireIsoDate(envelope, ['today', 'Today']),
    minTrainingDate: readNullableIsoDate(envelope, [
      'minTrainingDate',
      'MinTrainingDate',
    ]),
    maxTrainingDate: requireIsoDate(envelope, [
      'maxTrainingDate',
      'MaxTrainingDate',
    ]),
    attendanceMarks,
  }
}

function readScheduleAction(
  record: Record<string, unknown>,
  keys: readonly string[],
) {
  for (const key of keys) {
    const value = record[key]
    if (!isRecord(value)) {
      continue
    }

    return {
      allowed: readBoolean(value, ['allowed', 'Allowed']) ?? false,
      reason: readString(value, ['reason', 'Reason']) ?? null,
    }
  }

  return undefined
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

function mapAttendanceTodayLesson(payload: unknown): AttendanceTodayLesson | null {
  if (!isRecord(payload)) {
    return null
  }

  const lessonOccurrenceId = readString(payload, ['lessonOccurrenceId', 'LessonOccurrenceId'])
  const lessonDate = normalizeIsoDateValue(
    readString(payload, ['lessonDate', 'LessonDate']) ?? '',
  )
  const groupId = readString(payload, ['groupId', 'GroupId'])
  const groupName = readString(payload, ['groupName', 'GroupName'])
  const startTime = readClockTime(payload, ['startTime', 'StartTime'])
  const endTime = readClockTime(payload, ['endTime', 'EndTime'])
  const branchName = readString(payload, ['branchName', 'BranchName'])
  const hallName = readString(payload, ['hallName', 'HallName'])
  const unmarkedClientCount = readNumber(payload, [
    'unmarkedClientCount',
    'UnmarkedClientCount',
  ])
  const openAttendance = readScheduleAction(payload, [
    'openAttendance',
    'OpenAttendance',
  ])
  const trainersPayload = payload.effectiveTrainers ?? payload.EffectiveTrainers
  const effectiveTrainers = Array.isArray(trainersPayload)
    ? trainersPayload.map(mapAttendanceTodayTrainer)
    : null

  if (
    !lessonOccurrenceId ||
    !lessonDate ||
    !groupId ||
    !groupName ||
    !startTime ||
    !endTime ||
    !branchName ||
    !hallName ||
    !Number.isInteger(unmarkedClientCount) ||
    unmarkedClientCount === undefined ||
    unmarkedClientCount <= 0 ||
    !openAttendance?.allowed ||
    !effectiveTrainers ||
    effectiveTrainers.some((trainer) => trainer === null)
  ) {
    return null
  }

  return {
    lessonOccurrenceId,
    lessonDate,
    groupId,
    groupName,
    startTime,
    endTime,
    branchName,
    hallName,
    effectiveTrainers: effectiveTrainers as AttendanceTodayTrainer[],
    openAttendance,
    unmarkedClientCount,
  }
}

function mapAttendanceTodayTrainer(payload: unknown): AttendanceTodayTrainer | null {
  if (!isRecord(payload)) {
    return null
  }

  const trainerId = readString(payload, ['trainerId', 'TrainerId'])
  const fullName = readString(payload, ['fullName', 'FullName'])
  const kind = readString(payload, ['kind', 'Kind'])
  if (!trainerId || !fullName || (kind !== 'Permanent' && kind !== 'Substitute')) {
    return null
  }

  return { trainerId, fullName, kind }
}

function readClockTime(
  payload: Record<string, unknown>,
  keys: readonly string[],
) {
  const value = readString(payload, keys)
  return value && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : undefined
}

function mapAttendanceClient(payload: AttendanceClientPayload): AttendanceClient | null {
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
  const currentMemberships = mapClientCurrentMemberships(payload as ClientResponsePayload)
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
    ]) ?? false
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
    ]) ?? Boolean(warningMessage)

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
    currentMemberships,
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

function readNullableIsoDate(
  record: Record<string, unknown>,
  keys: readonly string[],
) {
  for (const key of keys) {
    if (record[key] === null) {
      return null
    }

    const value = readString(record, [key])
    const normalizedValue = value ? normalizeIsoDateValue(value) : null

    if (normalizedValue) {
      return normalizedValue
    }
  }

  return null
}
