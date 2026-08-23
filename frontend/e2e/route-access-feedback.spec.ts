import { expect, test, type Page, type Route } from '@playwright/test'

const APP_CONFIG = {
  clubName: 'Gym CRM',
  themeId: 'default-green-v1',
  authBackgroundImageId: 'k4pro-login-v1',
} as const

const HEAD_COACH_SESSION = {
  isAuthenticated: true,
  csrfToken: 'headcoach-csrf-token',
  bootstrapMode: false,
  user: {
    id: 'headcoach-id',
    fullName: 'Главный тренер',
    login: 'headcoach',
    role: 'HeadCoach',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Home',
    allowedSections: ['Home', 'Schedule', 'Clients', 'Groups', 'Users', 'Audit', 'Finance', 'Settings'],
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

const COACH_SESSION = {
  ...HEAD_COACH_SESSION,
  csrfToken: 'coach-csrf-token',
  user: {
    ...HEAD_COACH_SESSION.user,
    id: 'coach-id',
    fullName: 'Тренер группы',
    login: 'coach',
    role: 'Coach',
    allowedSections: ['Home', 'Schedule', 'Clients'],
    permissions: {
      canManageUsers: false,
      canManageClients: false,
      canManageGroups: false,
      canManageSettings: false,
      canMarkAttendance: true,
      canViewAuditLog: false,
      canViewFinancialReports: false,
    },
  },
} as const

const SUPER_ADMIN_NO_FINANCE_SESSION = {
  ...HEAD_COACH_SESSION,
  csrfToken: 'superadmin-csrf-token',
  user: {
    ...HEAD_COACH_SESSION.user,
    id: 'superadmin-id',
    fullName: 'Суперадминистратор',
    login: 'superadmin',
    role: 'SuperAdministrator',
    allowedSections: ['Home', 'Schedule', 'Clients', 'Groups', 'Users', 'Audit', 'Settings'],
    permissions: {
      ...HEAD_COACH_SESSION.user.permissions,
      canViewFinancialReports: false,
    },
    createRoleOptions: ['Administrator', 'Coach'],
  },
} as const

const CLIENTS_RESPONSE = {
  items: [],
  totalCount: 0,
  activeCount: 0,
  archivedCount: 0,
  skip: 0,
  take: 20,
  page: 1,
  pageSize: 20,
  hasNextPage: false,
} as const

test.describe('route access feedback', () => {
  test('Coach direct /groups renders restricted inline state without silent redirect', async ({
    page,
  }) => {
    await mockApi(page, COACH_SESSION)

    await page.goto('/groups')

    await expect(page).toHaveURL(/\/groups$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Нет доступа' })).toBeVisible()
    await expect(page.getByText('У вас нет доступа к разделу «Группы».')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Открыть Главная' })).toBeVisible()
    await expect(page.getByTestId('groups-screen')).toHaveCount(0)
    await expect(
      page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('button', {
        name: 'Группы',
      }),
    ).toHaveCount(0)
  })

  test('Coach direct /audit is denied before audit APIs are requested', async ({ page }) => {
    const auditApiRequests: string[] = []
    await page.setViewportSize({ width: 390, height: 844 })
    page.on('request', (request) => {
      const pathname = new URL(request.url()).pathname
      if (pathname === '/api/audit-logs' || pathname === '/api/audit-logs/options') {
        auditApiRequests.push(pathname)
      }
    })
    await mockApi(page, COACH_SESSION)

    await page.goto('/audit')

    await expect(page).toHaveURL(/\/audit$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Нет доступа' })).toBeFocused()
    await expect(page.getByText('У вас нет доступа к разделу «Журнал».')).toBeVisible()
    await expect(page.getByTestId('audit-screen')).toHaveCount(0)
    expect(auditApiRequests).toEqual([])
  })

  test('Coach direct /clients/new recovers to the readable Clients parent', async ({
    page,
  }) => {
    await mockApi(page, COACH_SESSION)

    await page.goto('/clients/new')

    await expect(page).toHaveURL(/\/clients\/new$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Нет доступа' })).toBeFocused()
    await expect(page.getByText('У вас нет доступа к операции «Новый клиент».')).toBeVisible()

    await page.getByRole('button', { name: 'Открыть Клиенты' }).click()

    await expect(page).toHaveURL(/\/clients$/)
    await expect(page.getByTestId('clients-screen')).toBeVisible()
  })

  test('SuperAdministrator direct /finance is restricted while Finance navigation is absent', async ({
    page,
  }) => {
    await mockApi(page, SUPER_ADMIN_NO_FINANCE_SESSION)

    await page.goto('/finance')

    await expect(page).toHaveURL(/\/finance$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Нет доступа' })).toBeVisible()
    await expect(page.getByText('У вас нет доступа к разделу «Финансы».')).toBeVisible()
    await expect(page.getByTestId('finance-screen')).toHaveCount(0)
    await expect(
      page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('button', {
        name: 'Финансы',
      }),
    ).toHaveCount(0)
  })

  for (const unknownPath of ['/attendance', '/missing-route']) {
    test(`${unknownPath} renders not-found without exposing raw path text`, async ({
      page,
    }) => {
      await mockApi(page, HEAD_COACH_SESSION)

      await page.goto(unknownPath)

      await expect(page).toHaveURL(new RegExp(`${unknownPath}$`))
      await expect(
        page.getByRole('heading', { level: 1, name: 'Страница не найдена' }),
      ).toBeFocused()
      await expect(page.getByText('Такой страницы нет или ссылка устарела.')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Открыть Главная' })).toBeVisible()
      await expect(page.getByText(new RegExp(unknownPath.slice(1), 'i'))).toHaveCount(0)
    })
  }

  test('back and forward do not create redirect loops or replay recovery', async ({
    page,
  }) => {
    await mockApi(page, COACH_SESSION)

    await page.goto('/clients')
    await expect(page.getByTestId('clients-screen')).toBeVisible()

    await page.evaluate(() => {
      window.history.pushState({}, '', '/clients/new')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    await expect(page).toHaveURL(/\/clients\/new$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Нет доступа' })).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)

    await page.goBack()
    await expect(page).toHaveURL(/\/clients$/)
    await expect(page.getByTestId('clients-screen')).toBeVisible()

    await page.goForward()
    await expect(page).toHaveURL(/\/clients\/new$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Нет доступа' })).toBeVisible()
    await expect(page.getByRole('status')).toHaveCount(0)
  })

  for (const viewport of [
    { width: 360, height: 780 },
    { width: 390, height: 844 },
    { width: 420, height: 912 },
    { width: 440, height: 956 },
    { width: 768, height: 1024 },
    { width: 1440, height: 1200 },
    { width: 912, height: 420 },
    { width: 956, height: 440 },
  ]) {
    test(`restricted state has no horizontal overflow at ${viewport.width} x ${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await mockApi(page, COACH_SESSION)

      await page.goto('/clients/new')

      const heading = page.getByRole('heading', { level: 1, name: 'Нет доступа' })
      const recovery = page.getByRole('button', { name: 'Открыть Клиенты' })

      await expect(heading).toBeVisible()
      await expect(recovery).toBeVisible()
      await expectNoHorizontalScroll(page)

      const recoveryBox = await recovery.boundingBox()
      expect(recoveryBox).not.toBeNull()
      expect(recoveryBox!.height).toBeGreaterThanOrEqual(44)
    })
  }
})

async function mockApi(
  page: Page,
  session: typeof HEAD_COACH_SESSION | typeof COACH_SESSION | typeof SUPER_ADMIN_NO_FINANCE_SESSION,
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
      await fulfillJson(route, APP_CONFIG)
      return
    }

    if (pathname === '/api/auth/session' && method === 'GET') {
      await fulfillJson(route, session)
      return
    }

    if (pathname === '/api/clients' && method === 'GET') {
      await fulfillJson(route, CLIENTS_RESPONSE)
      return
    }

    if (pathname === '/api/groups' && method === 'GET') {
      await fulfillJson(route, { items: [], totalCount: 0 })
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

    if (pathname === '/api/clients/attention' && method === 'GET') {
      await fulfillJson(route, { items: [] })
      return
    }

    throw new Error(`Unexpected route access API request: ${method} ${pathname}`)
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
