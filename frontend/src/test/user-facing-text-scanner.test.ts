import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, test } from 'vitest'

type ScanResult = {
  violations: Array<{ path: string; value: string }>
  staleAllowlist: Array<{ fingerprint: string }>
}

const scannerModule = await import(
  pathToFileURL(join(process.cwd(), 'scripts/check-user-facing-text.mjs')).href
) as {
  scanUserFacingText(options: {
    sourceRoot: string
    exceptionsPath: string
    allowlistPath: string
    includeTests: boolean
  }): Promise<ScanResult>
}

async function fixture(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), 'task165-frontend-scanner-'))
  const sourceRoot = join(root, 'frontend/src')
  await mkdir(sourceRoot, { recursive: true })
  for (const [path, contents] of Object.entries(files)) {
    const absolute = join(root, path)
    await mkdir(dirname(absolute), { recursive: true })
    await writeFile(absolute, contents)
  }
  const exceptionsPath = join(root, 'exceptions.json')
  const allowlistPath = join(root, 'allowlist.json')
  await writeFile(exceptionsPath, '{"entries":[]}')
  await writeFile(allowlistPath, '{"entries":[]}')
  return { sourceRoot, exceptionsPath, allowlistPath }
}

describe('TASK-165 frontend literal scanner', () => {
  test('rejects visible JSX while accepting route, telemetry and resource literals', async () => {
    const paths = await fixture({
      'frontend/src/visible.tsx': 'export const view = <button>Сохранить</button>',
      'frontend/src/contracts.ts': [
        "export const route = '/клиенты'",
        "console.warn('Диагностика соединения')",
      ].join('\n'),
      'frontend/src/resources/example.ts': "export const text = 'Ресурс'",
    })
    const result = await scannerModule.scanUserFacingText({ ...paths, includeTests: true })
    expect(result.violations.map((entry) => entry.value)).toEqual(['Сохранить'])
  })

  test('reports a stale exact allowlist fingerprint', async () => {
    const paths = await fixture({ 'frontend/src/clean.ts': "export const code = 'clean'" })
    await writeFile(paths.allowlistPath, JSON.stringify({ entries: [{
      path: 'frontend/src/clean.ts',
      fingerprint: 'sha256:missing',
      category: 'machine contract',
      reason: 'fixture',
      owner_task: 'TASK-165',
    }] }))
    const result = await scannerModule.scanUserFacingText({ ...paths, includeTests: true })
    expect(result.staleAllowlist).toHaveLength(1)
  })
})
