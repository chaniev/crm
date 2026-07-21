import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  getClient,
  getClientAttentionItems,
  getMembershipAttentionItems,
  getMembershipExpirationSuggestion,
  updateClientMembershipComment,
} from './clients'

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

describe('getClientAttentionItems', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('maps typed backend reasons and nullable contacts without deriving semantics', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ clientId: 'c-1', fullName: 'Иван Иванов', phone: null, notes: null, membership: { behaviorKind: 'Term', membershipName: 'Месяц', expirationDate: '2026-07-22', daysUntilExpiration: 2, isPaid: false }, telegramLink: 'https://t.me/ivan', reasons: [{ type: 'missedTraining', missedCount: 4 }, { type: 'unpaidMembership' }] }]), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getClientAttentionItems()).resolves.toEqual([{ clientId: 'c-1', fullName: 'Иван Иванов', phone: null, notes: null, membership: { behaviorKind: 'Term', membershipName: 'Месяц', expirationDate: '2026-07-22', daysUntilExpiration: 2, isPaid: false }, telegramLink: 'https://t.me/ivan', reasons: [{ type: 'missedTraining', missedCount: 4 }, { type: 'unpaidMembership' }] }])
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
            isPaid: false,
            state: 'Expired',
          },
          {
            clientId: 'client-unknown',
            fullName: 'Ольга Смирнова',
            behaviorKind: 'SingleVisit',
            expirationDate: null,
            daysUntilExpiration: null,
            isPaid: false,
            state: 'Paused',
          },
          {
            clientId: 'client-missing-state',
            fullName: 'Иван Иванов',
            behaviorKind: 'Professional',
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
        behaviorKind: 'Term',
        expirationDate: '2026-05-03',
        daysUntilExpiration: -3,
        isPaid: false,
        state: 'Expired',
      },
      {
        clientId: 'client-unknown',
        fullName: 'Ольга Смирнова',
        behaviorKind: 'SingleVisit',
        expirationDate: null,
        daysUntilExpiration: null,
        isPaid: false,
        state: 'Unknown',
      },
      {
        clientId: 'client-missing-state',
        fullName: 'Иван Иванов',
        behaviorKind: 'Professional',
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
