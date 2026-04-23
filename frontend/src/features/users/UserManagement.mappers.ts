import type {
  CreateUserRequest,
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
  return {
    fullName: values.fullName.trim(),
    login: values.login.trim(),
    password: values.password,
    role: values.role ?? 'Coach',
    mustChangePassword: values.mustChangePassword,
    isActive: values.isActive,
  }
}

export function toUpdateUserPayload(
  values: EditUserFormValues,
): UpdateUserRequest {
  return {
    fullName: values.fullName.trim(),
    login: values.login.trim(),
    role: values.role ?? 'Coach',
    mustChangePassword: values.mustChangePassword,
    isActive: values.isActive,
  }
}

export function toEditUserFormValues(
  user: UserDetails,
): EditUserFormValues {
  return {
    fullName: user.fullName,
    login: user.login,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    isActive: user.isActive,
  }
}
