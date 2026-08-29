import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  createFoundationVariables,
  foundationBreakpoints,
  foundationElevation,
  foundationLayers,
  foundationRadii,
  foundationSpacing,
} from '../theme/foundations'
import { createSemanticVariables } from '../theme/semanticVariables'
import { defaultGreenProfile } from '../theme/profiles'

const appCss = readFileSync(resolve(process.cwd(), 'src/App.css'), 'utf8')

describe('TASK-145 design foundation scales', () => {
  test('documents the existing canonical breakpoint, spacing, radius, layer and elevation values', () => {
    expect(foundationBreakpoints).toMatchObject({
      mobileMax: '48rem',
      tabletMax: '63.99rem',
      desktopStart: '48.01em',
    })
    expect(foundationSpacing).toMatchObject({
      pageSectionGap: '1.5rem',
      pageSectionGapMobile: '1rem',
      pageCardPadding: '1.5rem',
      pageCardPaddingCompact: '1rem',
      pageCardPaddingCompactMobile: '0.875rem',
      denseSurfacePadding: '0.9rem 1rem',
    })
    expect(foundationRadii).toMatchObject({
      card: '24px',
      inner: '20px',
      denseSurface: '8px',
      pill: '999px',
    })
    expect(foundationLayers).toMatchObject({
      underlay: '-1',
      base: '1',
      raised: '2',
      stickyActionBar: '210',
      mobileNavigation: '220',
    })
    expect(foundationElevation.card).toBe(
      '0 10px 30px var(--crm-shadow-card), 0 2px 8px var(--crm-shadow-soft)',
    )
  })

  test('publishes foundation variables through the semantic theme contract', () => {
    const foundationVariables = createFoundationVariables()
    const semanticVariables = createSemanticVariables(defaultGreenProfile)

    expect(semanticVariables).toMatchObject(foundationVariables)
    expect(foundationVariables).not.toHaveProperty('--crm-motion-duration-fast')
    expect(foundationVariables).not.toHaveProperty('--crm-motion-easing-functional')
  })

  test('maps legacy application CSS aliases to the named foundation contract', () => {
    expect(appCss).toContain('--page-section-gap: var(--crm-space-page-section-gap);')
    expect(appCss).toContain('--page-card-radius: var(--crm-radius-card);')
    expect(appCss).toContain('--dense-surface-radius: var(--crm-radius-dense-surface);')
    expect(appCss).toContain('--shadow-card: var(--crm-elevation-card);')
    expect(appCss).toContain('--page-section-gap: var(--crm-space-page-section-gap-mobile);')
    expect(appCss).toContain('--page-card-padding-compact: var(--crm-space-page-card-padding-compact-mobile);')
  })

  test('keeps App.css foundation fallbacks synchronized with the typed variable map', () => {
    const foundationVariables = createFoundationVariables()

    for (const [name, value] of Object.entries(foundationVariables)) {
      expect(appCss).toContain(`${name}: ${value};`)
    }
  })

  test('routes representative app layers through named variables', () => {
    expect(appCss).toContain('z-index: var(--crm-layer-underlay);')
    expect(appCss).toContain('z-index: var(--crm-layer-sticky-action-bar);')
    expect(appCss).toContain('z-index: var(--crm-layer-mobile-navigation);')
    expect(appCss).not.toContain('z-index: -1;')
    expect(appCss).not.toContain('z-index: 210;')
    expect(appCss).not.toContain('z-index: 220;')
  })
})

describe('TASK-159 spacing scale and narrow breakpoint hygiene', () => {
  test('publishes the canonical 4px spacing scale without drift', () => {
    expect(foundationSpacing).toMatchObject({
      space1: '4px',
      space2: '8px',
      space3: '12px',
      space4: '16px',
      space5: '20px',
      space6: '24px',
      space7: '32px',
      space8: '48px',
    })

    expect(createFoundationVariables()).toMatchObject({
      '--crm-space-1': '4px',
      '--crm-space-2': '8px',
      '--crm-space-3': '12px',
      '--crm-space-4': '16px',
      '--crm-space-5': '20px',
      '--crm-space-6': '24px',
      '--crm-space-7': '32px',
      '--crm-space-8': '48px',
    })
  })

  test('names the 360px guardrail without duplicating the canonical mobile boundary', () => {
    expect(foundationBreakpoints.narrowMax).toBe('22.5rem')
    expect(Number.parseFloat(foundationBreakpoints.narrowMax) * 16).toBe(360)
    expect(Object.values(foundationBreakpoints).filter((value) => value === '48rem')).toHaveLength(1)
  })
})
