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

export type MembershipPurchaseFormValues = MembershipSalePricingValues & {
  validFrom: string
  validTo: string
  paymentDate: string
  professionalComment: string
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
  }
}

export function createMembershipRenewInitialValues(
  businessDate: string,
): MembershipRenewFormValues {
  return {
    ...createEmptyMembershipSalePricingValues(),
    paymentDate: businessDate,
    professionalComment: '',
  }
}

export function createMembershipCorrectionInitialValues(
  currentMembership: ClientMembership,
): MembershipCorrectionFormValues {
  return {
    validFrom: currentMembership.validFrom ?? currentMembership.purchaseDate,
    validTo: currentMembership.expirationDate ?? '',
    paymentDate: currentMembership.paymentDate,
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

  return errors
}

function isExpirationRequired(behaviorKind: MembershipBehaviorKind) {
  return behaviorKind !== 'SingleVisit'
}
