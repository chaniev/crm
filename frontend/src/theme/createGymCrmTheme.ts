import { createTheme } from '@mantine/core'
import { semanticBaseColors } from './semanticVariables'
import { crmFontFamilies, typographyRoles } from './typography'
import type { ThemeProfile } from './types'

export function createGymCrmTheme(profile: ThemeProfile) {
  const secondary = profile.brand.secondary ?? profile.brand.primary
  const neutral = profile.roles.neutral

  return createTheme({
    primaryColor: 'brand',
    primaryShade: 6,
    autoContrast: true,
    luminanceThreshold: 0.2,
    fontFamily: crmFontFamilies.body,
    fontSizes: {
      xs: typographyRoles.caption.fontSize,
      sm: typographyRoles.bodyCompact.fontSize,
      md: typographyRoles.body.fontSize,
      lg: '1.125rem',
      xl: typographyRoles.heading3.fontSize,
    },
    headings: {
      fontFamily: crmFontFamilies.heading,
      fontWeight: typographyRoles.heading1.fontWeight,
      sizes: {
        h1: {
          fontSize: typographyRoles.heading1.fontSize,
          lineHeight: typographyRoles.heading1.lineHeight,
        },
        h2: {
          fontSize: typographyRoles.heading2.fontSize,
          lineHeight: typographyRoles.heading2.lineHeight,
        },
        h3: {
          fontSize: typographyRoles.heading3.fontSize,
          lineHeight: typographyRoles.heading3.lineHeight,
        },
      },
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
