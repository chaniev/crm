import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  getAdministrators,
  getBranches,
  getGroupTypes,
  type AuthenticatedUser,
} from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import { SettingsScreen } from './SettingsScreen'

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  getAdministrators: vi.fn(),
  getBranches: vi.fn(),
  getGroupTypes: vi.fn(),
}))

const baseUser: AuthenticatedUser = {
  id: 'user-1',
  fullName: 'Пользователь',
  login: 'user',
  role: 'SuperAdministrator',
  mustChangePassword: false,
  isActive: true,
  landingScreen: 'Settings',
  allowedSections: ['Settings'],
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
}

beforeEach(() => {
  vi.mocked(getAdministrators).mockReset()
  vi.mocked(getBranches).mockReset()
  vi.mocked(getGroupTypes).mockReset()
  vi.mocked(getAdministrators).mockResolvedValue({ items: [], createRoleOptions: ['Administrator'] })
  vi.mocked(getBranches).mockResolvedValue([
    {
      id: 'branch-1',
      name: 'Центр',
      address: null,
      description: null,
      isArchived: false,
      hallCount: 0,
      groupCount: 0,
      clientCount: 0,
    },
  ])
  vi.mocked(getGroupTypes).mockResolvedValue([])
})

describe('SettingsScreen', () => {
  test('shows staff-management tab to SuperAdministrator from permissions/options', async () => {
    renderWithProviders(<SettingsScreen user={baseUser} />)

    expect(screen.getByRole('tab', { name: 'Администраторы' })).toBeVisible()
  })

  test('keeps ordinary Administrator settings without staff-management controls', () => {
    renderWithProviders(
      <SettingsScreen
        user={{
          ...baseUser,
          role: 'Administrator',
          permissions: {
            ...baseUser.permissions,
            canManageUsers: false,
            canMarkAttendance: false,
            canViewAuditLog: true,
          },
          branchId: 'branch-1',
          createRoleOptions: [],
        }}
      />,
    )

    expect(screen.getByRole('tab', { name: 'Абонементы' })).toBeVisible()
    expect(screen.queryByRole('tab', { name: 'Администраторы' })).not.toBeInTheDocument()
  })
})
