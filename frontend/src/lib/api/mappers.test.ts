import { describe, expect, test } from 'vitest'
import { mapUserRole } from './mappers'

describe('mapUserRole', () => {
  test('accepts SuperAdministrator as a strict backend role', () => {
    expect(mapUserRole('SuperAdministrator')).toBe('SuperAdministrator')
  })

  test('rejects unknown roles instead of coercing them to Coach', () => {
    expect(mapUserRole('Owner')).toBeUndefined()
  })
})
