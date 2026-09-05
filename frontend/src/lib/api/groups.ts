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
  GroupLessonSeriesExecuteRequest,
  GroupLessonSeriesExecuteResponse,
  GroupLessonSeriesPreviewResponse,
  GroupLessonSeriesReadResponse,
  GroupLessonSeriesRequest,
  GroupPreviewResponse,
  GroupResponsePayload,
  GroupTrainerAssignmentsExecuteRequest,
  GroupTrainerAssignmentsExecuteResponse,
  GroupTrainerAssignmentsPreviewRequest,
  GroupTrainerAssignmentsPreviewResponse,
  GroupSummaryResponsePayload,
  GroupTrainerOptionPayload,
  GroupsListEnvelopePayload,
  TrainerOption,
  TrainingGroupDetails,
  TrainingGroupListItem,
  TrainingGroupListResponse,
  TrainingGroupSummary,
  UpdateTrainingGroupIdentityRequest,
  UpsertTrainingGroupRequest,
} from './types'
import { fe17SharedRoutingThemeText } from '../../resources/fe-17-shared-routing-theme'


export async function getGroupSummary(signal?: AbortSignal) {
  const payload = await request<GroupSummaryResponsePayload>(
    API_ENDPOINTS.groups.summary,
    { signal },
  )

  return {
    totalCount: payload.totalCount,
    activeWithoutTrainerCount: payload.activeWithoutTrainerCount,
  } satisfies TrainingGroupSummary
}

export async function getGroups(
  params: {
    page?: number
    pageSize?: number
    skip?: number
    take?: number
    query?: string
    isActive?: boolean
    withoutTrainer?: boolean
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

  const query = typeof params.query === 'string' ? params.query.trim() : ''
  if (query) {
    searchParams.set(GROUPS_QUERY_KEYS.query, query)
  }

  if (typeof params.isActive === 'boolean') {
    searchParams.set(GROUPS_QUERY_KEYS.isActive, String(params.isActive))
  }

  if (params.withoutTrainer === true) {
    searchParams.set(GROUPS_QUERY_KEYS.withoutTrainer, 'true')
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

  const payload = await request<GroupsListEnvelopePayload>(
    `${API_ENDPOINTS.groups.collection}?${searchParams.toString()}`,
    { signal },
  )

  assertGroupsListEnvelopePayload(payload)

  const items = payload.items.map(mapGroupListItem)

  return {
    items,
    totalCount: payload.totalCount,
    skip: payload.skip,
    take: payload.take,
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

export async function previewGroupCreate(payload: UpsertTrainingGroupRequest) {
  return request<GroupPreviewResponse>(API_ENDPOINTS.groups.preview, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateGroup(
  groupId: string,
  payload: UpdateTrainingGroupIdentityRequest,
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

export async function previewGroupTrainerAssignments(
  groupId: string,
  payload: GroupTrainerAssignmentsPreviewRequest,
) {
  return request<GroupTrainerAssignmentsPreviewResponse>(
    API_ENDPOINTS.groups.trainerAssignmentsPreview(groupId),
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
}

export async function applyGroupTrainerAssignments(
  groupId: string,
  payload: GroupTrainerAssignmentsExecuteRequest,
) {
  return request<GroupTrainerAssignmentsExecuteResponse>(
    API_ENDPOINTS.groups.trainerAssignments(groupId),
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
}

export async function getGroupLessonSeries(
  groupOrSeriesId: string,
  signal?: AbortSignal,
) {
  return request<GroupLessonSeriesReadResponse>(
    API_ENDPOINTS.groups.lessonSeries(groupOrSeriesId),
    { signal },
  )
}

export async function previewGroupLessonSeries(
  groupOrSeriesId: string,
  payload: GroupLessonSeriesRequest,
) {
  return request<GroupLessonSeriesPreviewResponse>(
    API_ENDPOINTS.groups.lessonSeriesPreview(groupOrSeriesId),
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
}

export async function applyGroupLessonSeries(
  groupOrSeriesId: string,
  payload: GroupLessonSeriesExecuteRequest,
) {
  return request<GroupLessonSeriesExecuteResponse>(
    API_ENDPOINTS.groups.lessonSeries(groupOrSeriesId),
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
}

export function mapGroupListItem(payload: GroupResponsePayload): TrainingGroupListItem {
  const trainers = payload.trainers.map(mapGroupTrainerSummary)

  return {
    id: payload.id,
    name: payload.name,
    branchId: payload.branchId,
    branchName: payload.branchName,
    hallId: payload.hallId,
    hallName: payload.hallName,
    groupTypeId: payload.groupTypeId,
    groupTypeName: payload.groupTypeName,
    trainingStartTime: payload.trainingStartTime,
    durationMinutes: payload.durationMinutes,
    weekdays: payload.weekdays,
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
    branchId: payload.branchId,
    branchName: payload.branchName,
    hallId: payload.hallId,
    hallName: payload.hallName,
    groupTypeId: payload.groupTypeId,
    groupTypeName: payload.groupTypeName,
    trainingStartTime: payload.trainingStartTime,
    durationMinutes: payload.durationMinutes,
    weekdays: payload.weekdays,
    isActive: payload.isActive,
    trainerIds: payload.trainerIds,
    trainers: payload.trainers.map(mapGroupTrainerSummary),
    clientCount: payload.clientCount,
    updatedAt: payload.updatedAt,
    createdAt: payload.createdAt,
    trainerAssignmentRevision: payload.trainerAssignmentRevision ?? '',
    trainerAssignmentPeriods: (payload.trainerAssignmentPeriods ?? []).map((assignment) => ({
      trainerId: assignment.trainerId,
      trainerName: assignment.trainerName,
      validFrom: assignment.validFrom,
      validTo: assignment.validTo ?? null,
    })),
  }
}

function mapGroupTrainerSummary(trainer: GroupResponsePayload['trainers'][number]) {
  return {
    id: trainer.id,
    fullName: trainer.fullName,
    login: trainer.login,
  }
}

function assertGroupsListEnvelopePayload(
  payload: GroupsListEnvelopePayload,
): asserts payload is GroupsListEnvelopePayload {
  if (
    !payload ||
    typeof payload !== 'object' ||
    !Array.isArray(payload.items) ||
    typeof payload.totalCount !== 'number' ||
    typeof payload.skip !== 'number' ||
    typeof payload.take !== 'number'
  ) {
    throw new Error(fe17SharedRoutingThemeText.groups_string_62ac1691)
  }
}
