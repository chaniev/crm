import {
  API_ENDPOINTS,
  GROUPS_DEFAULT_PAGE,
  GROUPS_DEFAULT_PAGE_SIZE,
  GROUPS_QUERY_KEYS,
} from './endpoints'
import { mapGroupListItem } from './groups'
import { request } from './transport'
import type {
  GroupResponsePayload,
  GroupsListEnvelopePayload,
  ScheduleLessonCancellationExecuteRequest,
  ScheduleLessonCancellationPreviewResponse,
  ScheduleLessonCancellationRequest,
  ScheduleLessonChangeExecuteRequest,
  ScheduleLessonChangePreviewResponse,
  ScheduleLessonChangeRequest,
  ScheduleLessonTrainerSubstitutionCancellationExecuteRequest,
  ScheduleLessonTrainerSubstitutionCancellationExecuteResponse,
  ScheduleLessonTrainerSubstitutionCancellationPreviewResponse,
  ScheduleLessonTrainerSubstitutionCancellationRequest,
  ScheduleLessonTrainerSubstitutionExecuteRequest,
  ScheduleLessonTrainerSubstitutionExecuteResponse,
  ScheduleLessonTrainerSubstitutionPreviewResponse,
  ScheduleLessonTrainerSubstitutionRequest,
  ScheduleLesson,
  ScheduleLessonsResponse,
  ScheduleOneOffLessonExecuteRequest,
  ScheduleOneOffLessonPreviewResponse,
  ScheduleOneOffLessonRequest,
  TrainingGroupListResponse,
} from './types'

export async function getScheduleGroups(
  params: {
    page?: number
    pageSize?: number
    skip?: number
    take?: number
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
    `${API_ENDPOINTS.schedule.groups}?${searchParams.toString()}`,
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

export async function getScheduleLessons(
  params: {
    from: string
    to: string
    branchId?: string | null
    hallId?: string | null
    trainerId?: string | null
    groupId?: string | null
    groupTypeId?: string | null
  },
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams()
  searchParams.set('from', params.from)
  searchParams.set('to', params.to)

  for (const [key, value] of Object.entries({
    branchId: params.branchId,
    hallId: params.hallId,
    trainerId: params.trainerId,
    groupId: params.groupId,
    groupTypeId: params.groupTypeId,
  })) {
    if (value) {
      searchParams.set(key, value)
    }
  }

  return request<ScheduleLessonsResponse>(
    `${API_ENDPOINTS.schedule.lessons}?${searchParams.toString()}`,
    { signal },
  )
}

export async function getScheduleLesson(
  lessonOccurrenceId: string,
  lessonDate: string,
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams()
  searchParams.set('lessonDate', lessonDate)

  return request<ScheduleLesson>(
    `${API_ENDPOINTS.schedule.lessonById(lessonOccurrenceId)}?${searchParams.toString()}`,
    { signal },
  )
}

export async function previewScheduleOneOffLesson(
  payload: ScheduleOneOffLessonRequest,
  signal?: AbortSignal,
) {
  return request<ScheduleOneOffLessonPreviewResponse>(
    API_ENDPOINTS.schedule.oneOffPreview,
    {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    },
  )
}

export async function createScheduleOneOffLesson(
  payload: ScheduleOneOffLessonExecuteRequest,
  signal?: AbortSignal,
) {
  return request<ScheduleLesson>(
    API_ENDPOINTS.schedule.oneOff,
    {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    },
  )
}

export async function previewScheduleLessonChange(
  lessonOccurrenceId: string,
  lessonDate: string,
  payload: ScheduleLessonChangeRequest,
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams()
  searchParams.set('lessonDate', lessonDate)

  return request<ScheduleLessonChangePreviewResponse>(
    `${API_ENDPOINTS.schedule.lessonChangePreview(lessonOccurrenceId)}?${searchParams.toString()}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    },
  )
}

export async function changeScheduleLesson(
  lessonOccurrenceId: string,
  lessonDate: string,
  payload: ScheduleLessonChangeExecuteRequest,
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams()
  searchParams.set('lessonDate', lessonDate)

  return request<ScheduleLesson>(
    `${API_ENDPOINTS.schedule.lessonChange(lessonOccurrenceId)}?${searchParams.toString()}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    },
  )
}

export async function previewScheduleLessonCancellation(
  lessonOccurrenceId: string,
  lessonDate: string,
  payload: ScheduleLessonCancellationRequest,
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams()
  searchParams.set('lessonDate', lessonDate)

  return request<ScheduleLessonCancellationPreviewResponse>(
    `${API_ENDPOINTS.schedule.lessonCancellationPreview(lessonOccurrenceId)}?${searchParams.toString()}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    },
  )
}

export async function applyScheduleLessonCancellation(
  lessonOccurrenceId: string,
  lessonDate: string,
  payload: ScheduleLessonCancellationExecuteRequest,
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams()
  searchParams.set('lessonDate', lessonDate)

  return request<ScheduleLesson>(
    `${API_ENDPOINTS.schedule.lessonCancellation(lessonOccurrenceId)}?${searchParams.toString()}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    },
  )
}

export async function previewScheduleLessonTrainerSubstitution(
  payload: ScheduleLessonTrainerSubstitutionRequest,
  signal?: AbortSignal,
) {
  return request<ScheduleLessonTrainerSubstitutionPreviewResponse>(
    API_ENDPOINTS.schedule.trainerSubstitutionsPreview,
    {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    },
  )
}

export async function applyScheduleLessonTrainerSubstitution(
  payload: ScheduleLessonTrainerSubstitutionExecuteRequest,
  signal?: AbortSignal,
) {
  return request<ScheduleLessonTrainerSubstitutionExecuteResponse>(
    API_ENDPOINTS.schedule.trainerSubstitutions,
    {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    },
  )
}

export async function previewScheduleLessonTrainerSubstitutionCancellation(
  payload: ScheduleLessonTrainerSubstitutionCancellationRequest,
  signal?: AbortSignal,
) {
  return request<ScheduleLessonTrainerSubstitutionCancellationPreviewResponse>(
    API_ENDPOINTS.schedule.trainerSubstitutionCancellationsPreview,
    {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    },
  )
}

export async function applyScheduleLessonTrainerSubstitutionCancellation(
  payload: ScheduleLessonTrainerSubstitutionCancellationExecuteRequest,
  signal?: AbortSignal,
) {
  return request<ScheduleLessonTrainerSubstitutionCancellationExecuteResponse>(
    API_ENDPOINTS.schedule.trainerSubstitutionCancellations,
    {
      method: 'POST',
      body: JSON.stringify(payload),
      signal,
    },
  )
}
