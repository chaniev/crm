import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import path from 'node:path'

const artifactDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(artifactDir, '../../..')
const manifest = JSON.parse(
  await fs.readFile(path.join(artifactDir, 'manifest.json'), 'utf8'),
)
const screenshotsDir = path.join(artifactDir, 'screenshots')
const defaultDir = path.join(screenshotsDir, 'default-green-v1')
const alternateDir = path.join(screenshotsDir, 'test-blue-coral-v1')
const requireFromFrontend = createRequire(path.join(repoRoot, 'frontend/package.json'))
const { chromium, webkit } = requireFromFrontend('@playwright/test')

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const server = createServer(async (request, response) => {
  try {
    const requestedPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    const localPath = path.resolve(repoRoot, `.${requestedPath}`)

    if (!localPath.startsWith(`${repoRoot}${path.sep}`) && localPath !== repoRoot) {
      response.writeHead(403)
      response.end('Forbidden')
      return
    }

    const stats = await fs.stat(localPath)
    const filePath = stats.isDirectory() ? path.join(localPath, 'index.html') : localPath
    const body = await fs.readFile(filePath)
    response.writeHead(200, {
      'Content-Type': contentTypes[path.extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    response.end(body)
  } catch {
    response.writeHead(404)
    response.end('Not found')
  }
})

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const address = server.address()
const port = typeof address === 'object' && address ? address.port : 0
const baseUrl = `http://127.0.0.1:${port}/docs/ui-concept/task-090-iphone-17-pro-max`

await fs.rm(screenshotsDir, { recursive: true, force: true })
await fs.mkdir(defaultDir, { recursive: true })
await fs.mkdir(alternateDir, { recursive: true })

let browser
let browserName = 'webkit'

try {
  browser = await webkit.launch({ headless: true })
} catch (error) {
  browserName = 'chromium'
  browser = await chromium.launch({ headless: true })
  process.stderr.write(`WebKit unavailable, using Chromium: ${error.message}\n`)
}

const context = await browser.newContext({
  viewport: manifest.viewport,
  deviceScaleFactor: 1,
  hasTouch: true,
  isMobile: true,
  locale: 'ru-RU',
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 20_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/20.0 Mobile/15E148 Safari/604.1',
})
const page = await context.newPage()
const geometryByScreen = new Map()
const validationReport = {
  browser: browserName,
  viewport: manifest.viewport,
  screens: [],
  themeGeometry: [],
}

async function openScreen(screenId, themeId) {
  const url = `${baseUrl}/index.html?screen=${encodeURIComponent(screenId)}&theme=${encodeURIComponent(themeId)}`
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => document.body.dataset.ready === 'yes')
  await page.evaluate(() => document.fonts.ready)
}

async function collectGeometry() {
  return page.evaluate(() => {
    const result = {}
    for (const element of document.querySelectorAll('[data-geometry]')) {
      const rect = element.getBoundingClientRect()
      result[element.dataset.geometry] = {
        x: Number(rect.x.toFixed(2)),
        y: Number(rect.y.toFixed(2)),
        width: Number(rect.width.toFixed(2)),
        height: Number(rect.height.toFixed(2)),
      }
    }
    return result
  })
}

async function validateScreen(screenId, themeId) {
  return page.evaluate(({ screenId: currentScreen, themeId: currentTheme }) => {
    const errors = []
    const viewport = { width: window.innerWidth, height: window.innerHeight }
    const header = document.querySelector('.app-header')
    const main = document.querySelector('.screen-main')
    const nav = document.querySelector('.bottom-nav')

    if (viewport.width !== 440 || viewport.height !== 956) {
      errors.push(`viewport ${viewport.width}x${viewport.height}`)
    }

    if (document.documentElement.scrollWidth > 440) {
      errors.push(`horizontal overflow ${document.documentElement.scrollWidth}px`)
    }

    if (header && Math.abs(header.getBoundingClientRect().height - 72) > 0.5) {
      errors.push(`header height ${header.getBoundingClientRect().height}px`)
    }

    if (main) {
      const style = getComputedStyle(main)
      if (parseFloat(style.paddingTop) !== 88) {
        errors.push(`main padding-top ${style.paddingTop}`)
      }
      if (parseFloat(style.paddingLeft) !== 16 || parseFloat(style.paddingRight) !== 16) {
        errors.push(`main horizontal padding ${style.paddingLeft}/${style.paddingRight}`)
      }
    }

    if (nav && Math.abs(nav.getBoundingClientRect().height - 76) > 0.5) {
      errors.push(`bottom nav height ${nav.getBoundingClientRect().height}px`)
    }

    const smallTargets = []
    for (const element of document.querySelectorAll('button')) {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      if (rect.width < 43.5 || rect.height < 43.5) {
        smallTargets.push(
          `${element.textContent.trim().slice(0, 24) || element.getAttribute('aria-label') || element.className}:${rect.width.toFixed(1)}x${rect.height.toFixed(1)}`,
        )
      }
    }
    if (smallTargets.length) errors.push(`small targets: ${smallTargets.join(', ')}`)

    const smallInputs = []
    for (const element of document.querySelectorAll('.input-shell,.select-shell,.date-shell,.text-area')) {
      const size = parseFloat(getComputedStyle(element).fontSize)
      if (size < 16) smallInputs.push(`${element.className}:${size}`)
    }
    if (smallInputs.length) errors.push(`small input text: ${smallInputs.join(', ')}`)

    const h1 = document.querySelector('.page-header h1')
    if (h1 && parseFloat(getComputedStyle(h1).fontSize) !== 28) {
      errors.push(`page title ${getComputedStyle(h1).fontSize}`)
    }

    return {
      screenId: currentScreen,
      themeId: currentTheme,
      errors,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    }
  }, { screenId, themeId })
}

for (const screen of manifest.screens) {
  await openScreen(screen.id, 'default-green-v1')
  const result = await validateScreen(screen.id, 'default-green-v1')
  validationReport.screens.push(result)
  if (result.errors.length) {
    throw new Error(`${screen.id}: ${result.errors.join('; ')}`)
  }
  geometryByScreen.set(screen.id, await collectGeometry())
  await page.screenshot({
    path: path.join(defaultDir, `${screen.id}.png`),
    fullPage: false,
  })
  process.stdout.write(`default-green-v1  ${screen.id}\n`)
}

for (const screen of manifest.screens.filter((item) => item.alternateTheme)) {
  await openScreen(screen.id, 'test-blue-coral-v1')
  const result = await validateScreen(screen.id, 'test-blue-coral-v1')
  validationReport.screens.push(result)
  if (result.errors.length) {
    throw new Error(`${screen.id} alt: ${result.errors.join('; ')}`)
  }

  const defaultGeometry = geometryByScreen.get(screen.id)
  const alternateGeometry = await collectGeometry()
  const mismatches = []
  const keys = new Set([
    ...Object.keys(defaultGeometry ?? {}),
    ...Object.keys(alternateGeometry),
  ])

  for (const key of keys) {
    const before = defaultGeometry?.[key]
    const after = alternateGeometry[key]
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      mismatches.push({ key, before, after })
    }
  }

  validationReport.themeGeometry.push({
    screenId: screen.id,
    mismatches,
  })

  if (mismatches.length) {
    throw new Error(`${screen.id}: theme geometry changed: ${JSON.stringify(mismatches)}`)
  }

  await page.screenshot({
    path: path.join(alternateDir, `${screen.id}.png`),
    fullPage: false,
  })
  process.stdout.write(`test-blue-coral-v1 ${screen.id}\n`)
}

async function renderContactSheet({
  title,
  fileName,
  screens,
  themeId,
  columns = 5,
}) {
  await page.setViewportSize({ width: 1500, height: 900 })
  const cards = screens.map((screen) => {
    const imageUrl = `${baseUrl}/screenshots/${themeId}/${screen.id}.png`
    return `<article class="contact-card"><div class="contact-card__label">${screen.title}</div><img alt="${screen.title}" src="${imageUrl}"></article>`
  }).join('')
  await page.setContent(`
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="utf-8">
        <link rel="stylesheet" href="${baseUrl}/styles.css">
        <style>.contact-gallery__grid{grid-template-columns:repeat(${columns},1fr)}</style>
      </head>
      <body>
        <main class="contact-gallery">
          <h1>${title}</h1>
          <div class="contact-gallery__grid">${cards}</div>
        </main>
      </body>
    </html>
  `, { waitUntil: 'networkidle' })
  await page.waitForFunction(() =>
    [...document.images].every((image) => image.complete && image.naturalWidth > 0),
  )
  await page.screenshot({
    path: path.join(artifactDir, fileName),
    fullPage: true,
  })
}

await renderContactSheet({
  title: 'TASK-090 · iPhone 17 Pro Max · default-green-v1',
  fileName: 'contact-sheet-default.png',
  screens: manifest.screens,
  themeId: 'default-green-v1',
})

await renderContactSheet({
  title: 'TASK-090 · theme invariance · test-blue-coral-v1',
  fileName: 'contact-sheet-themes.png',
  screens: manifest.screens.filter((item) => item.alternateTheme),
  themeId: 'test-blue-coral-v1',
  columns: 4,
})

await fs.writeFile(
  path.join(artifactDir, 'validation-report.json'),
  `${JSON.stringify(validationReport, null, 2)}\n`,
)

await context.close()
await browser.close()
server.close()

process.stdout.write(
  `Rendered ${manifest.screens.length} default screens and ${manifest.screens.filter((item) => item.alternateTheme).length} alternate-theme screens with ${browserName}.\n`,
)
