// Only this offline bundle substitutes the row and the two audit read requests.
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from '../../../frontend/node_modules/vite/dist/node/index.js'

const here = dirname(fileURLToPath(import.meta.url))
const auditScreen = resolve(here, '../../../frontend/src/features/audit/AuditLogScreen.tsx')
const row = await readFile(resolve(here, 'row.tsx'), 'utf8')
const detailSummary = await readFile(resolve(here, 'detail-summary.tsx'), 'utf8')
const [result] = await build({
  configFile: false, root: resolve(here, '../../../frontend'), publicDir: false,
  resolve: { dedupe: ['react', 'react-dom', '@mantine/core', '@mantine/hooks', '@tabler/icons-react', '@fontsource/onest'] },
  plugins: [{
    name: 'offline-audit-row', enforce: 'pre',
    resolveId(id, importer) {
      if (importer === auditScreen && id === '../../lib/api') return resolve(here, 'fixtures.ts')
    },
    transform(source, id) {
      if (id !== auditScreen) return
      const start = source.indexOf('function AuditLogGridRow(')
      const end = source.indexOf('type AuditDetailsModalProps', start)
      if (start < 0 || end < start) throw Error('Check audit row boundaries')
      const screen = source.slice(0, start) + row + '\n' + source.slice(end)
      const modal = screen.indexOf('function AuditDetailsModal(')
      const summaryStart = screen.indexOf('<Stack gap="sm">', modal)
      const summaryEnd = screen.indexOf('</Stack>', summaryStart)
      if (modal < 0 || summaryStart < 0 || summaryEnd < 0) throw Error('Check audit detail summary boundary')
      const preview = screen.slice(0, summaryStart) + detailSummary.trim() + screen.slice(summaryEnd + '</Stack>'.length)
      return preview
        .replace('<div role="columnheader">{fe16AuditText.auditLogScreen_label_2a5c42af}</div>', '<div role="columnheader">Автор</div>')
        .replace('fe16AuditText.auditLogScreen_label_0ce02910(auditUser.fullName, auditUser.login)', 'auditUser.fullName')
    },
  }],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: { write: false, lib: { entry: resolve(here, 'preview.tsx'), name: 'AuditRowPreview', formats: ['iife'] },
    rolldownOptions: { onwarn(warning, warn) { if (warning.code !== 'MODULE_LEVEL_DIRECTIVE') warn(warning) } } },
})
const script = result.output.find(file => file.type === 'chunk').code.replace(/<\/script/gi, '<\\/script')
const css = result.output.find(file => file.fileName.endsWith('.css')).source
await writeFile(resolve(here, 'preview.html'), `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Журнал действий · TASK-208</title><style>${css}</style></head><body class="app-shell"><div id="root"></div><script>${script}</script></body></html>`)
