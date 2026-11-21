// Run after installing the locked frontend dependencies. The output works via file://.
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'

const here = dirname(fileURLToPath(import.meta.url))
const frontend = resolve(here, '../../../frontend')
const requireFrontend = createRequire(resolve(frontend, 'package.json'))
const { build } = await import(pathToFileURL(requireFrontend.resolve('vite')).href)
const result = await build({
  configFile: false,
  root: frontend,
  publicDir: false,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  logLevel: 'error',
  resolve: { dedupe: Object.keys(requireFrontend('./package.json').dependencies) },
  build: {
    write: false,
    license: { fileName: 'licenses.txt' },
    assetsInlineLimit: 250000,
    cssCodeSplit: false,
    lib: { entry: resolve(here, 'prototype.tsx'), formats: ['iife'], name: 'ClientReview' },
  },
})
const output = result[0].output
const js = output.find(asset => asset.type === 'chunk').code.replace(/^[ \t]+$/gm, '').replaceAll('</script', '<\\/script')
const css = output.find(asset => asset.fileName.endsWith('.css')).source
const packageLicenses = output.find(asset => asset.fileName === 'licenses.txt').source
const fontLicense = await readFile(resolve(frontend, 'node_modules/@fontsource/onest/LICENSE'), 'utf8')
const licenses = JSON.stringify([packageLicenses, fontLicense]).replaceAll('<', '\\u003c')
const filename = resolve(process.argv[2] || resolve(here, 'prototype.html'))
const mobileEntry = process.argv.includes('--mobile')
await writeFile(filename, `<!doctype html><html lang="ru"${mobileEntry ? ' data-view="phone"' : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>TASK-018 · Карточка клиента</title><style>${css}</style></head><body><div id="root"></div><script type="application/json" id="licenses">${licenses}</script><script>${js}</script></body></html>`)
console.log(filename)
