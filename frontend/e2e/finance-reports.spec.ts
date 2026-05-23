import { expect, test, type Page } from '@playwright/test'

const APP_CONFIG = { clubName: 'Iron Club' } as const

const FINANCE_SESSION = {
  isAuthenticated: true,
  csrfToken: 'finance-csrf-token',
  bootstrapMode: false,
  user: {
    id: 'headcoach-id',
    fullName: 'Главный тренер',
    login: 'headcoach',
    role: 'HeadCoach',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Home',
    allowedSections: [
      'Home',
      'Attendance',
      'Clients',
      'Groups',
      'Users',
      'Audit',
      'Finance',
      'Settings',
    ],
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

const NO_FINANCE_SESSION = {
  ...FINANCE_SESSION,
  csrfToken: 'no-finance-csrf-token',
  user: {
    ...FINANCE_SESSION.user,
    allowedSections: ['Home', 'Clients'],
    permissions: {
      ...FINANCE_SESSION.user.permissions,
      canViewFinancialReports: false,
    },
  },
} as const

const BRANCHES_RESPONSE = [
  {
    id: 'branch-1',
    name: 'Центр',
    address: 'ул. Тестовая, 1',
    description: 'Основной филиал',
    isArchived: false,
    hallCount: 1,
    groupCount: 2,
    clientCount: 12,
  },
  {
    id: 'branch-2',
    name: 'Север',
    address: 'ул. Северная, 2',
    description: 'Второй филиал',
    isArchived: false,
    hallCount: 1,
    groupCount: 1,
    clientCount: 4,
  },
] as const

const TRAINERS_RESPONSE = [
  {
    id: 'trainer-1',
    fullName: 'Ирина Тренер',
    login: 'irina',
  },
  {
    id: 'trainer-2',
    fullName: 'Артем База',
    login: 'artem',
  },
] as const

const REPORT_RESPONSE = {
  period: {
    preset: 'month',
    anchorDate: '2026-05-14',
    from: '2026-05-01',
    to: '2026-05-31',
  },
  totals: {
    soldMembershipCount: 1,
    grossSales: 10_000,
    refundTotal: 3_000,
    netTotal: 7_777,
    newClientsCount: 1,
  },
  branchBreakdown: [
    {
      branchId: 'branch-1',
      branchName: 'Центр',
      soldMembershipCount: 1,
      grossSales: 10_000,
      refundTotal: 3_000,
      netTotal: 7_777,
      newClientsCount: 1,
    },
  ],
  groupBreakdown: [
    {
      groupId: 'group-1',
      groupName: 'Группа A',
      branchId: 'branch-1',
      branchName: 'Центр',
      soldMembershipCount: 1,
      grossSales: 10_000,
      refundTotal: 0,
      netTotal: 10_000,
      newClientsCount: 1,
    },
    {
      groupId: 'group-1',
      groupName: 'Группа A',
      branchId: 'branch-1',
      branchName: 'Центр',
      soldMembershipCount: 1,
      grossSales: 10_000,
      refundTotal: 0,
      netTotal: 10_000,
      newClientsCount: 1,
    },
  ],
  trainerBreakdown: [
    {
      trainerId: 'trainer-1',
      trainerName: 'Ирина Тренер',
      soldMembershipCount: 1,
      grossSales: 10_000,
      refundTotal: 0,
      netTotal: 10_000,
      newClientsCount: 1,
    },
    {
      trainerId: 'trainer-2',
      trainerName: 'Артем База',
      soldMembershipCount: 1,
      grossSales: 10_000,
      refundTotal: 0,
      netTotal: 10_000,
      newClientsCount: 1,
    },
  ],
} as const

const ZERO_REPORT_RESPONSE = {
  ...REPORT_RESPONSE,
  totals: {
    soldMembershipCount: 0,
    grossSales: 0,
    refundTotal: 0,
    netTotal: 0,
    newClientsCount: 0,
  },
  branchBreakdown: [],
  groupBreakdown: [],
  trainerBreakdown: [],
} as const

test.describe('Finance reports', () => {
  test('shows finance navigation and renders backend totals with duplicated breakdown rows', async ({
    page,
  }) => {
    await mockFinanceApi(page)

    await page.goto('/finance')

    const navigation = page.locator(
      'nav.app-shell__side-nav[aria-label="Основная навигация"]',
    )
    const financeNavButton = navigation.getByRole('button', { name: 'Финансы' })

    await expect(page.getByTestId('finance-screen')).toBeVisible()
    await expect(financeNavButton).toBeVisible()
    await expect(financeNavButton).toHaveAttribute('aria-current', 'page')
    await expect(page.getByTestId('finance-totals')).toContainText(/7\s?777\s?₽/)
    await expect(page.getByTestId('finance-totals')).not.toContainText(/20\s?000\s?₽/)
    await expect(page.getByTestId('finance-group-breakdown')).toContainText(
      /сумма строк в этих таблицах может быть больше итогов/i,
    )
    await expect(page.getByTestId('finance-group-breakdown')).toContainText('Группа A')
    await expect(page.getByTestId('finance-trainer-breakdown')).toContainText(
      'Ирина Тренер',
    )
    await expect(page.getByTestId('finance-trainer-breakdown')).toContainText(
      'Артем База',
    )
    await expect(page.getByTestId('finance-group-breakdown').getByText('Группа A')).toHaveCount(2)
    await expectNoHorizontalScroll(page)
  })

  test('sends quick period and custom branch/trainer filters to backend', async ({
    page,
  }) => {
    const reportRequests: URLSearchParams[] = []

    await mockFinanceApi(page, {
      onReport(searchParams) {
        reportRequests.push(new URLSearchParams(searchParams))
      },
    })

    await page.goto('/finance')
    await expect(page.getByTestId('finance-screen')).toBeVisible()

    await page.getByRole('button', { name: 'Квартал' }).click()
    await expect
      .poll(() => reportRequests.at(-1)?.get('periodPreset'))
      .toBe('quarter')

    await page.getByRole('button', { name: 'Год' }).click()
    await expect
      .poll(() => reportRequests.at(-1)?.get('periodPreset'))
      .toBe('year')

    await page.getByRole('button', { name: 'Период' }).click()
    await page.locator('input[name="from"]').fill('2026-05-10')
    await page.locator('input[name="to"]').fill('2026-05-15')
    await page.getByRole('combobox', { name: 'Филиал' }).click()
    await page.getByRole('option', { name: 'Центр' }).click()
    await page.getByRole('combobox', { name: 'Тренер' }).click()
    await page.getByRole('option', { name: 'Ирина Тренер (irina)' }).click()
    await page.getByRole('button', { name: 'Показать' }).click()

    await expect
      .poll(() => reportRequests.at(-1)?.toString())
      .toContain(
        'periodPreset=custom&from=2026-05-10&to=2026-05-15&branchId=branch-1&trainerId=trainer-1',
      )
  })

  test('hides finance tab and redirects direct route when access is not granted', async ({
    page,
  }) => {
    await mockFinanceApi(page, {
      session: NO_FINANCE_SESSION,
    })

    await page.goto('/finance')

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByTestId('home-screen')).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'Основная навигация' }).getByRole(
        'button',
        { name: 'Финансы' },
      ),
    ).toHaveCount(0)
    await expect(page.getByTestId('finance-screen')).toHaveCount(0)
  })

  test('shows backend ProblemDetails field errors for invalid report filters', async ({
    page,
  }) => {
    await mockFinanceApi(page, {
      onReport(searchParams, route) {
        if (searchParams.get('periodPreset') === 'custom') {
          return fulfillJson(route, 400, {
            title: 'Фильтры отчета некорректны.',
            errors: {
              to: ['Дата окончания не может быть раньше даты начала.'],
            },
          })
        }

        return null
      },
    })

    await page.goto('/finance')
    await expect(page.getByTestId('finance-screen')).toBeVisible()

    await page.getByRole('button', { name: 'Период' }).click()
    await page.locator('input[name="from"]').fill('2026-06-01')
    await page.locator('input[name="to"]').fill('2026-05-01')
    await page.getByRole('button', { name: 'Показать' }).click()

    await expect(page.getByText('Проверьте фильтры')).toBeVisible()
    await expect(
      page.getByText('Дата окончания не может быть раньше даты начала.'),
    ).toBeVisible()
  })

  test('renders empty report state on narrow screens without horizontal scroll', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await mockFinanceApi(page, {
      report: ZERO_REPORT_RESPONSE,
    })

    await page.goto('/finance')

    await expect(page.getByTestId('finance-screen')).toBeVisible()
    await expect(page.getByText('За выбранный период операций нет.')).toBeVisible()
    await expect(
      page.locator('nav.app-shell__side-nav[aria-label="Основная навигация"]'),
    ).toBeHidden()
    const bottomNavigation = page.getByRole('navigation', {
      name: 'Мобильная навигация',
    })
    const overflowButton = bottomNavigation.getByRole('button', {
      name: 'Открыть остальные разделы',
    })

    await expect(bottomNavigation).toBeVisible()
    await expect(overflowButton).toHaveAttribute('aria-current', 'page')
    await overflowButton.click()
    await expect(
      page.locator('.mobile-bottom-nav__overflow-list'),
    ).toBeVisible()
    await expect(
      page.locator('.mobile-bottom-nav__overflow-list').getByRole('button', {
        name: 'Финансы',
      }),
    ).toHaveAttribute('aria-current', 'page')
    await expect(
      page.getByRole('button', { name: 'Уведомления' }),
    ).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })
})

type MockFinanceApiOptions = {
  session?: typeof FINANCE_SESSION | typeof NO_FINANCE_SESSION
  report?: unknown
  onReport?: (
    searchParams: URLSearchParams,
    route: Parameters<Page['route']>[1] extends (route: infer T) => unknown
      ? T
      : never,
  ) => Promise<void> | null | void
}

async function mockFinanceApi(
  page: Page,
  options: MockFinanceApiOptions = {},
) {
  const session = options.session ?? FINANCE_SESSION

  await page.route('**/api/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const { pathname, searchParams } = requestUrl
    const method = route.request().method()

    if (!pathname.startsWith('/api/')) {
      await route.continue()
      return
    }

    if (pathname === '/api/auth/session' && method === 'GET') {
      await fulfillJson(route, 200, session)
      return
    }

    if (pathname === '/api/config' && method === 'GET') {
      await fulfillJson(route, 200, APP_CONFIG)
      return
    }

    if (pathname === '/api/clients/expiring-memberships' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (pathname === '/api/branches' && method === 'GET') {
      await fulfillJson(route, 200, BRANCHES_RESPONSE)
      return
    }

    if (pathname === '/api/groups/options/trainers' && method === 'GET') {
      await fulfillJson(route, 200, TRAINERS_RESPONSE)
      return
    }

    if (pathname === '/api/reports/financial' && method === 'GET') {
      const customResponse = options.onReport?.(searchParams, route)

      if (customResponse) {
        await customResponse
        return
      }

      await fulfillJson(route, 200, options.report ?? REPORT_RESPONSE)
      return
    }

    throw new Error(`Unexpected API request in finance report test: ${method} ${pathname}`)
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
        bodyScrollWidth: document.body.scrollWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      })),
    )
    .toEqual(
      expect.objectContaining({
        bodyScrollWidth: expect.any(Number),
        documentScrollWidth: expect.any(Number),
        viewportWidth: expect.any(Number),
      }),
    )

  const dimensions = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }))

  expect(dimensions.documentScrollWidth).toBeLessThanOrEqual(
    dimensions.viewportWidth + 1,
  )
  expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
}
