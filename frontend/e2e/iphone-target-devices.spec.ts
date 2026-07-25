import { expect, test, type Page, type Route } from '@playwright/test'

const TARGET_SCREENS = {
  'iphone-air-webkit': { width: 420, height: 912 },
  'iphone-17-pro-max-webkit': { width: 440, height: 956 },
} as const

const APP_CONFIG = { clubName: 'Gym CRM' } as const

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
    allowedSections: ['Home', 'Clients', 'Groups', 'Users', 'Audit', 'Settings'],
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

test('target compact-height landscape keeps the authenticated shell usable', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)

  await page.setViewportSize({
    width: target.height,
    height: target.width,
  })
  await mockApi(page, HEAD_COACH_SESSION)
  await page.goto('/')

  const sideNavigation = page.getByRole('navigation', {
    name: 'Основная навигация',
  })

  await expect(page.getByTestId('home-screen')).toBeVisible()
  await expect(sideNavigation).toBeVisible()
  await expect(
    sideNavigation.getByRole('button', { name: 'Главная' }),
  ).toBeInViewport()
  await expect(
    page.getByRole('navigation', { name: 'Мобильная навигация' }),
  ).toBeHidden()
  await expect(page.getByRole('tab', { name: 'Посещения' })).toBeInViewport()
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
) {
  await page.route('**/api/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const { pathname } = requestUrl
    const method = route.request().method()

    if (pathname === '/api/config' && method === 'GET') {
      await fulfillJson(route, APP_CONFIG)
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
