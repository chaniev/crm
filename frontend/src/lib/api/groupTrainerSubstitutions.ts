import {
  API_ENDPOINTS,
  GROUP_TRAINER_SUBSTITUTIONS_QUERY_KEYS,
} from './endpoints'
import { request } from './transport'
import type {
  GetGroupTrainerSubstitutionsParams,
  GroupTrainerSubstitution,
  GroupTrainerSubstitutionsResponse,
  UpsertGroupTrainerSubstitutionRequest,
} from './types'

export async function getGroupTrainerSubstitutions(
  groupId: string,
  params: GetGroupTrainerSubstitutionsParams = {},
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams()

  if (typeof params.historySkip === 'number') {
    searchParams.set(
      GROUP_TRAINER_SUBSTITUTIONS_QUERY_KEYS.historySkip,
      String(params.historySkip),
    )
  }

  if (typeof params.historyTake === 'number') {
    searchParams.set(
      GROUP_TRAINER_SUBSTITUTIONS_QUERY_KEYS.historyTake,
      String(params.historyTake),
    )
  }

  const query = searchParams.toString()
  const payload = await request<GroupTrainerSubstitutionsResponse>(
    `${API_ENDPOINTS.groups.trainerSubstitutions(groupId)}${query ? `?${query}` : ''}`,
    { signal },
  )

  return {
    current: payload.current,
    history: payload.history,
    canCreate: payload.canCreate,
    createUnavailableReason: payload.createUnavailableReason,
  } satisfies GroupTrainerSubstitutionsResponse
}

export async function createGroupTrainerSubstitution(
  groupId: string,
  payload: UpsertGroupTrainerSubstitutionRequest,
) {
  return request<GroupTrainerSubstitution>(
    API_ENDPOINTS.groups.trainerSubstitutions(groupId),
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
}

export async function updateGroupTrainerSubstitution(
  groupId: string,
  substitutionId: string,
  payload: UpsertGroupTrainerSubstitutionRequest,
) {
  return request<GroupTrainerSubstitution>(
    API_ENDPOINTS.groups.trainerSubstitution(groupId, substitutionId),
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  )
}

export async function cancelGroupTrainerSubstitution(
  groupId: string,
  substitutionId: string,
) {
  return request<GroupTrainerSubstitution>(
    API_ENDPOINTS.groups.cancelTrainerSubstitution(groupId, substitutionId),
    { method: 'POST' },
  )
}
