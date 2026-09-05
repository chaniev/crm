import type { MembershipSalePricingMode } from '../../lib/api'
import { fe7ClientMembershipText } from '../../resources/fe-7-client-membership'


export type MembershipSalePricingValues = {
  pricingMode: MembershipSalePricingMode | null
  membershipCatalogItemId: string
  manualSaleAmount: string
}

export type MembershipSalePricingFieldErrors = Partial<
  Record<keyof MembershipSalePricingValues, string>
>

export const membershipSalePricingModeLabels: Record<
  MembershipSalePricingMode,
  string
> = {
  Catalog: fe7ClientMembershipText.membershipSalePricing_catalog_f2cb507f,
  CatalogOverride: fe7ClientMembershipText.membershipSalePricing_catalogOverride_00f9729f,
  AmountOnly: fe7ClientMembershipText.membershipSalePricing_amountOnly_92f64d0d,
}

export function createEmptyMembershipSalePricingValues(): MembershipSalePricingValues {
  return {
    pricingMode: null,
    membershipCatalogItemId: '',
    manualSaleAmount: '',
  }
}

export function validateMembershipSalePricing(
  values: MembershipSalePricingValues,
): MembershipSalePricingFieldErrors {
  const errors: MembershipSalePricingFieldErrors = {}

  if (!values.pricingMode) {
    errors.pricingMode = fe7ClientMembershipText.membershipSalePricing_string_a81f5813
    return errors
  }

  if (
    (values.pricingMode === 'Catalog' ||
      values.pricingMode === 'CatalogOverride') &&
    !values.membershipCatalogItemId
  ) {
    errors.membershipCatalogItemId = fe7ClientMembershipText.membershipSalePricing_string_4ec1f493
  }

  if (
    (values.pricingMode === 'CatalogOverride' ||
      values.pricingMode === 'AmountOnly') &&
    parseWholeRubleAmount(values.manualSaleAmount) === null
  ) {
    errors.manualSaleAmount = fe7ClientMembershipText.membershipSalePricing_string_68bb61b1
  }

  return errors
}

export function buildMembershipSalePricingPayload(
  values: MembershipSalePricingValues,
) {
  if (values.pricingMode === 'Catalog') {
    return { membershipCatalogItemId: values.membershipCatalogItemId }
  }

  if (values.pricingMode === 'CatalogOverride') {
    return {
      membershipCatalogItemId: values.membershipCatalogItemId,
      manualSaleAmount: parseWholeRubleAmount(values.manualSaleAmount) ?? undefined,
    }
  }

  return {
    manualSaleAmount: parseWholeRubleAmount(values.manualSaleAmount) ?? undefined,
  }
}

export function parseWholeRubleAmount(value: string) {
  const normalized = value.trim()
  if (!/^\d+$/.test(normalized)) {
    return null
  }

  const amount = Number(normalized)
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null
}
