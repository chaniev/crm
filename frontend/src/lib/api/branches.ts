import { API_ENDPOINTS } from './endpoints'
import { request } from './transport'
import type {
  Branch,
  Hall,
  UpsertBranchRequest,
  UpsertHallRequest,
} from './types'

type BranchResponsePayload = {
  id: string
  name: string
  address?: string | null
  description?: string | null
  isArchived: boolean
  hallCount?: number | null
  groupCount?: number | null
  clientCount?: number | null
  createdAt?: string
  updatedAt?: string
}

type HallResponsePayload = {
  id: string
  branchId: string
  branchName: string
  name: string
  description?: string | null
  isArchived: boolean
  groupCount?: number | null
  createdAt?: string
  updatedAt?: string
}

export async function getBranches(
  params: { includeArchived?: boolean } = {},
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams()

  if (typeof params.includeArchived === 'boolean') {
    searchParams.set('includeArchived', String(params.includeArchived))
  }

  const query = searchParams.toString()
  const payload = await request<BranchResponsePayload[]>(
    `${API_ENDPOINTS.branches.collection}${query ? `?${query}` : ''}`,
    { signal },
  )

  return payload.map(mapBranch)
}

export async function createBranch(payload: UpsertBranchRequest) {
  const response = await request<BranchResponsePayload>(
    API_ENDPOINTS.branches.collection,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )

  return mapBranch(response)
}

export async function updateBranch(
  branchId: string,
  payload: UpsertBranchRequest,
) {
  const response = await request<BranchResponsePayload>(
    API_ENDPOINTS.branches.byId(branchId),
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  )

  return mapBranch(response)
}

export async function archiveBranch(branchId: string) {
  const response = await request<BranchResponsePayload>(
    API_ENDPOINTS.branches.archive(branchId),
    {
      method: 'PUT',
    },
  )

  return mapBranch(response)
}

export async function restoreBranch(branchId: string) {
  const response = await request<BranchResponsePayload>(
    API_ENDPOINTS.branches.restore(branchId),
    {
      method: 'PUT',
    },
  )

  return mapBranch(response)
}

export async function getHalls(
  params: { branchId?: string; includeArchived?: boolean } = {},
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams()

  if (params.branchId) {
    searchParams.set('branchId', params.branchId)
  }

  if (typeof params.includeArchived === 'boolean') {
    searchParams.set('includeArchived', String(params.includeArchived))
  }

  const query = searchParams.toString()
  const payload = await request<HallResponsePayload[]>(
    `${API_ENDPOINTS.halls.collection}${query ? `?${query}` : ''}`,
    { signal },
  )

  return payload.map(mapHall)
}

export async function createHall(payload: UpsertHallRequest) {
  const response = await request<HallResponsePayload>(
    API_ENDPOINTS.halls.collection,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )

  return mapHall(response)
}

export async function updateHall(
  hallId: string,
  payload: UpsertHallRequest,
) {
  const response = await request<HallResponsePayload>(
    API_ENDPOINTS.halls.byId(hallId),
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  )

  return mapHall(response)
}

export async function archiveHall(hallId: string) {
  const response = await request<HallResponsePayload>(
    API_ENDPOINTS.halls.archive(hallId),
    {
      method: 'PUT',
    },
  )

  return mapHall(response)
}

export async function restoreHall(hallId: string) {
  const response = await request<HallResponsePayload>(
    API_ENDPOINTS.halls.restore(hallId),
    {
      method: 'PUT',
    },
  )

  return mapHall(response)
}

export async function deleteHall(hallId: string) {
  await request<void>(API_ENDPOINTS.halls.byId(hallId), {
    method: 'DELETE',
  })
}

function mapBranch(payload: BranchResponsePayload): Branch {
  return {
    id: payload.id,
    name: payload.name,
    address: payload.address?.trim() || null,
    description: payload.description?.trim() || null,
    isArchived: payload.isArchived,
    hallCount: payload.hallCount ?? 0,
    groupCount: payload.groupCount ?? 0,
    clientCount: payload.clientCount ?? 0,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
  }
}

function mapHall(payload: HallResponsePayload): Hall {
  return {
    id: payload.id,
    branchId: payload.branchId,
    branchName: payload.branchName,
    name: payload.name,
    description: payload.description?.trim() || null,
    isArchived: payload.isArchived,
    groupCount: payload.groupCount ?? 0,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
  }
}
