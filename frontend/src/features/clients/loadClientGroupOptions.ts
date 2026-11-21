import { getGroups, type TrainingGroupListItem } from '../../lib/api'

export async function loadClientGroupOptions(signal: AbortSignal, isActive?: boolean) {
  const take = 100
  const groups: TrainingGroupListItem[] = []
  let skip = 0
  let totalCount = Number.POSITIVE_INFINITY

  while (groups.length < totalCount) {
    const page = await getGroups({ skip, take, isActive }, signal)
    if (!page) {
      break
    }
    groups.push(...page.items)
    totalCount = page.totalCount
    skip += page.items.length

    if (page.items.length === 0) {
      break
    }
  }

  return groups
}
