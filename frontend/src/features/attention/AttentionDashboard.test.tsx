import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  getAttendanceGroupClients,
  getAttendanceGroups,
  getClientAttentionItems,
  markMissedTrainingContacted,
  saveAttendanceMarks,
  type ClientAttentionItem,
} from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import { AttentionDashboard } from './AttentionDashboard'

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
})

describe('AttentionDashboard', () => {
  test('renders Attention as a heading-only route shell without attendance workspace', async () => {
    getAttentionMock.mockResolvedValueOnce([])

    renderWithProviders(<AttentionDashboard />)

    expect(screen.getByTestId('attention-screen')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Внимание', level: 1 })).toHaveClass(
      'visually-hidden',
    )
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Требуют внимания' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('attendance-screen')).not.toBeInTheDocument()
    expect(getAttendanceGroupsMock).not.toHaveBeenCalled()
    expect(getAttendanceGroupClientsMock).not.toHaveBeenCalled()
    expect(saveAttendanceMarksMock).not.toHaveBeenCalled()

    expect(await screen.findByText('Никому не требуется внимание')).toBeVisible()
  })

  test('loads status-free reasons and contacts, then keeps membership expiration after contacted', async () => {
    const attention = {
      clientId: 'client-1',
      fullName: 'Иван Иванов',
      phone: '+79990000000',
      notes: 'Позвонить вечером',
      telegramLink: 'https://t.me/ivan',
      membership: {
        membershipId: 'membership-1',
        saleId: 'sale-1',
        behaviorKind: 'Term',
        membershipName: 'Месяц',
        expirationDate: '2026-07-20',
        daysUntilExpiration: 0,
        targetGroups: [buildTargetGroup()],
        targetSummary: '1. Утренняя группа · отчётность',
      },
      reasons: [
        { type: 'missedTraining', missedCount: 4 },
        { type: 'expiringMembership', membershipId: 'membership-1', saleId: 'sale-1', expirationDate: '2026-07-20', daysUntilExpiration: 0, targetGroups: [buildTargetGroup()], targetSummary: '1. Утренняя группа · отчётность' },
      ],
    } as unknown as ClientAttentionItem
    getAttentionMock.mockResolvedValueOnce([attention])
    contactedMock.mockResolvedValueOnce({
      ...attention,
      reasons: [
        { type: 'expiringMembership', membershipId: 'membership-1', saleId: 'sale-1', expirationDate: '2026-07-20', daysUntilExpiration: 0, targetGroups: [buildTargetGroup()], targetSummary: '1. Утренняя группа · отчётность' },
      ],
    })

    renderWithProviders(<AttentionDashboard />)

    expect(await screen.findByText('Пропущено подряд: 4')).toBeVisible()
    expect(screen.getByText('Истекает сегодня')).toBeVisible()
    expect(screen.queryByText('Требует оплаты')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Другие действия для Иван Иванов' }))
    // Floating UI cannot position the portal in JSDOM, so assert the rendered
    // menu contract directly; Playwright covers real visibility and focus.
    let telegramAction: HTMLAnchorElement | null = null
    await waitFor(() => {
      telegramAction = document.querySelector<HTMLAnchorElement>(
        'a[role="menuitem"][href="https://t.me/ivan"]',
      )
      expect(telegramAction).not.toBeNull()
    })
    expect(telegramAction).toHaveAttribute('target', '_blank')
    expect(telegramAction).toHaveAttribute('rel', 'noopener noreferrer')

    fireEvent.click(screen.getByRole('button', { name: 'Связались с Иван Иванов' }))

    await waitFor(() => expect(screen.queryByText('Пропущено подряд: 4')).not.toBeInTheDocument())
    expect(screen.getByText('Истекает сегодня')).toBeVisible()
    expect(screen.getByTestId('attention-list')).toBeVisible()
  })

  test('distinguishes multiple memberships for one client by membership identity and targets', async () => {
    getAttentionMock.mockResolvedValueOnce([
      buildMembership({
        clientId: 'client-same',
        fullName: 'Иван Иванов',
        membershipId: 'membership-term',
        saleId: 'sale-term',
        membershipName: 'Месяц',
        targetSummary: '1. Утренняя группа · отчётность · 2. Вечерняя группа',
      }),
      buildMembership({
        clientId: 'client-same',
        fullName: 'Иван Иванов',
        membershipId: 'membership-single',
        saleId: 'sale-single',
        membershipName: 'Разовое',
        targetSummary: '1. Детская группа · отчётность',
      }),
    ])

    renderWithProviders(<AttentionDashboard />)

    expect(await screen.findByTestId('attention-client-card-client-same:membership-term:sale-term')).toBeVisible()
    expect(screen.getByTestId('attention-client-card-client-same:membership-single:sale-single')).toBeVisible()
    expect(screen.getByText('Месяц')).toBeVisible()
    expect(screen.getByText('Разовое')).toBeVisible()
    expect(screen.getByText('1. Утренняя группа · отчётность · 2. Вечерняя группа')).toBeVisible()
    expect(screen.getByText('1. Детская группа · отчётность')).toBeVisible()
  })

  test('keeps missed reason after action error and allows retry that removes the card', async () => {
    const attention: ClientAttentionItem = {
      clientId: 'client-1',
      fullName: 'Иван Иванов',
      phone: null,
      notes: null,
      membership: null,
      telegramLink: null,
      reasons: [{ type: 'missedTraining', missedCount: 3 }],
    }
    getAttentionMock.mockResolvedValueOnce([attention])
    contactedMock.mockRejectedValueOnce(new Error('Сеть недоступна')).mockResolvedValueOnce(null)

    renderWithProviders(<AttentionDashboard />)

    const action = await screen.findByRole('button', { name: 'Связались с Иван Иванов' })
    fireEvent.click(action)
    expect(await screen.findByText(/Сеть недоступна/)).toBeVisible()
    expect(screen.getByText('Пропущено подряд: 3')).toBeVisible()

    fireEvent.click(action)

    expect(await screen.findByText('Никому не требуется внимание')).toBeVisible()
  })

  test('retains last successful data and check time after refresh failure', async () => {
    getAttentionMock
      .mockResolvedValueOnce([buildMembership({ fullName: 'Сохраненный клиент' })])
      .mockRejectedValueOnce(new Error('Обновление недоступно'))

    renderWithProviders(<AttentionDashboard />)

    expect(await screen.findByText('Сохраненный клиент')).toBeVisible()
    expect(screen.getByTestId('memberships-last-check')).toBeVisible()
    expect(screen.getByTestId('attention-list')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }))

    expect(await screen.findByText('Обновление недоступно')).toBeVisible()
    expect(screen.getByText('Сохраненный клиент')).toBeVisible()
    expect(screen.getByTestId('memberships-last-check')).toBeVisible()
    expect(screen.getByTestId('attention-list')).toBeVisible()
  })

  test('shows membership attention states and preserves backend order with hidden list name', async () => {
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

    renderWithProviders(<AttentionDashboard onOpenClient={() => undefined} />)

    const list = await screen.findByTestId('attention-list')
    const listHeading = screen.getByRole('heading', { name: 'Список клиентов' })

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
    expect(list).toHaveAttribute('aria-labelledby', listHeading.id)
    expect(list).not.toHaveAttribute('aria-label')
  })

  test('shows loading state and refresh recovery', async () => {
    const deferred = createDeferred<ClientAttentionItem[]>()
    getAttentionMock.mockReturnValueOnce(deferred.promise)

    renderWithProviders(<AttentionDashboard />)

    expect(screen.getByText('Загружаем клиентов...')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeDisabled()

    deferred.resolve([])
    expect(await screen.findByText('Никому не требуется внимание')).toBeVisible()

    getAttentionMock
      .mockRejectedValueOnce(new Error('CRM API временно недоступен'))
      .mockResolvedValueOnce([])

    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }))
    expect(await screen.findByText('CRM API временно недоступен')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }))

    expect(await screen.findByText('Никому не требуется внимание')).toBeVisible()
  })

  test('shows unknown membership attention state safely', async () => {
    getAttentionMock.mockResolvedValueOnce([
      buildMembership({
        daysUntilExpiration: null,
        expirationDate: null,
        state: 'Unknown',
      }),
    ])

    renderWithProviders(<AttentionDashboard />)

    expect((await screen.findAllByText('Нет данных')).length).toBeGreaterThan(0)
  })

  test('keeps REQ-ATTN-001 data in one list row with one primary action and one menu', async () => {
    const onOpenClient = vi.fn()
    getAttentionMock.mockResolvedValueOnce([{
      clientId: 'client-density',
      fullName: 'Александра Константинопольская-Северная',
      phone: '+79991234567',
      notes: 'Позвонить после вечерней тренировки и уточнить решение по продлению',
      telegramLink: 'https://t.me/alexandra',
      membership: {
        membershipId: 'membership-density',
        saleId: 'sale-density',
        behaviorKind: 'Term',
        membershipName: 'Профессиональный абонемент',
        expirationDate: '2026-07-20',
        daysUntilExpiration: -2,
        targetGroups: [buildTargetGroup()],
        targetSummary: '1. Утренняя группа · отчётность',
      },
      reasons: [
        { type: 'missedTraining', missedCount: 4 },
        {
          type: 'expiredMembership',
          membershipId: 'membership-density',
          saleId: 'sale-density',
          expirationDate: '2026-07-20',
          daysUntilExpiration: -2,
          targetGroups: [buildTargetGroup()],
          targetSummary: '1. Утренняя группа · отчётность',
        },
      ],
    } as unknown as ClientAttentionItem])

    renderWithProviders(<AttentionDashboard onOpenClient={onOpenClient} />)

    const card = await screen.findByTestId(
      'attention-client-card-client-density:membership-density:sale-density',
    )
    expect(card).toHaveClass('crm-list-row-surface')
    expect(card).toHaveAttribute('tabindex', '0')
    expect(card).toHaveTextContent('Александра Константинопольская-Северная')
    expect(card).toHaveTextContent('Пропущено подряд: 4')
    expect(card).toHaveTextContent('Истек 2 дня назад')
    expect(card).toHaveTextContent('Профессиональный абонемент')
    expect(card).toHaveTextContent('1. Утренняя группа · отчётность')
    expect(card).toHaveTextContent('+79991234567')
    expect(card).toHaveTextContent('Позвонить после вечерней тренировки')

    expect(screen.getByLabelText('Всего клиентов: 1')).toBeVisible()
    expect(screen.getByLabelText('Просроченных абонементов: 1')).toBeVisible()
    expect(card.querySelectorAll('[data-crm-variant="primary"]')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', {
      name: 'Другие действия для Александра Константинопольская-Северная',
    }))

    let phoneAction: HTMLAnchorElement | null = null
    let telegramAction: HTMLAnchorElement | null = null
    let profileAction: HTMLButtonElement | null = null
    await waitFor(() => {
      phoneAction = document.querySelector<HTMLAnchorElement>(
        'a[role="menuitem"][href="tel:+79991234567"]',
      )
      telegramAction = document.querySelector<HTMLAnchorElement>(
        'a[role="menuitem"][href="https://t.me/alexandra"]',
      )
      profileAction = document.querySelector<HTMLButtonElement>(
        'button[role="menuitem"][aria-label="Открыть карточку Александра Константинопольская-Северная"]',
      )
      expect(phoneAction).not.toBeNull()
      expect(telegramAction).not.toBeNull()
      expect(profileAction).not.toBeNull()
    })
    fireEvent.click(profileAction!)
    expect(onOpenClient).toHaveBeenCalledWith('client-density')
  })
})

function buildMembership(
  overrides: Partial<{
    clientId: string
    fullName: string
    membershipId: string
    saleId: string
    membershipName: string
    behaviorKind: 'SingleVisit' | 'Term' | 'Professional'
    expirationDate: string | null
    daysUntilExpiration: number | null
    state: 'Expired' | 'ExpiringSoon' | 'Unknown'
    targetSummary: string
  }> = {},
): ClientAttentionItem {
  const state = overrides.state ?? 'ExpiringSoon'
  const membershipId = overrides.membershipId ?? 'membership-1'
  const saleId = overrides.saleId ?? 'sale-1'
  const targetSummary = overrides.targetSummary ?? '1. Утренняя группа · отчётность'
  const reasons: ClientAttentionItem['reasons'] = state === 'Unknown'
    ? []
    : [{
      type: state === 'Expired' ? 'expiredMembership' : 'expiringMembership',
      membershipId,
      saleId,
      expirationDate: overrides.expirationDate ?? '2026-05-06',
      daysUntilExpiration: overrides.daysUntilExpiration ?? 3,
      targetGroups: [buildTargetGroup()],
      targetSummary,
    }]

  return {
    clientId: overrides.clientId ?? 'client-1',
    fullName: overrides.fullName ?? 'Иван Иванов',
    phone: null,
    notes: null,
    telegramLink: null,
    membership: state === 'Unknown'
      ? null
      : {
        membershipId,
        saleId,
        behaviorKind: overrides.behaviorKind ?? 'Term',
        membershipName: overrides.membershipName ?? '',
        expirationDate: overrides.expirationDate ?? '2026-05-06',
        daysUntilExpiration: overrides.daysUntilExpiration ?? 3,
        targetGroups: [buildTargetGroup()],
        targetSummary,
      } as unknown as ClientAttentionItem['membership'],
    reasons,
  }
}

function buildTargetGroup() {
  return {
    groupId: 'group-1',
    groupName: 'Утренняя группа',
    branchId: 'branch-1',
    branchName: 'Основной',
    position: 1,
    isActive: true,
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
