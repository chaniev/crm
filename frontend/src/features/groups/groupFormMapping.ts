import { useForm } from '@mantine/form'
import type {
  TrainingGroupDetails,
  UpdateTrainingGroupIdentityRequest,
  UpsertTrainingGroupRequest,
} from '../../lib/api'
import { fe13GroupsCoreText } from '../../resources/fe-13-groups-core'


export type GroupFormValues = {
  branchId: string
  hallId: string
  groupTypeId: string
  name: string
  trainingStartTime: string
  durationMinutes: number | ''
  weekdays: string[]
  initialSeriesStartsOn: string
  initialSeriesEndsOn: string
  isActive: boolean
  trainerIds: string[]
}

export function useGroupForm() {
  return useForm<GroupFormValues>({
    initialValues: {
      branchId: '',
      hallId: '',
      groupTypeId: '',
      name: '',
      trainingStartTime: '',
      durationMinutes: '',
      weekdays: [],
      initialSeriesStartsOn: todayIso(),
      initialSeriesEndsOn: '',
      isActive: true,
      trainerIds: [],
    },
    validate: {
      name: (value) => (value.trim() ? null : fe13GroupsCoreText.groupFormMapping_string_6994b743),
      trainingStartTime: (value) =>
        value.trim() ? null : fe13GroupsCoreText.groupFormMapping_string_d730d41d,
      groupTypeId: (value) => (value ? null : fe13GroupsCoreText.groupFormMapping_string_9d3e66f4),
    },
  })
}

export function toUpsertGroupPayload(
  values: GroupFormValues,
): UpsertTrainingGroupRequest {
  return {
    name: values.name.trim(),
    branchId: values.branchId || undefined,
    hallId: values.hallId || undefined,
    groupTypeId: values.groupTypeId || undefined,
    trainingStartTime: values.trainingStartTime.trim(),
    durationMinutes:
      typeof values.durationMinutes === 'number' ? values.durationMinutes : null,
    weekdays: values.weekdays.map(Number),
    isActive: values.isActive,
    trainerIds: [...values.trainerIds].sort(),
  }
}

export function toUpdateGroupIdentityPayload(
  values: GroupFormValues,
): UpdateTrainingGroupIdentityRequest {
  return {
    name: values.name.trim(),
    branchId: values.branchId || undefined,
    groupTypeId: values.groupTypeId || undefined,
    isActive: values.isActive,
  }
}

export function toCreateGroupWithInitialSeriesPayload(
  values: GroupFormValues,
  confirmationToken?: string,
): UpsertTrainingGroupRequest {
  const trainingStartTime = values.trainingStartTime.trim()
  const durationMinutes =
    typeof values.durationMinutes === 'number' ? values.durationMinutes : null
  const weekdays = values.weekdays.map(Number)
  const hallId = values.hallId || undefined

  return {
    ...toUpsertGroupPayload(values),
    initialLessonSeries: {
      startsOn: values.initialSeriesStartsOn,
      endsOn: values.initialSeriesEndsOn.trim() || null,
      slots: weekdays.map((isoWeekday) => ({
        isoWeekday,
        startTime: trainingStartTime,
        durationMinutes,
        hallId,
      })),
    },
    ...(confirmationToken ? { confirmationToken } : {}),
  }
}

export function toFormValues(group: TrainingGroupDetails): GroupFormValues {
  return {
    branchId: group.branchId,
    hallId: group.hallId,
    groupTypeId: group.groupTypeId,
    name: group.name,
    trainingStartTime: group.trainingStartTime,
    durationMinutes: group.durationMinutes,
    weekdays: group.weekdays.map(String),
    initialSeriesStartsOn: todayIso(),
    initialSeriesEndsOn: '',
    isActive: group.isActive,
    trainerIds: group.trainerIds,
  }
}

function todayIso() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}
