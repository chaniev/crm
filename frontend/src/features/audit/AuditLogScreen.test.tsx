import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  getAuditLogEntries,
  getAuditLogFilterOptions,
  type AuditLogEntry,
  type AuditLogFilterOptions,
  type AuditLogListResponse,
  type AuthenticatedUser,
} from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import { AuditLogScreen } from './AuditLogScreen'

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>()

  return {
    ...actual,
    getAuditLogEntries: vi.fn(),
    getAuditLogFilterOptions: vi.fn(),
  }
})

const auditUser: AuthenticatedUser = {
  id: 'headcoach-id',
  fullName: 'Главный тренер',
  login: 'headcoach',
  role: 'HeadCoach',
  mustChangePassword: false,
  isActive: true,
  landingScreen: 'Audit',
  allowedSections: ['Home', 'Clients', 'Audit', 'Settings'],
  permissions: {
    canManageUsers: true,
    canManageClients: true,
    canManageGroups: true,
    canManageSettings: true,
    canMarkAttendance: true,
    canViewAuditLog: true,
    canViewFinancialReports: false,
  },
  assignedGroupIds: [],
  attendanceScope: { kind: 'Global', groupIds: [] },
  branchId: null,
}

const deniedUser: AuthenticatedUser = {
  ...auditUser,
  allowedSections: ['Home', 'Clients'],
  permissions: {
    ...auditUser.permissions,
    canViewAuditLog: false,
  },
}

const getAuditLogEntriesMock = vi.mocked(getAuditLogEntries)
const getAuditLogFilterOptionsMock = vi.mocked(getAuditLogFilterOptions)

beforeEach(() => {
  getAuditLogEntriesMock.mockReset()
  getAuditLogFilterOptionsMock.mockReset()

  getAuditLogFilterOptionsMock.mockResolvedValue(buildFilterOptions())
  getAuditLogEntriesMock.mockResolvedValue(buildAuditResponse())
})

describe('AuditLogScreen', () => {
  test('renders exactly four audit list columns without object or action', async () => {
    renderWithProviders(<AuditLogScreen user={auditUser} />)

    const grid = await screen.findByTestId('audit-log-grid')
    const header = within(grid).getAllByRole('row')[0]
    const dataRow = within(grid).getAllByRole('row')[1]
    const actorCell = within(grid).getByTestId('audit-log-actor-cell')

    expect(screen.getByTestId('audit-filter-panel')).toHaveClass(
      'compact-filter-panel',
      'crm-filter-surface',
    )
    expect(grid).toBeVisible()
    expect(within(header).getAllByRole('columnheader')).toHaveLength(4)
    expect(within(dataRow).getAllByRole('cell')).toHaveLength(4)
    expect(
      screen.queryByRole('heading', { name: 'Записи журнала' }),
    ).not.toBeInTheDocument()
    expect(
      within(grid).queryByRole('columnheader', { name: 'Объект' }),
    ).not.toBeInTheDocument()
    expect(within(grid).queryByText('Объект')).not.toBeInTheDocument()
    expect(
      within(grid).queryByRole('columnheader', { name: 'Действие' }),
    ).not.toBeInTheDocument()
    expect(within(grid).getByRole('columnheader', { name: 'Дата' })).toBeVisible()
    expect(within(grid).getByRole('columnheader', { name: 'Описание' })).toBeVisible()
    expect(within(grid).getByRole('columnheader', { name: 'Пользователь' })).toBeVisible()
    expect(within(grid).getByRole('columnheader', { name: 'Детали' })).toBeVisible()
    expect(within(grid).getByText('Создан новый клиент')).toBeVisible()
    expect(actorCell).toHaveTextContent('Мария Иванова')
    expect(actorCell).toHaveTextContent('m.ivanova')
    expect(
      within(grid).getByRole('button', {
        name: 'Показать подробности записи: Создан новый клиент',
      }),
    ).toBeVisible()
  })

  test('opens old and new JSON values from row details action', async () => {
    renderWithProviders(<AuditLogScreen user={auditUser} />)

    await screen.findByTestId('audit-log-grid')
    const detailsTrigger = screen.getByTestId('audit-log-details-action')
    detailsTrigger.focus()
    fireEvent.click(detailsTrigger)

    const modal = await screen.findByTestId('audit-log-details-modal')

    expect(modal).toHaveTextContent('Создание клиента')
    expect(within(modal).getByText('Старые значения')).toBeInTheDocument()
    expect(within(modal).getByText('Новые значения')).toBeInTheDocument()
    expect(modal).toHaveTextContent('Клиент')
    expect(modal).toHaveTextContent('Web')
    expect(modal).toHaveTextContent('ID объекта: client-1')
    expect(modal).toHaveTextContent('"status": "Draft"')
    expect(modal).toHaveTextContent('"status": "Active"')

    const dialog = screen.getByRole('dialog', {
      name: 'Подробности записи журнала',
    })
    fireEvent.click(within(dialog).getByRole('button'))
    await waitFor(() => expect(modal).not.toBeInTheDocument())
    await waitFor(() => expect(detailsTrigger).toHaveFocus())
  })

  test('exposes the compact four-cell decision data and context exactly once', async () => {
    const entry = buildAuditEntry()
    const originalEntry = structuredClone(entry)
    getAuditLogEntriesMock.mockResolvedValueOnce(buildAuditResponse({ items: [entry] }))

    renderWithProviders(<AuditLogScreen user={auditUser} />)

    const grid = await screen.findByTestId('audit-log-grid')
    const dataRow = within(grid).getAllByRole('row')[1]
    const cells = within(dataRow).getAllByRole('cell')
    const descriptionCell = cells[1]
    const visualContext = dataRow.querySelector('.audit-log-context')
    const expectedDate = new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(entry.createdAt))
    const expectedTime = new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(entry.createdAt))

    expect(cells).toHaveLength(4)
    expect(dataRow).toHaveTextContent(expectedDate)
    expect(dataRow).toHaveTextContent(expectedTime)
    expect(dataRow).toHaveTextContent(entry.description)
    expect(dataRow).toHaveTextContent('Создание клиента')
    expect(dataRow).toHaveTextContent('Клиент')
    expect(dataRow).toHaveTextContent('client-1')
    expect(dataRow).toHaveTextContent('Web')
    expect(dataRow).toHaveTextContent('Telegram')
    expect(dataRow).toHaveTextContent('Мария Иванова')
    expect(dataRow).toHaveTextContent('m.ivanova')
    expect(visualContext).toHaveAttribute('aria-hidden', 'true')
    expect(descriptionCell).toHaveAccessibleName(/Описание: Создан новый клиент/)
    expect(descriptionCell).toHaveAccessibleName(/Действие: Создание клиента/)
    expect(descriptionCell).toHaveAccessibleName(/Объект: Клиент/)
    expect(descriptionCell).toHaveAccessibleName(/ID объекта: client-1/)
    expect(descriptionCell).toHaveAccessibleName(/Источник: Web/)
    expect(descriptionCell).toHaveAccessibleName(/Мессенджер: Telegram/)
    expect(descriptionCell.getAttribute('aria-label')?.match(/Создание клиента/g)).toHaveLength(1)
    expect(within(dataRow).queryByText('Дата', { selector: '.audit-log-cell__label' })).not.toBeInTheDocument()
    expect(within(dataRow).queryByText('Описание', { selector: '.audit-log-cell__label' })).not.toBeInTheDocument()
    expect(within(dataRow).queryByText('Пользователь', { selector: '.audit-log-cell__label' })).not.toBeInTheDocument()
    expect(entry).toEqual(originalEntry)
  })

  test('keeps exact long descriptions and exposes neutral/raw technical fallback', async () => {
    const longDescription =
      'Membership sync completed for the client while preserving every backend-provided diagnostic token without rewriting the description'
    const entries = [
      buildAuditEntry({ id: 'audit-long', description: longDescription }),
      buildAuditEntry({
        id: 'audit-unknown',
        description: '',
        actionType: 'ClientMerged',
        entityType: 'ExternalProspect',
        entityId: 'external-42',
      }),
    ]
    const originalEntries = structuredClone(entries)
    getAuditLogEntriesMock.mockResolvedValueOnce(buildAuditResponse({ items: entries }))

    renderWithProviders(<AuditLogScreen user={auditUser} />)

    const grid = await screen.findByTestId('audit-log-grid')
    const rows = within(grid).getAllByRole('row').slice(1)
    const longRow = rows[0]
    const fallbackRow = rows[1]

    expect(fallbackRow).toHaveTextContent('Описание не передано')
    expect(fallbackRow).toHaveTextContent('ClientMerged')
    expect(fallbackRow).toHaveTextContent('ExternalProspect')
    expect(within(fallbackRow).getAllByRole('cell')[1]).toHaveAccessibleName(
      /Тип действия из API: ClientMerged/,
    )
    expect(within(fallbackRow).getAllByRole('cell')[1]).toHaveAccessibleName(
      /Тип объекта из API: ExternalProspect/,
    )
    expect(
      within(fallbackRow).getByRole('button', {
        name: 'Показать подробности записи: Описание не передано',
      }),
    ).toBeVisible()
    expect(within(longRow).getByText(longDescription)).toHaveTextContent(longDescription)
    expect(
      within(longRow).getByRole('button', {
        name: `Показать подробности записи: ${longDescription}`,
      }),
    ).toBeVisible()
    expect(entries).toEqual(originalEntries)
  })

  test('labels known-total pagination and preserves filters and page across refresh', async () => {
    getAuditLogEntriesMock.mockImplementation(async (params) => {
      const requestedPage = params?.page ?? 1
      return buildAuditResponse({
        items: [
          buildAuditEntry({
            id: `audit-page-${requestedPage}`,
            description: `Запись страницы ${requestedPage}`,
          }),
        ],
        totalCount: 45,
        skip: (requestedPage - 1) * 20,
        page: requestedPage,
        hasNextPage: requestedPage < 3,
      })
    })

    renderWithProviders(<AuditLogScreen user={auditUser} />)

    await screen.findByText('Запись страницы 1')
    fireEvent.click(screen.getByRole('combobox', { name: 'Тип действия' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Создание клиента' }))

    const pagination = await screen.findByRole('navigation', {
      name: 'Страницы журнала действий',
    })
    const previous = within(pagination).getByRole('button', {
      name: 'Предыдущая страница журнала',
    })
    const next = within(pagination).getByRole('button', {
      name: 'Следующая страница журнала',
    })

    expect(screen.getByText('Страница 1 из 3', { exact: true })).toBeVisible()
    expect(previous).toBeDisabled()
    expect(previous).not.toHaveAttribute('tabindex', '0')
    expect(next).toBeEnabled()
    expect(
      within(pagination).getByRole('button', { name: 'Страница 1 журнала' }),
    ).toHaveAttribute('aria-current', 'page')

    fireEvent.click(
      within(pagination).getByRole('button', { name: 'Страница 2 журнала' }),
    )
    expect(await screen.findByText('Запись страницы 2')).toBeVisible()
    await waitFor(() =>
      expect(getAuditLogEntriesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ actionType: 'ClientCreated', page: 2 }),
        expect.any(AbortSignal),
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }))
    await waitFor(() =>
      expect(getAuditLogEntriesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ actionType: 'ClientCreated', page: 2 }),
        expect.any(AbortSignal),
      ),
    )
    expect(screen.getByText('Страница 2 из 3', { exact: true })).toBeVisible()
  })

  test('does not invent a final page when total count is unknown', async () => {
    getAuditLogEntriesMock.mockResolvedValueOnce(
      buildAuditResponse({
        totalCount: null,
        hasNextPage: true,
      }),
    )

    renderWithProviders(<AuditLogScreen user={auditUser} />)

    const pagination = await screen.findByRole('navigation', {
      name: 'Страницы журнала действий',
    })
    expect(screen.getByText('Страница 1', { exact: true })).toBeVisible()
    expect(screen.queryByText('Страница 1 из 2', { exact: true })).not.toBeInTheDocument()
    expect(
      within(pagination).getByRole('button', {
        name: 'Следующая страница журнала',
      }),
    ).toBeEnabled()
  })

  test('distinguishes global and filtered empty recovery actions', async () => {
    getAuditLogEntriesMock.mockResolvedValue(
      buildAuditResponse({ items: [], totalCount: 0 }),
    )

    renderWithProviders(<AuditLogScreen user={auditUser} />)

    expect(await screen.findByText('В журнале пока нет записей')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeVisible()

    fireEvent.click(screen.getByRole('combobox', { name: 'Тип действия' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Создание клиента' }))

    expect(await screen.findByText('Под выбранные фильтры записей нет.')).toBeVisible()
    expect(
      screen.getAllByRole('button', { name: 'Сбросить фильтры' }).length,
    ).toBeGreaterThan(0)
  })

  test('retries an initial error without losing the current query', async () => {
    getAuditLogEntriesMock
      .mockRejectedValueOnce(new Error('Backend недоступен'))
      .mockResolvedValueOnce(buildAuditResponse())

    renderWithProviders(<AuditLogScreen user={auditUser} />)

    expect(await screen.findByText('Журнал не загрузился')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(await screen.findByText('Создан новый клиент')).toBeVisible()
    expect(getAuditLogEntriesMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1 }),
      expect.any(AbortSignal),
    )
  })

  test('keeps same-query rows explicitly stale and retries the failed refresh', async () => {
    getAuditLogEntriesMock
      .mockResolvedValueOnce(buildAuditResponse())
      .mockRejectedValueOnce(new Error('Refresh недоступен'))
      .mockResolvedValueOnce(
        buildAuditResponse({
          items: [buildAuditEntry({ description: 'Обновлённая запись' })],
        }),
      )

    renderWithProviders(<AuditLogScreen user={auditUser} />)

    expect(await screen.findByText('Создан новый клиент')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }))

    expect(
      await screen.findByText('Не удалось обновить, показаны предыдущие данные'),
    ).toBeVisible()
    expect(screen.getByText('Создан новый клиент')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByText('Обновлённая запись')).toBeVisible()
  })

  test('never presents rows from another failed page as current data', async () => {
    getAuditLogEntriesMock
      .mockResolvedValueOnce(
        buildAuditResponse({
          items: [buildAuditEntry({ description: 'Только первая страница' })],
          totalCount: 40,
          hasNextPage: true,
        }),
      )
      .mockRejectedValueOnce(new Error('Вторая страница недоступна'))

    renderWithProviders(<AuditLogScreen user={auditUser} />)

    const pagination = await screen.findByRole('navigation', {
      name: 'Страницы журнала действий',
    })
    fireEvent.click(
      within(pagination).getByRole('button', { name: 'Страница 2 журнала' }),
    )

    expect(await screen.findByText('Журнал не загрузился')).toBeVisible()
    expect(screen.queryByText('Только первая страница')).not.toBeInTheDocument()
  })

  test.each([
    ['explicit close', 'button'],
    ['Escape', 'escape'],
    ['overlay', 'overlay'],
  ] as const)('returns focus to the exact trigger after %s without an app focus timer', async (_label, closePath) => {
    getAuditLogEntriesMock.mockResolvedValueOnce(
      buildAuditResponse({
        items: [
          buildAuditEntry({ id: 'audit-first', description: 'Первая запись' }),
          buildAuditEntry({ id: 'audit-second', description: 'Вторая запись' }),
        ],
      }),
    )
    const timerSpy = vi.spyOn(window, 'setTimeout')

    renderWithProviders(<AuditLogScreen user={auditUser} />)

    const triggers = await screen.findAllByTestId('audit-log-details-action')
    const trigger = triggers[1]
    fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog', {
      name: 'Подробности записи журнала',
    })
    const closeButton = within(dialog).getByRole('button', {
      name: 'Закрыть подробности записи',
    })

    await waitFor(() => expect(closeButton).toHaveFocus())

    if (closePath === 'button') {
      fireEvent.click(closeButton)
    } else if (closePath === 'escape') {
      fireEvent.keyDown(document, { key: 'Escape' })
    } else {
      const overlay = document.querySelector<HTMLElement>('.mantine-Modal-overlay')
      expect(overlay).not.toBeNull()
      fireEvent.click(overlay!)
    }

    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
    const hasApplicationFocusTimer = timerSpy.mock.calls.some(
      ([callback, delay]) =>
        delay === 0 &&
        typeof callback === 'function' &&
        callback.toString().includes('detailsTriggerRef'),
    )
    timerSpy.mockRestore()
    expect(hasApplicationFocusTimer).toBe(false)
  })

  test('does not schedule an application-owned delayed focus callback', async () => {
    const timerSpy = vi.spyOn(window, 'setTimeout')

    renderWithProviders(<AuditLogScreen user={auditUser} />)

    const trigger = await screen.findByTestId('audit-log-details-action')
    fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog', {
      name: 'Подробности записи журнала',
    })
    fireEvent.click(dialog.querySelector<HTMLButtonElement>('.mantine-Modal-close')!)

    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    const hasApplicationFocusTimer = timerSpy.mock.calls.some(
      ([callback, delay]) =>
        delay === 0 &&
        typeof callback === 'function' &&
        callback.toString().includes('detailsTriggerRef'),
    )
    timerSpy.mockRestore()
    expect(hasApplicationFocusTimer).toBe(false)
  })

  test('keeps the action type filter wired to the existing API query', async () => {
    renderWithProviders(<AuditLogScreen user={auditUser} />)

    await screen.findByTestId('audit-log-grid')
    fireEvent.click(screen.getByRole('combobox', { name: 'Тип действия' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Создание клиента' }))

    await waitFor(() =>
      expect(getAuditLogEntriesMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ actionType: 'ClientCreated' }),
        expect.any(AbortSignal),
      ),
    )
  })

  test('does not load audit data when user cannot view audit log', () => {
    renderWithProviders(<AuditLogScreen user={deniedUser} />)

    expect(screen.getByText('Журнал действий недоступен')).toBeVisible()
    expect(getAuditLogEntriesMock).not.toHaveBeenCalled()
    expect(getAuditLogFilterOptionsMock).not.toHaveBeenCalled()
  })

  test('keeps empty state reachable', async () => {
    getAuditLogEntriesMock.mockResolvedValueOnce(
      buildAuditResponse({
        items: [],
        totalCount: 0,
      }),
    )

    renderWithProviders(<AuditLogScreen user={auditUser} />)

    expect(await screen.findByText('В журнале пока нет записей')).toBeVisible()
    expect(screen.queryByTestId('audit-log-grid')).not.toBeInTheDocument()
  })

  test('keeps error state reachable', async () => {
    getAuditLogEntriesMock.mockRejectedValueOnce(new Error('Backend недоступен'))

    renderWithProviders(<AuditLogScreen user={auditUser} />)

    expect(await screen.findByText('Журнал не загрузился')).toBeVisible()
    expect(screen.getByText('Backend недоступен')).toBeVisible()
  })
})

function buildFilterOptions(
  overrides: Partial<AuditLogFilterOptions> = {},
): AuditLogFilterOptions {
  return {
    users: [
      {
        id: 'user-1',
        fullName: 'Мария Иванова',
        login: 'm.ivanova',
        role: 'HeadCoach',
      },
    ],
    actionTypes: ['ClientCreated'],
    entityTypes: ['Client'],
    sources: ['Web'],
    messengerPlatforms: ['Telegram'],
    ...overrides,
  }
}

function buildAuditResponse(
  overrides: Partial<AuditLogListResponse> = {},
): AuditLogListResponse {
  const items = overrides.items ?? [buildAuditEntry()]

  return {
    items,
    totalCount: items.length,
    skip: 0,
    take: 20,
    page: 1,
    pageSize: 20,
    hasNextPage: false,
    ...overrides,
  }
}

function buildAuditEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: 'audit-1',
    userId: 'user-1',
    userName: 'Мария Иванова',
    userLogin: 'm.ivanova',
    userRole: 'HeadCoach',
    source: 'Web',
    messengerPlatform: 'Telegram',
    actionType: 'ClientCreated',
    entityType: 'Client',
    entityId: 'client-1',
    description: 'Создан новый клиент',
    oldValueJson: { status: 'Draft' },
    newValueJson: { status: 'Active' },
    createdAt: '2026-05-14T10:10:10.000Z',
    ...overrides,
  }
}
