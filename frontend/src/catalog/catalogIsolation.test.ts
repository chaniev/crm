import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const readProjectFile = (path: string) => readFileSync(
  resolve(process.cwd(), path),
  'utf8',
)

describe('catalog build isolation', () => {
  test('uses a separate Vite entry and production-exclusion assertion', () => {
    const packageJson = JSON.parse(readProjectFile('package.json')) as {
      scripts: Record<string, string>
    }
    const productionHtml = readProjectFile('index.html')
    const productionEntry = readProjectFile('src/main.tsx')
    const catalogConfig = readProjectFile('vite.catalog.config.ts')

    expect(packageJson.scripts['catalog:dev']).toContain('vite.catalog.config.ts')
    expect(packageJson.scripts['catalog:build']).toContain('vite.catalog.config.ts')
    expect(packageJson.scripts.build).toContain('assert-production-excludes-catalog')
    expect(catalogConfig).toContain('catalog.html')
    expect(catalogConfig).toContain('dist-catalog')
    expect(productionHtml).not.toContain('catalog')
    expect(productionEntry).not.toContain('/catalog/')
  })
})
