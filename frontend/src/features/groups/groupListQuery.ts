export type GroupStatusFilter = 'all' | 'active' | 'inactive'

export type GroupListFilters = {
  appliedQuery: string
  isActive: boolean | null
  withoutTrainer: boolean
}

export type GroupListQueryParams = {
  page: number
  pageSize: number
  query?: string
  isActive?: boolean
  withoutTrainer?: boolean
}

export const GROUP_LIST_PAGE_SIZE = 10

export function createDefaultGroupListFilters(): GroupListFilters {
  return {
    appliedQuery: '',
    isActive: null,
    withoutTrainer: false,
  }
}

export function normalizeGroupSearchQuery(query: string) {
  return query.trim()
}

export function toGroupStatusFilter(isActive: boolean | null): GroupStatusFilter {
  if (isActive === true) return 'active'
  if (isActive === false) return 'inactive'
  return 'all'
}

export function fromGroupStatusFilter(status: GroupStatusFilter) {
  if (status === 'active') return true
  if (status === 'inactive') return false
  return null
}

export function normalizeGroupListFilters(
  filters: Partial<GroupListFilters>,
): GroupListFilters {
  return {
    appliedQuery: normalizeGroupSearchQuery(filters.appliedQuery ?? ''),
    isActive:
      typeof filters.isActive === 'boolean'
        ? filters.isActive
        : null,
    withoutTrainer: filters.withoutTrainer === true,
  }
}

export function countGroupListFilters(filters: GroupListFilters) {
  return (
    (filters.isActive === null ? 0 : 1) +
    (filters.withoutTrainer ? 1 : 0)
  )
}

export function hasGroupListCriteria(filters: GroupListFilters) {
  return Boolean(
    filters.appliedQuery ||
      filters.isActive !== null ||
      filters.withoutTrainer,
  )
}

export function toGroupListQueryParams(
  filters: GroupListFilters,
  page: number,
  pageSize = GROUP_LIST_PAGE_SIZE,
): GroupListQueryParams {
  return {
    page: sanitizePositivePage(page),
    pageSize,
    ...(filters.appliedQuery ? { query: filters.appliedQuery } : null),
    ...(filters.isActive === null ? null : { isActive: filters.isActive }),
    ...(filters.withoutTrainer ? { withoutTrainer: true } : null),
  }
}

export function getGroupListRange(
  itemCount: number,
  page: number,
  pageSize = GROUP_LIST_PAGE_SIZE,
) {
  const safePage = sanitizePositivePage(page)
  const start = itemCount === 0 ? 0 : (safePage - 1) * pageSize + 1
  const end = itemCount === 0 ? 0 : start + itemCount - 1

  return { start, end }
}

export function getGroupListMaxPage(totalCount: number, pageSize = GROUP_LIST_PAGE_SIZE) {
  return Math.max(1, Math.ceil(Math.max(0, totalCount) / pageSize))
}

export function sanitizePositivePage(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : 1
}
