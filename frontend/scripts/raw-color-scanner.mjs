import { readFile, readdir } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'

export const rawColorKinds = [
  'rawHex',
  'rgb',
  'hsl',
  'mantineThemeValue',
  'mantineCssVar',
  'crmCompatibilityVar',
]

export const scannerPatterns = [
  {
    kind: 'rawHex',
    regex: /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-fA-F])/g,
  },
  {
    kind: 'rgb',
    regex: /\brgba?\([^)]*\)/gi,
  },
  {
    kind: 'hsl',
    regex: /\bhsla?\([^)]*\)/gi,
  },
  {
    kind: 'mantineThemeValue',
    regex: /(?:[:=,\(\[]\s*["'`])(?:brand|accent|sand|yellow|red|dark|gray|orange|blue|green|cyan|violet|indigo|teal|lime|grape|pink|dimmed|body|white|black)\.\d{1,2}(?:["'`])/gi,
  },
  {
    kind: 'mantineCssVar',
    regex: /--mantine-color-[a-z]+(?:-[a-z0-9]+)*(?:-\d{1,2})?/gi,
  },
  {
    kind: 'crmCompatibilityVar',
    regex: /--crm-(?:legacy-color|mantine-color)-[a-z0-9-]+/gi,
  },
]

export const sourceDefinitionPaths = new Set([
  'src/theme/profiles.ts',
  'src/theme/semanticVariables.ts',
])

const genericAllowlistPatterns = new Set([
  '#',
  'rgb(',
  'rgba(',
  'hsl(',
  'hsla(',
])

export function normalizeScanPath(value) {
  return value.replace(/\\/g, '/')
}

export async function readAllowlist(pathname) {
  const file = await readFile(pathname, 'utf8')
  const parsed = JSON.parse(file)

  return parsed.entries ?? []
}

export function splitLines(text) {
  return text.split(/\r?\n/)
}

export function findViolationsByLine(file, content) {
  const lines = splitLines(content)
  const findings = []

  lines.forEach((line, lineIndex) => {
    for (const pattern of scannerPatterns) {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags)

      for (const match of line.matchAll(regex)) {
        findings.push({
          path: file,
          line: lineIndex + 1,
          kind: pattern.kind,
          match: match[0],
          lineText: line.trim(),
        })
      }
    }
  })

  return findings
}

export function validateAllowlist(entries) {
  const seen = new Set()

  for (const entry of entries) {
    if (
      !entry?.path ||
      !entry?.pattern ||
      !entry.reason ||
      !entry.owner ||
      !entry.reviewOrRemoval
    ) {
      throw new Error(`Allowlist entry missing required fields: ${JSON.stringify(entry)}`)
    }

    if (genericAllowlistPatterns.has(entry.pattern.trim().toLowerCase())) {
      throw new Error(`Allowlist pattern must be an exact full value, not a generic scanner fragment: ${entry.pattern}`)
    }

    if (
      entry.path.includes('*') ||
      entry.path.includes('?') ||
      entry.path.includes('[') ||
      entry.path.includes(']')
    ) {
      throw new Error(`Allowlist path must be exact, not globbed: ${entry.path}`)
    }

    if (!extname(entry.path)) {
      throw new Error(`Allowlist path must be a concrete file path: ${entry.path}`)
    }

    if (!entry.path.startsWith('src/')) {
      throw new Error(`Allowlist path must be repo-relative under src/: ${entry.path}`)
    }

    const key = `${entry.path}::${entry.pattern}`
    if (seen.has(key)) {
      throw new Error(`Duplicate allowlist key: ${key}`)
    }
    seen.add(key)
  }
}

export function filterAllowed(findings, allowlist) {
  return findings.filter((finding) => {
    if (sourceDefinitionPaths.has(finding.path)) {
      return false
    }

    const allowed = allowlist.some((entry) => {
      const samePath = finding.path === normalizeScanPath(entry.path)
      if (!samePath) {
        return false
      }

      return finding.lineText.includes(entry.pattern)
    })

    return !allowed
  })
}

export async function collectSourceFiles(directory, accumulator = []) {
  const entries = await readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'test') {
      continue
    }

    const nextPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      await collectSourceFiles(nextPath, accumulator)
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) {
      continue
    }

    const extension = extname(entry.name)
    if (extension !== '.ts' && extension !== '.tsx' && extension !== '.css') {
      continue
    }

    accumulator.push(nextPath)
  }

  return accumulator
}

export function formatFindings(findings) {
  return findings
    .slice(0, 120)
    .map((item) => `${item.path}:${item.line} [${item.kind}] ${item.match}`)
    .join('\n')
}

export function groupFindingsByKind(findings) {
  const grouped = new Map()

  for (const finding of findings) {
    grouped.set(finding.kind, (grouped.get(finding.kind) ?? 0) + 1)
  }

  return Array.from(grouped.entries())
    .map(([kind, count]) => `${kind}: ${count}`)
    .join(', ')
}

export async function scanRawColors({ allowlistPath, srcRoot }) {
  const allowlist = await readAllowlist(allowlistPath)
  validateAllowlist(allowlist)

  const files = await collectSourceFiles(srcRoot)
  const allFindings = []

  for (const file of files) {
    const text = await readFile(file, 'utf8')
    const scanPath = normalizeScanPath(join('src', relative(srcRoot, file)))
    allFindings.push(
      ...findViolationsByLine(scanPath, text),
    )
  }

  return {
    allowlist,
    findings: allFindings,
    unallowed: filterAllowed(allFindings, allowlist),
  }
}
