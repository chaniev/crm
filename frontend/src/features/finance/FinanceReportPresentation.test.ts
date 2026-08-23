import { describe, expect, test } from 'vitest'
import {
  resolveFinanceScopeLabels,
  type FinanceScopeFilters,
} from './FinanceReportScope'

const baselineFilters: FinanceScopeFilters = {
  periodPreset: 'month',
  anchorDate: '2026-08-23',
  from: '2026-08-01',
  to: '2026-08-23',
  branchId: null,
  trainerId: null,
}

describe('finance report presentation', () => {
  test('uses explicit all-scope labels for null backend filters', () => {
    expect(
      resolveFinanceScopeLabels({
        branchOptions: [],
        filters: baselineFilters,
        trainerOptions: [],
      }),
    ).toEqual({
      kind: 'valid',
      scope: {
        branchLabel: 'Все филиалы',
        filters: baselineFilters,
        trainerLabel: 'Все тренеры',
      },
    })
  })

  test('preserves labels from the authorized option sets', () => {
    const filters = {
      ...baselineFilters,
      branchId: 'branch-1',
      trainerId: 'trainer-1',
    }

    expect(
      resolveFinanceScopeLabels({
        branchOptions: [{ value: 'branch-1', label: 'Центр' }],
        filters,
        trainerOptions: [
          { value: 'trainer-1', label: 'Ирина Тренер (irina)' },
        ],
      }),
    ).toEqual({
      kind: 'valid',
      scope: {
        branchLabel: 'Центр',
        filters,
        trainerLabel: 'Ирина Тренер (irina)',
      },
    })
  })

  test.each([
    {
      filters: { ...baselineFilters, branchId: 'missing-branch' },
      expectedField: 'филиала',
    },
    {
      filters: { ...baselineFilters, trainerId: 'missing-trainer' },
      expectedField: 'тренера',
    },
  ])(
    'treats a selected id without an authorized $expectedField label as inconsistent',
    ({ filters, expectedField }) => {
      const result = resolveFinanceScopeLabels({
        branchOptions: [],
        filters,
        trainerOptions: [],
      })

      expect(result.kind).toBe('inconsistent')
      expect(result).toEqual({
        kind: 'inconsistent',
        message: expect.stringContaining(expectedField),
      })
    },
  )
})
