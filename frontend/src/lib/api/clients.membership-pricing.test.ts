import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  correctClientMembership,
  markClientMembershipPayment,
  purchaseClientMembership,
  renewClientMembership,
  transferClientBranch,
} from '../api'

type SaleRequestDraft = {
  membershipCatalogItemId?: string | null
  manualSaleAmount?: number | null
  validFrom?: string
  validTo?: string
  paymentStatus: 'Paid' | 'Unpaid'
  paymentDate?: string
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
        paymentStatus: 'Unpaid',
      } satisfies SaleRequestDraft,
      expectedBody: {
        MembershipCatalogItemId: 'catalog-1',
        ValidFrom: '2026-07-22',
        ValidTo: '2026-08-20',
        PaymentStatus: 'Unpaid',
      },
    },
    {
      mode: 'CatalogOverride',
      payload: {
        membershipCatalogItemId: 'catalog-1',
        manualSaleAmount: 4100,
        validFrom: '2026-07-22',
        validTo: '2026-08-20',
        paymentStatus: 'Paid',
        paymentDate: '2026-07-22',
      } satisfies SaleRequestDraft,
      expectedBody: {
        MembershipCatalogItemId: 'catalog-1',
        ManualSaleAmount: 4100,
        ValidFrom: '2026-07-22',
        ValidTo: '2026-08-20',
        PaymentStatus: 'Paid',
        PaymentDate: '2026-07-22',
      },
    },
    {
      mode: 'AmountOnly',
      payload: {
        membershipCatalogItemId: null,
        manualSaleAmount: 4200,
        validFrom: '2026-07-22',
        validTo: '2026-08-20',
        paymentStatus: 'Unpaid',
      } satisfies SaleRequestDraft,
      expectedBody: {
        MembershipCatalogItemId: null,
        ManualSaleAmount: 4200,
        ValidFrom: '2026-07-22',
        ValidTo: '2026-08-20',
        PaymentStatus: 'Unpaid',
      },
    },
  ])('purchase sends the exact $mode payload', async ({ payload, expectedBody }) => {
    const fetchMock = stubSuccessfulFetch()

    await purchaseClientMembership(
      'client-1',
      payload as unknown as Parameters<typeof purchaseClientMembership>[1],
    )

    expect(readRequestBody(fetchMock)).toEqual(expectedBody)
    expect(readRequestBody(fetchMock)).not.toHaveProperty('PricingMode')
    expect(readRequestBody(fetchMock)).not.toHaveProperty('GrossAmount')
    expect(readRequestBody(fetchMock)).not.toHaveProperty('CatalogPrice')
    expect(readRequestBody(fetchMock)).not.toHaveProperty('BehaviorKind')
    expect(readRequestBody(fetchMock)).not.toHaveProperty('PaymentAmount')
  })

  test.each([
    {
      mode: 'Catalog',
      payload: {
        membershipCatalogItemId: 'catalog-term',
        paymentStatus: 'Unpaid',
      } satisfies SaleRequestDraft,
      expectedBody: {
        MembershipCatalogItemId: 'catalog-term',
        PaymentStatus: 'Unpaid',
      },
    },
    {
      mode: 'CatalogOverride',
      payload: {
        membershipCatalogItemId: 'catalog-term',
        manualSaleAmount: 5100,
        paymentStatus: 'Paid',
        paymentDate: '2026-08-21',
      } satisfies SaleRequestDraft,
      expectedBody: {
        MembershipCatalogItemId: 'catalog-term',
        ManualSaleAmount: 5100,
        PaymentStatus: 'Paid',
        PaymentDate: '2026-08-21',
      },
    },
    {
      mode: 'AmountOnly',
      payload: {
        membershipCatalogItemId: null,
        manualSaleAmount: 5200,
        paymentStatus: 'Unpaid',
      } satisfies SaleRequestDraft,
      expectedBody: {
        MembershipCatalogItemId: null,
        ManualSaleAmount: 5200,
        PaymentStatus: 'Unpaid',
      },
    },
  ])('renewal sends the exact $mode payload', async ({ payload, expectedBody }) => {
    const fetchMock = stubSuccessfulFetch()

    await renewClientMembership(
      'client-1',
      payload as unknown as Parameters<typeof renewClientMembership>[1],
    )

    expect(readRequestBody(fetchMock)).toEqual(expectedBody)
  })

  test.each([
    {
      mode: 'Catalog',
      pricing: { membershipCatalogItemId: 'catalog-target' },
    },
    {
      mode: 'CatalogOverride',
      pricing: {
        membershipCatalogItemId: 'catalog-target',
        manualSaleAmount: 6100,
      },
    },
    {
      mode: 'AmountOnly',
      pricing: {
        membershipCatalogItemId: null,
        manualSaleAmount: 6200,
      },
    },
  ])('sale-producing transfer sends the exact $mode pricing fields', async ({ pricing }) => {
    const fetchMock = stubSuccessfulFetch()
    const payload = {
      targetBranchId: 'branch-2',
      targetGroupIds: ['group-2'],
      ...pricing,
      validFrom: '2026-07-22',
      validTo: '2026-08-20',
      paymentStatus: 'Unpaid',
    }

    await transferClientBranch(
      'client-1',
      payload as unknown as Parameters<typeof transferClientBranch>[1],
    )

    expect(readRequestBody(fetchMock)).toEqual(payload)
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
        paymentStatus: 'Unpaid',
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
      ) => Promise<unknown>)('client-1', payload)

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
    },
  )

  test('correction never forwards pricing or catalog identity from a stale form object', async () => {
    const fetchMock = stubSuccessfulFetch()
    const staleForm = {
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

    await correctClientMembership('client-1', staleForm)

    expect(readRequestBody(fetchMock)).toEqual({
      PurchaseDate: '2026-07-22',
      ExpirationDate: '2026-08-20',
      IsPaid: true,
    })
  })

  test('mark-payment sends a strict empty JSON object', async () => {
    const fetchMock = stubSuccessfulFetch()

    await markClientMembershipPayment(
      'client-1',
      {} as Parameters<typeof markClientMembershipPayment>[1],
    )

    expect(readRequestBody(fetchMock)).toEqual({})
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
        paymentStatus: 'Unpaid',
      } as unknown as Parameters<typeof purchaseClientMembership>[1],
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
