/// <reference types="node" />

import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { cwd } from 'node:process'
import { describe, expect, test } from 'vitest'
import {
  findSpacingViolationsByLine,
  formatSpacingFindings,
  readSpacingAllowlist,
  scanRawSpacing,
  validateSpacingAllowlist,
} from '../../scripts/raw-spacing-scanner.mjs'

const projectRoot = cwd()
const srcRoot = join(projectRoot, 'src')
const allowlistPath = join(projectRoot, 'scripts', 'raw-spacing-allowlist.json')

describe('TASK-159 raw spacing scanner', () => {
  test('flags an out-of-scale spacing fixture while accepting scale values and tokens', () => {
    const fixture = [
      '.valid { padding: 4px 8px 12px 16px; gap: var(--crm-space-3); }',
      '.invalid { margin: 13px; }',
      '.context-dependent { gap: 0.5em; }',
      '.unrelated { inset: 13px; width: 13px; }',
    ].join('\n')

    const findings = findSpacingViolationsByLine('src/test/raw-spacing.fixture.css', fixture)

    expect(findings).toHaveLength(2)
    expect(findings[0]).toMatchObject({
      property: 'margin',
      value: '13px',
    })
    expect(findings[1]).toMatchObject({ property: 'gap', value: '0.5em' })
  })

  test('requires exact, documented file/value allowlist entries', () => {
    expect(() => validateSpacingAllowlist([
      {
        path: 'src/App.css',
        declarations: [{ property: 'margin', value: '13px', occurrences: 1 }],
        reason: 'Preserves existing computed geometry.',
        owner: 'TASK-154',
        reviewOrRemoval: 'Review during the App.css module migration.',
      },
    ])).not.toThrow()

    expect(() => validateSpacingAllowlist([
      {
        path: 'src/**/*.css',
        declarations: [{ property: '*', value: '13px', occurrences: 1 }],
        reason: 'Too broad.',
        owner: 'frontend',
        reviewOrRemoval: 'Never.',
      },
    ])).toThrow(/exact/i)
  })

  test('returns a nonzero CLI exit for the committed violating fixture', () => {
    const result = spawnSync(process.execPath, [
      'scripts/check-raw-spacing.mjs',
      '--src-root',
      'src/test/fixtures/raw-spacing-scanner/violating',
      '--allowlist',
      'src/test/fixtures/raw-spacing-scanner/empty-allowlist.json',
    ], {
      cwd: projectRoot,
      encoding: 'utf8',
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('margin: 13px')
  })

  test('keeps production source within the scale or explicit legacy allowlist', async () => {
    const allowlist = await readSpacingAllowlist(allowlistPath)
    expect(() => validateSpacingAllowlist(allowlist)).not.toThrow()

    const { unallowed } = await scanRawSpacing({ allowlistPath, srcRoot })
    if (unallowed.length > 0) {
      throw new Error(`Unexpected raw spacing:\n${formatSpacingFindings(unallowed)}`)
    }

    expect(unallowed).toHaveLength(0)
  })
})
