import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  getMembershipAttentionItems,
  getMembershipExpirationSuggestion,
} from './clients'

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

describe('getMembershipExpirationSuggestion', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('requests backend-owned inclusive expiration suggestion', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          membershipType: 'Monthly',
          startDate: '2026-06-10',
          expirationDate: '2026-07-09',
        }),
        {
          headers: {
            'content-type': 'application/json; charset=utf-8',
          },
          status: 200,
        },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      getMembershipExpirationSuggestion('Monthly', '2026-06-10'),
    ).resolves.toEqual({
      membershipType: 'Monthly',
      startDate: '2026-06-10',
      expirationDate: '2026-07-09',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/clients/membership/expiration-suggestion?membershipType=Monthly&startDate=2026-06-10',
      expect.any(Object),
    )
  })
})
