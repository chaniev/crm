import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  getAttendanceGroupClients,
  getAttendanceGroups,
  saveAttendanceMarks,
} from './attendance'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('attendance API', () => {
  test('maps authoritative dates and tri-state roster without boolean coercion', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      groupId: 'group-1',
      trainingDate: '2026-07-11',
      today: '2026-07-12',
      minTrainingDate: '2026-07-10',
      maxTrainingDate: '2026-07-12',
      clients: [
        { id: 'unmarked', fullName: 'Не отмечен', state: 'Unmarked' },
        { id: 'present', fullName: 'Был', state: 'Present' },
        { id: 'absent', fullName: 'Не был', state: 'Absent' },
      ],
    })))

    const response = await getAttendanceGroupClients(
      'group-1',
      '2026-07-11',
    )

    expect(response.today).toBe('2026-07-12')
    expect(response.minTrainingDate).toBe('2026-07-10')
    expect(response.maxTrainingDate).toBe('2026-07-12')
    expect(response.clients.map((client) => client.state)).toEqual([
      'Unmarked',
      'Present',
      'Absent',
    ])
  })

  test('maps status-free active membership eligibility without paid/unpaid fallback flags', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      groupId: 'group-1',
      trainingDate: '2026-07-11',
      today: '2026-07-12',
      minTrainingDate: null,
      maxTrainingDate: '2026-07-12',
      clients: [
        {
          id: 'client-1',
          fullName: 'Иван Иванов',
          state: 'Unmarked',
          hasActiveMembership: true,
          membershipWarning: false,
          currentMemberships: [{
            id: 'membership-1',
            saleId: 'sale-1',
            membershipName: 'Месяц',
            behaviorKind: 'Term',
            purchaseDate: '2026-07-12',
            paymentDate: '2026-07-10',
            expirationDate: '2026-08-11',
            pricingMode: 'Catalog',
            grossAmount: 3000,
            catalogPrice: 3000,
            singleVisitUsed: false,
            coverageKind: 'TargetGroups',
            entitlementState: 'Active',
            targetGroups: [],
          }],
        },
      ],
    })))

    const response = await getAttendanceGroupClients('group-1', '2026-07-11')
    const client = response.clients[0] as unknown as Record<string, unknown>

    expect(client.hasActiveMembership).toBe(true)
    expect(client.membershipWarning).toBe(false)
    expect(client).not.toHaveProperty('hasActivePaidMembership')
    expect(client).not.toHaveProperty('hasUnpaidCurrentMembership')
    const currentMemberships = client.currentMemberships as Array<Record<string, unknown>>
    expect(currentMemberships[0]).not.toHaveProperty('isPaid')
  })

  test('maps groups envelope with backend-owned calendar bounds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      groups: [{ id: 'group-1', name: 'Вечерняя' }],
      today: '2026-07-12',
      minTrainingDate: null,
      maxTrainingDate: '2026-07-12',
    })))

    await expect(getAttendanceGroups()).resolves.toEqual({
      groups: [{ id: 'group-1', name: 'Вечерняя' }],
      today: '2026-07-12',
      minTrainingDate: null,
      maxTrainingDate: '2026-07-12',
    })
  })

  test('posts State and returns the authoritative saved state', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      groupId: 'group-1',
      trainingDate: '2026-07-12',
      today: '2026-07-12',
      minTrainingDate: null,
      maxTrainingDate: '2026-07-12',
      attendanceMarks: [{ clientId: 'client-1', state: 'Absent' }],
    }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(saveAttendanceMarks('group-1', {
      trainingDate: '2026-07-12',
      attendanceMarks: [{ clientId: 'client-1', state: 'Absent' }],
    })).resolves.toMatchObject({
      attendanceMarks: [{ clientId: 'client-1', state: 'Absent' }],
    })

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(String(init.body))).toEqual({
      TrainingDate: '2026-07-12',
      AttendanceMarks: [{ ClientId: 'client-1', State: 'Absent' }],
    })
  })
})

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
