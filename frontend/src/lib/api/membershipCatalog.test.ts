import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  createMembershipCatalogItem,
  getEligibleMembershipCatalogItems,
  getMembershipCatalogItems,
  updateMembershipCatalogItem,
} from './membershipCatalog'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

describe('membership catalog api', () => {
  test('lists a selected branch catalog and maps behavior without name inference', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      items: [{
        id: 'item-1', branchId: 'branch-1', name: 'Годовой', price: 12000,
        behaviorKind: 'Term', availableFrom: '2026-01-01', availableTo: null,
        isSystemOwned: false,
      }],
    }))

    await expect(getMembershipCatalogItems('branch-1')).resolves.toEqual([
      expect.objectContaining({ id: 'item-1', behaviorKind: 'Term', price: 12000 }),
    ])
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/settings/membership-catalog?branchId=branch-1'),
      expect.any(Object),
    )
  })

  test('creates immutable catalog fields and updates only display fields', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: 'item-1', branchId: 'branch-1', name: 'Месяц', price: 3000, behaviorKind: 'Term', availableFrom: '2026-01-01', availableTo: null, isSystemOwned: false }))
      .mockResolvedValueOnce(jsonResponse({ id: 'item-1', branchId: 'branch-1', name: 'Месяц+', price: 3000, behaviorKind: 'Term', availableFrom: '2026-02-01', availableTo: '2026-12-31', isSystemOwned: false }))

    await createMembershipCatalogItem({ branchId: 'branch-1', name: 'Месяц', price: 3000, behaviorKind: 'Term', availableFrom: '2026-01-01', availableTo: null })
    await updateMembershipCatalogItem('item-1', { name: 'Месяц+', availableFrom: '2026-02-01', availableTo: '2026-12-31' })

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ branchId: 'branch-1', name: 'Месяц', price: 3000, behaviorKind: 'Term', availableFrom: '2026-01-01', availableTo: null })
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ name: 'Месяц+', availableFrom: '2026-02-01', availableTo: '2026-12-31' })
  })

  test('loads eligible options for a concrete branch', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }))
    await getEligibleMembershipCatalogItems('branch-2')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/membership-catalog/eligible?branchId=branch-2'),
      expect.any(Object),
    )
  })
})

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
