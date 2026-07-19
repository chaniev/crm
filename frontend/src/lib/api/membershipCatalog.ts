import { API_ENDPOINTS } from './endpoints'
import { extractArrayPayload, isRecord, readBoolean, readNumber, readString } from './read-helpers'
import { request } from './transport'
import type {
  CreateMembershipCatalogItemRequest,
  MembershipBehaviorKind,
  MembershipCatalogItem,
  UpdateMembershipCatalogItemRequest,
} from './types'

export async function getMembershipCatalogItems(branchId: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ branchId })
  const payload = await request<unknown>(`${API_ENDPOINTS.membershipCatalog.collection}?${query}`, { signal })
  return extractArrayPayload(payload, ['items', 'catalogItems']).map(mapCatalogItem)
}

export async function getEligibleMembershipCatalogItems(branchId: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ branchId })
  const payload = await request<unknown>(`${API_ENDPOINTS.membershipCatalog.eligible}?${query}`, { signal })
  return extractArrayPayload(payload, ['items', 'catalogItems']).map(mapCatalogItem)
}

export async function createMembershipCatalogItem(payload: CreateMembershipCatalogItemRequest) {
  return mapCatalogItem(await request<unknown>(API_ENDPOINTS.membershipCatalog.collection, {
    method: 'POST', body: JSON.stringify(payload),
  }))
}

export async function updateMembershipCatalogItem(itemId: string, payload: UpdateMembershipCatalogItemRequest) {
  return mapCatalogItem(await request<unknown>(API_ENDPOINTS.membershipCatalog.byId(itemId), {
    method: 'PUT', body: JSON.stringify(payload),
  }))
}

function mapCatalogItem(payload: unknown): MembershipCatalogItem {
  if (!isRecord(payload)) throw new Error('Invalid membership catalog item payload.')
  const behaviorKind = mapBehaviorKind(readString(payload, ['behaviorKind', 'BehaviorKind']))
  const id = readString(payload, ['id', 'Id'])
  const name = readString(payload, ['name', 'Name'])
  const availableFrom = readString(payload, ['availableFrom', 'AvailableFrom'])
  const price = readNumber(payload, ['price', 'Price'])
  if (!id || !name || !availableFrom || price === null || price === undefined || !behaviorKind) throw new Error('Invalid membership catalog item payload.')
  return {
    id,
    branchId: readString(payload, ['branchId', 'BranchId']) ?? null,
    name,
    price,
    behaviorKind,
    availableFrom,
    availableTo: readString(payload, ['availableTo', 'AvailableTo']) ?? null,
    isSystemOwned: readBoolean(payload, ['isSystem', 'IsSystem', 'isSystemOwned', 'IsSystemOwned']) ?? behaviorKind === 'Professional',
  }
}

function mapBehaviorKind(value: string | null | undefined): MembershipBehaviorKind | null {
  if (value === 'SingleVisit' || value === 'Term' || value === 'Professional') return value
  return null
}
