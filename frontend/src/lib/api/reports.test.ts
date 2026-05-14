import { describe, expect, test } from 'vitest'
import { buildFinancialReportQueryString } from './reports'

describe('buildFinancialReportQueryString', () => {
  test('serializes preset report params without custom range fields', () => {
    const query = new URLSearchParams(
      buildFinancialReportQueryString({
        periodPreset: 'month',
        anchorDate: '2026-05-14',
        from: '',
        to: '',
        branchId: null,
        trainerId: 'trainer-1',
      }),
    )

    expect(query.get('periodPreset')).toBe('month')
    expect(query.get('anchorDate')).toBe('2026-05-14')
    expect(query.get('trainerId')).toBe('trainer-1')
    expect(query.has('from')).toBe(false)
    expect(query.has('to')).toBe(false)
    expect(query.has('branchId')).toBe(false)
  })

  test('serializes custom report params with backend query keys', () => {
    const query = new URLSearchParams(
      buildFinancialReportQueryString({
        periodPreset: 'custom',
        from: '2026-05-10',
        to: '2026-05-15',
        branchId: 'branch-1',
        trainerId: 'trainer-1',
      }),
    )

    expect(query.toString()).toBe(
      'periodPreset=custom&from=2026-05-10&to=2026-05-15&branchId=branch-1&trainerId=trainer-1',
    )
  })
})
