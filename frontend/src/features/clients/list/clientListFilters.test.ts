import { describe, expect, test } from 'vitest'
import {
  countAdvancedClientListFilters,
  countClientListFilters,
  createDefaultClientListFilters,
  resetAdvancedClientListFilters,
  toClientListQueryParams,
  type ClientListFilterValues,
} from './clientListFilters'

describe('client list status-free payment filters', () => {
  test('does not send removed payment filters', () => {
    const filters = createDefaultClientListFilters()

    expect(countClientListFilters(filters)).toBe(0)
    expect(toClientListQueryParams(filters, 1)).not.toHaveProperty('paymentStatus')
  })
})

describe('advanced filter counters and reset', () => {
  test('countAdvancedClientListFilters excludes normalized query and status default', () => {
    const filters: ClientListFilterValues = {
      ...createDefaultClientListFilters(),
      query: '  Иван ',
      status: 'Archived',
      groupId: 'group-1',
      withoutPhoto: true,
      withoutMembership: true,
      withoutGroup: true,
      expiringSoon: true,
    }

    expect(countAdvancedClientListFilters(filters)).toBe(6)
    expect(countClientListFilters(filters)).toBeGreaterThan(5)
  })

  test('resetAdvancedClientListFilters preserves query and restores advanced defaults', () => {
    const filters: ClientListFilterValues = {
      ...createDefaultClientListFilters(),
      query: '  Поиск  ',
      status: 'Archived',
      groupId: 'group-1',
      withoutPhoto: true,
      withoutMembership: true,
      trial: true,
      pageSize: '50',
      membershipExpiresFrom: '2026-01-01',
      expiringSoon: true,
    }

    const reset = resetAdvancedClientListFilters(filters)

    expect(reset).toMatchObject({
      query: '  Поиск  ',
      status: 'Active',
      groupId: null,
      withoutPhoto: false,
      withoutMembership: false,
      withoutGroup: false,
      expiringSoon: false,
      trial: false,
      pageSize: '20',
    })
    expect(reset.membershipExpiresFrom).toBe('')
    expect(reset.membershipExpiresTo).toBe('')
  })
})
