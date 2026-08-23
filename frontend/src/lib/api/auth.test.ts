import { afterEach, describe, expect, test, vi } from 'vitest'
import { loadSession } from './auth'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('auth API', () => {
  test('maps SuperAdministrator session with explicit nullable branch and backend role options', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      isAuthenticated: true,
      csrfToken: 'csrf',
      bootstrapMode: false,
      user: {
        id: 'superadmin-1',
        fullName: 'Суперадминистратор',
        login: 'superadmin',
        role: 'SuperAdministrator',
        mustChangePassword: false,
        isActive: true,
        landingScreen: 'Attention',
        allowedSections: ['Attendance', 'Attention', 'Clients', 'Groups', 'Users', 'Audit', 'Settings'],
        permissions: {
          canManageUsers: true,
          canManageClients: true,
          canManageGroups: true,
          canManageSettings: true,
          canMarkAttendance: true,
          canViewAuditLog: true,
          canViewFinancialReports: false,
        },
        assignedGroupIds: [],
        attendanceScope: {
          kind: 'Global',
          groupIds: [],
        },
        branchId: null,
        createRoleOptions: ['Administrator', 'Coach'],
      },
    })))

    await expect(loadSession()).resolves.toMatchObject({
      isAuthenticated: true,
      user: {
        role: 'SuperAdministrator',
        branchId: null,
        createRoleOptions: ['Administrator', 'Coach'],
        permissions: {
          canViewFinancialReports: false,
        },
        attendanceScope: {
          kind: 'Global',
          groupIds: [],
        },
      },
    })
  })

  test('maps Administrator attendance grants separately from coach assignments', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      isAuthenticated: true,
      csrfToken: 'csrf',
      bootstrapMode: false,
      user: {
        id: 'administrator-1',
        fullName: 'Администратор',
        login: 'administrator',
        role: 'Administrator',
        mustChangePassword: false,
        isActive: true,
        landingScreen: 'Attendance',
        allowedSections: ['Attendance'],
        permissions: {
          canManageUsers: false,
          canManageClients: true,
          canManageGroups: false,
          canManageSettings: true,
          canMarkAttendance: true,
          canViewAuditLog: false,
          canViewFinancialReports: false,
        },
        assignedGroupIds: [],
        attendanceScope: {
          kind: 'AdministratorGrants',
          groupIds: ['group-1', 'group-2'],
        },
        branchId: 'branch-1',
        createRoleOptions: [],
      },
    })))

    await expect(loadSession()).resolves.toMatchObject({
      user: {
        role: 'Administrator',
        assignedGroupIds: [],
        attendanceScope: {
          kind: 'AdministratorGrants',
          groupIds: ['group-1', 'group-2'],
        },
      },
    })
  })

  test('does not expose unknown backend roles to the app shell', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      isAuthenticated: true,
      csrfToken: 'csrf',
      bootstrapMode: false,
      user: {
        id: 'owner-1',
        fullName: 'Owner',
        login: 'owner',
        role: 'Owner',
      },
    })))

    await expect(loadSession()).resolves.toMatchObject({
      isAuthenticated: true,
      user: null,
    })
  })

  test('rejects legacy or incompatible backend section payloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      isAuthenticated: true,
      csrfToken: 'csrf',
      bootstrapMode: false,
      user: {
        id: 'coach-1',
        fullName: 'Тренер',
        login: 'coach',
        role: 'Coach',
        mustChangePassword: false,
        isActive: true,
        landingScreen: 'Home',
        allowedSections: ['Home', 'Schedule', 'Clients'],
      },
    })))

    await expect(loadSession()).resolves.toMatchObject({
      isAuthenticated: true,
      user: null,
    })
  })

  test('rejects a landing absent from mapped allowed sections', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      isAuthenticated: true,
      csrfToken: 'csrf',
      bootstrapMode: false,
      user: {
        id: 'headcoach-1',
        fullName: 'Главный тренер',
        login: 'headcoach',
        role: 'HeadCoach',
        mustChangePassword: false,
        isActive: true,
        landingScreen: 'Attention',
        allowedSections: ['Attendance', 'Schedule', 'Clients'],
      },
    })))

    await expect(loadSession()).resolves.toMatchObject({
      isAuthenticated: true,
      user: null,
    })
  })
})

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
