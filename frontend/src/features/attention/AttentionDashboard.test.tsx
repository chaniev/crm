import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  getAttendanceGroupClients,
  getAttendanceGroups,
  getClientAttentionItems,
  markMissedTrainingContacted,
  saveAttendanceMarks,
  type ClientAttentionItem,
  type ClientAttentionMembershipReason,
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
    const term = buildReason({ daysUntilExpiration: 0 })
    const attention: ClientAttentionItem = {
      ...buildMembership(),
      phone: '+79990000000',
      notes: 'Позвонить вечером',
      telegramLink: 'https://t.me/ivan',
      reasons: [{ type: 'missedTraining', missedCount: 4 }, term],
    }
    const updated = { ...attention, reasons: [term] }
    getAttentionMock.mockResolvedValueOnce([attention]).mockResolvedValueOnce([updated])
    contactedMock.mockResolvedValueOnce(updated)

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

  test('keeps both sales and one set of actions after a failed command, then reorders after retry', async () => {
    const first = buildReason({ type: 'expiredMembership', membershipName: 'Месяц', daysUntilExpiration: -2 })
    const second = buildReason({
      type: 'expiredMembership', membershipId: 'membership-2', saleId: 'sale-2', membershipName: 'Разовое',
      daysUntilExpiration: -1, targetSummary: '1. Детская группа · отчётность',
    })
    const updated = { ...buildMembership(), phone: '+79990000000', reasons: [first, second] }
    const attention: ClientAttentionItem = { ...updated, reasons: [...updated.reasons, { type: 'missedTraining', missedCount: 3 }] }
    const reordered = createDeferred<ClientAttentionItem[]>()
    getAttentionMock.mockResolvedValueOnce([attention]).mockReturnValueOnce(reordered.promise)
    contactedMock.mockRejectedValueOnce(new Error('Сбой связи')).mockResolvedValueOnce(updated)
    renderWithProviders(<AttentionDashboard onOpenClient={vi.fn()} />)

    const row = await screen.findByRole('listitem')
    expect(screen.getByLabelText('Всего клиентов: 1')).toBeVisible()
    expect(screen.getByLabelText('Просроченных абонементов: 2')).toBeVisible()
    expect(screen.getByText('Месяц').parentElement).toHaveTextContent('Истек 2 дня назад')
    expect(screen.getByText('Месяц').parentElement).toHaveTextContent(first.targetSummary)
    expect(screen.getByText('Разовое').parentElement).toHaveTextContent('Истек 1 день назад')
    expect(screen.getByText('Разовое').parentElement).toHaveTextContent(second.targetSummary)
    const action = screen.getByRole('button', { name: 'Связались с Иван Иванов' })
    expect(screen.getByRole('button', { name: 'Другие действия для Иван Иванов' })).toBeVisible()
    fireEvent.click(action)
    expect(await screen.findByText(/Сбой связи/)).toBeVisible()
    expect(row).toHaveTextContent('Пропущено подряд: 3')
    expect(row).toHaveTextContent('Месяц')
    expect(row).toHaveTextContent('Разовое')
    fireEvent.click(action)
    await waitFor(() => expect(getAttentionMock).toHaveBeenCalledTimes(2))
    expect(row).not.toHaveTextContent('Пропущено')
    expect(row).toHaveTextContent('Месяц')
    expect(row).toHaveTextContent('Разовое')
    const other = buildMembership({ clientId: 'c2', fullName: 'Анна' })
    reordered.resolve([other, updated])
    await screen.findByText('Анна')
    expect(screen.getAllByRole('listitem')[1]).toBe(row)
  })

  test('ignores a stale refresh after contact and keeps the confirmed result on reload failure', async () => {
    const updated = buildMembership()
    const old = { ...updated, reasons: [...updated.reasons, { type: 'missedTraining' as const, missedCount: 3 }] }
    const stale = createDeferred<ClientAttentionItem[]>()
    getAttentionMock.mockResolvedValueOnce([old]).mockReturnValueOnce(stale.promise)
      .mockRejectedValueOnce(new Error('Обновление недоступно')).mockResolvedValueOnce([updated])
    contactedMock.mockResolvedValueOnce(updated)
    renderWithProviders(<AttentionDashboard />)
    const action = await screen.findByRole('button', { name: 'Связались с Иван Иванов' })
    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }))
    await waitFor(() => expect(getAttentionMock).toHaveBeenCalledTimes(2))
    fireEvent.click(action)
    expect(await screen.findByText('Обновление недоступно')).toBeVisible()
    await act(() => stale.resolve([old]))
    expect(screen.queryByText('Пропущено подряд: 3')).not.toBeInTheDocument()
    expect(screen.getByRole('listitem')).toHaveTextContent('Месяц')
    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }))
    await waitFor(() => expect(screen.queryByText('Обновление недоступно')).not.toBeInTheDocument())
    expect(getAttentionMock).toHaveBeenCalledTimes(4)
  })

  test('keeps missed reason after action error and allows retry that removes the card', async () => {
    const attention: ClientAttentionItem = {
      clientId: 'client-1',
      fullName: 'Иван Иванов',
      phone: null,
      notes: null,
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
      reasons: [
        { type: 'missedTraining', missedCount: 4 },
        buildReason({ type: 'expiredMembership', membershipName: 'Профессиональный абонемент', daysUntilExpiration: -2 }),
      ],
    }])

    renderWithProviders(<AttentionDashboard onOpenClient={onOpenClient} />)

    const card = await screen.findByTestId(
      'attention-client-card-client-density',
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
    expect(onOpenClient).toHaveBeenCalledWith('client-density', { kind: 'attention', route: { kind: 'section', section: 'Attention' }, anchorClientId: 'client-density' })
  })
})

function buildReason(overrides: Partial<ClientAttentionMembershipReason> = {}): ClientAttentionMembershipReason {
  return {
    type: 'expiringMembership',
    membershipId: 'membership-1',
    saleId: 'sale-1',
    behaviorKind: 'Term',
    membershipName: 'Месяц',
    expirationDate: '2026-05-06',
    daysUntilExpiration: 3,
    targetGroups: [buildTargetGroup()],
    targetSummary: '1. Утренняя группа · отчётность',
    ...overrides,
  }
}

function buildMembership({
  clientId = 'client-1', fullName = 'Иван Иванов', state = 'ExpiringSoon', ...reason
}: Partial<ClientAttentionMembershipReason> & {
  clientId?: string
  fullName?: string
  state?: 'Expired' | 'ExpiringSoon' | 'Unknown'
} = {}): ClientAttentionItem {
  return {
    clientId,
    fullName,
    phone: null,
    notes: null,
    telegramLink: null,
    reasons: state === 'Unknown' ? [] : [buildReason({
      type: state === 'Expired' ? 'expiredMembership' : 'expiringMembership', ...reason,
    })],
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
