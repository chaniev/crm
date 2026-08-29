import { defaultGreenProfile } from './theme/profiles'
import { createGymCrmTheme } from './theme/createGymCrmTheme'

export {
  DEFAULT_AUTH_BACKGROUND_PROFILE_ID,
  authBackgroundProfiles,
} from './theme/backgrounds'
export {
  createSemanticVariables,
  type SemanticVariableMap,
} from './theme/semanticVariables'
export { createGymCrmTheme } from './theme/createGymCrmTheme'
export {
  assertThemeProfileContrast,
  buildThemeContrastMatrix,
  type ThemeContrastKind,
  type ThemeContrastResult,
} from './theme/contrastMatrix'
export { resolveAuthBackgroundProfile, resolveThemeProfile } from './theme/resolveProfiles'
export { DEFAULT_THEME_PROFILE_ID, themeProfiles } from './theme/profiles'
export type {
  AuthBackgroundProfile,
  AuthStageBackground,
  ThemeProfile,
  ThemeResolutionResult,
  ThemeResolutionWarning,
  ThemeResolutionWarningSink,
} from './theme/types'

export const gymCrmTheme = createGymCrmTheme(defaultGreenProfile)
