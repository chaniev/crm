import { describe, expect, test } from 'vitest'
import type { AppSection, AuthenticatedUser } from './api'
import {
  getAccessibleNavigationSections,
  getMobileNavigationSections,
  getSectionPath,
  getRoutePath,
  parseRoute,
  resolveAccessibleRoutePath,
} from './appRoutes'

const financeUser: AuthenticatedUser = {
  id: 'headcoach-id',
  fullName: 'Главный тренер',
  login: 'headcoach',
  role: 'HeadCoach',
  mustChangePassword: false,
  isActive: true,
  landingScreen: 'Home',
  allowedSections: [
    'Home',
    'Schedule',
    'Clients',
    'Groups',
    'Users',
    'Audit',
    'Finance',
    'Settings',
  ],
  permissions: {
    canManageUsers: true,
    canManageClients: true,
    canManageGroups: true,
    canManageSettings: true,
    canMarkAttendance: true,
    canViewAuditLog: true,
    canViewFinancialReports: true,
  },
  assignedGroupIds: [],
  attendanceScope: { kind: 'Global', groupIds: [] },
  branchId: null,
}

describe('finance routes', () => {
  test('includes Finance in navigation only when backend grants section and permission', () => {
    expect(getAccessibleNavigationSections(financeUser)).toContain('Finance')

    expect(
      getAccessibleNavigationSections({
        ...financeUser,
        permissions: {
          ...financeUser.permissions,
          canViewFinancialReports: false,
        },
      }),
    ).not.toContain('Finance')

    expect(
      getAccessibleNavigationSections({
        ...financeUser,
        allowedSections: financeUser.allowedSections.filter(
          (section) => section !== 'Finance',
        ),
      }),
    ).not.toContain('Finance')
  })

  test('requires Schedule permission in allowedSections', () => {
    expect(
      getAccessibleNavigationSections({
        ...financeUser,
        allowedSections: ['Clients', 'Groups'],
      }),
    ).not.toContain('Schedule')
  })

  test('includes Schedule when allowedSections explicitly contains it', () => {
    expect(
      getAccessibleNavigationSections({
        ...financeUser,
        allowedSections: ['Home', 'Schedule', 'Clients'],
      }),
    ).toContain('Schedule')
  })

  test('redirects /finance when backend finance access is not granted', () => {
    expect(
      resolveAccessibleRoutePath(financeUser, {
        kind: 'section',
        section: 'Finance',
      }),
    ).toBe('/finance')

    expect(
      resolveAccessibleRoutePath(
        {
          ...financeUser,
          permissions: {
            ...financeUser.permissions,
            canViewFinancialReports: false,
          },
        },
        {
          kind: 'section',
          section: 'Finance',
        },
      ),
    ).toBe('/')
  })

  test('normalizes removed Attendance route to Home', () => {
    const route = parseRoute('/attendance')

    expect(route).toEqual({ kind: 'section', section: 'Home' })
    expect(resolveAccessibleRoutePath(financeUser, route)).toBe('/')
  })

  test('redirects Users detail routes when user management permission is revoked', () => {
    const nonManagerUser = {
      ...financeUser,
      role: 'Coach',
      permissions: {
        ...financeUser.permissions,
        canManageUsers: false,
      },
    } as const

    expect(
      resolveAccessibleRoutePath(nonManagerUser, {
        kind: 'userEdit',
        userId: 'trainer-1',
      }),
    ).toBe(getSectionPath(nonManagerUser.landingScreen))
  })

  test('SuperAdministrator navigation follows backend permissions without finance access', () => {
    const superAdministrator: AuthenticatedUser = {
      ...financeUser,
      id: 'superadmin-id',
      fullName: 'Суперадминистратор',
      login: 'superadmin',
      role: 'SuperAdministrator',
      branchId: null,
      permissions: {
        ...financeUser.permissions,
        canViewFinancialReports: false,
      },
      allowedSections: financeUser.allowedSections.filter((section) => section !== 'Finance'),
      createRoleOptions: ['Administrator', 'Coach'],
    }

    expect(getAccessibleNavigationSections(superAdministrator)).toEqual([
      'Home',
      'Schedule',
      'Clients',
      'Groups',
      'Users',
      'Audit',
      'Settings',
    ])
    expect(resolveAccessibleRoutePath(superAdministrator, { kind: 'section', section: 'Finance' })).toBe('/')
  })
})

describe('client preview route', () => {
  test('parses and serializes /clients/:id/preview before details route', () => {
    const route = parseRoute('/clients/client-1/preview')

    expect(route).toEqual({
      kind: 'clientPreview',
      clientId: 'client-1',
    })
    expect(getRoutePath(route)).toBe('/clients/client-1/preview')
  })

  test('keeps preview route accessible when Clients section is granted', () => {
    expect(
      resolveAccessibleRoutePath(financeUser, {
        kind: 'clientPreview',
        clientId: 'client-1',
      }),
    ).toBe('/clients/client-1/preview')
  })
})

describe('mobile navigation sections', () => {
  const getMobileNavigationSectionsWithCurrent = getMobileNavigationSections as (
    accessibleSections: readonly AppSection[],
    currentSection: AppSection | null,
  ) => ReturnType<typeof getMobileNavigationSections>

  test('splits management sections into stable primary items and authorized overflow', () => {
    const accessibleSections = getAccessibleNavigationSections(financeUser)

    expect(getMobileNavigationSections(accessibleSections)).toEqual({
      primarySections: ['Home', 'Schedule', 'Clients', 'Groups'],
      overflowSections: ['Users', 'Audit', 'Finance', 'Settings'],
    })
  })

  test('promotes overflow destination to adaptive fourth slot when current section is overflow', () => {
    const accessibleSections = getAccessibleNavigationSections({
      ...financeUser,
      allowedSections: ['Home', 'Schedule', 'Clients', 'Groups', 'Finance', 'Users', 'Audit', 'Settings'],
      permissions: {
        ...financeUser.permissions,
        canViewFinancialReports: true,
        canManageUsers: true,
        canViewAuditLog: true,
      },
    })

    expect(
      getMobileNavigationSectionsWithCurrent(accessibleSections, 'Finance'),
    ).toEqual({
      primarySections: ['Home', 'Schedule', 'Clients', 'Finance'],
      overflowSections: ['Groups', 'Users', 'Audit', 'Settings'],
    })
  })

  test('respects adaptive overflow slot on non-finance route', () => {
    const accessibleSections = getAccessibleNavigationSections({
      ...financeUser,
      allowedSections: ['Home', 'Schedule', 'Clients', 'Groups', 'Users', 'Audit', 'Settings'],
      permissions: {
        ...financeUser.permissions,
        canManageUsers: true,
        canViewAuditLog: true,
      },
    })

    expect(
      getMobileNavigationSectionsWithCurrent(accessibleSections, 'Users'),
    ).toEqual({
      primarySections: ['Home', 'Schedule', 'Clients', 'Users'],
      overflowSections: ['Groups', 'Audit', 'Settings'],
    })
  })

  test('shows coach sections directly when nothing overflows', () => {
    const accessibleSections = getAccessibleNavigationSections({
      ...financeUser,
      role: 'Coach',
      landingScreen: 'Home',
      allowedSections: ['Home', 'Schedule', 'Clients'],
      permissions: {
        canManageUsers: false,
        canManageClients: false,
        canManageGroups: false,
        canManageSettings: false,
        canMarkAttendance: true,
        canViewAuditLog: false,
        canViewFinancialReports: false,
      },
    })

    expect(getMobileNavigationSections(accessibleSections)).toEqual({
      primarySections: ['Home', 'Schedule', 'Clients'],
      overflowSections: [],
    })
  })

  test('backfills missing primary candidates from remaining accessible sections', () => {
    const accessibleSections = getAccessibleNavigationSections({
      ...financeUser,
      allowedSections: ['Home', 'Groups', 'Settings'],
      permissions: {
        ...financeUser.permissions,
        canManageUsers: false,
        canViewAuditLog: false,
        canViewFinancialReports: false,
      },
    })

    expect(getMobileNavigationSections(accessibleSections)).toEqual({
      primarySections: ['Home', 'Groups', 'Settings'],
      overflowSections: [],
    })
  })

  test('does not produce fake or unauthorized overflow sections', () => {
    const accessibleSections = getAccessibleNavigationSections({
      ...financeUser,
      allowedSections: ['Home', 'Clients', 'Finance', 'Settings'],
      permissions: {
        ...financeUser.permissions,
        canViewFinancialReports: false,
      },
    })
    const mobileSections = getMobileNavigationSections(accessibleSections)
    const renderedSections = [
      ...mobileSections.primarySections,
      ...mobileSections.overflowSections,
    ]

    expect(renderedSections).toEqual(accessibleSections)
    expect(renderedSections).not.toContain('Finance')
    expect(renderedSections).not.toContain('Notifications')
  })
})
