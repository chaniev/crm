import { API_ENDPOINTS } from './endpoints'
import { extractArrayPayload, isRecord, readBoolean, readString } from './read-helpers'
import { mapUserRole } from './mappers'
import { request } from './transport'
import type {
  CreateUserRequest,
  UpdateUserRequest,
  UserDetails,
  UserListItem,
  UserResponsePayload,
} from './types'

export async function getUsers(signal?: AbortSignal) {
  const payload = await request<unknown>(API_ENDPOINTS.users.collection, { signal })

  return extractArrayPayload<UserResponsePayload>(payload, ['items', 'users']).map(
    mapUserListItem,
  )
}

export async function getUser(userId: string, signal?: AbortSignal) {
  const payload = await request<UserResponsePayload>(API_ENDPOINTS.users.byId(userId), {
    signal,
  })

  return mapUserDetails(payload)
}

export async function createUser(payload: CreateUserRequest) {
  const response = await request<UserResponsePayload>(API_ENDPOINTS.users.collection, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return mapUserDetails(response)
}

export async function updateUser(userId: string, payload: UpdateUserRequest) {
  const response = await request<UserResponsePayload>(API_ENDPOINTS.users.byId(userId), {
    method: 'PUT',
    body: JSON.stringify(payload),
  })

  return mapUserDetails(response)
}

function mapUserListItem(payload: UserResponsePayload): UserListItem {
  if (!isRecord(payload)) {
    return {
      id: '',
      fullName: '',
      login: '',
      role: 'Coach',
      mustChangePassword: false,
      isActive: false,
    }
  }

  return {
    id: readString(payload, ['id', 'Id']) ?? '',
    fullName: readString(payload, ['fullName', 'FullName']) ?? '',
    login: readString(payload, ['login', 'Login']) ?? '',
    role: mapUserRole(readString(payload, ['role', 'Role'])) ?? 'Coach',
    mustChangePassword:
      readBoolean(payload, ['mustChangePassword', 'MustChangePassword']) ?? false,
    isActive: readBoolean(payload, ['isActive', 'IsActive']) ?? false,
  }
}

function mapUserDetails(payload: UserResponsePayload): UserDetails {
  return mapUserListItem(payload)
}
