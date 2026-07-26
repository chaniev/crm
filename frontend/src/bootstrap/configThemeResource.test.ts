import { waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { createConfigThemeBootstrapResource } from './configThemeResource'
import { DEFAULT_AUTH_BACKGROUND_PROFILE_ID } from '../theme/backgrounds'
import { DEFAULT_THEME_PROFILE_ID } from '../theme/profiles'

const appConfigContract = {
  clubName: 'K-4PRO',
  themeId: 'custom-theme-v1',
  authBackgroundImageId: 'custom-bg-v1',
}

describe('ConfigThemeBootstrap resource contract', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  test('returns typed config transport fallback warning and defaults when fetch rejects', async () => {
    const warningSink = vi.fn()

    const resource = createConfigThemeBootstrapResource({
      loadConfig: vi.fn().mockRejectedValue(new Error('network broken')),
      warningSink,
    })

    expect(resource.getSnapshot()).toMatchObject({ status: 'pending' })

    await waitFor(() => {
      expect(resource.getSnapshot()).toMatchObject({ status: 'resolved' })
    })

    expect(warningSink).toHaveBeenCalledTimes(1)
    expect(warningSink).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'config-transport-fallback',
        source: 'config',
        resolvedId: DEFAULT_THEME_PROFILE_ID,
      }),
    )

    const snapshot = resource.getSnapshot()
    if (snapshot.status !== 'resolved') {
      throw new Error('Snapshot did not resolve.')
    }

    expect(snapshot.appConfig.clubName).toBe('Gym CRM')
    expect(snapshot.appConfig.themeId).toBe(DEFAULT_THEME_PROFILE_ID)
    expect(snapshot.appConfig.authBackgroundImageId).toBe(DEFAULT_AUTH_BACKGROUND_PROFILE_ID)
  })

  test('times out and reports typed fallback warning when timeout is exceeded', async () => {
    const warningSink = vi.fn()

    const neverResolve = vi.fn(
      () => new Promise<never>(() => undefined),
    )

    const resource = createConfigThemeBootstrapResource({
      loadConfig: neverResolve,
      timeoutMs: 10,
      warningSink,
    })

    expect(resource.getSnapshot()).toMatchObject({ status: 'pending' })

    await waitFor(() => {
      expect(resource.getSnapshot()).toMatchObject({ status: 'resolved' })
    })

    expect(warningSink).toHaveBeenCalledTimes(1)
    expect(warningSink).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'config-transport-fallback',
        source: 'config',
        resolvedId: DEFAULT_THEME_PROFILE_ID,
      }),
    )
    const snapshot = resource.getSnapshot()
    if (snapshot.status !== 'resolved') {
      throw new Error('Snapshot did not resolve.')
    }

    expect(snapshot.appConfig).toEqual({
      clubName: 'Gym CRM',
      themeId: DEFAULT_THEME_PROFILE_ID,
      authBackgroundImageId: DEFAULT_AUTH_BACKGROUND_PROFILE_ID,
    })

    expect(neverResolve).toHaveBeenCalledTimes(1)
  })

  test('emits typed resolution warnings for unknown ids in resolved config', async () => {
    const warningSink = vi.fn()

    const resource = createConfigThemeBootstrapResource({
      loadConfig: vi.fn().mockResolvedValue(appConfigContract),
      warningSink,
    })

    expect(resource.getSnapshot()).toMatchObject({ status: 'pending' })

    await waitFor(() => {
      expect(resource.getSnapshot()).toMatchObject({ status: 'resolved' })
    })

    expect(warningSink).toHaveBeenCalledTimes(2)
    const kinds = warningSink.mock.calls.map(([warning]) => warning.kind).sort()

    expect(kinds).toContain('unknown-auth-background-profile')
    expect(kinds).toContain('unknown-theme-profile')

    const snapshot = resource.getSnapshot()
    if (snapshot.status !== 'resolved') {
      throw new Error('Snapshot did not resolve.')
    }

    expect(snapshot.themeProfile.id).toBe(DEFAULT_THEME_PROFILE_ID)
    expect(snapshot.authBackgroundProfile.id).toBe(DEFAULT_AUTH_BACKGROUND_PROFILE_ID)
    expect(snapshot.appConfig).toMatchObject({
      clubName: 'K-4PRO',
      themeId: 'custom-theme-v1',
      authBackgroundImageId: 'custom-bg-v1',
    })
  })
})
