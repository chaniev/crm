import { describe, expect, test } from 'vitest'
import { applyFieldErrors } from './errors'
import { mapClientMembership } from './mappers'

const membershipTargetContract = {
  coverageKind: 'TargetGroups',
  entitlementState: 'Active',
  targetGroups: [
    {
      groupId: 'group-1',
      groupName: 'Утренняя группа',
      branchId: 'branch-1',
      branchName: 'Основной',
      position: 1,
      isActive: true,
    },
  ],
}

describe('membership sale pricing response mapping', () => {
  test('maps backend-owned amount-only label, nullable catalog and actual amount', () => {
    const membership = mapClientMembership({
      ...membershipTargetContract,
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
      paymentDate: '2026-07-10',
      paymentRecordedByUserId: 'user-1',
      paymentRecordedByUserName: 'Анна Петрова',
      paymentRecordedAt: '2026-07-22T10:15:00Z',
      singleVisitUsed: false,
    })

    expect(membership as unknown).toMatchObject({
      membershipCatalogItemId: null,
      membershipName: 'Без варианта каталога',
      behaviorKind: 'Term',
      pricingMode: 'AmountOnly',
      grossAmount: 4200,
      catalogPrice: null,
      paymentDate: '2026-07-10',
      paymentRecordedByUserId: 'user-1',
      paymentRecordedByUserName: 'Анна Петрова',
      paymentRecordedAt: '2026-07-22T10:15:00Z',
    })
    expect(membership).not.toHaveProperty('paymentAmount')
    expect(membership).not.toHaveProperty('isPaid')
    expect(membership).not.toHaveProperty('paidAt')
    expect(membership).not.toHaveProperty('paidByUserId')
  })

  test('keeps catalog context separate from an equal explicit override', () => {
    const membership = mapClientMembership({
      ...membershipTargetContract,
      id: 'version-override',
      saleId: 'sale-override',
      membershipCatalogItemId: 'catalog-1',
      membershipName: 'Месяц',
      behaviorKind: 'Term',
      purchaseDate: '2026-07-22',
      paymentDate: '2026-07-22',
      paymentRecordedAt: '2026-07-22T10:15:00Z',
      paymentRecordedByUserId: 'user-1',
      paymentRecordedByUserName: 'Анна Петрова',
      expirationDate: '2026-08-20',
      pricingMode: 'CatalogOverride',
      grossAmount: 3000,
      catalogPrice: 3000,
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
      ...membershipTargetContract,
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
      paymentDate: '2026-07-22',
      paymentRecordedByUserId: 'user-1',
      paymentRecordedByUserName: 'Анна Петрова',
      paymentRecordedAt: '2026-07-22T10:15:00Z',
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
        PaymentDate: ['Дата оплаты не может быть позже текущей даты.'],
      }),
    ).toEqual({
      membershipCatalogItemId: 'Выберите вариант каталога.',
      manualSaleAmount: 'Введите целое количество рублей.',
      paymentDate: 'Дата оплаты не может быть позже текущей даты.',
    })
  })
})
