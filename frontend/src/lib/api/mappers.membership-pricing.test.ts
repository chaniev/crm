import { describe, expect, test } from 'vitest'
import { applyFieldErrors } from './errors'
import { mapClientMembership } from './mappers'

describe('membership sale pricing response mapping', () => {
  test('maps backend-owned amount-only label, nullable catalog and actual amount', () => {
    const membership = mapClientMembership({
      id: 'version-amount-only',
      saleId: 'sale-amount-only',
      membershipCatalogItemId: null,
      membershipName: 'Без варианта каталога',
      behaviorKind: 'Term',
      purchaseDate: '2026-07-22',
      expirationDate: '2026-08-20',
      pricingMode: 'AmountOnly',
      grossAmount: 4200,
      catalogPrice: null,
      isPaid: false,
      singleVisitUsed: false,
    })

    expect(membership as unknown).toMatchObject({
      membershipCatalogItemId: null,
      membershipName: 'Без варианта каталога',
      behaviorKind: 'Term',
      pricingMode: 'AmountOnly',
      grossAmount: 4200,
      catalogPrice: null,
    })
    expect(membership).not.toHaveProperty('paymentAmount')
  })

  test('keeps catalog context separate from an equal explicit override', () => {
    const membership = mapClientMembership({
      id: 'version-override',
      saleId: 'sale-override',
      membershipCatalogItemId: 'catalog-1',
      membershipName: 'Месяц',
      behaviorKind: 'Term',
      purchaseDate: '2026-07-22',
      expirationDate: '2026-08-20',
      pricingMode: 'CatalogOverride',
      grossAmount: 3000,
      catalogPrice: 3000,
      isPaid: true,
      singleVisitUsed: false,
    })

    expect(membership as unknown).toMatchObject({
      membershipCatalogItemId: 'catalog-1',
      membershipName: 'Месяц',
      pricingMode: 'CatalogOverride',
      grossAmount: 3000,
      catalogPrice: 3000,
    })
  })

  test('maps PascalCase pricing fields without deriving provenance from amounts', () => {
    const membership = mapClientMembership({
      id: 'version-catalog',
      saleId: 'sale-catalog',
      MembershipCatalogItemId: 'catalog-1',
      MembershipName: 'Месяц',
      behaviorKind: 'Term',
      purchaseDate: '2026-07-22',
      expirationDate: '2026-08-20',
      PricingMode: 'Catalog',
      GrossAmount: 3000,
      CatalogPrice: 3000,
      isPaid: true,
      singleVisitUsed: false,
    })

    expect(membership as unknown).toMatchObject({
      pricingMode: 'Catalog',
      grossAmount: 3000,
      catalogPrice: 3000,
    })
  })

  test('normalizes pricing ProblemDetails keys without losing either control error', () => {
    expect(
      applyFieldErrors({
        MembershipCatalogItemId: ['Выберите вариант каталога.'],
        ManualSaleAmount: ['Введите целое количество рублей.'],
      }),
    ).toEqual({
      membershipCatalogItemId: 'Выберите вариант каталога.',
      manualSaleAmount: 'Введите целое количество рублей.',
    })
  })
})
