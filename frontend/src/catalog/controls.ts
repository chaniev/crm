export const catalogViewportModes = [
  'fluid',
  '360',
  '390',
  '420',
  '440',
  '768',
  '1440',
] as const

export const catalogMotionModes = ['system', 'reduced'] as const
export const catalogContentModes = ['standard', 'long'] as const

export type CatalogViewportMode = typeof catalogViewportModes[number]
export type CatalogMotionMode = typeof catalogMotionModes[number]
export type CatalogContentMode = typeof catalogContentModes[number]

export type CatalogControls = {
  theme: string
  viewport: CatalogViewportMode
  motion: CatalogMotionMode
  content: CatalogContentMode
}

function includes<const TValue extends string>(
  values: readonly TValue[],
  value: string | null,
): value is TValue {
  return value !== null && values.includes(value as TValue)
}

export function readCatalogControls(
  search: string,
  themeIds: readonly string[],
  fallbackThemeId: string,
): CatalogControls {
  const params = new URLSearchParams(search)
  const theme = params.get('theme')
  const viewport = params.get('viewport')
  const motion = params.get('motion')
  const content = params.get('content')

  return {
    theme: includes(themeIds, theme) ? theme : fallbackThemeId,
    viewport: includes(catalogViewportModes, viewport) ? viewport : 'fluid',
    motion: includes(catalogMotionModes, motion) ? motion : 'system',
    content: includes(catalogContentModes, content) ? content : 'standard',
  }
}

export function createCatalogSearch(controls: CatalogControls) {
  const params = new URLSearchParams()
  params.set('theme', controls.theme)
  params.set('viewport', controls.viewport)
  params.set('motion', controls.motion)
  params.set('content', controls.content)
  return `?${params.toString()}`
}
