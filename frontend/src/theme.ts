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
export {
  getSemanticToneAttributes,
  getSemanticToneComponentProps,
  getSemanticToneDefinition,
  semanticToneDefinitions,
  type SemanticTone,
  type SemanticToneDefinition,
} from './theme/semanticTones'
export { createGymCrmTheme } from './theme/createGymCrmTheme'
export {
  gymCrmComponentRecipes,
} from './theme/componentRecipes'
export {
  GYM_CRM_NOTIFICATION_AUTO_CLOSE_MS,
  GYM_CRM_NOTIFICATION_LIMIT,
} from './theme/componentRecipeConstants'
export {
  assertThemeProfileContrast,
  buildThemeContrastMatrix,
  type ThemeContrastKind,
  type ThemeContrastResult,
} from './theme/contrastMatrix'
export {
  createFoundationVariables,
  foundationBreakpoints,
  foundationElevation,
  foundationLayers,
  foundationRadii,
  foundationSpacing,
  type FoundationVariableMap,
  type FoundationBreakpoint,
  type FoundationElevation,
  type FoundationLayer,
  type FoundationRadius,
  type FoundationSpacing,
} from './theme/foundations'
export { resolveAuthBackgroundProfile, resolveThemeProfile } from './theme/resolveProfiles'
export { DEFAULT_THEME_PROFILE_ID, themeProfiles } from './theme/profiles'
export {
  createThemeProfileRegistry,
  normalizeThemeProfile,
  ThemeProfileValidationError,
} from './theme/validateProfile'
export type {
  AuthBackgroundProfile,
  AuthStageBackground,
  ThemeProfile,
  ThemeProfileInput,
  LegacyThemeProfileV1,
  ThemeResolutionResult,
  ThemeResolutionWarning,
  ThemeResolutionWarningSink,
} from './theme/types'

export const gymCrmTheme = createGymCrmTheme(defaultGreenProfile)
