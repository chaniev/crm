import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  ApiError,
  correctClientMembership,
  getBranches,
  getClient,
  getEligibleMembershipCatalogItems,
  getGroups,
  markClientMembershipPayment,
  purchaseClientMembership,
  renewClientMembership,
  transferClientBranch,
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
    getBranches: vi.fn(),
    getClient: vi.fn(),
    getEligibleMembershipCatalogItems: vi.fn(),
    getGroups: vi.fn(),
    correctClientMembership: vi.fn(),
    markClientMembershipPayment: vi.fn(),
    purchaseClientMembership: vi.fn(),
    renewClientMembership: vi.fn(),
    transferClientBranch: vi.fn(),
    updateClientMembershipComment: vi.fn(),
  }
})

const getBranchesMock = vi.mocked(getBranches)
const correctMembershipMock = vi.mocked(correctClientMembership)
const getClientMock = vi.mocked(getClient)
const getEligibleItemsMock = vi.mocked(getEligibleMembershipCatalogItems)
const getGroupsMock = vi.mocked(getGroups)
const markPaymentMock = vi.mocked(markClientMembershipPayment)
const purchaseMembershipMock = vi.mocked(purchaseClientMembership)
const renewMembershipMock = vi.mocked(renewClientMembership)
const transferClientMock = vi.mocked(transferClientBranch)
const updateCommentMock = vi.mocked(updateClientMembershipComment)

beforeEach(() => {
  getBranchesMock.mockReset()
  correctMembershipMock.mockReset()
  getClientMock.mockReset()
  getEligibleItemsMock.mockReset()
  getGroupsMock.mockReset()
  markPaymentMock.mockReset()
  purchaseMembershipMock.mockReset()
  renewMembershipMock.mockReset()
  transferClientMock.mockReset()
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
    fireEvent.click(await screen.findByRole('radio', { name: 'По каталожной цене' }))

    expect(await screen.findByRole('combobox', { name: 'Вариант абонемента' })).toBeInTheDocument()
    expect(getEligibleItemsMock).toHaveBeenCalledWith('branch-1', expect.any(AbortSignal))
  })

  test('offers three mutually exclusive pricing modes for every new purchase', async () => {
    getClientMock.mockResolvedValue(buildClientDetails())
    getEligibleItemsMock.mockResolvedValue([buildCatalogItem()])

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Новый абонемент' }))

    expect(await screen.findByRole('radio', { name: 'По каталожной цене' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Индивидуальная сумма' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Без варианта каталога' })).not.toBeChecked()
  })

  test('uses a whole-ruble input and keeps catalog price as read-only context for override', async () => {
    getClientMock.mockResolvedValue(buildClientDetails())
    getEligibleItemsMock.mockResolvedValue([buildCatalogItem()])

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Новый абонемент' }))
    fireEvent.click(await screen.findByRole('radio', { name: 'Индивидуальная сумма' }))
    await selectCatalogOption('Вариант абонемента')

    const amount = screen.getByRole('spinbutton', { name: 'Фактическая сумма продажи, ₽' })
    expect(amount).toHaveAttribute('step', '1')
    expect(amount).toHaveAttribute('min', '1')
    expect(screen.getByText('Каталожная цена')).toBeInTheDocument()
    expect(screen.getByText('3 000 ₽')).toBeInTheDocument()
  })

  test('clears stale catalog and manual values when switching to amount-only', async () => {
    const client = buildClientDetails()
    getClientMock.mockResolvedValue(client)
    getEligibleItemsMock.mockResolvedValue([buildCatalogItem()])
    purchaseMembershipMock.mockResolvedValue(client)

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Новый абонемент' }))
    fireEvent.click(await screen.findByRole('radio', { name: 'Индивидуальная сумма' }))
    await selectCatalogOption('Вариант абонемента')
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Фактическая сумма продажи, ₽' }), {
      target: { value: '4100' },
    })

    fireEvent.click(screen.getByRole('radio', { name: 'Без варианта каталога' }))
    const amountOnlyInput = screen.getByRole('spinbutton', { name: 'Фактическая сумма продажи, ₽' })
    expect(amountOnlyInput).toHaveValue(null)
    expect(screen.queryByRole('combobox', { name: 'Вариант абонемента' })).not.toBeInTheDocument()

    fireEvent.change(amountOnlyInput, { target: { value: '4200' } })
    fireEvent.change(screen.getByLabelText('Действует с'), { target: { value: '2026-07-22' } })
    fireEvent.change(screen.getByLabelText('Действует по'), { target: { value: '2026-08-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Оформить абонемент' }))

    const confirmation = await screen.findByRole('dialog', { name: /Подтвердить.*продажу/i })
    expect(within(confirmation).getByText('Без варианта каталога')).toBeInTheDocument()
    expect(within(confirmation).getByText('4 200 ₽')).toBeInTheDocument()
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Подтвердить продажу' }))

    await waitFor(() =>
      expect(purchaseMembershipMock).toHaveBeenCalledWith('client-1', {
        manualSaleAmount: 4200,
        validFrom: '2026-07-22',
        validTo: '2026-08-20',
        paymentStatus: 'Unpaid',
      }, { idempotencyKey: expect.any(String) }),
    )
  })

  test('keeps a backend manual-amount field error beside the input without losing the draft', async () => {
    getClientMock.mockResolvedValue(buildClientDetails())
    getEligibleItemsMock.mockResolvedValue([buildCatalogItem()])
    purchaseMembershipMock.mockRejectedValue(
      new ApiError('Проверьте сумму продажи.', 400, {
        ManualSaleAmount: ['Сумма должна быть указана целыми рублями.'],
      }),
    )

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Новый абонемент' }))
    fireEvent.click(await screen.findByRole('radio', { name: 'Без варианта каталога' }))
    const amount = screen.getByRole('spinbutton', { name: 'Фактическая сумма продажи, ₽' })
    fireEvent.change(amount, { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Действует с'), { target: { value: '2026-07-22' } })
    fireEvent.change(screen.getByLabelText('Действует по'), { target: { value: '2026-08-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Оформить абонемент' }))

    const confirmation = await screen.findByRole('dialog', { name: /Подтвердить.*продажу/i })
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Подтвердить продажу' }))

    expect(await screen.findByText('Сумма должна быть указана целыми рублями.')).toBeInTheDocument()
    expect(amount).toHaveValue(100)
  })

  test('does not submit a fractional manual amount', async () => {
    getClientMock.mockResolvedValue(buildClientDetails())
    getEligibleItemsMock.mockResolvedValue([buildCatalogItem()])

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Новый абонемент' }))
    fireEvent.click(await screen.findByRole('radio', { name: 'Без варианта каталога' }))
    const amount = screen.getByRole('spinbutton', {
      name: 'Фактическая сумма продажи, ₽',
    })
    fireEvent.change(
      amount,
      { target: { value: '100.5' } },
    )
    fireEvent.change(screen.getByLabelText('Действует с'), {
      target: { value: '2026-07-22' },
    })
    fireEvent.change(screen.getByLabelText('Действует по'), {
      target: { value: '2026-08-20' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Оформить абонемент' }))

    expect(amount).toHaveValue(100.5)
    expect(
      screen.queryByRole('dialog', { name: /Подтвердить.*продажу/i }),
    ).not.toBeInTheDocument()
    expect(purchaseMembershipMock).not.toHaveBeenCalled()
  })
})

describe('ClientDetailScreen membership renewal pricing', () => {
  test('requires a fresh mode confirmation and does not inherit the previous override', async () => {
    const previous = {
      ...buildMembership(),
      pricingMode: 'CatalogOverride',
      grossAmount: 4100,
      catalogPrice: 3000,
    } as unknown as ReturnType<typeof buildMembership>
    getClientMock.mockResolvedValue({
      ...buildClientDetails(),
      currentMembership: previous,
      currentMembershipSummary: previous,
      hasCurrentMembership: true,
      membershipHistory: [previous],
    })
    getEligibleItemsMock.mockResolvedValue([buildCatalogItem()])
    renewMembershipMock.mockResolvedValue(buildClientDetails())

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Продлить' }))

    expect(await screen.findByRole('radio', { name: 'По каталожной цене' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Индивидуальная сумма' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Без варианта каталога' })).not.toBeChecked()
    expect(screen.getByText('Предыдущая продажа')).toBeInTheDocument()
    expect(screen.getByText(/Месяц.*4 100 ₽/)).toBeInTheDocument()
    expect(screen.queryByDisplayValue('4100')).not.toBeInTheDocument()
  })

  test('allows a finite Professional membership to start a fresh renewal choice', async () => {
    const professionalMembership = {
      ...buildMembership(),
      membershipCatalogItemId: 'catalog-professional',
      membershipName: 'Профессионал',
      behaviorKind: 'Professional' as const,
      expirationDate: '2026-08-20',
      grossAmount: 0,
      catalogPrice: 0,
    }
    getClientMock.mockResolvedValue({
      ...buildClientDetails(),
      isProfessional: true,
      professionalComment: 'Льготный статус до конца сезона.',
      currentMembership: professionalMembership,
      currentMembershipSummary: professionalMembership,
      hasCurrentMembership: true,
      membershipHistory: [professionalMembership],
    })
    getEligibleItemsMock.mockResolvedValue([
      {
        ...buildCatalogItem(),
        id: 'catalog-professional',
        name: 'Профессионал',
        price: 0,
        behaviorKind: 'Professional',
        isSystemOwned: true,
      },
    ])

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Продлить' }))

    expect(
      await screen.findByRole('radio', { name: 'По каталожной цене' }),
    ).not.toBeChecked()
    expect(
      screen.getByRole('radio', { name: 'Индивидуальная сумма' }),
    ).not.toBeChecked()
    expect(
      screen.getByRole('radio', { name: 'Без варианта каталога' }),
    ).not.toBeChecked()
    expect(getEligibleItemsMock).toHaveBeenCalledWith(
      'branch-1',
      expect.any(AbortSignal),
    )
  })
})

describe('ClientDetailScreen immutable sale actions', () => {
  test('mark-payment keeps the amount read-only and submits only the addressed target before reloading', async () => {
    const membership = { ...buildMembership(), isPaid: false }
    const client = {
      ...buildClientDetails(),
      currentMembership: membership,
      currentMembershipSummary: membership,
      hasCurrentMembership: true,
      membershipHistory: [membership],
    }
    const reloadedMembership = {
      ...membership,
      id: 'version-paid',
      isPaid: true,
      paidAt: '2026-07-23T12:00:00Z',
    }
    const reloadedClient = {
      ...client,
      currentMembership: reloadedMembership,
      currentMembershipSummary: reloadedMembership,
      hasActivePaidMembership: true,
      hasUnpaidCurrentMembership: false,
      membershipHistory: [reloadedMembership, membership],
    }
    getClientMock
      .mockResolvedValueOnce(client)
      .mockResolvedValueOnce(reloadedClient)
    markPaymentMock.mockResolvedValue({
      ...client,
      currentMembership: { ...membership, id: 'version-stale-response' },
      currentMembershipSummary: { ...membership, id: 'version-stale-response' },
    })

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Отметить оплату' }))

    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить оплату' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Подтвердить оплату по текущему абонементу?',
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Подтвердить оплату' }))

    await waitFor(() =>
      expect(markPaymentMock).toHaveBeenCalledWith(
        'client-1',
        {
          saleId: 'sale-current',
          expectedMembershipId: 'version-current',
        },
        { idempotencyKey: expect.any(String) },
      ),
    )
    await waitFor(() => expect(getClientMock).toHaveBeenCalledTimes(2))
    expect(screen.getAllByText('Оплачен')).not.toHaveLength(0)
  })

  test('slow mark-payment double click starts one addressed submission', async () => {
    const membership = { ...buildMembership(), isPaid: false }
    const client = {
      ...buildClientDetails(),
      currentMembership: membership,
      currentMembershipSummary: membership,
      hasCurrentMembership: true,
      membershipHistory: [membership],
    }
    getClientMock.mockResolvedValue(client)
    let resolvePayment: (value: ClientDetails) => void = () => undefined
    markPaymentMock.mockReturnValue(
      new Promise<ClientDetails>((resolve) => {
        resolvePayment = resolve
      }),
    )

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Отметить оплату' }))
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить оплату' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Подтвердить оплату по текущему абонементу?',
    })
    const confirmButton = within(dialog).getByRole('button', {
      name: 'Подтвердить оплату',
    })

    fireEvent.click(confirmButton)
    fireEvent.click(confirmButton)

    expect(markPaymentMock).toHaveBeenCalledTimes(1)
    expect(markPaymentMock).toHaveBeenCalledWith(
      'client-1',
      {
        saleId: 'sale-current',
        expectedMembershipId: 'version-current',
      },
      { idempotencyKey: expect.any(String) },
    )

    resolvePayment(client)
  })
})

describe('ClientDetailScreen sale-producing transfer pricing', () => {
  test('offers all three pricing modes for a transfer that creates a sale', async () => {
    getClientMock.mockResolvedValue(buildClientDetails())
    setupTransferOptions()
    getEligibleItemsMock.mockResolvedValue([buildCatalogItem()])

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Перевести' }))

    const dialog = await screen.findByRole('dialog', { name: 'Перевод клиента' })
    expect(within(dialog).getByRole('radio', { name: 'По каталожной цене' })).not.toBeChecked()
    expect(within(dialog).getByRole('radio', { name: 'Индивидуальная сумма' })).not.toBeChecked()
    expect(within(dialog).getByRole('radio', { name: 'Без варианта каталога' })).not.toBeChecked()
  })

  test('preserves active unused SingleVisit without rendering new-sale pricing controls', async () => {
    const membership = {
      ...buildMembership(),
      behaviorKind: 'SingleVisit' as const,
      expirationDate: null,
      singleVisitUsed: false,
    }
    getClientMock.mockResolvedValue({
      ...buildClientDetails(),
      currentMembership: membership,
      currentMembershipSummary: membership,
      hasCurrentMembership: true,
      membershipHistory: [membership],
    })
    setupTransferOptions()

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Перевести' }))

    const dialog = await screen.findByRole('dialog', { name: 'Перевод клиента' })
    expect(within(dialog).getByText(/перенесено без новой продажи/i)).toBeInTheDocument()
    expect(within(dialog).queryByText('По каталожной цене')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Индивидуальная сумма')).not.toBeInTheDocument()
    expect(within(dialog).queryByText('Без варианта каталога')).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('combobox', { name: 'Вариант абонемента' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('spinbutton', { name: 'Фактическая сумма продажи, ₽' })).not.toBeInTheDocument()
  })
})

describe('ClientDetailScreen membership history pricing provenance', () => {
  test('renders actual gross amount and all backend pricing origins', async () => {
    getClientMock.mockResolvedValue(buildClientWithPricingHistory())

    renderClientDetails()

    expect(await screen.findByText('Каталожная цена')).toBeInTheDocument()
    expect(screen.getByText('Индивидуальная сумма')).toBeInTheDocument()
    expect(screen.getAllByText('Без варианта каталога')).not.toHaveLength(0)
    expect(screen.getByText('3 000 ₽')).toBeInTheDocument()
    expect(screen.getByText('4 100 ₽')).toBeInTheDocument()
    expect(screen.getByText('4 200 ₽')).toBeInTheDocument()
  })
})

describe('ClientDetailScreen membership correction form', () => {
  test('keeps catalog type and sale amount read-only', async () => {
    const currentMembership = buildMembership()
    getClientMock.mockResolvedValue({
      ...buildClientDetails(),
      currentMembership,
      currentMembershipSummary: currentMembership,
      hasCurrentMembership: true,
      membershipHistory: [currentMembership],
    })

    renderWithProviders(
      <ClientDetailScreen
        canManage
        clientId="client-1"
        onBack={() => undefined}
        onEdit={() => undefined}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Исправить' }))

    expect(
      await screen.findByText(
        'Тип и цена зафиксированы в продаже и не меняются при исправлении.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Тип абонемента' })).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: 'Сумма оплаты' })).not.toBeInTheDocument()
    expect(screen.getAllByText('Месяц')).not.toHaveLength(0)
    expect(screen.getAllByText('3 000 ₽')).not.toHaveLength(0)
  })

  test('sends validity-only addressed correction and preserves draft ProblemDetails errors', async () => {
    const currentMembership = {
      ...buildMembership(),
      purchaseDate: '2026-07-01',
      validFrom: '2026-07-01',
      expirationDate: '2026-07-31',
      isPaid: false,
    }
    getClientMock.mockResolvedValue({
      ...buildClientDetails(),
      currentMembership,
      currentMembershipSummary: currentMembership,
      hasCurrentMembership: true,
      membershipHistory: [currentMembership],
    })
    correctMembershipMock.mockRejectedValue(
      new ApiError('Срок пересекается с другим абонементом.', 409, {
        ValidFrom: ['Начало срока пересекается с другой продажей.'],
      }),
    )

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Исправить' }))

    expect(screen.getByText('Дата покупки')).toBeInTheDocument()
    expect(screen.getAllByText(/июл.*2026|01\.07\.2026/)).not.toHaveLength(0)
    expect(screen.queryByRole('switch', { name: 'Оплачен' })).not.toBeInTheDocument()

    const validFrom = await screen.findByLabelText('Действует с')
    const validTo = screen.getByLabelText('Действует по')
    fireEvent.change(validFrom, { target: { value: '2026-07-05' } })
    fireEvent.change(validTo, { target: { value: '2026-08-04' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить исправление' }))

    await waitFor(() =>
      expect(correctMembershipMock).toHaveBeenCalledWith(
        'client-1',
        {
          saleId: 'sale-current',
          expectedMembershipId: 'version-current',
          validFrom: '2026-07-05',
          validTo: '2026-08-04',
        },
        { idempotencyKey: expect.any(String) },
      ),
    )
    expect(await screen.findByText('Срок пересекается с другим абонементом.')).toBeInTheDocument()
    expect(screen.getByText('Начало срока пересекается с другой продажей.')).toBeInTheDocument()
    expect(validFrom).toHaveValue('2026-07-05')
    expect(validTo).toHaveValue('2026-08-04')
  })

  test('reloads after correction and uses the reloaded version for mark-payment', async () => {
    const initialMembership = {
      ...buildMembership(),
      isPaid: false,
      validFrom: '2026-07-01',
      expirationDate: '2026-07-31',
    }
    const correctedMembership = {
      ...initialMembership,
      id: 'version-after-correction',
      validFrom: '2026-07-05',
      expirationDate: '2026-08-04',
    }
    const paidMembership = {
      ...correctedMembership,
      id: 'version-paid',
      isPaid: true,
      paidAt: '2026-07-23T12:00:00Z',
    }
    const initialClient = {
      ...buildClientDetails(),
      currentMembership: initialMembership,
      currentMembershipSummary: initialMembership,
      hasCurrentMembership: true,
      membershipHistory: [initialMembership],
    }
    const correctedClient = {
      ...initialClient,
      currentMembership: correctedMembership,
      currentMembershipSummary: correctedMembership,
      membershipHistory: [correctedMembership, initialMembership],
    }
    const paidClient = {
      ...correctedClient,
      currentMembership: paidMembership,
      currentMembershipSummary: paidMembership,
      hasActivePaidMembership: true,
      hasUnpaidCurrentMembership: false,
      membershipHistory: [paidMembership, correctedMembership, initialMembership],
    }
    getClientMock
      .mockResolvedValueOnce(initialClient)
      .mockResolvedValueOnce(correctedClient)
      .mockResolvedValueOnce(paidClient)
    correctMembershipMock.mockResolvedValue(initialClient)
    markPaymentMock.mockResolvedValue(correctedClient)

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Исправить' }))
    fireEvent.change(await screen.findByLabelText('Действует с'), {
      target: { value: '2026-07-05' },
    })
    fireEvent.change(screen.getByLabelText('Действует по'), {
      target: { value: '2026-08-04' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить исправление' }))

    await waitFor(() => expect(getClientMock).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: 'Отметить оплату' }))
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить оплату' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Подтвердить оплату по текущему абонементу?',
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Подтвердить оплату' }))

    await waitFor(() =>
      expect(markPaymentMock).toHaveBeenCalledWith(
        'client-1',
        {
          saleId: 'sale-current',
          expectedMembershipId: 'version-after-correction',
        },
        { idempotencyKey: expect.any(String) },
      ),
    )
    await waitFor(() => expect(getClientMock).toHaveBeenCalledTimes(3))
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
  const common = { membershipCatalogItemId: 'catalog-1', membershipName: 'Месяц', behaviorKind: 'Term' as const, purchaseDate: '2026-07-01', expirationDate: '2026-08-01', pricingMode: 'Catalog' as const, grossAmount: 3000, catalogPrice: 3000, isPaid: true, singleVisitUsed: false, commentLastChangedByName: 'Анна Петрова', commentLastChangedAt: '2026-07-21T12:34:56Z' }
  return {
    ...client,
    membershipHistory: [
      { ...common, id: 'version-2', saleId: 'sale-1', changeReason: 'PaymentUpdate', comment: 'Комментарий первой покупки' },
      { ...common, id: 'version-1', saleId: 'sale-1', changeReason: 'NewPurchase', comment: 'Комментарий первой покупки' },
      { ...common, id: 'version-3', saleId: 'sale-2', purchaseDate: '2026-08-01', comment: 'Комментарий второй покупки' },
    ],
  }
}

function buildMembership() {
  return {
    id: 'version-current',
    saleId: 'sale-current',
    membershipCatalogItemId: 'catalog-1',
    membershipName: 'Месяц',
    behaviorKind: 'Term' as const,
    purchaseDate: '2026-07-21',
    expirationDate: '2026-08-20',
    pricingMode: 'Catalog' as const,
    grossAmount: 3000,
    catalogPrice: 3000,
    isPaid: true,
    singleVisitUsed: false,
    comment: null,
    commentLastChangedByName: null,
    commentLastChangedAt: null,
  }
}

function renderClientDetails() {
  return renderWithProviders(
    <ClientDetailScreen
      canManage
      clientId="client-1"
      onBack={() => undefined}
      onEdit={() => undefined}
    />,
  )
}

function buildCatalogItem() {
  return {
    id: 'catalog-1',
    branchId: 'branch-1',
    name: 'Месяц',
    price: 3000,
    behaviorKind: 'Term' as const,
    availableFrom: '2026-01-01',
    availableTo: null,
    isSystemOwned: false,
  }
}

async function selectCatalogOption(label: string) {
  fireEvent.click(screen.getByRole('combobox', { name: label }))
  fireEvent.click(await screen.findByRole('option', { name: /Месяц/ }))
}

function setupTransferOptions() {
  getBranchesMock.mockResolvedValue([
    {
      id: 'branch-1',
      name: 'Основной',
      address: null,
      description: null,
      isArchived: false,
      hallCount: 1,
      groupCount: 1,
      clientCount: 1,
    },
    {
      id: 'branch-2',
      name: 'Северный',
      address: null,
      description: null,
      isArchived: false,
      hallCount: 1,
      groupCount: 1,
      clientCount: 0,
    },
  ])
  getGroupsMock.mockResolvedValue({
    items: [],
    totalCount: 0,
    skip: 0,
    take: 0,
  })
}

function buildClientWithPricingHistory(): ClientDetails {
  const base = buildClientDetails()
  const common = {
    behaviorKind: 'Term',
    purchaseDate: '2026-07-22',
    expirationDate: '2026-08-20',
    isPaid: true,
    singleVisitUsed: false,
    comment: null,
    commentLastChangedByName: null,
    commentLastChangedAt: null,
  }

  return {
    ...base,
    membershipHistory: [
      {
        ...common,
        id: 'version-catalog',
        saleId: 'sale-catalog',
        membershipCatalogItemId: 'catalog-1',
        membershipName: 'Месяц',
        pricingMode: 'Catalog',
        grossAmount: 3000,
        catalogPrice: 3000,
      },
      {
        ...common,
        id: 'version-override',
        saleId: 'sale-override',
        membershipCatalogItemId: 'catalog-1',
        membershipName: 'Месяц',
        pricingMode: 'CatalogOverride',
        grossAmount: 4100,
        catalogPrice: 3000,
      },
      {
        ...common,
        id: 'version-amount-only',
        saleId: 'sale-amount-only',
        membershipCatalogItemId: null,
        membershipName: 'Без варианта каталога',
        pricingMode: 'AmountOnly',
        grossAmount: 4200,
        catalogPrice: null,
      },
    ],
  } as unknown as ClientDetails
}
