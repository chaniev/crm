import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  ApiError,
  getAdministrators,
  getBranches,
  getGroupTypes,
  getMembershipCatalogItems,
  updateGroupType,
  type AuthenticatedUser,
  type GroupType,
} from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import { SettingsScreen } from './SettingsScreen'

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  getAdministrators: vi.fn(),
  getBranches: vi.fn(),
  getGroupTypes: vi.fn(),
  getMembershipCatalogItems: vi.fn(),
  updateGroupType: vi.fn(),
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

const existingGroupType: GroupType = {
  id: 'group-type-1',
  name: 'Йога',
  description: 'Мягкая практика',
  groupCount: 2,
}

beforeAll(() => {
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  })
})

beforeEach(() => {
  vi.mocked(getAdministrators).mockReset()
  vi.mocked(getBranches).mockReset()
  vi.mocked(getGroupTypes).mockReset()
  vi.mocked(getMembershipCatalogItems).mockReset()
  vi.mocked(updateGroupType).mockReset()
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
  vi.mocked(getMembershipCatalogItems).mockResolvedValue([])
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

  test.each([
    {
      role: 'HeadCoach' as const,
      canManageSettings: true,
      createRoleOptions: ['SuperAdministrator', 'Administrator', 'Coach'] as NonNullable<
        AuthenticatedUser['createRoleOptions']
      >,
      expectsGroupTypes: true,
      expectsBranches: true,
      expectsAdministrators: true,
    },
    {
      role: 'SuperAdministrator' as const,
      canManageSettings: true,
      createRoleOptions: ['Administrator'] as NonNullable<
        AuthenticatedUser['createRoleOptions']
      >,
      expectsGroupTypes: true,
      expectsBranches: false,
      expectsAdministrators: true,
    },
    {
      role: 'Administrator' as const,
      canManageSettings: true,
      createRoleOptions: [] as NonNullable<AuthenticatedUser['createRoleOptions']>,
      expectsGroupTypes: true,
      expectsBranches: false,
      expectsAdministrators: false,
    },
    {
      role: 'Coach' as const,
      canManageSettings: false,
      createRoleOptions: [] as NonNullable<AuthenticatedUser['createRoleOptions']>,
      expectsGroupTypes: false,
      expectsBranches: false,
      expectsAdministrators: false,
    },
  ])(
    'renders settings tabs for $role from capability boundaries',
    async ({
      role,
      canManageSettings,
      createRoleOptions,
      expectsGroupTypes,
      expectsBranches,
      expectsAdministrators,
    }) => {
      vi.mocked(getGroupTypes).mockResolvedValue([existingGroupType])

      renderSettings({
        role,
        permissions: {
          ...baseUser.permissions,
          canManageSettings,
        },
        branchId: role === 'Administrator' || role === 'Coach' ? 'branch-1' : null,
        createRoleOptions,
      })

      expect(screen.getByRole('tab', { name: 'Абонементы' })).toBeVisible()

      const groupTypesTab = screen.queryByRole('tab', { name: 'Типы групп' })
      const branchesTab = screen.queryByRole('tab', { name: 'Филиалы и залы' })
      const administratorsTab = screen.queryByRole('tab', { name: 'Администраторы' })

      if (expectsGroupTypes) {
        expect(groupTypesTab).toBeVisible()
        fireEvent.click(groupTypesTab!)
        expect(await screen.findByText(existingGroupType.name)).toBeVisible()
        expect(screen.getByText(existingGroupType.description!)).toBeVisible()
      } else {
        expect(groupTypesTab).not.toBeInTheDocument()
      }

      if (expectsBranches) {
        expect(branchesTab).toBeVisible()
      } else {
        expect(branchesTab).not.toBeInTheDocument()
      }

      if (expectsAdministrators) {
        expect(administratorsTab).toBeVisible()
      } else {
        expect(administratorsTab).not.toBeInTheDocument()
      }
    },
  )

  test.each([
    {
      role: 'Administrator' as const,
      createRoleOptions: [] as NonNullable<AuthenticatedUser['createRoleOptions']>,
    },
    {
      role: 'SuperAdministrator' as const,
      createRoleOptions: ['Administrator'] as NonNullable<
        AuthenticatedUser['createRoleOptions']
      >,
    },
  ])(
    'updates a group type as $role and keeps stable list metadata',
    async ({ role, createRoleOptions }) => {
      vi.mocked(getGroupTypes).mockResolvedValue([existingGroupType])
      vi.mocked(updateGroupType).mockResolvedValue({
        ...existingGroupType,
        name: 'Йога PRO',
        description: 'Обновленное описание',
      })

      renderSettings({
        role,
        branchId: role === 'Administrator' ? 'branch-1' : null,
        createRoleOptions,
      })

      fireEvent.click(screen.getByRole('tab', { name: 'Типы групп' }))
      const card = await screen.findByTestId(`group-type-card-${existingGroupType.id}`)
      fireEvent.click(within(card).getByRole('button', { name: 'Редактировать' }))

      const dialog = await screen.findByRole('dialog', { name: 'Редактирование типа' })
      const nameInput = within(dialog).getByRole('textbox', { name: 'Название' })
      const descriptionInput = within(dialog).getByRole('textbox', { name: 'Описание' })

      expect(nameInput).toHaveValue(existingGroupType.name)
      expect(descriptionInput).toHaveValue(existingGroupType.description)

      fireEvent.change(nameInput, { target: { value: '  Йога PRO  ' } })
      fireEvent.change(descriptionInput, { target: { value: '  Обновленное описание  ' } })
      fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

      await waitFor(() =>
        expect(updateGroupType).toHaveBeenCalledWith(existingGroupType.id, {
          name: 'Йога PRO',
          description: 'Обновленное описание',
        }),
      )
      expect(await screen.findByText('Йога PRO')).toBeVisible()

      const updatedCard = screen.getByTestId(`group-type-card-${existingGroupType.id}`)
      expect(within(updatedCard).getByText('Обновленное описание')).toBeVisible()
      expect(within(updatedCard).getByText('Групп: 2')).toBeVisible()
    },
  )

  test('keeps backend validation errors in the Administrator edit modal without local uniqueness rules', async () => {
    vi.mocked(getGroupTypes).mockResolvedValue([existingGroupType])
    vi.mocked(updateGroupType).mockRejectedValue(
      new ApiError('Проверьте тип группы.', 400, {
        name: ['Тип группы с таким названием уже существует.'],
      }),
    )

    renderSettings({
      role: 'Administrator',
      branchId: 'branch-1',
      createRoleOptions: [],
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Типы групп' }))
    const card = await screen.findByTestId(`group-type-card-${existingGroupType.id}`)
    fireEvent.click(within(card).getByRole('button', { name: 'Редактировать' }))

    const dialog = await screen.findByRole('dialog', { name: 'Редактирование типа' })
    const nameInput = within(dialog).getByRole('textbox', { name: 'Название' })

    fireEvent.change(nameInput, { target: { value: 'Йога' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    expect(await within(dialog).findByText('Проверьте тип группы.')).toBeVisible()
    expect(within(dialog).getByText('Тип группы с таким названием уже существует.')).toBeVisible()
    expect(nameInput).toHaveValue('Йога')
    expect(screen.getByRole('dialog', { name: 'Редактирование типа' })).toBeVisible()

    await waitFor(() =>
      expect(updateGroupType).toHaveBeenCalledWith(existingGroupType.id, {
        name: 'Йога',
        description: existingGroupType.description,
      }),
    )
  })
})

function renderSettings(user: Partial<AuthenticatedUser> = {}) {
  return renderWithProviders(
    <SettingsScreen
      user={{
        ...baseUser,
        ...user,
        permissions: {
          ...baseUser.permissions,
          ...user.permissions,
        },
      }}
    />,
  )
}
