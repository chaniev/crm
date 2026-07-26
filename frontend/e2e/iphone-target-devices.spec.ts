import { expect, test, type Page, type Route } from '@playwright/test'
import { readFileSync } from 'node:fs'

type IPhoneManifest = {
  viewports: {
    iphoneAir: { width: number; height: number }
    iphone17ProMax: { width: number; height: number }
  }
}

const TASK_090_MANIFEST = JSON.parse(
  readFileSync(
    new URL('../../docs/ui-concept/task-090-iphone-17-pro-max/manifest.json', import.meta.url),
    'utf8',
  ),
) as IPhoneManifest

const TARGET_SCREENS = {
  'iphone-air-webkit': {
    ...TASK_090_MANIFEST.viewports.iphoneAir,
  },
  'iphone-17-pro-max-webkit': {
    ...TASK_090_MANIFEST.viewports.iphone17ProMax,
  },
} as const

const MOBILE_BOTTOM_NAVIGATION_SELECTOR = 'nav.mobile-bottom-nav[aria-label="Мобильная навигация"]'
const SIDE_NAVIGATION_SELECTOR = 'nav.app-shell__side-nav[aria-label="Основная навигация"]'

type AppConfigFixture = {
  clubName: string
  themeId?: string
  authBackgroundImageId?: string
}

const APP_CONFIG = {
  clubName: 'Gym CRM',
  themeId: 'default-green-v1',
  authBackgroundImageId: 'k4pro-login-v1',
} as const

const UNAUTHENTICATED_SESSION = {
  isAuthenticated: false,
  csrfToken: '',
  user: null,
  bootstrapMode: false,
} as const

const HEAD_COACH_SESSION = {
  isAuthenticated: true,
  csrfToken: 'iphone-target-csrf-token',
  bootstrapMode: false,
  user: {
    id: 'iphone-target-headcoach',
    fullName: 'Главный тренер',
    login: 'headcoach',
    role: 'HeadCoach',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Home',
    allowedSections: ['Home', 'Schedule', 'Clients', 'Groups', 'Users', 'Audit', 'Settings'],
    permissions: {
      canManageUsers: true,
      canManageClients: true,
      canManageGroups: true,
      canManageSettings: true,
      canMarkAttendance: true,
      canViewAuditLog: true,
      canViewFinancialReports: true,
    },
    assignedGroupIds: [],
  },
} as const

test('target portrait keeps the login operation visible and touch-safe', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)

  await mockApi(page, UNAUTHENTICATED_SESSION)
  await page.goto('/')

  const login = page.getByLabel('Логин')
  const password = page.getByLabel('Пароль')
  const submit = page.getByRole('button', { name: 'Войти' })

  await expect(page.getByRole('heading', { name: 'Добро пожаловать!' })).toBeVisible()
  await expect(login).toBeInViewport()
  await expect(password).toBeInViewport()
  await expect(submit).toBeInViewport()

  const environment = await page.evaluate(() => ({
    devicePixelRatio: window.devicePixelRatio,
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    screenHeight: window.screen.height,
    screenWidth: window.screen.width,
    userAgent: navigator.userAgent,
  }))

  expect(testInfo.project.use.screen).toEqual(target)
  expect(testInfo.project.use.hasTouch).toBe(true)
  expect(environment.screenWidth).toBe(target.width)
  expect(environment.screenHeight).toBeLessThan(target.height)
  expect(environment.innerWidth).toBe(target.width)
  expect(environment.innerHeight).toBeLessThan(target.height)
  expect(environment.devicePixelRatio).toBe(3)
  expect(environment.userAgent).toContain('iPhone')
  expect(environment.userAgent).toContain('Mobile')

  for (const control of [login, password, submit]) {
    const box = await control.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }

  for (const field of [login, password]) {
    const fontSize = await field.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    )
    expect(fontSize).toBeGreaterThanOrEqual(16)
  }

  const loginBox = await login.boundingBox()
  expect(loginBox).not.toBeNull()
  await page.touchscreen.tap(
    loginBox!.x + loginBox!.width / 2,
    loginBox!.y + loginBox!.height / 2,
  )
  await expect(login).toBeFocused()

  await login.fill('headcoach')
  await password.fill('password')
  await expect(submit).toBeInViewport()
  await expectNoHorizontalScroll(page)
})

test('unknown auth-profile values are safely resolved on iPhone profiles', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)

  await page.setViewportSize(target)
  await mockApi(page, UNAUTHENTICATED_SESSION, {
    clubName: 'iPhone fallback profile',
    themeId: 'unknown-theme-v1',
    authBackgroundImageId: 'unknown-login-v1',
  })

  await page.goto('/')

  const authPage = page.locator('.gym-crm-page--auth')

  await expect(page.getByRole('heading', { name: 'Добро пожаловать!' })).toBeVisible()
  await expect(authPage).toBeVisible()
  await expect(authPage).toHaveClass(/gym-crm-page--auth-image/)

  const authBackgroundImage = await authPage.evaluate((element) =>
    getComputedStyle(element).getPropertyValue('--crm-auth-background-image'),
  )

  expect(authBackgroundImage).toContain('k4pro-login-bg.png')
  await expectNoHorizontalScroll(page)
})

test('empty auth-profile values are safely resolved on iPhone profiles', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)

  await page.setViewportSize(target)
  await mockApi(page, UNAUTHENTICATED_SESSION, {
    clubName: 'iPhone fallback profile',
    themeId: '',
    authBackgroundImageId: '',
  })

  await page.goto('/')

  const authPage = page.locator('.gym-crm-page--auth')

  await expect(page.getByRole('heading', { name: 'Добро пожаловать!' })).toBeVisible()
  await expect(authPage).toBeVisible()
  await expect(authPage).toHaveClass(/gym-crm-page--auth-image/)

  const authBackgroundImage = await authPage.evaluate((element) =>
    getComputedStyle(element).getPropertyValue('--crm-auth-background-image'),
  )

  expect(authBackgroundImage).toContain('k4pro-login-bg.png')
  await expectNoHorizontalScroll(page)
})

test('target compact-height landscape keeps the authenticated shell usable', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)
  const compactViewport = {
    width: target.height,
    height: target.width,
  }

  await page.setViewportSize(compactViewport)
  await mockApi(page, HEAD_COACH_SESSION)
  await page.goto('/')

  const sideNavigation = page.locator(SIDE_NAVIGATION_SELECTOR)
  const bottomNavigation = page.locator(MOBILE_BOTTOM_NAVIGATION_SELECTOR)
  const homeButton = bottomNavigation.getByRole('button', { name: 'Главная' })
  const homeScreen = page.getByTestId('home-screen')

  await expect(homeScreen).toBeVisible()
  await expect(sideNavigation).toBeHidden()
  await expect(bottomNavigation).toBeVisible()
  await expect(homeButton).toBeVisible()
  await expect(homeButton).toBeInViewport()

  const homeBounds = await homeScreen.boundingBox()
  const mobileNavBounds = await bottomNavigation.boundingBox()

  expect(homeBounds).not.toBeNull()
  expect(homeBounds!.y + homeBounds!.height).toBeGreaterThanOrEqual(0)
  expect(homeBounds!.y).toBeLessThanOrEqual(compactViewport.height - 1)
  expect(mobileNavBounds).not.toBeNull()
  expect(mobileNavBounds!.y + mobileNavBounds!.height).toBeLessThanOrEqual(
    compactViewport.height + 1,
  )
  await expectNoHorizontalScroll(page)
})

function targetScreenFor(projectName: string) {
  const target = TARGET_SCREENS[projectName as keyof typeof TARGET_SCREENS]

  if (!target) {
    throw new Error(`Unsupported target iPhone project: ${projectName}`)
  }

  return target
}

async function mockApi(
  page: Page,
  session: typeof UNAUTHENTICATED_SESSION | typeof HEAD_COACH_SESSION,
  appConfig: AppConfigFixture = APP_CONFIG,
) {
  await page.route('**/api/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const { pathname } = requestUrl
    const method = route.request().method()

    if (!pathname.startsWith('/api/')) {
      await route.continue()
      return
    }

    if (pathname === '/api/config' && method === 'GET') {
      await fulfillJson(route, appConfig)
      return
    }

    if (pathname === '/api/auth/session' && method === 'GET') {
      await fulfillJson(route, session)
      return
    }

    if (pathname === '/api/clients/attention' && method === 'GET') {
      await fulfillJson(route, [])
      return
    }

    if (pathname === '/api/attendance/groups' && method === 'GET') {
      await fulfillJson(route, {
        groups: [],
        today: '2026-07-25',
        maxTrainingDate: '2026-07-25',
      })
      return
    }

    throw new Error(`Unexpected target iPhone API request: ${method} ${pathname}`)
  })
}

async function fulfillJson(route: Route, payload: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(payload),
  })
}

async function expectNoHorizontalScroll(page: Page) {
  const dimensions = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }))

  expect(dimensions.documentScrollWidth).toBeLessThanOrEqual(
    dimensions.viewportWidth + 1,
  )
  expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(
    dimensions.viewportWidth + 1,
  )
}
