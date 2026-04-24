import {
  API_ENDPOINTS,
  AUDIT_LOG_PAYLOAD_KEYS,
  AUDIT_QUERY_KEYS,
} from './endpoints'
import {
  buildFallbackAuditDescription,
  mapUserRole,
  normalizeAuditJsonValue,
} from './mappers'
import {
  appendSearchParam,
  extractArrayPayload,
  extractAuditLogPagination,
  extractRecordPayload,
  isRecord,
  readString,
  readValue,
} from './read-helpers'
import { request } from './transport'
import type {
  AuditLogEntry,
  AuditLogEntryPayload,
  AuditLogFilterOptions,
  AuditLogFilterOptionsPayload,
  AuditLogFilterUser,
  GetAuditLogParams,
} from './types'

export async function getAuditLogEntries(
  params: GetAuditLogParams = {},
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams()

  if (typeof params.page === 'number') {
    searchParams.set(AUDIT_QUERY_KEYS.page, String(params.page))
  } else if (typeof params.pageSize === 'number') {
    searchParams.set(AUDIT_QUERY_KEYS.page, '1')
  }

  if (typeof params.pageSize === 'number') {
    searchParams.set(AUDIT_QUERY_KEYS.pageSize, String(params.pageSize))
  }

  if (typeof params.skip === 'number') {
    searchParams.set(AUDIT_QUERY_KEYS.skip, String(params.skip))
  }

  if (typeof params.take === 'number') {
    searchParams.set(AUDIT_QUERY_KEYS.take, String(params.take))
  }

  appendSearchParam(searchParams, AUDIT_QUERY_KEYS.userId, params.userId)
  appendSearchParam(searchParams, AUDIT_QUERY_KEYS.source, params.source)
  appendSearchParam(
    searchParams,
    AUDIT_QUERY_KEYS.messengerPlatform,
    params.messengerPlatform,
  )
  appendSearchParam(
    searchParams,
    AUDIT_QUERY_KEYS.actionType,
    params.actionType,
  )
  appendSearchParam(
    searchParams,
    AUDIT_QUERY_KEYS.entityType,
    params.entityType,
  )
  appendSearchParam(
    searchParams,
    AUDIT_QUERY_KEYS.dateFrom,
    params.dateFrom,
  )
  appendSearchParam(searchParams, AUDIT_QUERY_KEYS.dateTo, params.dateTo)

  if (
    !searchParams.has(AUDIT_QUERY_KEYS.page) &&
    !searchParams.has(AUDIT_QUERY_KEYS.pageSize) &&
    !searchParams.has(AUDIT_QUERY_KEYS.skip) &&
    !searchParams.has(AUDIT_QUERY_KEYS.take)
  ) {
    searchParams.set(AUDIT_QUERY_KEYS.page, '1')
    searchParams.set(AUDIT_QUERY_KEYS.pageSize, '20')
  }

  const payload = await request<unknown>(
    `${API_ENDPOINTS.audit.collection}?${searchParams.toString()}`,
    { signal },
  )

  const items = extractArrayPayload<AuditLogEntryPayload>(
    payload,
    AUDIT_LOG_PAYLOAD_KEYS,
  )
    .map((entry) => mapAuditLogEntry(entry))
    .filter((entry): entry is AuditLogEntry => entry !== null)
  const pagination = extractAuditLogPagination(payload, params, items.length)

  return {
    items,
    totalCount: pagination.totalCount,
    skip: pagination.skip,
    take: pagination.take,
    page: pagination.page,
    pageSize: pagination.pageSize,
    hasNextPage:
      pagination.totalCount !== null
        ? pagination.skip + items.length < pagination.totalCount
        : items.length >= pagination.take,
  } satisfies import('./types').AuditLogListResponse
}

export async function getAuditLogFilterOptions(signal?: AbortSignal) {
  const payload = await request<AuditLogFilterOptionsPayload>(
    API_ENDPOINTS.audit.options,
    { signal },
  )

  return {
    users: extractArrayPayload<Record<string, unknown>>(payload, ['users'])
      .map((user) => mapAuditLogFilterUser(user))
      .filter((user): user is AuditLogFilterUser => user !== null),
    actionTypes: extractArrayPayload<string>(payload, [
      'actionTypes',
      'ActionTypes',
    ]),
    entityTypes: extractArrayPayload<string>(payload, [
      'entityTypes',
      'EntityTypes',
    ]),
    sources: extractArrayPayload<string>(payload, ['sources', 'Sources']),
    messengerPlatforms: extractArrayPayload<string>(payload, [
      'messengerPlatforms',
      'MessengerPlatforms',
    ]),
  } satisfies AuditLogFilterOptions
}

function mapAuditLogEntry(payload: AuditLogEntryPayload): AuditLogEntry | null {
  if (!isRecord(payload)) {
    return null
  }

  const userPayload = extractRecordPayload(payload, ['user', 'User', 'actor', 'Actor'])
  const actionType =
    readString(payload, ['actionType', 'ActionType']) ?? 'UnknownAction'
  const entityType =
    readString(payload, ['entityType', 'EntityType']) ?? 'UnknownEntity'
  const entityId =
    readString(payload, ['entityId', 'EntityId', 'recordId', 'RecordId']) ??
    undefined
  const createdAt =
    readString(payload, ['createdAt', 'CreatedAt', 'timestamp', 'Timestamp']) ?? ''
  const id =
    readString(payload, ['id', 'Id', 'auditLogId', 'AuditLogId']) ??
    [createdAt || 'unknown-time', actionType, entityType, entityId || 'entry']
      .filter(Boolean)
      .join(':')
  const userId =
    readString(payload, ['userId', 'UserId']) ??
    (userPayload ? readString(userPayload, ['id', 'Id', 'userId', 'UserId']) : undefined)
  const userLogin =
    readString(payload, ['userLogin', 'UserLogin']) ??
    (userPayload ? readString(userPayload, ['login', 'Login']) : undefined)
  const userRole =
    readString(payload, ['userRole', 'UserRole']) ??
    (userPayload ? readString(userPayload, ['role', 'Role']) : undefined)
  const source = readString(payload, ['source', 'Source'])
  const messengerPlatform = readString(payload, [
    'messengerPlatform',
    'MessengerPlatform',
  ])
  const userName =
    readString(payload, [
      'userName',
      'UserName',
      'userFullName',
      'UserFullName',
      'performedBy',
      'PerformedBy',
      'actorName',
      'ActorName',
    ]) ??
    (userPayload
      ? readString(userPayload, [
          'fullName',
          'FullName',
          'userName',
          'UserName',
          'login',
          'Login',
        ])
      : undefined) ??
    'Система'
  const description =
    readString(payload, ['description', 'Description']) ??
    buildFallbackAuditDescription(actionType, entityType, entityId)

  return {
    id,
    userId,
    userName,
    userLogin,
    userRole: mapUserRole(userRole),
    source,
    messengerPlatform,
    actionType,
    entityType,
    entityId,
    description,
    oldValueJson: normalizeAuditJsonValue(
      readValue(payload, [
        'oldValueJson',
        'OldValueJson',
        'oldValues',
        'OldValues',
        'before',
        'Before',
      ]),
    ),
    newValueJson: normalizeAuditJsonValue(
      readValue(payload, [
        'newValueJson',
        'NewValueJson',
        'newValues',
        'NewValues',
        'after',
        'After',
      ]),
    ),
    createdAt,
  }
}

function mapAuditLogFilterUser(payload: Record<string, unknown>): AuditLogFilterUser | null {
  const id = readString(payload, ['id', 'Id']) ?? ''
  const fullName =
    readString(payload, ['fullName', 'FullName']) ??
    readString(payload, ['login', 'Login']) ??
    ''
  const login = readString(payload, ['login', 'Login']) ?? ''
  const role = mapUserRole(readString(payload, ['role', 'Role']))

  if (!id || !fullName || !login || !role) {
    return null
  }

  return {
    id,
    fullName,
    login,
    role,
  }
}
