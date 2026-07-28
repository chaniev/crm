import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  ApiError,
  createAdministrator,
  getAdministratorAttendanceScope,
  getAdministrators,
  getBranches,
  getGroupTypes,
  getMembershipCatalogItems,
  replaceAdministratorAttendanceScope,
  updateAdministrator,
  updateGroupType,
  type AuthenticatedUser,
  type AdministratorAttendanceScopeResponse,
  type GroupType,
  type UserListItem,
} from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import { showAppNotification } from '../shared/notifications'
import { SettingsScreen } from './SettingsScreen'

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  createAdministrator: vi.fn(),
  getAdministratorAttendanceScope: vi.fn(),
  getAdministrators: vi.fn(),
  getBranches: vi.fn(),
  getGroupTypes: vi.fn(),
  getMembershipCatalogItems: vi.fn(),
  replaceAdministratorAttendanceScope: vi.fn(),
  updateAdministrator: vi.fn(),
  updateGroupType: vi.fn(),
}))

vi.mock('../shared/notifications', () => ({
  showAppNotification: vi.fn(),
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
  attendanceScope: { kind: 'Global', groupIds: [] },
  branchId: null,
  createRoleOptions: ['Administrator'],
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
  vi.mocked(createAdministrator).mockReset()
  vi.mocked(getAdministratorAttendanceScope).mockReset()
  vi.mocked(getAdministrators).mockReset()
  vi.mocked(getBranches).mockReset()
  vi.mocked(getGroupTypes).mockReset()
  vi.mocked(getMembershipCatalogItems).mockReset()
  vi.mocked(replaceAdministratorAttendanceScope).mockReset()
  vi.mocked(updateAdministrator).mockReset()
  vi.mocked(updateGroupType).mockReset()
  vi.mocked(showAppNotification).mockReset()
  vi.mocked(getAdministrators).mockResolvedValue({ items: [], createRoleOptions: ['Administrator'] })
  vi.mocked(getAdministratorAttendanceScope).mockResolvedValue(buildAttendanceScope())
  vi.mocked(replaceAdministratorAttendanceScope).mockResolvedValue(buildAttendanceScope({
    grantedGroupIds: ['group-2'],
    groups: [
      { ...buildAttendanceScope().groups[0], isGranted: false },
      { ...buildAttendanceScope().groups[1], isGranted: true },
      buildAttendanceScope().groups[2],
    ],
  }))
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

  test('показывает фактическую роль администратора в строке списка', async () => {
    vi.mocked(getAdministrators).mockResolvedValue({
      items: [
        {
          ...buildAdministrator(),
          id: 'superadmin-1',
          fullName: 'Суперадминистратор',
          login: 'superadmin',
          role: 'SuperAdministrator',
          allowedActions: ['Edit'],
          roleOptions: ['Administrator'],
        },
      ],
      createRoleOptions: ['Administrator', 'SuperAdministrator'],
    })

    renderSettings({
      role: 'HeadCoach',
      permissions: {
        ...baseUser.permissions,
      },
      createRoleOptions: ['SuperAdministrator', 'Administrator'],
      branchId: null,
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Администраторы' }))
    const card = await screen.findByTestId('administrator-card-superadmin-1')
    expect(
      within(card).getByText('Суперадминистратор', {
        selector: '.mantine-Badge-label',
      }),
    ).toBeVisible()
    expect(within(card).getByText('Доступ: все филиалы')).toBeVisible()
    expect(within(card).queryByText(/Филиал:/)).not.toBeInTheDocument()
    expect(within(card).queryByText(/Посещения:/)).not.toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Редактировать' })).toBeVisible()
  })

  test('показывает управление группами посещений только по backend allowed action', async () => {
    vi.mocked(getAdministrators).mockResolvedValue({
      items: [
        {
          ...buildAdministrator(),
          id: 'superadmin-1',
          fullName: 'Суперадминистратор',
          login: 'superadmin',
          role: 'SuperAdministrator',
          branchId: null,
          branchName: null,
          attendanceGroupGrantCount: undefined,
          allowedActions: ['ManageAttendanceScope'],
          roleOptions: ['SuperAdministrator'],
        },
      ],
      createRoleOptions: ['Administrator'],
    })

    renderSettings()

    fireEvent.click(screen.getByRole('tab', { name: 'Администраторы' }))
    const card = await screen.findByTestId('administrator-card-superadmin-1')

    expect(within(card).getByRole('button', { name: 'Группы посещений' })).toBeVisible()
    expect(within(card).queryByRole('button', { name: 'Редактировать' })).not.toBeInTheDocument()
  })

  test('создаёт суперадминистратора из backend options и очищает филиал', async () => {
    vi.mocked(getAdministrators).mockResolvedValue({
      items: [],
      createRoleOptions: ['Administrator', 'SuperAdministrator'],
    })
    vi.mocked(createAdministrator).mockResolvedValue({
      ...buildAdministrator(),
      id: 'superadmin-created',
      fullName: 'Новый Суперадминистратор',
      login: 'new-superadmin',
      role: 'SuperAdministrator',
      branchId: null,
      branchName: null,
      attendanceGroupGrantCount: undefined,
      roleOptions: ['SuperAdministrator'],
    })

    renderSettings({
      role: 'HeadCoach',
      createRoleOptions: ['Administrator', 'SuperAdministrator'],
      branchId: null,
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Администраторы' }))
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Добавить администратора' }))[0],
    )

    const dialog = await screen.findByRole('dialog', { name: 'Новый администратор' })
    fireEvent.change(within(dialog).getByLabelText('ФИО'), {
      target: { value: 'Новый Суперадминистратор' },
    })
    fireEvent.change(within(dialog).getByLabelText('Логин'), {
      target: { value: 'new-superadmin' },
    })
    fireEvent.change(within(dialog).getByLabelText('Стартовый пароль'), {
      target: { value: 'Password1!' },
    })
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Роль' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Суперадминистратор' }))

    expect(within(dialog).queryByLabelText('Филиал администратора')).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    await waitFor(() =>
      expect(createAdministrator).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'SuperAdministrator',
          branchId: null,
        }),
      ),
    )
  })

  test('одна backend-роль хранится без selector и блокирует повторный submit', async () => {
    vi.mocked(getAdministrators).mockResolvedValue({
      items: [],
      createRoleOptions: ['Administrator'],
    })
    let resolveCreate: ((administrator: UserListItem) => void) | undefined
    vi.mocked(createAdministrator).mockReturnValue(new Promise((resolve) => {
      resolveCreate = resolve
    }))

    renderSettings()
    fireEvent.click(screen.getByRole('tab', { name: 'Администраторы' }))
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Добавить администратора' }))[0],
    )

    const dialog = await screen.findByRole('dialog', { name: 'Новый администратор' })
    expect(within(dialog).queryByRole('combobox', { name: 'Роль' })).not.toBeInTheDocument()
    expect(within(dialog).getByLabelText('Филиал администратора')).toHaveValue('Центр')

    fireEvent.change(within(dialog).getByLabelText('ФИО'), {
      target: { value: 'Новый Администратор' },
    })
    fireEvent.change(within(dialog).getByLabelText('Логин'), {
      target: { value: 'new-administrator' },
    })
    fireEvent.change(within(dialog).getByLabelText('Стартовый пароль'), {
      target: { value: 'Password1!' },
    })

    const save = within(dialog).getByRole('button', { name: 'Сохранить' })
    fireEvent.click(save)
    fireEvent.click(save)

    await waitFor(() => expect(createAdministrator).toHaveBeenCalledTimes(1))
    expect(createAdministrator).toHaveBeenCalledWith(expect.objectContaining({
      role: 'Administrator',
      branchId: 'branch-1',
    }))
    expect(save).toBeDisabled()

    resolveCreate?.(buildAdministrator({
      id: 'administrator-created',
      fullName: 'Новый Администратор',
      login: 'new-administrator',
    }))
    await waitFor(() => expect(dialog).not.toBeInTheDocument())
  })

  test('подставляет единственный активный филиал после догрузки открытой формы создания', async () => {
    let resolveBranches: ((branches: Awaited<ReturnType<typeof getBranches>>) => void) | undefined
    vi.mocked(getBranches).mockReturnValue(new Promise((resolve) => {
      resolveBranches = resolve
    }))

    renderSettings()
    fireEvent.click(screen.getByRole('tab', { name: 'Администраторы' }))
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Добавить администратора' }))[0],
    )

    const dialog = await screen.findByRole('dialog', { name: 'Новый администратор' })
    const branch = within(dialog).getByRole('combobox', { name: 'Филиал администратора' })
    expect(branch).toBeDisabled()
    expect(branch).toHaveValue('')

    resolveBranches?.([
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

    await waitFor(() =>
      expect(
        within(dialog).getByRole('combobox', { name: 'Филиал администратора' }),
      ).toHaveValue('Центр'),
    )
  })

  test('несколько активных филиалов требуют явного выбора', async () => {
    vi.mocked(getAdministrators).mockResolvedValue({
      items: [],
      createRoleOptions: ['Administrator', 'SuperAdministrator'],
    })
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
      {
        id: 'branch-2',
        name: 'Север',
        address: null,
        description: null,
        isArchived: false,
        hallCount: 0,
        groupCount: 0,
        clientCount: 0,
      },
    ])

    renderSettings({
      role: 'HeadCoach',
      createRoleOptions: ['Administrator', 'SuperAdministrator'],
    })
    fireEvent.click(screen.getByRole('tab', { name: 'Администраторы' }))
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Добавить администратора' }))[0],
    )

    const dialog = await screen.findByRole('dialog', { name: 'Новый администратор' })
    const branch = within(dialog).getByRole('combobox', { name: 'Филиал администратора' })
    expect(branch).toHaveValue('')

    fireEvent.change(within(dialog).getByLabelText('ФИО'), {
      target: { value: 'Новый Администратор' },
    })
    fireEvent.change(within(dialog).getByLabelText('Логин'), {
      target: { value: 'new-administrator' },
    })
    fireEvent.change(within(dialog).getByLabelText('Стартовый пароль'), {
      target: { value: 'Password1!' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    expect(await within(dialog).findByText('Выберите филиал администратора.')).toBeVisible()
    expect(createAdministrator).not.toHaveBeenCalled()
  })

  test('различает отсутствие активных филиалов и ошибку их загрузки', async () => {
    vi.mocked(getAdministrators).mockResolvedValue({
      items: [],
      createRoleOptions: ['Administrator', 'SuperAdministrator'],
    })
    vi.mocked(getBranches).mockResolvedValue([])

    const { unmount } = renderSettings({
      role: 'HeadCoach',
      createRoleOptions: ['Administrator', 'SuperAdministrator'],
      branchId: null,
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Администраторы' }))
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Добавить администратора' }))[0],
    )
    const emptyDialog = await screen.findByRole('dialog', { name: 'Новый администратор' })
    expect(within(emptyDialog).getByText(/Нет активных филиалов/)).toBeVisible()
    expect(within(emptyDialog).getByRole('button', { name: 'Сохранить' })).toBeDisabled()
    fireEvent.click(within(emptyDialog).getByRole('combobox', { name: 'Роль' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Суперадминистратор' }))
    expect(within(emptyDialog).queryByText(/Нет активных филиалов/)).not.toBeInTheDocument()
    expect(within(emptyDialog).getByRole('button', { name: 'Сохранить' })).toBeEnabled()

    unmount()
    vi.mocked(getBranches).mockRejectedValue(new Error('network error'))
    renderSettings({
      role: 'HeadCoach',
      createRoleOptions: ['Administrator', 'SuperAdministrator'],
      branchId: null,
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Администраторы' }))
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Добавить администратора' }))[0],
    )
    const errorDialog = await screen.findByRole('dialog', { name: 'Новый администратор' })
    expect(within(errorDialog).getByText('Филиалы не загрузились')).toBeVisible()
    expect(within(errorDialog).getByRole('button', { name: 'Повторить' })).toBeVisible()
    fireEvent.click(within(errorDialog).getByRole('combobox', { name: 'Роль' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Суперадминистратор' }))
    expect(within(errorDialog).queryByText('Филиалы не загрузились')).not.toBeInTheDocument()
    expect(within(errorDialog).getByRole('button', { name: 'Сохранить' })).toBeEnabled()
  })

  test('staff_not_found закрывает stale edit и перезагружает список', async () => {
    const administrator = buildAdministrator()
    vi.mocked(getAdministrators).mockResolvedValue({
      items: [administrator],
      createRoleOptions: ['Administrator'],
    })
    vi.mocked(updateAdministrator).mockRejectedValue(
      new ApiError(
        'Администратор больше не доступен.',
        404,
        {},
        'staff_not_found',
      ),
    )

    renderSettings()
    fireEvent.click(screen.getByRole('tab', { name: 'Администраторы' }))
    const card = await screen.findByTestId(`administrator-card-${administrator.id}`)
    fireEvent.click(within(card).getByRole('button', { name: 'Редактировать' }))

    const dialog = await screen.findByRole('dialog', { name: 'Редактирование администратора' })
    fireEvent.change(within(dialog).getByLabelText('ФИО'), {
      target: { value: 'Устаревшая запись' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    expect(showAppNotification).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Запись изменилась',
    }))
    await waitFor(() => expect(getAdministrators).toHaveBeenCalledTimes(2))
  })

  test.each([
    {
      role: 'HeadCoach' as const,
      canManageSettings: true,
      createRoleOptions: ['SuperAdministrator', 'Administrator'] as NonNullable<
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

  test('opens backend-driven attendance scope modal and confirms staged revoke before saving', async () => {
    const administrator = buildAdministrator()
    vi.mocked(getAdministrators).mockResolvedValue({
      items: [administrator],
      createRoleOptions: ['Administrator'],
    })
    vi.mocked(getAdministratorAttendanceScope).mockResolvedValue(buildAttendanceScope())

    renderSettings()

    fireEvent.click(screen.getByRole('tab', { name: 'Администраторы' }))
    const card = await screen.findByTestId(`administrator-card-${administrator.id}`)

    expect(within(card).getByText('Посещения: 1 группа')).toBeVisible()
    fireEvent.click(within(card).getByRole('button', { name: 'Группы посещений' }))

    const dialog = await screen.findByRole('dialog', { name: 'Группы посещений' })
    expect(within(dialog).getByText('Мария Администратор')).toBeVisible()
    expect(within(dialog).getByText('Филиал: Центр')).toBeVisible()
    expect(within(dialog).getByText('Выбрано: 1')).toBeVisible()
    expect(within(dialog).getByLabelText('Поиск группы')).toBeVisible()
    expect(within(dialog).getByRole('checkbox', { name: /Вечерняя/ })).toBeChecked()
    expect(within(dialog).getByRole('checkbox', { name: /Утренняя/ })).not.toBeChecked()
    expect(within(dialog).getByRole('checkbox', { name: /Архивная/ })).toBeDisabled()
    expect(within(dialog).getByText('Группа отключена')).toBeVisible()

    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Вечерняя/ }))
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Утренняя/ }))
    expect(within(dialog).getByText('К отзыву: 1')).toBeVisible()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }))
    expect(within(dialog).getByText(/Будет отозван доступ к 1 группе/)).toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'Вернуться' })).toBeVisible()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Отозвать и сохранить' }))

    await waitFor(() =>
      expect(replaceAdministratorAttendanceScope).toHaveBeenCalledWith(administrator.id, {
        expectedGroupIds: ['group-1'],
        groupIds: ['group-2'],
      }),
    )
    expect(await screen.findByText('Посещения: 1 группа')).toBeVisible()
  })

  test('keeps attendance scope selection after concurrency conflict and can reload backend state', async () => {
    const administrator = buildAdministrator()
    vi.mocked(getAdministrators).mockResolvedValue({
      items: [administrator],
      createRoleOptions: ['Administrator'],
    })
    vi.mocked(replaceAdministratorAttendanceScope).mockRejectedValueOnce(
      new ApiError(
        'Данные изменились. Обновите список групп.',
        409,
        {},
        'attendance_grant_concurrency_conflict',
      ),
    )
    vi.mocked(getAdministratorAttendanceScope)
      .mockResolvedValueOnce(buildAttendanceScope())
      .mockResolvedValueOnce(buildAttendanceScope({
        grantedGroupIds: ['group-2'],
        groups: [
          { ...buildAttendanceScope().groups[0], isGranted: false },
          { ...buildAttendanceScope().groups[1], isGranted: true },
          buildAttendanceScope().groups[2],
        ],
      }))

    renderSettings()
    fireEvent.click(screen.getByRole('tab', { name: 'Администраторы' }))
    const card = await screen.findByTestId(`administrator-card-${administrator.id}`)
    fireEvent.click(within(card).getByRole('button', { name: 'Группы посещений' }))

    const dialog = await screen.findByRole('dialog', { name: 'Группы посещений' })
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Утренняя/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }))

    expect(await within(dialog).findByText('Данные изменились. Обновите список групп.')).toBeVisible()
    expect(within(dialog).getByRole('checkbox', { name: /Утренняя/ })).toBeChecked()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Обновить данные' }))
    await waitFor(() => expect(getAdministratorAttendanceScope).toHaveBeenCalledTimes(2))
    expect(within(dialog).getByRole('checkbox', { name: /Утренняя/ })).toBeChecked()
    expect(within(dialog).getByRole('checkbox', { name: /Вечерняя/ })).not.toBeChecked()
  })

  test('shows attendance grants revoke guidance from backend staff edit conflict', async () => {
    const administrator = buildAdministrator()
    vi.mocked(getAdministrators).mockResolvedValue({
      items: [administrator],
      createRoleOptions: ['Administrator'],
    })
    vi.mocked(updateAdministrator).mockRejectedValueOnce(
      new ApiError(
        'Сначала отзовите группы посещений.',
        409,
        {},
        'attendance_grants_must_be_revoked',
      ),
    )

    renderSettings()
    fireEvent.click(screen.getByRole('tab', { name: 'Администраторы' }))
    const card = await screen.findByTestId(`administrator-card-${administrator.id}`)
    fireEvent.click(within(card).getByRole('button', { name: 'Редактировать' }))

    const editDialog = await screen.findByRole('dialog', { name: 'Редактирование администратора' })
    const loginInput = within(editDialog).getByLabelText('Логин')
    fireEvent.change(loginInput, { target: { value: 'maria-updated' } })
    fireEvent.click(within(editDialog).getByRole('button', { name: 'Сохранить' }))

    expect(await within(editDialog).findByText('Сначала отзовите группы посещений.')).toBeVisible()
    expect(loginInput).toHaveValue('maria-updated')

    fireEvent.click(within(editDialog).getByRole('button', { name: 'Открыть группы посещений' }))
    expect(await screen.findByRole('dialog', { name: 'Группы посещений' })).toBeVisible()
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

function buildAdministrator(overrides: Partial<UserListItem> = {}): UserListItem {
  return {
    id: 'administrator-1',
    fullName: 'Мария Администратор',
    login: 'maria',
    role: 'Administrator',
    mustChangePassword: false,
    isActive: true,
    messengerPlatform: null,
    messengerPlatformUserId: null,
    branchId: 'branch-1',
    branchName: 'Центр',
    attendanceGroupGrantCount: 1,
    allowedActions: ['Edit', 'ManageAttendanceScope'],
    ...overrides,
  }
}

function buildAttendanceScope(
  overrides: Partial<AdministratorAttendanceScopeResponse> = {},
): AdministratorAttendanceScopeResponse {
  return {
    administrator: {
      id: 'administrator-1',
      fullName: 'Мария Администратор',
      isActive: true,
    },
    branch: {
      id: 'branch-1',
      name: 'Центр',
      isArchived: false,
    },
    grantedGroupIds: ['group-1'],
    groups: [
      {
        id: 'group-1',
        name: 'Вечерняя',
        trainingStartTime: '19:00',
        durationMinutes: 60,
        weekdays: [1, 3],
        isActive: true,
        isGranted: true,
        canGrant: true,
        canRevoke: true,
        disabledReason: null,
      },
      {
        id: 'group-2',
        name: 'Утренняя',
        trainingStartTime: '09:00',
        durationMinutes: 45,
        weekdays: [2, 4],
        isActive: true,
        isGranted: false,
        canGrant: true,
        canRevoke: false,
        disabledReason: null,
      },
      {
        id: 'group-3',
        name: 'Архивная',
        isActive: false,
        isGranted: false,
        canGrant: false,
        canRevoke: false,
        disabledReason: 'group_inactive',
      },
    ],
    unavailableGrants: [],
    ...overrides,
  }
}
