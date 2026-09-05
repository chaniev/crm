import { fe15FinanceText } from '../../resources/fe-15-finance'
export type FinanceScopeFilters = {
  periodPreset: 'month' | 'quarter' | 'year' | 'custom'
  anchorDate: string
  from: string
  to: string
  branchId: string | null
  trainerId: string | null
}

export type FinanceScopeContext = {
  branchLabel: string
  filters: FinanceScopeFilters
  trainerLabel: string
}

export type FinanceScopeResolution =
  | {
      kind: 'valid'
      scope: FinanceScopeContext
    }
  | {
      kind: 'inconsistent'
      message: string
    }

export function resolveFinanceScopeLabels({
  filters,
  branchOptions,
  trainerOptions,
}: {
  filters: FinanceScopeFilters
  branchOptions: Array<{ value: string; label: string }>
  trainerOptions: Array<{ value: string; label: string }>
}): FinanceScopeResolution {
  const branchLabel = resolveSelectedLabel({
    allLabel: fe15FinanceText.financeReportScope_allLabel_1b93eb9a,
    fieldLabel: fe15FinanceText.financeReportScope_fieldLabel_186f7067,
    options: branchOptions,
    selectedId: filters.branchId,
  })

  if (branchLabel.kind === 'inconsistent') {
    return branchLabel
  }

  const trainerLabel = resolveSelectedLabel({
    allLabel: fe15FinanceText.financeReportScope_allLabel_0b471d0c,
    fieldLabel: fe15FinanceText.financeReportScope_fieldLabel_10e82072,
    options: trainerOptions,
    selectedId: filters.trainerId,
  })

  if (trainerLabel.kind === 'inconsistent') {
    return trainerLabel
  }

  return {
    kind: 'valid',
    scope: {
      branchLabel: branchLabel.label,
      filters,
      trainerLabel: trainerLabel.label,
    },
  }
}

function resolveSelectedLabel({
  allLabel,
  fieldLabel,
  options,
  selectedId,
}: {
  allLabel: string
  fieldLabel: string
  options: Array<{ value: string; label: string }>
  selectedId: string | null
}):
  | { kind: 'valid'; label: string }
  | { kind: 'inconsistent'; message: string } {
  if (!selectedId) {
    return { kind: 'valid', label: allLabel }
  }

  const option = options.find((item) => item.value === selectedId)

  if (option) {
    return { kind: 'valid', label: option.label }
  }

  return {
    kind: 'inconsistent',
    message: fe15FinanceText.financeReportScope_message_c9d28435(fieldLabel),
  }
}
