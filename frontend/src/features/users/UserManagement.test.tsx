import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
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
  test('renders a no-filter trainer locator with create and refresh in one action row', async () => {
    vi.mocked(getUsers).mockResolvedValue({
      items: [],
      createRoleOptions: ['Coach'],
    } satisfies UserListResponse)

    renderUsersList()

    await waitFor(() => expect(getUsers).toHaveBeenCalled())

    const locator = screen.getByRole('search')
    const buttons = within(locator).getAllByRole('button')

    expect(screen.getByRole('textbox', { name: 'Найти тренера' })).toHaveAttribute(
      'placeholder',
      'ФИО или логин',
    )
    expect(within(locator).queryByRole('button', { name: /фильтр/i })).not.toBeInTheDocument()
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Обновить',
      'Создать тренера',
    ])
    expect(buttons[0]).toHaveClass('task-toolbar-action--refresh')
    expect(buttons[1]).toHaveClass('task-toolbar-action--primary')
  })

  test('does not implement frontend filtering of non-coach targets', async () => {
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

    renderUsersList()

    const card = await screen.findByTestId('user-card-superadmin-1')
    expect(within(card).getAllByText('Суперадминистратор').length).toBeGreaterThan(0)
    expect(within(card).getByText('Только просмотр')).toBeVisible()
    expect(within(card).queryByRole('button', { name: 'Редактировать' })).not.toBeInTheDocument()
  })

  test('filters current backend-permitted items by full name or login and clear restores order', async () => {
    vi.mocked(getUsers).mockResolvedValue({
      items: [
        coach,
        {
          ...coach,
          id: 'coach-2',
          fullName: 'Анна Ветрова',
          login: 'anna.login',
        },
      ],
      createRoleOptions: ['Coach'],
    } satisfies UserListResponse)

    renderUsersList()

    const search = screen.getByRole('textbox', { name: 'Найти тренера' })
    expect(await screen.findByTestId('user-card-coach-1')).toBeVisible()
    expect(screen.getByTestId('user-card-coach-2')).toBeVisible()

    fireEvent.change(search, { target: { value: '  ANNA.LOGIN  ' } })

    expect(screen.queryByTestId('user-card-coach-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('user-card-coach-2')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Сбросить поисковый запрос' }))

    expect(screen.getByTestId('user-card-coach-1')).toBeVisible()
    expect(screen.getByTestId('user-card-coach-2')).toBeVisible()
    expect(search).toHaveFocus()
  })

  test('distinguishes first-run empty from query-scoped empty and clears recovery', async () => {
    vi.mocked(getUsers).mockResolvedValue({
      items: [],
      createRoleOptions: [],
    } satisfies UserListResponse)

    renderUsersList()

    expect(await screen.findByText('Тренеры пока не заведены')).toBeVisible()
    const search = screen.getByRole('textbox', { name: 'Найти тренера' })
    fireEvent.change(search, { target: { value: 'Иван' } })

    expect(screen.getByText('Тренеры не найдены')).toBeVisible()
    expect(screen.queryByText('Тренеры пока не заведены')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Очистить поиск' }))

    expect(search).toHaveValue('')
    expect(screen.getByText('Тренеры пока не заведены')).toBeVisible()
  })

  test('shows create only for a non-empty backend role option set', async () => {
    vi.mocked(getUsers).mockResolvedValue({
      items: [],
      createRoleOptions: [],
    } satisfies UserListResponse)
    const firstRender = renderUsersList()

    await waitFor(() => expect(getUsers).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'Создать тренера' })).not.toBeInTheDocument()

    firstRender.unmount()
    vi.mocked(getUsers).mockResolvedValue({
      items: [],
      createRoleOptions: ['Administrator'],
    } satisfies UserListResponse)
    renderUsersList()

    expect(await screen.findByRole('button', { name: 'Создать тренера' })).toBeVisible()
  })

  test('keeps retained filtered results during refresh and recovers from stale error', async () => {
    let rejectRefresh!: (reason: Error) => void
    const refreshPromise = new Promise<UserListResponse>((_resolve, reject) => {
      rejectRefresh = reject
    })
    vi.mocked(getUsers)
      .mockResolvedValueOnce({
        items: [coach],
        createRoleOptions: ['Coach'],
      } satisfies UserListResponse)
      .mockReturnValueOnce(refreshPromise)
      .mockResolvedValueOnce({
        items: [coach],
        createRoleOptions: ['Coach'],
      } satisfies UserListResponse)

    renderUsersList('coach')

    expect(await screen.findByTestId('user-card-coach-1')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }))

    const results = screen.getByRole('region', { name: 'Результаты поиска тренеров' })
    expect(results).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByTestId('user-card-coach-1')).toBeVisible()
    expect(screen.getByText('Обновляем список тренеров...')).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Найти тренера' })).toBeEnabled()

    rejectRefresh(new Error('Сеть недоступна'))

    expect(await screen.findByText('Список не обновился')).toBeVisible()
    expect(screen.getByText('Сеть недоступна')).toBeVisible()
    expect(screen.getByTestId('user-card-coach-1')).toBeVisible()
    expect(results).not.toHaveAttribute('aria-busy')

    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    await waitFor(() => expect(getUsers).toHaveBeenCalledTimes(3))
    expect(screen.queryByText('Список не обновился')).not.toBeInTheDocument()
  })

  test('keeps query through a blocking load error and explicit retry', async () => {
    vi.mocked(getUsers)
      .mockRejectedValueOnce(new Error('Сервис временно недоступен'))
      .mockResolvedValueOnce({
        items: [
          {
            ...coach,
            fullName: 'Анна Ветрова',
            login: 'anna.login',
          },
        ],
        createRoleOptions: ['Coach'],
      } satisfies UserListResponse)

    renderUsersList('anna')

    expect(await screen.findByText('Список не загрузился')).toBeVisible()
    expect(screen.getByText('Сервис временно недоступен')).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Найти тренера' })).toHaveValue('anna')

    fireEvent.click(
      screen.getByRole('button', { name: 'Повторить загрузку списка тренеров' }),
    )

    expect(await screen.findByText('Анна Ветрова')).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Найти тренера' })).toHaveValue('anna')
    expect(screen.queryByText('Список не загрузился')).not.toBeInTheDocument()
  })
})

function renderUsersList(initialQuery = '') {
  function Harness() {
    const [query, setQuery] = useState(initialQuery)

    return (
      <UsersListScreen
        onCreate={vi.fn()}
        onEdit={vi.fn()}
        onQueryChange={setQuery}
        query={query}
      />
    )
  }

  return renderWithProviders(<Harness />)
}

describe('UserCreateScreen', () => {
  test('hides role selector and sends fixed Coach payload when endpoint options are single Coach', async () => {
    vi.mocked(createUser).mockResolvedValue({
      ...coach,
      id: 'coach-created',
      role: 'Coach',
      branchId: null,
    })
    const onCreated = vi.fn()

    renderWithProviders(
      <UserCreateScreen
        onCancel={vi.fn()}
        onCreated={onCreated}
      />,
    )

    expect(screen.queryByRole('combobox', { name: 'Роль' })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('ФИО'), { target: { value: 'Новый Тренер' } })
    fireEvent.change(screen.getByLabelText('Логин'), { target: { value: 'new-coach' } })
    fireEvent.change(screen.getByLabelText('Стартовый пароль'), { target: { value: 'secret123' } })

    expect(screen.queryByLabelText('Филиал администратора')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить тренера' }))

    await waitFor(() => expect(createUser).toHaveBeenCalledWith(expect.objectContaining({
      fullName: 'Новый Тренер',
      login: 'new-coach',
      password: 'secret123',
      role: 'Coach',
      mustChangePassword: true,
      isActive: true,
      branchId: null,
    })))
  })
})

describe('UserEditScreen', () => {
  test('sends immutable Coach payload even when API returns stale branchId', async () => {
    vi.mocked(getUser).mockResolvedValue({
      ...coach,
      id: 'admin-archived',
      fullName: 'Тренер со старым филиалом',
      role: 'Coach',
      branchId: 'branch-archived',
      branchName: 'Старый филиал',
      allowedActions: ['Edit'],
      roleOptions: ['Coach'],
    })
    vi.mocked(updateUser).mockResolvedValue({
      ...coach,
      id: 'admin-archived',
      role: 'Coach',
      branchId: null,
      branchName: null,
    })

    renderWithProviders(
      <UserEditScreen
        currentUserId="headcoach-1"
        onBack={vi.fn()}
        onRefreshSession={vi.fn()}
        userId="admin-archived"
      />,
    )

    expect(await screen.findByDisplayValue(/Тренер со старым филиалом/)).toBeVisible()
    expect(screen.queryByText('Редактирование доступа')).not.toBeInTheDocument()
    expect(screen.queryByText('Логин фиксируется после создания тренера.')).not.toBeInTheDocument()
    expect(screen.queryByText('Что можно менять на этом экране')).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Доступны ФИО, активность, Telegram ID/),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(
        'Попросите тренера прислать ID из /start или /id бота. Если очистить поле, тренер потеряет доступ к боту.',
      ),
    ).toBeVisible()
    expect(screen.queryByLabelText('Филиал администратора')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }))
    await waitFor(() => expect(updateUser).toHaveBeenCalledWith('admin-archived', expect.objectContaining({
      role: 'Coach',
      branchId: null,
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
