import { createTheme } from '@mantine/core'
import { semanticBaseColors } from './semanticVariables'
import type { ThemeProfile } from './types'

export function createGymCrmTheme(profile: ThemeProfile) {
  const secondary = profile.brand.secondary ?? profile.brand.primary
  const neutral = profile.roles.neutral

  return createTheme({
    primaryColor: 'brand',
    primaryShade: 6,
    autoContrast: true,
    luminanceThreshold: 0.2,
    fontFamily: 'Onest, ui-sans-serif, system-ui, sans-serif',
    headings: {
      fontFamily: 'Onest, ui-sans-serif, system-ui, sans-serif',
    },
    defaultRadius: 'md',
    colors: {
      brand: profile.brand.primary,
      accent: secondary,
      sand: neutral,
    },
    black: semanticBaseColors.textStrong,
    white: semanticBaseColors.surface,
    other: {
      background: semanticBaseColors.background,
      surface: semanticBaseColors.surface,
      text: semanticBaseColors.text,
      muted: semanticBaseColors.muted,
      border: semanticBaseColors.border,
      success: semanticBaseColors.success,
      warning: semanticBaseColors.warning,
      danger: semanticBaseColors.danger,
    },
  })
}
