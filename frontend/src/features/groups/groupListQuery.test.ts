import { describe, expect, test } from 'vitest'
import {
  createDefaultGroupListFilters,
  getGroupListMaxPage,
  getGroupListRange,
  normalizeGroupListFilters,
  toGroupListQueryParams,
} from './groupListQuery'

describe('group list query helpers', () => {
  test('trims query and serializes only active criteria', () => {
    const filters = normalizeGroupListFilters({
      appliedQuery: '  Утренняя  ',
      isActive: false,
      withoutTrainer: true,
    })

    expect(toGroupListQueryParams(filters, 3)).toEqual({
      page: 3,
      pageSize: 10,
      query: 'Утренняя',
      isActive: false,
      withoutTrainer: true,
    })
  })

  test('omits blank query and absent filters', () => {
    expect(toGroupListQueryParams(createDefaultGroupListFilters(), 0)).toEqual({
      page: 1,
      pageSize: 10,
    })
  })

  test('derives visible range and bounded max page', () => {
    expect(getGroupListRange(10, 2)).toEqual({ start: 11, end: 20 })
    expect(getGroupListRange(0, 3)).toEqual({ start: 0, end: 0 })
    expect(getGroupListMaxPage(0)).toBe(1)
    expect(getGroupListMaxPage(21)).toBe(3)
  })
})
