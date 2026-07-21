import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  getClient,
  getEligibleMembershipCatalogItems,
  updateClientMembershipComment,
  type ClientDetails,
} from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import { ClientDetailScreen } from './ClientManagement'
import { formatNoteAttributionDate } from './noteAttribution'

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>()

  return {
    ...actual,
    getClient: vi.fn(),
    getEligibleMembershipCatalogItems: vi.fn(),
    updateClientMembershipComment: vi.fn(),
  }
})

const getClientMock = vi.mocked(getClient)
const getEligibleItemsMock = vi.mocked(getEligibleMembershipCatalogItems)
const updateCommentMock = vi.mocked(updateClientMembershipComment)

beforeEach(() => {
  getClientMock.mockReset()
  getEligibleItemsMock.mockReset()
  updateCommentMock.mockReset()
})

describe('ClientDetailScreen membership sale comments', () => {
  test('groups technical versions by sale and keeps separate purchases independent', async () => {
    getClientMock.mockResolvedValue(buildClientWithMemberships())
    renderWithProviders(<ClientDetailScreen canManage clientId="client-1" onBack={() => undefined} onEdit={() => undefined} />)

    expect(await screen.findByText('Комментарий первой покупки')).toBeInTheDocument()
    expect(screen.getAllByText('Комментарий к покупке')).toHaveLength(2)
    expect(screen.getByText('Комментарий второй покупки')).toBeInTheDocument()
    expect(screen.queryByText('sale-1')).not.toBeInTheDocument()
  })

  test('does not expose comments or their empty state to coach', async () => {
    getClientMock.mockResolvedValue(buildClientWithMemberships())
    renderWithProviders(<ClientDetailScreen canManage={false} clientId="client-1" onBack={() => undefined} onEdit={() => undefined} />)
    await screen.findAllByText('Иван Иванов')
    expect(screen.queryByText('Комментарий к покупке')).not.toBeInTheDocument()
    expect(screen.queryByText('Комментарий пока не добавлен.')).not.toBeInTheDocument()
  })

  test('saves through sale identity and replaces the details snapshot', async () => {
    const initial = buildClientWithMemberships()
    const updated = { ...initial, membershipHistory: initial.membershipHistory.map((item) => item.saleId === 'sale-1' ? { ...item, comment: 'Обновлено' } : item) }
    getClientMock.mockResolvedValue(initial)
    updateCommentMock.mockResolvedValue(updated)
    renderWithProviders(<ClientDetailScreen canManage clientId="client-1" onBack={() => undefined} onEdit={() => undefined} />)

    const sale = await screen.findByTestId('membership-sale-comment-sale-1')
    fireEvent.click(within(sale).getByRole('button', { name: /Редактировать комментарий/ }))
    fireEvent.change(within(sale).getByRole('textbox', { name: 'Комментарий к покупке' }), { target: { value: 'Обновлено' } })
    fireEvent.click(within(sale).getByRole('button', { name: 'Сохранить' }))

    await waitFor(() => expect(updateCommentMock).toHaveBeenCalledWith('client-1', 'sale-1', 'Обновлено'))
    expect(await screen.findByText('Обновлено')).toBeInTheDocument()
  })

  test('resets a canceled draft and keeps server data after a rejected save', async () => {
    getClientMock.mockResolvedValue(buildClientWithMemberships())
    updateCommentMock.mockRejectedValue(new Error('Недостаточно прав.'))
    renderWithProviders(<ClientDetailScreen canManage clientId="client-1" onBack={() => undefined} onEdit={() => undefined} />)
    const sale = await screen.findByTestId('membership-sale-comment-sale-1')
    fireEvent.click(within(sale).getByRole('button', { name: /Редактировать комментарий/ }))
    const input = within(sale).getByRole('textbox', { name: 'Комментарий к покупке' })
    fireEvent.change(input, { target: { value: 'Несохраненный текст' } })
    fireEvent.click(within(sale).getByRole('button', { name: /Отменить редактирование/ }))
    fireEvent.click(within(sale).getByRole('button', { name: /Редактировать комментарий/ }))
    expect(within(sale).getByRole('textbox', { name: 'Комментарий к покупке' })).toHaveValue('Комментарий первой покупки')
    fireEvent.change(within(sale).getByRole('textbox', { name: 'Комментарий к покупке' }), { target: { value: 'Запрещено' } })
    fireEvent.click(within(sale).getByRole('button', { name: 'Сохранить' }))
    expect(await within(sale).findByText('Недостаточно прав.')).toBeInTheDocument()
    expect(screen.getByText('Комментарий второй покупки')).toBeInTheDocument()
  })
})

describe('ClientDetailScreen membership purchase form', () => {
  test('loads eligible catalog options for a purchase', async () => {
    getClientMock.mockResolvedValue(buildClientDetails())
    getEligibleItemsMock.mockResolvedValue([{ id: 'catalog-1', branchId: 'branch-1', name: 'Месяц', price: 3000, behaviorKind: 'Term', availableFrom: '2026-01-01', availableTo: null, isSystemOwned: false }])

    renderWithProviders(
      <ClientDetailScreen
        canManage
        clientId="client-1"
        onBack={() => undefined}
        onEdit={() => undefined}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Новый абонемент' }))

    expect(await screen.findByRole('combobox', { name: 'Абонемент' })).toBeInTheDocument()
    expect(getEligibleItemsMock).toHaveBeenCalledWith('branch-1', expect.any(AbortSignal))
  })
})

describe('ClientDetailScreen note attribution', () => {
  test('shows the author and local minute-precision timestamp for complete metadata', async () => {
    getClientMock.mockResolvedValue({
      ...buildClientDetails(),
      notes: 'Позвонить вечером',
      notesLastChangedByName: 'Анна Петрова',
      notesLastChangedAt: '2026-07-21T12:34:56Z',
    })

    renderWithProviders(<ClientDetailScreen canManage clientId="client-1" onBack={() => undefined} onEdit={() => undefined} />)

    expect(await screen.findByText('Позвонить вечером')).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`^Анна Петрова · ${formatNoteAttributionDate('2026-07-21T12:34:56Z')}$`))).toBeInTheDocument()
  })

  test('keeps legacy notes unattributed and preserves the existing empty state', async () => {
    getClientMock.mockResolvedValue({ ...buildClientDetails(), notes: 'Старая заметка' })
    const view = renderWithProviders(<ClientDetailScreen canManage clientId="client-1" onBack={() => undefined} onEdit={() => undefined} />)
    expect(await screen.findByText('Старая заметка')).toBeInTheDocument()
    expect(screen.queryByText(/· \d{2}\.\d{2}\.\d{4}/)).not.toBeInTheDocument()

    view.unmount()
    getClientMock.mockResolvedValue(buildClientDetails())
    renderWithProviders(<ClientDetailScreen canManage clientId="client-1" onBack={() => undefined} onEdit={() => undefined} />)
    expect(await screen.findByText('Рабочая заметка пока не добавлена.')).toBeInTheDocument()
  })

  test('formats UTC in a fixed local timezone without seconds', () => {
    expect(formatNoteAttributionDate('2026-07-21T12:34:56Z', 'Europe/Moscow')).toBe('21.07.2026, 15:34')
    expect(formatNoteAttributionDate('not-a-date', 'Europe/Moscow')).toBeNull()
  })
})

function buildClientDetails(): ClientDetails {
  return {
    id: 'client-1',
    fullName: 'Иван Иванов',
    lastName: 'Иванов',
    firstName: 'Иван',
    middleName: '',
    phone: '+79990001122',
    branchId: 'branch-1',
    branchName: 'Основной',
    status: 'Active',
    contactCount: 0,
    groupCount: 0,
    groups: [],
    groupIds: [],
    contacts: [],
    notes: '',
    notesLastChangedByName: null,
    notesLastChangedAt: null,
    photo: null,
    isProfessional: false,
    professionalComment: null,
    hasActivePaidMembership: false,
    hasUnpaidCurrentMembership: false,
    membershipWarning: false,
    currentMembership: null,
    currentMembershipSummary: null,
    hasCurrentMembership: false,
    membershipState: 'None',
    actionHints: [],
    membershipHistory: [],
    attendanceHistory: [],
    attendanceHistoryLoaded: false,
    attendanceHistoryTotalCount: null,
  }
}

function buildClientWithMemberships(): ClientDetails {
  const client = buildClientDetails()
  const common = { membershipCatalogItemId: 'catalog-1', membershipName: 'Месяц', behaviorKind: 'Term' as const, purchaseDate: '2026-07-01', expirationDate: '2026-08-01', paymentAmount: 3000, isPaid: true, singleVisitUsed: false, commentLastChangedByName: 'Анна Петрова', commentLastChangedAt: '2026-07-21T12:34:56Z' }
  return {
    ...client,
    membershipHistory: [
      { ...common, id: 'version-2', saleId: 'sale-1', changeReason: 'PaymentUpdate', comment: 'Комментарий первой покупки' },
      { ...common, id: 'version-1', saleId: 'sale-1', changeReason: 'NewPurchase', comment: 'Комментарий первой покупки' },
      { ...common, id: 'version-3', saleId: 'sale-2', purchaseDate: '2026-08-01', comment: 'Комментарий второй покупки' },
    ],
  }
}
