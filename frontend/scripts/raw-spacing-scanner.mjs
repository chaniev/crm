import { readFile, readdir } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'

const spacingPropertyPattern = /^(?:padding|margin)(?:-(?:top|right|bottom|left|inline(?:-start|-end)?|block(?:-start|-end)?))?$|^(?:gap|row-gap|column-gap)$/
const declarationPattern = /(?:^|[;{}])\s*((?:padding|margin)(?:-(?:top|right|bottom|left|inline(?:-start|-end)?|block(?:-start|-end)?))?|gap|row-gap|column-gap)\s*:\s*([^;}]+)/gim
const rawLengthPattern = /-?(?:\d+\.?\d*|\.\d+)(?:px|rem|em)\b/gi
const scalePixels = new Set([4, 8, 12, 16, 20, 24, 32, 48])

export function normalizeSpacingScanPath(value) {
  return value.replace(/\\/g, '/')
}

function normalizedValue(value) {
  return value.replace(/\s+/g, ' ').trim()
}

function toPixels(rawLength) {
  const match = /^(-?(?:\d+\.?\d*|\.\d+))(px|rem|em)$/i.exec(rawLength)
  if (!match) return null

  const numeric = Math.abs(Number.parseFloat(match[1]))
  const unit = match[2].toLowerCase()
  if (unit === 'em') return null
  return unit === 'px' ? numeric : numeric * 16
}

function isScaleLength(rawLength) {
  const pixels = toPixels(rawLength)
  return pixels === 0 || scalePixels.has(pixels)
}

export function findSpacingViolationsByLine(file, content) {
  const findings = []

  for (const match of content.matchAll(declarationPattern)) {
    const property = match[1].toLowerCase()
    const value = normalizedValue(match[2])
    const rawLengths = Array.from(value.matchAll(rawLengthPattern), (item) => item[0])
    const disallowedLengths = rawLengths.filter((length) => !isScaleLength(length))

    if (disallowedLengths.length === 0) continue

    const declarationOffset = (match.index ?? 0) + match[0].indexOf(match[1])
    findings.push({
      path: file,
      line: content.slice(0, declarationOffset).split(/\r?\n/).length,
      property,
      value,
      match: `${property}: ${value}`,
      disallowedLengths,
    })
  }

  return findings
}

export async function readSpacingAllowlist(pathname) {
  const parsed = JSON.parse(await readFile(pathname, 'utf8'))
  return parsed.entries ?? []
}

export function validateSpacingAllowlist(entries) {
  const seen = new Set()

  for (const entry of entries) {
    if (
      !entry?.path || !Array.isArray(entry?.declarations) ||
      !entry.reason || !entry.owner || !entry.reviewOrRemoval
    ) {
      throw new Error(`Spacing allowlist entry missing required fields: ${JSON.stringify(entry)}`)
    }

    if (
      entry.path.includes('*') || entry.path.includes('?') ||
      entry.path.includes('[') || entry.path.includes(']') ||
      !entry.path.startsWith('src/') || extname(entry.path) !== '.css'
    ) {
      throw new Error(`Spacing allowlist path must be exact CSS source path: ${entry.path}`)
    }

    for (const declaration of entry.declarations) {
      if (
        !declaration?.property || !declaration?.value ||
        !Number.isInteger(declaration?.occurrences) || declaration.occurrences < 1
      ) {
        throw new Error(`Spacing allowlist declaration missing required fields: ${JSON.stringify(declaration)}`)
      }
      if (!spacingPropertyPattern.test(declaration.property)) {
        throw new Error(`Spacing allowlist property must be exact and in scope: ${declaration.property}`)
      }
      if (normalizedValue(declaration.value) !== declaration.value) {
        throw new Error(`Spacing allowlist value must use normalized whitespace: ${declaration.value}`)
      }

      const key = `${entry.path}::${declaration.property}::${declaration.value}`
      if (seen.has(key)) throw new Error(`Duplicate spacing allowlist key: ${key}`)
      seen.add(key)
    }
  }
}

export function filterAllowedSpacing(findings, allowlist) {
  const remaining = new Map(allowlist.flatMap((entry) => entry.declarations.map((declaration) => [
    `${normalizeSpacingScanPath(entry.path)}::${declaration.property}::${declaration.value}`,
    declaration.occurrences,
  ])))

  return findings.filter((finding) => {
    const key = `${finding.path}::${finding.property}::${finding.value}`
    const allowance = remaining.get(key) ?? 0
    if (allowance < 1) return true
    remaining.set(key, allowance - 1)
    return false
  })
}

export async function collectSpacingSourceFiles(directory, accumulator = []) {
  const entries = await readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'test') continue
    const nextPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      await collectSpacingSourceFiles(nextPath, accumulator)
    } else if (entry.isFile() && extname(entry.name) === '.css') {
      accumulator.push(nextPath)
    }
  }

  return accumulator
}

export function formatSpacingFindings(findings) {
  return findings.slice(0, 120).map((item) => `${item.path}:${item.line} ${item.match}`).join('\n')
}

export async function scanRawSpacing({ allowlistPath, srcRoot }) {
  const allowlist = await readSpacingAllowlist(allowlistPath)
  validateSpacingAllowlist(allowlist)
  const files = await collectSpacingSourceFiles(srcRoot)
  const findings = []

  for (const file of files) {
    const scanPath = normalizeSpacingScanPath(join('src', relative(srcRoot, file)))
    findings.push(...findSpacingViolationsByLine(scanPath, await readFile(file, 'utf8')))
  }

  return { allowlist, findings, unallowed: filterAllowedSpacing(findings, allowlist) }
}
