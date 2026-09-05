import { fe6ClientProfileText } from '../../resources/fe-6-client-profile'
type DateOnlyParts = {
  year: number
  month: number
  day: number
}

const russianMonthNames = [
  fe6ClientProfileText.clientBirthDate_string_05ae68ac,
  fe6ClientProfileText.clientBirthDate_string_3ae2c0e9,
  fe6ClientProfileText.clientBirthDate_string_6cfa0bb4,
  fe6ClientProfileText.clientBirthDate_string_3144ee44,
  fe6ClientProfileText.clientBirthDate_string_2869fa11,
  fe6ClientProfileText.clientBirthDate_string_b4c08e7b,
  fe6ClientProfileText.clientBirthDate_string_a18a66ad,
  fe6ClientProfileText.clientBirthDate_string_4ae69d9d,
  fe6ClientProfileText.clientBirthDate_string_67cb393e,
  fe6ClientProfileText.clientBirthDate_string_fd088563,
  fe6ClientProfileText.clientBirthDate_string_01bd4525,
  fe6ClientProfileText.clientBirthDate_string_866b5e92,
] as const

export function formatClientBirthDate(value: string | null | undefined) {
  const parts = parseDateOnly(value)

  if (!parts) {
    return null
  }

  return fe6ClientProfileText.clientBirthDate_template_5d0c128d(parts.day, russianMonthNames[parts.month - 1], formatYear(parts.year))
}

export function calculateClientAge(
  birthDate: string | null | undefined,
  businessDate: string | null | undefined,
) {
  const birth = parseDateOnly(birthDate)
  const business = parseDateOnly(businessDate)

  if (!birth || !business || compareDateOnly(birth, business) > 0) {
    return null
  }

  let age = business.year - birth.year
  const anniversary = getAnniversaryInYear(birth, business.year)

  if (
    business.month < anniversary.month ||
    (business.month === anniversary.month && business.day < anniversary.day)
  ) {
    age -= 1
  }

  return age
}

export function getClientAgeDisplayValue(
  birthDate: string | null | undefined,
  businessDate: string | null | undefined,
) {
  const age = calculateClientAge(birthDate, businessDate)

  return age === null ? fe6ClientProfileText.clientBirthDate_string_d80ff85c : formatAge(age)
}

function parseDateOnly(value: string | null | undefined): DateOnlyParts | null {
  if (!value) {
    return null
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) {
    return null
  }

  const [, yearValue, monthValue, dayValue] = match
  const year = Number(yearValue)
  const month = Number(monthValue)
  const day = Number(dayValue)

  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > getDaysInMonth(year, month)
  ) {
    return null
  }

  return { year, month, day }
}

function getAnniversaryInYear(birth: DateOnlyParts, year: number): DateOnlyParts {
  if (birth.month === 2 && birth.day === 29 && !isLeapYear(year)) {
    return { year, month: 3, day: 1 }
  }

  return { year, month: birth.month, day: birth.day }
}

function compareDateOnly(left: DateOnlyParts, right: DateOnlyParts) {
  if (left.year !== right.year) {
    return left.year - right.year
  }

  if (left.month !== right.month) {
    return left.month - right.month
  }

  return left.day - right.day
}

function getDaysInMonth(year: number, month: number) {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

function isLeapYear(year: number) {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0)
}

function formatYear(year: number) {
  return String(year).padStart(4, '0')
}

function formatAge(age: number) {
  const lastTwoDigits = age % 100
  const lastDigit = age % 10

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return fe6ClientProfileText.clientBirthDate_template_2df85a9d(age)
  }

  if (lastDigit === 1) {
    return fe6ClientProfileText.clientBirthDate_template_a612da0b(age)
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return fe6ClientProfileText.clientBirthDate_template_9a991fb5(age)
  }

  return fe6ClientProfileText.clientBirthDate_template_2df85a9d(age)
}
