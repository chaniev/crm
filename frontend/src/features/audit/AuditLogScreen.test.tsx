import { fireEvent, screen, within } from '@testing-library/react'
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
  test('renders audit log grid without removed title and object column', async () => {
    renderWithProviders(<AuditLogScreen user={auditUser} />)

    const grid = await screen.findByTestId('audit-log-grid')
    const actorCell = within(grid).getByTestId('audit-log-actor-cell')

    expect(screen.getByTestId('audit-filter-panel')).toHaveClass(
      'compact-filter-panel',
      'crm-filter-surface',
    )
    expect(grid).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Записи журнала' }),
    ).not.toBeInTheDocument()
    expect(
      within(grid).queryByRole('columnheader', { name: 'Объект' }),
    ).not.toBeInTheDocument()
    expect(within(grid).queryByText('Объект')).not.toBeInTheDocument()
    expect(within(grid).queryByText('Клиент')).not.toBeInTheDocument()
    expect(within(grid).getByText('Создан новый клиент')).toBeVisible()
    expect(actorCell).toHaveTextContent('Мария Иванова')
    expect(actorCell).toHaveTextContent('m.ivanova')
    expect(
      within(grid).getByRole('button', {
        name: 'Показать детали записи: Создан новый клиент',
      }),
    ).toBeVisible()
  })

  test('opens old and new JSON values from row details action', async () => {
    renderWithProviders(<AuditLogScreen user={auditUser} />)

    await screen.findByTestId('audit-log-grid')
    fireEvent.click(screen.getByTestId('audit-log-details-action'))

    const modal = await screen.findByTestId('audit-log-details-modal')

    expect(within(modal).getByText('Старые значения')).toBeInTheDocument()
    expect(within(modal).getByText('Новые значения')).toBeInTheDocument()
    expect(modal).toHaveTextContent('Клиент')
    expect(modal).toHaveTextContent('Web')
    expect(modal).toHaveTextContent('ID объекта: client-1')
    expect(modal).toHaveTextContent('"status": "Draft"')
    expect(modal).toHaveTextContent('"status": "Active"')
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

    expect(await screen.findByText('Под выбранные фильтры записей нет.')).toBeVisible()
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
