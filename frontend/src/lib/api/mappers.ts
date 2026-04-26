import {
  CLIENT_GROUP_PAYLOAD_KEYS,
  CLIENT_STATUS_ACTIVE,
  CLIENT_STATUS_ARCHIVED,
  DEFAULT_CLIENT_GROUP_NAME,
} from './endpoints'
import {
  extractArrayPayload,
  extractRecordPayload,
  hasProperty,
  readBoolean,
  readNumber,
  readString,
} from './read-helpers'
import type {
  ClientGroupPayload,
  ClientGroupSummary,
  ClientMembership,
  ClientPhoto,
  ClientResponsePayload,
  ClientStatus,
  MembershipType,
  UserRole,
} from './types'

export function mapClientPhoto(payload: ClientResponsePayload): ClientPhoto | null {
  const nestedPayload = extractRecordPayload(payload, ['photo', 'Photo'])
  const flatPayload = payload as Record<string, unknown>
  const sourcePayload = nestedPayload ?? flatPayload
  const hasPhoto =
    readBoolean(sourcePayload, ['hasPhoto', 'HasPhoto']) ??
    readBoolean(flatPayload, ['hasPhoto', 'HasPhoto']) ??
    false
  const path =
    readString(sourcePayload, ['path', 'Path', 'photoPath', 'PhotoPath']) ??
    readString(flatPayload, ['photoPath', 'PhotoPath'])
  const contentType =
    readString(sourcePayload, [
      'contentType',
      'ContentType',
      'photoContentType',
      'PhotoContentType',
    ]) ?? readString(flatPayload, ['photoContentType', 'PhotoContentType'])
  const sizeBytes =
    readNumber(sourcePayload, [
      'sizeBytes',
      'SizeBytes',
      'photoSizeBytes',
      'PhotoSizeBytes',
    ]) ?? readNumber(flatPayload, ['photoSizeBytes', 'PhotoSizeBytes'])
  const uploadedAt =
    readString(sourcePayload, [
      'uploadedAt',
      'UploadedAt',
      'photoUploadedAt',
      'PhotoUploadedAt',
    ]) ?? readString(flatPayload, ['photoUploadedAt', 'PhotoUploadedAt'])

  if (!hasPhoto && !path && !contentType && sizeBytes === undefined && !uploadedAt) {
    return null
  }

  return {
    path: path ?? undefined,
    contentType: contentType ?? undefined,
    sizeBytes,
    uploadedAt: uploadedAt ?? undefined,
  }
}

export function mapClientCurrentMembership(
  payload: ClientResponsePayload,
): ClientMembership | null {
  const membershipPayload = extractRecordPayload(payload, [
    'currentMembership',
    'CurrentMembership',
    'currentMembershipSummary',
    'CurrentMembershipSummary',
  ])

  return mapClientMembership(membershipPayload)
}

export function mapClientGroups(payload: ClientResponsePayload): ClientGroupSummary[] {
  const groupsPayload = extractArrayPayload<ClientGroupPayload>(
    payload.groups,
    CLIENT_GROUP_PAYLOAD_KEYS,
  )

  const fallbackGroupsPayload =
    groupsPayload.length > 0
      ? groupsPayload
      : extractArrayPayload<ClientGroupPayload>(
          payload.clientGroups,
          CLIENT_GROUP_PAYLOAD_KEYS,
        )

  return fallbackGroupsPayload.map((group) => ({
    id: group.id,
    name:
      group.name?.trim() ??
      group.groupName?.trim() ??
      group.title?.trim() ??
      DEFAULT_CLIENT_GROUP_NAME,
    isActive: group.isActive ?? true,
    trainingStartTime: group.trainingStartTime ?? undefined,
    scheduleText: group.scheduleText ?? undefined,
  }))
}

export function mapClientMembership(payload: unknown): ClientMembership | null {
  if (!isRecord(payload)) {
    return null
  }

  const membershipType = mapMembershipType(
    readString(payload, ['membershipType', 'MembershipType']),
  )
  const purchaseDate =
    readString(payload, ['purchaseDate', 'PurchaseDate']) ?? ''

  if (!membershipType || !purchaseDate) {
    return null
  }

  return {
    id:
      readString(payload, ['id', 'Id']) ??
      `${membershipType}-${purchaseDate}-${readString(payload, ['validFrom', 'ValidFrom']) ?? 'current'}`,
    membershipType,
    purchaseDate,
    expirationDate:
      readString(payload, ['expirationDate', 'ExpirationDate']) ?? null,
    paymentAmount:
      readNumber(payload, ['paymentAmount', 'PaymentAmount']) ?? 0,
    isPaid: readBoolean(payload, ['isPaid', 'IsPaid']) ?? false,
    singleVisitUsed:
      readBoolean(payload, ['singleVisitUsed', 'SingleVisitUsed']) ?? false,
    changeReason:
      readString(payload, ['changeReason', 'ChangeReason']) ?? undefined,
    paidAt: readString(payload, ['paidAt', 'PaidAt']) ?? undefined,
    paidByUserId:
      readString(payload, ['paidByUserId', 'PaidByUserId']) ?? undefined,
    paidByUserName:
      readString(payload, [
        'paidByUserName',
        'PaidByUserName',
        'paidByFullName',
        'PaidByFullName',
      ]) ?? undefined,
    changedByUserId:
      readString(payload, ['changedByUserId', 'ChangedByUserId']) ?? undefined,
    changedByUserName:
      readString(payload, [
        'changedByUserName',
        'ChangedByUserName',
        'changedByFullName',
        'ChangedByFullName',
      ]) ?? undefined,
    validFrom: readString(payload, ['validFrom', 'ValidFrom']) ?? undefined,
    validTo:
      readString(payload, ['validTo', 'ValidTo']) ??
      (hasProperty(payload, ['validTo', 'ValidTo']) ? null : undefined),
    createdAt: readString(payload, ['createdAt', 'CreatedAt']) ?? undefined,
  }
}

export function buildDisplayNameFromParts(
  lastName?: string,
  firstName?: string,
  middleName?: string,
) {
  const fullName = [lastName, firstName, middleName]
    .map((value) => value?.trim() ?? '')
    .filter(Boolean)
    .join(' ')

  return fullName || null
}

export function buildClientFullName(payload: Pick<
  ClientResponsePayload,
  'fullName' | 'lastName' | 'firstName' | 'middleName'
>) {
  const fullName = buildDisplayNameFromParts(
    payload.lastName ?? undefined,
    payload.firstName ?? undefined,
    payload.middleName ?? undefined,
  )

  if (fullName) {
    return fullName
  }

  return payload.fullName?.trim() || 'Без имени'
}

export function mapClientStatus(status?: string | null): ClientStatus {
  return status === CLIENT_STATUS_ARCHIVED
    ? CLIENT_STATUS_ARCHIVED
    : CLIENT_STATUS_ACTIVE
}

export function mapMembershipType(type?: string | null): MembershipType | null {
  if (type === 'SingleVisit' || type === 'Monthly' || type === 'Yearly') {
    return type
  }

  return null
}

export function normalizeAuditJsonValue(value: unknown): unknown | null {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim()

    if (!trimmedValue) {
      return null
    }

    try {
      return JSON.parse(trimmedValue) as unknown
    } catch {
      return trimmedValue
    }
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value) || isRecord(value)) {
    return value
  }

  return String(value)
}

export function mapUserRole(role?: string): UserRole | undefined {
  if (role === 'HeadCoach' || role === 'Administrator' || role === 'Coach') {
    return role
  }

  return undefined
}

export function buildFallbackAuditDescription(
  actionType: string,
  entityType: string,
  entityId?: string,
) {
  const parts = [`${actionType} ${entityType}`]

  if (entityId) {
    parts.push(`(${entityId})`)
  }

  return parts.join(' ')
}

export function deriveHasActivePaidMembership(
  membership: ClientMembership | null,
  trainingDate: string,
) {
  if (!membership || !membership.isPaid) {
    return false
  }

  const effectiveDate =
    normalizeIsoDateValue(trainingDate) ??
    normalizeIsoDateValue(new Date().toISOString()) ??
    trainingDate
  const expirationDate = normalizeIsoDateValue(membership.expirationDate)

  if (expirationDate && expirationDate < effectiveDate) {
    return false
  }

  return (
    membership.membershipType !== 'SingleVisit' || !membership.singleVisitUsed
  )
}

export function deriveMembershipWarning(
  membership: ClientMembership | null,
  hasUnpaidCurrentMembership: boolean,
  trainingDate: string,
) {
  if (!membership) {
    return true
  }

  if (hasUnpaidCurrentMembership) {
    return true
  }

  const expirationDate = normalizeIsoDateValue(membership.expirationDate)
  const effectiveDate = normalizeIsoDateValue(trainingDate)

  if (expirationDate && effectiveDate && expirationDate < effectiveDate) {
    return true
  }

  return (
    membership.membershipType === 'SingleVisit' && membership.singleVisitUsed
  )
}

export function normalizeIsoDateValue(value?: string | null) {
  if (!value) {
    return null
  }

  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return null
  }

  const directMatch = trimmedValue.match(/^\d{4}-\d{2}-\d{2}$/)
  if (directMatch) {
    return trimmedValue
  }

  const prefixMatch = trimmedValue.match(/^(\d{4}-\d{2}-\d{2})[T\s]/)
  if (prefixMatch) {
    return prefixMatch[1]
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
