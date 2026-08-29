import {
  DEFAULT_AUTH_BACKGROUND_PROFILE_ID,
  authBackgroundProfiles,
} from './backgrounds'
import { DEFAULT_THEME_PROFILE_ID, themeProfiles } from './profiles'
import { createThemeProfileRegistry } from './validateProfile'
import type {
  AuthBackgroundProfile,
  ThemeProfile,
  ThemeResolutionResult,
  ThemeResolutionWarning,
  ThemeResolutionWarningSink,
} from './types'

type ResolveOptions<TProfile> = {
  profiles?: readonly TProfile[]
  warningSink?: ThemeResolutionWarningSink
}

const reportedConsoleWarnings = new Set<string>()
const reportedSinkWarnings = new WeakMap<
  ThemeResolutionWarningSink,
  Set<string>
>()

export function resolveThemeProfile(
  themeId: string | null | undefined,
  options: ResolveOptions<unknown> = {},
): ThemeResolutionResult<ThemeProfile> {
  const profiles = options.profiles
    ? createThemeProfileRegistry(options.profiles)
    : themeProfiles
  const fallback = getRequiredProfile(profiles, DEFAULT_THEME_PROFILE_ID)
  const normalizedId = normalizeProfileId(themeId)

  if (!normalizedId) {
    return {
      profile: fallback,
      warning: null,
    }
  }

  const profile = profiles.find((candidate) => candidate.id === normalizedId)
  if (profile) {
    return {
      profile,
      warning: null,
    }
  }

  const warning = {
    kind: 'unknown-theme-profile',
    source: 'theme',
    value: normalizedId,
    resolvedId: fallback.id,
  } satisfies ThemeResolutionWarning

  reportThemeResolutionWarning(warning, options.warningSink)

  return {
    profile: fallback,
    warning,
  }
}

export function resolveAuthBackgroundProfile(
  backgroundId: string | null | undefined,
  options: ResolveOptions<AuthBackgroundProfile> = {},
): ThemeResolutionResult<AuthBackgroundProfile> {
  const profiles = options.profiles ?? authBackgroundProfiles
  const fallback = getRequiredProfile(profiles, DEFAULT_AUTH_BACKGROUND_PROFILE_ID)
  const normalizedId = normalizeProfileId(backgroundId)

  if (!normalizedId) {
    return {
      profile: fallback,
      warning: null,
    }
  }

  const profile = profiles.find((candidate) => candidate.id === normalizedId)
  if (profile) {
    return {
      profile,
      warning: null,
    }
  }

  const warning = {
    kind: 'unknown-auth-background-profile',
    source: 'auth-background',
    value: normalizedId,
    resolvedId: fallback.id,
  } satisfies ThemeResolutionWarning

  reportThemeResolutionWarning(warning, options.warningSink)

  return {
    profile: fallback,
    warning,
  }
}

export function reportThemeResolutionWarning(
  warning: ThemeResolutionWarning,
  warningSink?: ThemeResolutionWarningSink,
) {
  const key = `${warning.source}:${warning.kind}:${warning.value}:${warning.resolvedId}`

  if (warningSink) {
    const sinkWarnings = reportedSinkWarnings.get(warningSink) ?? new Set<string>()

    if (sinkWarnings.has(key)) {
      return
    }

    sinkWarnings.add(key)
    reportedSinkWarnings.set(warningSink, sinkWarnings)
    warningSink(warning)
    return
  }

  if (reportedConsoleWarnings.has(key)) {
    return
  }

  reportedConsoleWarnings.add(key)

  console.warn(
    `[theme] ${warning.kind}: ${warning.source} "${warning.value}" resolved to "${warning.resolvedId}".`,
  )
}

function normalizeProfileId(profileId: string | null | undefined) {
  const normalizedId = profileId?.trim()

  return normalizedId ? normalizedId : null
}

function getRequiredProfile<TProfile extends { id: string }>(
  profiles: readonly TProfile[],
  id: string,
) {
  const profile = profiles.find((candidate) => candidate.id === id)

  if (!profile) {
    throw new Error(`Missing required theme registry profile "${id}".`)
  }

  return profile
}
