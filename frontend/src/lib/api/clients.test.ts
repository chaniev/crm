import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  correctClientMembership,
  getClient,
  getClientAttentionItems,
  getClients,
  getMembershipAttentionItems,
  getMembershipExpirationSuggestion,
  updateClientMembershipComment,
} from './clients'

describe('correctClientMembership', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('sends only fields supported by the correction contract', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'c-1', fullName: 'Иван Иванов' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const legacyFormPayload = {
      saleId: 'sale-1',
      expectedMembershipId: 'membership-1',
      validFrom: '2026-07-21',
      validTo: '2026-08-20',
      paymentDate: '2026-07-10',
      paymentAmount: 6000,
      purchaseDate: '2026-07-01',
      isPaid: true,
      singleVisitUsed: false,
    }

    await correctClientMembership(
      'c-1',
      legacyFormPayload,
      { idempotencyKey: 'membership-key-correction' },
    )

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/clients/c-1/membership/correct',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          SaleId: 'sale-1',
          ExpectedMembershipId: 'membership-1',
          ValidFrom: '2026-07-21',
          ValidTo: '2026-08-20',
          PaymentDate: '2026-07-10',
        }),
      }),
    )
    const init = fetchMock.mock.calls.at(-1)?.[1] as RequestInit
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe(
      'membership-key-correction',
    )
  })
})

describe('updateClientMembershipComment', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('sends only the comment to the client and stable sale URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'c-1', fullName: 'Иван Иванов' }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await updateClientMembershipComment('c-1', 'sale-1', '  Важный комментарий  ')

    expect(fetchMock).toHaveBeenCalledWith('/api/clients/c-1/membership/sales/sale-1/comment', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ comment: '  Важный комментарий  ' }) }))
  })
})

describe('getClient note attribution', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('maps the public author name and timestamp without looking for technical identity', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'c-1',
      fullName: 'Иван Иванов',
      notes: 'Позвонить вечером',
      notesLastChangedByName: 'Анна Петрова',
      notesLastChangedAt: '2026-07-21T12:34:56Z',
      notesChangedByUserId: 'must-not-be-consumed',
      notesChangedByLogin: 'must-not-be-consumed',
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    const client = await getClient('c-1')

    expect(client.notesLastChangedByName).toBe('Анна Петрова')
    expect(client.notesLastChangedAt).toBe('2026-07-21T12:34:56Z')
    expect(client).not.toHaveProperty('notesChangedByUserId')
    expect(client).not.toHaveProperty('notesChangedByLogin')
  })

  test.each([
    [{ notesLastChangedByName: 'Анна Петрова' }],
    [{ notesLastChangedAt: '2026-07-21T12:34:56Z' }],
    [{}],
  ])('normalizes absent or partial attribution to a null pair', async (metadata) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'c-legacy', fullName: 'Легаси Клиент', notes: 'Старая заметка', ...metadata,
    }), { status: 200, headers: { 'content-type': 'application/json' } })))

    const client = await getClient('c-legacy')
    expect([client.notesLastChangedByName, client.notesLastChangedAt]).toEqual([null, null])
  })
})

describe('getClient birth date contract', () => {
  afterEach(() => vi.unstubAllGlobals())

  test.each([
    ['2000-02-29', '2026-07-23'],
    [null, '0001-01-01'],
  ])(
    'maps exact nullable birthDate and required businessDate: %s / %s',
    async (birthDate, businessDate) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              id: 'c-1',
              fullName: 'Иван Иванов',
              birthDate,
              businessDate,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        ),
      )

      const client = await getClient('c-1')

      expect(client.birthDate).toBe(birthDate)
      expect(client.businessDate).toBe(businessDate)
    },
  )
})

describe('status-free membership read contract', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('maps client details from active membership fields without deriving paid state', async () => {
    const membership = {
      id: 'version-1',
      saleId: 'sale-1',
      membershipCatalogItemId: 'catalog-1',
      membershipName: 'Месяц',
      behaviorKind: 'Term',
      purchaseDate: '2026-07-23',
      paymentDate: '2026-07-10',
      paymentRecordedByUserId: 'user-1',
      paymentRecordedByUserName: 'Анна Петрова',
      paymentRecordedAt: '2026-07-23T09:30:00Z',
      expirationDate: '2026-08-22',
      pricingMode: 'Catalog',
      grossAmount: 3000,
      catalogPrice: 3000,
      singleVisitUsed: false,
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: 'c-1',
            fullName: 'Иван Иванов',
            branchId: 'branch-1',
            branchName: 'Основной',
            status: 'Active',
            businessDate: '2026-07-23',
            hasActiveMembership: true,
            hasCurrentMembership: true,
            membershipState: 'Active',
            currentMembership: membership,
            membershipHistory: [membership],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    )

    const client = await getClient('c-1')
    const currentMembership = client.currentMembership as unknown as Record<string, unknown>

    expect(client).toMatchObject({
      hasActiveMembership: true,
      membershipState: 'Active',
    })
    expect(client).not.toHaveProperty('hasActivePaidMembership')
    expect(client).not.toHaveProperty('hasUnpaidCurrentMembership')
    expect(currentMembership).toMatchObject({
      paymentDate: '2026-07-10',
      paymentRecordedByUserId: 'user-1',
      paymentRecordedByUserName: 'Анна Петрова',
      paymentRecordedAt: '2026-07-23T09:30:00Z',
    })
    expect(currentMembership).not.toHaveProperty('isPaid')
    expect(currentMembership).not.toHaveProperty('paidAt')
  })

  test('does not send removed paid/unpaid filters when querying clients', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [], totalCount: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await getClients({
      paymentStatus: 'Paid',
      hasActivePaidMembership: true,
      membershipState: 'Unpaid',
    } as unknown as Parameters<typeof getClients>[0])

    const requestedUrl = String(fetchMock.mock.calls[0]?.[0])
    expect(requestedUrl).not.toContain('paymentStatus')
    expect(requestedUrl).not.toContain('hasActivePaidMembership')
    expect(requestedUrl).not.toContain('Unpaid')
  })
})

describe('getClientAttentionItems', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('maps status-free backend reasons and nullable contacts without deriving payment semantics', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ clientId: 'c-1', fullName: 'Иван Иванов', phone: null, notes: null, membership: { behaviorKind: 'Term', membershipName: 'Месяц', expirationDate: '2026-07-22', daysUntilExpiration: 2 }, telegramLink: 'https://t.me/ivan', reasons: [{ type: 'missedTraining', missedCount: 4 }] }]), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getClientAttentionItems()).resolves.toEqual([{ clientId: 'c-1', fullName: 'Иван Иванов', phone: null, notes: null, membership: { behaviorKind: 'Term', membershipName: 'Месяц', expirationDate: '2026-07-22', daysUntilExpiration: 2 }, telegramLink: 'https://t.me/ivan', reasons: [{ type: 'missedTraining', missedCount: 4 }] }])
    expect(fetchMock).toHaveBeenCalledWith('/api/clients/attention', expect.any(Object))
  })
})

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
            behaviorKind: 'Term',
            expirationDate: '2026-05-03',
            daysUntilExpiration: -3,
            state: 'Expired',
          },
          {
            clientId: 'client-unknown',
            fullName: 'Ольга Смирнова',
            behaviorKind: 'SingleVisit',
            expirationDate: null,
            daysUntilExpiration: null,
            state: 'Paused',
          },
          {
            clientId: 'client-missing-state',
            fullName: 'Иван Иванов',
            behaviorKind: 'Professional',
            expirationDate: null,
            daysUntilExpiration: null,
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
        behaviorKind: 'Term',
        expirationDate: '2026-05-03',
        daysUntilExpiration: -3,
        state: 'Expired',
      },
      {
        clientId: 'client-unknown',
        fullName: 'Ольга Смирнова',
        behaviorKind: 'SingleVisit',
        expirationDate: null,
        daysUntilExpiration: null,
        state: 'Unknown',
      },
      {
        clientId: 'client-missing-state',
        fullName: 'Иван Иванов',
        behaviorKind: 'Professional',
        expirationDate: null,
        daysUntilExpiration: null,
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
          behaviorKind: 'Term',
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
      getMembershipExpirationSuggestion('Term', '2026-06-10'),
    ).resolves.toEqual({
      behaviorKind: 'Term',
      startDate: '2026-06-10',
      expirationDate: '2026-07-09',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/clients/membership/expiration-suggestion?behaviorKind=Term&startDate=2026-06-10',
      expect.any(Object),
    )
  })
})
