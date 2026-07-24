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
        landingScreen: 'Home',
        allowedSections: ['Home', 'Clients', 'Groups', 'Users', 'Audit', 'Settings'],
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
})

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
