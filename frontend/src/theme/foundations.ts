export const foundationBreakpoints = {
  mobileMax: '48rem',
  tabletMax: '63.99rem',
  desktopStart: '48.01em',
} as const

export const foundationSpacing = {
  pageSectionGap: '1.5rem',
  pageSectionGapMobile: '1rem',
  pageCardPadding: '1.5rem',
  pageCardPaddingCompact: '1rem',
  pageCardPaddingCompactMobile: '0.875rem',
  denseSurfacePadding: '0.9rem 1rem',
} as const

export const foundationRadii = {
  card: '24px',
  inner: '20px',
  denseSurface: '8px',
  pill: '999px',
} as const

export const foundationLayers = {
  underlay: '-1',
  base: '1',
  raised: '2',
  stickyActionBar: '210',
  mobileNavigation: '220',
} as const

export const foundationElevation = {
  card: '0 10px 30px var(--crm-shadow-card), 0 2px 8px var(--crm-shadow-soft)',
  subtle: '0 1px 4px var(--crm-shadow-soft)',
  section: '0 4px 12px var(--crm-shadow-card)',
  floating: '0 8px 20px var(--crm-brand-alpha-20)',
  bottomSurface: '0 -12px 28px var(--crm-shadow-strong)',
} as const

export type FoundationVariableMap = Record<`--crm-${string}`, string>

export function createFoundationVariables(): FoundationVariableMap {
  return {
    '--crm-space-page-section-gap': foundationSpacing.pageSectionGap,
    '--crm-space-page-section-gap-mobile': foundationSpacing.pageSectionGapMobile,
    '--crm-space-page-card-padding': foundationSpacing.pageCardPadding,
    '--crm-space-page-card-padding-compact': foundationSpacing.pageCardPaddingCompact,
    '--crm-space-page-card-padding-compact-mobile':
      foundationSpacing.pageCardPaddingCompactMobile,
    '--crm-space-dense-surface-padding': foundationSpacing.denseSurfacePadding,
    '--crm-radius-card': foundationRadii.card,
    '--crm-radius-inner': foundationRadii.inner,
    '--crm-radius-dense-surface': foundationRadii.denseSurface,
    '--crm-radius-pill': foundationRadii.pill,
    '--crm-layer-underlay': foundationLayers.underlay,
    '--crm-layer-base': foundationLayers.base,
    '--crm-layer-raised': foundationLayers.raised,
    '--crm-layer-sticky-action-bar': foundationLayers.stickyActionBar,
    '--crm-layer-mobile-navigation': foundationLayers.mobileNavigation,
    '--crm-elevation-card': foundationElevation.card,
    '--crm-elevation-subtle': foundationElevation.subtle,
    '--crm-elevation-section': foundationElevation.section,
    '--crm-elevation-floating': foundationElevation.floating,
    '--crm-elevation-bottom-surface': foundationElevation.bottomSurface,
  }
}

export type FoundationBreakpoint = keyof typeof foundationBreakpoints
export type FoundationSpacing = keyof typeof foundationSpacing
export type FoundationRadius = keyof typeof foundationRadii
export type FoundationLayer = keyof typeof foundationLayers
export type FoundationElevation = keyof typeof foundationElevation
