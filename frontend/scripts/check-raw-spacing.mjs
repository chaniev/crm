#!/usr/bin/env node

import { resolve } from 'node:path'
import { argv, cwd, exit } from 'node:process'
import { formatSpacingFindings, scanRawSpacing } from './raw-spacing-scanner.mjs'

function readOption(name, fallback) {
  const index = argv.indexOf(name)
  return index === -1 ? fallback : argv[index + 1]
}

const projectRoot = cwd()
const srcRoot = resolve(projectRoot, readOption('--src-root', 'src'))
const allowlistPath = resolve(projectRoot, readOption('--allowlist', 'scripts/raw-spacing-allowlist.json'))

try {
  const result = await scanRawSpacing({ allowlistPath, srcRoot })
  if (result.unallowed.length > 0) {
    console.error(
      `Expected no disallowed raw spacing in frontend source, found ${result.unallowed.length}.`
        + `\nTop violations:\n${formatSpacingFindings(result.unallowed)}`,
    )
    exit(1)
  }

  console.log(`Raw spacing scanner passed: ${result.findings.length} legacy findings, 0 disallowed.`)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  exit(1)
}
