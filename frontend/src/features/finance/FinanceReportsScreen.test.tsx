import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  ApiError,
  getBranches,
  getFinancialReport,
  getTrainerOptions,
  type AuthenticatedUser,
  type FinancialReportResponse,
} from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import { FinanceReportsScreen } from './FinanceReportsScreen'

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>()

  return {
    ...actual,
    getBranches: vi.fn(),
    getFinancialReport: vi.fn(),
    getTrainerOptions: vi.fn(),
  }
})

const financeUser: AuthenticatedUser = {
  id: 'headcoach-id',
  fullName: 'Главный тренер',
  login: 'headcoach',
  role: 'HeadCoach',
  mustChangePassword: false,
  isActive: true,
  landingScreen: 'Home',
  allowedSections: [
    'Home',
    'Attendance',
    'Clients',
    'Groups',
    'Users',
    'Audit',
    'Finance',
    'Settings',
  ],
  permissions: {
    canManageUsers: true,
    canManageClients: true,
    canManageGroups: true,
    canManageSettings: true,
    canMarkAttendance: true,
    canViewAuditLog: true,
    canViewFinancialReports: true,
  },
  assignedGroupIds: [],
}

const deniedUser: AuthenticatedUser = {
  ...financeUser,
  allowedSections: ['Home', 'Clients'],
  permissions: {
    ...financeUser.permissions,
    canViewFinancialReports: false,
  },
}

const getBranchesMock = vi.mocked(getBranches)
const getFinancialReportMock = vi.mocked(getFinancialReport)
const getTrainerOptionsMock = vi.mocked(getTrainerOptions)

beforeEach(() => {
  getBranchesMock.mockReset()
  getFinancialReportMock.mockReset()
  getTrainerOptionsMock.mockReset()

  getBranchesMock.mockResolvedValue([
    {
      id: 'branch-1',
      name: 'Центр',
      address: null,
      description: null,
      isArchived: false,
      hallCount: 1,
      groupCount: 2,
      clientCount: 10,
    },
  ])
  getTrainerOptionsMock.mockResolvedValue([
    {
      id: 'trainer-1',
      fullName: 'Ирина Тренер',
      login: 'irina',
    },
  ])
  getFinancialReportMock.mockResolvedValue(buildReport())
})

describe('FinanceReportsScreen', () => {
  test('renders backend totals without recomputing them from breakdown rows', async () => {
    getFinancialReportMock.mockResolvedValueOnce(
      buildReport({
        totals: {
          soldMembershipCount: 1,
          grossSales: 10_000,
          refundTotal: 3_000,
          netTotal: 7_777,
          newClientsCount: 1,
        },
        groupBreakdown: [
          {
            groupId: 'group-1',
            groupName: 'Группа A',
            branchId: 'branch-1',
            branchName: 'Центр',
            soldMembershipCount: 1,
            grossSales: 10_000,
            refundTotal: 0,
            netTotal: 10_000,
            newClientsCount: 1,
          },
          {
            groupId: 'group-1',
            groupName: 'Группа A',
            branchId: 'branch-1',
            branchName: 'Центр',
            soldMembershipCount: 1,
            grossSales: 10_000,
            refundTotal: 0,
            netTotal: 10_000,
            newClientsCount: 1,
          },
        ],
      }),
    )

    renderWithProviders(<FinanceReportsScreen user={financeUser} />)

    const totals = await screen.findByTestId('finance-totals')

    expect(totals).toHaveTextContent(/7\s?777\s?₽/)
    expect(totals).not.toHaveTextContent(/20\s?000\s?₽/)
    expect(screen.getAllByTestId(/finance-group-row-group-1-/)).toHaveLength(2)
    expect(
      screen.getAllByText(/сумма строк в этих таблицах может быть больше итогов/i),
    ).toHaveLength(2)
  })

  test('sends custom range filters', async () => {
    renderWithProviders(<FinanceReportsScreen user={financeUser} />)

    await screen.findByTestId('finance-totals')

    fireEvent.click(screen.getByRole('button', { name: 'Период' }))
    fireEvent.change(screen.getByLabelText('С'), {
      target: { value: '2026-05-10' },
    })
    fireEvent.change(screen.getByLabelText('По'), {
      target: { value: '2026-05-15' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Показать' }))

    await waitFor(() =>
      expect(getFinancialReportMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          periodPreset: 'custom',
          from: '2026-05-10',
          to: '2026-05-15',
        }),
        expect.anything(),
      ),
    )
  })

  test('shows backend ProblemDetails field errors near filters', async () => {
    getFinancialReportMock.mockRejectedValueOnce(
      new ApiError('Фильтры отчета некорректны.', 400, {
        anchorDate: ['Дата в периоде обязательна.'],
      }),
    )

    renderWithProviders(<FinanceReportsScreen user={financeUser} />)

    expect(await screen.findByText('Проверьте фильтры')).toBeVisible()
    expect(screen.getByText('Дата в периоде обязательна.')).toBeVisible()
  })

  test('does not load report when backend session does not grant finance access', () => {
    renderWithProviders(<FinanceReportsScreen user={deniedUser} />)

    expect(screen.getByText('Финансовые отчеты недоступны')).toBeVisible()
    expect(getFinancialReportMock).not.toHaveBeenCalled()
    expect(getBranchesMock).not.toHaveBeenCalled()
    expect(getTrainerOptionsMock).not.toHaveBeenCalled()
  })
})

function buildReport(
  overrides: Partial<FinancialReportResponse> = {},
): FinancialReportResponse {
  return {
    period: {
      preset: 'month',
      anchorDate: '2026-05-14',
      from: '2026-05-01',
      to: '2026-05-31',
    },
    totals: {
      soldMembershipCount: 2,
      grossSales: 12_000,
      refundTotal: 1_000,
      netTotal: 11_000,
      newClientsCount: 1,
    },
    branchBreakdown: [
      {
        branchId: 'branch-1',
        branchName: 'Центр',
        soldMembershipCount: 2,
        grossSales: 12_000,
        refundTotal: 1_000,
        netTotal: 11_000,
        newClientsCount: 1,
      },
    ],
    groupBreakdown: [
      {
        groupId: 'group-1',
        groupName: 'Группа A',
        branchId: 'branch-1',
        branchName: 'Центр',
        soldMembershipCount: 2,
        grossSales: 12_000,
        refundTotal: 1_000,
        netTotal: 11_000,
        newClientsCount: 1,
      },
    ],
    trainerBreakdown: [
      {
        trainerId: 'trainer-1',
        trainerName: 'Ирина Тренер',
        soldMembershipCount: 2,
        grossSales: 12_000,
        refundTotal: 1_000,
        netTotal: 11_000,
        newClientsCount: 1,
      },
    ],
    ...overrides,
  }
}
