import { useForm } from '@mantine/form'
import type { TrainingGroupDetails, UpsertTrainingGroupRequest } from '../../lib/api'

export type GroupFormValues = {
  branchId: string
  hallId: string
  groupTypeId: string
  name: string
  trainingStartTime: string
  durationMinutes: number | ''
  weekdays: string[]
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
      isActive: true,
      trainerIds: [],
    },
    validate: {
      name: (value) => (value.trim() ? null : 'Введите название группы.'),
      trainingStartTime: (value) =>
        value.trim() ? null : 'Укажите время начала тренировки.',
      groupTypeId: (value) => (value ? null : 'Выберите тип группы.'),
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

export function toFormValues(group: TrainingGroupDetails): GroupFormValues {
  return {
    branchId: group.branchId,
    hallId: group.hallId,
    groupTypeId: group.groupTypeId,
    name: group.name,
    trainingStartTime: group.trainingStartTime,
    durationMinutes: group.durationMinutes,
    weekdays: group.weekdays.map(String),
    isActive: group.isActive,
    trainerIds: group.trainerIds,
  }
}
