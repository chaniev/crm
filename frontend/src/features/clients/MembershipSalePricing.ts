import type { MembershipSalePricingMode } from '../../lib/api'

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
  Catalog: 'По каталожной цене',
  CatalogOverride: 'Индивидуальная сумма',
  AmountOnly: 'Без варианта каталога',
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
    errors.pricingMode = 'Выберите способ расчёта.'
    return errors
  }

  if (
    (values.pricingMode === 'Catalog' ||
      values.pricingMode === 'CatalogOverride') &&
    !values.membershipCatalogItemId
  ) {
    errors.membershipCatalogItemId = 'Выберите абонемент.'
  }

  if (
    (values.pricingMode === 'CatalogOverride' ||
      values.pricingMode === 'AmountOnly') &&
    parseWholeRubleAmount(values.manualSaleAmount) === null
  ) {
    errors.manualSaleAmount = 'Укажите положительную сумму целыми рублями.'
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
