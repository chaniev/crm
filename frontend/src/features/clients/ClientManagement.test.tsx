import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  getClient,
  getEligibleMembershipCatalogItems,
  type ClientDetails,
} from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import { ClientDetailScreen } from './ClientManagement'

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>()

  return {
    ...actual,
    getClient: vi.fn(),
    getEligibleMembershipCatalogItems: vi.fn(),
  }
})

const getClientMock = vi.mocked(getClient)
const getEligibleItemsMock = vi.mocked(getEligibleMembershipCatalogItems)

beforeEach(() => {
  getClientMock.mockReset()
  getEligibleItemsMock.mockReset()
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
