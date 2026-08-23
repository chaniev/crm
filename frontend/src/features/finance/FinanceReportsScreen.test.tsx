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
  landingScreen: 'Attention',
  allowedSections: [
    'Attendance',
    'Attention',
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
  attendanceScope: { kind: 'Global', groupIds: [] },
  branchId: null,
}

const deniedUser: AuthenticatedUser = {
  ...financeUser,
  allowedSections: ['Attendance', 'Clients'],
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
    expect(screen.getByTestId('finance-filter-panel')).toHaveClass(
      'compact-filter-panel',
      'crm-filter-surface',
    )

    fireEvent.click(screen.getByRole('radio', { name: 'Период' }))
    await waitFor(() =>
      expect(getFinancialReportMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          periodPreset: 'custom',
        }),
        expect.anything(),
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: /Ещё фильтры/i }))
    fireEvent.change(await screen.findByLabelText('С'), {
      target: { value: '2026-05-10' },
    })
    fireEvent.change(screen.getByLabelText('По'), {
      target: { value: '2026-05-15' },
    })

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

  test('distinguishes initial loading from empty and success states', async () => {
    const pendingReport = createDeferred<FinancialReportResponse>()
    getFinancialReportMock.mockReturnValueOnce(pendingReport.promise)

    renderWithProviders(<FinanceReportsScreen user={financeUser} />)

    expect(await screen.findByText('Загружаем финансовый отчет...')).toBeVisible()
    expect(screen.getByTestId('finance-scope-header')).toHaveTextContent(
      'Запрос: Месяц, дата',
    )
    expect(screen.queryByTestId('finance-totals')).not.toBeInTheDocument()
    expect(
      screen.queryByText('За выбранный период операций нет.'),
    ).not.toBeInTheDocument()

    pendingReport.resolve(buildReport())

    expect(await screen.findByTestId('finance-totals')).toBeVisible()
    expect(screen.queryByText('Загружаем финансовый отчет...')).not.toBeInTheDocument()
  })

  test('renders a retryable initial error inside the report surface', async () => {
    getFinancialReportMock.mockRejectedValueOnce(new Error('Сеть недоступна.'))

    renderWithProviders(<FinanceReportsScreen user={financeUser} />)

    expect(await screen.findByText('Отчет не загрузился')).toBeVisible()
    expect(screen.getByText('Сеть недоступна.')).toBeVisible()
    expect(screen.queryByTestId('finance-totals')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(await screen.findByTestId('finance-totals')).toBeVisible()
  })

  test('keeps displayed data visible and names the requested scope while refreshing', async () => {
    const pendingRefresh = createDeferred<FinancialReportResponse>()
    getFinancialReportMock
      .mockResolvedValueOnce(buildReport())
      .mockReturnValueOnce(pendingRefresh.promise)

    renderWithProviders(<FinanceReportsScreen user={financeUser} />)

    expect(await screen.findByTestId('finance-totals')).toHaveTextContent(/11\s?000\s?₽/)
    const refreshButton = screen.getByRole('button', { name: 'Обновить' })
    fireEvent.click(refreshButton)

    expect(await screen.findByText(/Обновляем для Филиал: Все филиалы/)).toBeVisible()
    expect(screen.getByTestId('finance-totals')).toHaveTextContent(/11\s?000\s?₽/)
    expect(refreshButton).toBeDisabled()

    pendingRefresh.resolve(
      buildReport({
        totals: {
          soldMembershipCount: 3,
          grossSales: 15_000,
          refundTotal: 1_000,
          netTotal: 14_000,
          newClientsCount: 2,
        },
      }),
    )

    await waitFor(() =>
      expect(screen.getByTestId('finance-totals')).toHaveTextContent(/14\s?000\s?₽/),
    )
  })

  test('renders trusted report scope before compact filters', async () => {
    renderWithProviders(<FinanceReportsScreen user={financeUser} />)

    const scope = await screen.findByTestId('finance-scope-header')
    const filterPanel = screen.getByTestId('finance-filter-panel')

    expect(scope).toHaveTextContent('Отчет: 01.05.2026–31.05.2026')
    expect(scope).toHaveTextContent('Филиал: Все филиалы')
    expect(scope).toHaveTextContent('Тренер: Все тренеры')
    expect(scope.compareDocumentPosition(filterPanel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('resets active filters to the valid initial baseline without dropping anchorDate', async () => {
    renderWithProviders(<FinanceReportsScreen user={financeUser} />)

    await screen.findByTestId('finance-totals')
    const initialAnchorDate = getFinancialReportMock.mock.calls[0]?.[0].anchorDate

    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Филиал' }))
    await selectMantineOption('branch-1')
    await waitFor(() =>
      expect(getFinancialReportMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          branchId: 'branch-1',
        }),
        expect.anything(),
      ),
    )

    fireEvent.click(screen.getByRole('button', {
      name: /Сбросить фильтры финансового отчета|Сбросить/i,
    }))

    await waitFor(() =>
      expect(getFinancialReportMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          anchorDate: initialAnchorDate,
          branchId: undefined,
          periodPreset: 'month',
          trainerId: undefined,
        }),
        expect.anything(),
      ),
    )
  })

  test('renders one empty report state without zero KPI cards or empty breakdown copies', async () => {
    getFinancialReportMock.mockResolvedValueOnce(
      buildReport({
        totals: {
          soldMembershipCount: 0,
          grossSales: 0,
          refundTotal: 0,
          netTotal: 0,
          newClientsCount: 0,
        },
        branchBreakdown: [],
        groupBreakdown: [],
        trainerBreakdown: [],
      }),
    )

    renderWithProviders(<FinanceReportsScreen user={financeUser} />)

    expect(await screen.findByText('За выбранный период операций нет.')).toBeVisible()
    expect(screen.queryByTestId('finance-totals')).not.toBeInTheDocument()
    expect(screen.queryByTestId('finance-branch-breakdown')).not.toBeInTheDocument()
    expect(screen.queryByText('По филиалам нет строк за выбранный период.')).not.toBeInTheDocument()
  })

  test('keeps stale money labeled with the last successful scope after a changed-scope refresh fails', async () => {
    getFinancialReportMock
      .mockResolvedValueOnce(buildReport())
      .mockRejectedValueOnce(new Error('Сеть недоступна.'))

    renderWithProviders(<FinanceReportsScreen user={financeUser} />)

    expect(await screen.findByTestId('finance-totals')).toHaveTextContent(/11\s?000\s?₽/)
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Филиал' }))
    await selectMantineOption('branch-1')

    expect(await screen.findByText('Отчет не обновился')).toBeVisible()
    expect(screen.getByTestId('finance-scope-header')).toHaveTextContent(
      'Филиал: Все филиалы',
    )
    expect(screen.getByText(/Не удалось загрузить отчет для Филиал: Центр/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Повторить обновление' })).toBeVisible()
  })

  test('renders same-scope refresh failure as stale with the backend period', async () => {
    getFinancialReportMock
      .mockResolvedValueOnce(buildReport())
      .mockRejectedValueOnce(new Error('Сеть недоступна.'))

    renderWithProviders(<FinanceReportsScreen user={financeUser} />)

    await screen.findByTestId('finance-totals')
    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }))

    expect(await screen.findByText('Отчет не обновился')).toBeVisible()
    expect(
      screen.getByText(
        'Не удалось обновить отчет. Показаны ранее загруженные данные за 01.05.2026–31.05.2026.',
      ),
    ).toBeVisible()
    expect(screen.getByText('Сеть недоступна.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Повторить обновление' })).toBeVisible()
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
    expect(screen.queryByRole('button', { name: /Повторить/ })).not.toBeInTheDocument()
    expect(screen.queryByTestId('finance-totals')).not.toBeInTheDocument()
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

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })

  return { promise, resolve }
}

async function selectMantineOption(value: string) {
  let option: HTMLElement | undefined

  await waitFor(() => {
    option = Array.from(
      document.querySelectorAll<HTMLElement>(`[role="option"][value="${value}"]`),
    ).at(-1)
    expect(option).toBeDefined()
  })

  fireEvent.click(option!)
}
