import type { UserListItem } from '../../lib/api'

type TrainerSearchItem = Pick<UserListItem, 'fullName' | 'login'>

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
) {
  return items.filter((item) => isTrainerSearchMatch(item, query))
}
