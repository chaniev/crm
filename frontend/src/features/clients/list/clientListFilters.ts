import type {
  ClientListItem,
  ClientPaymentStatus,
  ClientStatus,
  GetClientsParams,
  MembershipType,
} from '../../../lib/api'

export type ClientStatusFilter = ClientStatus | 'all'
export type ClientPaymentStatusFilter = ClientPaymentStatus | 'all'

export type ClientListFilterValues = {
  query: string
  groupId: string | null
  status: ClientStatusFilter
  paymentStatus: ClientPaymentStatusFilter
  membershipExpiresFrom: string
  membershipExpiresTo: string
  withoutPhoto: boolean
  withoutMembership: boolean
  expiringSoon: boolean
  withoutGroup: boolean
  trial: boolean
  pageSize: string
}

export type ClientGroupFilterOption = {
  value: string
  label: string
}

export const clientListPageSizeOptions = [
  { value: '20', label: '20 на странице' },
  { value: '50', label: '50 на странице' },
  { value: '100', label: '100 на странице' },
] as const

export const clientPaymentStatusFilterOptions = [
  { value: 'Paid', label: 'Оплаченные' },
  { value: 'Unpaid', label: 'Неоплаченные' },
] satisfies Array<{ value: ClientPaymentStatus; label: string }>

export function createDefaultClientListFilters(): ClientListFilterValues {
  return {
    query: '',
    groupId: null,
    status: 'Active',
    paymentStatus: 'all',
    membershipExpiresFrom: '',
    membershipExpiresTo: '',
    withoutPhoto: false,
    withoutMembership: false,
    expiringSoon: false,
    withoutGroup: false,
    trial: false,
    pageSize: clientListPageSizeOptions[0].value,
  }
}

export function normalizeClientListFilters(
  filters: ClientListFilterValues,
): ClientListFilterValues {
  const hasKnownPageSize = clientListPageSizeOptions.some(
    (option) => option.value === filters.pageSize,
  )

  return {
    query: filters.query.trim(),
    groupId: filters.groupId,
    status: filters.status,
    paymentStatus: filters.paymentStatus,
    membershipExpiresFrom: filters.membershipExpiresFrom,
    membershipExpiresTo: filters.membershipExpiresTo,
    withoutPhoto: filters.withoutPhoto,
    withoutMembership: filters.withoutMembership,
    expiringSoon: filters.expiringSoon,
    withoutGroup: filters.withoutGroup,
    trial: filters.trial,
    pageSize: hasKnownPageSize
      ? filters.pageSize
      : clientListPageSizeOptions[0].value,
  }
}

export function hasClientListFilters(filters: ClientListFilterValues) {
  return countClientListFilters(filters) > 0
}

export function countClientListFilters(filters: ClientListFilterValues) {
  let count = 0

  if (filters.query) {
    count += 1
  }

  if (filters.groupId) {
    count += 1
  }

  if (filters.status !== 'Active') {
    count += 1
  }

  if (filters.paymentStatus !== 'all') {
    count += 1
  }

  if (filters.membershipExpiresFrom) {
    count += 1
  }

  if (filters.membershipExpiresTo) {
    count += 1
  }

  if (filters.withoutPhoto) {
    count += 1
  }

  if (filters.withoutMembership) {
    count += 1
  }

  if (filters.expiringSoon) {
    count += 1
  }

  if (filters.withoutGroup) {
    count += 1
  }

  if (filters.trial) {
    count += 1
  }

  return count
}

export function toClientListQueryParams(
  filters: ClientListFilterValues,
  page: number,
) {
  const normalizedFilters = normalizeClientListFilters(filters)
  const pageSize = Number.parseInt(normalizedFilters.pageSize, 10) || 20
  const membershipExpiresTo =
    normalizedFilters.expiringSoon && !normalizedFilters.membershipExpiresTo
      ? getDateValueAfterDays(7)
      : normalizedFilters.membershipExpiresTo

  return {
    page,
    pageSize,
    query: normalizedFilters.query || undefined,
    groupId: normalizedFilters.groupId ?? undefined,
    status:
      normalizedFilters.status === 'all'
        ? undefined
        : normalizedFilters.expiringSoon
          ? 'Active'
          : normalizedFilters.status,
    paymentStatus:
      normalizedFilters.paymentStatus === 'all'
        ? undefined
        : normalizedFilters.paymentStatus,
    membershipState: normalizedFilters.withoutMembership ? 'None' : undefined,
    membershipType: normalizedFilters.trial
      ? ('SingleVisit' satisfies MembershipType)
      : undefined,
    membershipExpiresFrom:
      normalizedFilters.membershipExpiresFrom || undefined,
    membershipExpiresTo: membershipExpiresTo || undefined,
    hasPhoto: normalizedFilters.withoutPhoto ? false : undefined,
    hasGroup: normalizedFilters.withoutGroup ? false : undefined,
  } satisfies GetClientsParams
}

export function mergeClientGroupFilterOptions(
  currentOptions: ClientGroupFilterOption[],
  clients: ClientListItem[],
) {
  return mergeStaticGroupFilterOptions(
    currentOptions,
    clients.flatMap((client) =>
      client.groups.map((group) => ({
        value: group.id,
        label: group.name,
      })),
    ),
  )
}

export function mergeStaticGroupFilterOptions(
  ...optionSets: ClientGroupFilterOption[][]
) {
  const optionsById = new Map<string, ClientGroupFilterOption>()

  for (const optionSet of optionSets) {
    for (const option of optionSet) {
      const value = option.value.trim()
      const label = option.label.trim()

      if (!value || !label || optionsById.has(value)) {
        continue
      }

      optionsById.set(value, {
        value,
        label,
      })
    }
  }

  return Array.from(optionsById.values()).sort((left, right) =>
    left.label.localeCompare(right.label, 'ru'),
  )
}

function getDateValueAfterDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}
