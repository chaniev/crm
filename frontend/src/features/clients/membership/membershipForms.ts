import type {
  ClientMembership,
  MembershipBehaviorKind,
} from '../../../lib/api'
import {
  createEmptyMembershipSalePricingValues,
  type MembershipSalePricingValues,
} from '../MembershipSalePricing'
import type {
  MembershipCorrectionFormValues,
  MembershipRenewFormValues,
} from '../ClientManagement.types'
import { mapMembershipTargetsToGroupIds } from './membershipTargetGroups'

export type MembershipPurchaseFormValues = MembershipSalePricingValues & {
  validFrom: string
  validTo: string
  paymentDate: string
  professionalComment: string
  targetGroupIds: string[]
}

export function createMembershipPurchaseInitialValues(
  businessDate: string,
): MembershipPurchaseFormValues {
  return {
    ...createEmptyMembershipSalePricingValues(),
    validFrom: '',
    validTo: '',
    paymentDate: businessDate,
    professionalComment: '',
    targetGroupIds: [],
  }
}

export function createMembershipRenewInitialValues(
  businessDate: string,
  currentMembership: ClientMembership,
): MembershipRenewFormValues {
  return {
    ...createEmptyMembershipSalePricingValues(),
    paymentDate: businessDate,
    professionalComment: '',
    targetGroupIds: mapMembershipTargetsToGroupIds(currentMembership.targetGroups),
  }
}

export function createMembershipCorrectionInitialValues(
  currentMembership: ClientMembership,
): MembershipCorrectionFormValues {
  return {
    validFrom: currentMembership.validFrom ?? currentMembership.purchaseDate,
    validTo: currentMembership.expirationDate ?? '',
    paymentDate: currentMembership.paymentDate,
    targetGroupIds: mapMembershipTargetsToGroupIds(currentMembership.targetGroups),
  }
}

export function validateMembershipCorrectionForm(
  values: MembershipCorrectionFormValues,
  behaviorKind: MembershipBehaviorKind,
) {
  const errors: Record<string, string> = {}

  if (!values.validFrom) {
    errors.validFrom = 'Укажите начало срока.'
  }

  if (isExpirationRequired(behaviorKind)) {
    if (!values.validTo) {
      errors.validTo = 'Укажите дату окончания.'
    }
  }

  if (!values.paymentDate) {
    errors.paymentDate = 'Укажите дату оплаты.'
  }

  validateTargetGroups(values.targetGroupIds, behaviorKind, errors)

  return errors
}

function isExpirationRequired(behaviorKind: MembershipBehaviorKind) {
  return behaviorKind !== 'SingleVisit'
}

export function validateTargetGroups(
  targetGroupIds: string[],
  behaviorKind: MembershipBehaviorKind,
  errors: Record<string, string>,
) {
  if (targetGroupIds.length === 0) {
    errors.targetGroupIds = 'Выберите хотя бы одну группу'
  }

  if (behaviorKind === 'SingleVisit' && targetGroupIds.length !== 1) {
    errors.targetGroupIds = 'Разовое посещение действует только в одной группе'
  }

  if (behaviorKind !== 'SingleVisit' && targetGroupIds.length > 5) {
    errors.targetGroupIds = 'Можно выбрать не больше 5 групп'
  }
}
