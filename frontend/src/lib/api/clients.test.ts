import { afterEach, describe, expect, test, vi } from 'vitest'
import { getMembershipAttentionItems } from './clients'

describe('getMembershipAttentionItems', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('maps membership attention state and nullable expiration fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            clientId: 'client-expired',
            fullName: 'Анна Петрова',
            membershipType: 'Monthly',
            expirationDate: '2026-05-03',
            daysUntilExpiration: -3,
            isPaid: false,
            state: 'Expired',
          },
          {
            clientId: 'client-unknown',
            fullName: 'Ольга Смирнова',
            membershipType: 'SingleVisit',
            expirationDate: null,
            daysUntilExpiration: null,
            isPaid: false,
            state: 'Paused',
          },
          {
            clientId: 'client-missing-state',
            fullName: 'Иван Иванов',
            membershipType: 'Yearly',
            expirationDate: null,
            daysUntilExpiration: null,
            isPaid: false,
          },
        ]),
        {
          headers: {
            'content-type': 'application/json; charset=utf-8',
          },
          status: 200,
        },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(getMembershipAttentionItems()).resolves.toEqual([
      {
        clientId: 'client-expired',
        fullName: 'Анна Петрова',
        membershipType: 'Monthly',
        expirationDate: '2026-05-03',
        daysUntilExpiration: -3,
        isPaid: false,
        state: 'Expired',
      },
      {
        clientId: 'client-unknown',
        fullName: 'Ольга Смирнова',
        membershipType: 'SingleVisit',
        expirationDate: null,
        daysUntilExpiration: null,
        isPaid: false,
        state: 'Unknown',
      },
      {
        clientId: 'client-missing-state',
        fullName: 'Иван Иванов',
        membershipType: 'Yearly',
        expirationDate: null,
        daysUntilExpiration: null,
        isPaid: false,
        state: 'Unknown',
      },
    ])

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/clients/expiring-memberships',
      expect.any(Object),
    )
  })
})
