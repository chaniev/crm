import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  getClient,
  getMembershipExpirationSuggestion,
  type ClientDetails,
  type MembershipType,
} from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import { ClientDetailScreen } from './ClientManagement'

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>()

  return {
    ...actual,
    getClient: vi.fn(),
    getMembershipExpirationSuggestion: vi.fn(),
  }
})

const getClientMock = vi.mocked(getClient)
const getMembershipExpirationSuggestionMock = vi.mocked(
  getMembershipExpirationSuggestion,
)

beforeEach(() => {
  getClientMock.mockReset()
  getMembershipExpirationSuggestionMock.mockReset()
})

describe('ClientDetailScreen membership purchase form', () => {
  test('uses backend expiration suggestion for monthly purchase default date', async () => {
    getClientMock.mockResolvedValue(buildClientDetails())
    getMembershipExpirationSuggestionMock.mockImplementation(
      async (membershipType: MembershipType, startDate: string) => ({
        membershipType,
        startDate,
        expirationDate:
          membershipType === 'Monthly' && startDate === '2026-06-10'
            ? '2026-07-09'
            : null,
      }),
    )

    renderWithProviders(
      <ClientDetailScreen
        canManage
        canToggleProfessional
        clientId="client-1"
        onBack={() => undefined}
        onEdit={() => undefined}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Новый абонемент' }))

    const purchaseDateInput = screen.getByLabelText('Дата покупки')
    fireEvent.change(purchaseDateInput, { target: { value: '2026-06-10' } })

    await waitFor(() => {
      expect(screen.getByLabelText('Дата окончания')).toHaveValue('2026-07-09')
    })
    expect(getMembershipExpirationSuggestionMock).toHaveBeenLastCalledWith(
      'Monthly',
      '2026-06-10',
    )
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
