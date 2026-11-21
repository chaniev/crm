export { default as demoPhoto } from './assets/demo-client.jpg'
import type { ClientFormValues } from '../../../../frontend/src/features/clients/ClientManagement.form'
import type { Branch, TrainingGroupListItem } from '../../../../frontend/src/lib/api'

export const examples = {
  empty: 'Клиент без фото',
  photo: 'Клиент с фото',
  broken: 'Фото недоступно',
  upload: 'Сбой отправки',
  save: 'Сбой сохранения',
  long: 'Длинное ФИО',
  coach: 'Доступ тренера',
  professional: 'Профессионал',
} as const
export type Example = keyof typeof examples
export const branches: Branch[] = [
  { id: 'north', name: 'Филиал Север', address: null, description: null, isArchived: false, hallCount: 1, groupCount: 1, clientCount: null },
  { id: 'west', name: 'Филиал Запад', address: null, description: null, isArchived: false, hallCount: 1, groupCount: 1, clientCount: null },
]
const groupSettings = {
  groupTypeId: 'regular', groupTypeName: 'Основная', trainingStartTime: '20:00',
  durationMinutes: 120, weekdays: [2, 4, 6], isActive: true, trainers: [],
  trainerIds: [], trainerCount: 0, trainerNames: [], clientCount: null,
}
export const groups: TrainingGroupListItem[] = [
  { ...groupSettings, hallId: 'one', branchName: 'Филиал Север', id: 'kick', name: 'Кикбоксинг · группа 19', hallName: 'Зал 1', branchId: 'north' },
  { ...groupSettings, hallId: 'two', branchName: 'Филиал Запад', id: 'box', name: 'Бокс · группа 7', hallName: 'Зал 2', branchId: 'west' },
]
export function fixture(example: Example): ClientFormValues {
  return {
    lastName: example === 'long' ? 'Александрова-Рождественская' : 'Алексеев',
    firstName: example === 'long' ? 'Александра' : 'Алексей',
    middleName: example === 'long' ? 'Константиновна' : 'Дмитриевич',
    phone: '+7 900 000-02-37', branchId: 'north', birthDate: '2004-09-13',
    groupIds: ['kick'], notes: 'Предпочитает вечерние тренировки.',
    contacts: example === 'long' ? [{ type: 'Родитель', fullName: 'Александрова Ирина', phone: '+7 900 000-04-18' }] : [],
  }
}
