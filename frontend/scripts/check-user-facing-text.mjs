#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { extname, relative, resolve } from 'node:path'
import ts from 'typescript'

const frontendRoot = resolve(process.cwd())
const repositoryRoot = resolve(frontendRoot, '..')

function fingerprint(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

function literalValue(node, sourceFile) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (node.kind === ts.SyntaxKind.JsxText) {
    return node.getText(sourceFile).replace(/\s+/g, ' ').trim()
  }
  if (ts.isTemplateExpression(node)) return node.getText(sourceFile)
  return null
}

function isLiteral(node) {
  return ts.isStringLiteral(node)
    || ts.isNoSubstitutionTemplateLiteral(node)
    || node.kind === ts.SyntaxKind.JsxText
    || ts.isTemplateExpression(node)
}

function isResourcePath(path) {
  return path === 'frontend/src/lib/resources.ts'
    || path.startsWith('frontend/src/resources/')
}

function isTestPath(path) {
  return path.includes('/test/')
    || path.includes('/__tests__/')
    || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)
}

function isMachineContract(node, value) {
  if (value.startsWith('/')) return true
  const parent = node.parent
  if (ts.isPropertyAssignment(parent)) {
    const name = parent.name.getText().replace(/^['"]|['"]$/g, '').toLowerCase()
    return ['code', 'route', 'path', 'callbackdata', 'command'].includes(name)
  }
  return false
}

function isTelemetry(node) {
  let current = node.parent
  while (current && !ts.isStatement(current)) {
    if (ts.isCallExpression(current) && /^(?:console|logger)\./.test(current.expression.getText())) {
      return true
    }
    current = current.parent
  }
  return false
}

async function walk(directory) {
  const files = []
  for (const entry of (await readdir(directory, { withFileTypes: true }))
    .sort((left, right) => left.name.localeCompare(right.name))) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', 'dist-catalog'].includes(entry.name)) files.push(...await walk(path))
    } else if (['.ts', '.tsx'].includes(extname(entry.name))) {
      files.push(path)
    }
  }
  return files
}

async function readEntries(path) {
  const document = JSON.parse(await readFile(path, 'utf8'))
  return document.entries ?? []
}

export async function scanUserFacingText({
  sourceRoot = resolve(frontendRoot, 'src'),
  exceptionsPath = resolve(
    repositoryRoot,
    'scripts/harness/config/user-facing-text-inventory-index/scanner-exceptions.json',
  ),
  allowlistPath = resolve(
    repositoryRoot,
    'scripts/harness/config/user-facing-text-allowlist.json',
  ),
  includeTests = false,
} = {}) {
  const exceptions = await readEntries(exceptionsPath)
  const allowlist = await readEntries(allowlistPath)
  const acceptedExceptions = new Map(exceptions
    .filter((entry) => entry.path.startsWith('frontend/'))
    .map((entry) => [`${entry.path}\0${entry.fingerprint}`, entry]))
  const acceptedAllowlist = new Map(allowlist
    .filter((entry) => entry.path.startsWith('frontend/'))
    .map((entry) => [`${entry.path}\0${entry.fingerprint}`, entry]))
  const seenExceptions = new Set()
  const seenAllowlist = new Set()
  const violations = []
  const isRepositorySource = resolve(sourceRoot) === resolve(frontendRoot, 'src')

  for (const file of await walk(sourceRoot)) {
    const path = (isRepositorySource
      ? relative(repositoryRoot, file)
      : `frontend/src/${relative(sourceRoot, file)}`
    ).replaceAll('\\', '/')
    if ((!includeTests && isTestPath(path)) || isResourcePath(path)) continue
    const source = await readFile(file, 'utf8')
    const sourceFile = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      extname(file) === '.tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )
    function visit(node) {
      if (isLiteral(node)) {
        const value = literalValue(node, sourceFile)
        if (/[А-Яа-яЁё]/u.test(value)) {
          const key = `${path}\0${fingerprint(value)}`
          const exception = acceptedExceptions.get(key)
          const allowlisted = acceptedAllowlist.get(key)
          if (exception) seenExceptions.add(key)
          else if (allowlisted) seenAllowlist.add(key)
          else if (!isMachineContract(node, value) && !isTelemetry(node)) {
            const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
            violations.push({ path, line: position.line + 1, value, fingerprint: fingerprint(value) })
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
  }

  const staleAllowlist = [...acceptedAllowlist]
    .filter(([key]) => !seenAllowlist.has(key))
    .map(([, entry]) => entry)
  return { violations, staleAllowlist, seenExceptions: seenExceptions.size }
}

async function main() {
  const result = await scanUserFacingText()
  if (result.violations.length || result.staleAllowlist.length) {
    for (const violation of result.violations) {
      process.stderr.write(`${violation.path}:${violation.line}: user-facing Cyrillic literal: ${violation.value}\n`)
    }
    for (const entry of result.staleAllowlist) {
      process.stderr.write(`${entry.path}: stale user-facing-text allowlist entry ${entry.fingerprint}\n`)
    }
    process.exitCode = 1
  } else {
    process.stdout.write(`Frontend user-facing literal guard passed; ${result.seenExceptions} classified fixtures.\n`)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(frontendRoot, 'scripts/check-user-facing-text.mjs')) {
  await main()
}
