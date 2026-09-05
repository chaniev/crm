
import { fe17SharedRoutingThemeText } from '../resources/fe-17-shared-routing-theme'
export const crmFontFamilies = {
  body: 'Onest, ui-sans-serif, system-ui, sans-serif',
  heading: fe17SharedRoutingThemeText.typography_heading_adc69f43,
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace',
} as const

export type TypographyRoleDefinition = {
  fontFamily: string
  fontSize: string
  fontWeight: string
  lineHeight: string
  letterSpacing: string
  fontVariantNumeric?: 'tabular-nums'
}

export const typographyRoles = {
  display: {
    fontFamily: crmFontFamilies.heading,
    fontSize: 'clamp(2.25rem, 5vw, 3rem)',
    fontWeight: '800',
    lineHeight: '1',
    letterSpacing: '0',
  },
  heading1: {
    fontFamily: crmFontFamilies.heading,
    fontSize: 'clamp(1.75rem, 3vw, 2.35rem)',
    fontWeight: '800',
    lineHeight: '1.12',
    letterSpacing: '0',
  },
  heading2: {
    fontFamily: crmFontFamilies.heading,
    fontSize: 'clamp(1.45rem, 2.4vw, 2rem)',
    fontWeight: '800',
    lineHeight: '1.14',
    letterSpacing: '0',
  },
  heading3: {
    fontFamily: crmFontFamilies.heading,
    fontSize: '1rem',
    fontWeight: '800',
    lineHeight: '1.2',
    letterSpacing: '0',
  },
  body: {
    fontFamily: crmFontFamilies.body,
    fontSize: '1rem',
    fontWeight: '400',
    lineHeight: '1.45',
    letterSpacing: '0',
  },
  bodyCompact: {
    fontFamily: crmFontFamilies.body,
    fontSize: '0.875rem',
    fontWeight: '500',
    lineHeight: '1.25',
    letterSpacing: '0',
  },
  label: {
    fontFamily: crmFontFamilies.body,
    fontSize: '0.875rem',
    fontWeight: '800',
    lineHeight: '1.25',
    letterSpacing: '0',
  },
  caption: {
    fontFamily: crmFontFamilies.body,
    fontSize: '0.75rem',
    fontWeight: '700',
    lineHeight: '1.15',
    letterSpacing: '0',
  },
  formControl: {
    fontFamily: crmFontFamilies.body,
    fontSize: '1rem',
    fontWeight: '600',
    lineHeight: '1.25',
    letterSpacing: '0',
  },
  numeric: {
    fontFamily: crmFontFamilies.body,
    fontSize: '1rem',
    fontWeight: '800',
    lineHeight: '1.1',
    letterSpacing: '0',
    fontVariantNumeric: 'tabular-nums',
  },
} as const satisfies Record<string, TypographyRoleDefinition>

export type TypographyRole = keyof typeof typographyRoles
export type TypographyVariableMap = Record<`--crm-${string}`, string>

export function createTypographyVariables(): TypographyVariableMap {
  const variables: TypographyVariableMap = {
    '--crm-font-family-body': crmFontFamilies.body,
    [fe17SharedRoutingThemeText.typography_crmFontFamilyHeading_36935063]: crmFontFamilies.heading,
    '--crm-font-family-mono': crmFontFamilies.mono,
  }

  const roleEntries = Object.entries(typographyRoles) as Array<
    [TypographyRole, TypographyRoleDefinition]
  >

  for (const [role, definition] of roleEntries) {
    const variablePrefix = `--crm-type-${toKebabCase(role)}`

    variables[`${variablePrefix}-family` as `--crm-${string}`] =
      definition.fontFamily
    variables[`${variablePrefix}-size` as `--crm-${string}`] =
      definition.fontSize
    variables[`${variablePrefix}-weight` as `--crm-${string}`] =
      definition.fontWeight
    variables[`${variablePrefix}-line-height` as `--crm-${string}`] =
      definition.lineHeight
    variables[`${variablePrefix}-letter-spacing` as `--crm-${string}`] =
      definition.letterSpacing

    if (definition.fontVariantNumeric) {
      variables[`${variablePrefix}-numeric` as `--crm-${string}`] =
        definition.fontVariantNumeric
    }
  }

  return variables
}

function toKebabCase(value: string) {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
}
