import {
  API_ENDPOINTS,
  GROUPS_DEFAULT_PAGE,
  GROUPS_DEFAULT_PAGE_SIZE,
  GROUPS_QUERY_KEYS,
} from './endpoints'
import { request } from './transport'
import type {
  GroupClientResponsePayload,
  GroupClientsResponse,
  GroupResponsePayload,
  GroupTrainerOptionPayload,
  GroupsListEnvelopePayload,
  TrainerOption,
  TrainingGroupDetails,
  TrainingGroupListItem,
  TrainingGroupListResponse,
  UpsertTrainingGroupRequest,
} from './types'

export async function getGroups(
  params: {
    page?: number
    pageSize?: number
    skip?: number
    take?: number
    isActive?: boolean
  } = {},
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams()

  if (typeof params.page === 'number') {
    searchParams.set(GROUPS_QUERY_KEYS.page, String(params.page))
  } else if (typeof params.pageSize === 'number') {
    searchParams.set(GROUPS_QUERY_KEYS.page, String(GROUPS_DEFAULT_PAGE))
  }

  if (typeof params.pageSize === 'number') {
    searchParams.set(GROUPS_QUERY_KEYS.pageSize, String(params.pageSize))
  }

  if (typeof params.skip === 'number') {
    searchParams.set(GROUPS_QUERY_KEYS.skip, String(params.skip))
  }

  if (typeof params.take === 'number') {
    searchParams.set(GROUPS_QUERY_KEYS.take, String(params.take))
  }

  if (typeof params.isActive === 'boolean') {
    searchParams.set(GROUPS_QUERY_KEYS.isActive, String(params.isActive))
  }

  if (
    !searchParams.has(GROUPS_QUERY_KEYS.page) &&
    !searchParams.has(GROUPS_QUERY_KEYS.pageSize) &&
    !searchParams.has(GROUPS_QUERY_KEYS.skip) &&
    !searchParams.has(GROUPS_QUERY_KEYS.take)
  ) {
    searchParams.set(GROUPS_QUERY_KEYS.page, String(GROUPS_DEFAULT_PAGE))
    searchParams.set(GROUPS_QUERY_KEYS.pageSize, String(GROUPS_DEFAULT_PAGE_SIZE))
  }

  const payload = await request<GroupResponsePayload[] | GroupsListEnvelopePayload>(
    `${API_ENDPOINTS.groups.collection}?${searchParams.toString()}`,
    { signal },
  )

  if (Array.isArray(payload)) {
    const items = payload.map(mapGroupListItem)

    return {
      items,
      totalCount: items.length,
      skip: 0,
      take: items.length,
    } satisfies TrainingGroupListResponse
  }

  const items = payload.items.map(mapGroupListItem)

  return {
    items,
    totalCount: payload.totalCount ?? items.length,
    skip: payload.skip ?? 0,
    take: payload.take ?? items.length,
  } satisfies TrainingGroupListResponse
}

export async function getGroup(groupId: string, signal?: AbortSignal) {
  const payload = await request<GroupResponsePayload>(API_ENDPOINTS.groups.byId(groupId), {
    signal,
  })

  return mapGroupDetails(payload)
}

export async function getTrainerOptions(signal?: AbortSignal) {
  const payload = await request<GroupTrainerOptionPayload[]>(
    API_ENDPOINTS.groups.trainerOptions,
    { signal },
  )

  return payload.map((trainer) => ({
    id: trainer.id,
    fullName: trainer.fullName,
    login: trainer.login,
  })) satisfies TrainerOption[]
}

export async function getGroupClients(groupId: string, signal?: AbortSignal) {
  const payload = await request<
    GroupClientResponsePayload[] | { clients: GroupClientResponsePayload[] }
  >(API_ENDPOINTS.groups.clients(groupId), {
    signal,
  })

  const clientsPayload = Array.isArray(payload) ? payload : payload.clients

  return {
    groupId,
    clients: clientsPayload.map((client) => ({
      id: client.id,
      fullName: client.fullName,
      status: client.status,
      phone: client.phone,
    })),
  } satisfies GroupClientsResponse
}

export async function createGroup(payload: UpsertTrainingGroupRequest) {
  const response = await request<GroupResponsePayload>(API_ENDPOINTS.groups.collection, {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return mapGroupDetails(response)
}

export async function updateGroup(
  groupId: string,
  payload: UpsertTrainingGroupRequest,
) {
  const response = await request<GroupResponsePayload>(
    API_ENDPOINTS.groups.byId(groupId),
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  )

  return mapGroupDetails(response)
}

function mapGroupListItem(payload: GroupResponsePayload): TrainingGroupListItem {
  const trainers = payload.trainers.map(mapGroupTrainerSummary)

  return {
    id: payload.id,
    name: payload.name,
    trainingStartTime: payload.trainingStartTime,
    scheduleText: payload.scheduleText,
    isActive: payload.isActive,
    trainers,
    trainerIds:
      payload.trainerIds.length > 0
        ? payload.trainerIds
        : trainers.map((trainer) => trainer.id),
    trainerCount: payload.trainerCount ?? trainers.length,
    clientCount: payload.clientCount,
    trainerNames: payload.trainerNames ?? trainers.map((trainer) => trainer.fullName),
    updatedAt: payload.updatedAt,
  }
}

function mapGroupDetails(payload: GroupResponsePayload): TrainingGroupDetails {
  return {
    id: payload.id,
    name: payload.name,
    trainingStartTime: payload.trainingStartTime,
    scheduleText: payload.scheduleText,
    isActive: payload.isActive,
    trainerIds: payload.trainerIds,
    trainers: payload.trainers.map(mapGroupTrainerSummary),
    clientCount: payload.clientCount,
    updatedAt: payload.updatedAt,
    createdAt: payload.createdAt,
  }
}

function mapGroupTrainerSummary(trainer: GroupResponsePayload['trainers'][number]) {
  return {
    id: trainer.id,
    fullName: trainer.fullName,
    login: trainer.login,
  }
}
