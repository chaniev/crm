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
  foundationSurfaces,
} from '../theme/foundations'
import { createSemanticVariables } from '../theme/semanticVariables'
import { defaultGreenProfile } from '../theme/profiles'

const appCss = readFileSync(resolve(process.cwd(), 'src/App.css'), 'utf8')
const usersListSource = readFileSync(
  resolve(process.cwd(), 'src/features/users/UsersListScreen.tsx'),
  'utf8',
)
const auditLogSource = readFileSync(
  resolve(process.cwd(), 'src/features/audit/AuditLogScreen.tsx'),
  'utf8',
)

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

  test('publishes the list-row surface contract without elevation', () => {
    expect(foundationSurfaces.listRow).toEqual({
      background: 'var(--crm-surface-subtle)',
      border: 'var(--crm-border-muted)',
      elevation: 'none',
      radius: '8px',
    })

    const variables = createFoundationVariables()
    expect(variables).toMatchObject({
      '--crm-surface-list-row': 'var(--crm-surface-subtle)',
      '--crm-surface-list-row-border': 'var(--crm-border-muted)',
      '--crm-radius-list-row': '8px',
      '--crm-elevation-list-row': 'none',
    })
    expect(Number.parseFloat(variables['--crm-radius-list-row'])).toBeLessThanOrEqual(16)
  })

  test('keeps focus radii on desktop and compacts them at the mobile boundary', () => {
    expect(foundationRadii.card).toBe('24px')
    expect(foundationRadii.inner).toBe('20px')
    expect(foundationRadii.cardMobile).toBe('16px')
    expect(foundationRadii.innerMobile).toBe('12px')
    expect(appCss).toContain('@media (max-width: 48rem)')
    expect(createFoundationVariables()).toMatchObject({
      '--crm-radius-card-mobile': '16px',
      '--crm-radius-inner-mobile': '12px',
    })
    expect(appCss).toContain('--crm-radius-card: var(--crm-radius-card-mobile);')
    expect(appCss).toContain('--crm-radius-inner: var(--crm-radius-inner-mobile);')
  })

  test('migrates trainers and audit rows to the list-row paint contract', () => {
    expect(appCss).toContain('background: var(--crm-surface-list-row);')
    expect(appCss).toContain('border-color: var(--crm-surface-list-row-border);')
    expect(appCss).toContain('border-radius: var(--crm-radius-list-row);')
    expect(appCss).toContain('box-shadow: var(--crm-elevation-list-row);')
    expect(usersListSource).toContain('list-row-card crm-list-row-surface')
    expect(auditLogSource).toContain('audit-log-row crm-list-row-surface')
    expect(usersListSource).not.toContain('--crm-elevation-card')
    expect(auditLogSource).not.toContain('--crm-elevation-card')

    const listRowRule = appCss.match(/\.crm-list-row-surface\s*\{([^}]*)\}/)?.[1]
    expect(listRowRule).toBeTruthy()
    expect(listRowRule).not.toMatch(/\b(?:height|min-height|margin|padding|gap)\s*:/)
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
