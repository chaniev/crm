import {
  buildClientPhotoUrl,
  type ClientAttendanceHistoryEntry,
  type ClientDetails,
  type ClientListItem,
  type ClientMembership,
  type ClientMembershipChangeReason,
  type ClientStatus,
  type MembershipBehaviorKind,
} from '../../../lib/api'
import { resources } from '../../../lib/resources'
import { fe5ClientListText } from '../../../resources/fe-5-client-list'


export type ClientNextActionViewModel = {
  label: string
  tone: string
  description: string
  iconKey: string
  daysUntilExpiration: number | null
}

export type ClientRowViewModel = {
  client: ClientListItem
  photoUrl: string | null
  statusLabel: string
  membershipLabel: string
  membershipMeta: string
  nextAction: ClientNextActionViewModel
  groupLabel: string
  lastVisitLabel: string
}

export type ClientPreviewViewModel = {
  fullName: string
  phoneLabel: string | null
  photoUrl: string | null
  statusLabel: string
  nextAction: ClientNextActionViewModel
  facts: Array<{ label: string; value: string }>
  events: Array<{ label: string; value: string }>
}

export type ClientCompactViewModel = {
  accessibleName: string
  branchLabel: string | null
  fullName: string
  nextAction: ClientNextActionViewModel
  phoneLabel: string | null
  photoUrl: string | null
}

export const statusLabelMap = resources.clients.statuses satisfies Record<
  ClientStatus,
  string
>

export const behaviorKindLabels = resources.clients
  .behaviorKindLabels satisfies Record<MembershipBehaviorKind, string>

const membershipChangeReasonLabels = resources.clients.list
  .membershipChangeReasonLabels satisfies Record<
  ClientMembershipChangeReason,
  string
>

export function buildClientRowViewModel(
  client: ClientListItem,
): ClientRowViewModel {
  return {
    client,
    photoUrl: buildClientListPhotoUrl(client),
    statusLabel: statusLabelMap[client.status],
    membershipLabel: client.isProfessional
      ? fe5ClientListText.clientListViewModel_string_76fc7876
      : resolveMembershipLabel(
          getSingleCurrentMembershipForLabel(client),
          client.hasCurrentMembership,
        ),
    membershipMeta: resolveMembershipMeta(client),
    nextAction: resolveNextAction(client),
    groupLabel: resolveGroupLabel(client),
    lastVisitLabel: resolveLastVisitLabel(client.lastVisitDate),
  }
}

export function buildClientPreviewViewModel(
  client: ClientDetails,
  canManage: boolean,
): ClientPreviewViewModel {
  const membership = getSingleCurrentMembershipForLabel(client)
  const lastVisit = getLatestAttendanceDate(client.attendanceHistory)

  return {
    fullName: client.fullName,
    phoneLabel: canManage ? client.phone || fe5ClientListText.clientListViewModel_string_0d836c15 : null,
    photoUrl: buildClientListPhotoUrl(client),
    statusLabel: statusLabelMap[client.status],
    nextAction: resolveNextAction(client),
    facts: [
      { label: fe5ClientListText.clientListViewModel_label_225077c6, value: statusLabelMap[client.status] },
      {
        label: fe5ClientListText.clientListViewModel_label_1139430b,
        value: client.isProfessional
          ? fe5ClientListText.clientListViewModel_string_76fc7876
          : resolveMembershipLabel(membership, client.hasCurrentMembership),
      },
      { label: fe5ClientListText.clientListViewModel_label_2f17c4d2, value: client.branchName || fe5ClientListText.clientListViewModel_string_0d836c15 },
      { label: fe5ClientListText.clientListViewModel_label_907efbd4, value: resolveGroupLabel(client) },
      { label: fe5ClientListText.clientListViewModel_label_87a3edde, value: resolveLastVisitLabel(lastVisit ?? client.lastVisitDate) },
      { label: fe5ClientListText.clientListViewModel_label_fca8d5aa, value: canManage ? String(client.contactCount) : fe5ClientListText.clientListViewModel_string_19fc4b0c },
    ],
    events: buildPreviewEvents(client),
  }
}

export function buildClientCompactViewModel(
  client: ClientListItem,
  {
    canSeePhone,
    showBranchIdentity,
  }: {
    canSeePhone: boolean
    showBranchIdentity: boolean
  },
): ClientCompactViewModel {
  const phoneLabel = canSeePhone ? client.phone || fe5ClientListText.clientListViewModel_string_1fc40e1a : null
  const branchLabel = showBranchIdentity ? client.branchName || fe5ClientListText.clientListViewModel_string_a560016c : null
  const nextAction = resolveCompactNextAction(client)
  const accessibleParts = [
    client.fullName,
    phoneLabel,
    branchLabel,
    nextAction.label,
  ].filter(Boolean)

  return {
    accessibleName: fe5ClientListText.clientListViewModel_accessibleName_50f65f53(accessibleParts.join(', ')),
    branchLabel,
    fullName: client.fullName,
    nextAction,
    phoneLabel,
    photoUrl: buildClientListPhotoUrl(client),
  }
}

export function resolveHeaderCountsLabel(
  totalCount: number | null,
  activeCount: number | null,
  archivedCount: number | null,
  status: ClientStatus | 'all',
) {
  const visibleCount = totalCount ?? 0

  if (status === 'Active') {
    const baseCount = (activeCount ?? 0) + (archivedCount ?? 0)

    return fe5ClientListText.clientListViewModel_template_2564fff1(visibleCount, baseCount)
  }

  if (status === 'Archived') {
    const baseCount = (activeCount ?? 0) + (archivedCount ?? 0)

    return fe5ClientListText.clientListViewModel_template_1c66e7c6(visibleCount, baseCount)
  }

  return fe5ClientListText.clientListViewModel_template_8d3d1cda(visibleCount)
}

export function resolveNextAction(client: ClientListItem): ClientNextActionViewModel {
  const [hint] = client.actionHints

  if (hint) {
    return {
      label: hint.title,
      tone: hint.tone || 'gray',
      description: hint.description,
      iconKey: hint.iconKey,
      daysUntilExpiration: hint.daysUntilExpiration,
    }
  }

  return {
    label: fe5ClientListText.clientListViewModel_label_c19bb335,
    tone: 'gray',
    description: fe5ClientListText.clientListViewModel_description_f6bf3dbb,
    iconKey: '',
    daysUntilExpiration: null,
  }
}

function resolveCompactNextAction(client: ClientListItem): ClientNextActionViewModel {
  if (client.status === 'Archived') {
    return {
      label: fe5ClientListText.clientListViewModel_label_34886925,
      tone: 'gray',
      description: statusLabelMap.Archived,
      iconKey: 'archive',
      daysUntilExpiration: null,
    }
  }

  const [hint] = client.actionHints

  if (!hint || isNonMeaningfulCompactHint(hint)) {
    return buildActiveCompactAction()
  }

  if (hint.daysUntilExpiration !== null && hint.daysUntilExpiration >= 0) {
    return {
      label: fe5ClientListText.clientListViewModel_label_ed73f50a(formatRelativeExpirationDate(hint.daysUntilExpiration)),
      tone: hint.tone || 'orange',
      description: hint.description,
      iconKey: hint.iconKey,
      daysUntilExpiration: hint.daysUntilExpiration,
    }
  }

  if (hint.iconKey === 'group' || hint.title === fe5ClientListText.clientListViewModel_string_9ed5aecd) {
    return {
      label: fe5ClientListText.clientListViewModel_string_9ed5aecd,
      tone: hint.tone || 'blue',
      description: hint.description,
      iconKey: hint.iconKey,
      daysUntilExpiration: hint.daysUntilExpiration,
    }
  }

  if (
    hint.title === fe5ClientListText.clientListViewModel_string_42be0520 ||
    (
      hint.iconKey === 'membership' &&
      hint.title === fe5ClientListText.clientListViewModel_string_63e29a54 &&
      hint.description === fe5ClientListText.clientListViewModel_string_202af31a
    )
  ) {
    return {
      label: fe5ClientListText.clientListViewModel_string_42be0520,
      tone: hint.tone || 'yellow',
      description: hint.description,
      iconKey: hint.iconKey,
      daysUntilExpiration: hint.daysUntilExpiration,
    }
  }

  return {
    label: hint.title || fe5ClientListText.clientListViewModel_string_a87a4b39,
    tone: hint.tone || 'gray',
    description: hint.description,
    iconKey: hint.iconKey,
    daysUntilExpiration: hint.daysUntilExpiration,
  }
}

function buildActiveCompactAction(): ClientNextActionViewModel {
  return {
    label: fe5ClientListText.clientListViewModel_string_a87a4b39,
    tone: 'teal',
    description: fe5ClientListText.clientListViewModel_description_f6bf3dbb,
    iconKey: 'check',
    daysUntilExpiration: null,
  }
}

function isNonMeaningfulCompactHint(
  hint: { iconKey: string; title: string; tone: string },
) {
  return (
    hint.tone === 'gray' ||
    hint.iconKey === 'check' ||
    hint.title === fe5ClientListText.clientListViewModel_label_c19bb335 ||
    hint.title === fe5ClientListText.clientListViewModel_string_6bd8ee2e
  )
}

function formatRelativeExpirationDate(daysUntilExpiration: number) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + daysUntilExpiration)

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
  }).format(date)
}

export function formatDateValue(value?: string | null) {
  if (!value) {
    return fe5ClientListText.clientListViewModel_string_f16cbd32
  }

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? parseDateValue(value)
    : new Date(value)

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(date)
}

export function formatExpirationValue(
  behaviorKind: MembershipBehaviorKind,
  expirationDate?: string | null,
) {
  if (behaviorKind === 'SingleVisit') {
    return expirationDate ? formatDateValue(expirationDate) : fe5ClientListText.clientListViewModel_string_6c2aee20
  }

  return expirationDate ? formatDateValue(expirationDate) : fe5ClientListText.clientListViewModel_string_c3c76d85
}

function buildClientListPhotoUrl(client: Pick<ClientListItem, 'id' | 'photo' | 'updatedAt'>) {
  return client.photo && client.id
    ? buildClientPhotoUrl(
        client.id,
        client.photo.uploadedAt ?? client.photo.path ?? client.updatedAt ?? 'list',
      )
    : null
}

function resolveMembershipLabel(
  membership: ClientMembership | null,
  hasCurrentMembership: boolean,
) {
  if (!hasCurrentMembership || !membership) {
    return hasCurrentMembership ? fe5ClientListText.clientListViewModel_string_f409e458 : fe5ClientListText.clientListViewModel_string_42be0520
  }

  return behaviorKindLabels[membership.behaviorKind]
}

function resolveMembershipMeta(client: ClientListItem) {
  if (client.isProfessional) {
    return client.professionalComment || fe5ClientListText.clientListViewModel_string_81ee659f
  }

  const membership = getSingleCurrentMembershipForLabel(client)

  if (!membership) {
    return client.hasCurrentMembership ? client.membershipState : fe5ClientListText.clientListViewModel_string_b36bd7f1
  }

  const expiration = formatExpirationValue(
    membership.behaviorKind,
    membership.expirationDate,
  )
  if (membership.behaviorKind === 'SingleVisit') {
    return membership.singleVisitUsed
      ? fe5ClientListText.clientListViewModel_template_0705739a(expiration)
      : expiration
  }

  return expiration
}

function resolveGroupLabel(
  client: Pick<ClientListItem, 'branchName' | 'groupCount' | 'groups'>,
) {
  const branchPrefix = client.branchName ? `${client.branchName} · ` : ''

  if (client.groupCount === 0 || client.groups.length === 0) {
    return fe5ClientListText.clientListViewModel_template_538d6d18(branchPrefix)
  }

  const firstGroup = client.groups[0]
  const hallSuffix = firstGroup.hallName ? ` · ${firstGroup.hallName}` : ''

  return `${branchPrefix}${firstGroup.name}${hallSuffix}`
}

function resolveLastVisitLabel(value?: string | null) {
  return value ? formatDateValue(value) : fe5ClientListText.clientListViewModel_string_48edd223
}

function getSingleCurrentMembershipForLabel(client: ClientListItem) {
  return client.currentMemberships.length === 1 ? client.currentMemberships[0] : null
}

function buildPreviewEvents(client: ClientDetails) {
  const membershipEvents = client.membershipHistory.slice(0, 2).map((membership) => ({
    label: formatMembershipChangeReason(membership.changeReason),
    value: formatDateValue(membership.validFrom ?? membership.createdAt ?? membership.purchaseDate),
  }))
  const attendanceEvents = client.attendanceHistory.slice(0, 3).map((entry) => ({
    label: entry.isPresent ? fe5ClientListText.clientListViewModel_label_87a3edde : fe5ClientListText.clientListViewModel_string_b0e01526,
    value: `${formatDateValue(entry.trainingDate)} · ${entry.groupName}`,
  }))

  return [...attendanceEvents, ...membershipEvents].slice(0, 3)
}

function getLatestAttendanceDate(entries: ClientAttendanceHistoryEntry[]) {
  return entries
    .filter((entry) => entry.isPresent)
    .map((entry) => entry.trainingDate)
    .sort((left, right) => right.localeCompare(left))[0]
}

function formatMembershipChangeReason(reason?: string) {
  if (!reason) {
    return fe5ClientListText.clientListViewModel_label_1139430b
  }

  return membershipChangeReasonLabels[reason as ClientMembershipChangeReason] ?? reason
}

function parseDateValue(value: string) {
  const [year, month, day] = value.split('-').map(Number)

  if (!year || !month || !day) {
    return new Date(Number.NaN)
  }

  return new Date(year, month - 1, day)
}
