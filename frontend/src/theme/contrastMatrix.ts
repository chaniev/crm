import { isLightColor } from '@mantine/core'
import { createSemanticVariables, semanticBaseColors } from './semanticVariables'
import type { ThemeProfile } from './types'
import {
  contrastRatio,
  parseColor,
  type ParsedColor,
} from './contrast'
import { fe17SharedRoutingThemeText } from '../resources/fe-17-shared-routing-theme'


export { contrastRatio, parseColor, type ParsedColor }

export type ThemeContrastKind = 'normal-text' | 'large-text' | 'focus' | 'boundary'

export type ThemeContrastResult = {
  profileId: string
  component: string
  state: string
  kind: ThemeContrastKind
  foreground: string
  background: string
  threshold: 3 | 4.5
  ratio: number
}

type ContrastCase = Omit<ThemeContrastResult, 'profileId' | 'ratio'>

const normalText = (
  component: string,
  state: string,
  foreground: string,
  background: string,
): ContrastCase => ({
  component,
  state,
  kind: 'normal-text',
  foreground,
  background,
  threshold: 4.5,
})

const indicator = (
  component: string,
  state: string,
  foreground: string,
  background: string,
  kind: 'focus' | 'boundary' = 'boundary',
): ContrastCase => ({
  component,
  state,
  kind,
  foreground,
  background,
  threshold: 3,
})

export function buildThemeContrastMatrix(profile: ThemeProfile): ThemeContrastResult[] {
  const variables = createSemanticVariables(profile)
  const primary = profile.brand.primary
  const inverse = variables['--crm-text-inverse']
  const card = variables['--crm-surface-card']
  const page = variables['--crm-surface-page']
  const listRow = variables['--crm-surface-subtle']
  const primaryForeground = isLightColor(primary[6], 0.2)
    ? semanticBaseColors.textStrong
    : inverse
  const cases: ContrastCase[] = [
    normalText('Text', fe17SharedRoutingThemeText.contrastMatrix_normalText_3d8c9d63, variables['--crm-text-primary'], page),
    normalText('Text', fe17SharedRoutingThemeText.contrastMatrix_normalText_849a1980, variables['--crm-text-secondary'], page),
    normalText('Text', fe17SharedRoutingThemeText.contrastMatrix_normalText_5b0f2c6c, variables['--crm-text-primary'], card),
    normalText('Text', fe17SharedRoutingThemeText.contrastMatrix_normalText_58362b30, variables['--crm-text-secondary'], card),
    normalText('ListRow', fe17SharedRoutingThemeText.contrastMatrix_normalText_dbe46d5f, variables['--crm-text-primary'], listRow),
    normalText('ListRow', fe17SharedRoutingThemeText.contrastMatrix_normalText_324d5afa, variables['--crm-text-secondary'], listRow),
    normalText('Button', fe17SharedRoutingThemeText.contrastMatrix_normalText_4cbbfe12, primaryForeground, variables['--crm-action-primary']),
    normalText('Button', fe17SharedRoutingThemeText.contrastMatrix_normalText_2259b12e, primaryForeground, variables['--crm-action-primary-hover']),
    normalText('Button', fe17SharedRoutingThemeText.contrastMatrix_normalText_9387e600, primaryForeground, variables['--crm-action-primary-active']),
    normalText('Button', fe17SharedRoutingThemeText.contrastMatrix_normalText_ef3f9a38, variables['--crm-text-disabled'], variables['--crm-surface-disabled']),
    normalText('Button', fe17SharedRoutingThemeText.contrastMatrix_normalText_e368e4e5, inverse, variables['--crm-status-danger-fg']),
    normalText('Button', fe17SharedRoutingThemeText.contrastMatrix_normalText_023c6df3, inverse, variables['--crm-status-danger-fg']),
    normalText('Button', fe17SharedRoutingThemeText.contrastMatrix_normalText_dec346fe, inverse, variables['--crm-status-danger-fg']),
    normalText('Badge', fe17SharedRoutingThemeText.contrastMatrix_normalText_ac9ea1cc, variables['--crm-status-success-fg'], variables['--crm-status-success-bg']),
    normalText('Badge', fe17SharedRoutingThemeText.contrastMatrix_normalText_8d8efcc1, variables['--crm-status-warning-fg'], variables['--crm-status-warning-bg']),
    normalText('Badge', fe17SharedRoutingThemeText.contrastMatrix_normalText_3a1b17be, variables['--crm-status-danger-fg'], variables['--crm-status-danger-bg']),
    normalText('Alert', fe17SharedRoutingThemeText.contrastMatrix_normalText_d51608db, variables['--crm-status-info-fg'], variables['--crm-status-info-bg']),
    normalText('Alert', fe17SharedRoutingThemeText.contrastMatrix_normalText_3a1b17be, variables['--crm-status-danger-fg'], variables['--crm-status-danger-bg']),
    normalText('Navigation', fe17SharedRoutingThemeText.contrastMatrix_normalText_ce583282, inverse, variables['--crm-status-success-fg']),
    normalText('Navigation', fe17SharedRoutingThemeText.contrastMatrix_normalText_61291e9d, inverse, primary[6]),
    normalText('Link', fe17SharedRoutingThemeText.contrastMatrix_normalText_2fbbe682, primary[7], card),
    normalText('Link', fe17SharedRoutingThemeText.contrastMatrix_normalText_db2889b5, primary[8], card),
    normalText('Accent', fe17SharedRoutingThemeText.contrastMatrix_normalText_bd3d1bc9, variables['--crm-accent-1-fg'], variables['--crm-accent-1-bg']),
    normalText('Accent', fe17SharedRoutingThemeText.contrastMatrix_normalText_071d1ba1, variables['--crm-accent-2-fg'], variables['--crm-accent-2-bg']),
    normalText('Accent', fe17SharedRoutingThemeText.contrastMatrix_normalText_128e7ce7, variables['--crm-accent-3-fg'], variables['--crm-accent-3-bg']),
    normalText('Accent', fe17SharedRoutingThemeText.contrastMatrix_normalText_ec79291a, variables['--crm-accent-4-fg'], variables['--crm-accent-4-bg']),
    indicator('Focus', 'indicator/default', variables['--crm-focus-ring'], card, 'focus'),
    indicator('Focus', 'indicator/page', variables['--crm-focus-ring'], page, 'focus'),
    indicator('Navigation', 'selected/boundary', variables['--crm-selection-border'], card),
  ]

  return cases.map((contrastCase) => ({
    profileId: profile.id,
    ...contrastCase,
    ratio: contrastRatio(contrastCase.foreground, contrastCase.background, card),
  }))
}

function formatFailure(result: ThemeContrastResult) {
  return (
    `${result.profileId} ${result.component}/${result.state}: ` +
    `foreground=${result.foreground} background=${result.background} ` +
    `threshold=${result.threshold.toFixed(2)} ratio=${result.ratio.toFixed(2)}`
  )
}

export function assertThemeProfileContrast(profile: ThemeProfile) {
  const failures = buildThemeContrastMatrix(profile)
    .filter((result) => result.ratio + Number.EPSILON < result.threshold)

  if (failures.length > 0) {
    throw new Error(`Theme contrast matrix failed:\n${failures.map(formatFailure).join('\n')}`)
  }
}
