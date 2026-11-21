import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from '../../../frontend/node_modules/vite/dist/node/index.js'

const here = dirname(fileURLToPath(import.meta.url))
const frontend = resolve(here, '../../../frontend')
const clients = resolve(frontend, 'src/features/clients')
function sliceAt(source, from, to) {
  const start = source.indexOf(from)
  const end = source.indexOf(to, start + from.length)
  if (start < 0 || end < 0) throw new Error('Проверьте границы прототипа: ' + from)
  return source.slice(start, end)
}
const [bundle] = await build({
  configFile: false, root: frontend, publicDir: false, logLevel: 'error',
  resolve: { dedupe: ['react','react-dom','@mantine/core','@mantine/hooks','@mantine/notifications','@tabler/icons-react','@fontsource/onest'] },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  plugins: [{
    name: 'offline-profile-layout', enforce: 'pre',
    transform(source, id) {
      if (id === resolve(clients, 'ClientOverviewSection.tsx')) {
        return source.replace(sliceAt(source, '<Group gap="sm" wrap="nowrap"', '{!canManage'), '')
      }
      if (id !== resolve(clients, 'ClientDetailScreen.tsx')) return
      const profile = sliceAt(source, '<ClientOverviewSection', '          {canManage ? (')
      const membership = sliceAt(source, '<ClientMembershipSection', '          ) : null}')
      const visits = sliceAt(source, '<ClientAttendanceHistorySection', '          <ClientNotesSection')
      const other = sliceAt(source, '<ClientNotesSection', '        </>')
      const all = sliceAt(source, '<ClientOverviewSection', '        </>')
      const backButton = sliceAt(source, '<Button\n        leftSection={<IconArrowLeft', '    </Group>')
      return 'import { ProfileTabs } from ' + JSON.stringify(resolve(here, 'ProfileTabs.tsx')) + '\n' +
        source.replace(backButton, '{!client && (' + backButton.trim() + ')}\n')
          .replace(all, '<ProfileTabs client={client} canManage={canManage} onBack={onBack} backLabel={backLabel} memberships={' +
            membership + '} attendance={' + visits + '}>\n' + profile + other + '</ProfileTabs>\n')
    },
  }],
  build: { write: false, license: {fileName: 'licenses.txt'},
    lib: {entry: resolve(here, 'preview.tsx'), formats: ['iife'], name: 'ClientTabsPreview'} },
})
const script = bundle.output.find(item => item.type === 'chunk').code.replace(/<\/script/gi, '<\\/script').replace(/^[ \t]+$/gm, '')
const css = bundle.output.find(item => item.fileName.endsWith('.css')).source
const licenses = [bundle.output.find(item => item.fileName === 'licenses.txt').source,
  await readFile(resolve(frontend, 'node_modules/@fontsource/onest/LICENSE'), 'utf8')]
await writeFile(resolve(here, 'preview.html'), '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Карточка клиента · TASK-019</title><style>' + css +
  '</style></head><body class="app-shell"><div id="root"></div><script type="application/json" id="licenses">' + JSON.stringify(licenses).replaceAll('<','\\u003c') + '</script><script>' + script + '</script></body></html>')
