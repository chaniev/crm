import { createSemanticVariables } from './semanticVariables'
import type { ThemeProfile } from './types'
import {
  contrastRatio,
  parseColor,
  type ParsedColor,
} from './contrast'

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
  const primary = profile.main.primary
  const secondary = profile.main.secondary ?? primary
  const accentThree = profile.supplementary[1] ?? primary
  const accentFour = profile.supplementary[2] ?? secondary
  const inverse = variables['--crm-text-inverse']
  const card = variables['--crm-surface-card']
  const page = variables['--crm-surface-page']

  const cases: ContrastCase[] = [
    normalText('Text', 'page/primary', variables['--crm-text-primary'], page),
    normalText('Text', 'page/secondary', variables['--crm-text-secondary'], page),
    normalText('Text', 'card/primary', variables['--crm-text-primary'], card),
    normalText('Text', 'card/secondary', variables['--crm-text-secondary'], card),
    normalText('Button', 'filled/default', inverse, variables['--crm-action-primary']),
    normalText('Button', 'filled/hover', inverse, variables['--crm-action-primary-hover']),
    normalText('Button', 'filled/active', inverse, variables['--crm-action-primary-active']),
    normalText('Button', 'filled/disabled', variables['--crm-text-disabled'], variables['--crm-surface-disabled']),
    normalText('Button', 'destructive/default', inverse, variables['--crm-status-danger']),
    normalText('Badge', 'success/default', variables['--crm-status-success'], variables['--crm-status-success-bg']),
    normalText('Badge', 'warning/default', variables['--crm-status-warning'], variables['--crm-status-warning-bg']),
    normalText('Badge', 'danger/default', variables['--crm-status-danger'], variables['--crm-status-danger-bg']),
    normalText('Alert', 'info/default', variables['--crm-status-info'], variables['--crm-status-info-bg']),
    normalText('Alert', 'danger/default', variables['--crm-status-danger'], variables['--crm-status-danger-bg']),
    normalText('Navigation', 'selected/default', inverse, primary[7]),
    normalText('Navigation', 'selected/hover', inverse, primary[8]),
    normalText('Link', 'default/default', primary[7], card),
    normalText('Link', 'hover/default', primary[8], card),
    normalText('Accent', '1/default', primary[8], variables['--crm-accent-1-bg']),
    normalText('Accent', '2/default', secondary[8], variables['--crm-accent-2-bg']),
    normalText('Accent', '3/default', accentThree[8], variables['--crm-accent-3-bg']),
    normalText('Accent', '4/default', accentFour[8], variables['--crm-accent-4-bg']),
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
