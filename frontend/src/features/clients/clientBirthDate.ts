type DateOnlyParts = {
  year: number
  month: number
  day: number
}

const russianMonthNames = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const

export function formatClientBirthDate(value: string | null | undefined) {
  const parts = parseDateOnly(value)

  if (!parts) {
    return null
  }

  return `${parts.day} ${russianMonthNames[parts.month - 1]} ${formatYear(parts.year)} г.`
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

  return age === null ? 'Не вычисляется' : formatAge(age)
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
    return `${age} лет`
  }

  if (lastDigit === 1) {
    return `${age} год`
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${age} года`
  }

  return `${age} лет`
}
