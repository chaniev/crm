import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  getAttendanceGroupClients,
  getAttendanceGroups,
  getClientAttentionItems,
  markMissedTrainingContacted,
  saveAttendanceMarks,
  type AuthenticatedUser,
  type ClientAttentionItem,
} from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import { HomeDashboard } from './HomeDashboard'

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>()

  return {
    ...actual,
    getAttendanceGroupClients: vi.fn(),
    getAttendanceGroups: vi.fn(),
    getClientAttentionItems: vi.fn(),
    markMissedTrainingContacted: vi.fn(),
    saveAttendanceMarks: vi.fn(),
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
  branchId: null,
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
const getAttentionMock = vi.mocked(getClientAttentionItems)
const contactedMock = vi.mocked(markMissedTrainingContacted)
const saveAttendanceMarksMock = vi.mocked(saveAttendanceMarks)

beforeEach(() => {
  getAttendanceGroupClientsMock.mockReset()
  getAttendanceGroupsMock.mockReset()
  getAttentionMock.mockReset()
  contactedMock.mockReset()
  saveAttendanceMarksMock.mockReset()
  getAttendanceGroupsMock.mockResolvedValue({
    groups: [],
    today: '2026-07-12',
    maxTrainingDate: '2026-07-12',
  })
})

describe('HomeDashboard', () => {
  test('shows status-free reasons and contacts, then keeps membership expiration after contacted', async () => {
    const attention = {
      clientId: 'client-1', fullName: 'Иван Иванов', phone: '+79990000000', notes: 'Позвонить вечером', telegramLink: 'https://t.me/ivan',
      membership: { behaviorKind: 'Term', membershipName: 'Месяц', expirationDate: '2026-07-20', daysUntilExpiration: 0 },
      reasons: [{ type: 'missedTraining', missedCount: 4 }, { type: 'expiringMembership', expirationDate: '2026-07-20', daysUntilExpiration: 0 }],
    } as unknown as ClientAttentionItem
    getAttentionMock.mockResolvedValueOnce([attention])
    contactedMock.mockResolvedValueOnce({ ...attention, reasons: [{ type: 'expiringMembership', expirationDate: '2026-07-20', daysUntilExpiration: 0 }] })
    renderWithProviders(<HomeDashboard user={user} />)
    fireEvent.click(screen.getByRole('tab', { name: /Требуют внимания/ }))

    expect(await screen.findByText('Пропущено подряд: 4')).toBeVisible()
    expect(screen.getByText('Истекает сегодня')).toBeVisible()
    expect(screen.queryByText('Требует оплаты')).not.toBeInTheDocument()
    expect(screen.queryByText(/не оплачен/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Telegram/ })).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link', { name: /Telegram/ })).toHaveAttribute('rel', 'noopener noreferrer')
    fireEvent.click(screen.getByRole('button', { name: 'Связались с Иван Иванов' }))
    await waitFor(() => expect(screen.queryByText('Пропущено подряд: 4')).not.toBeInTheDocument())
    expect(screen.getByText('Истекает сегодня')).toBeVisible()
    expect(screen.getByLabelText('1 клиентов требуют внимания')).toBeVisible()
  })

  test('keeps missed reason after action error and allows retry that removes the card', async () => {
    const attention: ClientAttentionItem = { clientId: 'client-1', fullName: 'Иван Иванов', phone: null, notes: null, membership: null, telegramLink: null, reasons: [{ type: 'missedTraining', missedCount: 3 }] }
    getAttentionMock.mockResolvedValueOnce([attention])
    contactedMock.mockRejectedValueOnce(new Error('Сеть недоступна')).mockResolvedValueOnce(null)
    renderWithProviders(<HomeDashboard user={user} />)
    fireEvent.click(screen.getByRole('tab', { name: /Требуют внимания/ }))
    const action = await screen.findByRole('button', { name: 'Связались с Иван Иванов' })
    fireEvent.click(action)
    expect(await screen.findByText(/Сеть недоступна/)).toBeVisible()
    expect(screen.getByText('Пропущено подряд: 3')).toBeVisible()
    fireEvent.click(action)
    expect(await screen.findByText('Никому не требуется внимание')).toBeVisible()
  })

  test('defaults to attendance, hides page heading and keeps both tab workspaces mounted', async () => {
    getAttentionMock.mockResolvedValueOnce([buildMembership(), buildMembership({ clientId: 'client-2' })])
    getAttendanceGroupsMock.mockResolvedValueOnce({
      groups: [{ id: 'group-1', name: 'Вечерняя' }],
      today: '2026-07-12',
      maxTrainingDate: '2026-07-12',
    })
    getAttendanceGroupClientsMock.mockResolvedValueOnce({
      groupId: 'group-1',
      trainingDate: '2026-07-12',
      today: '2026-07-12',
      maxTrainingDate: '2026-07-12',
      clients: [],
    })

    renderWithProviders(<HomeDashboard user={user} />)

    expect(screen.queryByRole('heading', { name: 'Главная' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Посещения' })).toHaveAttribute('aria-selected', 'true')
    await waitFor(() => expect(getAttendanceGroupClientsMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByLabelText('2 клиентов требуют внимания')).toBeVisible())

    fireEvent.click(screen.getByRole('tab', { name: /Требуют внимания/ }))
    fireEvent.click(screen.getByRole('tab', { name: 'Посещения' }))

    expect(getAttendanceGroupsMock).toHaveBeenCalledTimes(1)
    expect(getAttendanceGroupClientsMock).toHaveBeenCalledTimes(1)
  })

  test('supports tab keyboard navigation', () => {
    getAttentionMock.mockResolvedValue([])
    renderWithProviders(<HomeDashboard user={user} />)
    const attendanceTab = screen.getByRole('tab', { name: 'Посещения' })
    const membershipsTab = screen.getByRole('tab', { name: /Требуют внимания/ })

    fireEvent.keyDown(attendanceTab, { key: 'ArrowRight' })
    expect(membershipsTab).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(membershipsTab, { key: 'Home' })
    expect(attendanceTab).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(attendanceTab, { key: 'End' })
    expect(membershipsTab).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(membershipsTab, { key: 'ArrowLeft' })
    expect(attendanceTab).toHaveAttribute('aria-selected', 'true')
  })

  test('preserves attendance context, progress and local state across tabs', async () => {
    getAttentionMock.mockResolvedValue([])
    getAttendanceGroupsMock.mockResolvedValueOnce({
      groups: [{ id: 'group-1', name: 'Вечерняя' }],
      today: '2026-07-12',
      maxTrainingDate: '2026-07-12',
    })
    getAttendanceGroupClientsMock.mockResolvedValue({
      groupId: 'group-1', trainingDate: '2026-07-12', today: '2026-07-12', maxTrainingDate: '2026-07-12',
      clients: [{
        id: 'client-1', fullName: 'Иван Иванов', state: 'Unmarked', groups: [], photo: null,
        isProfessional: false, professionalComment: null, hasActiveMembership: true, membershipWarning: false, currentMembership: null,
      }],
    })
    saveAttendanceMarksMock.mockResolvedValue({
      groupId: 'group-1', trainingDate: '2026-07-12', today: '2026-07-12', maxTrainingDate: '2026-07-12',
      attendanceMarks: [{ clientId: 'client-1', state: 'Present' }],
    })
    renderWithProviders(<HomeDashboard user={user} />)

    await screen.findByLabelText('Посещение: Иван Иванов')
    fireEvent.click(screen.getByText('Был'))
    await screen.findByText('Все клиенты отмечены')
    fireEvent.click(screen.getByRole('button', { name: 'Показать всех' }))
    await screen.findByText('Сохранено')
    const rosterCalls = getAttendanceGroupClientsMock.mock.calls.length
    fireEvent.click(screen.getByRole('tab', { name: /Требуют внимания/ }))
    fireEvent.click(screen.getByRole('tab', { name: 'Посещения' }))

    expect(screen.getByTestId('attendance-group-select')).toHaveValue('Вечерняя')
    expect(screen.getByLabelText('Дата тренировки')).toHaveValue('2026-07-12')
    expect(screen.getByRole('radio', { name: 'Был' })).toBeChecked()
    expect(screen.getByText('Отмечено 1 из 1')).toBeVisible()
    expect(getAttendanceGroupClientsMock).toHaveBeenCalledTimes(rosterCalls)
  })

  test('retains last successful membership data, count and check time after refresh failure', async () => {
    getAttentionMock
      .mockResolvedValueOnce([buildMembership({ fullName: 'Сохраненный клиент' })])
      .mockRejectedValueOnce(new Error('Обновление недоступно'))
    renderWithProviders(<HomeDashboard user={user} />)
    fireEvent.click(screen.getByRole('tab', { name: /Требуют внимания/ }))

    expect(await screen.findByText('Сохраненный клиент')).toBeVisible()
    expect(screen.getByTestId('memberships-last-check')).toBeVisible()
    expect(screen.getByLabelText('1 клиентов требуют внимания')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }))

    expect(await screen.findByText('Обновление недоступно')).toBeVisible()
    expect(screen.getByText('Сохраненный клиент')).toBeVisible()
    expect(screen.getByTestId('memberships-last-check')).toBeVisible()
    expect(screen.getByLabelText('1 клиентов требуют внимания')).toBeVisible()
  })

  test('renders memberships directly without a false tablist when it is the only permitted area', async () => {
    getAttentionMock.mockResolvedValueOnce([])
    renderWithProviders(<HomeDashboard user={{ ...user, permissions: { ...user.permissions, canMarkAttendance: false } }} />)

    expect(await screen.findByText('Никому не требуется внимание')).toBeVisible()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(getAttendanceGroupsMock).not.toHaveBeenCalled()
  })

  test('shows empty state when no memberships require attention', async () => {
    getAttentionMock.mockResolvedValueOnce([])

    renderWithProviders(<HomeDashboard user={user} />)

    fireEvent.click(screen.getByRole('tab', { name: /Требуют внимания/ }))

    expect(
      await screen.findByRole('heading', {
        name: 'Клиенты, требующие внимания',
      }),
    ).toBeVisible()
    expect(await screen.findByText('Никому не требуется внимание')).toBeVisible()
    expect(
      screen.getByText('Нет клиентов с повторными пропусками или вопросами по абонементам.'),
    ).toBeVisible()
  })

  test('shows membership attention states and preserves backend order', async () => {
    getAttentionMock.mockResolvedValueOnce([
      buildMembership({
        clientId: 'client-expiring',
        fullName: 'Иван Иванов',
        daysUntilExpiration: 2,
        state: 'ExpiringSoon',
      }),
      buildMembership({
        clientId: 'client-expired',
        fullName: 'Анна Петрова',
        expirationDate: '2026-05-03',
        daysUntilExpiration: -3,
        state: 'Expired',
      }),
    ])

    renderWithProviders(<HomeDashboard onOpenClient={() => undefined} user={user} />)

    fireEvent.click(screen.getByRole('tab', { name: /Требуют внимания/ }))

    const list = await screen.findByTestId('home-attention-list')

    expect(list).toHaveTextContent('Иван Иванов')
    expect(list).toHaveTextContent('Анна Петрова')
    expect(list.textContent?.indexOf('Иван Иванов')).toBeLessThan(
      list.textContent?.indexOf('Анна Петрова') ?? Number.POSITIVE_INFINITY,
    )
    expect(screen.queryByText('Требует оплаты')).not.toBeInTheDocument()
    expect(screen.queryByText('Ожидается оплата')).not.toBeInTheDocument()
    expect(screen.getByText('Скоро истечет')).toBeVisible()
    expect(screen.getByText('Осталось 2 дня')).toBeVisible()
    expect(screen.getByText('Истек')).toBeVisible()
    expect(screen.getByText('Истек 3 дня назад')).toBeVisible()
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

    fireEvent.click(screen.getByRole('tab', { name: /Требуют внимания/ }))

    expect(await screen.findByText('Нет данных')).toBeVisible()
  })

  test('shows loading state and disables refresh while loading', () => {
    getAttentionMock.mockReturnValueOnce(new Promise(() => undefined))

    renderWithProviders(<HomeDashboard user={user} />)

    fireEvent.click(screen.getByRole('tab', { name: /Требуют внимания/ }))

    expect(screen.getByText('Загружаем клиентов...')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeDisabled()
  })

  test('shows error state and retries loading', async () => {
    getAttentionMock
      .mockRejectedValueOnce(new Error('CRM API временно недоступен'))
      .mockResolvedValueOnce([])

    renderWithProviders(<HomeDashboard user={user} />)

    fireEvent.click(screen.getByRole('tab', { name: /Требуют внимания/ }))

    expect(await screen.findByText('Список не загрузился')).toBeVisible()
    expect(screen.getByText('CRM API временно недоступен')).toBeVisible()
    fireEvent.click(screen.getByRole('tab', { name: 'Посещения' }))
    expect(await screen.findByText('Доступные группы пока отсутствуют')).toBeVisible()
    fireEvent.click(screen.getByRole('tab', { name: /Требуют внимания/ }))

    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(await screen.findByText('Никому не требуется внимание')).toBeVisible()
    expect(getAttentionMock).toHaveBeenCalledTimes(2)
  })

  test('keeps refresh action disabled only during refresh request', async () => {
    const refreshDeferred = createDeferred<ClientAttentionItem[]>()

    getAttentionMock
      .mockResolvedValueOnce([buildMembership()])
      .mockReturnValueOnce(refreshDeferred.promise)

    renderWithProviders(<HomeDashboard user={user} />)

    fireEvent.click(screen.getByRole('tab', { name: /Требуют внимания/ }))

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

    fireEvent.click(screen.getByRole('tab', { name: /Требуют внимания/ }))

    expect(await screen.findByText('Никому не требуется внимание')).toBeVisible()
    fireEvent.click(screen.getByRole('tab', { name: 'Посещения' }))
    expect(await screen.findByText('Группы для посещений не загрузились')).toBeVisible()
    expect(screen.getByText('Группы посещений недоступны')).toBeVisible()
  })

  test('shows attendance only for coach with attendance permission', async () => {
    renderWithProviders(<HomeDashboard user={coachUser} />)

    expect(screen.getByTestId('home-screen')).toBeVisible()
    expect(await screen.findByText('Назначенные группы отсутствуют')).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Клиенты, требующие внимания' }),
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
  overrides: Partial<{ clientId: string; fullName: string; behaviorKind: 'SingleVisit' | 'Term' | 'Professional'; expirationDate: string | null; daysUntilExpiration: number | null; state: 'Expired' | 'ExpiringSoon' | 'Unknown' }> = {},
): ClientAttentionItem {
  const state = overrides.state ?? 'ExpiringSoon'
  const reasons: ClientAttentionItem['reasons'] = state === 'Unknown'
    ? []
    : [{ type: state === 'Expired' ? 'expiredMembership' : 'expiringMembership', expirationDate: overrides.expirationDate ?? '2026-05-06', daysUntilExpiration: overrides.daysUntilExpiration ?? 3 }]
  return {
    clientId: 'client-1',
    fullName: 'Иван Иванов',
    phone: null, notes: null, telegramLink: null,
    membership: state === 'Unknown' ? null : { behaviorKind: overrides.behaviorKind ?? 'Term', membershipName: '', expirationDate: overrides.expirationDate ?? '2026-05-06', daysUntilExpiration: overrides.daysUntilExpiration ?? 3 } as unknown as ClientAttentionItem['membership'],
    reasons,
    ...(overrides.clientId ? { clientId: overrides.clientId } : {}),
    ...(overrides.fullName ? { fullName: overrides.fullName } : {}),
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
