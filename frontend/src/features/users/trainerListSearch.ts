import type { UserListItem } from '../../lib/api'

export type TrainerStatusFilter = 'all' | 'inactive'
export type TrainerPasswordFilter = 'all' | 'mustChange'

export type TrainerListFilters = {
  status: TrainerStatusFilter
  password: TrainerPasswordFilter
}

type TrainerSearchItem = Pick<
  UserListItem,
  'fullName' | 'login' | 'isActive' | 'mustChangePassword'
>

export const DEFAULT_TRAINER_LIST_FILTERS: TrainerListFilters = {
  status: 'all',
  password: 'all',
}

export function normalizeTrainerListSearchQuery(query: string) {
  return query.trim().toLocaleLowerCase('ru-RU')
}

export function isTrainerSearchMatch(
  item: TrainerSearchItem,
  query: string,
) {
  const normalizedQuery = normalizeTrainerListSearchQuery(query)

  if (!normalizedQuery) {
    return true
  }

  return [item.fullName, item.login].some((value) =>
    value.toLocaleLowerCase('ru-RU').includes(normalizedQuery),
  )
}

export function filterTrainerListItems<T extends TrainerSearchItem>(
  items: readonly T[],
  query: string,
  filters: TrainerListFilters = DEFAULT_TRAINER_LIST_FILTERS,
) {
  return items.filter((item) =>
    isTrainerSearchMatch(item, query) &&
    isTrainerStatusMatch(item, filters.status) &&
    isTrainerPasswordMatch(item, filters.password),
  )
}

export function countActiveTrainerFilters(filters: TrainerListFilters) {
  return Number(filters.status !== 'all') + Number(filters.password !== 'all')
}

function isTrainerStatusMatch(
  item: TrainerSearchItem,
  status: TrainerStatusFilter,
) {
  return status === 'all' || item.isActive === false
}

function isTrainerPasswordMatch(
  item: TrainerSearchItem,
  password: TrainerPasswordFilter,
) {
  return password === 'all' || item.mustChangePassword === true
}
