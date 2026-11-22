import {
  API_ENDPOINTS,
  GROUP_TRAINER_SUBSTITUTIONS_QUERY_KEYS,
} from './endpoints'
import { request } from './transport'
import type {
  CreateGroupTrainerSubstitutionPeriodRequest,
  GetGroupTrainerSubstitutionsParams,
  GroupTrainerSubstitution,
  GroupTrainerSubstitutionsResponse,
} from './types'

export function getGroupTrainerSubstitutions(
  groupId: string,
  params: GetGroupTrainerSubstitutionsParams = {},
  signal?: AbortSignal,
) {
  return listSubstitutions(API_ENDPOINTS.groups.trainerSubstitutions(groupId), params, signal)
}

export function getGroupTrainerSubstitutionPeriods(
  groupId: string,
  params: GetGroupTrainerSubstitutionsParams = {},
  signal?: AbortSignal,
) {
  return listSubstitutions(API_ENDPOINTS.groups.trainerSubstitutionPeriods(groupId), params, signal)
}

async function listSubstitutions(path: string, params: GetGroupTrainerSubstitutionsParams, signal?: AbortSignal) {
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
    `${path}${query ? `?${query}` : ''}`,
    { signal },
  )

  return {
    current: payload.current,
    history: payload.history,
    canCreate: payload.canCreate,
    createUnavailableReason: payload.createUnavailableReason,
  } satisfies GroupTrainerSubstitutionsResponse
}

export function createGroupTrainerSubstitutionPeriod(groupId: string, payload: CreateGroupTrainerSubstitutionPeriodRequest) {
  return request<GroupTrainerSubstitution>(API_ENDPOINTS.groups.trainerSubstitutionPeriods(groupId), {
    method: 'POST', body: JSON.stringify(payload),
  })
}

export function cancelGroupTrainerSubstitutionPeriod(groupId: string, periodId: string) {
  return request<GroupTrainerSubstitution>(API_ENDPOINTS.groups.cancelTrainerSubstitutionPeriod(groupId, periodId), {
    method: 'POST',
  })
}
