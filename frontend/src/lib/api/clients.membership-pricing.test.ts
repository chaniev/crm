import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  correctClientMembership,
  purchaseClientMembership,
  renewClientMembership,
  transferClientBranch,
} from '../api'

type SaleRequestDraft = {
  membershipCatalogItemId?: string | null
  manualSaleAmount?: number | null
  validFrom?: string
  validTo?: string
  paymentDate: string
  professionalComment?: string
}

type ServerOwnedPricingDraft = SaleRequestDraft & {
  pricingMode?: string
  grossAmount?: number
  catalogPrice?: number
  behaviorKind?: string
  paymentAmount?: number
}

describe('membership sale pricing API contract', () => {
  afterEach(() => vi.unstubAllGlobals())

  test.each([
    {
      mode: 'Catalog',
      payload: {
        membershipCatalogItemId: 'catalog-1',
        validFrom: '2026-07-22',
        validTo: '2026-08-20',
        paymentDate: '2026-07-23',
      } satisfies SaleRequestDraft,
      expectedBody: {
        MembershipCatalogItemId: 'catalog-1',
        ValidFrom: '2026-07-22',
        ValidTo: '2026-08-20',
        PaymentDate: '2026-07-23',
      },
    },
    {
      mode: 'CatalogOverride',
      payload: {
        membershipCatalogItemId: 'catalog-1',
        manualSaleAmount: 4100,
        validFrom: '2026-07-22',
        validTo: '2026-08-20',
        paymentDate: '2026-07-01',
      } satisfies SaleRequestDraft,
      expectedBody: {
        MembershipCatalogItemId: 'catalog-1',
        ManualSaleAmount: 4100,
        ValidFrom: '2026-07-22',
        ValidTo: '2026-08-20',
        PaymentDate: '2026-07-01',
      },
    },
    {
      mode: 'AmountOnly',
      payload: {
        membershipCatalogItemId: null,
        manualSaleAmount: 4200,
        validFrom: '2026-07-22',
        validTo: '2026-08-20',
        paymentDate: '2026-06-15',
      } satisfies SaleRequestDraft,
      expectedBody: {
        MembershipCatalogItemId: null,
        ManualSaleAmount: 4200,
        ValidFrom: '2026-07-22',
        ValidTo: '2026-08-20',
        PaymentDate: '2026-06-15',
      },
    },
  ])('purchase sends the exact $mode payload', async ({ payload, expectedBody }) => {
    const fetchMock = stubSuccessfulFetch()

    await purchaseClientMembership(
      'client-1',
      payload as unknown as Parameters<typeof purchaseClientMembership>[1],
      { idempotencyKey: 'membership-key-1' },
    )

    expect(readRequestBody(fetchMock)).toEqual(expectedBody)
    expect(readRequestHeaders(fetchMock).get('Idempotency-Key')).toBe(
      'membership-key-1',
    )
    expect(readRequestBody(fetchMock)).not.toHaveProperty('PricingMode')
    expect(readRequestBody(fetchMock)).not.toHaveProperty('GrossAmount')
    expect(readRequestBody(fetchMock)).not.toHaveProperty('CatalogPrice')
    expect(readRequestBody(fetchMock)).not.toHaveProperty('BehaviorKind')
    expect(readRequestBody(fetchMock)).not.toHaveProperty('PaymentAmount')
    expect(readRequestBody(fetchMock)).not.toHaveProperty('PaymentStatus')
    expect(readRequestBody(fetchMock)).not.toHaveProperty('IsPaid')
  })

  test.each([
    {
      mode: 'Catalog',
      payload: {
        membershipCatalogItemId: 'catalog-term',
        paymentDate: '2026-07-23',
      } satisfies SaleRequestDraft,
      expectedBody: {
        MembershipCatalogItemId: 'catalog-term',
        PaymentDate: '2026-07-23',
      },
    },
    {
      mode: 'CatalogOverride',
      payload: {
        membershipCatalogItemId: 'catalog-term',
        manualSaleAmount: 5100,
        paymentDate: '2026-07-20',
      } satisfies SaleRequestDraft,
      expectedBody: {
        MembershipCatalogItemId: 'catalog-term',
        ManualSaleAmount: 5100,
        PaymentDate: '2026-07-20',
      },
    },
    {
      mode: 'AmountOnly',
      payload: {
        membershipCatalogItemId: null,
        manualSaleAmount: 5200,
        paymentDate: '2026-07-01',
      } satisfies SaleRequestDraft,
      expectedBody: {
        MembershipCatalogItemId: null,
        ManualSaleAmount: 5200,
        PaymentDate: '2026-07-01',
      },
    },
  ])('renewal sends the exact $mode payload', async ({ payload, expectedBody }) => {
    const fetchMock = stubSuccessfulFetch()

    await renewClientMembership(
      'client-1',
      payload as unknown as Parameters<typeof renewClientMembership>[1],
      { idempotencyKey: 'membership-key-2' },
    )

    expect(readRequestBody(fetchMock)).toEqual(expectedBody)
    expect(readRequestHeaders(fetchMock).get('Idempotency-Key')).toBe(
      'membership-key-2',
    )
    expect(readRequestBody(fetchMock)).not.toHaveProperty('PaymentStatus')
    expect(readRequestBody(fetchMock)).not.toHaveProperty('IsPaid')
  })

  test('branch assignment transfer strips every sale-producing field', async () => {
    const fetchMock = stubSuccessfulFetch()
    const payload = {
      targetBranchId: 'branch-2',
      targetGroupIds: ['group-2'],
      membershipCatalogItemId: 'catalog-target',
      manualSaleAmount: 6100,
      validFrom: '2026-07-22',
      validTo: '2026-08-20',
      paymentDate: '2026-07-10',
    }

    await (transferClientBranch as unknown as (
      clientId: string,
      payload: unknown,
      options: unknown,
    ) => Promise<unknown>)('client-1', payload, {
      idempotencyKey: 'membership-key-transfer',
    })

    expect(readRequestBody(fetchMock)).toEqual({
      targetBranchId: 'branch-2',
      targetGroupIds: ['group-2'],
    })
    expect(readRequestHeaders(fetchMock).get('Idempotency-Key')).toBe(
      'membership-key-transfer',
    )
    expect(readRequestBody(fetchMock)).not.toHaveProperty('paymentStatus')
    expect(readRequestBody(fetchMock)).not.toHaveProperty('isPaid')
  })

  test.each([
    ['purchase', purchaseClientMembership],
    ['renewal', renewClientMembership],
    ['transfer', transferClientBranch],
  ] as const)(
    '%s strips caller-controlled pricing and behavior fields',
    async (operation, invoke) => {
      const fetchMock = stubSuccessfulFetch()
      const payload: ServerOwnedPricingDraft & {
        targetBranchId?: string
        targetGroupIds?: string[]
      } = {
        membershipCatalogItemId: 'catalog-1',
        manualSaleAmount: 4000,
        paymentDate: '2026-07-23',
        pricingMode: 'AmountOnly',
        grossAmount: 1,
        catalogPrice: 1,
        behaviorKind: 'Professional',
        paymentAmount: 1,
        ...(operation === 'transfer'
          ? { targetBranchId: 'branch-2', targetGroupIds: [] }
          : {}),
      }

      await (invoke as (
        clientId: string,
        request: unknown,
        options?: unknown,
      ) => Promise<unknown>)('client-1', payload, {
        idempotencyKey: `membership-key-${operation}`,
      })

      const body = readRequestBody(fetchMock)
      expect(body).not.toHaveProperty('pricingMode')
      expect(body).not.toHaveProperty('grossAmount')
      expect(body).not.toHaveProperty('catalogPrice')
      expect(body).not.toHaveProperty('behaviorKind')
      expect(body).not.toHaveProperty('paymentAmount')
      expect(body).not.toHaveProperty('PricingMode')
      expect(body).not.toHaveProperty('GrossAmount')
      expect(body).not.toHaveProperty('CatalogPrice')
      expect(body).not.toHaveProperty('BehaviorKind')
      expect(body).not.toHaveProperty('PaymentAmount')
      expect(body).not.toHaveProperty('paymentStatus')
      expect(body).not.toHaveProperty('PaymentStatus')
      expect(body).not.toHaveProperty('isPaid')
      expect(body).not.toHaveProperty('IsPaid')
    },
  )

  test('correction sends addressed validity and payment date without sale pricing fields', async () => {
    const fetchMock = stubSuccessfulFetch()
    const staleForm = {
      saleId: 'sale-current',
      expectedMembershipId: 'version-current',
      validFrom: '2026-07-22',
      validTo: '2026-08-20',
      paymentDate: '2026-07-10',
      purchaseDate: '2026-07-22',
      expirationDate: '2026-08-20',
      isPaid: true,
      membershipCatalogItemId: 'catalog-forbidden',
      manualSaleAmount: 1,
      grossAmount: 1,
      pricingMode: 'AmountOnly',
      catalogPrice: 1,
      behaviorKind: 'Professional',
      paymentAmount: 1,
    }

    await correctClientMembership(
      'client-1',
      staleForm as unknown as Parameters<typeof correctClientMembership>[1],
      { idempotencyKey: 'membership-key-3' },
    )

    expect(readRequestBody(fetchMock)).toEqual({
      SaleId: 'sale-current',
      ExpectedMembershipId: 'version-current',
      ValidFrom: '2026-07-22',
      ValidTo: '2026-08-20',
      PaymentDate: '2026-07-10',
    })
    expect(readRequestHeaders(fetchMock).get('Idempotency-Key')).toBe(
      'membership-key-3',
    )
    expect(readRequestBody(fetchMock)).not.toHaveProperty('PaymentStatus')
    expect(readRequestBody(fetchMock)).not.toHaveProperty('IsPaid')
  })

  test('preserves ProblemDetails errors for both pricing controls', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          title: 'Ошибка проверки данных.',
          errors: {
            MembershipCatalogItemId: ['Выберите вариант каталога.'],
            ManualSaleAmount: ['Укажите сумму продажи целыми рублями.'],
          },
        }),
        {
          status: 400,
          headers: { 'content-type': 'application/problem+json' },
        },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const request = purchaseClientMembership(
      'client-1',
      {
        membershipCatalogItemId: null,
        manualSaleAmount: null,
        paymentDate: '2026-07-23',
      } as unknown as Parameters<typeof purchaseClientMembership>[1],
      { idempotencyKey: 'membership-key-validation' },
    )

    await expect(request).rejects.toMatchObject({
      status: 400,
      fieldErrors: {
        MembershipCatalogItemId: ['Выберите вариант каталога.'],
        ManualSaleAmount: ['Укажите сумму продажи целыми рублями.'],
      },
    })
  })
})

function stubSuccessfulFetch() {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(null), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function readRequestBody(fetchMock: ReturnType<typeof vi.fn>) {
  const init = fetchMock.mock.calls.at(-1)?.[1] as RequestInit | undefined
  return JSON.parse(String(init?.body)) as Record<string, unknown>
}

function readRequestHeaders(fetchMock: ReturnType<typeof vi.fn>) {
  const init = fetchMock.mock.calls.at(-1)?.[1] as RequestInit | undefined
  return new Headers(init?.headers)
}
