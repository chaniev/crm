import { describe, expect, test } from 'vitest'
import {
  calculateClientAge,
  formatClientBirthDate,
  getClientAgeDisplayValue,
} from './clientBirthDate'

describe('client birth date helpers', () => {
  test.each([
    ['2000-07-24', '2026-07-23', 25],
    ['2000-07-23', '2026-07-23', 26],
    ['2000-07-22', '2026-07-23', 26],
    ['2000-12-31', '2027-01-01', 26],
  ])(
    'calculates full years for %s against business date %s',
    (birthDate, businessDate, expectedAge) => {
      expect(calculateClientAge(birthDate, businessDate)).toBe(expectedAge)
    },
  )

  test.each([
    ['2004-02-29', '2026-02-28', 21],
    ['2004-02-29', '2026-03-01', 22],
    ['2004-02-29', '2028-02-29', 24],
  ])(
    'uses 1 March as the non-leap anniversary for 29 February: %s / %s',
    (birthDate, businessDate, expectedAge) => {
      expect(calculateClientAge(birthDate, businessDate)).toBe(expectedAge)
    },
  )

  test('does not compute a negative age for future dates', () => {
    expect(calculateClientAge('2030-01-01', '2026-07-23')).toBeNull()
    expect(getClientAgeDisplayValue('2030-01-01', '2026-07-23')).toBe(
      'Не вычисляется',
    )
  })

  test.each([
    ['2000-02-29', '29 февраля 2000 г.'],
    ['0001-01-01', '1 января 0001 г.'],
    ['0099-12-31', '31 декабря 0099 г.'],
  ])('formats %s as a Russian calendar date without shifting it', (value, expected) => {
    expect(formatClientBirthDate(value)).toBe(expected)
  })

  test.each(['2000-2-29', '2000-02-30', 'not-a-date'])(
    'rejects invalid date-only values without Date parsing fallback: %s',
    (value) => {
      expect(formatClientBirthDate(value)).toBeNull()
      expect(calculateClientAge(value, '2026-07-23')).toBeNull()
    },
  )
})
