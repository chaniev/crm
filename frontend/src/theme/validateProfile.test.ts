import { describe, expect, test } from 'vitest'
import {
  createThemeProfileRegistry,
  normalizeThemeProfile,
} from './validateProfile'
import { createGymCrmTheme } from './createGymCrmTheme'
import { defaultGreenProfile } from './profiles'
import { resolveThemeProfile } from './resolveProfiles'
import { createSemanticVariables } from './semanticVariables'

const palette = [
  '#f8f9fa',
  '#f1f3f5',
  '#e9ecef',
  '#dee2e6',
  '#ced4da',
  '#adb5bd',
  '#868e96',
  '#495057',
  '#343a40',
  '#212529',
] as const

const namedProfile = {
  schemaVersion: 2,
  id: 'fixture-v2',
  brand: {
    primary: palette,
    secondary: palette,
  },
  roles: {
    neutral: palette,
    accentThree: palette,
    accentFour: palette,
  },
} as const

describe('ThemeProfile compatibility schema', () => {
  test('accepts the complete named schema without changing its values', () => {
    expect(normalizeThemeProfile(namedProfile)).toEqual(namedProfile)
  })

  test('adapts the consumed three-role v1 schema to named v2 roles', () => {
    expect(normalizeThemeProfile({
      schemaVersion: 1,
      id: 'legacy-v1',
      main: { primary: palette, secondary: palette },
      supplementary: [palette, palette, palette],
    })).toEqual({
      schemaVersion: 2,
      id: 'legacy-v1',
      brand: { primary: palette, secondary: palette },
      roles: {
        neutral: palette,
        accentThree: palette,
        accentFour: palette,
      },
    })
  })

  test('rejects the formerly ignored fourth supplementary tuple', () => {
    expect(() => normalizeThemeProfile({
      schemaVersion: 1,
      id: 'ignored-role-v1',
      main: { primary: palette },
      supplementary: [palette, palette, palette, palette],
    })).toThrowError(
      'Theme profile "ignored-role-v1" field "supplementary[3]": role was never consumed; migrate it to an explicit named role or remove it.',
    )
  })

  test.each([
    {
      name: 'unsupported schema',
      mutate: () => ({ ...namedProfile, schemaVersion: 99 }),
      diagnostic: 'Theme profile "fixture-v2" field "schemaVersion": expected 1 or 2, received 99.',
    },
    {
      name: 'blank id',
      mutate: () => ({ ...namedProfile, id: '  ' }),
      diagnostic: 'Theme profile "<unknown>" field "id": expected a non-empty string.',
    },
    {
      name: 'missing role',
      mutate: () => ({
        ...namedProfile,
        roles: { neutral: palette, accentThree: palette },
      }),
      diagnostic: 'Theme profile "fixture-v2" field "roles.accentFour": expected a palette of exactly 10 colors.',
    },
    {
      name: 'extra role',
      mutate: () => ({
        ...namedProfile,
        roles: { ...namedProfile.roles, decorative: palette },
      }),
      diagnostic: 'Theme profile "fixture-v2" field "roles.decorative": field is not allowed by compatibility schema v2.',
    },
    {
      name: 'short tuple',
      mutate: () => ({
        ...namedProfile,
        brand: { ...namedProfile.brand, primary: palette.slice(0, 9) },
      }),
      diagnostic: 'Theme profile "fixture-v2" field "brand.primary": expected a palette of exactly 10 colors, received 9.',
    },
    {
      name: 'malformed color',
      mutate: () => ({
        ...namedProfile,
        roles: {
          ...namedProfile.roles,
          neutral: [...palette.slice(0, 9), 'not-a-color'],
        },
      }),
      diagnostic: 'Theme profile "fixture-v2" field "roles.neutral[9]": expected #RGB, #RGBA, #RRGGBB or #RRGGBBAA, received "not-a-color".',
    },
  ])('reports profile, field and exact reason for $name', ({ mutate, diagnostic }) => {
    expect(() => normalizeThemeProfile(mutate())).toThrowError(diagnostic)
  })

  test('rejects duplicate IDs at registry construction', () => {
    expect(() => createThemeProfileRegistry([
      namedProfile,
      { ...namedProfile },
    ])).toThrowError(
      'Theme profile "fixture-v2" field "id": duplicate registry ID at index 1 (first declared at index 0).',
    )
  })

  test('validates injected registries before profile resolution', () => {
    expect(() => resolveThemeProfile('fixture-v2', {
      profiles: [{
        ...namedProfile,
        roles: {
          ...namedProfile.roles,
          accentFour: [...palette.slice(0, 9), 'broken'],
        },
      }],
    })).toThrowError(
      'Theme profile "fixture-v2" field "roles.accentFour[9]": expected #RGB, #RGBA, #RRGGBB or #RRGGBBAA, received "broken".',
    )
  })

  test('preserves generated theme and semantic output through the v1 adapter', () => {
    const legacyDefault = {
      schemaVersion: 1,
      id: defaultGreenProfile.id,
      main: {
        primary: defaultGreenProfile.brand.primary,
        secondary: defaultGreenProfile.brand.secondary,
      },
      supplementary: [
        defaultGreenProfile.roles.neutral,
        defaultGreenProfile.roles.accentThree,
        defaultGreenProfile.roles.accentFour,
      ],
    }
    const migrated = normalizeThemeProfile(legacyDefault)

    expect(createGymCrmTheme(migrated)).toEqual(createGymCrmTheme(defaultGreenProfile))
    expect(createSemanticVariables(migrated)).toEqual(
      createSemanticVariables(defaultGreenProfile),
    )
  })

  test.each([
    ['brand.primary', (profile: typeof namedProfile) => ({
      ...profile,
      brand: { ...profile.brand, primary: [...palette.slice(0, 9), '#111111'] },
    })],
    ['brand.secondary', (profile: typeof namedProfile) => ({
      ...profile,
      brand: { ...profile.brand, secondary: [...palette.slice(0, 9), '#111111'] },
    })],
    ['roles.neutral', (profile: typeof namedProfile) => ({
      ...profile,
      roles: { ...profile.roles, neutral: ['#111111', ...palette.slice(1)] },
    })],
    ['roles.accentThree', (profile: typeof namedProfile) => ({
      ...profile,
      roles: { ...profile.roles, accentThree: [...palette.slice(0, 8), '#111111', palette[9]] },
    })],
    ['roles.accentFour', (profile: typeof namedProfile) => ({
      ...profile,
      roles: { ...profile.roles, accentFour: [...palette.slice(0, 8), '#111111', palette[9]] },
    })],
  ] as const)('consumes the named %s palette in generated output', (_, mutate) => {
    const baseline = normalizeThemeProfile(namedProfile)
    const changed = normalizeThemeProfile(mutate(namedProfile))
    const baselineOutput = {
      semantic: createSemanticVariables(baseline),
      theme: createGymCrmTheme(baseline),
    }
    const changedOutput = {
      semantic: createSemanticVariables(changed),
      theme: createGymCrmTheme(changed),
    }

    expect(changedOutput).not.toEqual(baselineOutput)
  })
})
