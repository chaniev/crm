import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { AppConfigResponse, AuthenticatedUser } from './lib/api/types'
import { changePassword, loadSession } from './lib/api'
import {
  showAppNotification,
  showPoliteStatusNotification,
} from './features/shared/notifications'
import App from './App'

vi.mock('./features/shared/notifications', () => ({
  showAppNotification: vi.fn(),
  showPoliteStatusNotification: vi.fn(),
}))

vi.mock('./lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/api')>()

  return {
    ...actual,
    loadSession: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
  }
})

vi.mock('./features/clients/ClientManagement', () => ({
  ClientCreateScreen: () => <div data-testid="client-create-screen">New client screen</div>,
  ClientDetailScreen: () => <div data-testid="client-detail-screen">Client detail</div>,
  ClientEditScreen: () => <div data-testid="client-edit-screen">Client edit</div>,
  ClientsListScreen: () => <div data-testid="clients-list-screen">Clients list</div>,
}))

vi.mock('./features/groups/GroupManagement', () => ({
  GroupCreateScreen: () => <div data-testid="group-create-screen">New group</div>,
  GroupEditScreen: () => <div data-testid="group-edit-screen">Group edit</div>,
  GroupsListScreen: () => <div data-testid="groups-list-screen">Groups list</div>,
}))

vi.mock('./features/users/UserManagement', () => ({
  UserCreateScreen: ({ onCancel }: { onCancel: () => void }) => (
    <div data-testid="user-create-screen">
      New user
      <button type="button" onClick={onCancel}>Назад к тренерам</button>
    </div>
  ),
  UserEditScreen: ({
    onBack,
    onRefreshSession,
  }: {
    onBack: () => void
    onRefreshSession: () => Promise<unknown>
  }) => (
    <div data-testid="user-edit-screen">
      Edit user
      <button type="button" onClick={onBack}>Назад к тренерам</button>
      <button type="button" onClick={() => void onRefreshSession()}>
        Обновить сессию
      </button>
    </div>
  ),
  UsersListScreen: ({
    onCreate,
    onEdit,
    onQueryChange,
    query,
  }: {
    onCreate: () => void
    onEdit: (userId: string) => void
    onQueryChange: (query: string) => void
    query: string
  }) => (
    <div data-testid="users-list-screen">
      <label>
        Найти тренера
        <input
          aria-label="Найти тренера"
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          value={query}
        />
      </label>
      <button type="button" onClick={onCreate}>Создать тренера</button>
      <button type="button" onClick={() => onEdit('trainer-1')}>Изменить тренера</button>
    </div>
  ),
}))

vi.mock('./features/audit/AuditLogScreen', () => ({
  AuditLogScreen: () => <div data-testid="audit-screen">Audit</div>,
}))

vi.mock('./features/finance/FinanceReportsScreen', () => ({
  FinanceReportsScreen: () => <div data-testid="finance-screen">Finance</div>,
}))

vi.mock('./features/settings/SettingsScreen', () => ({
  SettingsScreen: () => <div data-testid="settings-screen">Settings</div>,
}))

vi.mock('./features/home/HomeDashboard', () => ({
  HomeDashboard: () => <div data-testid="home-screen">Главная</div>,
}))

vi.mock('./features/attendance/AttendanceScreen', () => ({
  AttendanceScreen: () => <div data-testid="attendance-screen">Посещения</div>,
}))

const baseSession: AuthenticatedUser = {
  attendanceScope: { kind: 'Global', groupIds: [] },
  allowedSections: ['Home', 'Schedule', 'Clients', 'Groups', 'Users', 'Audit', 'Finance', 'Settings'],
  assignedGroupIds: [],
  branchId: null,
  id: 'headcoach-id',
  isActive: true,
  landingScreen: 'Home',
  login: 'headcoach',
  mustChangePassword: false,
  fullName: 'Главный тренер',
  permissions: {
    canManageClients: true,
    canManageGroups: true,
    canManageSettings: true,
    canMarkAttendance: true,
    canViewAuditLog: true,
    canViewFinancialReports: true,
    canManageUsers: true,
  },
  role: 'HeadCoach',
}

const clientRestrictedSession: AuthenticatedUser = {
  ...baseSession,
  permissions: {
    ...baseSession.permissions,
    canManageClients: false,
  },
  allowedSections: ['Home', 'Clients', 'Schedule'],
  role: 'Coach',
}

const financeRestrictedSession: AuthenticatedUser = {
  ...baseSession,
  role: 'SuperAdministrator',
  permissions: {
    ...baseSession.permissions,
    canViewFinancialReports: false,
  },
  allowedSections: ['Home', 'Schedule', 'Clients', 'Groups'],
}

const APP_CONFIG: AppConfigResponse = {
  authBackgroundImageId: 'k4pro-login-v1',
  clubName: 'Gym CRM',
  themeId: 'default-green-v1',
}

const AUTH_BACKGROUND = {
  asset: null,
  focalPoint: { xPercent: 64, yPercent: 50 },
  profileId: 'default',
}

const loadSessionMock = vi.mocked(loadSession)
const changePasswordMock = vi.mocked(changePassword)
const showAppNotificationMock = vi.mocked(showAppNotification)
const showPoliteStatusNotificationMock = vi.mocked(showPoliteStatusNotification)

function renderAppAt(path: string, user: AuthenticatedUser) {
  window.history.replaceState({}, '', path)
  loadSessionMock.mockReset()
  loadSessionMock.mockResolvedValue({
    bootstrapMode: false,
    csrfToken: 'csrf-token',
    isAuthenticated: true,
    user,
  })

  return renderApp()
}

function renderApp() {
  return render(
    <MantineProvider>
      <App appConfig={APP_CONFIG} authBackground={AUTH_BACKGROUND} />
    </MantineProvider>,
  )
}

function mockSession(user: AuthenticatedUser) {
  return {
    bootstrapMode: false,
    csrfToken: `${user.id}-csrf-token`,
    isAuthenticated: true,
    user,
  }
}

async function openUtilityPasswordScreen() {
  fireEvent.click(
    screen.getByRole('button', {
      name: /Открыть профильное меню пользователя/i,
    }),
  )
  fireEvent.click(await screen.findByRole('menuitem', { name: 'Смена пароля' }))
  return screen.findByRole('button', { name: 'Сохранить новый пароль' })
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  window.scrollTo = vi.fn()
})

afterEach(() => {
  vi.useRealTimers()
  loadSessionMock.mockReset()
  changePasswordMock.mockReset()
  showAppNotificationMock.mockReset()
  showPoliteStatusNotificationMock.mockReset()
})

describe('App route access contract', () => {
  test('keeps trainer query through create/edit returns and resets outside Users workflow', async () => {
    renderAppAt('/users', baseSession)

    const search = await screen.findByRole('textbox', { name: 'Найти тренера' })
    fireEvent.change(search, { target: { value: 'Анна' } })

    fireEvent.click(screen.getByRole('button', { name: 'Изменить тренера' }))
    await waitFor(() => expect(window.location.pathname).toBe('/users/trainer-1/edit'))
    fireEvent.click(screen.getByRole('button', { name: 'Назад к тренерам' }))

    await waitFor(() => expect(window.location.pathname).toBe('/users'))
    expect(screen.getByRole('textbox', { name: 'Найти тренера' })).toHaveValue('Анна')

    fireEvent.click(screen.getByRole('button', { name: 'Создать тренера' }))
    await waitFor(() => expect(window.location.pathname).toBe('/users/new'))
    fireEvent.click(screen.getByRole('button', { name: 'Назад к тренерам' }))
    expect(screen.getByRole('textbox', { name: 'Найти тренера' })).toHaveValue('Анна')

    fireEvent.click(screen.getAllByRole('button', { name: 'Клиенты' })[0])
    expect(await screen.findByTestId('clients-list-screen')).toBeVisible()
    fireEvent.click(screen.getAllByRole('button', { name: 'Тренеры' })[0])

    expect(await screen.findByRole('textbox', { name: 'Найти тренера' })).toHaveValue('')
  })

  test('renders an allowed section without access-denial shell', async () => {
    renderAppAt('/clients', baseSession)

    expect(await screen.findByTestId('clients-list-screen')).toBeVisible()
    expect(screen.queryByRole('heading', { level: 1, name: 'Нет доступа' })).not.toBeInTheDocument()
    expect(screen.queryByText(/стартовый раздел:/i)).not.toBeInTheDocument()
    expect(document.querySelector('.app-shell__brand-meta')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', {
      name: /Открыть профильное меню пользователя Главный тренер/i,
    }))
    expect(await screen.findByRole('menu')).toHaveTextContent('Главный тренер')
    expect(document.title).toBe('Клиенты • Gym CRM')
  })

  test('renders direct denied client create as restricted inline state', async () => {
    renderAppAt('/clients/new', clientRestrictedSession)

    const restrictedHeading = await screen.findByRole('heading', { level: 1, name: 'Нет доступа' })
    const recoveryButton = screen.getByRole('button', { name: 'Открыть Клиенты' })

    expect(restrictedHeading).toBeVisible()
    expect(recoveryButton).toBeVisible()
    expect(await screen.findByText('У вас нет доступа к операции «Новый клиент».')).toBeVisible()
    expect(document.title).toBe('Новый клиент — нет доступа • Gym CRM')
    expect(screen.getAllByRole('heading', { hidden: true, level: 1, name: 'Нет доступа' })).toHaveLength(1)
    await waitFor(() => expect(restrictedHeading).toHaveFocus())
  })

  test('renders direct denied /finance as restricted inline state', async () => {
    renderAppAt('/finance', financeRestrictedSession)

    const restrictedHeading = await screen.findByRole('heading', { level: 1, name: 'Нет доступа' })

    expect(restrictedHeading).toBeVisible()
    expect(screen.getByRole('button', { name: 'Открыть Главная' })).toBeVisible()
    expect(await screen.findByText('У вас нет доступа к разделу «Финансы».')).toBeVisible()
    expect(document.title).toBe('Финансы — нет доступа • Gym CRM')
  })

  test('renders unknown /attendance as not-found state with safe copy', async () => {
    renderAppAt('/attendance', baseSession)

    expect(await screen.findByRole('heading', { level: 1, name: 'Страница не найдена' })).toBeVisible()
    expect(screen.getByText('Такой страницы нет или ссылка устарела.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Открыть Главная' })).toBeVisible()
    expect(screen.queryByText(/attendance/i)).not.toBeInTheDocument()
    expect(document.title).toBe('Страница не найдена • Gym CRM')
  })

  test('renders malformed encoded unknown path without exposing the raw value', async () => {
    renderAppAt('/%E0%AE', baseSession)

    expect(await screen.findByRole('heading', {
      level: 1,
      name: 'Страница не найдена',
    })).toBeVisible()
    expect(screen.getByText('Такой страницы нет или ссылка устарела.')).toBeVisible()
    expect(document.body).not.toHaveTextContent('%E0%AE')
  })

  test('keeps session loading as loader before route outcome resolves', () => {
    window.history.replaceState({}, '', '/groups')
    loadSessionMock.mockReset()
    loadSessionMock.mockReturnValue(new Promise(() => {}))

    renderApp()

    expect(screen.getByText('Открываем Gym CRM')).toBeVisible()
    expect(screen.queryByRole('heading', { level: 1, name: 'Нет доступа' })).not.toBeInTheDocument()
  })

  test('auto-recovers once after same-user session refresh revokes current allowed route', async () => {
    renderAppAt('/users/trainer-1/edit', baseSession)

    expect(await screen.findByTestId('user-edit-screen')).toBeVisible()

    loadSessionMock.mockResolvedValueOnce(
      mockSession({
        ...baseSession,
        permissions: {
          ...baseSession.permissions,
          canManageUsers: false,
        },
        allowedSections: ['Home', 'Schedule', 'Clients'],
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Обновить сессию' }))

    await waitFor(() => expect(window.location.pathname).toBe('/'))
    expect(screen.queryByRole('heading', { level: 1, name: 'Нет доступа' })).not.toBeInTheDocument()
    expect(showPoliteStatusNotificationMock).toHaveBeenCalledTimes(1)
    expect(showPoliteStatusNotificationMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Открыт доступный раздел «Главная»'),
      title: 'Открыт доступный раздел',
    }))

    await waitFor(() => expect(showPoliteStatusNotificationMock).toHaveBeenCalledTimes(1))
  })

  test('does not auto-recover when a different user loses access at the same path', async () => {
    renderAppAt('/users/trainer-1/edit', baseSession)

    expect(await screen.findByTestId('user-edit-screen')).toBeVisible()
    loadSessionMock.mockResolvedValueOnce(
      mockSession({
        ...clientRestrictedSession,
        id: 'coach-2',
        allowedSections: ['Home', 'Schedule', 'Clients'],
        permissions: {
          ...clientRestrictedSession.permissions,
          canManageUsers: false,
        },
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Обновить сессию' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Нет доступа' })).toBeVisible()
    expect(window.location.pathname).toBe('/users/trainer-1/edit')
    expect(showPoliteStatusNotificationMock).not.toHaveBeenCalled()
  })

  test('back-forward to a restricted path renders inline state without replaying recovery', async () => {
    renderAppAt('/clients', clientRestrictedSession)

    expect(await screen.findByTestId('clients-list-screen')).toBeVisible()

    window.history.pushState({}, '', '/clients/new')
    window.dispatchEvent(new PopStateEvent('popstate'))

    expect(await screen.findByRole('heading', { level: 1, name: 'Нет доступа' })).toBeVisible()
    expect(window.location.pathname).toBe('/clients/new')
    expect(showPoliteStatusNotificationMock).not.toHaveBeenCalled()
  })

  test('renders utility password route from direct path and keeps direct return target', async () => {
    renderAppAt('/password', baseSession)

    const saveButton = await screen.findByRole('button', { name: 'Сохранить новый пароль' })
    const backButton = screen.getByRole('button', { name: 'Назад' })

    expect(saveButton).toBeVisible()
    expect(backButton).toBeVisible()

    fireEvent.click(backButton)
    await waitFor(() => expect(window.location.pathname).toBe('/'))
  })

  test('returns from utility password to the saved allowed path', async () => {
    renderAppAt('/clients', baseSession)

    expect(await screen.findByTestId('clients-list-screen')).toBeVisible()

    await openUtilityPasswordScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Назад' }))

    await waitFor(() => expect(window.location.pathname).toBe('/clients'))
    expect(await screen.findByTestId('clients-list-screen')).toBeVisible()
    expect(showPoliteStatusNotificationMock).not.toHaveBeenCalled()
  })

  test('returns from utility password to the saved restricted path as inline state', async () => {
    renderAppAt('/clients/new', clientRestrictedSession)

    expect(await screen.findByRole('heading', { level: 1, name: 'Нет доступа' })).toBeVisible()

    await openUtilityPasswordScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Назад' }))

    await waitFor(() => expect(window.location.pathname).toBe('/clients/new'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Нет доступа' })).toBeVisible()
    expect(showPoliteStatusNotificationMock).not.toHaveBeenCalled()
  })

  test('returns from utility password to the saved not-found path as inline state', async () => {
    renderAppAt('/missing-page', baseSession)

    expect(await screen.findByRole('heading', {
      level: 1,
      name: 'Страница не найдена',
    })).toBeVisible()

    await openUtilityPasswordScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Назад' }))

    await waitFor(() => expect(window.location.pathname).toBe('/missing-page'))
    expect(await screen.findByRole('heading', {
      level: 1,
      name: 'Страница не найдена',
    })).toBeVisible()
    expect(showPoliteStatusNotificationMock).not.toHaveBeenCalled()
  })

  test('combines password success with recovery when the saved allowed route is newly restricted', async () => {
    renderAppAt('/users/trainer-1/edit', baseSession)

    expect(await screen.findByTestId('user-edit-screen')).toBeVisible()
    await openUtilityPasswordScreen()

    changePasswordMock.mockResolvedValueOnce(
      mockSession({
        ...baseSession,
        permissions: {
          ...baseSession.permissions,
          canManageUsers: false,
        },
        allowedSections: ['Home', 'Schedule', 'Clients'],
      }),
    )

    fireEvent.change(screen.getByLabelText('Текущий пароль'), {
      target: { value: 'old-password' },
    })
    fireEvent.change(screen.getByLabelText('Новый пароль'), {
      target: { value: 'new-password' },
    })
    fireEvent.change(screen.getByLabelText('Повторите новый пароль'), {
      target: { value: 'new-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить новый пароль' }))

    await waitFor(() => expect(window.location.pathname).toBe('/'))
    expect(showAppNotificationMock).not.toHaveBeenCalledWith(expect.objectContaining({
      id: 'auth-password-utility',
    }))
    expect(showPoliteStatusNotificationMock).toHaveBeenCalledTimes(1)
    expect(showPoliteStatusNotificationMock).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Пароль обновлен.'),
      title: 'Пароль обновлен, открыт доступный раздел',
    }))
  })
})
