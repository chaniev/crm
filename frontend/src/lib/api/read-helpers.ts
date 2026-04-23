import {
  AUDIT_DEFAULT_PAGE,
  AUDIT_DEFAULT_PAGE_SIZE,
  CLIENTS_DEFAULT_PAGE_SIZE,
} from './endpoints'
import type { GetAuditLogParams, GetClientsParams } from './types'

export function appendSearchParam(
  searchParams: URLSearchParams,
  key: string,
  value?: string | null,
) {
  if (!value) {
    return
  }

  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return
  }

  searchParams.set(key, trimmedValue)
}

export function appendBooleanSearchParam(
  searchParams: URLSearchParams,
  key: string,
  value?: boolean,
) {
  if (typeof value !== 'boolean') {
    return
  }

  searchParams.set(key, String(value))
}

export function extractArrayPayload<T>(payload: unknown, keys: readonly string[]): T[] {
  if (Array.isArray(payload)) {
    return payload as T[]
  }

  if (!isRecord(payload)) {
    return []
  }

  for (const key of keys) {
    const candidate = payload[key]
    if (Array.isArray(candidate)) {
      return candidate as T[]
    }
  }

  const nestedData = payload.data

  if (Array.isArray(nestedData)) {
    return nestedData as T[]
  }

  if (isRecord(nestedData)) {
    for (const key of keys) {
      const candidate = nestedData[key]
      if (Array.isArray(candidate)) {
        return candidate as T[]
      }
    }
  }

  return []
}

export function extractRecordPayload(
  payload: unknown,
  keys: readonly string[],
): Record<string, unknown> | null {
  if (!isRecord(payload)) {
    return null
  }

  for (const key of keys) {
    if (!(key in payload)) {
      continue
    }

    const candidate = payload[key]

    if (isRecord(candidate)) {
      return candidate
    }

    if (candidate === null) {
      return null
    }
  }

  const nestedData = payload.data

  if (!isRecord(nestedData)) {
    return null
  }

  for (const key of keys) {
    if (!(key in nestedData)) {
      continue
    }

    const candidate = nestedData[key]

    if (isRecord(candidate)) {
      return candidate
    }

    if (candidate === null) {
      return null
    }
  }

  return null
}

export function extractClientsPagination(
  payload: unknown,
  params: GetClientsParams,
  itemCount: number,
) {
  const requestedTake =
    typeof params.take === 'number'
      ? params.take
      : typeof params.pageSize === 'number'
        ? params.pageSize
        : CLIENTS_DEFAULT_PAGE_SIZE
  const requestedSkip =
    typeof params.skip === 'number'
      ? params.skip
      : typeof params.page === 'number'
        ? Math.max(0, (params.page - 1) * requestedTake)
        : 0
  const envelope = isRecord(payload) ? payload : null
  const nestedEnvelope = envelope?.data
  const totalCount =
    (isRecord(envelope)
      ? readNumber(envelope, ['totalCount', 'TotalCount'])
      : undefined) ??
    (isRecord(nestedEnvelope)
      ? readNumber(nestedEnvelope, ['totalCount', 'TotalCount'])
      : undefined)
  const skip =
    (isRecord(envelope) ? readNumber(envelope, ['skip', 'Skip']) : undefined) ??
    (isRecord(nestedEnvelope)
      ? readNumber(nestedEnvelope, ['skip', 'Skip'])
      : undefined) ??
    requestedSkip
  const take =
    (isRecord(envelope) ? readNumber(envelope, ['take', 'Take']) : undefined) ??
    (isRecord(nestedEnvelope)
      ? readNumber(nestedEnvelope, ['take', 'Take'])
      : undefined) ??
    requestedTake
  const page =
    (isRecord(envelope) ? readNumber(envelope, ['page', 'Page']) : undefined) ??
    (isRecord(nestedEnvelope)
      ? readNumber(nestedEnvelope, ['page', 'Page'])
      : undefined) ??
    Math.floor(skip / Math.max(take, 1)) + 1
  const pageSize =
    (isRecord(envelope)
      ? readNumber(envelope, ['pageSize', 'PageSize'])
      : undefined) ??
    (isRecord(nestedEnvelope)
      ? readNumber(nestedEnvelope, ['pageSize', 'PageSize'])
      : undefined) ??
    take

  return {
    totalCount: totalCount ?? null,
    skip,
    take: Math.max(take, itemCount, 1),
    page: Math.max(page, 1),
    pageSize: Math.max(pageSize, 1),
  }
}

export function extractAuditLogPagination(
  payload: unknown,
  params: GetAuditLogParams,
  itemCount: number,
) {
  const requestedPageSize =
    typeof params.pageSize === 'number'
      ? params.pageSize
      : AUDIT_DEFAULT_PAGE_SIZE
  const requestedPage =
    typeof params.page === 'number' ? Math.max(params.page, 1) : AUDIT_DEFAULT_PAGE
  const requestedSkip = (requestedPage - 1) * requestedPageSize
  const envelope = isRecord(payload) ? payload : null
  const nestedEnvelope = envelope?.data
  const totalCount =
    (isRecord(envelope)
      ? readNumber(envelope, ['totalCount', 'TotalCount'])
      : undefined) ??
    (isRecord(nestedEnvelope)
      ? readNumber(nestedEnvelope, ['totalCount', 'TotalCount'])
      : undefined)
  const skip =
    (isRecord(envelope) ? readNumber(envelope, ['skip', 'Skip']) : undefined) ??
    (isRecord(nestedEnvelope)
      ? readNumber(nestedEnvelope, ['skip', 'Skip'])
      : undefined) ??
    requestedSkip
  const take =
    (isRecord(envelope) ? readNumber(envelope, ['take', 'Take']) : undefined) ??
    (isRecord(nestedEnvelope)
      ? readNumber(nestedEnvelope, ['take', 'Take'])
      : undefined) ??
    requestedPageSize
  const page =
    (isRecord(envelope) ? readNumber(envelope, ['page', 'Page']) : undefined) ??
    (isRecord(nestedEnvelope)
      ? readNumber(nestedEnvelope, ['page', 'Page'])
      : undefined) ??
    Math.floor(skip / Math.max(take, 1)) + 1
  const pageSize =
    (isRecord(envelope)
      ? readNumber(envelope, ['pageSize', 'PageSize'])
      : undefined) ??
    (isRecord(nestedEnvelope)
      ? readNumber(nestedEnvelope, ['pageSize', 'PageSize'])
      : undefined) ??
    take

  return {
    totalCount: totalCount ?? null,
    skip,
    take: Math.max(take, itemCount, 1),
    page: Math.max(page, 1),
    pageSize: Math.max(pageSize, 1),
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function hasProperty(record: Record<string, unknown>, keys: readonly string[]) {
  return keys.some((key) => key in record)
}

export function readString(
  record: Record<string, unknown>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'string') {
      return value.trim()
    }
  }

  return undefined
}

export function readBoolean(
  record: Record<string, unknown>,
  keys: readonly string[],
): boolean | undefined {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'boolean') {
      return value
    }
  }

  return undefined
}

export function readNumber(
  record: Record<string, unknown>,
  keys: readonly string[],
): number | undefined {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }

    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  return undefined
}

export function readValue(
  record: Record<string, unknown>,
  keys: readonly string[],
): unknown {
  for (const key of keys) {
    if (key in record) {
      return record[key]
    }
  }

  return undefined
}
