import { describe, expect, test } from 'vitest'
import type { ClientDetails } from '../../lib/api'
import { toClientFormValues, toUpsertClientPayload } from './ClientManagement.form'

function buildClient(overrides: Partial<ClientDetails> = {}): ClientDetails {
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
    currentMemberships: [],    hasCurrentMembership: false,
    membershipState: 'None',
    actionHints: [],
    membershipHistory: [],
    attendanceHistory: [],
    attendanceHistoryLoaded: false,
    attendanceHistoryTotalCount: null,
    ...overrides,
  }
}

describe('ClientManagement form birth date mapping', () => {
  test('uses the exact date-only value from details as the form value', () => {
    expect(
      toClientFormValues(buildClient({ birthDate: '2000-02-29' })).birthDate,
    ).toBe('2000-02-29')
    expect(toClientFormValues(buildClient({ birthDate: null })).birthDate).toBe(
      '',
    )
  })

  test('always sends birthDate as a date-only string or explicit null', () => {
    const values = toClientFormValues(buildClient({ birthDate: '2000-02-29' }))

    expect(toUpsertClientPayload(values)).toMatchObject({
      birthDate: '2000-02-29',
    })

    expect(
      toUpsertClientPayload({
        ...values,
        birthDate: '',
      }),
    ).toMatchObject({ birthDate: null })
  })
})
