import { describe, expect, test } from 'vitest'
import {
  countClientListFilters,
  createDefaultClientListFilters,
  toClientListQueryParams,
} from './clientListFilters'

describe('client list status-free payment filters', () => {
  test('does not send removed payment filters', () => {
    const filters = createDefaultClientListFilters()

    expect(countClientListFilters(filters)).toBe(0)
    expect(toClientListQueryParams(filters, 1)).not.toHaveProperty('paymentStatus')
  })
})
