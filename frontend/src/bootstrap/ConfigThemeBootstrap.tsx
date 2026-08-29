import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react'
import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { useMediaQuery } from '@mantine/hooks'
import App from '../App'
import {
  k4proLoginBackgroundProfile,
  solidAuthStageBackground,
  toAuthStageBackground,
} from '../theme/backgrounds'
import { createGymCrmTheme } from '../theme/createGymCrmTheme'
import { DEFAULT_AUTH_BACKGROUND_PROFILE_ID } from '../theme/backgrounds'
import { resolveAuthBackgroundProfile } from '../theme/resolveProfiles'
import { createSemanticVariables } from '../theme/semanticVariables'
import type { AppConfigResponse } from '../lib/api'
import type { ConfigThemeBootstrapResource } from './configThemeResource'
import type {
  AuthBackgroundProfile,
  AuthStageBackground,
  ThemeProfile,
} from '../theme/types'

export type AuthBackgroundPreloader = (
  profile: AuthBackgroundProfile,
) => Promise<void>

type ConfigThemeBootstrapProps = {
  resource: ConfigThemeBootstrapResource
  preloadAuthBackground?: AuthBackgroundPreloader
}

const defaultBootstrapAuthBackground = toAuthStageBackground(
  k4proLoginBackgroundProfile,
)

export function ConfigThemeBootstrap({
  resource,
  preloadAuthBackground = defaultAuthBackgroundPreloader,
}: ConfigThemeBootstrapProps) {
  const snapshot = useSyncExternalStore(
    resource.subscribe,
    resource.getSnapshot,
    resource.getSnapshot,
  )

  if (snapshot.status === 'pending') {
    return <ConfigBootstrapLoading />
  }

  return (
    <ResolvedConfigThemeBootstrap
      appConfig={snapshot.appConfig}
      authBackgroundProfile={snapshot.authBackgroundProfile}
      preloadAuthBackground={preloadAuthBackground}
      themeProfile={snapshot.themeProfile}
    />
  )
}

type ResolvedConfigThemeBootstrapProps = {
  appConfig: AppConfigResponse
  authBackgroundProfile: AuthBackgroundProfile
  preloadAuthBackground: AuthBackgroundPreloader
  themeProfile: ThemeProfile
}

function ResolvedConfigThemeBootstrap({
  appConfig,
  authBackgroundProfile,
  preloadAuthBackground,
  themeProfile,
}: ResolvedConfigThemeBootstrapProps) {
  const mobileControls = useMediaQuery('(max-width: 48rem)', false)
  const theme = useMemo(
    () => createGymCrmTheme(themeProfile, { mobile: mobileControls }),
    [mobileControls, themeProfile],
  )
  const semanticVariables = useMemo(
    () => createSemanticVariables(themeProfile),
    [themeProfile],
  )
  const authBackground = useResolvedAuthBackground(
    authBackgroundProfile,
    preloadAuthBackground,
  )

  useEffect(() => {
    const rootStyle = document.documentElement.style
    const previousValues = new Map<string, string>()

    Object.entries(semanticVariables).forEach(([name, value]) => {
      previousValues.set(name, rootStyle.getPropertyValue(name))
      rootStyle.setProperty(name, value)
    })

    return () => {
      previousValues.forEach((value, name) => {
        if (value) {
          rootStyle.setProperty(name, value)
          return
        }

        rootStyle.removeProperty(name)
      })
    }
  }, [semanticVariables])

  return (
    <MantineProvider defaultColorScheme="light" theme={theme}>
      <Notifications
        className="app-notifications"
      />
      <App appConfig={appConfig} authBackground={authBackground} />
    </MantineProvider>
  )
}

function useResolvedAuthBackground(
  profile: AuthBackgroundProfile,
  preloadAuthBackground: AuthBackgroundPreloader,
) {
  const [authBackground, setAuthBackground] = useState<AuthStageBackground>(() =>
    toAuthStageBackground(profile),
  )

  useEffect(() => {
    let cancelled = false

    async function resolveBackground() {
      setAuthBackground(toAuthStageBackground(profile))

      try {
        await preloadAuthBackground(profile)
        return
      } catch {
        if (cancelled) {
          return
        }

        if (profile.id !== DEFAULT_AUTH_BACKGROUND_PROFILE_ID) {
          const fallbackResolution = resolveAuthBackgroundProfile(
            DEFAULT_AUTH_BACKGROUND_PROFILE_ID,
          )

          setAuthBackground(toAuthStageBackground(fallbackResolution.profile))

          try {
            await preloadAuthBackground(fallbackResolution.profile)
            return
          } catch {
            if (cancelled) {
              return
            }
          }
        }

        setAuthBackground(solidAuthStageBackground)
      }
    }

    void resolveBackground()

    return () => {
      cancelled = true
    }
  }, [preloadAuthBackground, profile])

  return authBackground
}

function ConfigBootstrapLoading() {
  const style = {
    '--crm-auth-background-image': `url("${defaultBootstrapAuthBackground.asset}")`,
    '--crm-auth-background-position': `${defaultBootstrapAuthBackground.focalPoint.xPercent}% ${defaultBootstrapAuthBackground.focalPoint.yPercent}%`,
  } as CSSProperties

  return (
    <div
      className="gym-crm-page gym-crm-page--auth gym-crm-page--auth-image"
      style={style}
    >
      <main className="auth-layout">
        <section className="loading-card bootstrap-loading-card" aria-busy="true">
          <h1 className="bootstrap-loading-card__title">Открываем CRM</h1>
          <p className="bootstrap-loading-card__text">
            Готовим оформление и экран авторизации.
          </p>
        </section>
      </main>
    </div>
  )
}

function defaultAuthBackgroundPreloader(profile: AuthBackgroundProfile) {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined' || typeof window.Image === 'undefined') {
      resolve()
      return
    }

    const image = new window.Image()

    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Auth background image failed to load.'))
    image.src = profile.asset
  })
}
