import { expect, test, type Page, type Route } from '@playwright/test'

const APP_CONFIG = {
  clubName: 'Gym CRM',
  themeId: 'default-green-v1',
  authBackgroundImageId: 'k4pro-login-v1',
} as const

const HEAD_COACH_SESSION = {
  isAuthenticated: true,
  csrfToken: 'settings-tab-e2e-token',
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
    createRoleOptions: ['Administrator', 'SuperAdministrator'],
  },
} as const

test.use({
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  viewport: { width: 390, height: 844 },
})

const TAB_MATRIX = [
  {
    label: 'Абонементы',
    createLabel: 'Добавить абонемент',
    dialogName: 'Новый абонемент',
    duplicateHeading: 'Каталог абонементов',
    duplicateText: 'Названия, цены и периоды, доступные для продажи.',
    refreshPath: '/api/settings/membership-catalog',
  },
  {
    label: 'Типы групп',
    createLabel: 'Добавить тип',
    dialogName: 'Новый тип группы',
    duplicateHeading: 'Типы групп',
    duplicateText: 'Справочник используется при создании и редактировании тренировочных групп.',
    refreshPath: '/api/group-types',
  },
  {
    label: 'Филиалы и залы',
    createLabel: 'Добавить филиал',
    dialogName: 'Новый филиал',
    duplicateHeading: 'Филиалы и залы',
    duplicateText: null,
    refreshPath: '/api/branches',
  },
  {
    label: 'Администраторы',
    createLabel: 'Добавить администратора',
    dialogName: 'Новый администратор',
    duplicateHeading: 'Администраторы',
    duplicateText: 'Администраторы управляют настройками, клиентами, группами и журналом без доступа к созданию тренеров.',
    refreshPath: '/api/settings/administrators',
  },
] as const

const MEMBERSHIP_ITEMS = [
  {
    id: 'item-term',
    branchId: 'branch-1',
    name: '10 тренировок',
    price: 1900,
    behaviorKind: 'Term',
    availableFrom: '2026-01-01',
    availableTo: null,
    isSystemOwned: false,
  },
] as const

const BRANCHES = [
  {
    id: 'branch-1',
    name: 'Центр',
    address: 'ул. Лесная, 1',
    description: null,
    isArchived: false,
    hallCount: 2,
    groupCount: 4,
    clientCount: 12,
  },
] as const

const HALLS = [
  {
    id: 'hall-1',
    branchId: 'branch-1',
    branchName: 'Центр',
    name: 'Зал №1',
    description: 'Большой',
    isArchived: false,
    groupCount: 4,
  },
] as const

test('keeps four settings panels named and operational without duplicated titles at 390 x 844', async ({
  page,
}) => {
  await mockApi(page)
  await page.goto('/settings')

  const tabs = TAB_MATRIX.map(({ label }) => page.getByRole('tab', { name: label }))
  await tabs[0].focus()
  await expect(tabs[0]).toBeFocused()
  for (const nextTab of tabs.slice(1)) {
    await page.keyboard.press('ArrowRight')
    await expect(nextTab).toBeFocused()
    await expect(nextTab).toHaveAttribute('aria-selected', 'true')
  }

  for (const tabCase of TAB_MATRIX) {
    const tab = page.getByRole('tab', { name: tabCase.label })
    await tab.click()

    const panel = page.getByRole('tabpanel', { name: tabCase.label })
    const refresh = panel.getByRole('button', { name: 'Обновить' })
    const create = panel.getByRole('button', { name: tabCase.createLabel })
    const firstOperational = firstOperationalContent(panel, tabCase.label)

    await expect(tab).toHaveAttribute('aria-selected', 'true')
    await expect(panel).toBeVisible()
    await expect(tab).toHaveAttribute('aria-controls', await panel.getAttribute('id'))
    await expect(panel).toHaveAttribute('aria-labelledby', await tab.getAttribute('id'))
    await expect(
      panel.getByRole('heading', { exact: true, name: tabCase.duplicateHeading }),
    ).toHaveCount(0)
    if (tabCase.duplicateText) {
      await expect(panel.getByText(tabCase.duplicateText, { exact: true })).toHaveCount(0)
    }
    await expect(refresh).toBeVisible()
    await expect(create).toBeVisible()
    await expect(firstOperational).toBeVisible()

    const [refreshBox, createBox, firstOperationalBox] = await Promise.all([
      refresh.boundingBox(),
      create.boundingBox(),
      firstOperational.boundingBox(),
    ])
    expect(refreshBox).not.toBeNull()
    expect(createBox).not.toBeNull()
    expect(firstOperationalBox).not.toBeNull()
    expect(refreshBox!.height).toBeGreaterThanOrEqual(44)
    expect(refreshBox!.width).toBeGreaterThanOrEqual(44)
    expect(createBox!.height).toBeGreaterThanOrEqual(44)
    expect(createBox!.width).toBeGreaterThanOrEqual(44)
    expect(firstOperationalBox!.y).toBeGreaterThanOrEqual(refreshBox!.y + refreshBox!.height)

    await refresh.focus()
    await expect(refresh).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(create).toBeFocused()

    await Promise.all([
      page.waitForRequest((request) =>
        request.method() === 'GET' && new URL(request.url()).pathname === tabCase.refreshPath,
      ),
      refresh.click(),
    ])
    await expect(refresh).toBeEnabled()

    await create.click()
    const dialog = page.getByRole('dialog', { name: tabCase.dialogName })
    await expect(dialog).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expectNoHorizontalScroll(page)
  }
})

test('TASK-109 keeps settings scope, actions and content touch-safe in visual and focus order', async ({
  page,
}) => {
  await mockApi(page)
  await page.goto('/settings')

  const catalogTab = page.getByRole('tab', { name: 'Абонементы' })
  await catalogTab.click()
  const panel = page.getByRole('tabpanel', { name: 'Абонементы' })
  const scope = panel.getByRole('combobox', { name: 'Филиал каталога' })
  const refresh = panel.getByRole('button', { name: 'Обновить' })
  const create = panel.getByRole('button', { name: 'Добавить абонемент' })
  const edit = panel.getByRole('button', { name: 'Редактировать 10 тренировок' })

  await expect(edit).toBeVisible()

  for (const tab of TAB_MATRIX.map(({ label }) => page.getByRole('tab', { name: label }))) {
    const tabBox = await tab.boundingBox()
    expect(tabBox).not.toBeNull()
    expect.soft(tabBox!.height, `${await tab.textContent()} tab height`).toBeGreaterThanOrEqual(44)
    expect.soft(tabBox!.width, `${await tab.textContent()} tab width`).toBeGreaterThanOrEqual(44)
  }

  const [scopeBox, refreshBox, createBox, editBox] = await Promise.all([
    scope.boundingBox(),
    refresh.boundingBox(),
    create.boundingBox(),
    edit.boundingBox(),
  ])
  for (const [name, box] of [
    ['scope', scopeBox],
    ['refresh', refreshBox],
    ['create', createBox],
    ['edit', editBox],
  ] as const) {
    expect(box).not.toBeNull()
    expect.soft(box!.height, `${name} height`).toBeGreaterThanOrEqual(44)
    expect.soft(box!.width, `${name} width`).toBeGreaterThanOrEqual(44)
  }

  expect.soft(Math.abs(scopeBox!.y - refreshBox!.y), 'scope and actions share one row').toBeLessThan(8)
  expect.soft(refreshBox!.x - (scopeBox!.x + scopeBox!.width), 'scope precedes actions').toBeGreaterThanOrEqual(8)
  expect.soft(createBox!.x - (refreshBox!.x + refreshBox!.width), 'actions have an 8px gap').toBeGreaterThanOrEqual(8)
  expect.soft(editBox!.y, 'content follows scoped toolbar').toBeGreaterThanOrEqual(
    Math.max(scopeBox!.y + scopeBox!.height, createBox!.y + createBox!.height),
  )

  const domOrder = await panel.evaluate((element) => {
    const scopeElement = element.querySelector('[role="combobox"]')
    const refreshElement = element.querySelector('[aria-label="Обновить"]')
    const createElement = element.querySelector('[aria-label="Добавить абонемент"]')
    const editElement = element.querySelector('[aria-label="Редактировать 10 тренировок"]')
    if (!scopeElement || !refreshElement || !createElement || !editElement) return false
    return Boolean(
      scopeElement.compareDocumentPosition(refreshElement) & Node.DOCUMENT_POSITION_FOLLOWING
      && refreshElement.compareDocumentPosition(createElement) & Node.DOCUMENT_POSITION_FOLLOWING
      && createElement.compareDocumentPosition(editElement) & Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })
  expect.soft(domOrder, 'DOM order is scope → refresh → create → edit').toBe(true)

  await catalogTab.focus()
  await page.keyboard.press('Tab')
  expect.soft(await scope.evaluate((element) => element === document.activeElement), 'scope is first panel tab stop').toBe(true)
  await page.keyboard.press('Tab')
  expect.soft(await refresh.evaluate((element) => element === document.activeElement), 'refresh follows scope').toBe(true)
  await page.keyboard.press('Tab')
  expect.soft(await create.evaluate((element) => element === document.activeElement), 'create follows refresh').toBe(true)

  await expectNoHorizontalScroll(page)
})

function firstOperationalContent(
  panel: ReturnType<Page['getByRole']>,
  tabLabel: (typeof TAB_MATRIX)[number]['label'],
) {
  switch (tabLabel) {
    case 'Абонементы':
      return panel.getByRole('combobox', { name: 'Филиал каталога' })
    case 'Типы групп':
      return panel.getByText('Типы групп пока не заведены', { exact: true })
    case 'Филиалы и залы':
      return panel.getByRole('button', { name: 'Открыть филиал Центр' })
    case 'Администраторы':
      return panel.getByText('Администраторы пока не добавлены', { exact: true })
  }
}

async function mockApi(page: Page) {
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request()
    const requestUrl = new URL(request.url())
    const pathname = requestUrl.pathname
    const method = request.method()

    if (!pathname.startsWith('/api/')) {
      await route.continue()
      return
    }

    if (pathname === '/api/config' && method === 'GET') {
      await fulfillJson(route, APP_CONFIG)
      return
    }

    if (pathname === '/api/auth/session' && method === 'GET') {
      await fulfillJson(route, HEAD_COACH_SESSION)
      return
    }

    if (pathname === '/api/clients/attention' && method === 'GET') {
      await fulfillJson(route, {
        groups: [],
        today: '2026-01-01',
        maxTrainingDate: '2026-01-01',
      })
      return
    }

    if (pathname === '/api/attendance/groups' && method === 'GET') {
      await fulfillJson(route, {
        groups: [],
        today: '2026-01-01',
        maxTrainingDate: '2026-01-01',
      })
      return
    }

    if (pathname === '/api/groups' && method === 'GET') {
      await fulfillJson(route, {
        items: [],
        totalCount: 0,
        skip: 0,
        take: 20,
        page: 1,
        pageSize: 20,
        hasNextPage: false,
      })
      return
    }

    if (pathname === '/api/clients' && method === 'GET') {
      await fulfillJson(route, {
        items: [],
        totalCount: 0,
        activeCount: 0,
        archivedCount: 0,
        skip: 0,
        take: 20,
        page: 1,
        pageSize: 20,
        hasNextPage: false,
      })
      return
    }

    if (pathname === '/api/groups/types' && method === 'GET') {
      await fulfillJson(route, [])
      return
    }

    if (pathname === '/api/group-types' && method === 'GET') {
      await fulfillJson(route, [])
      return
    }

    if (pathname === '/api/settings/membership-catalog' && method === 'GET') {
      await fulfillJson(route, { items: MEMBERSHIP_ITEMS })
      return
    }

    if (pathname === '/api/settings/administrators' && method === 'GET') {
      await fulfillJson(route, {
        items: [],
        createRoleOptions: ['Administrator'],
      })
      return
    }

    if (pathname === '/api/branches' && method === 'GET') {
      await fulfillJson(route, BRANCHES)
      return
    }

    if (pathname === '/api/halls' && method === 'GET') {
      await fulfillJson(route, HALLS)
      return
    }

    if (pathname.match(/^\/api\/branches\/[a-zA-Z0-9-]+\/halls$/) && method === 'GET') {
      await fulfillJson(route, HALLS)
      return
    }

    await route.continue()
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
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth <= document.documentElement.clientWidth
  })
  expect(overflow).toBe(true)
}
