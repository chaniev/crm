
import type { ReactNode } from 'react'
import {
  type Branch,
  type ClientAttendanceHistoryEntry,
  type ClientMembership,
  type ClientMembershipChangeReason,
  type ClientStatus,
  type MembershipBehaviorKind,
  type TrainingGroupListItem,
} from '../../lib/api'
import { resources } from '../../lib/resources'
import type { MembershipSalePricingFieldErrors } from './MembershipSalePricing'
import { fe6ClientProfileText } from '../../resources/fe-6-client-profile'


export const clientPhotoMaxBytes = 10 * 1024 * 1024
export const clientPhotoAcceptedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const
export const clientPhotoAcceptedExtensions = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
] as const
export const clientPhotoAcceptValue = [
  ...clientPhotoAcceptedExtensions,
  ...clientPhotoAcceptedMimeTypes,
].join(',')
const membershipChangeReasonLabels = resources.clients
  .membershipChangeReasonLabels satisfies Record<
  ClientMembershipChangeReason,
  string
>

export function parseDateValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) {
    return null
  }

  const [, year, month, day] = match

  return new Date(Number(year), Number(month) - 1, Number(day))
}

export function formatDateValue(value?: string | null) {
  if (!value) {
    return fe6ClientProfileText.clientManagementFormatting_string_f16cbd32
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = parseDateValue(value)

    return date
      ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(date)
      : value
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(date)
}

export function formatDateTimeValue(value?: string | null) {
  if (!value) {
    return fe6ClientProfileText.clientManagementFormatting_string_ba4d4bf6
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
}

export function formatPaymentRecordingValue(membership: ClientMembership) {
  const recordedAt = formatDateTimeValue(membership.paymentRecordedAt)

  return membership.paymentRecordedByUserName
    ? `${membership.paymentRecordedByUserName} · ${recordedAt}`
    : recordedAt
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatExpirationValue(
  behaviorKind: MembershipBehaviorKind,
  expirationDate?: string | null,
) {
  if (behaviorKind === 'SingleVisit') {
    return expirationDate ? formatDateValue(expirationDate) : fe6ClientProfileText.clientManagementFormatting_string_62c745d0
  }

  return expirationDate ? formatDateValue(expirationDate) : fe6ClientProfileText.clientManagementFormatting_string_f16cbd32
}

export function formatCurrencyValue(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatMembershipChangeReason(reason?: string) {
  if (!reason) {
    return fe6ClientProfileText.clientManagementFormatting_string_a3c07b6d
  }

  return membershipChangeReasonLabels[
    reason as ClientMembershipChangeReason
  ] ?? reason
}

export function formatMembershipPricingProvenance(membership: ClientMembership) {
  if (membership.pricingMode === 'AmountOnly') {
    return fe6ClientProfileText.clientManagementFormatting_string_92f64d0d
  }

  if (membership.pricingMode === 'CatalogOverride') {
    return fe6ClientProfileText.clientManagementFormatting_string_00f9729f
  }

  return fe6ClientProfileText.clientManagementFormatting_string_de5a7f2f
}

export function pickPricingFieldErrors(
  errors: Record<string, ReactNode>,
): MembershipSalePricingFieldErrors {
  return {
    pricingMode:
      typeof errors.pricingMode === 'string' ? errors.pricingMode : undefined,
    membershipCatalogItemId:
      typeof errors.membershipCatalogItemId === 'string'
        ? errors.membershipCatalogItemId
        : undefined,
    manualSaleAmount:
      typeof errors.manualSaleAmount === 'string'
        ? errors.manualSaleAmount
        : undefined,
  }
}

export function formatMembershipVersionDate(membership: ClientMembership) {
  if (membership.validFrom) {
    return formatDateTimeValue(membership.validFrom)
  }

  if (membership.createdAt) {
    return formatDateTimeValue(membership.createdAt)
  }

  return formatDateValue(membership.purchaseDate)
}

export function formatPreviewList(values: string[], limit: number) {
  const cleanValues = values.map((value) => value.trim()).filter(Boolean)
  const visibleValues = cleanValues.slice(0, limit)
  const hiddenCount = cleanValues.length - visibleValues.length

  if (hiddenCount <= 0) {
    return visibleValues.join(', ')
  }

  return `${visibleValues.join(', ')} +${hiddenCount}`
}

export function formatBranchOptionLabel(branch: Branch) {
  const parts = [branch.name]

  if (branch.address) {
    parts.push(branch.address)
  }

  if (branch.isArchived) {
    parts.push(fe6ClientProfileText.clientManagementFormatting_partsPush_4ebaca56)
  }

  return parts.join(' · ')
}

export function compareMembershipHistory(
  left: ClientMembership,
  right: ClientMembership,
) {
  const leftDate = left.validFrom ?? left.createdAt ?? left.purchaseDate
  const rightDate = right.validFrom ?? right.createdAt ?? right.purchaseDate

  return rightDate.localeCompare(leftDate)
}

export function compareAttendanceHistory(
  left: ClientAttendanceHistoryEntry,
  right: ClientAttendanceHistoryEntry,
) {
  return right.trainingDate.localeCompare(left.trainingDate)
}

export function formatGroupOptionLabel(group: TrainingGroupListItem) {
  const parts = [group.name]

  if (group.hallName) {
    parts.push(group.hallName)
  }

  if (group.trainingStartTime) {
    parts.push(group.trainingStartTime)
  }

  if (!group.isActive) {
    parts.push(fe6ClientProfileText.clientManagementFormatting_partsPush_bd36839e)
  }

  return parts.join(' • ')
}

export function validateClientPhotoFile(file: File) {
  if (file.size > clientPhotoMaxBytes) {
    return fe6ClientProfileText.clientManagementFormatting_string_5536d11b
  }

  const normalizedName = file.name.toLowerCase()
  const hasAcceptedExtension = clientPhotoAcceptedExtensions.some((extension) =>
    normalizedName.endsWith(extension),
  )
  const hasAcceptedMimeType = file.type
    ? clientPhotoAcceptedMimeTypes.includes(
        file.type.toLowerCase() as (typeof clientPhotoAcceptedMimeTypes)[number],
      )
    : false

  if (!hasAcceptedExtension && !hasAcceptedMimeType) {
    return fe6ClientProfileText.clientManagementFormatting_string_50f59e98
  }

  return null
}

export const statusLabelMap = resources.clients.statuses satisfies Record<
  ClientStatus,
  string
>
