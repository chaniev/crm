
import type {
  CorrectClientMembershipRequest,
  PurchaseClientMembershipRequest,
  RenewClientMembershipRequest,
} from '../../lib/api'
import type { MembershipSalePricingValues } from './MembershipSalePricing'

export type MembershipActionMode = 'purchase' | 'renew' | 'correct'

export type MembershipCorrectionFormValues = {
  validFrom: string
  validTo: string
  paymentDate: string
}

export type MembershipRenewFormValues = {
  paymentDate: string
  professionalComment: string
} & MembershipSalePricingValues

export type MembershipActionSubmission =
  | {
      kind: 'purchase'
      payload: PurchaseClientMembershipRequest
      idempotencyKey: string
    }
  | {
      kind: 'renew'
      payload: RenewClientMembershipRequest
      idempotencyKey: string
    }
  | {
      kind: 'correct'
      payload: CorrectClientMembershipRequest
      idempotencyKey: string
    }

export type ClientTransferFormValues = MembershipSalePricingValues & {
  branchId: string
  groupId: string
  validFrom: string
  validTo: string
  paymentDate: string
  professionalComment: string
}
