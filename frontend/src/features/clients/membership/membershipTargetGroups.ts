import { type ClientMembershipTargetGroup } from '../../../lib/api'
import { loadClientGroupOptions } from '../loadClientGroupOptions'

export function loadAllActiveMembershipTargetGroups(signal: AbortSignal) {
  return loadClientGroupOptions(signal, true)
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
