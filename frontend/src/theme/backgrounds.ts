import k4proLoginBackground from '../assets/auth/k4pro-login-bg.png'
import type { AuthBackgroundProfile, AuthStageBackground } from './types'

export const DEFAULT_AUTH_BACKGROUND_PROFILE_ID = 'k4pro-login-v1'

export const defaultAuthBackgroundFocalPoint = {
  xPercent: 64,
  yPercent: 50,
} as const

export const k4proLoginBackgroundProfile = {
  schemaVersion: 1,
  id: DEFAULT_AUTH_BACKGROUND_PROFILE_ID,
  asset: k4proLoginBackground,
  focalPoint: defaultAuthBackgroundFocalPoint,
} satisfies AuthBackgroundProfile

export const authBackgroundProfiles = [
  k4proLoginBackgroundProfile,
] as const satisfies readonly AuthBackgroundProfile[]

export const solidAuthStageBackground = {
  asset: null,
  focalPoint: defaultAuthBackgroundFocalPoint,
  profileId: null,
} satisfies AuthStageBackground

export function toAuthStageBackground(
  profile: AuthBackgroundProfile,
): AuthStageBackground {
  return {
    asset: profile.asset,
    focalPoint: profile.focalPoint,
    profileId: profile.id,
  }
}
