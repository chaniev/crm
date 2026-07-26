import { describe, expect, test, vi } from 'vitest'

type MantineColorTuple = readonly string[]

type ThemeProfile = {
  schemaVersion: 1
  id: string
  main: {
    primary: MantineColorTuple
    secondary?: MantineColorTuple
  }
  supplementary: readonly [
    MantineColorTuple,
    MantineColorTuple,
    MantineColorTuple,
    MantineColorTuple?,
  ]
}

type AuthBackgroundProfile = {
  schemaVersion: 1
  id: string
  asset: string
  focalPoint: {
    xPercent: number
    yPercent: number
  }
}

type ThemeResolutionWarning = {
  kind: string
  source: 'theme' | 'auth-background'
  value: string
  resolvedId: string
}

type ThemeResolutionResult<TProfile> = {
  profile: TProfile
  warning: ThemeResolutionWarning | null
}

type ThemeModuleShape = {
  gymCrmTheme: Record<string, unknown>
  themeProfiles?: ThemeProfile[]
  authBackgroundProfiles?: AuthBackgroundProfile[]
  resolveThemeProfile?: (
    themeId: string | null | undefined,
    options?: {
      profiles?: readonly ThemeProfile[]
      warningSink?: (warning: ThemeResolutionWarning) => void
    },
  ) => ThemeResolutionResult<ThemeProfile>
  resolveAuthBackgroundProfile?: (
    backgroundId: string | null | undefined,
    options?: {
      profiles?: readonly AuthBackgroundProfile[]
      warningSink?: (warning: ThemeResolutionWarning) => void
    },
  ) => ThemeResolutionResult<AuthBackgroundProfile>
  createGymCrmTheme?: (profile: ThemeProfile) => Record<string, unknown>
  createSemanticVariables?: (profile: ThemeProfile) => Record<string, string>
}

const themeModule = async () => (await import('../theme')) as unknown as ThemeModuleShape

type ParsedColor = { r: number; g: number; b: number; a: number }

function parseColor(input: string): ParsedColor {
  if (!input.startsWith('#')) {
    throw new Error(`Unsupported token format: ${input}`)
  }

  const hex = input.slice(1)

  if (hex.length !== 4 && hex.length !== 5 && hex.length !== 6 && hex.length !== 7 && hex.length !== 8) {
    throw new Error(`Unsupported hex format: ${input}`)
  }

  const expanded =
    hex.length === 4 || hex.length === 5
      ? hex
          .split('')
          .map((part) => `${part}${part}`)
          .join('')
      : hex

  const r = Number.parseInt(
    expanded.slice(0, 2),
    16,
  )
  const g = Number.parseInt(
    expanded.slice(2, 4),
    16,
  )
  const b = Number.parseInt(
    expanded.slice(4, 6),
    16,
  )
  const a =
    expanded.length === 8
      ? Number.parseInt(expanded.slice(6, 8), 16) / 255
      : 1

  return { r, g, b, a }
}

function flattenColor(color: ParsedColor, backdrop: ParsedColor): ParsedColor {
  const opacity = color.a

  return {
    r: Math.round(color.r * opacity + backdrop.r * (1 - opacity)),
    g: Math.round(color.g * opacity + backdrop.g * (1 - opacity)),
    b: Math.round(color.b * opacity + backdrop.b * (1 - opacity)),
    a: 1,
  }
}

function toLuminance(channel: number) {
  const normalized = channel / 255

  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

function contrastRatio(foreground: ParsedColor, background: ParsedColor) {
  const flatForeground =
    foreground.a === 1 ? foreground : flattenColor(foreground, background)

  const l1 =
    0.2126 * toLuminance(flatForeground.r) +
    0.7152 * toLuminance(flatForeground.g) +
    0.0722 * toLuminance(flatForeground.b)
  const l2 =
    0.2126 * toLuminance(background.r) +
    0.7152 * toLuminance(background.g) +
    0.0722 * toLuminance(background.b)
  const brighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  return (brighter + 0.05) / (darker + 0.05)
}

function getProfileById<T extends { id: string }>(
  profiles: T[],
  id: string,
) {
  const profile = profiles.find((candidate) => candidate.id === id)

  if (!profile) {
    throw new Error(`Profile "${id}" not found`) 
  }

  return profile
}

describe('theme profile and background registry contracts', () => {
  test('keeps required theme and auth-profile registries', async () => {
    const moduleShape = await themeModule()

    const themeProfiles = moduleShape.themeProfiles ?? []
    expect(Array.isArray(themeProfiles)).toBe(true)

    const themeIds = new Set(themeProfiles.map((profile) => profile.id))
    expect(themeIds.has('default-green-v1')).toBe(true)
    expect(themeIds.has('test-blue-coral-v1')).toBe(true)

    const authBackgroundProfiles = moduleShape.authBackgroundProfiles ?? []
    expect(Array.isArray(authBackgroundProfiles)).toBe(true)

    const authIds = new Set(authBackgroundProfiles.map((profile) => profile.id))
    expect(authIds.has('k4pro-login-v1')).toBe(true)

    const k4proProfile = authBackgroundProfiles.find((profile) => profile.id === 'k4pro-login-v1')
    expect(k4proProfile).toBeTruthy()
    expect(k4proProfile!.focalPoint.xPercent).toBe(64)
    expect(k4proProfile!.focalPoint.yPercent).toBe(50)
    expect(k4proProfile!.asset).toContain('k4pro-login-bg.png')
  })

  test('enforces theme profile schema invariants', async () => {
    const moduleShape = await themeModule()
    const themeProfiles = moduleShape.themeProfiles ?? []

    expect(themeProfiles.length).toBeGreaterThanOrEqual(2)

    for (const profile of themeProfiles) {
      expect(profile.schemaVersion).toBe(1)
      expect(profile.main.primary).toHaveLength(10)

      if (profile.main.secondary) {
        expect(profile.main.secondary).toHaveLength(10)
      }

      expect(profile.supplementary.length).toBeGreaterThanOrEqual(3)
      expect(profile.supplementary.length).toBeLessThanOrEqual(4)

      for (const supplementaryTuple of profile.supplementary) {
        expect(supplementaryTuple).toHaveLength(10)
      }
    }
  })

  test('enforces background profile schema invariants', async () => {
    const moduleShape = await themeModule()
    const authBackgroundProfiles = moduleShape.authBackgroundProfiles ?? []

    for (const profile of authBackgroundProfiles) {
      expect(profile.schemaVersion).toBe(1)
      expect(profile.id).toBeTruthy()
      expect(typeof profile.asset).toBe('string')
      expect(profile.asset.length).toBeGreaterThan(0)
      expect(profile.focalPoint.xPercent).toBeGreaterThanOrEqual(0)
      expect(profile.focalPoint.xPercent).toBeLessThanOrEqual(100)
      expect(profile.focalPoint.yPercent).toBeGreaterThanOrEqual(0)
      expect(profile.focalPoint.yPercent).toBeLessThanOrEqual(100)
    }
  })

  test('resolves theme profile with typed warning + sink dedup for unknown id', async () => {
    const moduleShape = await themeModule()
    const resolveThemeProfile = moduleShape.resolveThemeProfile
    expect(typeof resolveThemeProfile).toBe('function')

    const sink = vi.fn()
    const resolvedDefault = resolveThemeProfile!('default-green-v1', { warningSink: sink })
    expect(resolvedDefault.profile).toMatchObject({
      id: 'default-green-v1',
      schemaVersion: 1,
    })
    expect(resolvedDefault.warning).toBeNull()

    const resolvedUnknown = resolveThemeProfile!('unknown-theme-v1', { warningSink: sink })
    expect(resolvedUnknown.profile).toMatchObject({
      id: 'default-green-v1',
      schemaVersion: 1,
    })
    expect(resolvedUnknown.warning).toMatchObject({
      kind: expect.any(String),
      source: 'theme',
      value: 'unknown-theme-v1',
      resolvedId: 'default-green-v1',
    })

    const resolvedUnknownSecond = resolveThemeProfile!('unknown-theme-v1', { warningSink: sink })
    expect(resolvedUnknownSecond.profile).toMatchObject({
      id: 'default-green-v1',
      schemaVersion: 1,
    })
    expect(resolvedUnknownSecond.warning).toMatchObject({
      resolvedId: 'default-green-v1',
    })

    expect(sink).toHaveBeenCalledTimes(1)
    expect(sink).toHaveBeenNthCalledWith(1, expect.objectContaining({
      kind: expect.any(String),
      source: 'theme',
      value: 'unknown-theme-v1',
      resolvedId: 'default-green-v1',
    }))
  })

  test('resolves auth background profile with typed warning + sink dedup for unknown id', async () => {
    const moduleShape = await themeModule()
    const resolveAuthBackgroundProfile = moduleShape.resolveAuthBackgroundProfile
    expect(typeof resolveAuthBackgroundProfile).toBe('function')

    const sink = vi.fn()
    const resolvedDefault = resolveAuthBackgroundProfile!('k4pro-login-v1', { warningSink: sink })
    expect(resolvedDefault.profile).toMatchObject({
      id: 'k4pro-login-v1',
      schemaVersion: 1,
    })
    expect(resolvedDefault.warning).toBeNull()

    const resolvedUnknown = resolveAuthBackgroundProfile!('ghost-login-v1', { warningSink: sink })
    expect(resolvedUnknown.profile).toMatchObject({
      id: 'k4pro-login-v1',
      schemaVersion: 1,
    })
    expect(resolvedUnknown.warning).toMatchObject({
      kind: expect.any(String),
      source: 'auth-background',
      value: 'ghost-login-v1',
      resolvedId: 'k4pro-login-v1',
    })

    const resolvedUnknownSecond = resolveAuthBackgroundProfile!('ghost-login-v1', { warningSink: sink })
    expect(resolvedUnknownSecond.warning).toMatchObject({
      resolvedId: 'k4pro-login-v1',
    })

    expect(sink).toHaveBeenCalledTimes(1)
  })

  test('returns defaults for blank theme/background ids with no warnings', async () => {
    const moduleShape = await themeModule()

    const resolveThemeProfile = moduleShape.resolveThemeProfile!
    const resolveAuthBackgroundProfile = moduleShape.resolveAuthBackgroundProfile!

    const sink = vi.fn()

    expect(resolveThemeProfile('', { warningSink: sink }).warning).toBeNull()
    expect(resolveThemeProfile(null, { warningSink: sink }).warning).toBeNull()
    expect(resolveThemeProfile(undefined, { warningSink: sink }).warning).toBeNull()
    expect(resolveAuthBackgroundProfile('', { warningSink: sink }).warning).toBeNull()
    expect(resolveAuthBackgroundProfile(' ', { warningSink: sink }).warning).toBeNull()
    expect(resolveAuthBackgroundProfile(undefined, { warningSink: sink }).warning).toBeNull()

    expect(sink).not.toHaveBeenCalled()
  })

  test('supports injecting future theme/background profiles at resolution point', async () => {
    const moduleShape = await themeModule()
    const themeProfiles = moduleShape.themeProfiles ?? []
    const authBackgroundProfiles = moduleShape.authBackgroundProfiles ?? []

    const futureTheme = {
      ...getProfileById(themeProfiles, 'default-green-v1'),
      id: 'future-slate-v2',
    }

    const futureAuthBackground = {
      ...authBackgroundProfiles[0],
      id: 'future-login-bg-v2',
      asset: '/assets/test-auth-background.png',
      focalPoint: { xPercent: 12, yPercent: 88 },
    }

    const themeResolution = moduleShape.resolveThemeProfile!('future-slate-v2', {
      profiles: [...themeProfiles, futureTheme],
    })

    expect(themeResolution.warning).toBeNull()
    expect(themeResolution.profile.id).toBe('future-slate-v2')

    const authResolution = moduleShape.resolveAuthBackgroundProfile!(
      'future-login-bg-v2',
      {
        profiles: [...authBackgroundProfiles, futureAuthBackground],
      },
    )

    expect(authResolution.warning).toBeNull()
    expect(authResolution.profile.id).toBe('future-login-bg-v2')
  })

  test('builds theme through createGymCrmTheme without losing geometry and semantic variables', async () => {
    const moduleShape = await themeModule()
    expect(typeof moduleShape.createGymCrmTheme).toBe('function')

    const profiles = moduleShape.themeProfiles ?? []
    const defaultProfile = profiles.find((profile) => profile.id === 'default-green-v1')

    expect(defaultProfile).toBeTruthy()

    const defaultTheme = moduleShape.createGymCrmTheme!(defaultProfile!)
    expect(defaultTheme).toMatchObject({
      fontFamily: expect.stringContaining('Onest'),
      headings: { fontFamily: expect.stringContaining('Onest') },
      defaultRadius: 'md',
    })

    const blueProfile = profiles.find((profile) => profile.id === 'test-blue-coral-v1')
    expect(blueProfile).toBeTruthy()
    const blueTheme = moduleShape.createGymCrmTheme!(blueProfile!)

    expect(blueTheme).toMatchObject({
      defaultRadius: 'md',
      fontFamily: expect.stringContaining('Onest'),
      headings: { fontFamily: expect.stringContaining('Onest') },
    })
    expect(blueTheme).not.toEqual(defaultTheme)

    const brandPalette = blueProfile!.main.primary
    const defaultBrandPalette = defaultProfile!.main.primary
    expect(brandPalette).toHaveLength(10)
    expect(defaultBrandPalette).toHaveLength(10)
  })

  test('preserves semantic variable key set across profiles', async () => {
    const moduleShape = await themeModule()
    const profiles = moduleShape.themeProfiles ?? []
    const createSemanticVariables = moduleShape.createSemanticVariables

    expect(typeof createSemanticVariables).toBe('function')

    const defaultProfile = getProfileById(profiles, 'default-green-v1')
    const testProfile = getProfileById(profiles, 'test-blue-coral-v1')
    const defaultVariables = Object.keys(createSemanticVariables!(defaultProfile)).sort()
    const testVariables = Object.keys(createSemanticVariables!(testProfile)).sort()

    expect(defaultVariables).toEqual(testVariables)
    expect(defaultVariables).toContain('--crm-action-primary')
    expect(defaultVariables).toContain('--crm-action-primary-hover')
    expect(defaultVariables).toContain('--crm-action-primary-active')
    expect(defaultVariables).toContain('--crm-surface-card')
    expect(defaultVariables).toContain('--crm-focus-ring')
  })

  test('keeps normal contrast >=4.5 and focus contrast >=3 on page/card states', async () => {
    const moduleShape = await themeModule()
    const profiles = moduleShape.themeProfiles ?? []
    const createSemanticVariables = moduleShape.createSemanticVariables
    expect(typeof createSemanticVariables).toBe('function')

    const white = parseColor('#ffffff')

    for (const profile of [
      getProfileById(profiles, 'default-green-v1'),
      getProfileById(profiles, 'test-blue-coral-v1'),
    ]) {
      const vars = createSemanticVariables!(profile)
      const text = parseColor(vars['--crm-text-primary'])
      const secondaryText = parseColor(vars['--crm-text-secondary'])
      const page = parseColor(vars['--crm-surface-page'])
      const card = parseColor(vars['--crm-surface-card'])
      const focus = parseColor(vars['--crm-focus-ring'])

      expect(contrastRatio(text, page)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(text, card)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(secondaryText, page)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(secondaryText, card)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio(focus, white)).toBeGreaterThanOrEqual(3)
      expect(contrastRatio(focus, card)).toBeGreaterThanOrEqual(3)
    }
  })
})
