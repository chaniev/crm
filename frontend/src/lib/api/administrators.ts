import { API_ENDPOINTS } from './endpoints'
import { extractArrayPayload, isRecord, readBoolean, readString } from './read-helpers'
import { mapUserRole } from './mappers'
import { request } from './transport'
import type {
  CreateAdministratorRequest,
  UpdateAdministratorRequest,
  UserDetails,
  UserListItem,
  UserResponsePayload,
} from './types'

export async function getAdministrators(signal?: AbortSignal) {
  const payload = await request<unknown>(API_ENDPOINTS.administrators.collection, {
    signal,
  })

  return extractArrayPayload<UserResponsePayload>(payload, ['items', 'users']).map(
    mapAdministratorListItem,
  )
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
