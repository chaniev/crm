// Build a portable, offline review file with the frontend's locked dependencies.
import { writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from '../../../frontend/node_modules/vite/dist/node/index.js'

const here = dirname(fileURLToPath(import.meta.url))
const frontend = resolve(here, '../../../frontend')
const [bundle] = await build({
  configFile: false, root: frontend, publicDir: false,
  resolve: { dedupe: ['react', 'react-dom', '@mantine/core', '@mantine/hooks', '@tabler/icons-react', '@fontsource/onest'] },
  plugins: [{
    name: 'attendance-prototype-fixtures',
    enforce: 'pre',
    resolveId(id, importer) {
      if (id === '../../lib/api' && /\/attendance\/(AttendanceScreen|AttendanceTodayWorklist)\.tsx$/.test(importer ?? '')) {
        return resolve(here, 'fixtures.ts')
      }
    },
  }],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    write: false, minify: true,
    rolldownOptions: { onwarn(warning, warn) {
      if (warning.code !== 'MODULE_LEVEL_DIRECTIVE') warn(warning)
    } },
    lib: { entry: resolve(here, 'prototype.tsx'), name: 'AttendancePrototype', formats: ['iife'] },
  },
})
const script = bundle.output.find(file => file.type === 'chunk').code.replace(/^[ \t]+$/gm, '')
const css = bundle.output.find(file => file.fileName.endsWith('.css')).source
const output = resolve(process.argv[2] ?? resolve(here, 'preview.html'))
await writeFile(output, `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>TASK-205 · Посещения</title><style>${css}</style></head>
<body><div id="root"></div><script>${script.replace(/<\/script/gi, '<\\/script')}</script></body></html>`)
console.log(output)
