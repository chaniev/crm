import type { MantineColorsTuple } from '@mantine/core'

export type ThemeProfile = {
  schemaVersion: 2
  id: string
  brand: {
    primary: MantineColorsTuple
    secondary?: MantineColorsTuple
  }
  roles: {
    neutral: MantineColorsTuple
    accentThree: MantineColorsTuple
    accentFour: MantineColorsTuple
  }
}

export type LegacyThemeProfileV1 = {
  schemaVersion: 1
  id: string
  main: {
    primary: MantineColorsTuple
    secondary?: MantineColorsTuple
  }
  supplementary: readonly [
    MantineColorsTuple,
    MantineColorsTuple,
    MantineColorsTuple,
  ]
}

export type ThemeProfileInput = ThemeProfile | LegacyThemeProfileV1

export type AuthBackgroundProfile = {
  schemaVersion: 1
  id: string
  asset: string
  focalPoint: {
    xPercent: number
    yPercent: number
  }
}

export type AuthStageBackground = {
  asset: string | null
  focalPoint: AuthBackgroundProfile['focalPoint']
  profileId: string | null
}

export type ThemeResolutionWarning = {
  kind:
    | 'unknown-theme-profile'
    | 'unknown-auth-background-profile'
    | 'config-transport-fallback'
  source: 'theme' | 'auth-background' | 'config'
  value: string
  resolvedId: string
}

export type ThemeResolutionResult<TProfile> = {
  profile: TProfile
  warning: ThemeResolutionWarning | null
}

export type ThemeResolutionWarningSink = (
  warning: ThemeResolutionWarning,
) => void
