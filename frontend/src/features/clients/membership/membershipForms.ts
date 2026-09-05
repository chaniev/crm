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
import { fe7ClientMembershipText } from '../../../resources/fe-7-client-membership'


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
    errors.validFrom = fe7ClientMembershipText.membershipForms_string_c6401e27
  }

  if (isExpirationRequired(behaviorKind)) {
    if (!values.validTo) {
      errors.validTo = fe7ClientMembershipText.membershipForms_string_0a04a7f3
    }
  }

  if (!values.paymentDate) {
    errors.paymentDate = fe7ClientMembershipText.membershipForms_string_c17309b4
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
    errors.targetGroupIds = fe7ClientMembershipText.membershipForms_string_95193c08
  }

  if (behaviorKind === 'SingleVisit' && targetGroupIds.length !== 1) {
    errors.targetGroupIds = fe7ClientMembershipText.membershipForms_string_f603ddac
  }

  if (behaviorKind !== 'SingleVisit' && targetGroupIds.length > 5) {
    errors.targetGroupIds = fe7ClientMembershipText.membershipForms_string_55dc184c
  }
}
