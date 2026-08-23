import { expect, test, type Page } from '@playwright/test'

const APP_CONFIG = {
  clubName: 'Iron Club',
  themeId: 'default-green-v1',
  authBackgroundImageId: 'k4pro-login-v1',
} as const

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
    landingScreen: 'Attention',
    allowedSections: [
      'Attendance',
      'Attention',
      'Schedule',
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
    allowedSections: ['Attendance', 'Attention', 'Schedule', 'Clients'],
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

const MOBILE_FINANCE_VIEWPORTS = [
  { width: 360, height: 780 },
  { width: 390, height: 844 },
  { width: 420, height: 912 },
  { width: 440, height: 956 },
] as const

const LONG_BRANCH_NAME =
  'Филиал с очень длинным названием для проверки финансового scope на мобильном экране'
const LONG_TRAINER_NAME =
  'Тренер с очень длинным полным именем для проверки переноса'
const STRESS_REPORT_RESPONSE = {
  ...REPORT_RESPONSE,
  totals: {
    soldMembershipCount: 123_456,
    grossSales: 1_234_567_890,
    refundTotal: 987_654_321,
    netTotal: -246_913_569,
    newClientsCount: 98_765,
  },
  branchBreakdown: [
    {
      ...REPORT_RESPONSE.branchBreakdown[0],
      branchName: LONG_BRANCH_NAME,
      grossSales: 1_234_567_890,
      netTotal: -246_913_569,
    },
  ],
  groupBreakdown: [
    {
      ...REPORT_RESPONSE.groupBreakdown[0],
      branchName: LONG_BRANCH_NAME,
      groupName: 'Группа с длинным названием для проверки переноса строки',
    },
  ],
  trainerBreakdown: [
    {
      ...REPORT_RESPONSE.trainerBreakdown[0],
      trainerName: LONG_TRAINER_NAME,
    },
  ],
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

    await expectCompactFilterPanel(page, 'finance-filter-panel')
    await expect(page.getByText('Показать')).toHaveCount(0)

    await selectPeriodPreset(page, 'Квартал')
    await expect
      .poll(() => reportRequests.at(-1)?.get('periodPreset'))
      .toBe('quarter')

    await selectPeriodPreset(page, 'Год')
    await expect
      .poll(() => reportRequests.at(-1)?.get('periodPreset'))
      .toBe('year')

    await selectPeriodPreset(page, 'Период')
    await page.getByRole('button', { name: /Ещё фильтры/ }).click()
    await page.locator('input[name="from"]').fill('2026-05-10')
    await page.locator('input[name="to"]').fill('2026-05-15')
    await page.getByRole('combobox', { name: 'Филиал' }).click()
    await page.getByRole('option', { name: 'Центр' }).click()
    await page.getByRole('combobox', { name: 'Тренер' }).click()
    await page.getByRole('option', { name: 'Ирина Тренер (irina)' }).click()

    await expect
      .poll(() => reportRequests.at(-1)?.toString())
      .toContain(
        'periodPreset=custom&from=2026-05-10&to=2026-05-15&branchId=branch-1&trainerId=trainer-1',
      )
  })

  for (const viewport of MOBILE_FINANCE_VIEWPORTS) {
    test(`keeps task-first hierarchy at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await mockFinanceApi(page)

      await page.goto('/finance')

      const scopeHeader = page.getByTestId('finance-scope-header')
      const filterLauncher = page.getByTestId('finance-filter-panel').getByRole(
        'button',
        { name: 'Фильтры' },
      )
      const firstBreakdown = page.getByRole('button', { name: 'По филиалам' })

      await expect(scopeHeader).toContainText('Отчет: 01.05.2026–31.05.2026')
      await expect(scopeHeader).toContainText('Филиал: Все филиалы')
      await expect(scopeHeader).toContainText('Тренер: Все тренеры')
      await expect(filterLauncher).toBeVisible()
      await expect(page.getByTestId('finance-totals')).toBeVisible()
      await expect(firstBreakdown).toBeVisible()

      const kpiHeights = await page
        .locator('.finance-kpi-strip__item')
        .evaluateAll((items) =>
          items.map((item) => item.getBoundingClientRect().height),
        )
      expect(kpiHeights).toHaveLength(5)
      expect(Math.max(...kpiHeights)).toBeLessThanOrEqual(76)

      if (viewport.width >= 390) {
        const breakdownBox = await firstBreakdown.boundingBox()
        const visualViewportHeight = await page.evaluate(
          () => window.visualViewport?.height ?? window.innerHeight,
        )
        expect(breakdownBox).not.toBeNull()
        expect(breakdownBox!.y).toBeLessThanOrEqual(visualViewportHeight + 1)
      }

      await expectNoHorizontalScroll(page)
    })
  }

  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 1440, height: 1200 },
  ] as const) {
    test(`preserves compact scope-to-breakdown order at ${viewport.width}x${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await mockFinanceApi(page)
      await page.goto('/finance')

      const scopeHeader = page.getByTestId('finance-scope-header')
      const filterPanel = page.getByTestId('finance-filter-panel')
      const totals = page.getByTestId('finance-totals')
      const breakdown = page.getByTestId('finance-branch-breakdown')

      await expect(scopeHeader).toBeVisible()
      await expect(filterPanel).toBeVisible()
      await expect(totals).toBeVisible()
      await expect(breakdown).toBeVisible()

      const [scopeBox, filterBox, totalsBox, breakdownBox] = await Promise.all([
        scopeHeader.boundingBox(),
        filterPanel.boundingBox(),
        totals.boundingBox(),
        breakdown.boundingBox(),
      ])
      expect(scopeBox).not.toBeNull()
      expect(filterBox).not.toBeNull()
      expect(totalsBox).not.toBeNull()
      expect(breakdownBox).not.toBeNull()
      expect(scopeBox!.y).toBeLessThan(filterBox!.y)
      expect(filterBox!.y).toBeLessThan(totalsBox!.y)
      expect(totalsBox!.y).toBeLessThan(breakdownBox!.y)

      const gridColumnCount = await page
        .locator('.finance-kpi-strip')
        .evaluate((element) =>
          getComputedStyle(element).gridTemplateColumns.split(' ').length,
        )
      expect(gridColumnCount).toBe(5)
      await expectNoHorizontalScroll(page)
    })
  }

  test('mobile filters apply immediately, return focus and reset to the valid baseline', async ({
    page,
  }) => {
    const reportRequests: URLSearchParams[] = []

    await page.setViewportSize({ width: 390, height: 844 })
    await mockFinanceApi(page, {
      onReport(searchParams) {
        reportRequests.push(new URLSearchParams(searchParams))
      },
    })
    await page.goto('/finance')

    const filterPanel = page.getByTestId('finance-filter-panel')
    const filterLauncher = filterPanel.getByRole('button', { name: 'Фильтры' })
    await expect(filterLauncher).toBeVisible()
    await filterLauncher.click()
    await page.getByRole('combobox', { name: 'Филиал' }).click()
    await page.getByRole('option', { name: 'Центр' }).click()

    await expect
      .poll(() => reportRequests.at(-1)?.get('branchId'))
      .toBe('branch-1')

    await selectPeriodPreset(page, 'Период')
    await page.getByRole('combobox', { name: 'Тренер' }).click()
    await page.getByRole('option', { name: 'Ирина Тренер (irina)' }).click()
    await expect
      .poll(() => reportRequests.at(-1)?.toString())
      .toContain(
        'periodPreset=custom&from=',
      )
    await expect.poll(() => reportRequests.at(-1)?.get('branchId')).toBe('branch-1')
    await expect.poll(() => reportRequests.at(-1)?.get('trainerId')).toBe('trainer-1')

    await page.getByRole('button', { name: 'Готово' }).click()
    const activeFilterLauncher = filterPanel.getByRole('button', {
      name: 'Фильтры · 3',
    })
    await expect(activeFilterLauncher).toBeFocused()
    await expect(
      page.getByRole('button', {
        name: 'Сбросить фильтры финансового отчета',
      }),
    ).toBeVisible()

    await page
      .getByRole('button', {
        name: 'Сбросить фильтры финансового отчета',
      })
      .click()

    await expect.poll(() => reportRequests.at(-1)?.get('periodPreset')).toBe('month')
    await expect.poll(() => reportRequests.at(-1)?.get('anchorDate')).not.toBeNull()
    await expect.poll(() => reportRequests.at(-1)?.has('branchId')).toBe(false)
    await expect.poll(() => reportRequests.at(-1)?.has('trainerId')).toBe(false)
    await expect(filterPanel.getByRole('button', { name: 'Фильтры' })).toBeVisible()
    await expect(
      page.getByRole('button', {
        name: 'Сбросить фильтры финансового отчета',
      }),
    ).toHaveCount(0)
  })

  test('long authorized labels and large negative money stay readable without overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await mockFinanceApi(page, {
      branches: [
        {
          ...BRANCHES_RESPONSE[0],
          name: LONG_BRANCH_NAME,
        },
      ],
      trainers: [
        {
          id: 'trainer-1',
          fullName: LONG_TRAINER_NAME,
          login: 'trainer-with-long-login',
        },
      ],
      report: STRESS_REPORT_RESPONSE,
    })
    await page.goto('/finance')

    await page.getByRole('button', { name: 'Фильтры' }).click()
    await page.getByRole('combobox', { name: 'Филиал' }).click()
    await page.getByRole('option', { name: LONG_BRANCH_NAME }).click()
    await page.getByRole('combobox', { name: 'Тренер' }).click()
    await page
      .getByRole('option', {
        name: `${LONG_TRAINER_NAME} (trainer-with-long-login)`,
      })
      .click()
    await page.getByRole('button', { name: 'Готово' }).click()

    const scopeHeader = page.getByTestId('finance-scope-header')
    await expect(scopeHeader).toHaveAccessibleName(
      new RegExp(`${LONG_BRANCH_NAME}.*${LONG_TRAINER_NAME}`),
    )
    await expect(page.getByTestId('finance-totals')).toContainText(/−?246\s?913\s?569|−?246913569/)

    const clippedKpis = await page
      .locator('.finance-kpi-strip__item')
      .evaluateAll((items) =>
        items.filter(
          (item) =>
            item.scrollWidth > item.clientWidth + 1 ||
            item.scrollHeight > item.clientHeight + 1,
        ).length,
      )
    expect(clippedKpis).toBe(0)
    await expectNoHorizontalScroll(page)
  })

  test('stale changed-scope failure keeps displayed labels and retries inside the report', async ({
    page,
  }) => {
    let filteredAttempts = 0

    await page.setViewportSize({ width: 390, height: 844 })
    await mockFinanceApi(page, {
      onReport(searchParams, route) {
        if (searchParams.get('branchId') !== 'branch-1') {
          return null
        }

        filteredAttempts += 1

        if (filteredAttempts === 1) {
          return fulfillJson(route, 503, { title: 'Сеть недоступна.' })
        }

        return null
      },
    })
    await page.goto('/finance')

    await expect(page.getByTestId('finance-scope-header')).toContainText(
      'Филиал: Все филиалы',
    )
    await page.getByRole('button', { name: 'Фильтры' }).click()
    await page.getByRole('combobox', { name: 'Филиал' }).click()
    await page.getByRole('option', { name: 'Центр' }).click()
    await page.getByRole('button', { name: 'Готово' }).click()

    await expect(page.getByText('Отчет не обновился')).toBeVisible()
    await expect(page.getByTestId('finance-scope-header')).toContainText(
      'Филиал: Все филиалы',
    )
    await expect(
      page.getByText(/Не удалось загрузить отчет для Филиал: Центр/),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Повторить обновление' }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Повторить обновление' }).click()

    await expect.poll(() => filteredAttempts).toBe(2)
    await expect(page.getByTestId('finance-scope-header')).toContainText(
      'Филиал: Центр',
    )
    await expect(page.getByText('Отчет не обновился')).toHaveCount(0)
  })

  test('hides finance tab and keeps explicit restriction on a denied direct route', async ({
    page,
  }) => {
    await mockFinanceApi(page, {
      session: NO_FINANCE_SESSION,
    })

    await page.goto('/finance')

    await expect(page).toHaveURL(/\/finance$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Нет доступа' })).toBeFocused()
    await expect(page.getByText('У вас нет доступа к разделу «Финансы».')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Открыть Внимание' })).toBeVisible()
    await expect(
      page.getByRole('navigation', { name: 'Основная навигация' }).getByRole(
        'button',
        { name: 'Финансы' },
      ),
    ).toHaveCount(0)
    await expect(page.getByTestId('finance-screen')).toHaveCount(0)
    await expect(page.getByTestId('attention-screen')).toHaveCount(0)
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

    await selectPeriodPreset(page, 'Период')
    await page.getByRole('button', { name: /Ещё фильтры/ }).click()
    await page.locator('input[name="from"]').fill('2026-06-01')
    await page.locator('input[name="to"]').fill('2026-05-01')

    await expect(page.getByText('Проверьте фильтры')).toBeVisible()
    await expect(
      page.getByTestId('finance-screen').getByText(
        'Дата окончания не может быть раньше даты начала.',
      ).first(),
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
    await expect(page.getByTestId('finance-filter-panel').getByLabel('Дата в периоде')).toHaveCount(0)
    await page.getByTestId('finance-filter-panel').getByRole('button', { name: 'Фильтры' }).click()
    await expect(page.getByLabel('Дата в периоде')).toBeVisible()
    await expect(page.getByText('За выбранный период операций нет.')).toBeVisible()
    await expect(page.getByTestId('finance-totals')).toHaveCount(0)
    await expect(page.getByTestId('finance-branch-breakdown')).toHaveCount(0)
    await expect(page.getByTestId('finance-trainer-breakdown')).toHaveCount(0)
    await expect(page.getByTestId('finance-group-breakdown')).toHaveCount(0)
    await page.getByRole('button', { name: 'Готово' }).click()
    await expect(
      page.locator('nav.app-shell__side-nav[aria-label="Основная навигация"]'),
    ).toBeHidden()
    const bottomNavigation = page.getByRole('navigation', {
      name: 'Мобильная навигация',
    })
    const overflowButton = bottomNavigation.getByRole('button', {
      name: 'Ещё, открыть остальные разделы',
    })
    const financeButton = bottomNavigation.getByRole('button', {
      name: 'Финансы',
    })

    await expect(bottomNavigation).toBeVisible()
    await expect(financeButton).toHaveAttribute('aria-current', 'page')
    await expect(overflowButton).not.toHaveAttribute('aria-current')
    await overflowButton.click()
    await expect(
      page.locator('.mobile-bottom-nav__overflow-list'),
    ).toBeVisible()
    await expect(
      page.locator('.mobile-bottom-nav__overflow-list').getByRole('button', {
        name: 'Финансы',
      }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Уведомления' }),
    ).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })
})

type MockFinanceApiOptions = {
  session?: typeof FINANCE_SESSION | typeof NO_FINANCE_SESSION
  report?: unknown
  branches?: unknown
  trainers?: unknown
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

    if (pathname === '/api/clients/attention' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (pathname === '/api/attendance/groups' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (pathname === '/api/branches' && method === 'GET') {
      await fulfillJson(route, 200, options.branches ?? BRANCHES_RESPONSE)
      return
    }

    if (pathname === '/api/groups/options/trainers' && method === 'GET') {
      await fulfillJson(route, 200, options.trainers ?? TRAINERS_RESPONSE)
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

async function expectCompactFilterPanel(page: Page, testId: string) {
  const panel = page.getByTestId(testId)

  await expect(panel).toBeVisible()

  const box = await panel.boundingBox()

  expect(box?.height ?? 0).toBeLessThanOrEqual(64)
}

async function selectPeriodPreset(page: Page, label: string) {
  await page
    .locator('.mantine-SegmentedControl-label')
    .filter({ hasText: new RegExp(`^${label}$`) })
    .click()
}
