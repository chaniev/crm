import { getGroups, type ClientMembershipTargetGroup, type TrainingGroupListItem } from '../../../lib/api'

export async function loadAllActiveMembershipTargetGroups(signal: AbortSignal) {
  const take = 100
  const groups: TrainingGroupListItem[] = []
  let skip = 0
  let totalCount = Number.POSITIVE_INFINITY

  while (groups.length < totalCount) {
    const page = await getGroups({ skip, take, isActive: true }, signal)
    if (!page) {
      break
    }
    groups.push(...page.items)
    totalCount = page.totalCount
    skip += page.items.length

    if (page.items.length === 0) {
      break
    }
  }

  return groups
}

export function isMembershipTargetLoadAbort(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function pickTargetGroupError(errors: Record<string, unknown>) {
  const keys = [
    'targetGroupIds',
    'TargetGroupIds',
    'targetGroups',
    'TargetGroups',
    'targetGroupIds[0]',
    'TargetGroupIds[0]',
    'targetGroupIds[1]',
    'TargetGroupIds[1]',
    'targetGroupIds[2]',
    'TargetGroupIds[2]',
    'targetGroupIds[3]',
    'TargetGroupIds[3]',
    'targetGroupIds[4]',
    'TargetGroupIds[4]',
  ]

  for (const key of keys) {
    const error = errors[key]
    if (typeof error === 'string') {
      return error
    }
  }

  return undefined
}

export function mapMembershipTargetsToGroupIds(
  targets: ClientMembershipTargetGroup[],
) {
  return [...targets]
    .sort((left, right) => left.position - right.position)
    .map((target) => target.groupId)
}
