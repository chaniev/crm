import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  createUser,
  getBranches,
  getUser,
  getUsers,
  updateUser,
  type Branch,
  type UserDetails,
  type UserListResponse,
} from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import { UserCreateScreen, UserEditScreen, UsersListScreen } from './UserManagement'

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  createUser: vi.fn(),
  getBranches: vi.fn(),
  getUser: vi.fn(),
  getUsers: vi.fn(),
  updateUser: vi.fn(),
}))

const branches: Branch[] = [
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
    id: 'branch-archived',
    name: 'Старый филиал',
    address: null,
    description: null,
    isArchived: true,
    hallCount: 0,
    groupCount: 0,
    clientCount: 0,
  },
]

const coach: UserDetails = {
  id: 'coach-1',
  fullName: 'Тренер',
  login: 'coach',
  role: 'Coach',
  mustChangePassword: false,
  isActive: true,
  messengerPlatform: null,
  messengerPlatformUserId: null,
  branchId: null,
  branchName: null,
  allowedActions: ['Edit'],
  roleOptions: ['Coach'],
}

beforeEach(() => {
  vi.mocked(createUser).mockReset()
  vi.mocked(getBranches).mockReset()
  vi.mocked(getUser).mockReset()
  vi.mocked(getUsers).mockReset()
  vi.mocked(updateUser).mockReset()
  vi.mocked(getBranches).mockResolvedValue(branches)
})

describe('UsersListScreen', () => {
  test('renders backend-read-only protected targets without edit action', async () => {
    vi.mocked(getUsers).mockResolvedValue({
      items: [
        {
          ...coach,
          id: 'superadmin-1',
          fullName: 'Суперадминистратор',
          login: 'superadmin',
          role: 'SuperAdministrator',
          allowedActions: [],
          roleOptions: ['SuperAdministrator'],
        },
      ],
      createRoleOptions: ['Coach', 'SuperAdministrator'],
    } satisfies UserListResponse)

    renderWithProviders(<UsersListScreen onCreate={vi.fn()} onEdit={vi.fn()} />)

    const card = await screen.findByTestId('user-card-superadmin-1')
    expect(within(card).getAllByText('Суперадминистратор').length).toBeGreaterThan(0)
    expect(within(card).getByText('Только просмотр')).toBeVisible()
    expect(within(card).queryByRole('button', { name: 'Редактировать' })).not.toBeInTheDocument()
  })
})

describe('UserCreateScreen', () => {
  test('shows only backend-provided create role options and clears branch for SuperAdministrator', async () => {
    vi.mocked(createUser).mockResolvedValue({
      ...coach,
      id: 'superadmin-1',
      role: 'SuperAdministrator',
      branchId: null,
    })
    const onCreated = vi.fn()

    renderWithProviders(
      <UserCreateScreen
        createRoleOptions={['Coach', 'SuperAdministrator']}
        onCancel={vi.fn()}
        onCreated={onCreated}
      />,
    )

    fireEvent.change(screen.getByLabelText('ФИО'), { target: { value: 'Супер Админ' } })
    fireEvent.change(screen.getByLabelText('Логин'), { target: { value: 'superadmin' } })
    fireEvent.change(screen.getByLabelText('Стартовый пароль'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('combobox', { name: 'Роль' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Суперадминистратор' }))
    expect(screen.queryByLabelText('Филиал администратора')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить тренера' }))

    await waitFor(() => expect(createUser).toHaveBeenCalledWith(expect.objectContaining({
      role: 'SuperAdministrator',
      branchId: null,
    })))
  })
})

describe('UserEditScreen', () => {
  test('preserves archived Administrator branch while using active branches for new destination choices', async () => {
    vi.mocked(getUser).mockResolvedValue({
      ...coach,
      id: 'admin-archived',
      fullName: 'Администратор старого филиала',
      role: 'Administrator',
      branchId: 'branch-archived',
      branchName: 'Старый филиал',
      allowedActions: ['Edit'],
      roleOptions: ['Administrator'],
    })
    vi.mocked(updateUser).mockResolvedValue({
      ...coach,
      id: 'admin-archived',
      role: 'Administrator',
      branchId: 'branch-archived',
      branchName: 'Старый филиал',
    })

    renderWithProviders(
      <UserEditScreen
        currentUserId="headcoach-1"
        onBack={vi.fn()}
        onRefreshSession={vi.fn()}
        userId="admin-archived"
      />,
    )

    expect(await screen.findByDisplayValue(/Старый филиал/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }))
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith('admin-archived', expect.objectContaining({
      role: 'Administrator',
      branchId: 'branch-archived',
    })))
  })

  test('renders protected target as read-only when backend returns no mutation actions', async () => {
    vi.mocked(getUser).mockResolvedValue({
      ...coach,
      id: 'superadmin-1',
      fullName: 'Суперадминистратор',
      login: 'superadmin',
      role: 'SuperAdministrator',
      allowedActions: [],
      roleOptions: ['SuperAdministrator'],
    })

    renderWithProviders(
      <UserEditScreen
        currentUserId="superadmin-current"
        onBack={vi.fn()}
        onRefreshSession={vi.fn()}
        userId="superadmin-1"
      />,
    )

    expect(await screen.findByText('Карточка доступна только для просмотра')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Сохранить изменения' })).not.toBeInTheDocument()
  })
})
