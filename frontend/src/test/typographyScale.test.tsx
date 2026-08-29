import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  createTypographyVariables,
  typographyRoles,
  type TypographyRole,
} from '../theme/typography'
import { createSemanticVariables } from '../theme/semanticVariables'
import { defaultGreenProfile } from '../theme/profiles'
import { createGymCrmTheme } from '../theme/createGymCrmTheme'

const appCss = readFileSync(resolve(process.cwd(), 'src/App.css'), 'utf8')

const requiredRoles: TypographyRole[] = [
  'display',
  'heading1',
  'heading2',
  'heading3',
  'body',
  'bodyCompact',
  'label',
  'caption',
  'formControl',
  'numeric',
]

function variableNameFor(role: TypographyRole, suffix: string) {
  return `--crm-type-${role.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}-${suffix}`
}

function remToPx(value: string) {
  if (value.endsWith('rem')) {
    return Number(value.slice(0, -3)) * 16
  }

  if (value.endsWith('px')) {
    return Number(value.slice(0, -2))
  }

  return Number.NaN
}

describe('TASK-146 typography scale contract', () => {
  test('defines a bounded Onest semantic role scale', () => {
    expect(Object.keys(typographyRoles)).toEqual(requiredRoles)

    for (const [role, definition] of Object.entries(typographyRoles)) {
      expect(definition.fontFamily).toContain('Onest')
      expect(definition.letterSpacing).toBe('0')
      expect(definition.fontSize).toBeTruthy()
      expect(definition.lineHeight).toBeTruthy()
      expect(definition.fontWeight).toMatch(/^[0-9]+$/)

      if (role !== 'caption') {
        expect(remToPx(definition.fontSize)).not.toBeLessThan(14)
      }
    }
  })

  test('publishes typography variables through the semantic theme contract', () => {
    const typographyVariables = createTypographyVariables()
    const semanticVariables = createSemanticVariables(defaultGreenProfile)

    expect(semanticVariables).toMatchObject(typographyVariables)

    for (const role of requiredRoles) {
      expect(typographyVariables).toHaveProperty(variableNameFor(role, 'size'))
      expect(typographyVariables).toHaveProperty(variableNameFor(role, 'line-height'))
      expect(typographyVariables).toHaveProperty(variableNameFor(role, 'weight'))
    }
  })

  test('exposes the role scale to Mantine without changing the product font', () => {
    const theme = createGymCrmTheme(defaultGreenProfile)

    expect(theme.fontFamily).toBe(typographyRoles.body.fontFamily)
    expect(theme.headings?.fontFamily).toBe(typographyRoles.heading1.fontFamily)
    expect(theme.headings?.sizes?.h1?.fontSize).toBe(typographyRoles.heading1.fontSize)
    expect(theme.headings?.sizes?.h2?.fontSize).toBe(typographyRoles.heading2.fontSize)
    expect(theme.fontSizes?.md).toBe(typographyRoles.body.fontSize)
  })

  test('keeps critical controls at least 16 CSS px on iPhone', () => {
    expect(typographyRoles.formControl.fontSize).toBe('1rem')

    expect(appCss).toContain('font-size: var(--crm-type-form-control-size);')
    expect(appCss).toContain('font-size: var(--crm-type-form-control-size, 1rem);')
    expect(appCss).toContain('font-size: 16px;')
  })

  test('bounds caption usage away from recovery and decision copy', () => {
    expect(remToPx(typographyRoles.caption.fontSize)).toBeLessThan(14)
    expect(appCss).toContain('font-size: var(--crm-type-label-size);')
    expect(appCss).not.toContain('.state-panel--error {\n  font-size: var(--crm-type-caption-size);')
    expect(appCss).not.toContain('.empty-state__description {\n  font-size: var(--crm-type-caption-size);')
  })

  test('routes representative long-content and numeric surfaces through roles', () => {
    expect(typographyRoles.numeric.fontVariantNumeric).toBe('tabular-nums')
    expect(appCss).toContain('font-variant-numeric: var(--crm-type-numeric-numeric);')
    expect(appCss).toContain('font-size: var(--crm-type-body-compact-size);')
    expect(appCss).toContain('line-height: var(--crm-type-body-compact-line-height);')
    expect(appCss).toContain('overflow-wrap: anywhere;')
  })
})
