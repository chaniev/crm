import { expect, test, type Page } from '@playwright/test'

const APP_CONFIG = {
  clubName: 'Iron Club',
  themeId: 'default-green-v1',
  authBackgroundImageId: 'k4pro-login-v1',
} as const

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
    await expect(page.getByRole('heading', { name: 'Главная' })).toHaveClass(
      /visually-hidden/,
    )
    await expect(page.getByRole('tab', { name: 'Посещения' })).toHaveAttribute('aria-selected', 'true')
    await expect.poll(() => attendanceGroupsCalls).toBeGreaterThan(0)
    const groupsCallsBeforeSwitch = attendanceGroupsCalls
    await page.getByRole('tab', { name: /Требуют внимания/ }).click()
    await expect(page.getByText('Клиенты, требующие внимания')).toBeVisible()
    await expect(page.getByText('Никому не требуется внимание')).toBeVisible()
    await expect(
      page.getByText('Нет клиентов с повторными пропусками или вопросами по абонементам.'),
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

    await page.getByRole('tab', { name: /Требуют внимания/ }).click()

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

    await page.getByRole('tab', { name: /Требуют внимания/ }).click()

    const loading = page.getByText('Загружаем клиентов...')
    const refresh = page.getByRole('button', { name: 'Обновить', exact: true })

    await expect(loading).toBeVisible()
    await expect(refresh).toBeDisabled()

    continueLoad?.()
    await expect(loading).toBeHidden()
    await expect(page.getByText('Никому не требуется внимание')).toBeVisible()
  })

  test('renders data state and keeps refresh button available', async ({ page }) => {
    await mockHomeApi(page, {
      expiringMemberships: {
        items: [
          {
            clientId: 'client-1',
            fullName: 'Анна Петрова',
            behaviorKind: 'Term',
            expirationDate: '2026-05-03',
            daysUntilExpiration: -3,
            state: 'Expired',
          },
          {
            clientId: 'client-2',
            fullName: 'Иван Иванов',
            behaviorKind: 'Term',
            expirationDate: '2026-05-08',
            daysUntilExpiration: 2,
            state: 'ExpiringSoon',
          },
          {
            clientId: 'client-3',
            fullName: 'Ольга Смирнова',
            behaviorKind: 'Term',
            expirationDate: null,
            daysUntilExpiration: null,
            state: 'Unknown',
          },
        ],
      },
    })

    await page.goto('/')
    await page.getByRole('tab', { name: /Требуют внимания/ }).click()

    await expect(page.getByTestId('home-attention-list')).toBeVisible()
    await expect(page.getByTestId('home-client-card-client-1')).toBeVisible()
    await expect(page.getByTestId('home-client-card-client-2')).toBeVisible()
    await expect(page.getByTestId('home-client-card-client-3')).toBeVisible()
    await expect(page.getByText('Анна Петрова')).toBeVisible()
    await expect(page.getByText('Иван Иванов')).toBeVisible()
    await expect(page.getByText('Ольга Смирнова')).toBeVisible()
    await expect(page.getByText('Истек 3 дня назад')).toBeVisible()
    await expect(page.getByText('Осталось 2 дня')).toBeVisible()
    await expect(page.getByText('Срок окончания приближается')).toBeVisible()
    await expect(page.getByText('Требует оплаты')).toHaveCount(0)
    await expect(page.getByText('Ожидается оплата')).toHaveCount(0)
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
              behaviorKind: 'Term',
              expirationDate: '2026-05-06',
              daysUntilExpiration: 3,
              state: 'ExpiringSoon',
            },
          ],
        })
      },
    })

    await page.goto('/')
    await page.getByRole('tab', { name: /Требуют внимания/ }).click()
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
    await page.getByRole('tab', { name: /Требуют внимания/ }).click()

    await expect(page.getByText('Список не загрузился')).toBeVisible()
    await expect(page.getByText(/CRM API временно недоступен/)).toBeVisible()

    shouldFail = false
    await page.getByRole('button', { name: 'Повторить' }).click()

    await expect(page.getByText('Никому не требуется внимание')).toBeVisible()
  })

  test('supports combined reasons, Telegram and contacted on a narrow screen', async ({ page }) => {
    const card = { clientId: 'client-1', fullName: 'Иван Иванов', phone: '+79990000000', notes: 'Позвонить вечером', telegramLink: 'https://t.me/ivan', membership: { behaviorKind: 'Term', membershipName: 'Месяц', expirationDate: '2026-07-21', daysUntilExpiration: 1 }, reasons: [{ type: 'missedTraining', missedCount: 4 }, { type: 'expiringMembership', expirationDate: '2026-07-21', daysUntilExpiration: 1 }] }
    await mockHomeApi(page, { expiringMemberships: [card] })
    let calls = 0
    await page.route('**/clients/client-1/attention/missed-training/contacted', async (route) => {
      calls += 1
      if (calls === 1) { await fulfillJson(route, 500, { title: 'Временная ошибка' }); return }
      await fulfillJson(route, 200, { ...card, reasons: [{ type: 'expiringMembership', expirationDate: '2026-07-21', daysUntilExpiration: 1 }] })
    })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.getByRole('tab', { name: /Требуют внимания/ }).click()
    await expect(page.getByRole('heading', { name: 'Клиенты, требующие внимания' })).toBeVisible()
    await expect(page.getByLabel('1 клиентов требуют внимания')).toBeVisible()
    await expect(page.getByText('Пропущено подряд: 4')).toBeVisible()
    await expect(page.getByText('Осталось 1 день')).toBeVisible()
    await expect(page.getByRole('link', { name: /Telegram/ })).toHaveAttribute('target', '_blank')
    const action = page.getByRole('button', { name: 'Связались с Иван Иванов' })
    await action.click()
    await expect(page.getByText(/Временная ошибка/)).toBeVisible()
    await expect(page.getByText('Пропущено подряд: 4')).toBeVisible()
    await action.click()
    await expect(page.getByText('Пропущено подряд: 4')).toBeHidden()
    await expect(page.getByText('Осталось 1 день')).toBeVisible()
    await expectNoHorizontalScroll(page)
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
      (pathname === '/api/clients/attention' ||
        pathname === '/clients/attention') &&
      method === 'GET'
    ) {
      if (options.onExpiringMemberships) {
        await options.onExpiringMemberships(route)
        return
      }

      const source = options.expiringMemberships ?? { items: [] }
      const items = Array.isArray(source) ? source : (source as { items?: unknown[] }).items ?? []
      await fulfillJson(route, 200, items.map((item) => toAttentionPayload(item as Record<string, unknown>)))
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

function toAttentionPayload(item: Record<string, unknown>) {
  if (Array.isArray(item.reasons)) return item
  const state = item.state
  const reason = state === 'Expired' ? { type: 'expiredMembership', expirationDate: item.expirationDate, daysUntilExpiration: item.daysUntilExpiration } : { type: 'expiringMembership', expirationDate: item.expirationDate, daysUntilExpiration: item.daysUntilExpiration }
  return { clientId: item.clientId, fullName: item.fullName, phone: null, notes: null, telegramLink: null, membership: { behaviorKind: item.behaviorKind, membershipName: '', expirationDate: item.expirationDate, daysUntilExpiration: item.daysUntilExpiration }, reasons: [reason] }
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
