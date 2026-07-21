import { describe, expect, test } from 'vitest'
import { mapClientMembership } from './mappers'

const baseMembership = {
  id: 'version-1',
  saleId: 'sale-1',
  behaviorKind: 'Term',
  purchaseDate: '2026-07-01',
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
})
