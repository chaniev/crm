/// <reference types="node" />

import { join } from 'node:path'
import { cwd } from 'node:process'
import { describe, expect, test } from 'vitest'
import {
  findViolationsByLine,
  findSemanticToneBypassesByLine,
  formatFindings,
  groupFindingsByKind,
  readAllowlist,
  scanRawColors,
  validateAllowlist,
} from '../../scripts/raw-color-scanner.mjs'

const projectRoot = cwd()
const srcRoot = join(projectRoot, 'src')
const allowlistPath = join(projectRoot, 'scripts', 'raw-color-allowlist.json')

describe('TASK-090 Slice C — raw-color scanner', () => {
  test('enforces exact allowlist schema for explicit exceptions', async () => {
    const allowlist = await readAllowlist(allowlistPath)
    expect(Array.isArray(allowlist)).toBe(true)
    expect(() => validateAllowlist(allowlist)).not.toThrow()
  })

  test('rejects broad allowlist patterns (synthetic)', () => {
    const syntheticAllowlist = [
      {
        path: 'src/features/**/*.tsx',
        pattern: '#',
        reason: 'Broad component exemption is intentionally forbidden.',
        owner: 'frontend',
        reviewOrRemoval: 'Replace with concrete file-level allowlist entries.',
      },
    ]

    expect(() => validateAllowlist(syntheticAllowlist)).toThrow(/exact/i)
  })

  test('rejects generic allowlist fragments even on exact paths (synthetic)', () => {
    const syntheticAllowlist = [
      {
        path: 'src/App.css',
        pattern: '#',
        reason: 'Generic raw color fragment is intentionally forbidden.',
        owner: 'frontend',
        reviewOrRemoval: 'Use an exact full value or migrate to semantic variables.',
      },
      {
        path: 'src/App.css',
        pattern: 'rgba(',
        reason: 'Generic alpha color fragment is intentionally forbidden.',
        owner: 'frontend',
        reviewOrRemoval: 'Use an exact full value or migrate to semantic variables.',
      },
    ]

    expect(() => validateAllowlist(syntheticAllowlist)).toThrow(/generic/i)
  })

  test('flags synthetic raw color and direct Mantine references', () => {
    const fixturePath = 'src/test/raw-color-scanner.fixture.tsx'
    const syntheticSource = [
      'const colorHex = "#abc123"',
      'const colorRgba = "rgba(255, 255, 255, 0.5)"',
      'const colorHsl = "hsl(210, 50%, 30%)"',
      'const colorToken = "brand.8"',
      'const border = `var(--mantine-color-brand-8)`',
      'const other = `var(--mantine-color-gray-3)`',
      'const bypass = `var(--crm-legacy-color-001)`',
      'const directBypass = `var(--crm-mantine-color-brand-7)`',
    ].join('\n')

    const findings = findViolationsByLine(fixturePath, syntheticSource)
    const kinds = new Set(findings.map((item: { kind: string }) => item.kind))

    expect(kinds.has('rawHex')).toBe(true)
    expect(kinds.has('rgb')).toBe(true)
    expect(kinds.has('hsl')).toBe(true)
    expect(kinds.has('mantineThemeValue')).toBe(true)
    expect(kinds.has('mantineCssVar')).toBe(true)
    expect(kinds.has('crmCompatibilityVar')).toBe(true)
    expect(findings.length).toBe(8)
  })

  test('classifies semantic tone bypass fixtures without enabling production-wide enforcement', () => {
    const fixturePath = 'src/test/semantic-tone-scanner.fixture.tsx'
    const syntheticSource = [
      '<Alert color="red">Ошибка</Alert>',
      'showAppNotification({ color: "yellow", title: "Внимание" })',
      'const decorative = <Badge color="brand">Акцент</Badge>',
      'const approved = getSemanticToneComponentProps("danger")',
    ].join('\n')

    const findings = findSemanticToneBypassesByLine(fixturePath, syntheticSource)

    expect(findings.map((finding: { match: string }) => finding.match)).toEqual([
      'red',
      'yellow',
    ])
  })

  test('requires zero disallowed color usage in frontend production source', async () => {
    const allowlist = await readAllowlist(allowlistPath)
    validateAllowlist(allowlist)

    const { unallowed } = await scanRawColors({ allowlistPath, srcRoot })

    if (unallowed.length > 0) {
      throw new Error(
        `Expected no disallowed color usage in frontend source, found ${unallowed.length}.`
          + `\nCounts => ${groupFindingsByKind(unallowed)}\n`
          + `Top violations:\n${formatFindings(unallowed)}`
      )
    }

    expect(unallowed.length).toBe(0)
  })
})
