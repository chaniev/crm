import {
  API_ENDPOINTS,
  CLIENTS_DEFAULT_PAGE,
  CLIENTS_DEFAULT_PAGE_SIZE,
  CLIENTS_QUERY_KEYS,
  CLIENT_ATTENDANCE_HISTORY_ITEM_PAYLOAD_KEYS,
  CLIENT_ATTENDANCE_HISTORY_PAYLOAD_KEYS,
  CLIENT_CONTACT_PAYLOAD_KEYS,
  CLIENT_EXPIRING_MEMBERSHIP_PAYLOAD_KEYS,
  CLIENT_LIST_PAYLOAD_KEYS,
  CLIENT_MEMBERSHIP_PAYLOAD_KEYS,
  apiBasePath,
} from './endpoints'
import {
  buildClientFullName,
  buildDisplayNameFromParts,
  deriveHasActivePaidMembership,
  deriveMembershipWarning,
  mapClientCurrentMembership,
  mapClientGroups,
  mapClientMembership,
  mapClientPhoto,
  mapClientStatus,
  mapMembershipType,
  normalizeIsoDateValue,
} from './mappers'
import {
  appendBooleanSearchParam,
  appendSearchParam,
  extractArrayPayload,
  extractClientsPagination,
  extractRecordPayload,
  hasProperty,
  isRecord,
  readBoolean,
  readNumber,
  readString,
} from './read-helpers'
import { request } from './transport'
import type {
  ClientAttendanceHistoryEntry,
  ClientAttendanceHistoryPayload,
  ClientContact,
  ClientContactPayload,
  ClientDetails,
  ClientListItem,
  ClientListResponse,
  ClientMembership,
  ClientMembershipPayload,
  ClientResponsePayload,
  CorrectClientMembershipRequest,
  ExpiringClientMembership,
  GetClientsParams,
  MarkClientMembershipPaymentRequest,
  PurchaseClientMembershipRequest,
  RenewClientMembershipRequest,
  UpsertClientRequest,
} from './types'

export async function getClients(
  params: GetClientsParams = {},
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams()

  if (typeof params.page === 'number') {
    searchParams.set(CLIENTS_QUERY_KEYS.page, String(params.page))
  } else if (typeof params.pageSize === 'number') {
    searchParams.set(CLIENTS_QUERY_KEYS.page, String(CLIENTS_DEFAULT_PAGE))
  }

  if (typeof params.pageSize === 'number') {
    searchParams.set(CLIENTS_QUERY_KEYS.pageSize, String(params.pageSize))
  }

  if (typeof params.skip === 'number') {
    searchParams.set(CLIENTS_QUERY_KEYS.skip, String(params.skip))
  }

  if (typeof params.take === 'number') {
    searchParams.set(CLIENTS_QUERY_KEYS.take, String(params.take))
  }

  appendSearchParam(searchParams, CLIENTS_QUERY_KEYS.fullName, params.fullName)
  appendSearchParam(searchParams, CLIENTS_QUERY_KEYS.query, params.query)
  appendSearchParam(searchParams, CLIENTS_QUERY_KEYS.search, params.search)
  appendSearchParam(searchParams, CLIENTS_QUERY_KEYS.phone, params.phone)
  appendSearchParam(searchParams, CLIENTS_QUERY_KEYS.groupId, params.groupId)
  appendSearchParam(searchParams, CLIENTS_QUERY_KEYS.status, params.status)
  appendSearchParam(
    searchParams,
    CLIENTS_QUERY_KEYS.paymentStatus,
    params.paymentStatus,
  )
  appendSearchParam(
    searchParams,
    CLIENTS_QUERY_KEYS.membershipState,
    params.membershipState,
  )
  appendSearchParam(
    searchParams,
    CLIENTS_QUERY_KEYS.membershipType,
    params.membershipType,
  )
  appendSearchParam(
    searchParams,
    CLIENTS_QUERY_KEYS.membershipExpiresFrom,
    params.membershipExpiresFrom,
  )
  appendSearchParam(
    searchParams,
    CLIENTS_QUERY_KEYS.membershipExpiresTo,
    params.membershipExpiresTo,
  )
  appendBooleanSearchParam(searchParams, CLIENTS_QUERY_KEYS.hasPhoto, params.hasPhoto)
  appendBooleanSearchParam(searchParams, CLIENTS_QUERY_KEYS.hasGroup, params.hasGroup)
  appendBooleanSearchParam(
    searchParams,
    CLIENTS_QUERY_KEYS.hasCurrentMembership,
    params.hasCurrentMembership,
  )
  appendBooleanSearchParam(
    searchParams,
    CLIENTS_QUERY_KEYS.hasActivePaidMembership,
    params.hasActivePaidMembership,
  )

  if (
    !searchParams.has(CLIENTS_QUERY_KEYS.page) &&
    !searchParams.has(CLIENTS_QUERY_KEYS.pageSize) &&
    !searchParams.has(CLIENTS_QUERY_KEYS.skip) &&
    !searchParams.has(CLIENTS_QUERY_KEYS.take)
  ) {
    searchParams.set(CLIENTS_QUERY_KEYS.page, String(CLIENTS_DEFAULT_PAGE))
    searchParams.set(
      CLIENTS_QUERY_KEYS.pageSize,
      String(CLIENTS_DEFAULT_PAGE_SIZE),
    )
  }

  const payload = await request<unknown>(
    `${API_ENDPOINTS.clients.collection}?${searchParams.toString()}`,
    { signal },
  )

  const items = extractArrayPayload<ClientResponsePayload>(
    payload,
    CLIENT_LIST_PAYLOAD_KEYS,
  ).map(mapClientListItem)
  const pagination = extractClientsPagination(payload, params, items.length)
  const counts = extractClientListCounts(payload)

  return {
    items,
    totalCount: pagination.totalCount,
    activeCount: counts.activeCount,
    archivedCount: counts.archivedCount,
    skip: pagination.skip,
    take: pagination.take,
    page: pagination.page,
    pageSize: pagination.pageSize,
    hasNextPage:
      pagination.totalCount !== null
        ? pagination.skip + items.length < pagination.totalCount
        : items.length >= pagination.take,
  } satisfies ClientListResponse
}

export async function getClient(clientId: string, signal?: AbortSignal) {
  const payload = await request<ClientResponsePayload>(
    API_ENDPOINTS.clients.byId(clientId),
    { signal },
  )

  return mapClientDetails(payload)
}

export async function getExpiringClientMemberships(signal?: AbortSignal) {
  const payload = await request<unknown>(API_ENDPOINTS.clients.expiringMemberships, {
    signal,
  })

  return extractArrayPayload<Record<string, unknown>>(
    payload,
    CLIENT_EXPIRING_MEMBERSHIP_PAYLOAD_KEYS,
  )
    .map((membership) => mapExpiringClientMembership(membership))
    .filter(
      (membership): membership is ExpiringClientMembership => membership !== null,
    )
}

export async function createClient(payload: UpsertClientRequest) {
  const response = await request<ClientResponsePayload | null>(
    API_ENDPOINTS.clients.collection,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )

  return response ? mapClientDetails(response) : null
}

export async function updateClient(
  clientId: string,
  payload: UpsertClientRequest,
) {
  const response = await request<ClientResponsePayload | null>(
    API_ENDPOINTS.clients.byId(clientId),
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  )

  return response ? mapClientDetails(response) : null
}

export function buildClientPhotoUrl(
  clientId: string,
  version?: string | number | null,
) {
  const versionSuffix =
    version === undefined || version === null || version === ''
      ? ''
      : `?v=${encodeURIComponent(String(version))}`

  return `${apiBasePath}${API_ENDPOINTS.clients.photo(clientId)}${versionSuffix}`
}

export async function uploadClientPhoto(clientId: string, file: File) {
  const payload = new FormData()
  payload.append('photo', file)

  await request<unknown>(
    API_ENDPOINTS.clients.photo(clientId),
    {
      method: 'POST',
      body: payload,
    },
  )

  return null
}

export async function archiveClient(clientId: string) {
  return request<void>(API_ENDPOINTS.clients.archive(clientId), {
    method: 'PUT',
  })
}

export async function restoreClient(clientId: string) {
  return request<void>(API_ENDPOINTS.clients.restore(clientId), {
    method: 'PUT',
  })
}

export async function purchaseClientMembership(
  clientId: string,
  payload: PurchaseClientMembershipRequest,
) {
  const response = await request<ClientResponsePayload | null>(
    API_ENDPOINTS.clients.membership.purchase(clientId),
    {
      method: 'POST',
      body: JSON.stringify({
        MembershipType: payload.membershipType,
        PurchaseDate: payload.purchaseDate,
        ExpirationDate: payload.expirationDate,
        PaymentAmount: payload.paymentAmount,
        IsPaid: payload.isPaid,
        SingleVisitUsed: payload.singleVisitUsed ?? false,
      }),
    },
  )

  return response ? mapClientDetails(response) : null
}

export async function renewClientMembership(
  clientId: string,
  payload: RenewClientMembershipRequest,
) {
  const response = await request<ClientResponsePayload | null>(
    API_ENDPOINTS.clients.membership.renew(clientId),
    {
      method: 'POST',
      body: JSON.stringify({
        MembershipType: payload.membershipType,
        RenewalDate: payload.renewalDate,
        PaymentDate: payload.paymentDate,
        ExpirationDate: payload.expirationDate,
        PaymentAmount: payload.paymentAmount,
        IsPaid: payload.isPaid,
      }),
    },
  )

  return response ? mapClientDetails(response) : null
}

export async function correctClientMembership(
  clientId: string,
  payload: CorrectClientMembershipRequest,
) {
  const response = await request<ClientResponsePayload | null>(
    API_ENDPOINTS.clients.membership.correct(clientId),
    {
      method: 'POST',
      body: JSON.stringify({
        MembershipType: payload.membershipType,
        PurchaseDate: payload.purchaseDate,
        ExpirationDate: payload.expirationDate,
        PaymentAmount: payload.paymentAmount,
        IsPaid: payload.isPaid,
        SingleVisitUsed: payload.singleVisitUsed ?? false,
      }),
    },
  )

  return response ? mapClientDetails(response) : null
}

export async function markClientMembershipPayment(
  clientId: string,
  payload: MarkClientMembershipPaymentRequest,
) {
  const response = await request<ClientResponsePayload | null>(
    API_ENDPOINTS.clients.membership.markPayment(clientId),
    {
      method: 'POST',
      body: JSON.stringify({
        MembershipType: payload.membershipType,
        PaymentAmount: payload.paymentAmount,
        IsPaid: payload.isPaid,
      }),
    },
  )

  return response ? mapClientDetails(response) : null
}

function mapClientListItem(payload: ClientResponsePayload): ClientListItem {
  const contacts = mapClientContacts(payload)
  const groups = mapClientGroups(payload)
  const fullName = buildClientFullName(payload)
  const currentMembership = mapClientCurrentMembership(payload)
  const currentMembershipSummary = currentMembership
  const warningMessage =
    readString(payload, [
      'warning',
      'Warning',
      'warningMessage',
      'WarningMessage',
      'membershipWarningMessage',
      'MembershipWarningMessage',
      'membershipStatusMessage',
      'MembershipStatusMessage',
    ]) ?? undefined
  const hasActivePaidMembership =
    readBoolean(payload, [
      'hasActivePaidMembership',
      'HasActivePaidMembership',
    ]) ?? deriveHasActivePaidMembership(currentMembership, new Date().toISOString())
  const hasUnpaidCurrentMembership =
    readBoolean(payload, [
      'hasUnpaidCurrentMembership',
      'HasUnpaidCurrentMembership',
    ]) ?? (currentMembership ? !currentMembership.isPaid : false)
  const membershipWarning =
    readBoolean(payload, [
      'hasWarning',
      'HasWarning',
      'membershipWarning',
      'MembershipWarning',
      'hasMembershipWarning',
      'HasMembershipWarning',
      'membershipWarningVisible',
      'MembershipWarningVisible',
      'hasMembershipIssue',
      'HasMembershipIssue',
    ]) ??
    (Boolean(warningMessage) ||
      deriveMembershipWarning(
        currentMembership,
        hasUnpaidCurrentMembership,
        new Date().toISOString(),
      ))

  return {
    id: payload.id,
    fullName,
    lastName: payload.lastName?.trim() ?? '',
    firstName: payload.firstName?.trim() ?? '',
    middleName: payload.middleName?.trim() ?? '',
    phone: payload.phone?.trim() ?? '',
    status: mapClientStatus(payload.status),
    contactCount: payload.contactCount ?? contacts.length,
    groupCount: payload.groupCount ?? groups.length,
    groups,
    photo: mapClientPhoto(payload),
    hasActivePaidMembership,
    hasUnpaidCurrentMembership,
    membershipWarning,
    membershipWarningMessage: warningMessage,
    currentMembership,
    currentMembershipSummary,
    hasCurrentMembership:
      readBoolean(payload, ['hasCurrentMembership', 'HasCurrentMembership']) ??
      Boolean(currentMembershipSummary),
    membershipState: mapClientMembershipState(
      readString(payload, ['membershipState', 'MembershipState']),
      currentMembershipSummary,
      hasActivePaidMembership,
      hasUnpaidCurrentMembership,
    ),
    lastVisitDate:
      readString(payload, ['lastVisitDate', 'LastVisitDate']) ?? null,
    updatedAt: payload.updatedAt,
  }
}

function extractClientListCounts(payload: unknown) {
  const envelope = isRecord(payload) ? payload : null
  const nestedEnvelope = envelope?.data

  return {
    activeCount:
      (envelope
        ? readNumber(envelope, ['activeCount', 'ActiveCount'])
        : undefined) ??
      (isRecord(nestedEnvelope)
        ? readNumber(nestedEnvelope, ['activeCount', 'ActiveCount'])
        : undefined) ??
      null,
    archivedCount:
      (envelope
        ? readNumber(envelope, ['archivedCount', 'ArchivedCount'])
        : undefined) ??
      (isRecord(nestedEnvelope)
        ? readNumber(nestedEnvelope, ['archivedCount', 'ArchivedCount'])
        : undefined) ??
      null,
  }
}

function mapClientMembershipState(
  state: string | undefined,
  currentMembership: ClientMembership | null,
  hasActivePaidMembership: boolean,
  hasUnpaidCurrentMembership: boolean,
) {
  if (
    state === 'None' ||
    state === 'ActivePaid' ||
    state === 'Unpaid' ||
    state === 'Expired' ||
    state === 'UsedSingleVisit'
  ) {
    return state
  }

  if (!currentMembership) {
    return 'None'
  }

  if (hasUnpaidCurrentMembership) {
    return 'Unpaid'
  }

  if (hasActivePaidMembership) {
    return 'ActivePaid'
  }

  if (currentMembership.membershipType === 'SingleVisit' && currentMembership.singleVisitUsed) {
    return 'UsedSingleVisit'
  }

  return 'Expired'
}

function mapExpiringClientMembership(
  payload: Record<string, unknown>,
): ExpiringClientMembership | null {
  const clientId =
    readString(payload, ['clientId', 'ClientId', 'id', 'Id']) ?? ''
  const fullName =
    readString(payload, ['fullName', 'FullName']) ??
    buildDisplayNameFromParts(
      readString(payload, ['lastName', 'LastName']),
      readString(payload, ['firstName', 'FirstName']),
      readString(payload, ['middleName', 'MiddleName']),
    ) ??
    'Без имени'
  const membershipType = mapMembershipType(
    readString(payload, ['membershipType', 'MembershipType']),
  )
  const expirationDate = normalizeIsoDateValue(
    readString(payload, ['expirationDate', 'ExpirationDate']),
  )

  if (!clientId || !membershipType || !expirationDate) {
    return null
  }

  return {
    clientId,
    fullName,
    membershipType,
    expirationDate,
    daysUntilExpiration:
      readNumber(payload, ['daysUntilExpiration', 'DaysUntilExpiration']) ?? 0,
    isPaid: readBoolean(payload, ['isPaid', 'IsPaid']) ?? false,
  }
}

function mapClientDetails(payload: ClientResponsePayload): ClientDetails {
  const listItem = mapClientListItem(payload)
  const groupIds =
    payload.groupIds?.filter((groupId): groupId is string => Boolean(groupId)) ??
    listItem.groups.map((group) => group.id)
  const attendanceHistory = mapClientAttendanceHistory(payload)

  return {
    ...listItem,
    contacts: mapClientContacts(payload),
    createdAt: payload.createdAt,
    groupIds,
    photo: mapClientPhoto(payload),
    currentMembership: mapClientCurrentMembership(payload),
    membershipHistory: mapClientMembershipHistory(payload),
    attendanceHistory: attendanceHistory.items,
    attendanceHistoryLoaded: attendanceHistory.loaded,
    attendanceHistoryTotalCount: attendanceHistory.totalCount,
  }
}

function mapClientMembershipHistory(
  payload: ClientResponsePayload,
): ClientMembership[] {
  return extractArrayPayload<ClientMembershipPayload>(
    payload,
    CLIENT_MEMBERSHIP_PAYLOAD_KEYS,
  )
    .map((membership) => mapClientMembership(membership))
    .filter((membership): membership is ClientMembership => membership !== null)
}

function mapClientAttendanceHistory(payload: ClientResponsePayload): {
  items: ClientAttendanceHistoryEntry[]
  loaded: boolean
  totalCount: number | null
} {
  const sourcePayload = extractRecordPayload(
    payload,
    CLIENT_ATTENDANCE_HISTORY_PAYLOAD_KEYS,
  )
  const historyItems = (
    sourcePayload
      ? extractArrayPayload<ClientAttendanceHistoryPayload>(
          sourcePayload,
          CLIENT_ATTENDANCE_HISTORY_ITEM_PAYLOAD_KEYS,
        )
      : extractArrayPayload<ClientAttendanceHistoryPayload>(
          payload,
          CLIENT_ATTENDANCE_HISTORY_PAYLOAD_KEYS,
        )
  )
    .map((entry) => mapClientAttendanceHistoryEntry(entry))
    .filter(
      (entry): entry is ClientAttendanceHistoryEntry => entry !== null,
    )
  const sourceData =
    sourcePayload && isRecord(sourcePayload.data) ? sourcePayload.data : null
  const loaded = hasProperty(payload, CLIENT_ATTENDANCE_HISTORY_PAYLOAD_KEYS)
  const totalCount =
    (sourcePayload
      ? readNumber(sourcePayload, ['totalCount', 'TotalCount'])
      : undefined) ??
    (sourceData ? readNumber(sourceData, ['totalCount', 'TotalCount']) : undefined) ??
    readNumber(payload, [
      'attendanceHistoryTotalCount',
      'AttendanceHistoryTotalCount',
      'visitHistoryTotalCount',
      'VisitHistoryTotalCount',
    ]) ??
    (loaded ? historyItems.length : null)

  return {
    items: historyItems,
    loaded,
    totalCount,
  }
}

function mapClientContacts(payload: ClientResponsePayload): ClientContact[] {
  return extractArrayPayload<ClientContactPayload>(
    payload.contacts,
    CLIENT_CONTACT_PAYLOAD_KEYS,
  ).map((contact) => ({
    id: contact.id,
    type: contact.type?.trim() ?? '',
    fullName: contact.fullName?.trim() ?? '',
    phone: contact.phone?.trim() ?? '',
  }))
}

function mapClientAttendanceHistoryEntry(
  payload: unknown,
): ClientAttendanceHistoryEntry | null {
  if (!isRecord(payload)) {
    return null
  }

  const groupPayload = extractRecordPayload(payload, ['group', 'Group'])
  const trainingDate =
    readString(payload, ['trainingDate', 'TrainingDate', 'date', 'Date']) ?? ''
  const isPresent = readBoolean(payload, [
    'isPresent',
    'IsPresent',
    'present',
    'Present',
  ])

  if (!trainingDate || typeof isPresent !== 'boolean') {
    return null
  }

  const groupId =
    readString(payload, ['groupId', 'GroupId']) ??
    (groupPayload ? readString(groupPayload, ['id', 'Id']) : undefined)
  const groupName =
    readString(payload, [
      'groupName',
      'GroupName',
      'trainingGroupName',
      'TrainingGroupName',
    ]) ??
    (groupPayload
      ? readString(groupPayload, ['name', 'Name', 'groupName', 'GroupName'])
      : undefined) ??
    'Группа без названия'

  return {
    id:
      readString(payload, ['id', 'Id']) ??
      `${groupId ?? groupName}-${trainingDate}-${isPresent ? 'present' : 'absent'}`,
    groupId: groupId ?? undefined,
    groupName,
    trainingDate,
    isPresent,
  }
}
