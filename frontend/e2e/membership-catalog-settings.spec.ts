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
    assignedGroupIds: [],
    branchId: null,
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

const CATALOG_BRANCHES = [
  {
    id: 'branch-1',
    name: 'Центр',
    address: null,
    description: null,
    isArchived: false,
    hallCount: 0,
    groupCount: 0,
    clientCount: 0,
  },
  {
    id: 'branch-2',
    name: 'Северный филиал с очень длинным названием для проверки полного scope',
    address: null,
    description: null,
    isArchived: false,
    hallCount: 0,
    groupCount: 0,
    clientCount: 0,
  },
] as const

const BRANCH_TWO_ITEM = {
  ...MEMBERSHIP_CATALOG_ITEMS[1],
  id: 'branch-two-item',
  branchId: 'branch-2',
  name: 'Северный абонемент',
} as const

type CatalogScenario = {
  branches?: readonly unknown[]
  branchFailuresRemaining?: number
  itemFailuresRemaining?: number
  itemsByBranch?: Record<string, readonly unknown[]>
  onCreate?: (payload: Record<string, unknown>) => void
  onUpdate?: (itemId: string, payload: Record<string, unknown>) => void
}

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

test('TASK-109 preserves two-branch query, create payload, edit contract and focus return', async ({ page }) => {
  let createPayload: Record<string, unknown> | null = null
  let updatePayload: { itemId: string; payload: Record<string, unknown> } | null = null
  const scenario: CatalogScenario = {
    branches: CATALOG_BRANCHES,
    itemsByBranch: {
      'branch-1': MEMBERSHIP_CATALOG_ITEMS,
      'branch-2': [BRANCH_TWO_ITEM],
    },
    onCreate: (payload) => { createPayload = payload },
    onUpdate: (itemId, payload) => { updatePayload = { itemId, payload } },
  }

  await mockCatalogApi(page, HEAD_COACH_SESSION, scenario)
  await page.goto('/settings')

  const panel = page.getByRole('tabpanel', { name: 'Абонементы' })
  const scope = panel.getByRole('combobox', { name: 'Филиал каталога' })
  await expect(scope).toHaveValue('Центр')
  await scope.click()
  await page.getByRole('option', { name: CATALOG_BRANCHES[1].name }).click()

  await expect(scope).toHaveValue(CATALOG_BRANCHES[1].name)
  await expect(scope).toHaveAccessibleDescription(CATALOG_BRANCHES[1].name)
  await expect(panel.getByRole('button', { name: 'Редактировать Северный абонемент' })).toBeVisible()

  const create = panel.getByRole('button', { name: 'Добавить абонемент' })
  await create.click()
  const createDialog = page.getByRole('dialog', { name: 'Новый абонемент' })
  await createDialog.getByLabel('Название').fill('Новый северный')
  await createDialog.getByLabel('Цена').fill('2500')
  await createDialog.getByRole('button', { name: 'Сохранить' }).click()

  await expect.poll(() => createPayload).toMatchObject({
    branchId: 'branch-2',
    name: 'Новый северный',
    price: 2500,
  })
  await expect(createDialog).toBeHidden()
  await expect(create).toBeFocused()

  const edit = panel.getByRole('button', { name: 'Редактировать Северный абонемент' })
  await edit.click()
  const editDialog = page.getByRole('dialog', { name: 'Редактирование абонемента' })
  await editDialog.getByLabel('Название').fill('Северный обновлённый')
  await editDialog.getByRole('button', { name: 'Сохранить' }).click()

  await expect.poll(() => updatePayload).toEqual({
    itemId: 'branch-two-item',
    payload: {
      name: 'Северный обновлённый',
      availableFrom: '2026-01-01',
      availableTo: null,
    },
  })
  await expect(editDialog).toBeHidden()
  await expect(
    panel.getByRole('button', { name: 'Редактировать Северный обновлённый' }),
  ).toBeFocused()
  await expect(scope).toHaveValue(CATALOG_BRANCHES[1].name)
})

test('TASK-109 retries failed branch scope before loading catalog items', async ({ page }) => {
  const scenario: CatalogScenario = {
    branches: CATALOG_BRANCHES,
    // React StrictMode starts the initial effect twice in the Vite development
    // shell. Both initial requests must fail so the recovery UI is observable.
    branchFailuresRemaining: 2,
    itemsByBranch: { 'branch-1': [] },
  }
  await mockCatalogApi(page, HEAD_COACH_SESSION, scenario)
  await page.goto('/settings')

  const panel = page.getByRole('tabpanel', { name: 'Абонементы' })
  await expect(panel.getByText('Филиалы не загрузились')).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Добавить абонемент' })).toBeDisabled()
  await expect(panel.getByText('В этом филиале ещё нет абонементов')).toHaveCount(0)

  await panel.getByRole('button', { name: 'Обновить' }).click()
  await expect(panel.getByRole('combobox', { name: 'Филиал каталога' })).toHaveValue('Центр')
  await expect(panel.getByText('В этом филиале ещё нет абонементов')).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Добавить абонемент' })).toBeEnabled()
})

test('TASK-109 retries item failure without losing selected branch scope', async ({ page }) => {
  const scenario: CatalogScenario = {
    branches: CATALOG_BRANCHES,
    itemFailuresRemaining: 1,
    itemsByBranch: { 'branch-1': [] },
  }
  await mockCatalogApi(page, HEAD_COACH_SESSION, scenario)
  await page.goto('/settings')

  const panel = page.getByRole('tabpanel', { name: 'Абонементы' })
  const scope = panel.getByRole('combobox', { name: 'Филиал каталога' })
  await expect(scope).toHaveValue('Центр')
  await expect(panel.getByText('catalog failed')).toBeVisible()

  await panel.getByRole('button', { name: 'Обновить' }).click()
  await expect(panel.getByText('В этом филиале ещё нет абонементов')).toBeVisible()
  await expect(scope).toHaveValue('Центр')
})

async function mockCatalogApi(
  page: Page,
  session: typeof HEAD_COACH_SESSION,
  scenario: CatalogScenario = {},
) {
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
      if ((scenario.itemFailuresRemaining ?? 0) > 0) {
        scenario.itemFailuresRemaining = (scenario.itemFailuresRemaining ?? 0) - 1
        await route.fulfill({ status: 503, contentType: 'application/problem+json', body: JSON.stringify({ detail: 'catalog failed' }) })
        return
      }
      const branchId = requestUrl.searchParams.get('branchId') ?? 'branch-1'
      await fulfillJson(route, {
        items: scenario.itemsByBranch?.[branchId] ?? MEMBERSHIP_CATALOG_ITEMS,
      })
      return
    }

    if (
      pathname === '/api/settings/membership-catalog' &&
      method === 'POST'
    ) {
      const payload = route.request().postDataJSON() as Record<string, unknown>
      scenario.onCreate?.(payload)
      await fulfillJson(route, {
        id: 'created-item',
        branchId: payload.branchId,
        name: payload.name,
        price: payload.price,
        behaviorKind: payload.behaviorKind,
        availableFrom: payload.availableFrom,
        availableTo: payload.availableTo,
        isSystemOwned: false,
      })
      return
    }

    const catalogItemMatch = pathname.match(/^\/api\/settings\/membership-catalog\/([^/]+)$/)
    if (catalogItemMatch && method === 'PUT') {
      const payload = route.request().postDataJSON() as Record<string, unknown>
      scenario.onUpdate?.(catalogItemMatch[1], payload)
      await fulfillJson(route, {
        ...BRANCH_TWO_ITEM,
        ...payload,
        id: catalogItemMatch[1],
      })
      return
    }

    if (pathname === '/api/settings/administrators' && method === 'GET') {
      await fulfillJson(route, { items: [], createRoleOptions: [] })
      return
    }

    if (pathname === '/api/branches' && method === 'GET') {
      if ((scenario.branchFailuresRemaining ?? 0) > 0) {
        scenario.branchFailuresRemaining = (scenario.branchFailuresRemaining ?? 0) - 1
        await route.fulfill({ status: 503, contentType: 'application/problem+json', body: JSON.stringify({ detail: 'branches failed' }) })
        return
      }
      await fulfillJson(route, scenario.branches ?? [CATALOG_BRANCHES[0]])
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
