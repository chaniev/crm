import { describe, expect, test } from 'vitest'
import type { AuthenticatedUser } from './api'
import {
  getAccessibleNavigationSections,
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
    'Attendance',
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
})
