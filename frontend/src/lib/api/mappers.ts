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
  ClientMembershipEntitlementState,
  ClientMembershipTargetGroup,
  ClientPhoto,
  ClientResponsePayload,
  ClientStatus,
  ClientMembershipCoverageKind,
  MembershipBehaviorKind,
  MembershipSalePricingMode,
  UserRole,
} from './types'
import { fe17SharedRoutingThemeText } from '../../resources/fe-17-shared-routing-theme'


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

export function mapClientCurrentMemberships(
  payload: ClientResponsePayload,
): ClientMembership[] {
  return extractArrayPayload<unknown>(payload, [
    'currentMemberships',
    'CurrentMemberships',
  ])
    .map((membership) => mapClientMembership(membership))
    .filter((membership): membership is ClientMembership => membership !== null)
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
    branchId: group.branchId ?? undefined,
    branchName: group.branchName?.trim() || undefined,
    hallId: group.hallId ?? undefined,
    hallName: group.hallName?.trim() || undefined,
    isActive: group.isActive ?? true,
    trainingStartTime: group.trainingStartTime ?? undefined,
    durationMinutes:
      typeof group.durationMinutes === 'number' ? group.durationMinutes : undefined,
    weekdays: Array.isArray(group.weekdays) ? group.weekdays : undefined,
  }))
}

export function mapClientMembership(payload: unknown): ClientMembership | null {
  if (!isRecord(payload)) {
    return null
  }

  const behaviorKind = mapMembershipBehaviorKind(
    readString(payload, ['behaviorKind', 'MembershipBehaviorKind']),
  )
  const purchaseDate =
    readString(payload, ['purchaseDate', 'PurchaseDate']) ?? ''
  const paymentDate =
    readString(payload, ['paymentDate', 'PaymentDate']) ?? ''
  const saleId = readString(payload, ['saleId', 'SaleId'])
  const pricingMode = mapMembershipSalePricingMode(readString(payload, ['pricingMode', 'PricingMode']))
  const grossAmount = readNumber(payload, ['grossAmount', 'GrossAmount'])
  const membershipName = readString(payload, ['membershipName', 'MembershipName'])
  const coverageKind = mapMembershipCoverageKind(readString(payload, ['coverageKind', 'CoverageKind']))
  const entitlementState = mapMembershipEntitlementState(
    readString(payload, ['entitlementState', 'EntitlementState']),
  )

  if (
    !behaviorKind ||
    !purchaseDate ||
    !paymentDate ||
    !saleId ||
    !pricingMode ||
    grossAmount === undefined ||
    !membershipName ||
    !coverageKind ||
    !entitlementState
  ) {
    return null
  }

  return {
    id:
      readString(payload, ['id', 'Id']) ??
      `${behaviorKind}-${purchaseDate}-${readString(payload, ['validFrom', 'ValidFrom']) ?? 'current'}`,
    saleId,
    behaviorKind,
    membershipCatalogItemId:
      readString(payload, ['membershipCatalogItemId', 'MembershipCatalogItemId']) ?? null,
    membershipName,
    purchaseDate,
    paymentDate,
    expirationDate:
      readString(payload, ['expirationDate', 'ExpirationDate']) ?? null,
    pricingMode,
    grossAmount,
    catalogPrice:
      readNumber(payload, ['catalogPrice', 'CatalogPrice']) ?? null,
    singleVisitUsed:
      readBoolean(payload, ['singleVisitUsed', 'SingleVisitUsed']) ?? false,
    coverageKind,
    entitlementState,
    targetGroups: mapMembershipTargetGroups(payload),
    changeReason:
      readString(payload, ['changeReason', 'ChangeReason']) ?? undefined,
    paymentRecordedAt:
      readString(payload, ['paymentRecordedAt', 'PaymentRecordedAt']) ?? '',
    paymentRecordedByUserId:
      readString(payload, ['paymentRecordedByUserId', 'PaymentRecordedByUserId']) ?? '',
    paymentRecordedByUserName:
      readString(payload, [
        'paymentRecordedByUserName',
        'PaymentRecordedByUserName',
      ]) ?? '',
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
    professionalComment:
      readString(payload, ['professionalComment', 'ProfessionalComment']) ?? null,
    comment: readString(payload, ['comment', 'Comment']) ?? null,
    ...mapMembershipCommentAttribution(payload),
  }
}

function mapMembershipTargetGroups(
  payload: Record<string, unknown>,
): ClientMembershipTargetGroup[] {
  return extractArrayPayload<Record<string, unknown>>(payload, [
    'targetGroups',
    'TargetGroups',
    'targets',
    'Targets',
  ])
    .map((target, index) => {
      const groupId = readString(target, ['groupId', 'GroupId', 'id', 'Id'])
      const groupName =
        readString(target, ['groupName', 'GroupName', 'name', 'Name']) ?? ''
      const branchId = readString(target, ['branchId', 'BranchId']) ?? ''
      const branchName = readString(target, ['branchName', 'BranchName']) ?? ''
      const position = readNumber(target, ['position', 'Position']) ?? index

      if (!groupId) {
        return null
      }

      return {
        groupId,
        groupName,
        branchId,
        branchName,
        position,
        isActive: readBoolean(target, ['isActive', 'IsActive']) ?? true,
      } satisfies ClientMembershipTargetGroup
    })
    .filter((target): target is ClientMembershipTargetGroup => target !== null)
    .sort((left, right) => left.position - right.position)
}

function mapMembershipCoverageKind(
  value: string | undefined,
): ClientMembershipCoverageKind | null {
  if (value === 'AllGroups' || value === 'TargetGroups') {
    return value
  }

  return null
}

function mapMembershipEntitlementState(
  value: string | undefined,
): ClientMembershipEntitlementState | null {
  if (
    value === 'Active' ||
    value === 'Future' ||
    value === 'Expired' ||
    value === 'UsedSingleVisit' ||
    value === 'LegacyTargetMissing'
  ) {
    return value
  }

  return null
}

function mapMembershipCommentAttribution(payload: Record<string, unknown>) {
  const commentLastChangedByName = readString(payload, [
    'commentLastChangedByName',
    'CommentLastChangedByName',
  ])
  const commentLastChangedAt = readString(payload, [
    'commentLastChangedAt',
    'CommentLastChangedAt',
  ])

  return commentLastChangedByName && commentLastChangedAt
    ? { commentLastChangedByName, commentLastChangedAt }
    : { commentLastChangedByName: null, commentLastChangedAt: null }
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

  return payload.fullName?.trim() || fe17SharedRoutingThemeText.mappers_string_0106f3ae
}

export function mapClientStatus(status?: string | null): ClientStatus {
  return status === CLIENT_STATUS_ARCHIVED
    ? CLIENT_STATUS_ARCHIVED
    : CLIENT_STATUS_ACTIVE
}

export function mapMembershipBehaviorKind(type?: string | null): MembershipBehaviorKind | null {
  if (type === 'SingleVisit' || type === 'Term' || type === 'Professional') {
    return type
  }

  return null
}

export function mapMembershipSalePricingMode(
  mode?: string | null,
): MembershipSalePricingMode | null {
  if (
    mode === 'Catalog' ||
    mode === 'CatalogOverride' ||
    mode === 'AmountOnly'
  ) {
    return mode
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
  if (
    role === 'HeadCoach' ||
    role === 'SuperAdministrator' ||
    role === 'Administrator' ||
    role === 'Coach'
  ) {
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

export function deriveHasActiveMembership(
  membership: ClientMembership | null,
  trainingDate: string,
) {
  if (!membership) {
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
    membership.behaviorKind !== 'SingleVisit' || !membership.singleVisitUsed
  )
}

export function deriveMembershipWarning(
  membership: ClientMembership | null,
  trainingDate: string,
) {
  if (!membership) {
    return true
  }

  const expirationDate = normalizeIsoDateValue(membership.expirationDate)
  const effectiveDate = normalizeIsoDateValue(trainingDate)

  if (expirationDate && effectiveDate && expirationDate < effectiveDate) {
    return true
  }

  return (
    membership.behaviorKind === 'SingleVisit' && membership.singleVisitUsed
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
