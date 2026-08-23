import { describe, expect, test } from 'vitest'
import type { AppSection, AuthenticatedUser } from './api'
import {
  getAccessibleNavigationSections,
  getMobileNavigationSections,
  getRoutePath,
  getSectionPath,
  parseRoute,
  resolveAccessibleRoutePath,
  resolveRouteAccess,
  type AppRoute,
} from './appRoutes'

const financeUser: AuthenticatedUser = {
  id: 'headcoach-id',
  fullName: 'Главный тренер',
  login: 'headcoach',
  role: 'HeadCoach',
  mustChangePassword: false,
  isActive: true,
  landingScreen: 'Attention',
  allowedSections: [
    'Attendance',
    'Attention',
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

const coachUser: AuthenticatedUser = {
  ...financeUser,
  id: 'coach-id',
  login: 'coach',
  role: 'Coach',
  landingScreen: 'Attendance',
  allowedSections: ['Attendance', 'Schedule', 'Clients'],
  permissions: {
    canManageUsers: false,
    canManageClients: false,
    canManageGroups: false,
    canManageSettings: false,
    canMarkAttendance: true,
    canViewAuditLog: false,
    canViewFinancialReports: false,
  },
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
        allowedSections: ['Attendance', 'Schedule', 'Clients'],
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
    ).toBe('/attention')
  })

  test('parses canonical /attendance section route', () => {
    const route = parseRoute('/attendance')

    expect(route).toEqual({ kind: 'section', section: 'Attendance' })
  })

  test('classifies root path as not-found', () => {
    expect(parseRoute('/')).toEqual({ kind: 'not-found', path: '/' })
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
      'Attendance',
      'Attention',
      'Schedule',
      'Clients',
      'Groups',
      'Users',
      'Audit',
      'Settings',
    ])
    expect(resolveRouteAccess(superAdministrator, { kind: 'section', section: 'Finance' })).toMatchObject({
      kind: 'restricted',
      recoveryPath: '/attention',
      requestedDestinationLabel: 'Финансы',
    })
  })
})

describe('route parsing and resolution matrix', () => {
  test('uses only canonical coaches routes and treats every legacy users route as not-found', () => {
    expect(parseRoute('/coaches')).toEqual({ kind: 'section', section: 'Users' })
    expect(parseRoute('/coaches/new')).toEqual({ kind: 'userCreate' })
    expect(parseRoute('/coaches/trainer-1/edit')).toEqual({
      kind: 'userEdit',
      userId: 'trainer-1',
    })
    expect(getSectionPath('Users')).toBe('/coaches')
    expect(getRoutePath({ kind: 'userCreate' })).toBe('/coaches/new')
    expect(getRoutePath({ kind: 'userEdit', userId: 'trainer 1' })).toBe(
      '/coaches/trainer%201/edit',
    )

    for (const legacyPath of ['/users', '/users/new', '/users/trainer-1/edit']) {
      expect(parseRoute(legacyPath)).toEqual({ kind: 'not-found', path: legacyPath })
    }
  })

  test('keeps the executable edit-route inventory to client, group and trainer', () => {
    const editRoutes = [
      { kind: 'clientEdit', clientId: 'client-1' },
      { kind: 'groupEdit', groupId: 'group-1' },
      { kind: 'userEdit', userId: 'trainer-1' },
    ] satisfies AppRoute[]

    expect(editRoutes.map((route) => route.kind)).toEqual([
      'clientEdit',
      'groupEdit',
      'userEdit',
    ])
    expect(editRoutes.map((route) => parseRoute(getRoutePath(route)))).toEqual(editRoutes)
  })

  test('preserves requested path for malformed unknown routes', () => {
    const malformedPath = '/%E0%AE'

    expect((parseRoute(malformedPath) as { kind: 'not-found'; path: string }).kind).toBe(
      'not-found',
    )
    expect((parseRoute(malformedPath) as { kind: 'not-found'; path: string }).path).toBe(
      malformedPath,
    )
  })

  test('maps unknown paths to not-found and keeps unknown denied outcome', () => {
    const unknownPath = '/clients-analytics?from=web'
    const route = parseRoute(unknownPath)

    expect(route).toEqual({ kind: 'not-found', path: unknownPath })
    expect(resolveRouteAccess(financeUser, route)).toEqual({
      kind: 'not-found',
      requestedPath: unknownPath,
      recoveryPath: '/attention',
      recoveryLabel: 'Внимание',
    })
  })

  test('allows section, read detail and utility password routes from current session contract', () => {
    expect(resolveRouteAccess(financeUser, parseRoute('/clients'))).toMatchObject({
      kind: 'allowed',
      requestedPath: '/clients',
      requestedDestinationLabel: 'Клиенты',
    })
    expect(resolveRouteAccess(financeUser, parseRoute('/clients/client-1'))).toMatchObject({
      kind: 'allowed',
      requestedPath: '/clients/client-1',
      requestedDestinationLabel: 'Клиенты',
    })
    expect(resolveRouteAccess(financeUser, parseRoute('/password'))).toMatchObject({
      kind: 'allowed',
      requestedPath: '/password',
      requestedDestinationLabel: 'Смена пароля',
    })
  })

  test('restricts write routes while recovering to a readable parent section', () => {
    const access = resolveRouteAccess(coachUser, parseRoute('/clients/new'))

    expect(access).toMatchObject({
      kind: 'restricted',
      requestedPath: '/clients/new',
      requestedDestinationLabel: 'Новый клиент',
      reason: { kind: 'operation', label: 'Новый клиент' },
      recoveryPath: '/clients',
      recoveryLabel: 'Клиенты',
    })
  })

  test('restricts section routes and recovers to the authorized landing or first section', () => {
    expect(resolveRouteAccess(coachUser, parseRoute('/groups'))).toMatchObject({
      kind: 'restricted',
      requestedPath: '/groups',
      requestedDestinationLabel: 'Группы',
      reason: { kind: 'section', label: 'Группы' },
      recoveryPath: '/attendance',
      recoveryLabel: 'Посещения',
    })

    const landingNotAllowed = {
      ...coachUser,
      landingScreen: 'Groups',
      allowedSections: ['Schedule', 'Clients'],
    } satisfies AuthenticatedUser

    expect(resolveRouteAccess(landingNotAllowed, parseRoute('/groups'))).toMatchObject({
      kind: 'restricted',
      recoveryPath: '/schedule',
      recoveryLabel: 'Расписание',
    })
  })

  test('keeps legacy path resolver as a compatibility wrapper over typed access', () => {
    expect(resolveAccessibleRoutePath(coachUser, { kind: 'clientCreate' })).toBe(
      '/clients',
    )
    expect(resolveAccessibleRoutePath(coachUser, { kind: 'section', section: 'Groups' })).toBe(
      '/attendance',
    )
  })
})

describe('client preview route', () => {
  test('parses and serializes /clients/:id/preview before details route', () => {
    const route = parseRoute('/clients/client-1/preview')

    expect(route).toEqual({
      kind: 'clientPreview',
      clientId: 'client-1',
    })
    expect(route.kind).toBe('clientPreview')
    if (route.kind !== 'clientPreview') {
      throw new Error('Expected client preview route')
    }
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
      primarySections: ['Attendance', 'Attention', 'Schedule', 'Clients'],
      overflowSections: ['Groups', 'Users', 'Audit', 'Finance', 'Settings'],
    })
  })

  test('promotes overflow destination to adaptive fourth slot when current section is overflow', () => {
    const accessibleSections = getAccessibleNavigationSections({
      ...financeUser,
      allowedSections: ['Attendance', 'Attention', 'Schedule', 'Clients', 'Groups', 'Finance', 'Users', 'Audit', 'Settings'],
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
      primarySections: ['Attendance', 'Attention', 'Schedule', 'Finance'],
      overflowSections: ['Clients', 'Groups', 'Users', 'Audit', 'Settings'],
    })
  })

  test('respects adaptive overflow slot on non-finance route', () => {
    const accessibleSections = getAccessibleNavigationSections({
      ...financeUser,
      allowedSections: ['Attendance', 'Attention', 'Schedule', 'Clients', 'Groups', 'Users', 'Audit', 'Settings'],
      permissions: {
        ...financeUser.permissions,
        canManageUsers: true,
        canViewAuditLog: true,
      },
    })

    expect(
      getMobileNavigationSectionsWithCurrent(accessibleSections, 'Users'),
    ).toEqual({
      primarySections: ['Attendance', 'Attention', 'Schedule', 'Users'],
      overflowSections: ['Clients', 'Groups', 'Audit', 'Settings'],
    })
  })

  test('shows coach sections directly when nothing overflows', () => {
    const accessibleSections = getAccessibleNavigationSections({
      ...financeUser,
      role: 'Coach',
      landingScreen: 'Attendance',
      allowedSections: ['Attendance', 'Schedule', 'Clients'],
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
      primarySections: ['Attendance', 'Schedule', 'Clients'],
      overflowSections: [],
    })
  })

  test('backfills missing primary candidates from remaining accessible sections', () => {
    const accessibleSections = getAccessibleNavigationSections({
      ...financeUser,
      allowedSections: ['Attendance', 'Groups', 'Settings'],
      permissions: {
        ...financeUser.permissions,
        canManageUsers: false,
        canViewAuditLog: false,
        canViewFinancialReports: false,
      },
    })

    expect(getMobileNavigationSections(accessibleSections)).toEqual({
      primarySections: ['Attendance', 'Groups', 'Settings'],
      overflowSections: [],
    })
  })

  test('does not produce fake or unauthorized overflow sections', () => {
    const accessibleSections = getAccessibleNavigationSections({
      ...financeUser,
      allowedSections: ['Attendance', 'Clients', 'Finance', 'Settings'],
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
