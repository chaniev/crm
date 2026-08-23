import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  ApiError,
  correctClientMembership,
  createClient,
  getBranches,
  getClient,
  getEligibleMembershipCatalogItems,
  getGroups,
  purchaseClientMembership,
  renewClientMembership,
  transferClientBranch,
  updateClient,
  updateClientMembershipComment,
  type ClientDetails,
} from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import {
  ClientCreateScreen,
  ClientDetailScreen,
  ClientEditScreen,
} from './ClientManagement'
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
    createClient: vi.fn(),
    purchaseClientMembership: vi.fn(),
    renewClientMembership: vi.fn(),
    transferClientBranch: vi.fn(),
    updateClient: vi.fn(),
    updateClientMembershipComment: vi.fn(),
  }
})

const getBranchesMock = vi.mocked(getBranches)
const correctMembershipMock = vi.mocked(correctClientMembership)
const createClientMock = vi.mocked(createClient)
const getClientMock = vi.mocked(getClient)
const getEligibleItemsMock = vi.mocked(getEligibleMembershipCatalogItems)
const getGroupsMock = vi.mocked(getGroups)
const purchaseMembershipMock = vi.mocked(purchaseClientMembership)
const renewMembershipMock = vi.mocked(renewClientMembership)
const transferClientMock = vi.mocked(transferClientBranch)
const updateClientMock = vi.mocked(updateClient)
const updateCommentMock = vi.mocked(updateClientMembershipComment)

beforeAll(() => {
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  })
})

beforeEach(() => {
  getBranchesMock.mockReset()
  correctMembershipMock.mockReset()
  createClientMock.mockReset()
  getClientMock.mockReset()
  getEligibleItemsMock.mockReset()
  getGroupsMock.mockReset()
  purchaseMembershipMock.mockReset()
  renewMembershipMock.mockReset()
  transferClientMock.mockReset()
  updateClientMock.mockReset()
  updateCommentMock.mockReset()
  getGroupsMock.mockResolvedValue(buildGroupsPage())
})

describe('Client route forms', () => {
  test('keeps one header return and only submit in edit while create keeps cancel', async () => {
    setupClientFormOptions()
    getClientMock.mockResolvedValue(buildClientDetails())

    const editView = renderWithProviders(
      <ClientEditScreen
        clientId="client-1"
        onBack={vi.fn()}
        onUpdated={vi.fn()}
      />,
    )

    expect(await screen.findByRole('button', { name: 'Сохранить изменения' })).toBeVisible()
    expect(screen.getAllByRole('button', { name: 'К карточке клиента' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Отменить' })).not.toBeInTheDocument()

    editView.unmount()
    setupClientFormOptions()
    renderWithProviders(
      <ClientCreateScreen onCancel={vi.fn()} onCreated={vi.fn()} />,
    )

    expect(await screen.findByRole('button', { name: 'Сохранить клиента' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Отменить' })).toBeVisible()
  })

  test('keeps the client header return during loading and load failure', async () => {
    getClientMock.mockRejectedValue(new Error('client load failed'))
    getBranchesMock.mockResolvedValue([])
    getGroupsMock.mockResolvedValue({ items: [], totalCount: 0, skip: 0, take: 100 })

    renderWithProviders(
      <ClientEditScreen
        clientId="client-1"
        onBack={vi.fn()}
        onUpdated={vi.fn()}
      />,
    )

    expect(screen.getAllByRole('button', { name: 'К карточке клиента' })).toHaveLength(1)
    expect(await screen.findByText('Карточка клиента не загрузилась')).toBeVisible()
    expect(screen.getAllByRole('button', { name: 'К карточке клиента' })).toHaveLength(1)
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
  })

  test('submits create payload once and returns the created client id', async () => {
    setupClientFormOptions()
    createClientMock.mockResolvedValue({ id: 'created-client' } as ClientDetails)
    const onCreated = vi.fn()

    renderWithProviders(
      <ClientCreateScreen onCancel={vi.fn()} onCreated={onCreated} />,
    )

    expect(await screen.findByRole('button', { name: 'Сохранить клиента' })).toBeVisible()

    fireEvent.change(screen.getByLabelText('Фамилия'), {
      target: { value: ' Иванов ' },
    })
    fireEvent.change(screen.getByLabelText('Телефон'), {
      target: { value: ' +7 999 000-00-00 ' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить клиента' }))

    await waitFor(() => expect(createClientMock).toHaveBeenCalledTimes(1))
    expect(createClientMock).toHaveBeenCalledWith({
      lastName: 'Иванов',
      firstName: undefined,
      middleName: undefined,
      phone: '+7 999 000-00-00',
      birthDate: null,
      branchId: 'branch-1',
      notes: '',
      contacts: [],
      groupIds: [],
    })
    expect(onCreated).toHaveBeenCalledWith('created-client')
  })

  test('keeps the create draft and mapped ProblemDetails field errors', async () => {
    setupClientFormOptions()
    createClientMock.mockRejectedValue(
      new ApiError('Проверьте данные клиента.', 400, {
        FullName: ['Клиент с таким именем уже существует.'],
        Phone: ['Телефон уже используется.'],
      }),
    )
    const onCreated = vi.fn()

    renderWithProviders(
      <ClientCreateScreen onCancel={vi.fn()} onCreated={onCreated} />,
    )

    await screen.findByRole('button', { name: 'Сохранить клиента' })
    fireEvent.change(screen.getByLabelText('Фамилия'), {
      target: { value: '  Иванов  ' },
    })
    fireEvent.change(screen.getByLabelText('Телефон'), {
      target: { value: '  +7 999 000-00-00  ' },
    })
    fireEvent.change(screen.getByLabelText('Рабочая заметка'), {
      target: { value: '  Не звонить утром  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить клиента' }))

    expect(await screen.findByText('Проверьте данные клиента.')).toBeVisible()
    expect(
      screen.getByText('Клиент с таким именем уже существует.'),
    ).toBeVisible()
    expect(screen.getByText('Телефон уже используется.')).toBeVisible()
    expect(screen.getByLabelText('Фамилия')).toHaveValue('  Иванов  ')
    expect(screen.getByLabelText('Телефон')).toHaveValue(
      '  +7 999 000-00-00  ',
    )
    expect(screen.getByLabelText('Рабочая заметка')).toHaveValue(
      '  Не звонить утром  ',
    )
    expect(onCreated).not.toHaveBeenCalled()
  })

  test('submits the exact edit payload once and preserves its ProblemDetails draft', async () => {
    setupClientFormOptions()
    getClientMock.mockResolvedValue(buildClientDetails())
    updateClientMock.mockRejectedValue(
      new ApiError('Изменения не сохранены.', 400, {
        FullName: ['Уточните ФИО клиента.'],
        Notes: ['Заметка содержит недопустимое значение.'],
      }),
    )
    const onUpdated = vi.fn()

    renderWithProviders(
      <ClientEditScreen
        clientId="client-1"
        onBack={vi.fn()}
        onUpdated={onUpdated}
      />,
    )

    await screen.findByRole('button', { name: 'Сохранить изменения' })
    fireEvent.change(screen.getByLabelText('Фамилия'), {
      target: { value: '  Петров  ' },
    })
    fireEvent.change(screen.getByLabelText('Имя'), {
      target: { value: '  Пётр  ' },
    })
    fireEvent.change(screen.getByLabelText('Телефон'), {
      target: { value: '  +7 999 222-33-44  ' },
    })
    fireEvent.change(screen.getByLabelText('Дата рождения'), {
      target: { value: '2001-02-03' },
    })
    fireEvent.change(screen.getByLabelText('Рабочая заметка'), {
      target: { value: '  Черновик изменения  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }))

    await waitFor(() => expect(updateClientMock).toHaveBeenCalledTimes(1))
    expect(updateClientMock).toHaveBeenCalledWith('client-1', {
      lastName: 'Петров',
      firstName: 'Пётр',
      middleName: undefined,
      phone: '+7 999 222-33-44',
      birthDate: '2001-02-03',
      branchId: 'branch-1',
      notes: 'Черновик изменения',
      contacts: [],
      groupIds: [],
    })
    expect(await screen.findByText('Изменения не сохранены.')).toBeVisible()
    expect(screen.getByText('Уточните ФИО клиента.')).toBeVisible()
    expect(
      screen.getByText('Заметка содержит недопустимое значение.'),
    ).toBeVisible()
    expect(screen.getByLabelText('Фамилия')).toHaveValue('  Петров  ')
    expect(screen.getByLabelText('Рабочая заметка')).toHaveValue(
      '  Черновик изменения  ',
    )
    expect(onUpdated).not.toHaveBeenCalled()
  })

  test('ignores a stale edit load after the client route changes', async () => {
    setupClientFormOptions()
    const firstLoad = createDeferred<ClientDetails>()
    const secondLoad = createDeferred<ClientDetails>()
    const firstClient = buildClientDetails({
      id: 'client-1',
      fullName: 'Иван Иванов',
      firstName: 'Иван',
      lastName: 'Иванов',
    })
    const secondClient = buildClientDetails({
      id: 'client-2',
      fullName: 'Пётр Петров',
      firstName: 'Пётр',
      lastName: 'Петров',
    })
    getClientMock.mockImplementation((requestedClientId) =>
      requestedClientId === 'client-2' ? secondLoad.promise : firstLoad.promise,
    )

    const view = renderWithProviders(
      <ClientEditScreen
        clientId="client-1"
        onBack={vi.fn()}
        onUpdated={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(getClientMock).toHaveBeenCalledWith(
        'client-1',
        expect.any(AbortSignal),
      ),
    )
    view.rerender(
      <ClientEditScreen
        clientId="client-2"
        onBack={vi.fn()}
        onUpdated={vi.fn()}
      />,
    )

    await act(async () => {
      secondLoad.resolve(secondClient)
    })
    expect(await screen.findByDisplayValue('Петров')).toBeVisible()

    await act(async () => {
      firstLoad.resolve(firstClient)
    })

    expect(screen.getByDisplayValue('Петров')).toBeVisible()
    expect(screen.queryByDisplayValue('Иванов')).not.toBeInTheDocument()
  })

  test('ignores a stale detail load after the client route changes', async () => {
    const firstLoad = createDeferred<ClientDetails>()
    const secondLoad = createDeferred<ClientDetails>()
    const firstClient = buildClientDetails({
      id: 'client-1',
      fullName: 'Иван Иванов',
    })
    const secondClient = buildClientDetails({
      id: 'client-2',
      fullName: 'Пётр Петров',
    })
    getClientMock.mockImplementation((requestedClientId) =>
      requestedClientId === 'client-2' ? secondLoad.promise : firstLoad.promise,
    )

    const view = renderWithProviders(
      <ClientDetailScreen
        canManage
        clientId="client-1"
        onBack={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    await waitFor(() =>
      expect(getClientMock).toHaveBeenCalledWith(
        'client-1',
        expect.any(AbortSignal),
      ),
    )
    view.rerender(
      <ClientDetailScreen
        canManage
        clientId="client-2"
        onBack={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    await act(async () => {
      secondLoad.resolve(secondClient)
    })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Пётр Петров' }),
    ).toBeVisible()

    await act(async () => {
      firstLoad.resolve(firstClient)
    })

    expect(
      screen.getByRole('heading', { level: 1, name: 'Пётр Петров' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', { level: 1, name: 'Иван Иванов' }),
    ).not.toBeInTheDocument()
  })

  test('keeps detail navigation recovery when the client is not found', async () => {
    getClientMock.mockRejectedValue(new ApiError('Клиент не найден.', 404))

    renderWithProviders(
      <ClientDetailScreen
        canManage
        clientId="missing-client"
        onBack={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    expect(await screen.findByText('Карточка клиента не загрузилась')).toBeVisible()
    expect(screen.getByText('Клиент не найден.')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'К списку клиентов' }),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Редактировать' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Перевести' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'В архив' })).not.toBeInTheDocument()
  })

  test('does not expose client management actions in the restricted detail mode', async () => {
    getClientMock.mockResolvedValue(buildClientDetails())

    renderWithProviders(
      <ClientDetailScreen
        canManage={false}
        clientId="client-1"
        onBack={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Иван Иванов' }),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Редактировать' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Перевести' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'В архив' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Новый абонемент' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Продлить' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Исправить' })).not.toBeInTheDocument()
    expect(screen.queryByText('История абонемента')).not.toBeInTheDocument()
    expect(screen.getByText('Режим тренера')).toBeVisible()
  })
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

  test('keeps sale and version order stable when the API history is reordered', async () => {
    const initial = buildClientWithMemberships()
    const orderedHistory = initial.membershipHistory.map((membership) => ({
      ...membership,
      validFrom:
        membership.id === 'version-3'
          ? '2026-08-01'
          : membership.id === 'version-2'
            ? '2026-07-02'
            : '2026-07-01',
    }))
    const expectedCommentActions = [
      'Редактировать комментарий к покупке от 1 авг. 2026 г.',
      'Редактировать комментарий к покупке от 1 июл. 2026 г.',
    ]

    getClientMock.mockResolvedValue({
      ...initial,
      membershipHistory: orderedHistory,
    })
    const firstView = renderClientDetails()

    expect(
      (await screen.findAllByRole('button', {
        name: /Редактировать комментарий к покупке/,
      })).map((button) => button.getAttribute('aria-label')),
    ).toEqual(expectedCommentActions)
    const firstSale = screen
      .getByTestId('membership-sale-comment-sale-1')
      .closest('.membership-sale-card')
    expect(firstSale).not.toBeNull()
    expect(
      within(firstSale as HTMLElement)
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent),
    ).toEqual([
      expect.stringContaining('Исправление'),
      expect.stringContaining('Новая покупка'),
    ])

    firstView.unmount()
    getClientMock.mockResolvedValue({
      ...initial,
      membershipHistory: [...orderedHistory].reverse(),
    })
    renderClientDetails()

    expect(
      (await screen.findAllByRole('button', {
        name: /Редактировать комментарий к покупке/,
      })).map((button) => button.getAttribute('aria-label')),
    ).toEqual(expectedCommentActions)
    const reorderedFirstSale = screen
      .getByTestId('membership-sale-comment-sale-1')
      .closest('.membership-sale-card')
    expect(reorderedFirstSale).not.toBeNull()
    expect(
      within(reorderedFirstSale as HTMLElement)
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent),
    ).toEqual([
      expect.stringContaining('Исправление'),
      expect.stringContaining('Новая покупка'),
    ])
  })

  test('does not expose comments or their empty state to coach', async () => {
    getClientMock.mockResolvedValue(buildClientWithMemberships())
    renderWithProviders(<ClientDetailScreen canManage={false} clientId="client-1" onBack={() => undefined} onEdit={() => undefined} />)
    await screen.findAllByText('Иван Иванов')
    expect(screen.queryByText('Комментарий к покупке')).not.toBeInTheDocument()
    expect(screen.queryByText('Комментарий пока не добавлен.')).not.toBeInTheDocument()
  })

  test('saves through sale identity and keeps another draft stable across reorder and insertion', async () => {
    const initial = buildClientWithMemberships()
    const updated = {
      ...initial,
      membershipHistory: [
        {
          ...initial.membershipHistory[0],
          id: 'version-4',
          validFrom: '2026-09-01T10:00:00Z',
          comment: 'Обновлено',
          commentLastChangedByName: 'Главный тренер',
          commentLastChangedAt: '2026-09-01T10:00:00Z',
        },
        ...initial.membershipHistory.map((item) => item.saleId === 'sale-1' ? {
          ...item,
          comment: 'Обновлено',
          commentLastChangedByName: 'Главный тренер',
          commentLastChangedAt: '2026-09-01T10:00:00Z',
        } : item),
      ],
    }
    getClientMock.mockResolvedValue(initial)
    updateCommentMock.mockResolvedValue(updated)
    renderWithProviders(<ClientDetailScreen canManage clientId="client-1" onBack={() => undefined} onEdit={() => undefined} />)

    const saleA = await screen.findByTestId('membership-sale-comment-sale-1')
    const saleB = screen.getByTestId('membership-sale-comment-sale-2')
    fireEvent.click(within(saleB).getByRole('button', { name: /Редактировать комментарий/ }))
    fireEvent.change(within(saleB).getByRole('textbox', { name: 'Комментарий к покупке' }), { target: { value: 'Черновик B' } })
    fireEvent.click(within(saleA).getByRole('button', { name: /Редактировать комментарий/ }))
    fireEvent.change(within(saleA).getByRole('textbox', { name: 'Комментарий к покупке' }), { target: { value: 'Обновлено' } })
    fireEvent.click(within(saleA).getByRole('button', { name: 'Сохранить' }))

    await waitFor(() => expect(updateCommentMock).toHaveBeenCalledWith('client-1', 'sale-1', 'Обновлено'))
    expect(updateCommentMock).toHaveBeenCalledTimes(1)
    expect(await within(screen.getByTestId('membership-sale-comment-sale-1')).findByText('Обновлено')).toBeInTheDocument()
    expect(within(screen.getByTestId('membership-sale-comment-sale-2')).getByRole('textbox', { name: 'Комментарий к покупке' })).toHaveValue('Черновик B')
    expect(screen.getAllByText('Комментарий к покупке')).toHaveLength(2)
    expect(screen.getAllByText('Обновлено')).toHaveLength(1)
  })

  test('keeps both sale comments when concurrent saves resolve with stale snapshots out of order', async () => {
    const initial = buildClientWithMemberships()
    const saleARequest = createDeferred<ClientDetails>()
    const saleBRequest = createDeferred<ClientDetails>()
    const saleAResponse = {
      ...initial,
      membershipHistory: initial.membershipHistory.map((membership) =>
        membership.saleId === 'sale-1'
          ? {
              ...membership,
              comment: 'Обновлено A',
              commentLastChangedByName: 'Администратор A',
              commentLastChangedAt: '2026-09-01T10:00:00Z',
            }
          : membership,
      ),
    }
    const saleBResponse = {
      ...initial,
      membershipHistory: initial.membershipHistory.map((membership) =>
        membership.saleId === 'sale-2'
          ? {
              ...membership,
              comment: 'Обновлено B',
              commentLastChangedByName: 'Администратор B',
              commentLastChangedAt: '2026-09-01T10:01:00Z',
            }
          : membership,
      ),
    }

    getClientMock.mockResolvedValue(initial)
    updateCommentMock.mockImplementation((_clientId, saleId) =>
      saleId === 'sale-1' ? saleARequest.promise : saleBRequest.promise,
    )
    renderClientDetails()

    const saleA = await screen.findByTestId('membership-sale-comment-sale-1')
    const saleB = screen.getByTestId('membership-sale-comment-sale-2')

    fireEvent.click(
      within(saleA).getByRole('button', { name: /Редактировать комментарий/ }),
    )
    fireEvent.change(
      within(saleA).getByRole('textbox', { name: 'Комментарий к покупке' }),
      { target: { value: 'Обновлено A' } },
    )
    fireEvent.click(within(saleA).getByRole('button', { name: 'Сохранить' }))

    fireEvent.click(
      within(saleB).getByRole('button', { name: /Редактировать комментарий/ }),
    )
    fireEvent.change(
      within(saleB).getByRole('textbox', { name: 'Комментарий к покупке' }),
      { target: { value: 'Обновлено B' } },
    )
    fireEvent.click(within(saleB).getByRole('button', { name: 'Сохранить' }))

    await waitFor(() => expect(updateCommentMock).toHaveBeenCalledTimes(2))

    await act(async () => {
      saleBRequest.resolve(saleBResponse)
    })
    expect(await within(saleB).findByText('Обновлено B')).toBeInTheDocument()

    await act(async () => {
      saleARequest.resolve(saleAResponse)
    })

    expect(await within(saleA).findByText('Обновлено A')).toBeInTheDocument()
    expect(within(saleB).getByText('Обновлено B')).toBeInTheDocument()
    expect(screen.getAllByText('Обновлено A')).toHaveLength(1)
    expect(screen.getAllByText('Обновлено B')).toHaveLength(1)
  })

  test('keeps rejection and draft row-local, then retries without changing another sale', async () => {
    const initial = buildClientWithMemberships()
    const updated = {
      ...initial,
      membershipHistory: initial.membershipHistory.map((item) => item.saleId === 'sale-1' ? {
        ...item,
        comment: 'Разрешено после повтора',
        commentLastChangedByName: 'Главный тренер',
        commentLastChangedAt: '2026-09-01T10:00:00Z',
      } : item),
    }
    getClientMock.mockResolvedValue(initial)
    updateCommentMock
      .mockRejectedValueOnce(new Error('Недостаточно прав.'))
      .mockResolvedValueOnce(updated)
    renderWithProviders(<ClientDetailScreen canManage clientId="client-1" onBack={() => undefined} onEdit={() => undefined} />)
    const saleA = await screen.findByTestId('membership-sale-comment-sale-1')
    const saleB = screen.getByTestId('membership-sale-comment-sale-2')

    fireEvent.click(within(saleB).getByRole('button', { name: /Редактировать комментарий/ }))
    fireEvent.change(within(saleB).getByRole('textbox', { name: 'Комментарий к покупке' }), { target: { value: 'Черновик B' } })
    fireEvent.click(within(saleA).getByRole('button', { name: /Редактировать комментарий/ }))
    fireEvent.change(within(saleA).getByRole('textbox', { name: 'Комментарий к покупке' }), { target: { value: 'Запрещено' } })
    fireEvent.click(within(saleA).getByRole('button', { name: 'Сохранить' }))

    expect(await within(saleA).findByText('Недостаточно прав.')).toBeInTheDocument()
    expect(within(saleA).getByRole('textbox', { name: 'Комментарий к покупке' })).toHaveValue('Запрещено')
    expect(within(saleB).getByRole('textbox', { name: 'Комментарий к покупке' })).toHaveValue('Черновик B')
    expect(within(saleB).getByRole('button', { name: 'Сохранить' })).toBeEnabled()
    expect(screen.queryByText('Действие не выполнено')).not.toBeInTheDocument()

    fireEvent.click(within(saleA).getByRole('button', { name: 'Сохранить' }))
    expect(await within(screen.getByTestId('membership-sale-comment-sale-1')).findByText('Разрешено после повтора')).toBeInTheDocument()
    expect(within(screen.getByTestId('membership-sale-comment-sale-2')).getByRole('textbox', { name: 'Комментарий к покупке' })).toHaveValue('Черновик B')
    expect(updateCommentMock).toHaveBeenNthCalledWith(1, 'client-1', 'sale-1', 'Запрещено')
    expect(updateCommentMock).toHaveBeenNthCalledWith(2, 'client-1', 'sale-1', 'Запрещено')

    fireEvent.click(within(screen.getByTestId('membership-sale-comment-sale-2')).getByRole('button', { name: /Отменить редактирование/ }))
    expect(screen.getByText('Комментарий второй покупки')).toBeInTheDocument()
  })
})

describe('ClientDetailScreen birth date', () => {
  test('shows Russian birth date and full age for a manager', async () => {
    getClientMock.mockResolvedValue(
      buildClientDetails({ birthDate: '2004-02-29', businessDate: '2026-03-01' }),
    )

    renderClientDetails()

    expect(await screen.findByText('Дата рождения')).toBeInTheDocument()
    expect(screen.getByText('29 февраля 2004 г.')).toBeInTheDocument()
    expect(screen.getByText('Возраст')).toBeInTheDocument()
    expect(screen.getByText('22 года')).toBeInTheDocument()
  })

  test('shows birth date to a scoped coach but omits age when birth date is empty', async () => {
    getClientMock.mockResolvedValue(
      buildClientDetails({ birthDate: null, businessDate: '2026-07-23' }),
    )

    renderWithProviders(
      <ClientDetailScreen
        canManage={false}
        clientId="client-1"
        onBack={() => undefined}
        onEdit={() => undefined}
      />,
    )

    expect(await screen.findByText('Дата рождения')).toBeInTheDocument()
    expect(screen.getAllByText('Не указана').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('Возраст')).not.toBeInTheDocument()
  })

  test('shows future birth date without a negative age', async () => {
    getClientMock.mockResolvedValue(
      buildClientDetails({ birthDate: '2030-01-01', businessDate: '2026-07-23' }),
    )

    renderClientDetails()

    expect(await screen.findByText('1 января 2030 г.')).toBeInTheDocument()
    expect(screen.getByText('Не вычисляется')).toBeInTheDocument()
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

  test('opens purchase with required backend business-date payment field and no status selector', async () => {
    getClientMock.mockResolvedValue(buildClientDetails({ businessDate: '2026-07-23' }))
    getEligibleItemsMock.mockResolvedValue([buildCatalogItem()])

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Новый абонемент' }))

    const paymentDate = await screen.findByLabelText('Дата оплаты')
    expect(paymentDate).toBeRequired()
    expect(paymentDate).toHaveAttribute('type', 'date')
    expect(paymentDate).toHaveAttribute('max', '2026-07-23')
    expect(paymentDate).toHaveValue('2026-07-23')
    expect(screen.queryByRole('combobox', { name: 'Статус оплаты' })).not.toBeInTheDocument()
    expect(screen.queryByText('Не оплачен')).not.toBeInTheDocument()
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
    fireEvent.change(await screen.findByLabelText('Дата оплаты'), { target: { value: '2026-07-10' } })
    await selectMembershipTargetGroup()
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
        paymentDate: '2026-07-10',
        targetGroupIds: ['group-1'],
      }, { idempotencyKey: expect.any(String) }),
    )
  })

  test('keeps a backend manual-amount field error beside the input without losing the draft', async () => {
    getClientMock.mockResolvedValue(buildClientDetails())
    getEligibleItemsMock.mockResolvedValue([buildCatalogItem()])
    purchaseMembershipMock.mockRejectedValue(
      new ApiError('Проверьте сумму продажи.', 400, {
        ManualSaleAmount: ['Сумма должна быть указана целыми рублями.'],
        PaymentDate: ['Дата оплаты не может быть позже текущей даты.'],
      }),
    )

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Новый абонемент' }))
    fireEvent.click(await screen.findByRole('radio', { name: 'Без варианта каталога' }))
    const amount = screen.getByRole('spinbutton', { name: 'Фактическая сумма продажи, ₽' })
    fireEvent.change(amount, { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Действует с'), { target: { value: '2026-07-22' } })
    fireEvent.change(screen.getByLabelText('Действует по'), { target: { value: '2026-08-20' } })
    fireEvent.change(await screen.findByLabelText('Дата оплаты'), { target: { value: '2026-07-24' } })
    await selectMembershipTargetGroup()
    fireEvent.click(screen.getByRole('button', { name: 'Оформить абонемент' }))

    const confirmation = await screen.findByRole('dialog', { name: /Подтвердить.*продажу/i })
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Подтвердить продажу' }))

    expect(await screen.findByText('Сумма должна быть указана целыми рублями.')).toBeInTheDocument()
    expect(screen.getByText('Дата оплаты не может быть позже текущей даты.')).toBeInTheDocument()
    expect(amount).toHaveValue(100)
    expect(screen.getByLabelText('Дата оплаты')).toHaveValue('2026-07-24')
  })

  test('preserves a failed purchase draft and retries with the same idempotency key', async () => {
    const client = buildClientDetails({ businessDate: '2026-07-23' })
    getClientMock.mockResolvedValue(client)
    getEligibleItemsMock.mockResolvedValue([buildCatalogItem()])
    purchaseMembershipMock
      .mockRejectedValueOnce(
        new ApiError('Проверьте сумму продажи.', 400, {
          ManualSaleAmount: ['Сумма продажи требует уточнения.'],
        }),
      )
      .mockResolvedValueOnce(client)

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Новый абонемент' }))
    fireEvent.click(await screen.findByRole('radio', { name: 'Без варианта каталога' }))
    const amount = screen.getByRole('spinbutton', {
      name: 'Фактическая сумма продажи, ₽',
    })
    fireEvent.change(amount, { target: { value: '4200' } })
    fireEvent.change(screen.getByLabelText('Действует с'), {
      target: { value: '2026-07-22' },
    })
    fireEvent.change(screen.getByLabelText('Действует по'), {
      target: { value: '2026-08-20' },
    })
    fireEvent.change(await screen.findByLabelText('Дата оплаты'), {
      target: { value: '2026-07-01' },
    })
    await selectMembershipTargetGroup()

    fireEvent.click(screen.getByRole('button', { name: 'Оформить абонемент' }))
    let confirmation = await screen.findByRole('dialog', {
      name: /Подтвердить.*продажу/i,
    })
    fireEvent.click(
      within(confirmation).getByRole('button', {
        name: 'Подтвердить продажу',
      }),
    )

    await screen.findByText('Сумма продажи требует уточнения.')
    expect(screen.getAllByText('Проверьте сумму продажи.').length).toBeGreaterThan(0)
    expect(screen.getByText('Сумма продажи требует уточнения.')).toBeVisible()
    expect(amount).toHaveValue(4200)
    expect(screen.getByLabelText('Действует с')).toHaveValue('2026-07-22')
    const firstIdempotencyKey = purchaseMembershipMock.mock.calls[0]?.[2]
      .idempotencyKey

    fireEvent.click(screen.getByRole('button', { name: 'Оформить абонемент' }))
    confirmation = await screen.findByRole('dialog', {
      name: /Подтвердить.*продажу/i,
    })
    fireEvent.click(
      within(confirmation).getByRole('button', {
        name: 'Подтвердить продажу',
      }),
    )

    await waitFor(() => expect(purchaseMembershipMock).toHaveBeenCalledTimes(2))
    expect(purchaseMembershipMock.mock.calls[1]?.[2].idempotencyKey).toBe(
      firstIdempotencyKey,
    )
    expect(purchaseMembershipMock.mock.calls[1]?.[1]).toEqual({
      manualSaleAmount: 4200,
      validFrom: '2026-07-22',
      validTo: '2026-08-20',
      paymentDate: '2026-07-01',
      targetGroupIds: ['group-1'],
    })
  })

  test('keeps one pending purchase request when submit is triggered again', async () => {
    const pendingPurchase = createDeferred<ReturnType<typeof buildClientDetails>>()
    getClientMock.mockResolvedValue(buildClientDetails())
    getEligibleItemsMock.mockResolvedValue([buildCatalogItem()])
    purchaseMembershipMock.mockReturnValue(pendingPurchase.promise)

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Новый абонемент' }))
    fireEvent.click(await screen.findByRole('radio', { name: 'Без варианта каталога' }))
    fireEvent.change(screen.getByRole('spinbutton', {
      name: 'Фактическая сумма продажи, ₽',
    }), { target: { value: '4200' } })
    fireEvent.change(screen.getByLabelText('Действует с'), {
      target: { value: '2026-07-22' },
    })
    fireEvent.change(screen.getByLabelText('Действует по'), {
      target: { value: '2026-08-20' },
    })
    await selectMembershipTargetGroup()
    fireEvent.click(screen.getByRole('button', { name: 'Оформить абонемент' }))
    const confirmation = await screen.findByRole('dialog', {
      name: /Подтвердить.*продажу/i,
    })
    fireEvent.click(
      within(confirmation).getByRole('button', {
        name: 'Подтвердить продажу',
      }),
    )

    await waitFor(() => expect(purchaseMembershipMock).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Оформить абонемент' }))
    expect(purchaseMembershipMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      pendingPurchase.resolve(buildClientDetails())
    })
  })

  test('cancels purchase confirmation without a request and preserves the draft', async () => {
    getClientMock.mockResolvedValue(buildClientDetails())
    getEligibleItemsMock.mockResolvedValue([buildCatalogItem()])

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Новый абонемент' }))
    fireEvent.click(await screen.findByRole('radio', { name: 'Без варианта каталога' }))
    const amount = screen.getByRole('spinbutton', {
      name: 'Фактическая сумма продажи, ₽',
    })
    fireEvent.change(amount, { target: { value: '4200' } })
    fireEvent.change(screen.getByLabelText('Действует с'), {
      target: { value: '2026-07-22' },
    })
    fireEvent.change(screen.getByLabelText('Действует по'), {
      target: { value: '2026-08-20' },
    })
    await selectMembershipTargetGroup()
    fireEvent.click(screen.getByRole('button', { name: 'Оформить абонемент' }))

    const confirmation = await screen.findByRole('dialog', {
      name: /Подтвердить.*продажу/i,
    })
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Отменить' }))

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: /Подтвердить.*продажу/i }),
      ).not.toBeInTheDocument(),
    )
    expect(purchaseMembershipMock).not.toHaveBeenCalled()
    expect(amount).toHaveValue(4200)
    expect(screen.getByLabelText('Действует с')).toHaveValue('2026-07-22')
    expect(screen.getByLabelText('Действует по')).toHaveValue('2026-08-20')
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
    await selectMembershipTargetGroup()

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
      currentMemberships: [previous],
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
      currentMemberships: [professionalMembership],
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

  test('renewal submits a backdated payment date without payment status', async () => {
    const currentMembership = buildMembership()
    const client = {
      ...buildClientDetails({ businessDate: '2026-07-23' }),
      currentMemberships: [currentMembership],
      hasCurrentMembership: true,
      membershipHistory: [currentMembership],
    }
    getClientMock.mockResolvedValue(client)
    getEligibleItemsMock.mockResolvedValue([buildCatalogItem()])
    renewMembershipMock.mockResolvedValue(client)

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Продлить' }))
    const paymentDate = await screen.findByLabelText('Дата оплаты')
    expect(paymentDate).toHaveAttribute('max', '2026-07-23')
    expect(paymentDate).toHaveValue('2026-07-23')
    fireEvent.click(screen.getByRole('radio', { name: 'По каталожной цене' }))
    await selectCatalogOption('Вариант абонемента')
    fireEvent.change(paymentDate, { target: { value: '2026-07-05' } })
    fireEvent.click(screen.getByRole('button', { name: 'Продлить абонемент' }))
    const confirmation = await screen.findByRole('dialog', { name: /Подтвердить.*продажу/i })
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Подтвердить продажу' }))

    await waitFor(() =>
      expect(renewMembershipMock).toHaveBeenCalledWith('client-1', {
        membershipCatalogItemId: 'catalog-1',
        saleId: 'sale-current',
        expectedMembershipId: 'version-current',
        paymentDate: '2026-07-05',
        targetGroupIds: ['group-1'],
      }, { idempotencyKey: expect.any(String) }),
    )
    expect(renewMembershipMock.mock.calls[0]?.[1]).not.toHaveProperty('paymentStatus')
    expect(screen.queryByRole('combobox', { name: 'Статус оплаты' })).not.toBeInTheDocument()
  })

  test('preserves renewal draft and idempotency key across a network retry', async () => {
    const currentMembership = buildMembership()
    const client = {
      ...buildClientDetails({ businessDate: '2026-07-23' }),
      currentMemberships: [currentMembership],
      hasCurrentMembership: true,
      membershipHistory: [currentMembership],
    }
    getClientMock.mockResolvedValue(client)
    getEligibleItemsMock.mockResolvedValue([buildCatalogItem()])
    renewMembershipMock
      .mockRejectedValueOnce(new Error('Сеть недоступна. Повторите попытку.'))
      .mockResolvedValueOnce(client)

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Продлить' }))
    fireEvent.click(await screen.findByRole('radio', { name: 'По каталожной цене' }))
    await selectCatalogOption('Вариант абонемента')
    const paymentDate = await screen.findByLabelText('Дата оплаты')
    fireEvent.change(paymentDate, { target: { value: '2026-07-05' } })
    fireEvent.click(screen.getByRole('button', { name: 'Продлить абонемент' }))
    let confirmation = await screen.findByRole('dialog', {
      name: /Подтвердить.*продажу/i,
    })
    fireEvent.click(
      within(confirmation).getByRole('button', {
        name: 'Подтвердить продажу',
      }),
    )

    expect(await screen.findByText('Сеть недоступна. Повторите попытку.')).toBeVisible()
    expect(paymentDate).toHaveValue('2026-07-05')
    const firstIdempotencyKey = renewMembershipMock.mock.calls[0]?.[2]
      .idempotencyKey

    fireEvent.click(screen.getByRole('button', { name: 'Продлить абонемент' }))
    confirmation = await screen.findByRole('dialog', {
      name: /Подтвердить.*продажу/i,
    })
    fireEvent.click(
      within(confirmation).getByRole('button', {
        name: 'Подтвердить продажу',
      }),
    )

    await waitFor(() => expect(renewMembershipMock).toHaveBeenCalledTimes(2))
    expect(renewMembershipMock.mock.calls[1]?.[1]).toEqual({
      membershipCatalogItemId: 'catalog-1',
      saleId: 'sale-current',
      expectedMembershipId: 'version-current',
      paymentDate: '2026-07-05',
      targetGroupIds: ['group-1'],
    })
    expect(renewMembershipMock.mock.calls[1]?.[2].idempotencyKey).toBe(
      firstIdempotencyKey,
    )
  })
})

describe('ClientDetailScreen immutable sale actions', () => {
  test('does not render mark-payment action or paid/unpaid badge for current memberships', async () => {
    const membership = buildMembership()
    const client = {
      ...buildClientDetails(),
      currentMemberships: [membership],
      hasCurrentMembership: true,
      membershipHistory: [membership],
    }
    getClientMock.mockResolvedValue(client)

    renderClientDetails()

    expect(await screen.findByText('История абонемента')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Отметить оплату' })).not.toBeInTheDocument()
    expect(screen.queryByText('Не оплачен')).not.toBeInTheDocument()
    expect(screen.queryByText('Оплачен')).not.toBeInTheDocument()
  })
})

describe('ClientDetailScreen branch/group assignment transfer', () => {
  test('does not render membership sale controls in assignment transfer', async () => {
    getClientMock.mockResolvedValue(buildClientDetails())
    setupTransferOptions()

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Перевести' }))

    const dialog = await screen.findByRole('dialog', { name: 'Перевод клиента' })
    expect(within(dialog).queryByRole('radio', { name: 'По каталожной цене' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('radio', { name: 'Индивидуальная сумма' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('radio', { name: 'Без варианта каталога' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('combobox', { name: 'Вариант абонемента' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('spinbutton', { name: 'Фактическая сумма продажи, ₽' })).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Дата оплаты')).not.toBeInTheDocument()
    expect(getEligibleItemsMock).not.toHaveBeenCalled()
  })

  test('sends only explicit branch and group assignment fields once', async () => {
    const client = buildClientDetails({ businessDate: '2026-07-23' })
    getClientMock.mockResolvedValue(client)
    setupTransferOptions()
    transferClientMock.mockResolvedValue(client)

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Перевести' }))

    const dialog = await screen.findByRole('dialog', { name: 'Перевод клиента' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Перевести клиента' }))

    await waitFor(() =>
      expect(transferClientMock).toHaveBeenCalledWith('client-1', {
        targetBranchId: 'branch-1',
        targetGroupIds: [],
      }, { idempotencyKey: expect.any(String) }),
    )
    expect(transferClientMock).toHaveBeenCalledTimes(1)
    expect(transferClientMock.mock.calls[0]?.[1]).not.toHaveProperty('membershipCatalogItemId')
    expect(transferClientMock.mock.calls[0]?.[1]).not.toHaveProperty('manualSaleAmount')
    expect(transferClientMock.mock.calls[0]?.[1]).not.toHaveProperty('paymentDate')
  })

  test('preserves a failed transfer draft and retries with the same idempotency key', async () => {
    const client = buildClientDetails({ businessDate: '2026-07-23' })
    getClientMock.mockResolvedValue(client)
    setupTransferOptions()
    transferClientMock
      .mockRejectedValueOnce(
        new ApiError('Перевод не выполнен.', 400, {
          TargetBranchId: ['Филиал временно недоступен.'],
        }),
      )
      .mockResolvedValueOnce(client)

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Перевести' }))

    const transferDialog = await screen.findByRole('dialog', {
      name: 'Перевод клиента',
    })

    fireEvent.click(
      within(transferDialog).getByRole('button', {
        name: 'Перевести клиента',
      }),
    )

    expect(await screen.findByText('Перевод не выполнен.')).toBeVisible()
    expect(screen.getByText('Филиал временно недоступен.')).toBeVisible()
    const firstIdempotencyKey = transferClientMock.mock.calls[0]?.[2]
      .idempotencyKey

    fireEvent.click(
      within(transferDialog).getByRole('button', {
        name: 'Перевести клиента',
      }),
    )

    await waitFor(() => expect(transferClientMock).toHaveBeenCalledTimes(2))
    expect(transferClientMock.mock.calls[1]?.[2].idempotencyKey).toBe(
      firstIdempotencyKey,
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Перевод клиента' }),
      ).not.toBeInTheDocument(),
    )
  })

  test('keeps assignment transfer independent from current membership state', async () => {
    const membership = {
      ...buildMembership(),
      behaviorKind: 'SingleVisit' as const,
      expirationDate: null,
      singleVisitUsed: false,
    }
    getClientMock.mockResolvedValue({
      ...buildClientDetails(),
      currentMemberships: [membership],
      hasCurrentMembership: true,
      membershipHistory: [membership],
    })
    setupTransferOptions()

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Перевести' }))

    const dialog = await screen.findByRole('dialog', { name: 'Перевод клиента' })
    expect(within(dialog).queryByText(/перенесено без новой продажи/i)).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('radio', { name: 'По каталожной цене' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('radio', { name: 'Индивидуальная сумма' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('radio', { name: 'Без варианта каталога' })).not.toBeInTheDocument()
  })
})

describe('ClientDetailScreen membership history pricing provenance', () => {
  test('renders actual gross amount and all backend pricing origins', async () => {
    getClientMock.mockResolvedValue(buildClientWithPricingHistory())

    renderClientDetails()

    expect(await screen.findByText('Каталожная цена')).toBeInTheDocument()
    expect(screen.getByText('Индивидуальная сумма')).toBeInTheDocument()
    expect(screen.getAllByText('Без варианта каталога')).not.toHaveLength(0)
    expect(screen.getAllByText('3 000 ₽').length).toBeGreaterThan(0)
    expect(screen.getAllByText('4 100 ₽').length).toBeGreaterThan(0)
    expect(screen.getAllByText('4 200 ₽').length).toBeGreaterThan(0)
  })
})

describe('ClientDetailScreen membership correction form', () => {
  test('keeps catalog type and sale amount read-only', async () => {
    const currentMembership = buildMembership()
    getClientMock.mockResolvedValue({
      ...buildClientDetails(),
      currentMemberships: [currentMembership],
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

  test('sends addressed correction with payment date and preserves draft ProblemDetails errors', async () => {
    const currentMembership = {
      ...buildMembership(),
      purchaseDate: '2026-07-01',
      paymentDate: '2026-07-01',
      validFrom: '2026-07-01',
      expirationDate: '2026-07-31',
    }
    getClientMock.mockResolvedValue({
      ...buildClientDetails(),
      currentMemberships: [currentMembership],
      hasCurrentMembership: true,
      membershipHistory: [currentMembership],
    })
    correctMembershipMock.mockRejectedValue(
      new ApiError('Проверьте исправление абонемента.', 400, {
        ValidFrom: ['Начало срока пересекается с другой продажей.'],
        PaymentDate: ['Дата оплаты не может быть позже текущей даты.'],
      }),
    )

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Исправить' }))

    expect(screen.getByText('Дата покупки')).toBeInTheDocument()
    expect(screen.getAllByText(/июл.*2026|01\.07\.2026/)).not.toHaveLength(0)
    expect(screen.queryByRole('switch', { name: 'Оплачен' })).not.toBeInTheDocument()
    expect(screen.queryByText('Не оплачен')).not.toBeInTheDocument()

    const validFrom = await screen.findByLabelText('Действует с')
    const validTo = screen.getByLabelText('Действует по')
    const paymentDate = await screen.findByLabelText('Дата оплаты')
    expect(paymentDate).toHaveValue('2026-07-01')
    expect(paymentDate).toHaveAttribute('max', '2026-07-23')
    fireEvent.change(validFrom, { target: { value: '2026-07-05' } })
    fireEvent.change(validTo, { target: { value: '2026-08-04' } })
    fireEvent.change(paymentDate, { target: { value: '2026-07-24' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить исправление' }))

    await waitFor(() =>
      expect(correctMembershipMock).toHaveBeenCalledWith(
        'client-1',
        {
          saleId: 'sale-current',
          expectedMembershipId: 'version-current',
          validFrom: '2026-07-05',
          validTo: '2026-08-04',
          paymentDate: '2026-07-24',
          targetGroupIds: ['group-1'],
        },
        { idempotencyKey: expect.any(String) },
      ),
    )
    expect(await screen.findByText('Проверьте исправление абонемента.')).toBeInTheDocument()
    expect(screen.getByText('Начало срока пересекается с другой продажей.')).toBeInTheDocument()
    expect(screen.getByText('Дата оплаты не может быть позже текущей даты.')).toBeInTheDocument()
    expect(validFrom).toHaveValue('2026-07-05')
    expect(validTo).toHaveValue('2026-08-04')
    expect(paymentDate).toHaveValue('2026-07-24')
  })

  test('retries an addressed correction with the same idempotency key after ProblemDetails recovery', async () => {
    const currentMembership = {
      ...buildMembership(),
      purchaseDate: '2026-07-01',
      paymentDate: '2026-07-01',
      validFrom: '2026-07-01',
      expirationDate: '2026-07-31',
    }
    const client = {
      ...buildClientDetails(),
      currentMemberships: [currentMembership],
      hasCurrentMembership: true,
      membershipHistory: [currentMembership],
    }
    getClientMock.mockResolvedValue(client)
    correctMembershipMock
      .mockRejectedValueOnce(
        new ApiError('Проверьте исправление абонемента.', 400, {
          ValidFrom: ['Начало срока пересекается с другой продажей.'],
        }),
      )
      .mockResolvedValueOnce(client)

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Исправить' }))
    const validFrom = await screen.findByLabelText('Действует с')
    fireEvent.change(validFrom, { target: { value: '2026-07-05' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить исправление' }))

    expect(
      await screen.findByText('Начало срока пересекается с другой продажей.'),
    ).toBeVisible()
    expect(validFrom).toHaveValue('2026-07-05')
    const firstIdempotencyKey = correctMembershipMock.mock.calls[0]?.[2]
      .idempotencyKey

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить исправление' }))

    await waitFor(() => expect(correctMembershipMock).toHaveBeenCalledTimes(2))
    expect(correctMembershipMock.mock.calls[1]?.[2].idempotencyKey).toBe(
      firstIdempotencyKey,
    )
    expect(correctMembershipMock.mock.calls[1]?.[1]).toEqual({
      saleId: 'sale-current',
      expectedMembershipId: 'version-current',
      validFrom: '2026-07-05',
      validTo: '2026-07-31',
      paymentDate: '2026-07-01',
      targetGroupIds: ['group-1'],
    })
  })

  test('reloads after payment-date correction without exposing mark-payment', async () => {
    const initialMembership = {
      ...buildMembership(),
      validFrom: '2026-07-01',
      expirationDate: '2026-07-31',
      paymentDate: '2026-07-01',
    }
    const correctedMembership = {
      ...initialMembership,
      id: 'version-after-correction',
      paymentDate: '2026-07-05',
    }
    const initialClient = {
      ...buildClientDetails(),
      currentMemberships: [initialMembership],
      hasCurrentMembership: true,
      membershipHistory: [initialMembership],
    }
    const correctedClient = {
      ...initialClient,
      currentMemberships: [correctedMembership],
      membershipHistory: [correctedMembership, initialMembership],
    }
    getClientMock
      .mockResolvedValueOnce(initialClient)
      .mockResolvedValueOnce(correctedClient)
    correctMembershipMock.mockResolvedValue(initialClient)

    renderClientDetails()
    fireEvent.click(await screen.findByRole('button', { name: 'Исправить' }))
    fireEvent.change(await screen.findByLabelText('Дата оплаты'), {
      target: { value: '2026-07-05' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить исправление' }))

    await waitFor(() => expect(getClientMock).toHaveBeenCalledTimes(2))
    expect(correctMembershipMock).toHaveBeenCalledWith('client-1', {
      saleId: 'sale-current',
      expectedMembershipId: 'version-current',
      validFrom: '2026-07-01',
      validTo: '2026-07-31',
      paymentDate: '2026-07-05',
      targetGroupIds: ['group-1'],
    }, { idempotencyKey: expect.any(String) })
    expect(screen.queryByRole('button', { name: 'Отметить оплату' })).not.toBeInTheDocument()
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

function buildClientDetails(overrides: Partial<ClientDetails> = {}): ClientDetails {
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
    birthDate: null,
    businessDate: '2026-07-23',
    isProfessional: false,
    professionalComment: null,
    hasActiveMembership: false,
    membershipWarning: false,
    currentMemberships: [],
    hasCurrentMembership: false,
    membershipState: 'None',
    actionHints: [],
    membershipHistory: [],
    attendanceHistory: [],
    attendanceHistoryLoaded: false,
    attendanceHistoryTotalCount: null,
    ...overrides,
  }
}

function buildClientWithMemberships(): ClientDetails {
  const client = buildClientDetails()
  const common = { membershipCatalogItemId: 'catalog-1', membershipName: 'Месяц', behaviorKind: 'Term' as const, purchaseDate: '2026-07-01', paymentDate: '2026-07-01', paymentRecordedAt: '2026-07-01T08:00:00Z', paymentRecordedByUserId: 'user-1', paymentRecordedByUserName: 'Анна Петрова', expirationDate: '2026-08-01', pricingMode: 'Catalog' as const, grossAmount: 3000, catalogPrice: 3000, singleVisitUsed: false, coverageKind: 'TargetGroups' as const, entitlementState: 'Active' as const, targetGroups: [buildMembershipTargetGroup()], commentLastChangedByName: 'Анна Петрова', commentLastChangedAt: '2026-07-21T12:34:56Z' }
  return {
    ...client,
    membershipHistory: [
      { ...common, id: 'version-2', saleId: 'sale-1', changeReason: 'Correction', comment: 'Комментарий первой покупки' },
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
    paymentDate: '2026-07-21',
    paymentRecordedAt: '2026-07-21T08:00:00Z',
    paymentRecordedByUserId: 'user-1',
    paymentRecordedByUserName: 'Анна Петрова',
    expirationDate: '2026-08-20',
    pricingMode: 'Catalog' as const,
    grossAmount: 3000,
    catalogPrice: 3000,
    singleVisitUsed: false,
    coverageKind: 'TargetGroups' as const,
    entitlementState: 'Active' as const,
    targetGroups: [buildMembershipTargetGroup()],
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

function setupClientFormOptions() {
  getBranchesMock.mockResolvedValue([
    {
      id: 'branch-1',
      name: 'Основной',
      address: null,
      description: null,
      isArchived: false,
      hallCount: 0,
      groupCount: 0,
      clientCount: 0,
    },
  ])
  getGroupsMock.mockResolvedValue({
    items: [],
    totalCount: 0,
    skip: 0,
    take: 100,
  })
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

async function selectMembershipTargetGroup() {
  fireEvent.click(await screen.findByRole('combobox', { name: 'Добавить группу' }))
  fireEvent.click(await screen.findByRole('option', { name: /Утренняя группа/ }))
}

function buildGroupsPage() {
  return {
    items: [buildTrainingGroup()],
    totalCount: 1,
    skip: 0,
    take: 100,
  }
}

function buildTrainingGroup() {
  return {
    id: 'group-1',
    name: 'Утренняя группа',
    branchId: 'branch-1',
    branchName: 'Основной',
    hallId: 'hall-1',
    hallName: 'Зал 1',
    groupTypeId: 'group-type-1',
    groupTypeName: 'Взрослые',
    trainingStartTime: '09:00',
    durationMinutes: 60,
    weekdays: [1, 3, 5],
    isActive: true,
    trainers: [],
    trainerIds: [],
    trainerCount: 0,
    trainerNames: [],
    clientCount: 0,
  }
}

function buildMembershipTargetGroup() {
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
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })

  return { promise, resolve }
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
    paymentDate: '2026-07-22',
    paymentRecordedAt: '2026-07-22T08:00:00Z',
    paymentRecordedByUserId: 'user-1',
    paymentRecordedByUserName: 'Анна Петрова',
    expirationDate: '2026-08-20',
    singleVisitUsed: false,
    coverageKind: 'TargetGroups' as const,
    entitlementState: 'Active' as const,
    targetGroups: [buildMembershipTargetGroup()],
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
