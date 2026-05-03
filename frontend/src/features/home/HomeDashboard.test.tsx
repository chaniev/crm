import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
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
  allowedSections: ['Home', 'Attendance', 'Clients', 'Groups', 'Users', 'Audit'],
  permissions: {
    canManageUsers: true,
    canManageClients: true,
    canManageGroups: true,
    canMarkAttendance: true,
    canViewAuditLog: true,
  },
  assignedGroupIds: ['group-1'],
}

const coachUser: AuthenticatedUser = {
  ...user,
  id: 'coach-id',
  role: 'Coach',
  permissions: {
    ...user.permissions,
    canManageUsers: false,
    canManageClients: false,
    canManageGroups: false,
    canViewAuditLog: false,
  },
}

const getExpiringMock = vi.mocked(getExpiringClientMemberships)

beforeEach(() => {
  getExpiringMock.mockReset()
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

  test('shows access denied for roles outside home audience', () => {
    renderWithProviders(<HomeDashboard user={coachUser} />)

    expect(screen.getByText('Главная страница недоступна')).toBeVisible()
    expect(getExpiringMock).not.toHaveBeenCalled()
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
