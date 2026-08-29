import type { MantineColorsTuple } from '@mantine/core'
import type { ThemeProfile } from './types'

type UnknownRecord = Record<string, unknown>

const HEX_COLOR = /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i

export class ThemeProfileValidationError extends Error {
  readonly profileId: string
  readonly field: string
  readonly reason: string

  constructor(
    profileId: string,
    field: string,
    reason: string,
  ) {
    super(`Theme profile "${profileId}" field "${field}": ${reason}`)
    this.name = 'ThemeProfileValidationError'
    this.profileId = profileId
    this.field = field
    this.reason = reason
  }
}

function asRecord(value: unknown, profileId: string, field: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ThemeProfileValidationError(profileId, field, 'expected an object.')
  }

  return value as UnknownRecord
}

function assertExactKeys(
  value: UnknownRecord,
  allowedKeys: readonly string[],
  profileId: string,
  field: string,
) {
  const allowed = new Set(allowedKeys)
  const unexpected = Object.keys(value).find((key) => !allowed.has(key))

  if (unexpected) {
    const path = field ? `${field}.${unexpected}` : unexpected
    throw new ThemeProfileValidationError(
      profileId,
      path,
      'field is not allowed by compatibility schema v2.',
    )
  }
}

function validatePalette(
  value: unknown,
  profileId: string,
  field: string,
): MantineColorsTuple {
  if (!Array.isArray(value)) {
    throw new ThemeProfileValidationError(
      profileId,
      field,
      'expected a palette of exactly 10 colors.',
    )
  }

  if (value.length !== 10) {
    throw new ThemeProfileValidationError(
      profileId,
      field,
      `expected a palette of exactly 10 colors, received ${value.length}.`,
    )
  }

  for (let index = 0; index < value.length; index += 1) {
    const color = value[index]

    if (typeof color !== 'string' || !HEX_COLOR.test(color)) {
      throw new ThemeProfileValidationError(
        profileId,
        `${field}[${index}]`,
        `expected #RGB, #RGBA, #RRGGBB or #RRGGBBAA, received ${JSON.stringify(color)}.`,
      )
    }
  }

  return value as unknown as MantineColorsTuple
}

function readProfileId(value: UnknownRecord) {
  const id = value.id

  if (typeof id !== 'string' || !id.trim()) {
    throw new ThemeProfileValidationError(
      '<unknown>',
      'id',
      'expected a non-empty string.',
    )
  }

  if (id !== id.trim()) {
    throw new ThemeProfileValidationError(
      id,
      'id',
      'must not contain leading or trailing whitespace.',
    )
  }

  return id
}

function normalizeV2(value: UnknownRecord, profileId: string): ThemeProfile {
  assertExactKeys(value, ['schemaVersion', 'id', 'brand', 'roles'], profileId, '')

  const brand = asRecord(value.brand, profileId, 'brand')
  assertExactKeys(brand, ['primary', 'secondary'], profileId, 'brand')
  const roles = asRecord(value.roles, profileId, 'roles')
  assertExactKeys(
    roles,
    ['neutral', 'accentThree', 'accentFour'],
    profileId,
    'roles',
  )

  const secondary = brand.secondary === undefined
    ? undefined
    : validatePalette(brand.secondary, profileId, 'brand.secondary')

  return {
    schemaVersion: 2,
    id: profileId,
    brand: {
      primary: validatePalette(brand.primary, profileId, 'brand.primary'),
      ...(secondary ? { secondary } : {}),
    },
    roles: {
      neutral: validatePalette(roles.neutral, profileId, 'roles.neutral'),
      accentThree: validatePalette(roles.accentThree, profileId, 'roles.accentThree'),
      accentFour: validatePalette(roles.accentFour, profileId, 'roles.accentFour'),
    },
  }
}

function normalizeV1(value: UnknownRecord, profileId: string): ThemeProfile {
  assertExactKeys(value, ['schemaVersion', 'id', 'main', 'supplementary'], profileId, '')
  const main = asRecord(value.main, profileId, 'main')
  assertExactKeys(main, ['primary', 'secondary'], profileId, 'main')

  if (!Array.isArray(value.supplementary)) {
    throw new ThemeProfileValidationError(
      profileId,
      'supplementary',
      'expected exactly three consumed palettes.',
    )
  }

  if (value.supplementary.length > 3) {
    throw new ThemeProfileValidationError(
      profileId,
      'supplementary[3]',
      'role was never consumed; migrate it to an explicit named role or remove it.',
    )
  }

  if (value.supplementary.length !== 3) {
    throw new ThemeProfileValidationError(
      profileId,
      'supplementary',
      `expected exactly three consumed palettes, received ${value.supplementary.length}.`,
    )
  }

  const secondary = main.secondary === undefined
    ? undefined
    : validatePalette(main.secondary, profileId, 'main.secondary')

  return {
    schemaVersion: 2,
    id: profileId,
    brand: {
      primary: validatePalette(main.primary, profileId, 'main.primary'),
      ...(secondary ? { secondary } : {}),
    },
    roles: {
      neutral: validatePalette(value.supplementary[0], profileId, 'supplementary[0]'),
      accentThree: validatePalette(value.supplementary[1], profileId, 'supplementary[1]'),
      accentFour: validatePalette(value.supplementary[2], profileId, 'supplementary[2]'),
    },
  }
}

export function normalizeThemeProfile(input: unknown): ThemeProfile {
  const value = asRecord(input, '<unknown>', 'profile')
  const profileId = readProfileId(value)

  if (value.schemaVersion === 2) {
    return normalizeV2(value, profileId)
  }

  if (value.schemaVersion === 1) {
    return normalizeV1(value, profileId)
  }

  throw new ThemeProfileValidationError(
    profileId,
    'schemaVersion',
    `expected 1 or 2, received ${String(value.schemaVersion)}.`,
  )
}

export function createThemeProfileRegistry<const TInputs extends readonly unknown[]>(
  inputs: TInputs,
): { readonly [TIndex in keyof TInputs]: ThemeProfile } {
  const profiles = inputs.map(normalizeThemeProfile)
  const firstIndexById = new Map<string, number>()

  for (let index = 0; index < profiles.length; index += 1) {
    const profile = profiles[index]
    const firstIndex = firstIndexById.get(profile.id)

    if (firstIndex !== undefined) {
      throw new ThemeProfileValidationError(
        profile.id,
        'id',
        `duplicate registry ID at index ${index} (first declared at index ${firstIndex}).`,
      )
    }

    firstIndexById.set(profile.id, index)
  }

  return profiles as { readonly [TIndex in keyof TInputs]: ThemeProfile }
}
