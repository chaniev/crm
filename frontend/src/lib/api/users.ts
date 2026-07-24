import { API_ENDPOINTS } from './endpoints'
import { extractArrayPayload, isRecord, readBoolean, readString } from './read-helpers'
import { mapUserRole } from './mappers'
import { request } from './transport'
import type {
  CreateUserRequest,
  UpdateUserRequest,
  UserAllowedAction,
  UserDetails,
  UserListItem,
  UserListResponse,
  UserResponsePayload,
} from './types'

export async function getUsers(signal?: AbortSignal) {
  const payload = await request<unknown>(API_ENDPOINTS.users.collection, { signal })

  return {
    items: extractArrayPayload<UserResponsePayload>(payload, ['items', 'users']).map(
      mapUserListItem,
    ),
    createRoleOptions: mapRoleOptions(payload, ['createRoleOptions', 'CreateRoleOptions']),
  } satisfies UserListResponse
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
    role: mapUserRole(readString(payload, ['role', 'Role'])) ?? 'Coach',
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
    allowedActions: mapAllowedActions(payload),
    roleOptions: mapRoleOptions(payload, ['roleOptions', 'RoleOptions']),
  }
}

function mapUserDetails(payload: UserResponsePayload): UserDetails {
  return mapUserListItem(payload)
}

function mapMessengerPlatform(value: string | null | undefined) {
  if (value?.toLowerCase() === 'telegram') {
    return 'Telegram' as const
  }

  return null
}

export function mapAllowedActions(payload: Record<string, unknown>) {
  const source = payload.allowedActions ?? payload.AllowedActions

  if (!Array.isArray(source)) {
    return undefined
  }

  return source
    .map((action) => (typeof action === 'string' ? mapAllowedAction(action) : null))
    .filter((action): action is UserAllowedAction => Boolean(action))
}

export function mapRoleOptions(payload: unknown, keys: readonly string[]) {
  if (!isRecord(payload)) {
    return []
  }

  for (const key of keys) {
    const source = payload[key]

    if (Array.isArray(source)) {
      return source
        .map(mapRoleOption)
        .filter((role): role is NonNullable<ReturnType<typeof mapUserRole>> =>
          Boolean(role),
        )
    }
  }

  return []
}

function mapRoleOption(option: unknown) {
  if (typeof option === 'string') {
    return mapUserRole(option)
  }

  if (!isRecord(option)) {
    return undefined
  }

  return mapUserRole(
    readString(option, ['role', 'Role', 'value', 'Value']),
  )
}

function mapAllowedAction(action: string): UserAllowedAction | null {
  if (
    action === 'Read' ||
    action === 'Edit' ||
    action === 'Update' ||
    action === 'Deactivate' ||
    action === 'Reactivate' ||
    action === 'Delete'
  ) {
    return action
  }

  return null
}
