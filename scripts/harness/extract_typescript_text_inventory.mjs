#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { basename, extname, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(process.argv[2] ?? '.')
const typescriptModule = process.env.TASK165_TYPESCRIPT_PATH
  ? resolve(process.env.TASK165_TYPESCRIPT_PATH)
  : resolve(root, 'frontend/node_modules/typescript/lib/typescript.js')
const ts = await import(pathToFileURL(typescriptModule).href)

const visibleNames = new Set([
  'alt', 'arialabel', 'caption', 'copy', 'description', 'emptydescription',
  'emptytitle', 'error', 'errormessage', 'errortitle', 'heading', 'hint',
  'label', 'message', 'placeholder', 'prompt', 'successmessage', 'successtitle',
  'text', 'title', 'tooltip', 'validation',
])

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', 'test', '__snapshots__'].includes(entry.name)) {
        files.push(...await walk(path))
      }
    } else if (['.ts', '.tsx'].includes(extname(entry.name)) && !entry.name.includes('.test.')) {
      files.push(path)
    }
  }
  return files
}

function normalizedName(value) {
  return value.replaceAll('-', '').replaceAll('_', '').toLowerCase()
}

function propertyName(node) {
  if (!node) return ''
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text
  return ''
}

function contextFor(node) {
  const parent = node.parent
  if (!parent) return { kind: 'unknown', name: '' }
  if (ts.isJsxAttribute(parent)) return { kind: 'jsx-attribute', name: propertyName(parent.name) }
  if (ts.isPropertyAssignment(parent)) return { kind: 'property', name: propertyName(parent.name) }
  if (ts.isVariableDeclaration(parent)) return { kind: 'variable', name: propertyName(parent.name) }
  if (ts.isCallExpression(parent)) return { kind: 'call-argument', name: parent.expression.getText() }
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) {
    return { kind: 'module-specifier', name: '' }
  }
  return { kind: ts.SyntaxKind[parent.kind] ?? 'unknown', name: '' }
}

function isVisibleContext(node, context) {
  if (node.kind === ts.SyntaxKind.JsxText) return true
  const name = normalizedName(context.name)
  return visibleNames.has(name)
    || [...visibleNames].some((candidate) => name.endsWith(candidate))
    || /set(?:form)?error|notifications?\.show|toast|alert/i.test(context.name)
}

function fingerprint(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

const findings = []
for (const file of await walk(resolve(root, 'frontend/src'))) {
  const source = await readFile(file, 'utf8')
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    extname(file) === '.tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  function visit(node) {
    const isLiteral = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
    const isJsxText = node.kind === ts.SyntaxKind.JsxText
    const isTemplate = ts.isTemplateExpression(node)
    if (isLiteral || isJsxText || isTemplate) {
      const sourceText = node.getText(sourceFile)
      const value = isLiteral
        ? node.text
        : isJsxText
          ? node.getText(sourceFile).replace(/\s+/g, ' ').trim()
          : sourceText
      const context = contextFor(node)
      const hasCyrillic = /[А-Яа-яЁё]/u.test(value)
      const resourceFile = relative(root, file).replaceAll('\\', '/') === 'frontend/src/lib/resources.ts'
      if (value && (hasCyrillic || resourceFile || isVisibleContext(node, context))) {
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
        findings.push({
          path: relative(root, file).replaceAll('\\', '/'),
          line: position.line + 1,
          language: 'typescript',
          literal_kind: isJsxText ? 'jsx-text' : isTemplate ? 'template' : 'string',
          source_text: sourceText,
          value,
          fingerprint: fingerprint(value),
          context,
          has_cyrillic: hasCyrillic,
        })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
}

process.stdout.write(`${JSON.stringify(findings)}\n`)
