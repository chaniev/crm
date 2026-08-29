#!/usr/bin/env node

import { readFile, readdir } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'

const CATALOG_MARKER = 'gym-crm-design-system-catalog-entry'
const projectRoot = process.cwd()
const productionOutput = join(projectRoot, 'dist')

async function collectFiles(directory, accumulator = []) {
  const entries = await readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      await collectFiles(path, accumulator)
    } else if (entry.isFile()) {
      accumulator.push(path)
    }
  }

  return accumulator
}

const files = await collectFiles(productionOutput)
const forbiddenPaths = files
  .map((file) => relative(productionOutput, file))
  .filter((file) => file.toLowerCase().includes('catalog'))

if (forbiddenPaths.length > 0) {
  throw new Error(`Production output contains catalog paths: ${forbiddenPaths.join(', ')}`)
}

for (const file of files) {
  if (!['.html', '.js', '.css', '.map'].includes(extname(file))) {
    continue
  }

  const content = await readFile(file, 'utf8')
  if (content.includes(CATALOG_MARKER)) {
    throw new Error(
      `Production output contains catalog entry marker in ${relative(productionOutput, file)}.`,
    )
  }
}

console.log(`Production catalog exclusion passed: ${files.length} output files inspected.`)
