import { expect, test, type Page, type Route } from '@playwright/test'

const APP_CONFIG = {
  clubName: 'Iron Club',
  themeId: 'default-green-v1',
  authBackgroundImageId: 'k4pro-login-v1',
} as const

const HEAD_COACH_SESSION = {
  isAuthenticated: true,
  csrfToken: 'attention-csrf-token',
  bootstrapMode: false,
  user: {
    id: 'headcoach-id',
    fullName: 'Главный тренер',
    login: 'headcoach',
    role: 'HeadCoach',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Attention',
    allowedSections: ['Attendance', 'Attention', 'Schedule', 'Clients', 'Groups', 'Users', 'Audit', 'Settings'],
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
    attendanceScope: { kind: 'Global', groupIds: [] },
  },
} as const

test.describe('Attention dashboard', () => {
  test('renders Attention shell without former dashboard tabs or attendance workbench', async ({ page }) => {
    let attendanceGroupsCalls = 0
    await mockAttentionApi(page, {
      attentionItems: [],
      async onAttendanceGroups(route) {
        attendanceGroupsCalls += 1
        await fulfillJson(route, 200, {
          groups: [],
          today: '2026-07-12',
          maxTrainingDate: '2026-07-12',
        })
      },
    })

    await page.goto('/attention')

    const shellHeader = page.getByRole('banner')
    const shellNavigation = page.getByRole('navigation', { name: 'Основная навигация' })

    await expect(page.getByTestId('attention-screen')).toBeVisible()
    await expect(shellHeader).toBeVisible()
    await expect(shellHeader.getByText('Iron Club')).toBeVisible()
    await expect(shellNavigation).toBeVisible()
    await expect(shellNavigation.getByRole('button', { name: 'Внимание' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(shellNavigation.getByRole('button', { name: 'Посещения' })).toBeVisible()
    await expect(page.getByRole('main', { name: 'Внимание' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Внимание' })).toHaveClass(/visually-hidden/)
    await expect(page.getByRole('heading', { name: 'Требуют внимания' })).toHaveCount(0)
    await expect(page.getByRole('tablist')).toHaveCount(0)
    await expect(page.getByTestId('attendance-screen')).toHaveCount(0)
    await expect.poll(() => attendanceGroupsCalls).toBe(0)
    await expect(page.getByText('Никому не требуется внимание')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('keeps mobile navigation priority and no overflow on management primary routes', async ({ page }) => {
    await mockAttentionApi(page, { attentionItems: [] })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/attention')

    const sideNavigation = page.locator(
      'nav.app-shell__side-nav[aria-label="Основная навигация"]',
    )
    const bottomNavigation = page.getByRole('navigation', {
      name: 'Мобильная навигация',
    })

    await expect(sideNavigation).toBeHidden()
    await expect(bottomNavigation).toBeVisible()
    await expect(bottomNavigation.getByRole('button', { name: 'Посещения' })).toBeVisible()
    await expect(bottomNavigation.getByRole('button', { name: 'Внимание' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(bottomNavigation.getByRole('button', { name: 'Расписание' })).toBeVisible()
    await expect(bottomNavigation.getByRole('button', { name: 'Клиенты' })).toBeVisible()
    await expect(
      bottomNavigation.getByRole('button', { name: 'Ещё, открыть остальные разделы' }),
    ).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('renders loading, error, retry and data states', async ({ page }) => {
    let shouldFail = true
    let continueInitialLoad: (() => void) | null = null

    await mockAttentionApi(page, {
      async onAttentionItems(route) {
        await new Promise<void>((resolve) => {
          continueInitialLoad = resolve
        })

        if (shouldFail) {
          await fulfillJson(route, 500, { title: 'CRM API временно недоступен' })
          return
        }

        await fulfillJson(route, 200, [attentionCard()])
      },
    })

    await page.goto('/attention')

    await expect(page.getByText('Загружаем клиентов...')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Обновить', exact: true })).toBeDisabled()

    continueInitialLoad?.()
    await expect(page.getByText('Список не загрузился')).toBeVisible()
    await expect(page.getByText(/CRM API временно недоступен/)).toBeVisible()

    shouldFail = false
    continueInitialLoad = null
    await page.getByRole('button', { name: 'Повторить' }).click()
    continueInitialLoad?.()

    await expect(page.getByTestId('attention-list')).toBeVisible()
    await expect(page.getByTestId('attention-client-card-client-1:membership-1:sale-1')).toBeVisible()
    await expect(page.getByText('Иван Иванов')).toBeVisible()
    await expect(page.getByText('Пропущено подряд: 4')).toBeVisible()
    await expect(page.getByText('Осталось 1 день')).toBeVisible()
    await expect(page.getByText('Требует оплаты')).toHaveCount(0)
  })

  test('preserves attention action recovery on a narrow screen', async ({ page }) => {
    const card = attentionCard()
    let calls = 0
    await mockAttentionApi(page, { attentionItems: [card] })
    await page.route('**/clients/client-1/attention/missed-training/contacted', async (route) => {
      calls += 1
      if (calls === 1) {
        await fulfillJson(route, 500, { title: 'Временная ошибка' })
        return
      }

      await fulfillJson(route, 200, {
        ...card,
        reasons: [{
          type: 'expiringMembership',
          membershipId: 'membership-1',
          saleId: 'sale-1',
          expirationDate: '2026-07-21',
          daysUntilExpiration: 1,
        }],
      })
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/attention')

    await expect(page.getByRole('heading', { name: 'Список клиентов' })).toHaveClass(
      /visually-hidden/,
    )
    await expect(page.getByTestId('attention-list')).toHaveAttribute(
      'aria-labelledby',
      'attention-list-title',
    )
    await expect(page.getByText('Пропущено подряд: 4')).toBeVisible()
    const actionMenu = page.getByRole('button', { name: 'Другие действия для Иван Иванов' })
    await actionMenu.click()
    await expect(page.getByRole('menuitem', { name: /Открыть Telegram/ })).toHaveAttribute(
      'target',
      '_blank',
    )
    await page.keyboard.press('Escape')

    const action = page.getByRole('button', { name: 'Связались с Иван Иванов' })
    await action.click()
    await expect(page.getByText(/Временная ошибка/)).toBeVisible()
    await expect(page.getByText('Пропущено подряд: 4')).toBeVisible()

    await action.click()
    await expect(page.getByText('Пропущено подряд: 4')).toBeHidden()
    await expect(page.getByText('Осталось 1 день')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('keeps dense rows, two control lines and one-tap secondary actions at mobile widths', async ({ page }) => {
    const attentionItems = Array.from({ length: 6 }, (_, index) => attentionCard(index + 1))
    await mockAttentionApi(page, { attentionItems })

    for (const viewport of [
      { width: 360, height: 780, minimumVisible: 4 },
      { width: 390, height: 844, minimumVisible: 4 },
      { width: 420, height: 912, minimumVisible: 5 },
      { width: 440, height: 956, minimumVisible: 5 },
    ]) {
      await page.setViewportSize(viewport)
      await page.goto('/attention')

      const cards = page.locator('[data-testid^="attention-client-card-"]')
      await expect(cards).toHaveCount(6)
      const firstCard = cards.first()
      const mobileNavigation = page.getByRole('navigation', { name: 'Мобильная навигация' })
      const controls = page.locator('.attention-controls-row, .attention-list-status')

      await expect(controls).toHaveCount(2)
      await expect(firstCard).toHaveClass(/crm-list-row-surface/)
      await expect(page.getByLabel('Всего клиентов: 6')).toBeVisible()
      await expect(page.getByLabel('Просроченных абонементов: 0')).toBeVisible()

      const navigationBox = await mobileNavigation.boundingBox()
      expect(navigationBox).not.toBeNull()
      const fullyVisibleCards = await cards.evaluateAll((elements, viewportBottom) =>
        elements.filter((element) => {
          const bounds = element.getBoundingClientRect()
          return bounds.top >= 0 && bounds.bottom <= viewportBottom
        }).length,
      navigationBox!.y)
      expect(fullyVisibleCards).toBeGreaterThanOrEqual(viewport.minimumVisible)

      const cardBox = await firstCard.boundingBox()
      expect(cardBox).not.toBeNull()
      expect(cardBox!.height).toBeLessThanOrEqual(110)

      const primaryActions = firstCard.locator('[data-crm-variant="primary"]')
      await expect(primaryActions).toHaveCount(1)
      const menuTrigger = firstCard.getByRole('button', { name: /Другие действия/ })
      const triggerBox = await menuTrigger.boundingBox()
      expect(triggerBox).not.toBeNull()
      expect(triggerBox!.width).toBeGreaterThanOrEqual(44)
      expect(triggerBox!.height).toBeGreaterThanOrEqual(44)

      await menuTrigger.click()
      await expect(page.getByRole('menuitem', { name: /Позвонить/ })).toBeVisible()
      await expect(page.getByRole('menuitem', { name: /Открыть Telegram/ })).toBeVisible()
      await expect(page.getByRole('menuitem', { name: /Открыть карточку/ })).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(menuTrigger).toBeFocused()
      await expectNoHorizontalScroll(page)
    }
  })
})

type MockAttentionApiOptions = {
  attentionItems?: unknown
  onAttentionItems?: (route: Route) => Promise<void>
  onAttendanceGroups?: (route: Route) => Promise<void>
}

async function mockAttentionApi(page: Page, options: MockAttentionApiOptions) {
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
      if (options.onAttentionItems) {
        await options.onAttentionItems(route)
        return
      }

      await fulfillJson(route, 200, options.attentionItems ?? [])
      return
    }

    if (
      (pathname === '/api/attendance/groups' ||
        pathname === '/attendance/groups') &&
      method === 'GET'
    ) {
      if (options.onAttendanceGroups) {
        await options.onAttendanceGroups(route)
        return
      }

      await fulfillJson(route, 500, { title: 'Attendance must not load in Attention' })
      return
    }

    await fulfillJson(route, 404, { title: `Unhandled ${method} ${pathname}` })
  })
}

function attentionCard(index = 1) {
  return {
    clientId: `client-${index}`,
    fullName: index === 1 ? 'Иван Иванов' : `Клиент внимания ${index}`,
    phone: `+7999000000${index}`,
    notes: index === 1 ? 'Позвонить вечером' : `Комментарий клиента ${index}`,
    telegramLink: `https://t.me/client${index}`,
    membership: {
      membershipId: `membership-${index}`,
      saleId: `sale-${index}`,
      behaviorKind: 'Term',
      membershipName: 'Месяц',
      expirationDate: '2026-07-21',
      daysUntilExpiration: 1,
    },
    reasons: [
      { type: 'missedTraining', missedCount: 4 },
      {
        type: 'expiringMembership',
        membershipId: `membership-${index}`,
        saleId: `sale-${index}`,
        expirationDate: '2026-07-21',
        daysUntilExpiration: 1,
      },
    ],
  }
}

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

async function expectNoHorizontalScroll(page: Page) {
  await expect.poll(async () => page.evaluate(() => {
    const root = document.scrollingElement ?? document.documentElement
    return root.scrollWidth - root.clientWidth
  })).toBeLessThanOrEqual(1)
}
