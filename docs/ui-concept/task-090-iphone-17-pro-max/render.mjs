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
const iphoneAirDir = path.join(screenshotsDir, 'iphone-air', 'default-green-v1')
const desktopDir = path.join(screenshotsDir, 'desktop', 'default-green-v1')
const requireFromFrontend = createRequire(path.join(repoRoot, 'frontend/package.json'))
const { chromium, webkit } = requireFromFrontend('@playwright/test')

const viewports = {
  iphone17ProMax: manifest.viewports?.iphone17ProMax ?? manifest.viewport,
  iphoneAir: manifest.viewports?.iphoneAir ?? { width: 420, height: 912 },
  desktop: manifest.viewports?.desktop ?? { width: 1440, height: 1200 },
}

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
await Promise.all([
  fs.mkdir(defaultDir, { recursive: true }),
  fs.mkdir(alternateDir, { recursive: true }),
  fs.mkdir(iphoneAirDir, { recursive: true }),
  fs.mkdir(desktopDir, { recursive: true }),
])

let browser
let browserName = 'webkit'

try {
  browser = await webkit.launch({ headless: true })
} catch (error) {
  browserName = 'chromium'
  browser = await chromium.launch({ headless: true })
  process.stderr.write(`WebKit unavailable, using Chromium: ${error.message}\n`)
}

async function createContext(viewport, { mobile = false } = {}) {
  return browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    hasTouch: mobile,
    isMobile: mobile,
    locale: 'ru-RU',
    userAgent: mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 20_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/20.0 Mobile/15E148 Safari/604.1'
      : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/20.0 Safari/605.1.15',
  })
}

const mobileContext = await createContext(viewports.iphone17ProMax, { mobile: true })
const desktopContext = await createContext(viewports.desktop)
const mobilePage = await mobileContext.newPage()
const desktopPage = await desktopContext.newPage()
const geometryByScreen = new Map()
const validationReport = {
  browser: browserName,
  viewports,
  screens: [],
  responsiveScreens: [],
  themeGeometry: [],
}

async function openScreen(page, screenId, themeId) {
  const url = `${baseUrl}/index.html?screen=${encodeURIComponent(screenId)}&theme=${encodeURIComponent(themeId)}`
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => document.body.dataset.ready === 'yes')
  await page.evaluate(() => document.fonts.ready)
}

async function collectGeometry(page) {
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

function expectedActiveSection(screenId) {
  if (screenId.startsWith('auth-') || screenId === 'system-config-loading') return null
  if (screenId === 'system-restricted-route') return 'home'
  if (screenId.startsWith('system-error') || screenId.startsWith('system-empty')) return 'clients'
  if (screenId === 'system-notification-success') return 'clients'
  if (screenId === 'navigation-overflow') return 'finance'
  if (screenId.startsWith('home-')) return 'home'
  if (screenId.startsWith('schedule-')) return 'schedule'
  if (screenId.startsWith('clients-') || screenId.startsWith('client-')) return 'clients'
  if (screenId.startsWith('groups-') || screenId.startsWith('group-')) return 'groups'
  if (screenId.startsWith('users-') || screenId.startsWith('user-')) return 'users'
  if (screenId.startsWith('audit-')) return 'audit'
  if (screenId.startsWith('finance-')) return 'finance'
  if (screenId.startsWith('settings-')) return 'settings'
  return 'home'
}

async function validateScreen(
  page,
  screenId,
  themeId,
  expectedViewport,
  mode,
) {
  const activeSection = expectedActiveSection(screenId)
  return page.evaluate(({
    screenId: currentScreen,
    themeId: currentTheme,
    expectedViewport: expected,
    mode: currentMode,
    activeSection: expectedActive,
  }) => {
    const errors = []
    const viewport = { width: window.innerWidth, height: window.innerHeight }
    const header = document.querySelector('.app-header')
    const main = document.querySelector('.screen-main')
    const mobileNav = document.querySelector('.bottom-nav')
    const desktopNav = document.querySelector('.desktop-nav')
    const isDesktop = currentMode === 'desktop'
    const isCompact = !isDesktop && expected.height < 700

    if (viewport.width !== expected.width || viewport.height !== expected.height) {
      errors.push(`viewport ${viewport.width}x${viewport.height}`)
    }

    if (document.documentElement.scrollWidth > expected.width) {
      errors.push(`horizontal overflow ${document.documentElement.scrollWidth}px`)
    }

    if (header) {
      const expectedHeaderHeight = isDesktop ? 76 : isCompact ? 64 : 72
      if (Math.abs(header.getBoundingClientRect().height - expectedHeaderHeight) > 0.5) {
        errors.push(`header height ${header.getBoundingClientRect().height}px`)
      }
    }

    if (main) {
      const style = getComputedStyle(main)
      const expectedTop = isDesktop ? 104 : isCompact ? 80 : 88
      const expectedHorizontal = isDesktop ? 32 : 16
      if (parseFloat(style.paddingTop) !== expectedTop) {
        errors.push(`main padding-top ${style.paddingTop}`)
      }
      if (
        parseFloat(style.paddingLeft) !== expectedHorizontal
        || parseFloat(style.paddingRight) !== expectedHorizontal
      ) {
        errors.push(`main horizontal padding ${style.paddingLeft}/${style.paddingRight}`)
      }
      if (isDesktop && Math.abs(main.getBoundingClientRect().x - 232) > 0.5) {
        errors.push(`desktop main offset ${main.getBoundingClientRect().x}px`)
      }
    }

    if (expectedActive) {
      if (document.querySelector('.screen-root')?.dataset.activeSection !== expectedActive) {
        errors.push(`screen active section is not ${expectedActive}`)
      }

      if (isDesktop) {
        if (!desktopNav || getComputedStyle(desktopNav).display === 'none') {
          errors.push('desktop sidebar missing')
        }
        if (mobileNav && getComputedStyle(mobileNav).display !== 'none') {
          errors.push('mobile nav visible on desktop')
        }
        const currentItems = desktopNav
          ? [...desktopNav.querySelectorAll('[aria-current="page"]')]
          : []
        if (
          currentItems.length !== 1
          || currentItems[0]?.dataset.navId !== expectedActive
        ) {
          errors.push(`desktop active nav is not ${expectedActive}`)
        }
      } else {
        if (!mobileNav || getComputedStyle(mobileNav).display === 'none') {
          errors.push('mobile nav missing')
        } else {
          if (Math.abs(mobileNav.getBoundingClientRect().height - 76) > 0.5) {
            errors.push(`bottom nav height ${mobileNav.getBoundingClientRect().height}px`)
          }
          const items = [...mobileNav.querySelectorAll('.nav-item')]
          if (items.length !== 5) errors.push(`mobile nav item count ${items.length}`)
          if (items[4]?.dataset.navId !== 'more') errors.push('More is not stable fifth slot')
          if (items[4]?.hasAttribute('aria-current')) errors.push('More became current')
          const currentItems = items.filter((item) => item.hasAttribute('aria-current'))
          if (
            currentItems.length !== 1
            || currentItems[0]?.dataset.navId !== expectedActive
          ) {
            errors.push(`mobile active nav is not ${expectedActive}`)
          }
          if (
            ['users', 'audit', 'finance', 'settings'].includes(expectedActive)
            && items[3]?.dataset.navId !== expectedActive
          ) {
            errors.push(`dynamic slot four is not ${expectedActive}`)
          }
        }
        if (desktopNav && getComputedStyle(desktopNav).display !== 'none') {
          errors.push('desktop sidebar visible on mobile')
        }
      }
    } else if (mobileNav || desktopNav) {
      errors.push('application navigation rendered on auth/bootstrap screen')
    }

    const smallTargets = []
    for (const element of document.querySelectorAll('button')) {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      if (
        !element.getClientRects().length
        || style.display === 'none'
        || style.visibility === 'hidden'
      ) continue
      if (rect.width < 43.5 || rect.height < 43.5) {
        smallTargets.push(
          `${element.textContent.trim().slice(0, 24) || element.getAttribute('aria-label') || element.className}:${rect.width.toFixed(1)}x${rect.height.toFixed(1)}`,
        )
      }
    }
    if (smallTargets.length) errors.push(`small targets: ${smallTargets.join(', ')}`)

    const smallInputs = []
    for (const element of document.querySelectorAll('.input-shell,.select-shell,.date-shell,.text-area')) {
      if (!element.getClientRects().length) continue
      const size = parseFloat(getComputedStyle(element).fontSize)
      if (size < 16) smallInputs.push(`${element.className}:${size}`)
    }
    if (smallInputs.length) errors.push(`small input text: ${smallInputs.join(', ')}`)

    const unnamedIconButtons = [...document.querySelectorAll('button')].filter((element) =>
      element.getClientRects().length
      && !element.textContent.trim()
      && !element.getAttribute('aria-label')?.trim(),
    )
    if (unnamedIconButtons.length) {
      errors.push(`unnamed icon buttons: ${unnamedIconButtons.length}`)
    }

    const visiblePageTitle = document.querySelector('.page-header h1')
    if (visiblePageTitle && parseFloat(getComputedStyle(visiblePageTitle).fontSize) !== 28) {
      errors.push(`page title ${getComputedStyle(visiblePageTitle).fontSize}`)
    }

    const routeHeaderCopy = document.querySelector(
      '.page-header p, .page-header__meta, .page-header__eyebrow, .page-header .badge',
    )
    if (routeHeaderCopy) {
      errors.push(`route header copy: ${routeHeaderCopy.textContent.trim().slice(0, 48)}`)
    }

    const forbiddenCopy = [
      'Обязательное действие',
      'Управление и история',
      'Рабочие разделы',
      'Справочники клуба',
      'Структура клуба',
      'Команда и доступ',
      'Рабочая CRM клуба',
      'Первый вход',
    ]
    const visibleText = document.body.innerText
    const foundForbiddenCopy = forbiddenCopy.filter((copy) => visibleText.includes(copy))
    if (foundForbiddenCopy.length) {
      errors.push(`forbidden explanatory copy: ${foundForbiddenCopy.join(', ')}`)
    }

    const visibleSearchLabels = [
      ...document.querySelectorAll('.locator--search .persistent-label:not(.sr-only)'),
    ].filter((element) => element.getClientRects().length)
    if (visibleSearchLabels.length) {
      errors.push(
        `visible primary search labels: ${visibleSearchLabels.map((element) => element.textContent.trim()).join(', ')}`,
      )
    }

    const unnamedSearchboxes = [
      ...document.querySelectorAll('.locator--search [role="searchbox"]'),
    ].filter((element) => !element.getAttribute('aria-label')?.trim())
    if (unnamedSearchboxes.length) {
      errors.push(`unnamed primary searchboxes: ${unnamedSearchboxes.length}`)
    }

    const hiddenRouteTitleScreens = new Set([
      'system-error-state',
      'system-empty-first-run',
      'system-empty-filtered',
      'navigation-overflow',
      'home-attendance-ready',
      'home-attendance-all-marked',
      'home-attention-ready',
      'schedule-ready',
      'schedule-filter-surface',
      'clients-browse',
      'clients-search-focused',
      'groups-list',
      'users-list',
      'audit-list',
      'audit-details-modal',
      'finance-report',
      'finance-zero-report',
      'settings-catalog',
      'settings-group-types',
      'settings-branches',
      'settings-admins',
      'settings-modal-form',
      'settings-delete-confirm',
    ])
    if (hiddenRouteTitleScreens.has(currentScreen)) {
      const semanticHeading = document.querySelector('h1')
      if (!semanticHeading?.classList.contains('sr-only')) {
        errors.push('duplicate visible route title')
      }
      if (document.querySelector('.page-header')) {
        errors.push('page header wrapper retained for hidden route title')
      }
    }

    const requiredLocatorActions = {
      'clients-browse': 2,
      'groups-list': 2,
      'schedule-ready': 1,
      'users-list': 2,
      'audit-list': 1,
      'finance-report': 1,
      'finance-zero-report': 1,
    }
    const requiredActionCount = requiredLocatorActions[currentScreen]
    if (
      requiredActionCount
      && document.querySelectorAll('.locator__actions button').length !== requiredActionCount
    ) {
      errors.push(`locator actions missing: expected ${requiredActionCount}`)
    }

    if (currentScreen === 'groups-list' && document.querySelector('.metrics')) {
      errors.push('groups list retains summary widgets')
    }

    if (currentScreen === 'navigation-overflow' && !isDesktop) {
      const drawerLabels = [...document.querySelectorAll('.overflow-item__label')]
        .map((element) => element.textContent.trim())
      const expectedLabels = ['Группы', 'Тренеры', 'Журнал', 'Настройки']
      if (JSON.stringify(drawerLabels) !== JSON.stringify(expectedLabels)) {
        errors.push(`overflow drawer order ${drawerLabels.join(', ')}`)
      }
    }

    if (
      ['auth-login', 'auth-password-change', 'system-config-loading'].includes(currentScreen)
    ) {
      const stage = document.querySelector('.auth-screen,.bootstrap-screen')
      if (!getComputedStyle(stage).backgroundImage.includes('k4pro-login-bg.png')) {
        errors.push('auth background image missing')
      }
    }

    return {
      screenId: currentScreen,
      themeId: currentTheme,
      mode: currentMode,
      viewport,
      errors,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
    }
  }, {
    screenId,
    themeId,
    expectedViewport,
    mode,
    activeSection,
  })
}

async function renderSet({
  page,
  viewport,
  outputDir,
  themeId,
  mode,
  screens,
  label,
  captureGeometry = false,
}) {
  await page.setViewportSize(viewport)
  for (const screen of screens) {
    await openScreen(page, screen.id, themeId)
    const result = await validateScreen(
      page,
      screen.id,
      themeId,
      viewport,
      mode,
    )
    validationReport.screens.push({ target: label, ...result })
    if (result.errors.length) {
      throw new Error(
        `${screen.id} ${label}: ${result.errors.join('; ')}`,
      )
    }
    if (captureGeometry) {
      geometryByScreen.set(screen.id, await collectGeometry(page))
    }
    await page.screenshot({
      path: path.join(outputDir, `${screen.id}.png`),
      fullPage: false,
    })
    process.stdout.write(`${label.padEnd(23)} ${screen.id}\n`)
  }
}

await renderSet({
  page: mobilePage,
  viewport: viewports.iphone17ProMax,
  outputDir: defaultDir,
  themeId: 'default-green-v1',
  mode: 'mobile',
  screens: manifest.screens,
  label: 'iphone17ProMax',
  captureGeometry: true,
})

await renderSet({
  page: mobilePage,
  viewport: viewports.iphoneAir,
  outputDir: iphoneAirDir,
  themeId: 'default-green-v1',
  mode: 'mobile',
  screens: manifest.screens,
  label: 'iphoneAir',
})

await renderSet({
  page: desktopPage,
  viewport: viewports.desktop,
  outputDir: desktopDir,
  themeId: 'default-green-v1',
  mode: 'desktop',
  screens: manifest.screens,
  label: 'desktop',
})

await mobilePage.setViewportSize(viewports.iphone17ProMax)
for (const screen of manifest.screens.filter((item) => item.alternateTheme)) {
  await openScreen(mobilePage, screen.id, 'test-blue-coral-v1')
  const result = await validateScreen(
    mobilePage,
    screen.id,
    'test-blue-coral-v1',
    viewports.iphone17ProMax,
    'mobile',
  )
  validationReport.screens.push({ target: 'theme-invariance', ...result })
  if (result.errors.length) {
    throw new Error(`${screen.id} alternate theme: ${result.errors.join('; ')}`)
  }

  const defaultGeometry = geometryByScreen.get(screen.id)
  const alternateGeometry = await collectGeometry(mobilePage)
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

  validationReport.themeGeometry.push({ screenId: screen.id, mismatches })
  if (mismatches.length) {
    throw new Error(`${screen.id}: theme geometry changed: ${JSON.stringify(mismatches)}`)
  }

  await mobilePage.screenshot({
    path: path.join(alternateDir, `${screen.id}.png`),
    fullPage: false,
  })
  process.stdout.write(`theme-invariance        ${screen.id}\n`)
}

for (const responsiveViewport of [
  { width: 360, height: 780 },
  { width: 390, height: 844 },
  { width: 912, height: 420 },
  { width: 956, height: 440 },
]) {
  await mobilePage.setViewportSize(responsiveViewport)
  for (const screen of manifest.screens) {
    await openScreen(mobilePage, screen.id, 'default-green-v1')
    const result = await validateScreen(
      mobilePage,
      screen.id,
      'default-green-v1',
      responsiveViewport,
      'mobile',
    )
    validationReport.responsiveScreens.push(result)
    if (result.errors.length) {
      throw new Error(
        `${screen.id} ${responsiveViewport.width}x${responsiveViewport.height}: ${result.errors.join('; ')}`,
      )
    }
  }
  process.stdout.write(
    `responsive ${responsiveViewport.width}x${responsiveViewport.height}: ${manifest.screens.length} screens\n`,
  )
}

async function renderContactSheet({
  title,
  fileName,
  screens,
  sourcePath,
  columns = 5,
  width = 1500,
}) {
  await desktopPage.setViewportSize({ width, height: 900 })
  const cards = screens.map((screen) => {
    const imageUrl = `${baseUrl}/${sourcePath}/${screen.id}.png`
    return `<article class="contact-card"><div class="contact-card__label">${screen.title}</div><img alt="${screen.title}" src="${imageUrl}"></article>`
  }).join('')
  await desktopPage.setContent(`
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="utf-8">
        <link rel="stylesheet" href="${baseUrl}/styles.css">
        <style>
          .contact-gallery{width:${width}px}
          .contact-gallery__grid{grid-template-columns:repeat(${columns},minmax(0,1fr))}
        </style>
      </head>
      <body>
        <main class="contact-gallery">
          <h1>${title}</h1>
          <div class="contact-gallery__grid">${cards}</div>
        </main>
      </body>
    </html>
  `, { waitUntil: 'networkidle' })
  await desktopPage.waitForFunction(() =>
    [...document.images].every((image) => image.complete && image.naturalWidth > 0),
  )
  await desktopPage.screenshot({
    path: path.join(artifactDir, fileName),
    fullPage: true,
  })
}

await renderContactSheet({
  title: 'TASK-090 · iPhone 17 Pro Max · 440 × 956',
  fileName: 'contact-sheet-default.png',
  screens: manifest.screens,
  sourcePath: 'screenshots/default-green-v1',
})

await renderContactSheet({
  title: 'TASK-090 · iPhone Air · 420 × 912',
  fileName: 'contact-sheet-iphone-air.png',
  screens: manifest.screens,
  sourcePath: 'screenshots/iphone-air/default-green-v1',
})

await renderContactSheet({
  title: 'TASK-090 · Desktop · 1440 × 1200',
  fileName: 'contact-sheet-desktop.png',
  screens: manifest.screens,
  sourcePath: 'screenshots/desktop/default-green-v1',
  columns: 2,
})

await renderContactSheet({
  title: 'TASK-090 · Theme invariance · iPhone 17 Pro Max',
  fileName: 'contact-sheet-themes.png',
  screens: manifest.screens.filter((item) => item.alternateTheme),
  sourcePath: 'screenshots/test-blue-coral-v1',
  columns: 4,
})

const legacyDesktopMockups = {
  'home.png': 'home-attention-ready',
  'attendance.png': 'home-attendance-ready',
  'clients.png': 'clients-browse',
  'groups.png': 'groups-list',
  'users.png': 'users-list',
  'audit.png': 'audit-list',
}
const legacyMockupsDir = path.join(artifactDir, '..', 'mockups')
await fs.mkdir(legacyMockupsDir, { recursive: true })
for (const [fileName, screenId] of Object.entries(legacyDesktopMockups)) {
  await fs.copyFile(
    path.join(desktopDir, `${screenId}.png`),
    path.join(legacyMockupsDir, fileName),
  )
}
await fs.copyFile(
  path.join(artifactDir, 'contact-sheet-desktop.png'),
  path.join(legacyMockupsDir, '00-full-concept.png'),
)

await fs.writeFile(
  path.join(artifactDir, 'validation-report.json'),
  `${JSON.stringify(validationReport, null, 2)}\n`,
)

await mobileContext.close()
await desktopContext.close()
await browser.close()
server.close()

process.stdout.write(
  `Rendered ${manifest.screens.length} screens for three target viewports and ${manifest.screens.filter((item) => item.alternateTheme).length} alternate-theme screens with ${browserName}.\n`,
)
