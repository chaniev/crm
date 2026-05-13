import { API_ENDPOINTS } from './endpoints'
import { request } from './transport'
import type {
  GroupType,
  UpsertGroupTypeRequest,
} from './types'

type GroupTypeResponsePayload = {
  id: string
  name: string
  description?: string | null
  systemIdentifier: string
  groupCount?: number | null
  createdAt?: string
  updatedAt?: string
}

export async function getGroupTypes(signal?: AbortSignal) {
  const payload = await request<GroupTypeResponsePayload[]>(
    API_ENDPOINTS.groupTypes.collection,
    { signal },
  )

  return payload.map(mapGroupType)
}

export async function getGroupType(groupTypeId: string, signal?: AbortSignal) {
  const payload = await request<GroupTypeResponsePayload>(
    API_ENDPOINTS.groupTypes.byId(groupTypeId),
    { signal },
  )

  return mapGroupType(payload)
}

export async function createGroupType(payload: UpsertGroupTypeRequest) {
  const response = await request<GroupTypeResponsePayload>(
    API_ENDPOINTS.groupTypes.collection,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )

  return mapGroupType(response)
}

export async function updateGroupType(
  groupTypeId: string,
  payload: UpsertGroupTypeRequest,
) {
  const response = await request<GroupTypeResponsePayload>(
    API_ENDPOINTS.groupTypes.byId(groupTypeId),
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  )

  return mapGroupType(response)
}

export async function deleteGroupType(groupTypeId: string) {
  await request<void>(API_ENDPOINTS.groupTypes.byId(groupTypeId), {
    method: 'DELETE',
  })
}

function mapGroupType(payload: GroupTypeResponsePayload): GroupType {
  return {
    id: payload.id,
    name: payload.name,
    description: payload.description?.trim() || null,
    systemIdentifier: payload.systemIdentifier,
    groupCount: payload.groupCount ?? 0,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
  }
}
