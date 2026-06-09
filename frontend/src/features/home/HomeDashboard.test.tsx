import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  getAttendanceGroupClients,
  getAttendanceGroups,
  getExpiringClientMemberships,
  type AuthenticatedUser,
  type ExpiringClientMembership,
} from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import { HomeDashboard } from './HomeDashboard'

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>()

  return {
    ...actual,
    getAttendanceGroupClients: vi.fn(),
    getAttendanceGroups: vi.fn(),
    getExpiringClientMemberships: vi.fn(),
  }
})

const user: AuthenticatedUser = {
  id: 'headcoach-id',
  fullName: 'Главный тренер',
  login: 'headcoach',
  role: 'HeadCoach',
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
    canViewFinancialReports: true,
  },
  assignedGroupIds: ['group-1'],
}

const coachUser: AuthenticatedUser = {
  ...user,
  id: 'coach-id',
  role: 'Coach',
  allowedSections: ['Home', 'Clients'],
  permissions: {
    ...user.permissions,
    canManageUsers: false,
    canManageClients: false,
    canManageGroups: false,
    canManageSettings: false,
    canViewAuditLog: false,
    canViewFinancialReports: false,
  },
}

const getAttendanceGroupClientsMock = vi.mocked(getAttendanceGroupClients)
const getAttendanceGroupsMock = vi.mocked(getAttendanceGroups)
const getExpiringMock = vi.mocked(getExpiringClientMemberships)

beforeEach(() => {
  getAttendanceGroupClientsMock.mockReset()
  getAttendanceGroupsMock.mockReset()
  getExpiringMock.mockReset()
  getAttendanceGroupsMock.mockResolvedValue([])
})

describe('HomeDashboard', () => {
  test('shows empty state when there are no expiring memberships', async () => {
    getExpiringMock.mockResolvedValueOnce([])

    renderWithProviders(<HomeDashboard user={user} />)

    expect(
      await screen.findByRole('heading', { name: 'Истекающие абонементы' }),
    ).toBeVisible()
    expect(await screen.findByText('Истекающих абонементов сейчас нет.')).toBeVisible()
    expect(screen.getByText('Все абонементы активны.')).toBeVisible()
  })

  test('shows sorted expiring membership list when data exists', async () => {
    getExpiringMock.mockResolvedValueOnce([
      buildMembership({
        clientId: 'client-2',
        fullName: 'Ольга Смирнова',
        daysUntilExpiration: 5,
        isPaid: false,
      }),
      buildMembership({
        clientId: 'client-1',
        fullName: 'Иван Иванов',
        daysUntilExpiration: 3,
        isPaid: true,
      }),
    ])

    renderWithProviders(<HomeDashboard onOpenClient={() => undefined} user={user} />)

    const list = await screen.findByTestId('home-expiring-memberships-list')

    expect(list).toHaveTextContent('Иван Иванов')
    expect(list).toHaveTextContent('Ольга Смирнова')
    expect(list.textContent?.indexOf('Иван Иванов')).toBeLessThan(
      list.textContent?.indexOf('Ольга Смирнова') ?? Number.POSITIVE_INFINITY,
    )
    expect(screen.getByText('Оплачен')).toBeVisible()
    expect(screen.getByText('Не оплачен')).toBeVisible()
  })

  test('shows loading state and disables refresh while loading', () => {
    getExpiringMock.mockReturnValueOnce(new Promise(() => undefined))

    renderWithProviders(<HomeDashboard user={user} />)

    expect(screen.getByText('Загружаем истекающие абонементы...')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeDisabled()
  })

  test('shows error state and retries loading', async () => {
    getExpiringMock
      .mockRejectedValueOnce(new Error('CRM API временно недоступен'))
      .mockResolvedValueOnce([])

    renderWithProviders(<HomeDashboard user={user} />)

    expect(await screen.findByText('Список не загрузился')).toBeVisible()
    expect(screen.getByText('CRM API временно недоступен')).toBeVisible()
    expect(await screen.findByRole('heading', { name: 'Посещения' })).toBeVisible()
    expect(await screen.findByText('Доступные группы пока отсутствуют')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(await screen.findByText('Все абонементы активны.')).toBeVisible()
    expect(getExpiringMock).toHaveBeenCalledTimes(2)
  })

  test('keeps refresh action disabled only during refresh request', async () => {
    const refreshDeferred = createDeferred<ExpiringClientMembership[]>()

    getExpiringMock
      .mockResolvedValueOnce([buildMembership()])
      .mockReturnValueOnce(refreshDeferred.promise)

    renderWithProviders(<HomeDashboard user={user} />)

    const refreshButton = await screen.findByRole('button', { name: 'Обновить' })
    expect(refreshButton).toBeEnabled()

    fireEvent.click(refreshButton)

    expect(refreshButton).toBeDisabled()

    refreshDeferred.resolve([buildMembership({ fullName: 'Анна Петрова' })])

    await waitFor(() => expect(refreshButton).toBeEnabled())
    expect(screen.getByText('Анна Петрова')).toBeVisible()
  })

  test('keeps expiring memberships visible when attendance groups fail', async () => {
    getExpiringMock.mockResolvedValueOnce([])
    getAttendanceGroupsMock.mockRejectedValueOnce(
      new Error('Группы посещений недоступны'),
    )

    renderWithProviders(<HomeDashboard user={user} />)

    expect(await screen.findByText('Все абонементы активны.')).toBeVisible()
    expect(await screen.findByText('Группы для посещений не загрузились')).toBeVisible()
    expect(screen.getByText('Группы посещений недоступны')).toBeVisible()
  })

  test('shows attendance only for coach with attendance permission', async () => {
    renderWithProviders(<HomeDashboard user={coachUser} />)

    expect(screen.getByTestId('home-screen')).toBeVisible()
    expect(await screen.findByRole('heading', { name: 'Посещения' })).toBeVisible()
    expect(await screen.findByText('Назначенные группы отсутствуют')).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Истекающие абонементы' }),
    ).not.toBeInTheDocument()
    expect(getExpiringMock).not.toHaveBeenCalled()
    expect(getAttendanceGroupsMock).toHaveBeenCalledTimes(1)
  })

  test('shows access denied when no home section is available', () => {
    renderWithProviders(
      <HomeDashboard
        user={{
          ...coachUser,
          permissions: {
            ...coachUser.permissions,
            canMarkAttendance: false,
          },
        }}
      />,
    )

    expect(screen.getByText('Главная страница недоступна')).toBeVisible()
    expect(getExpiringMock).not.toHaveBeenCalled()
    expect(getAttendanceGroupsMock).not.toHaveBeenCalled()
  })
})

function buildMembership(
  overrides: Partial<ExpiringClientMembership> = {},
): ExpiringClientMembership {
  return {
    clientId: 'client-1',
    fullName: 'Иван Иванов',
    membershipType: 'Monthly',
    expirationDate: '2026-05-06',
    daysUntilExpiration: 3,
    isPaid: true,
    ...overrides,
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, reject, resolve }
}
