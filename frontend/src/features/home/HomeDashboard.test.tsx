import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  getAttendanceGroupClients,
  getAttendanceGroups,
  getMembershipAttentionItems,
  type AuthenticatedUser,
  type MembershipAttentionItem,
} from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import { HomeDashboard } from './HomeDashboard'

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>()

  return {
    ...actual,
    getAttendanceGroupClients: vi.fn(),
    getAttendanceGroups: vi.fn(),
    getMembershipAttentionItems: vi.fn(),
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
const getAttentionMock = vi.mocked(getMembershipAttentionItems)

beforeEach(() => {
  getAttendanceGroupClientsMock.mockReset()
  getAttendanceGroupsMock.mockReset()
  getAttentionMock.mockReset()
  getAttendanceGroupsMock.mockResolvedValue([])
})

describe('HomeDashboard', () => {
  test('shows empty state when no memberships require attention', async () => {
    getAttentionMock.mockResolvedValueOnce([])

    renderWithProviders(<HomeDashboard user={user} />)

    expect(
      await screen.findByRole('heading', {
        name: 'Абонементы требуют внимания',
      }),
    ).toBeVisible()
    expect(await screen.findByText('Абонементы не требуют внимания.')).toBeVisible()
    expect(
      screen.getByText('Нет истекших, скоро истекающих или неоплаченных абонементов.'),
    ).toBeVisible()
  })

  test('shows membership attention states and preserves backend order', async () => {
    getAttentionMock.mockResolvedValueOnce([
      buildMembership({
        clientId: 'client-unpaid',
        fullName: 'Ольга Смирнова',
        daysUntilExpiration: 20,
        state: 'Unpaid',
        isPaid: false,
      }),
      buildMembership({
        clientId: 'client-expiring',
        fullName: 'Иван Иванов',
        daysUntilExpiration: 2,
        state: 'ExpiringSoon',
        isPaid: true,
      }),
      buildMembership({
        clientId: 'client-expired',
        fullName: 'Анна Петрова',
        expirationDate: '2026-05-03',
        daysUntilExpiration: -3,
        state: 'Expired',
        isPaid: false,
      }),
    ])

    renderWithProviders(<HomeDashboard onOpenClient={() => undefined} user={user} />)

    const list = await screen.findByTestId('home-expiring-memberships-list')

    expect(list).toHaveTextContent('Иван Иванов')
    expect(list).toHaveTextContent('Ольга Смирнова')
    expect(list).toHaveTextContent('Анна Петрова')
    expect(list.textContent?.indexOf('Ольга Смирнова')).toBeLessThan(
      list.textContent?.indexOf('Иван Иванов') ?? Number.POSITIVE_INFINITY,
    )
    expect(list.textContent?.indexOf('Иван Иванов')).toBeLessThan(
      list.textContent?.indexOf('Анна Петрова') ?? Number.POSITIVE_INFINITY,
    )
    expect(screen.getByText('Требует оплаты')).toBeVisible()
    expect(screen.getByText('Ожидается оплата')).toBeVisible()
    expect(screen.getByText('Скоро истечет')).toBeVisible()
    expect(screen.getByText('Осталось 2 дня')).toBeVisible()
    expect(screen.getByText('Истек')).toBeVisible()
    expect(screen.getByText('Истек 3 дня назад')).toBeVisible()
    expect(screen.getByText('Оплачен')).toBeVisible()
    expect(screen.getAllByText('Не оплачен')).toHaveLength(2)
  })

  test('shows unknown membership attention state safely', async () => {
    getAttentionMock.mockResolvedValueOnce([
      buildMembership({
        daysUntilExpiration: null,
        expirationDate: null,
        state: 'Unknown',
      }),
    ])

    renderWithProviders(<HomeDashboard user={user} />)

    expect(await screen.findAllByText('Неизвестно')).toHaveLength(2)
    expect(screen.getByText('Не указана')).toBeVisible()
  })

  test('shows loading state and disables refresh while loading', () => {
    getAttentionMock.mockReturnValueOnce(new Promise(() => undefined))

    renderWithProviders(<HomeDashboard user={user} />)

    expect(screen.getByText('Загружаем абонементы...')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeDisabled()
  })

  test('shows error state and retries loading', async () => {
    getAttentionMock
      .mockRejectedValueOnce(new Error('CRM API временно недоступен'))
      .mockResolvedValueOnce([])

    renderWithProviders(<HomeDashboard user={user} />)

    expect(await screen.findByText('Список не загрузился')).toBeVisible()
    expect(screen.getByText('CRM API временно недоступен')).toBeVisible()
    expect(await screen.findByRole('heading', { name: 'Посещения' })).toBeVisible()
    expect(await screen.findByText('Доступные группы пока отсутствуют')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(await screen.findByText('Абонементы не требуют внимания.')).toBeVisible()
    expect(getAttentionMock).toHaveBeenCalledTimes(2)
  })

  test('keeps refresh action disabled only during refresh request', async () => {
    const refreshDeferred = createDeferred<MembershipAttentionItem[]>()

    getAttentionMock
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
    getAttentionMock.mockResolvedValueOnce([])
    getAttendanceGroupsMock.mockRejectedValueOnce(
      new Error('Группы посещений недоступны'),
    )

    renderWithProviders(<HomeDashboard user={user} />)

    expect(await screen.findByText('Абонементы не требуют внимания.')).toBeVisible()
    expect(await screen.findByText('Группы для посещений не загрузились')).toBeVisible()
    expect(screen.getByText('Группы посещений недоступны')).toBeVisible()
  })

  test('shows attendance only for coach with attendance permission', async () => {
    renderWithProviders(<HomeDashboard user={coachUser} />)

    expect(screen.getByTestId('home-screen')).toBeVisible()
    expect(await screen.findByRole('heading', { name: 'Посещения' })).toBeVisible()
    expect(await screen.findByText('Назначенные группы отсутствуют')).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Абонементы требуют внимания' }),
    ).not.toBeInTheDocument()
    expect(getAttentionMock).not.toHaveBeenCalled()
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
    expect(getAttentionMock).not.toHaveBeenCalled()
    expect(getAttendanceGroupsMock).not.toHaveBeenCalled()
  })
})

function buildMembership(
  overrides: Partial<MembershipAttentionItem> = {},
): MembershipAttentionItem {
  return {
    clientId: 'client-1',
    fullName: 'Иван Иванов',
    membershipType: 'Monthly',
    expirationDate: '2026-05-06',
    daysUntilExpiration: 3,
    isPaid: true,
    state: 'ExpiringSoon',
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
