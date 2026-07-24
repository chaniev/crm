import {
  buildClientPhotoUrl,
  type ClientAttendanceHistoryEntry,
  type ClientDetails,
  type ClientListItem,
  type ClientMembership,
  type ClientMembershipChangeReason,
  type ClientMembershipSummary,
  type ClientStatus,
  type MembershipBehaviorKind,
} from '../../../lib/api'
import { resources } from '../../../lib/resources'

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
      ? 'Профессионал'
      : resolveMembershipLabel(
          getCurrentMembershipSummary(client),
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
  const membership = getCurrentMembershipSummary(client)
  const lastVisit = getLatestAttendanceDate(client.attendanceHistory)

  return {
    fullName: client.fullName,
    phoneLabel: canManage ? client.phone || 'Не указан' : null,
    photoUrl: buildClientListPhotoUrl(client),
    statusLabel: statusLabelMap[client.status],
    nextAction: resolveNextAction(client),
    facts: [
      { label: 'Статус', value: statusLabelMap[client.status] },
      {
        label: 'Абонемент',
        value: client.isProfessional
          ? 'Профессионал'
          : resolveMembershipLabel(membership, client.hasCurrentMembership),
      },
      { label: 'Филиал', value: client.branchName || 'Не указан' },
      { label: 'Группа', value: resolveGroupLabel(client) },
      { label: 'Визит', value: resolveLastVisitLabel(lastVisit ?? client.lastVisitDate) },
      { label: 'Контакты', value: canManage ? String(client.contactCount) : 'Скрыты' },
    ],
    events: buildPreviewEvents(client),
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

    return `${visibleCount} активных из ${baseCount}`
  }

  if (status === 'Archived') {
    const baseCount = (activeCount ?? 0) + (archivedCount ?? 0)

    return `${visibleCount} в архиве из ${baseCount}`
  }

  return `${visibleCount} всего`
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
    label: 'Планово',
    tone: 'gray',
    description: 'Нет подсказок от сервера',
    iconKey: '',
    daysUntilExpiration: null,
  }
}

export function formatDateValue(value?: string | null) {
  if (!value) {
    return 'Не указана'
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
    return expirationDate ? formatDateValue(expirationDate) : 'По факту'
  }

  return expirationDate ? formatDateValue(expirationDate) : 'Без даты'
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
  membership: ClientMembershipSummary | ClientMembership | null,
  hasCurrentMembership: boolean,
) {
  if (!hasCurrentMembership || !membership) {
    return 'Без абонемента'
  }

  return behaviorKindLabels[membership.behaviorKind]
}

function resolveMembershipMeta(client: ClientListItem) {
  if (client.isProfessional) {
    return client.professionalComment || 'Профессиональный статус'
  }

  const membership = getCurrentMembershipSummary(client)

  if (!membership) {
    return 'Оформление не начато'
  }

  const expiration = formatExpirationValue(
    membership.behaviorKind,
    membership.expirationDate,
  )
  if (membership.behaviorKind === 'SingleVisit') {
    return membership.singleVisitUsed
      ? `${expiration}, использован`
      : expiration
  }

  return expiration
}

function resolveGroupLabel(
  client: Pick<ClientListItem, 'branchName' | 'groupCount' | 'groups'>,
) {
  const branchPrefix = client.branchName ? `${client.branchName} · ` : ''

  if (client.groupCount === 0 || client.groups.length === 0) {
    return `${branchPrefix}Без группы`
  }

  const firstGroup = client.groups[0]
  const hallSuffix = firstGroup.hallName ? ` · ${firstGroup.hallName}` : ''

  return `${branchPrefix}${firstGroup.name}${hallSuffix}`
}

function resolveLastVisitLabel(value?: string | null) {
  return value ? formatDateValue(value) : 'Нет визитов'
}

function getCurrentMembershipSummary(client: ClientListItem) {
  return client.currentMembershipSummary ?? client.currentMembership
}

function buildPreviewEvents(client: ClientDetails) {
  const membershipEvents = client.membershipHistory.slice(0, 2).map((membership) => ({
    label: formatMembershipChangeReason(membership.changeReason),
    value: formatDateValue(membership.validFrom ?? membership.createdAt ?? membership.purchaseDate),
  }))
  const attendanceEvents = client.attendanceHistory.slice(0, 3).map((entry) => ({
    label: entry.isPresent ? 'Визит' : 'Отметка',
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
    return 'Абонемент'
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
