import { API_ENDPOINTS } from './endpoints'
import {
  extractArrayPayload,
  isRecord,
  readBoolean,
  readNumber,
  readString,
} from './read-helpers'
import { mapUserRole } from './mappers'
import { request } from './transport'
import { mapAllowedActions, mapRoleOptions } from './users'
import type {
  CreateAdministratorRequest,
  AdministratorAttendanceScopeGroup,
  AdministratorAttendanceScopeResponse,
  AdministratorUnavailableAttendanceGrant,
  ReplaceAdministratorAttendanceScopeRequest,
  UpdateAdministratorRequest,
  UserDetails,
  UserListItem,
  UserListResponse,
  UserResponsePayload,
} from './types'

export async function getAdministrators(signal?: AbortSignal) {
  const payload = await request<unknown>(API_ENDPOINTS.administrators.collection, {
    signal,
  })

  return {
    items: extractArrayPayload<UserResponsePayload>(payload, ['items', 'users']).map(
      mapAdministratorListItem,
    ),
    createRoleOptions: mapRoleOptions(payload, ['createRoleOptions', 'CreateRoleOptions']),
  } satisfies UserListResponse
}

export async function getAdministrator(
  administratorId: string,
  signal?: AbortSignal,
) {
  const payload = await request<UserResponsePayload>(
    API_ENDPOINTS.administrators.byId(administratorId),
    { signal },
  )

  return mapAdministratorDetails(payload)
}

export async function createAdministrator(payload: CreateAdministratorRequest) {
  const response = await request<UserResponsePayload>(
    API_ENDPOINTS.administrators.collection,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )

  return mapAdministratorDetails(response)
}

export async function updateAdministrator(
  administratorId: string,
  payload: UpdateAdministratorRequest,
) {
  const response = await request<UserResponsePayload>(
    API_ENDPOINTS.administrators.byId(administratorId),
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  )

  return mapAdministratorDetails(response)
}

export async function getAdministratorAttendanceScope(
  administratorId: string,
  signal?: AbortSignal,
) {
  const payload = await request<unknown>(
    API_ENDPOINTS.administrators.attendanceGroups(administratorId),
    { signal },
  )

  return mapAdministratorAttendanceScope(payload)
}

export async function replaceAdministratorAttendanceScope(
  administratorId: string,
  payload: ReplaceAdministratorAttendanceScopeRequest,
) {
  const response = await request<unknown>(
    API_ENDPOINTS.administrators.attendanceGroups(administratorId),
    {
      method: 'PUT',
      body: JSON.stringify({
        expectedGroupIds: payload.expectedGroupIds,
        groupIds: payload.groupIds,
      }),
    },
  )

  return mapAdministratorAttendanceScope(response)
}

function mapAdministratorListItem(payload: UserResponsePayload): UserListItem {
  if (!isRecord(payload)) {
    return {
      id: '',
      fullName: '',
      login: '',
      role: 'Administrator',
      mustChangePassword: false,
      isActive: false,
      messengerPlatform: null,
    messengerPlatformUserId: null,
    branchId: null,
    branchName: null,
    attendanceGroupGrantCount: 0,
  }
  }

  return {
    id: readString(payload, ['id', 'Id']) ?? '',
    fullName: readString(payload, ['fullName', 'FullName']) ?? '',
    login: readString(payload, ['login', 'Login']) ?? '',
    role: mapUserRole(readString(payload, ['role', 'Role'])) ?? 'Administrator',
    mustChangePassword:
      readBoolean(payload, ['mustChangePassword', 'MustChangePassword']) ?? false,
    isActive: readBoolean(payload, ['isActive', 'IsActive']) ?? false,
    messengerPlatform: mapMessengerPlatform(
      readString(payload, ['messengerPlatform', 'MessengerPlatform']),
    ),
    messengerPlatformUserId:
      readString(payload, [
        'messengerPlatformUserId',
        'MessengerPlatformUserId',
      ]) ?? null,
    branchId: readString(payload, ['branchId', 'BranchId']) ?? null,
    branchName: readString(payload, ['branchName', 'BranchName']) ?? null,
    attendanceGroupGrantCount:
      readNumber(payload, [
        'attendanceGroupGrantCount',
        'AttendanceGroupGrantCount',
        'attendanceGrantCount',
        'AttendanceGrantCount',
      ]) ?? 0,
    allowedActions: mapAllowedActions(payload),
    roleOptions: mapRoleOptions(payload, ['roleOptions', 'RoleOptions']),
  }
}

function mapAdministratorDetails(payload: UserResponsePayload): UserDetails {
  return mapAdministratorListItem(payload)
}

function mapMessengerPlatform(value: string | null | undefined) {
  if (value?.toLowerCase() === 'telegram') {
    return 'Telegram' as const
  }

  return null
}

function mapAdministratorAttendanceScope(
  payload: unknown,
): AdministratorAttendanceScopeResponse {
  const source = isRecord(payload) ? payload : {}
  const administrator = mapScopeAdministrator(
    source.administrator ?? source.Administrator ?? source.target ?? source.Target,
  )
  const branch = mapScopeBranch(source.branch ?? source.Branch)
  const grantedGroupIds = mapStringArray(
    source.grantedGroupIds ?? source.GrantedGroupIds ?? source.groupIds ?? source.GroupIds,
  )

  return {
    administrator,
    branch,
    grantedGroupIds,
    groups: extractArrayPayload<unknown>(source, ['groups', 'Groups', 'items', 'Items'])
      .map(mapAttendanceScopeGroup)
      .filter((group): group is AdministratorAttendanceScopeGroup => group !== null),
    unavailableGrants: extractArrayPayload<unknown>(source, [
      'unavailableGrants',
      'UnavailableGrants',
      'unavailableStoredGrants',
      'UnavailableStoredGrants',
    ])
      .map(mapUnavailableGrant)
      .filter((grant): grant is AdministratorUnavailableAttendanceGrant => grant !== null),
  }
}

function mapScopeAdministrator(payload: unknown) {
  const source = isRecord(payload) ? payload : {}

  return {
    id: readString(source, ['id', 'Id', 'administratorId', 'AdministratorId']) ?? '',
    fullName: readString(source, ['fullName', 'FullName', 'name', 'Name']) ?? '',
    isActive: readBoolean(source, ['isActive', 'IsActive']) ?? false,
  }
}

function mapScopeBranch(payload: unknown) {
  if (!isRecord(payload)) {
    return null
  }

  const id = readString(payload, ['id', 'Id', 'branchId', 'BranchId'])
  if (!id) {
    return null
  }

  return {
    id,
    name: readString(payload, ['name', 'Name', 'branchName', 'BranchName']) ?? '',
    isArchived: readBoolean(payload, ['isArchived', 'IsArchived']) ?? false,
  }
}

function mapAttendanceScopeGroup(
  payload: unknown,
): AdministratorAttendanceScopeGroup | null {
  if (!isRecord(payload)) {
    return null
  }

  const id = readString(payload, ['id', 'Id', 'groupId', 'GroupId'])
  if (!id) {
    return null
  }

  return {
    id,
    name: readString(payload, ['name', 'Name', 'groupName', 'GroupName']) ?? 'Группа без названия',
    trainingStartTime:
      readString(payload, ['trainingStartTime', 'TrainingStartTime']) ?? undefined,
    durationMinutes: readNumber(payload, ['durationMinutes', 'DurationMinutes']),
    weekdays: mapNumberArray(payload.weekdays ?? payload.Weekdays),
    isActive: readBoolean(payload, ['isActive', 'IsActive']) ?? true,
    isGranted:
      readBoolean(payload, ['isGranted', 'IsGranted', 'granted', 'Granted']) ?? false,
    canGrant: readBoolean(payload, ['canGrant', 'CanGrant']) ?? false,
    canRevoke: readBoolean(payload, ['canRevoke', 'CanRevoke']) ?? false,
    disabledReason:
      readString(payload, ['disabledReason', 'DisabledReason']) ?? null,
  }
}

function mapUnavailableGrant(
  payload: unknown,
): AdministratorUnavailableAttendanceGrant | null {
  if (!isRecord(payload)) {
    return null
  }

  const groupId = readString(payload, ['groupId', 'GroupId'])
  const disabledReason = readString(payload, ['disabledReason', 'DisabledReason'])

  if (!groupId || !disabledReason) {
    return null
  }

  return {
    groupId,
    branchId: readString(payload, ['branchId', 'BranchId']) ?? null,
    isGranted: true,
    canGrant: false,
    canRevoke: readBoolean(payload, ['canRevoke', 'CanRevoke']) ?? true,
    disabledReason,
  }
}

function mapStringArray(payload: unknown) {
  if (!Array.isArray(payload)) {
    return []
  }

  return payload.filter((item): item is string => typeof item === 'string')
}

function mapNumberArray(payload: unknown) {
  if (!Array.isArray(payload)) {
    return undefined
  }

  return payload.filter((item): item is number => typeof item === 'number')
}
