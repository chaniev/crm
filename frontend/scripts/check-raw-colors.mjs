#!/usr/bin/env node

import { join } from 'node:path'
import { cwd, exit } from 'node:process'
import {
  formatFindings,
  groupFindingsByKind,
  scanRawColors,
} from './raw-color-scanner.mjs'

const projectRoot = cwd()
const srcRoot = join(projectRoot, 'src')
const allowlistPath = join(projectRoot, 'scripts', 'raw-color-allowlist.json')

try {
  const result = await scanRawColors({ allowlistPath, srcRoot })

  if (result.unallowed.length > 0) {
    console.error(
      `Expected no disallowed color usage in frontend source, found ${result.unallowed.length}.`
        + `\nCounts => ${groupFindingsByKind(result.unallowed)}\n`
        + `Top violations:\n${formatFindings(result.unallowed)}`,
    )
    exit(1)
  }

  console.log(
    `Raw color scanner passed: ${result.findings.length} total findings, ${result.unallowed.length} disallowed.`,
  )
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  exit(1)
}
