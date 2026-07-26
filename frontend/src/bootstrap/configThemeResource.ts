import { loadAppConfig, type AppConfigResponse } from '../lib/api'
import { DEFAULT_AUTH_BACKGROUND_PROFILE_ID } from '../theme/backgrounds'
import { DEFAULT_THEME_PROFILE_ID } from '../theme/profiles'
import {
  reportThemeResolutionWarning,
  resolveAuthBackgroundProfile,
  resolveThemeProfile,
} from '../theme/resolveProfiles'
import type {
  AuthBackgroundProfile,
  ThemeProfile,
  ThemeResolutionWarningSink,
} from '../theme/types'

export type ConfigThemeBootstrapSnapshot =
  | {
      status: 'pending'
    }
  | {
      status: 'resolved'
      appConfig: AppConfigResponse
      authBackgroundProfile: AuthBackgroundProfile
      themeProfile: ThemeProfile
    }

export type ConfigThemeBootstrapResource = {
  getSnapshot: () => ConfigThemeBootstrapSnapshot
  subscribe: (listener: () => void) => () => void
}

type ConfigThemeBootstrapResourceOptions = {
  loadConfig?: typeof loadAppConfig
  timeoutMs?: number
  warningSink?: ThemeResolutionWarningSink
}

const fallbackAppConfig = {
  clubName: 'Gym CRM',
  themeId: DEFAULT_THEME_PROFILE_ID,
  authBackgroundImageId: DEFAULT_AUTH_BACKGROUND_PROFILE_ID,
} satisfies AppConfigResponse

const DEFAULT_CONFIG_TIMEOUT_MS = 8000

export function createConfigThemeBootstrapResource(
  options: ConfigThemeBootstrapResourceOptions = {},
): ConfigThemeBootstrapResource {
  const loadConfig = options.loadConfig ?? loadAppConfig
  const listeners = new Set<() => void>()
  let snapshot: ConfigThemeBootstrapSnapshot = { status: 'pending' }

  void loadConfigWithTimeout(loadConfig, options.timeoutMs ?? DEFAULT_CONFIG_TIMEOUT_MS)
    .catch((error: unknown) => {
      reportThemeResolutionWarning(
        {
          kind: 'config-transport-fallback',
          source: 'config',
          value: error instanceof Error ? error.message : 'unknown config error',
          resolvedId: DEFAULT_THEME_PROFILE_ID,
        },
        options.warningSink,
      )

      return fallbackAppConfig
    })
    .then((config) => {
      const appConfig = normalizeAppConfig(config)
      const themeResolution = resolveThemeProfile(appConfig.themeId, {
        warningSink: options.warningSink,
      })
      const backgroundResolution = resolveAuthBackgroundProfile(
        appConfig.authBackgroundImageId,
        { warningSink: options.warningSink },
      )

      snapshot = {
        status: 'resolved',
        appConfig,
        authBackgroundProfile: backgroundResolution.profile,
        themeProfile: themeResolution.profile,
      }

      listeners.forEach((listener) => listener())
    })

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)

      return () => listeners.delete(listener)
    },
  }
}

function loadConfigWithTimeout(
  loadConfig: typeof loadAppConfig,
  timeoutMs: number,
) {
  const controller = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort()
      reject(new Error('Config request timed out.'))
    }, timeoutMs)
  })

  return Promise.race([
    loadConfig(controller.signal),
    timeoutPromise,
  ]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  })
}

function normalizeAppConfig(config: AppConfigResponse): AppConfigResponse {
  return {
    clubName: config.clubName,
    themeId: config.themeId?.trim() || DEFAULT_THEME_PROFILE_ID,
    authBackgroundImageId:
      config.authBackgroundImageId?.trim() || DEFAULT_AUTH_BACKGROUND_PROFILE_ID,
  }
}
