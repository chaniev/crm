import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  foundationBreakpoints,
  foundationElevation,
  foundationLayers,
  foundationMotion,
  foundationRadii,
  foundationSpacing,
} from '../theme/foundations'

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
      underlay: -1,
      base: 1,
      raised: 2,
      stickyActionBar: 210,
      mobileNavigation: 220,
    })
    expect(foundationElevation.card).toBe(
      '0 10px 30px var(--crm-shadow-card), 0 2px 8px var(--crm-shadow-soft)',
    )
    expect(foundationMotion.durationFast).toBe('120ms')
  })

  test('maps legacy application CSS aliases to the named foundation contract', () => {
    expect(appCss).toContain('--page-section-gap: var(--crm-space-page-section-gap);')
    expect(appCss).toContain('--page-card-radius: var(--crm-radius-card);')
    expect(appCss).toContain('--dense-surface-radius: var(--crm-radius-dense-surface);')
    expect(appCss).toContain('--shadow-card: var(--crm-elevation-card);')
    expect(appCss).toContain('--page-section-gap: var(--crm-space-page-section-gap-mobile);')
    expect(appCss).toContain('--page-card-padding-compact: var(--crm-space-page-card-padding-compact-mobile);')
  })

  test('uses named app layer variables instead of raw z-index literals in App.css', () => {
    expect(appCss).not.toMatch(/z-index:\s*-?\d+/)
    expect(appCss).toContain('z-index: var(--crm-layer-underlay);')
    expect(appCss).toContain('z-index: var(--crm-layer-sticky-action-bar);')
    expect(appCss).toContain('z-index: var(--crm-layer-mobile-navigation);')
  })
})
