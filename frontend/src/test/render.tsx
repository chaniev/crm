import { MantineProvider } from '@mantine/core'
import { render, type RenderOptions } from '@testing-library/react'
import type { CSSProperties, ReactElement } from 'react'
import {
  createGymCrmTheme,
  resolveAuthBackgroundProfile,
  resolveThemeProfile,
  type AuthBackgroundProfile,
  type ThemeProfile,
} from '../theme'
import {
  DEFAULT_AUTH_BACKGROUND_PROFILE_ID,
  toAuthStageBackground,
} from '../theme/backgrounds'

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & {
    authBackgroundId?: string
    authBackgroundProfile?: AuthBackgroundProfile
    themeId?: string
    themeProfile?: ThemeProfile
  },
) {
  const {
    authBackgroundId,
    authBackgroundProfile,
    themeId,
    themeProfile,
    ...renderOptions
  } = options ?? {}
  const resolvedThemeProfile =
    themeProfile ?? resolveThemeProfile(themeId).profile
  const theme = createGymCrmTheme(resolvedThemeProfile)
  const resolvedAuthBackground =
    authBackgroundProfile ??
    resolveAuthBackgroundProfile(
      authBackgroundId ?? DEFAULT_AUTH_BACKGROUND_PROFILE_ID,
    ).profile
  const authBackground = toAuthStageBackground(resolvedAuthBackground)
  const authBackgroundStyle = {
    '--crm-auth-background-image': authBackground.asset
      ? `url("${authBackground.asset}")`
      : 'none',
    '--crm-auth-background-position': `${authBackground.focalPoint.xPercent}% ${authBackground.focalPoint.yPercent}%`,
  } as CSSProperties

  return render(ui, {
    wrapper: ({ children }) => (
      <MantineProvider defaultColorScheme="light" theme={theme}>
        <div style={authBackgroundStyle}>{children}</div>
      </MantineProvider>
    ),
    ...renderOptions,
  })
}
