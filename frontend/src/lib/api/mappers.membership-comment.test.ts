import { describe, expect, test } from 'vitest'
import { mapClientMembership } from './mappers'

const baseMembership = {
  id: 'version-1',
  saleId: 'sale-1',
  membershipCatalogItemId: 'catalog-1',
  membershipName: 'Месяц',
  behaviorKind: 'Term',
  purchaseDate: '2026-07-01',
  paymentDate: '2026-07-01',
  paymentRecordedAt: '2026-07-01T08:00:00Z',
  paymentRecordedByUserId: 'user-1',
  paymentRecordedByUserName: 'Анна Петрова',
  pricingMode: 'Catalog',
  grossAmount: 4000,
  catalogPrice: 4000,
}

describe('mapClientMembership sale comment contract', () => {
  test('preserves stable sale identity and complete comment attribution', () => {
    expect(mapClientMembership({ ...baseMembership, comment: 'Позвонить', commentLastChangedByName: 'Анна Петрова', commentLastChangedAt: '2026-07-21T12:34:56Z' })).toMatchObject({
      saleId: 'sale-1', comment: 'Позвонить', commentLastChangedByName: 'Анна Петрова', commentLastChangedAt: '2026-07-21T12:34:56Z',
    })
  })

  test.each([
    { commentLastChangedByName: 'Анна Петрова' },
    { commentLastChangedAt: '2026-07-21T12:34:56Z' },
    {},
  ])('normalizes partial or absent attribution to a null pair', (metadata) => {
    const result = mapClientMembership({ ...baseMembership, ...metadata })
    expect([result?.commentLastChangedByName, result?.commentLastChangedAt]).toEqual([null, null])
  })

  test('keeps distinct sales independent while projecting one comment across technical versions', () => {
    const payloads = [
      {
        ...baseMembership,
        id: 'sale-a-version-1',
        saleId: 'sale-a',
        comment: 'Комментарий A',
        commentLastChangedByName: 'Автор A',
        commentLastChangedAt: '2026-07-20T10:00:00Z',
      },
      {
        ...baseMembership,
        id: 'sale-a-version-2',
        saleId: 'sale-a',
        comment: 'Комментарий A',
        commentLastChangedByName: 'Автор A',
        commentLastChangedAt: '2026-07-20T10:00:00Z',
      },
      {
        ...baseMembership,
        id: 'sale-b-version-1',
        saleId: 'sale-b',
        purchaseDate: '2026-08-01',
        paymentDate: '2026-08-01',
        comment: 'Комментарий B',
        commentLastChangedByName: 'Автор B',
        commentLastChangedAt: '2026-08-02T11:00:00Z',
      },
    ]

    const mapped = payloads.map((payload) => mapClientMembership(payload))
    expect(mapped).not.toContain(null)
    expect(mapped.map((membership) => ({
      id: membership?.id,
      saleId: membership?.saleId,
      comment: membership?.comment,
      actor: membership?.commentLastChangedByName,
      changedAt: membership?.commentLastChangedAt,
    }))).toEqual([
      {
        id: 'sale-a-version-1',
        saleId: 'sale-a',
        comment: 'Комментарий A',
        actor: 'Автор A',
        changedAt: '2026-07-20T10:00:00Z',
      },
      {
        id: 'sale-a-version-2',
        saleId: 'sale-a',
        comment: 'Комментарий A',
        actor: 'Автор A',
        changedAt: '2026-07-20T10:00:00Z',
      },
      {
        id: 'sale-b-version-1',
        saleId: 'sale-b',
        comment: 'Комментарий B',
        actor: 'Автор B',
        changedAt: '2026-08-02T11:00:00Z',
      },
    ])

    const reordered = [payloads[2], payloads[0], payloads[1]]
      .map((payload) => mapClientMembership(payload))
    expect(reordered.map((membership) => `${membership?.id}:${membership?.saleId}`)).toEqual([
      'sale-b-version-1:sale-b',
      'sale-a-version-1:sale-a',
      'sale-a-version-2:sale-a',
    ])
  })
})
