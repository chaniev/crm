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
  mapClientCurrentMemberships,
  mapClientGroups,
  mapClientMembership,
  mapClientPhoto,
  mapClientStatus,
  mapMembershipBehaviorKind,
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
  ClientAttentionItem,
  ClientAttentionReason,
  ClientAttendanceHistoryPayload,
  ClientContact,
  ClientContactPayload,
  ClientDetails,
  ClientListItem,
  ClientListResponse,
  ClientMembership,
  ClientMembershipPayload,
  ClientMembershipTargetGroup,
  ClientQuickFilterCounts,
  ClientResponsePayload,
  CorrectClientMembershipRequest,
  GetClientsParams,
  MembershipAttentionItem,
  MembershipAttentionState,
  MembershipExpirationSuggestion,
  MembershipBehaviorKind,
  MembershipTargetTransferPreview,
  MembershipTargetTransferPreviewMembership,
  MembershipTargetTransferRequest,
  MembershipWriteRequestOptions,
  PurchaseClientMembershipRequest,
  RenewClientMembershipRequest,
  TransferClientBranchRequest,
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
  if (isSupportedClientMembershipState(params.membershipState)) {
    appendSearchParam(
      searchParams,
      CLIENTS_QUERY_KEYS.membershipState,
      params.membershipState,
    )
  }
  appendSearchParam(
    searchParams,
    CLIENTS_QUERY_KEYS.behaviorKind,
    params.behaviorKind,
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
  if (params.quickFilters?.length) {
    searchParams.set(CLIENTS_QUERY_KEYS.quickFilters, params.quickFilters.join(','))
  }

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
    quickFilterCounts: counts.quickFilterCounts,
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

export async function getMembershipAttentionItems(signal?: AbortSignal) {
  const payload = await request<unknown>(API_ENDPOINTS.clients.expiringMemberships, {
    signal,
  })

  return extractArrayPayload<Record<string, unknown>>(
    payload,
    CLIENT_EXPIRING_MEMBERSHIP_PAYLOAD_KEYS,
  )
    .map((membership) => mapMembershipAttentionItem(membership))
    .filter(
      (membership): membership is MembershipAttentionItem => membership !== null,
    )
}

export async function getClientAttentionItems(signal?: AbortSignal) {
  const payload = await request<unknown>(API_ENDPOINTS.clients.attention, { signal })
  return extractArrayPayload<Record<string, unknown>>(payload, ['items', 'Items'])
    .map(mapClientAttentionItem)
    .filter((item): item is ClientAttentionItem => item !== null)
}

export async function markMissedTrainingContacted(clientId: string) {
  const payload = await request<unknown>(
    API_ENDPOINTS.clients.missedTrainingContacted(clientId),
    { method: 'POST' },
  )
  if (payload === null || payload === undefined) return null
  return isRecord(payload) ? mapClientAttentionItem(payload) : null
}

export function mapClientAttentionItem(payload: Record<string, unknown>): ClientAttentionItem | null {
  const clientId = readString(payload, ['clientId', 'ClientId'])
  const fullName = readString(payload, ['fullName', 'FullName'])
  if (!clientId || !fullName) return null
  const rawReasons = extractArrayPayload<Record<string, unknown>>(payload, ['reasons', 'Reasons'])
  const reasons = rawReasons.map(mapClientAttentionReason).filter((reason): reason is ClientAttentionReason => reason !== null)
  return {
    clientId,
    fullName,
    phone: readString(payload, ['phone', 'Phone']) ?? null,
    notes: readString(payload, ['notes', 'Notes']) ?? null,
    membership: mapClientAttentionMembership(payload),
    telegramLink: readString(payload, ['telegramLink', 'TelegramLink']) ?? null,
    reasons,
  }
}

function mapClientAttentionReason(payload: Record<string, unknown>): ClientAttentionReason | null {
  const type = readString(payload, ['type', 'Type', 'kind', 'Kind'])
  if (type === 'missedTraining' || type === 'MissedTraining') {
    const missedCount = readNumber(payload, ['missedCount', 'MissedCount'])
    return missedCount === undefined ? null : { type: 'missedTraining', missedCount }
  }
  if (type === 'expiredMembership' || type === 'ExpiredMembership' || type === 'expiringMembership' || type === 'ExpiringMembership') {
    const membershipId = readString(payload, ['membershipId', 'MembershipId'])
    const saleId = readString(payload, ['saleId', 'SaleId'])
    const targetGroups = mapAttentionTargetGroups(payload)

    if (!membershipId || !saleId) {
      return null
    }

    return {
      type: type.toLowerCase().startsWith('expired') ? 'expiredMembership' : 'expiringMembership',
      membershipId,
      saleId,
      expirationDate: normalizeIsoDateValue(readString(payload, ['expirationDate', 'ExpirationDate'])),
      daysUntilExpiration: readNumber(payload, ['daysUntilExpiration', 'DaysUntilExpiration']) ?? null,
      targetGroups,
      targetSummary: buildAttentionTargetSummary(targetGroups),
    }
  }
  return null
}

function mapClientAttentionMembership(payload: Record<string, unknown>) {
  const value = payload.membership ?? payload.Membership
  if (!isRecord(value)) return null
  const membershipId = readString(value, ['membershipId', 'MembershipId'])
  const saleId = readString(value, ['saleId', 'SaleId'])
  const behaviorKind = mapMembershipBehaviorKind(readString(value, ['behaviorKind', 'BehaviorKind']))
  if (!membershipId || !saleId || !behaviorKind) return null
  const targetGroups = mapAttentionTargetGroups(value)
  return {
    membershipId,
    saleId,
    behaviorKind,
    membershipName: readString(value, ['membershipName', 'MembershipName']) ?? '',
    expirationDate: normalizeIsoDateValue(readString(value, ['expirationDate', 'ExpirationDate'])),
    daysUntilExpiration: readNumber(value, ['daysUntilExpiration', 'DaysUntilExpiration']) ?? null,
    targetGroups,
    targetSummary: buildAttentionTargetSummary(targetGroups),
  }
}

export async function getExpiringClientMemberships(signal?: AbortSignal) {
  return getMembershipAttentionItems(signal)
}

export async function getMembershipExpirationSuggestion(
  behaviorKind: MembershipBehaviorKind,
  startDate: string,
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams()
  searchParams.set('behaviorKind', behaviorKind)
  searchParams.set('startDate', startDate)

  const payload = await request<unknown>(
    `${API_ENDPOINTS.clients.membership.expirationSuggestion}?${searchParams.toString()}`,
    { signal },
  )

  return mapMembershipExpirationSuggestion(payload)
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

export async function transferClientBranch(
  clientId: string,
  payload: TransferClientBranchRequest,
  options: MembershipWriteRequestOptions,
) {
  const response = await request<ClientResponsePayload | null>(
    API_ENDPOINTS.clients.transfer(clientId),
    {
      method: 'POST',
      headers: membershipWriteHeaders(options),
      body: JSON.stringify({
        targetBranchId: payload.targetBranchId,
        targetGroupIds: payload.targetGroupIds,
      }),
    },
  )

  return response ? mapClientDetails(response) : null
}

function isSupportedClientMembershipState(
  value: unknown,
): value is GetClientsParams['membershipState'] {
  return (
    value === 'None' ||
    value === 'Active' ||
    value === 'Expired' ||
    value === 'UsedSingleVisit'
  )
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
  options: MembershipWriteRequestOptions,
) {
  const response = await request<ClientResponsePayload | null>(
    API_ENDPOINTS.clients.membership.purchase(clientId),
    {
      method: 'POST',
      headers: membershipWriteHeaders(options),
      body: JSON.stringify({
        MembershipCatalogItemId: payload.membershipCatalogItemId,
        ManualSaleAmount: payload.manualSaleAmount,
        ValidFrom: payload.validFrom,
        ValidTo: payload.validTo,
        PaymentDate: payload.paymentDate,
        TargetGroupIds: payload.targetGroupIds,
        ProfessionalComment: payload.professionalComment,
      }),
    },
  )

  return response ? mapClientDetails(response) : null
}

export async function renewClientMembership(
  clientId: string,
  payload: RenewClientMembershipRequest,
  options: MembershipWriteRequestOptions,
) {
  const response = await request<ClientResponsePayload | null>(
    API_ENDPOINTS.clients.membership.renew(clientId),
    {
      method: 'POST',
      headers: membershipWriteHeaders(options),
      body: JSON.stringify({
        MembershipCatalogItemId: payload.membershipCatalogItemId,
        ManualSaleAmount: payload.manualSaleAmount,
        SaleId: payload.saleId,
        ExpectedMembershipId: payload.expectedMembershipId,
        PaymentDate: payload.paymentDate,
        TargetGroupIds: payload.targetGroupIds,
        ProfessionalComment: payload.professionalComment,
      }),
    },
  )

  return response ? mapClientDetails(response) : null
}

export async function correctClientMembership(
  clientId: string,
  payload: CorrectClientMembershipRequest,
  options: MembershipWriteRequestOptions,
) {
  const response = await request<ClientResponsePayload | null>(
    API_ENDPOINTS.clients.membership.correct(clientId),
    {
      method: 'POST',
      headers: membershipWriteHeaders(options),
      body: JSON.stringify({
        SaleId: payload.saleId,
        ExpectedMembershipId: payload.expectedMembershipId,
        ValidFrom: payload.validFrom,
        ValidTo: payload.validTo,
        PaymentDate: payload.paymentDate,
        TargetGroupIds: payload.targetGroupIds,
      }),
    },
  )

  return response ? mapClientDetails(response) : null
}

export async function previewClientMembershipTargetTransfer(
  clientId: string,
  payload: MembershipTargetTransferRequest,
  signal?: AbortSignal,
) {
  const response = await request<unknown>(
    API_ENDPOINTS.clients.membership.targetTransferPreview(clientId),
    {
      method: 'POST',
      signal,
      body: JSON.stringify({
        SourceGroupId: payload.sourceGroupId,
        TargetGroupId: payload.targetGroupId,
        ExpectedMembershipIds: payload.expectedMembershipIds,
      }),
    },
  )

  return mapMembershipTargetTransferPreview(response)
}

export async function transferClientMembershipTargets(
  clientId: string,
  payload: MembershipTargetTransferRequest,
  options: MembershipWriteRequestOptions,
) {
  const response = await request<ClientResponsePayload | null>(
    API_ENDPOINTS.clients.membership.targetTransfer(clientId),
    {
      method: 'POST',
      headers: membershipWriteHeaders(options),
      body: JSON.stringify({
        SourceGroupId: payload.sourceGroupId,
        TargetGroupId: payload.targetGroupId,
        ExpectedMembershipIds: payload.expectedMembershipIds,
      }),
    },
  )

  return response ? mapClientDetails(response) : null
}

function membershipWriteHeaders(options: MembershipWriteRequestOptions) {
  return {
    'Idempotency-Key': options.idempotencyKey,
  }
}

function mapMembershipTargetTransferPreview(
  payload: unknown,
): MembershipTargetTransferPreview {
  const items = extractArrayPayload<Record<string, unknown>>(payload, [
    'affectedMemberships',
    'AffectedMemberships',
    'items',
    'Items',
  ])

  return {
    affectedMemberships: items
      .map(mapMembershipTargetTransferPreviewMembership)
      .filter(
        (membership): membership is MembershipTargetTransferPreviewMembership =>
          membership !== null,
      ),
  }
}

function mapMembershipTargetTransferPreviewMembership(
  payload: Record<string, unknown>,
): MembershipTargetTransferPreviewMembership | null {
  const membershipId = readString(payload, ['membershipId', 'MembershipId', 'id', 'Id'])
  const saleId = readString(payload, ['saleId', 'SaleId'])
  const membershipName =
    readString(payload, ['membershipName', 'MembershipName']) ?? 'Абонемент'

  if (!membershipId || !saleId) {
    return null
  }

  return {
    membershipId,
    saleId,
    membershipName,
    beforeTargetGroups: extractArrayPayload<Record<string, unknown>>(payload, [
      'beforeTargetGroups',
      'BeforeTargetGroups',
      'beforeTargets',
      'BeforeTargets',
    ]).map(mapTransferTarget).filter((target): target is NonNullable<ReturnType<typeof mapTransferTarget>> => target !== null),
    afterTargetGroups: extractArrayPayload<Record<string, unknown>>(payload, [
      'afterTargetGroups',
      'AfterTargetGroups',
      'afterTargets',
      'AfterTargets',
    ]).map(mapTransferTarget).filter((target): target is NonNullable<ReturnType<typeof mapTransferTarget>> => target !== null),
  }
}

function mapTransferTarget(payload: Record<string, unknown>) {
  const groupId = readString(payload, ['groupId', 'GroupId', 'id', 'Id'])

  if (!groupId) {
    return null
  }

  return {
    groupId,
    groupName: readString(payload, ['groupName', 'GroupName', 'name', 'Name']) ?? '',
    branchId: readString(payload, ['branchId', 'BranchId']) ?? '',
    branchName: readString(payload, ['branchName', 'BranchName']) ?? '',
    position: readNumber(payload, ['position', 'Position']) ?? 0,
    isActive: readBoolean(payload, ['isActive', 'IsActive']) ?? true,
  }
}

export async function updateClientMembershipComment(
  clientId: string,
  saleId: string,
  comment: string | null,
) {
  const response = await request<ClientResponsePayload>(
    API_ENDPOINTS.clients.membership.comment(clientId, saleId),
    { method: 'PUT', body: JSON.stringify({ comment }) },
  )

  return mapClientDetails(response)
}

function mapClientListItem(payload: ClientResponsePayload): ClientListItem {
  const contacts = mapClientContacts(payload)
  const groups = mapClientGroups(payload)
  const fullName = buildClientFullName(payload)
  const currentMemberships = mapClientCurrentMemberships(payload)
  const isProfessional =
    readBoolean(payload, ['isProfessional', 'IsProfessional']) ?? false
  const professionalComment =
    readString(payload, ['professionalComment', 'ProfessionalComment']) ?? null
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
  const hasActiveMembership =
    readBoolean(payload, [
      'hasActiveMembership',
      'HasActiveMembership',
    ]) ?? false
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
    ]) ?? Boolean(warningMessage)

  return {
    id: payload.id,
    fullName,
    lastName: payload.lastName?.trim() ?? '',
    firstName: payload.firstName?.trim() ?? '',
    middleName: payload.middleName?.trim() ?? '',
    phone: payload.phone?.trim() ?? '',
    branchId: payload.branchId ?? '',
    branchName: payload.branchName?.trim() ?? '',
    status: mapClientStatus(payload.status),
    contactCount: payload.contactCount ?? contacts.length,
    groupCount: payload.groupCount ?? groups.length,
    groups,
    photo: mapClientPhoto(payload),
    isProfessional,
    professionalComment,
    hasActiveMembership,
    membershipWarning,
    membershipWarningMessage: warningMessage,
    currentMemberships,
    hasCurrentMembership:
      readBoolean(payload, ['hasCurrentMembership', 'HasCurrentMembership']) ??
      currentMemberships.length > 0,
    membershipState: mapClientMembershipState(
      readString(payload, ['membershipState', 'MembershipState']),
      isProfessional,
      hasActiveMembership,
    ),
    actionHints: mapClientActionHints(payload),
    lastVisitDate:
      readString(payload, ['lastVisitDate', 'LastVisitDate']) ?? null,
    updatedAt: payload.updatedAt,
  }
}

function extractClientListCounts(payload: unknown) {
  const envelope = isRecord(payload) ? payload : null
  const nestedEnvelope = envelope?.data
  const quickFilterCountsPayload =
    (envelope ? extractClientQuickFilterCounts(envelope) : null) ??
    (isRecord(nestedEnvelope) ? extractClientQuickFilterCounts(nestedEnvelope) : null)

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
    quickFilterCounts: quickFilterCountsPayload,
  }
}

function extractClientQuickFilterCounts(
  payload: Record<string, unknown>,
): ClientQuickFilterCounts | null {
  const countsPayload = payload.quickFilterCounts ?? payload.QuickFilterCounts

  if (!isRecord(countsPayload)) {
    return null
  }

  return {
    withoutMembership:
      readNumber(countsPayload, ['withoutMembership', 'WithoutMembership']) ?? 0,
    expiringSoon:
      readNumber(countsPayload, ['expiringSoon', 'ExpiringSoon']) ?? 0,
    withoutGroup:
      readNumber(countsPayload, ['withoutGroup', 'WithoutGroup']) ?? 0,
    trial: readNumber(countsPayload, ['trial', 'Trial']) ?? 0,
  }
}

function mapClientMembershipState(
  state: string | undefined,
  isProfessional: boolean,
  hasActiveMembership: boolean,
) {
  if (
    state === 'None' ||
    state === 'Active' ||
    state === 'Future' ||
    state === 'Expired' ||
    state === 'UsedSingleVisit' ||
    state === 'LegacyTargetMissing'
  ) {
    return state
  }

  if (isProfessional) {
    return 'Active'
  }

  if (hasActiveMembership) {
    return 'Active'
  }

  return 'Expired'
}

function mapMembershipAttentionItem(
  payload: Record<string, unknown>,
): MembershipAttentionItem | null {
  const clientId =
    readString(payload, ['clientId', 'ClientId', 'id', 'Id']) ?? ''
  const membershipId = readString(payload, ['membershipId', 'MembershipId'])
  const saleId = readString(payload, ['saleId', 'SaleId'])
  const fullName =
    readString(payload, ['fullName', 'FullName']) ??
    buildDisplayNameFromParts(
      readString(payload, ['lastName', 'LastName']),
      readString(payload, ['firstName', 'FirstName']),
      readString(payload, ['middleName', 'MiddleName']),
    ) ??
    'Без имени'
  const behaviorKind = mapMembershipBehaviorKind(
    readString(payload, ['behaviorKind', 'MembershipBehaviorKind']),
  )
  const expirationDate = normalizeIsoDateValue(
    readString(payload, ['expirationDate', 'ExpirationDate']),
  )
  const daysUntilExpiration = readNumber(payload, [
    'daysUntilExpiration',
    'DaysUntilExpiration',
  ])
  const targetGroups = mapAttentionTargetGroups(payload)

  if (!clientId || !membershipId || !saleId || !behaviorKind) {
    return null
  }

  return {
    clientId,
    fullName,
    membershipId,
    saleId,
    behaviorKind,
    membershipName: readString(payload, ['membershipName', 'MembershipName']) ?? '',
    expirationDate,
    daysUntilExpiration: daysUntilExpiration ?? null,
    targetGroups,
    targetSummary: buildAttentionTargetSummary(targetGroups),
    state: mapMembershipAttentionState(
      readString(payload, ['state', 'State']),
    ),
  }
}

function mapAttentionTargetGroups(payload: Record<string, unknown>): ClientMembershipTargetGroup[] {
  return extractArrayPayload<Record<string, unknown>>(payload, [
    'targetGroups',
    'TargetGroups',
    'targets',
    'Targets',
  ])
    .map((target, index) => {
      const groupId = readString(target, ['groupId', 'GroupId', 'id', 'Id'])
      if (!groupId) {
        return null
      }

      return {
        groupId,
        groupName: readString(target, ['groupName', 'GroupName', 'name', 'Name']) ?? '',
        branchId: readString(target, ['branchId', 'BranchId']) ?? '',
        branchName: readString(target, ['branchName', 'BranchName']) ?? '',
        position: readNumber(target, ['position', 'Position']) ?? index + 1,
        isActive: readBoolean(target, ['isActive', 'IsActive']) ?? true,
      } satisfies ClientMembershipTargetGroup
    })
    .filter((target): target is ClientMembershipTargetGroup => target !== null)
    .sort((left, right) => left.position - right.position)
}

function buildAttentionTargetSummary(targetGroups: ClientMembershipTargetGroup[]) {
  if (targetGroups.length === 0) {
    return 'Без групп'
  }

  return targetGroups
    .map((target, index) =>
      `${index + 1}. ${target.groupName || target.groupId}${index === 0 ? ' · отчётность' : ''}`,
    )
    .join(' · ')
}

function mapMembershipAttentionState(
  state: string | null | undefined,
): MembershipAttentionState {
  if (state === 'Expired' || state === 'ExpiringSoon') {
    return state
  }

  return 'Unknown'
}

function mapMembershipExpirationSuggestion(
  payload: unknown,
): MembershipExpirationSuggestion {
  if (!isRecord(payload)) {
    throw new Error('Invalid membership expiration suggestion payload.')
  }

  const behaviorKind = mapMembershipBehaviorKind(
    readString(payload, ['behaviorKind', 'MembershipBehaviorKind']),
  )
  const startDate = normalizeIsoDateValue(
    readString(payload, ['startDate', 'StartDate']),
  )

  if (!behaviorKind || !startDate) {
    throw new Error('Invalid membership expiration suggestion payload.')
  }

  return {
    behaviorKind,
    startDate,
    expirationDate: normalizeIsoDateValue(
      readString(payload, ['expirationDate', 'ExpirationDate']),
    ),
  }
}

function mapClientDetails(payload: ClientResponsePayload): ClientDetails {
  const listItem = mapClientListItem(payload)
  const groupIds =
    payload.groupIds?.filter((groupId): groupId is string => Boolean(groupId)) ??
    listItem.groups.map((group) => group.id)
  const attendanceHistory = mapClientAttendanceHistory(payload)
  const notesLastChangedByName = readString(payload, [
    'notesLastChangedByName',
    'NotesLastChangedByName',
  ])
  const notesLastChangedAt = readString(payload, [
    'notesLastChangedAt',
    'NotesLastChangedAt',
  ])
  const hasCompleteNoteAttribution = Boolean(
    notesLastChangedByName && notesLastChangedAt,
  )
  const birthDate = hasProperty(payload, ['birthDate', 'BirthDate'])
    ? readString(payload, ['birthDate', 'BirthDate']) ?? null
    : null

  return {
    ...listItem,
    birthDate,
    businessDate:
      readString(payload, ['businessDate', 'BusinessDate']) ?? '',
    contacts: mapClientContacts(payload),
    createdAt: payload.createdAt,
    groupIds,
    notes: readString(payload, ['notes', 'Notes']) ?? '',
    notesLastChangedByName: hasCompleteNoteAttribution
      ? notesLastChangedByName!
      : null,
    notesLastChangedAt: hasCompleteNoteAttribution ? notesLastChangedAt! : null,
    photo: mapClientPhoto(payload),
    currentMemberships: mapClientCurrentMemberships(payload),
    membershipHistory: mapClientMembershipHistory(payload),
    attendanceHistory: attendanceHistory.items,
    attendanceHistoryLoaded: attendanceHistory.loaded,
    attendanceHistoryTotalCount: attendanceHistory.totalCount,
  }
}

function mapClientActionHints(payload: ClientResponsePayload) {
  return extractArrayPayload<Record<string, unknown>>(
    payload,
    ['actionHints', 'ActionHints'],
  ).map((hint) => ({
    title:
      readString(hint, ['title', 'Title']) ??
      readString(hint, ['label', 'Label']) ??
      'Планово',
    description: readString(hint, ['description', 'Description']) ?? '',
    tone: readString(hint, ['tone', 'Tone']) ?? 'gray',
    iconKey: readString(hint, ['iconKey', 'IconKey']) ?? '',
    daysUntilExpiration:
      readNumber(hint, ['daysUntilExpiration', 'DaysUntilExpiration']) ?? null,
  }))
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
