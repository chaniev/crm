import { createTheme } from '@mantine/core'
import { semanticBaseColors } from './semanticVariables'
import type { ThemeProfile } from './types'

export function createGymCrmTheme(profile: ThemeProfile) {
  const secondary = profile.main.secondary ?? profile.main.primary
  const neutral = profile.supplementary[0]

  return createTheme({
    primaryColor: 'brand',
    primaryShade: 6,
    fontFamily: 'Onest, ui-sans-serif, system-ui, sans-serif',
    headings: {
      fontFamily: 'Onest, ui-sans-serif, system-ui, sans-serif',
    },
    defaultRadius: 'md',
    colors: {
      brand: profile.main.primary,
      accent: secondary,
      sand: neutral,
    },
    black: semanticBaseColors.text,
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
