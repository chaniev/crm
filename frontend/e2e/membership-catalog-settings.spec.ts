import { expect, test, type Page, type Route } from '@playwright/test'

const APP_CONFIG = {
  clubName: 'Gym CRM',
  themeId: 'default-green-v1',
  authBackgroundImageId: 'k4pro-login-v1',
} as const

const HEAD_COACH_SESSION = {
  isAuthenticated: true,
  csrfToken: 'membership-catalog-e2e-csrf-token',
  user: {
    id: 'membership-catalog-headcoach',
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
  bootstrapMode: false,
} as const

const MEMBERSHIP_CATALOG_ITEMS = [
  {
    id: 'single-visit-item',
    branchId: 'branch-1',
    name: 'Базовый разовый формат',
    price: 500,
    behaviorKind: 'SingleVisit',
    availableFrom: '2026-01-01',
    availableTo: null,
    isSystemOwned: false,
  },
  {
    id: 'term-item',
    branchId: 'branch-1',
    name: '10 тренировок подряд',
    price: 1500,
    behaviorKind: 'Term',
    availableFrom: '2026-01-01',
    availableTo: null,
    isSystemOwned: false,
  },
  {
    id: 'professional-item-current',
    branchId: 'branch-1',
    name: 'Профессиональный',
    price: 4500,
    behaviorKind: 'Professional',
    availableFrom: '2026-01-01',
    availableTo: null,
    isSystemOwned: true,
  },
  {
    id: 'professional-item-renamed',
    branchId: 'branch-1',
    name: 'Премиум-пакет для личного тренинга',
    price: 6500,
    behaviorKind: 'Professional',
    availableFrom: '2026-01-01',
    availableTo: null,
    isSystemOwned: true,
  },
] as const

test('TASK-100 membership catalog rows render without behavior badges', async ({ page }) => {
  await mockCatalogApi(page, HEAD_COACH_SESSION)
  await page.goto('/settings')

  const catalogTab = page.getByRole('tab', { name: 'Абонементы' })
  await catalogTab.click()
  const catalogPanel = page.getByRole('tabpanel', { name: 'Абонементы' })

  await expect(catalogPanel).toBeVisible()
  await expect(catalogPanel.getByRole('heading', { name: 'Каталог абонементов' })).toHaveCount(0)

  for (const item of MEMBERSHIP_CATALOG_ITEMS) {
    const row = catalogPanel.locator('.list-row-card').filter({ hasText: item.name })
    await expect(row).toBeVisible()
    await expect(row.locator('.mantine-Badge-root')).toHaveCount(0)
    await expect(row.getByRole('button', { name: `Редактировать ${item.name}` })).toBeVisible()
    const rowText = await row.textContent()
    expect(rowText).not.toContain('Разовый')
    expect(rowText).not.toContain('На срок')
    const professionalCount = (rowText ?? '').match(/Профессиональный/g)?.length ?? 0
    if (item.name === 'Профессиональный') {
      expect(professionalCount).toBe(1)
    } else {
      expect(professionalCount).toBe(0)
    }
  }

  await expectNoHorizontalScroll(page)
})

test('TASK-100 create selector stays, edit fields remain immutable', async ({ page }) => {
  await mockCatalogApi(page, HEAD_COACH_SESSION)
  await page.goto('/settings')
  await page.getByRole('tab', { name: 'Абонементы' }).click()

  await page.getByRole('button', { name: 'Добавить абонемент' }).click()
  const createDialog = page.getByRole('dialog', { name: 'Новый абонемент' })
  await expect(createDialog).toBeVisible()
  await expect(createDialog.getByRole('combobox', { name: 'Поведение' })).toBeVisible()
  await expect(createDialog.getByRole('button', { name: 'Отменить' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(createDialog).toBeHidden()

  const sampleItem = MEMBERSHIP_CATALOG_ITEMS[0]
  await page.getByRole('button', { name: `Редактировать ${sampleItem.name}` }).click()
  const editDialog = page.getByRole('dialog', { name: 'Редактирование абонемента' })
  await expect(editDialog).toBeVisible()
  await expect(editDialog.getByLabel('Название')).toHaveValue(sampleItem.name)
  await expect(editDialog.getByLabel('Цена')).toHaveCount(0)
  await expect(editDialog.getByLabel('Поведение')).toHaveCount(0)
  await expect(editDialog.getByRole('button', { name: /delete|удалить/i })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(editDialog).toBeHidden()
})

async function mockCatalogApi(page: Page, session: typeof HEAD_COACH_SESSION) {
  await page.route('**/api/**', async (route: Route) => {
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

    if (pathname === '/api/clients/attention' && method === 'GET') {
      await fulfillJson(route, { items: [] })
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

    if (pathname === '/api/settings/membership-catalog' && method === 'GET') {
      await fulfillJson(route, { items: MEMBERSHIP_CATALOG_ITEMS })
      return
    }

    if (
      pathname === '/api/settings/membership-catalog' &&
      method === 'POST'
    ) {
      await fulfillJson(route, {
        id: 'created-item',
        branchId: 'branch-1',
        name: 'Новый',
        price: 1000,
        behaviorKind: 'Term',
        availableFrom: '2026-01-01',
        availableTo: null,
        isSystemOwned: false,
      })
      return
    }

    if (pathname === '/api/settings/administrators' && method === 'GET') {
      await fulfillJson(route, { items: [], createRoleOptions: [] })
      return
    }

    if (pathname === '/api/branches' && method === 'GET') {
      await fulfillJson(route, [{
        id: 'branch-1',
        name: 'Центр',
        address: null,
        description: null,
        isArchived: false,
        hallCount: 0,
        groupCount: 0,
        clientCount: 0,
      }])
      return
    }

    if (pathname === '/api/group-types' && method === 'GET') {
      await fulfillJson(route, [])
      return
    }

    if (pathname === '/api/users' && method === 'GET') {
      await fulfillJson(route, [])
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
  const dimensions = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }))

  expect(dimensions.documentScrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
  expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
}
