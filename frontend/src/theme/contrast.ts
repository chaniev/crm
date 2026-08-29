export type ParsedColor = { r: number; g: number; b: number; a: number }

const NAMED_COLORS: Record<string, ParsedColor> = {
  black: { r: 0, g: 0, b: 0, a: 1 },
  transparent: { r: 0, g: 0, b: 0, a: 0 },
  white: { r: 255, g: 255, b: 255, a: 1 },
}

function parseHexColor(input: string): ParsedColor {
  const hex = input.slice(1)

  if (![3, 4, 6, 8].includes(hex.length)) {
    throw new Error(`Unsupported hex color: ${input}`)
  }

  const expanded = hex.length <= 4
    ? [...hex].map((part) => `${part}${part}`).join('')
    : hex
  const alpha = expanded.length === 8
    ? Number.parseInt(expanded.slice(6, 8), 16) / 255
    : 1

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
    a: alpha,
  }
}

function mixColors(first: ParsedColor, second: ParsedColor, firstWeight: number) {
  const secondWeight = 1 - firstWeight
  const alpha = first.a * firstWeight + second.a * secondWeight

  if (alpha === 0) {
    return { r: 0, g: 0, b: 0, a: 0 }
  }

  return {
    r: Math.round((first.r * first.a * firstWeight + second.r * second.a * secondWeight) / alpha),
    g: Math.round((first.g * first.a * firstWeight + second.g * second.a * secondWeight) / alpha),
    b: Math.round((first.b * first.a * firstWeight + second.b * second.a * secondWeight) / alpha),
    a: alpha,
  }
}

export function parseColor(input: string): ParsedColor {
  const normalized = input.trim().toLowerCase()
  const named = NAMED_COLORS[normalized]

  if (named) {
    return { ...named }
  }

  if (normalized.startsWith('#')) {
    return parseHexColor(normalized)
  }

  const rgb = normalized.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/,
  )

  if (rgb) {
    return {
      r: Number.parseFloat(rgb[1]),
      g: Number.parseFloat(rgb[2]),
      b: Number.parseFloat(rgb[3]),
      a: rgb[4] === undefined ? 1 : Number.parseFloat(rgb[4]),
    }
  }

  const colorMix = normalized.match(
    /^color-mix\(in srgb,\s*(#[0-9a-f]{3,8}|black|white)\s+([\d.]+)%,\s*(transparent|#[0-9a-f]{3,8}|black|white)(?:\s+([\d.]+)%)?\)$/,
  )

  if (colorMix) {
    const firstWeight = Number.parseFloat(colorMix[2]) / 100
    return mixColors(
      parseColor(colorMix[1]),
      parseColor(colorMix[3]),
      firstWeight,
    )
  }

  throw new Error(`Unsupported color format: ${input}`)
}

export function flattenColor(color: ParsedColor, backdrop: ParsedColor): ParsedColor {
  return {
    r: Math.round(color.r * color.a + backdrop.r * (1 - color.a)),
    g: Math.round(color.g * color.a + backdrop.g * (1 - color.a)),
    b: Math.round(color.b * color.a + backdrop.b * (1 - color.a)),
    a: 1,
  }
}

function channelLuminance(channel: number) {
  const normalized = channel / 255
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

function luminance(color: ParsedColor) {
  return (
    0.2126 * channelLuminance(color.r) +
    0.7152 * channelLuminance(color.g) +
    0.0722 * channelLuminance(color.b)
  )
}

export function contrastRatio(
  foreground: string | ParsedColor,
  background: string | ParsedColor,
  backdrop: string | ParsedColor = 'white',
) {
  const parsedBackdrop = typeof backdrop === 'string' ? parseColor(backdrop) : backdrop
  const parsedBackground = typeof background === 'string' ? parseColor(background) : background
  const flatBackground = parsedBackground.a === 1
    ? parsedBackground
    : flattenColor(parsedBackground, parsedBackdrop)
  const parsedForeground = typeof foreground === 'string' ? parseColor(foreground) : foreground
  const flatForeground = parsedForeground.a === 1
    ? parsedForeground
    : flattenColor(parsedForeground, flatBackground)
  const foregroundLuminance = luminance(flatForeground)
  const backgroundLuminance = luminance(flatBackground)

  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  )
}
