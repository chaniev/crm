import type {
  CreateUserRequest,
  MessengerPlatform,
  UpdateUserRequest,
  UserDetails,
} from '../../lib/api'
import type {
  CreateUserFormValues,
  EditUserFormValues,
} from './UserFormFields'

export function toCreateUserPayload(
  values: CreateUserFormValues,
): CreateUserRequest {
  const messengerSettings = normalizeMessengerSettings(
    values.messengerPlatform,
    values.messengerPlatformUserId,
  )

  return {
    fullName: values.fullName.trim(),
    login: values.login.trim(),
    password: values.password,
    role: values.role ?? 'Coach',
    mustChangePassword: values.mustChangePassword,
    isActive: values.isActive,
    ...messengerSettings,
  }
}

export function toUpdateUserPayload(
  values: EditUserFormValues,
): UpdateUserRequest {
  const messengerSettings = normalizeMessengerSettings(
    values.messengerPlatform,
    values.messengerPlatformUserId,
  )

  return {
    fullName: values.fullName.trim(),
    login: values.login.trim(),
    role: values.role ?? 'Coach',
    mustChangePassword: values.mustChangePassword,
    isActive: values.isActive,
    ...messengerSettings,
  }
}

export function toEditUserFormValues(
  user: UserDetails,
): EditUserFormValues {
  return {
    fullName: user.fullName,
    login: user.login,
    role: user.role,
    messengerPlatform:
      user.messengerPlatform ??
      (user.messengerPlatformUserId ? 'Telegram' : null),
    messengerPlatformUserId: user.messengerPlatformUserId ?? '',
    mustChangePassword: user.mustChangePassword,
    isActive: user.isActive,
  }
}

function normalizeMessengerSettings(
  messengerPlatform: MessengerPlatform | null,
  messengerPlatformUserId: string,
) {
  const normalizedUserId = messengerPlatformUserId.trim()

  if (!normalizedUserId) {
    return {
      messengerPlatform: null,
      messengerPlatformUserId: null,
    }
  }

  return {
    messengerPlatform: messengerPlatform ?? 'Telegram',
    messengerPlatformUserId: normalizedUserId,
  }
}
