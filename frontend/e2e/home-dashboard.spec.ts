import { expect, test, type Page } from '@playwright/test'

const APP_CONFIG = { clubName: 'Iron Club' } as const

const HEAD_COACH_SESSION = {
  isAuthenticated: true,
  csrfToken: 'home-csrf-token',
  bootstrapMode: false,
  user: {
    id: 'headcoach-id',
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
    assignedGroupIds: ['group-1'],
  },
} as const

test.describe('Home dashboard', () => {
  test('renders shared shell, active navigation and empty state', async ({ page }) => {
    let attendanceGroupsCalls = 0
    await mockHomeApi(page, {
      expiringMemberships: { items: [] },
      async onAttendanceGroups(route) {
        attendanceGroupsCalls += 1
        await fulfillJson(route, 200, {
          groups: [],
          today: '2026-07-12',
          maxTrainingDate: '2026-07-12',
        })
      },
    })

    await page.goto('/')

    const shellHeader = page.getByRole('banner')
    const shellNavigation = page.getByRole('navigation', { name: 'Основная навигация' })

    await expect(page.getByTestId('home-screen')).toBeVisible()
    await expect(shellHeader).toBeVisible()
    await expect(shellHeader.getByText('Iron Club')).toBeVisible()
    await expect(
      shellHeader.getByRole('button', { name: /Главный тренер/ }),
    ).toBeVisible()
    await expect(shellNavigation).toBeVisible()
    await expect(shellNavigation.getByRole('button', { name: 'Главная' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    const brandTitleLeft = await shellHeader.getByText('Iron Club').evaluate(
      (element) => element.getBoundingClientRect().left,
    )
    const activeNavigationLabelLeft = await shellNavigation
      .getByRole('button', { name: 'Главная' })
      .locator('.mantine-Button-label')
      .evaluate((element) => element.getBoundingClientRect().left)

    expect(Math.abs(brandTitleLeft - activeNavigationLabelLeft)).toBeLessThanOrEqual(0.1)
    await expect(
      shellNavigation.getByRole('button', { name: 'Посещения' }),
    ).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Главная' })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: 'Посещения' })).toHaveAttribute('aria-selected', 'true')
    await expect.poll(() => attendanceGroupsCalls).toBeGreaterThan(0)
    const groupsCallsBeforeSwitch = attendanceGroupsCalls
    await page.getByRole('tab', { name: /Абонементы/ }).click()
    await expect(page.getByText('Абонементы требуют внимания')).toBeVisible()
    await expect(page.getByText('С абонементами всё в порядке')).toBeVisible()
    await expect(
      page.getByText('Нет истекших, скоро истекающих или неоплаченных абонементов.'),
    ).toBeVisible()
    await page.getByRole('tab', { name: 'Посещения' }).click()
    await expect.poll(() => attendanceGroupsCalls).toBe(groupsCallsBeforeSwitch)
    await expectNoHorizontalScroll(page)
  })

  test('shows mobile bottom navigation on narrow screens', async ({ page }) => {
    await mockHomeApi(page, {
      expiringMemberships: { items: [] },
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')

    await page.getByRole('tab', { name: /Абонементы/ }).click()

    const sideNavigation = page.locator(
      'nav.app-shell__side-nav[aria-label="Основная навигация"]',
    )
    const bottomNavigation = page.getByRole('navigation', {
      name: 'Мобильная навигация',
    })

    await expect(sideNavigation).toBeHidden()
    await expect(
      page.getByRole('button', { name: 'Открыть основное меню' }),
    ).toHaveCount(0)
    await expect(bottomNavigation).toBeVisible()
    await expect(
      bottomNavigation.getByRole('button', { name: 'Главная' }),
    ).toHaveAttribute('aria-current', 'page')
    await expect(
      bottomNavigation.getByRole('button', { name: 'Уведомления' }),
    ).toHaveCount(0)
    await expect(
      bottomNavigation.getByRole('button', { name: 'Посещения' }),
    ).toHaveCount(0)
    await expect(
      bottomNavigation.getByRole('button', { name: 'Открыть остальные разделы' }),
    ).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('renders loading state on initial data load', async ({ page }) => {
    let continueLoad: (() => void) | null = null

    await mockHomeApi(page, {
      async onExpiringMemberships(route) {
        await new Promise<void>((resolve) => {
          continueLoad = resolve
        })
        await fulfillJson(route, 200, { items: [] })
      },
    })

    await page.goto('/')

    await page.getByRole('tab', { name: /Абонементы/ }).click()

    const loading = page.getByText('Загружаем абонементы...')
    const refresh = page.getByRole('button', { name: 'Обновить', exact: true })

    await expect(loading).toBeVisible()
    await expect(refresh).toBeDisabled()

    continueLoad?.()
    await expect(loading).toBeHidden()
    await expect(page.getByText('С абонементами всё в порядке')).toBeVisible()
  })

  test('renders data state and keeps refresh button available', async ({ page }) => {
    await mockHomeApi(page, {
      expiringMemberships: {
        items: [
          {
            clientId: 'client-1',
            fullName: 'Анна Петрова',
            membershipType: 'Monthly',
            expirationDate: '2026-05-03',
            daysUntilExpiration: -3,
            isPaid: false,
            state: 'Expired',
          },
          {
            clientId: 'client-2',
            fullName: 'Иван Иванов',
            membershipType: 'Monthly',
            expirationDate: '2026-05-08',
            daysUntilExpiration: 2,
            isPaid: true,
            state: 'ExpiringSoon',
          },
          {
            clientId: 'client-3',
            fullName: 'Ольга Смирнова',
            membershipType: 'Monthly',
            expirationDate: null,
            daysUntilExpiration: null,
            isPaid: false,
            state: 'Unpaid',
          },
        ],
      },
    })

    await page.goto('/')
    await page.getByRole('tab', { name: /Абонементы/ }).click()

    await expect(page.getByTestId('home-expiring-memberships-list')).toBeVisible()
    await expect(page.getByTestId('home-client-card-client-1')).toBeVisible()
    await expect(page.getByTestId('home-client-card-client-2')).toBeVisible()
    await expect(page.getByTestId('home-client-card-client-3')).toBeVisible()
    await expect(page.getByText('Анна Петрова')).toBeVisible()
    await expect(page.getByText('Иван Иванов')).toBeVisible()
    await expect(page.getByText('Ольга Смирнова')).toBeVisible()
    await expect(page.getByText('Истек 3 дня назад')).toBeVisible()
    await expect(page.getByText('Осталось 2 дня')).toBeVisible()
    await expect(page.getByText('Требует оплаты')).toBeVisible()
    await expect(page.getByText('Ожидается оплата')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Обновить', exact: true }),
    ).toBeEnabled()
  })

  test('keeps refresh action accessible while request is loading', async ({ page }) => {
    let continueRefresh: (() => void) | null = null
    let blockRefreshLoad = false

    await mockHomeApi(page, {
      async onExpiringMemberships(route) {
        if (blockRefreshLoad) {
          await new Promise<void>((resolve) => {
            continueRefresh = resolve
          })
        }

        await fulfillJson(route, 200, {
          items: [
            {
              clientId: 'client-1',
              fullName: 'Иван Иванов',
              membershipType: 'Monthly',
              expirationDate: '2026-05-06',
              daysUntilExpiration: 3,
              isPaid: true,
              state: 'ExpiringSoon',
            },
          ],
        })
      },
    })

    await page.goto('/')
    await page.getByRole('tab', { name: /Абонементы/ }).click()
    const refresh = page.getByRole('button', { name: 'Обновить', exact: true })

    await expect(refresh).toBeEnabled()

    blockRefreshLoad = true
    await refresh.click()
    await expect(refresh).toBeDisabled()

    continueRefresh?.()
    await expect(refresh).toBeEnabled()
  })

  test('renders error state with retry action', async ({ page }) => {
    let shouldFail = true

    await mockHomeApi(page, {
      async onExpiringMemberships(route) {
        if (shouldFail) {
          await fulfillJson(route, 500, { title: 'CRM API временно недоступен' })
          return
        }

        await fulfillJson(route, 200, { items: [] })
      },
    })

    await page.goto('/')
    await page.getByRole('tab', { name: /Абонементы/ }).click()

    await expect(page.getByText('Список не загрузился')).toBeVisible()
    await expect(page.getByText(/CRM API временно недоступен/)).toBeVisible()

    shouldFail = false
    await page.getByRole('button', { name: 'Повторить' }).click()

    await expect(page.getByText('С абонементами всё в порядке')).toBeVisible()
  })
})

type MockHomeApiOptions = {
  expiringMemberships?: unknown
  onExpiringMemberships?: (
    route: Parameters<Page['route']>[1] extends (route: infer T) => unknown
      ? T
      : never,
  ) => Promise<void>
  onAttendanceGroups?: (
    route: Parameters<Page['route']>[1] extends (route: infer T) => unknown
      ? T
      : never,
  ) => Promise<void>
}

async function mockHomeApi(page: Page, options: MockHomeApiOptions) {
  await page.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url())
    const { pathname } = requestUrl
    const method = route.request().method()

    if (!pathname.startsWith('/api/') && !pathname.startsWith('/auth/') && !pathname.startsWith('/clients/')) {
      await route.continue()
      return
    }

    if ((pathname === '/api/auth/session' || pathname === '/auth/session') && method === 'GET') {
      await fulfillJson(route, 200, HEAD_COACH_SESSION)
      return
    }

    if ((pathname === '/api/config' || pathname === '/config') && method === 'GET') {
      await fulfillJson(route, 200, APP_CONFIG)
      return
    }

    if (
      (pathname === '/api/clients/expiring-memberships' ||
        pathname === '/clients/expiring-memberships') &&
      method === 'GET'
    ) {
      if (options.onExpiringMemberships) {
        await options.onExpiringMemberships(route)
        return
      }

      await fulfillJson(route, 200, options.expiringMemberships ?? { items: [] })
      return
    }

    if (pathname === '/api/attendance/groups' && method === 'GET') {
      if (options.onAttendanceGroups) {
        await options.onAttendanceGroups(route)
        return
      }
      await fulfillJson(route, 200, {
        groups: [],
        today: '2026-07-12',
        maxTrainingDate: '2026-07-12',
      })
      return
    }

    throw new Error(`Unexpected API request in home dashboard test: ${method} ${pathname}`)
  })
}

async function fulfillJson(
  route: Parameters<Page['route']>[1] extends (route: infer T) => unknown ? T : never,
  status: number,
  payload: unknown,
) {
  await route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(payload),
  })
}

async function expectNoHorizontalScroll(page: Page) {
  await expect
    .poll(async () =>
      page.evaluate(() => ({
        rootScrollWidth: document.documentElement.scrollWidth,
        rootClientWidth: document.documentElement.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
      })),
    )
    .toMatchObject({
      rootScrollWidth: expect.any(Number),
      rootClientWidth: expect.any(Number),
      bodyScrollWidth: expect.any(Number),
    })

  const dimensions = await page.evaluate(() => ({
    rootScrollWidth: document.documentElement.scrollWidth,
    rootClientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
  }))

  expect(dimensions.rootScrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
  expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
}
