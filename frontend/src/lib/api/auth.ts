import { API_ENDPOINTS } from './endpoints'
import { mapUserRole } from './mappers'
import { isRecord, readBoolean, readString } from './read-helpers'
import { request } from './transport'
import type {
  AccessPermissions,
  AppSection,
  AuthenticatedUser,
  AttendanceScope,
  AttendanceScopeKind,
  ChangePasswordRequest,
  LoginRequest,
  SessionResponse,
} from './types'

export async function loadSession(signal?: AbortSignal) {
  const payload = await request<unknown>(API_ENDPOINTS.auth.session, { signal })

  return mapSessionResponse(payload)
}

export async function login(payload: LoginRequest) {
  const response = await request<unknown>(API_ENDPOINTS.auth.login, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return mapSessionResponse(response)
}

export async function logout() {
  return request<SessionResponse>(API_ENDPOINTS.auth.logout, {
    method: 'POST',
  })
}

export async function changePassword(payload: ChangePasswordRequest) {
  const response = await request<unknown>(API_ENDPOINTS.auth.changePassword, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return mapSessionResponse(response)
}

function mapSessionResponse(payload: unknown): SessionResponse {
  if (!isRecord(payload)) {
    return {
      isAuthenticated: false,
      csrfToken: '',
      user: null,
      bootstrapMode: false,
    }
  }

  return {
    isAuthenticated:
      readBoolean(payload, ['isAuthenticated', 'IsAuthenticated']) ?? false,
    csrfToken: readString(payload, ['csrfToken', 'CsrfToken']) ?? '',
    user: mapAuthenticatedUser(payload.user ?? payload.User),
    bootstrapMode: readBoolean(payload, ['bootstrapMode', 'BootstrapMode']) ?? false,
  }
}

function mapAuthenticatedUser(payload: unknown): AuthenticatedUser | null {
  if (!isRecord(payload)) {
    return null
  }

  const role = mapUserRole(readString(payload, ['role', 'Role']))

  if (!role) {
    return null
  }

  const assignedGroupIds = mapStringArray(payload.assignedGroupIds ?? payload.AssignedGroupIds)

  return {
    id: readString(payload, ['id', 'Id']) ?? '',
    fullName: readString(payload, ['fullName', 'FullName']) ?? '',
    login: readString(payload, ['login', 'Login']) ?? '',
    role,
    mustChangePassword:
      readBoolean(payload, ['mustChangePassword', 'MustChangePassword']) ?? false,
    isActive: readBoolean(payload, ['isActive', 'IsActive']) ?? false,
    landingScreen:
      mapAppSection(readString(payload, ['landingScreen', 'LandingScreen'])) ?? 'Home',
    allowedSections: mapAppSections(payload.allowedSections ?? payload.AllowedSections),
    permissions: mapAccessPermissions(payload.permissions ?? payload.Permissions),
    assignedGroupIds,
    attendanceScope: mapAttendanceScope(
      payload.attendanceScope ?? payload.AttendanceScope,
      role,
      assignedGroupIds,
    ),
    branchId: readString(payload, ['branchId', 'BranchId']) ?? null,
    createRoleOptions: mapUserRoles(payload.createRoleOptions ?? payload.CreateRoleOptions),
  }
}

function mapAccessPermissions(payload: unknown): AccessPermissions {
  const source = isRecord(payload) ? payload : {}

  return {
    canManageUsers: readBoolean(source, ['canManageUsers', 'CanManageUsers']) ?? false,
    canManageClients: readBoolean(source, ['canManageClients', 'CanManageClients']) ?? false,
    canManageGroups: readBoolean(source, ['canManageGroups', 'CanManageGroups']) ?? false,
    canManageSettings: readBoolean(source, ['canManageSettings', 'CanManageSettings']) ?? false,
    canMarkAttendance: readBoolean(source, ['canMarkAttendance', 'CanMarkAttendance']) ?? false,
    canViewAuditLog: readBoolean(source, ['canViewAuditLog', 'CanViewAuditLog']) ?? false,
    canViewFinancialReports:
      readBoolean(source, ['canViewFinancialReports', 'CanViewFinancialReports']) ?? false,
  }
}

function mapAppSections(payload: unknown) {
  return mapStringArray(payload).flatMap((section) => {
    const mappedSection = mapAppSection(section)

    return mappedSection ? [mappedSection] : []
  })
}

function mapAppSection(section?: string): AppSection | null {
  if (
    section === 'Home' ||
    section === 'Schedule' ||
    section === 'Clients' ||
    section === 'Groups' ||
    section === 'Users' ||
    section === 'Audit' ||
    section === 'Finance' ||
    section === 'Settings'
  ) {
    return section
  }

  return null
}

function mapUserRoles(payload: unknown) {
  return mapStringArray(payload).flatMap((role) => {
    const mappedRole = mapUserRole(role)

    return mappedRole ? [mappedRole] : []
  })
}

function mapAttendanceScope(
  payload: unknown,
  role: AuthenticatedUser['role'],
  assignedGroupIds: string[],
): AttendanceScope {
  if (isRecord(payload)) {
    const kind = mapAttendanceScopeKind(readString(payload, ['kind', 'Kind']))

    if (kind) {
      return {
        kind,
        groupIds: mapStringArray(payload.groupIds ?? payload.GroupIds),
      }
    }
  }

  if (role === 'Coach') {
    return { kind: 'TrainerAssignments', groupIds: assignedGroupIds }
  }

  if (role === 'Administrator') {
    return { kind: 'AdministratorGrants', groupIds: [] }
  }

  return { kind: 'Global', groupIds: [] }
}

function mapAttendanceScopeKind(value?: string): AttendanceScopeKind | null {
  if (
    value === 'Global' ||
    value === 'TrainerAssignments' ||
    value === 'AdministratorGrants'
  ) {
    return value
  }

  return null
}

function mapStringArray(payload: unknown) {
  if (!Array.isArray(payload)) {
    return []
  }

  return payload.filter((item): item is string => typeof item === 'string')
}
