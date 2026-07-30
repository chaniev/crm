import { expect, test, type Locator, type Page, type Route } from '@playwright/test'
import { readFileSync } from 'node:fs'

type IPhoneManifest = {
  viewports: {
    iphoneAir: { width: number; height: number }
    iphone17ProMax: { width: number; height: number }
  }
}

const TASK_090_MANIFEST = JSON.parse(
  readFileSync(
    new URL('../../docs/ui-concept/task-090-iphone-17-pro-max/manifest.json', import.meta.url),
    'utf8',
  ),
) as IPhoneManifest

const TARGET_SCREENS = {
  'iphone-air-webkit': {
    ...TASK_090_MANIFEST.viewports.iphoneAir,
  },
  'iphone-17-pro-max-webkit': {
    ...TASK_090_MANIFEST.viewports.iphone17ProMax,
  },
} as const

const MOBILE_BOTTOM_NAVIGATION_SELECTOR = 'nav.mobile-bottom-nav[aria-label="Мобильная навигация"]'
const SIDE_NAVIGATION_SELECTOR = 'nav.app-shell__side-nav[aria-label="Основная навигация"]'

type AppConfigFixture = {
  clubName: string
  themeId?: string
  authBackgroundImageId?: string
}

const APP_CONFIG = {
  clubName: 'Gym CRM',
  themeId: 'default-green-v1',
  authBackgroundImageId: 'k4pro-login-v1',
} as const

const CLIENT_LIST_ITEM = {
  id: 'client-1',
  fullName: 'Александр Петров',
  groupCount: 1,
  branchId: 'branch-1',
  branchName: 'Центр',
  hasActiveMembership: false,
  hasCurrentMembership: false,
  membershipWarning: false,
  status: 'Active',
  phone: '+7 999 111-22-33',
  notes: '',
  currentMembership: {
    id: 'membership-1',
    saleId: 'sale-1',
    membershipCatalogItemId: 'catalog-1',
    membershipName: 'Месяц',
    behaviorKind: 'Term',
    purchaseDate: '2026-06-01',
    paymentDate: '2026-06-01',
    paymentRecordedAt: '2026-06-01T09:00:00Z',
    paymentRecordedByUserId: 'coach-1',
    paymentRecordedByUserName: 'Тренер',
    expirationDate: '2026-07-01',
    grossAmount: 3500,
    catalogPrice: 3500,
    singleVisitUsed: false,
    pricingMode: 'Catalog',
  },
  currentMembershipSummary: {
    id: 'membership-1',
    saleId: 'sale-1',
    membershipCatalogItemId: 'catalog-1',
    membershipName: 'Месяц',
    behaviorKind: 'Term',
    purchaseDate: '2026-06-01',
    paymentDate: '2026-06-01',
    paymentRecordedAt: '2026-06-01T09:00:00Z',
    paymentRecordedByUserId: 'coach-1',
    paymentRecordedByUserName: 'Тренер',
    expirationDate: '2026-07-01',
    grossAmount: 3500,
    catalogPrice: 3500,
    singleVisitUsed: false,
    pricingMode: 'Catalog',
  },
  attendanceHistory: [],
  attendanceHistoryTotalCount: 0,
  membershipHistory: [],
} as const

const CLIENTS_LIST_RESPONSE = {
  items: [CLIENT_LIST_ITEM],
  totalCount: 1,
  activeCount: 1,
  archivedCount: 0,
  skip: 0,
  take: 20,
  page: 1,
  pageSize: 20,
  hasNextPage: false,
} as const

const MEMBERSHIP_CATALOG_LIST_ITEMS = [
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
    availableTo: '2026-12-31',
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
    name: 'Очень длинное переименованное название варианта абонемента для проверки переноса в списке',
    price: 6500,
    behaviorKind: 'Professional',
    availableFrom: '2026-01-01',
    availableTo: null,
    isSystemOwned: true,
  },
] as const

const CLIENT_LIST_GROUPS_RESPONSE = {
  items: [
    {
      id: 'group-1',
      name: 'Группа 7',
      branchId: 'branch-1',
      branchName: 'Центр',
      hallId: 'hall-1',
      hallName: 'Зал',
      groupTypeId: 'type-1',
      groupTypeName: 'Базовый',
      trainingStartTime: '19:00',
      durationMinutes: 60,
      weekdays: [2, 4],
      trainers: [{ id: 'coach-1', fullName: 'Тренер', login: 'coach' }],
      trainerIds: ['coach-1'],
      trainerCount: 1,
      trainerNames: ['Тренер'],
      clientCount: 12,
      isActive: true,
    },
  ],
  totalCount: 1,
  skip: 0,
  take: 20,
} as const

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
} as const

const COACH_RESTRICTED_SESSION = {
  ...HEAD_COACH_SESSION,
  csrfToken: 'iphone-target-coach-csrf-token',
  user: {
    ...HEAD_COACH_SESSION.user,
    id: 'iphone-target-coach',
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

const HEAD_COACH_ADMIN_SESSION = {
  ...HEAD_COACH_SESSION,
  user: {
    ...HEAD_COACH_SESSION.user,
    createRoleOptions: ['Administrator', 'SuperAdministrator'],
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

test('target portrait route restriction keeps recovery focused and touch-safe', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)

  await mockApi(page, COACH_RESTRICTED_SESSION)
  await page.goto('/clients/new')

  const heading = page.getByRole('heading', { level: 1, name: 'Нет доступа' })
  const recovery = page.getByRole('button', { name: 'Открыть Клиенты' })

  await expect(heading).toBeFocused()
  await expect(page.getByText('У вас нет доступа к операции «Новый клиент».')).toBeVisible()
  await expect(recovery).toBeInViewport()
  await expectNoHorizontalScroll(page)

  const environment = await page.evaluate(() => ({
    devicePixelRatio: window.devicePixelRatio,
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
  expect(environment.devicePixelRatio).toBe(3)
  expect(environment.userAgent).toContain('iPhone')

  const recoveryBox = await recovery.boundingBox()
  expect(recoveryBox).not.toBeNull()
  expect(recoveryBox!.height).toBeGreaterThanOrEqual(44)
})

test('unknown auth-profile values are safely resolved on iPhone profiles', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)

  await page.setViewportSize(target)
  await mockApi(page, UNAUTHENTICATED_SESSION, {
    clubName: 'iPhone fallback profile',
    themeId: 'unknown-theme-v1',
    authBackgroundImageId: 'unknown-login-v1',
  })

  await page.goto('/')

  const authPage = page.locator('.gym-crm-page--auth')

  await expect(page.getByRole('heading', { name: 'Добро пожаловать!' })).toBeVisible()
  await expect(authPage).toBeVisible()
  await expect(authPage).toHaveClass(/gym-crm-page--auth-image/)

  const authBackgroundImage = await authPage.evaluate((element) =>
    getComputedStyle(element).getPropertyValue('--crm-auth-background-image'),
  )

  expect(authBackgroundImage).toContain('k4pro-login-bg')
  await expectNoHorizontalScroll(page)
})

test('empty auth-profile values are safely resolved on iPhone profiles', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)

  await page.setViewportSize(target)
  await mockApi(page, UNAUTHENTICATED_SESSION, {
    clubName: 'iPhone fallback profile',
    themeId: '',
    authBackgroundImageId: '',
  })

  await page.goto('/')

  const authPage = page.locator('.gym-crm-page--auth')

  await expect(page.getByRole('heading', { name: 'Добро пожаловать!' })).toBeVisible()
  await expect(authPage).toBeVisible()
  await expect(authPage).toHaveClass(/gym-crm-page--auth-image/)

  const authBackgroundImage = await authPage.evaluate((element) =>
    getComputedStyle(element).getPropertyValue('--crm-auth-background-image'),
  )

  expect(authBackgroundImage).toContain('k4pro-login-bg')
  await expectNoHorizontalScroll(page)
})

test('target compact-height landscape keeps the authenticated shell usable', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)
  const compactViewport = {
    width: target.height,
    height: target.width,
  }

  await page.setViewportSize(compactViewport)
  await mockApi(page, HEAD_COACH_SESSION)
  await page.goto('/')

  const sideNavigation = page.locator(SIDE_NAVIGATION_SELECTOR)
  const bottomNavigation = page.locator(MOBILE_BOTTOM_NAVIGATION_SELECTOR)
  const homeButton = bottomNavigation.getByRole('button', { name: 'Главная' })
  const homeScreen = page.getByTestId('home-screen')

  await expect(homeScreen).toBeVisible()
  await expect(sideNavigation).toBeHidden()
  await expect(bottomNavigation).toBeVisible()
  await expect(homeButton).toBeVisible()
  await expect(homeButton).toBeInViewport()

  const homeBounds = await homeScreen.boundingBox()
  const mobileNavBounds = await bottomNavigation.boundingBox()

  expect(homeBounds).not.toBeNull()
  expect(homeBounds!.y + homeBounds!.height).toBeGreaterThanOrEqual(0)
  expect(homeBounds!.y).toBeLessThanOrEqual(compactViewport.height - 1)
  expect(mobileNavBounds).not.toBeNull()
  expect(mobileNavBounds!.y + mobileNavBounds!.height).toBeLessThanOrEqual(
    compactViewport.height + 1,
  )
  await expectNoHorizontalScroll(page)
})

test('iPhone clients route keeps core controls touch-safe and readable', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)

  await page.setViewportSize(target)
  await mockApi(page, HEAD_COACH_SESSION)
  await page.goto('/clients')

  const searchField = page.getByRole('textbox', { name: 'Поиск по имени или телефону' })
  const filterLauncher = page.getByRole('button', { name: 'Открыть фильтры' })
  const refreshButton = page.getByRole('button', { name: 'Обновить список' })
  const createButton = page.getByRole('button', { name: 'Новый клиент' })

  await expect(page.getByTestId('clients-screen')).toBeVisible()
  await expectNoHorizontalScroll(page)

  for (const control of [searchField, filterLauncher, refreshButton, createButton]) {
    const box = await control.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }

  const searchFontSize = await searchField.evaluate(
    (element) => Number.parseFloat(getComputedStyle(element).fontSize),
  )
  expect(searchFontSize).toBeGreaterThanOrEqual(16)
  await expect(searchField).toBeInViewport()
  await expect(filterLauncher).toBeInViewport()
  await expect(refreshButton).toBeInViewport()
  await expect(createButton).toBeInViewport()
})

test('search focus keeps create/refresh available in compact mobile list and cards are 96px high', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)
  const compactClients = Array.from({ length: 7 }, (_, index) => ({
    ...CLIENT_LIST_ITEM,
    id: `compact-client-${index + 1}`,
    fullName: `Александр Петрович ${index + 1}`,
  }))

  await page.setViewportSize(target)
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
      await fulfillJson(route, HEAD_COACH_SESSION)
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

    if (pathname === '/api/groups' && method === 'GET') {
      await fulfillJson(route, CLIENT_LIST_GROUPS_RESPONSE)
      return
    }

    if (pathname === '/api/clients' && method === 'GET') {
      await fulfillJson(route, {
        items: compactClients,
        totalCount: compactClients.length,
        activeCount: compactClients.length,
        archivedCount: 0,
        skip: 0,
        take: 20,
        page: 1,
        pageSize: 20,
        hasNextPage: false,
        quickFilterCounts: {
          withoutMembership: 0,
          expiringSoon: 0,
          withoutGroup: 0,
          trial: 0,
        },
      })
      return
    }

    if (/^\/api\/clients\/compact-client-\d+$/.test(pathname) && method === 'GET') {
      const client = compactClients.find(
        (item) => `/api/clients/${item.id}` === pathname,
      )
      await fulfillJson(route, client ?? compactClients[0])
      return
    }

    if (pathname === '/api/groups/types' && method === 'GET') {
      await fulfillJson(route, [])
      return
    }

    if (pathname.startsWith('/api/clients/') && method === 'GET') {
      await route.fulfill({
        status: 404,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ message: 'Клиент не найден' }),
      })
      return
    }

    await route.continue()
  })

  await page.goto('/clients')
  await expect(page.getByTestId('clients-screen')).toBeVisible()

  const searchField = page.getByRole('textbox', {
    name: 'Поиск по имени или телефону',
  })
  const refreshButton = page.getByRole('button', { name: 'Обновить список' })
  const createButton = page.getByRole('button', { name: 'Новый клиент' })

  await expect(refreshButton).toBeVisible()
  await expect(createButton).toBeVisible()

  await searchField.click()
  await expect(refreshButton).toBeVisible()
  await expect(createButton).toBeVisible()

  await searchField.fill('А')
  await expect(refreshButton).toBeVisible()
  await expect(createButton).toBeVisible()
  await searchField.fill('')
  await searchField.blur()
  await expect(refreshButton).toBeVisible()
  await expect(createButton).toBeVisible()

  const firstCard = page.getByTestId('client-card-compact-client-1')
  const secondCard = page.getByTestId('client-card-compact-client-2')
  await expect(firstCard).toBeVisible()
  await expect(secondCard).toBeVisible()

  const [firstBox, secondBox] = await Promise.all([
    firstCard.boundingBox(),
    secondCard.boundingBox(),
  ])
  expect(firstBox).not.toBeNull()
  expect(secondBox).not.toBeNull()
  expect(Math.round(firstBox!.height)).toBe(96)
  expect(Math.round(secondBox!.y - firstBox!.y)).toBe(104)

  const geometryTargets = [
    { viewport: { width: 360, height: 780 }, locatorMinWidth: 156, visibleCards: 5 },
    { viewport: { width: 390, height: 844 }, locatorMinWidth: 176, visibleCards: 5 },
    { viewport: { width: 420, height: 912 }, locatorMinWidth: 200, visibleCards: 6 },
    { viewport: { width: 440, height: 956 }, locatorMinWidth: 216, visibleCards: 6 },
  ]

  for (const geometryTarget of geometryTargets) {
    await page.setViewportSize(geometryTarget.viewport)
    await searchField.click()

    const locatorWidth = await page
      .locator('.entity-locator-bar__input')
      .evaluate((element) => element.getBoundingClientRect().width)
    expect(locatorWidth).toBeGreaterThanOrEqual(geometryTarget.locatorMinWidth)

    const visibleCardCount = await page
      .locator('[data-client-search-card="true"]')
      .evaluateAll((cards) => {
        const navigationTop =
          document
            .querySelector('[data-testid="mobile-bottom-navigation"]')
            ?.getBoundingClientRect().top ?? window.innerHeight

        return cards.filter((card) => {
          const rect = card.getBoundingClientRect()
          return rect.top >= 0 && rect.bottom <= navigationTop - 8
        }).length
      })

    expect(visibleCardCount).toBeGreaterThanOrEqual(geometryTarget.visibleCards)
  }
})

test('iPhone return from preview keeps client list filters and page', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)
  const filterGroup = {
    id: 'target-filter-group',
    branchId: 'branch-1',
    branchName: 'Центр',
    hallId: 'hall-1',
    hallName: 'Зал',
    groupTypeId: 'type-1',
    groupTypeName: 'Базовый',
    name: 'Фильтр-группа',
    trainingStartTime: '18:00',
    durationMinutes: 50,
    weekdays: [1],
    isActive: true,
    trainers: [{ id: 'coach-1', fullName: 'Тренер', login: 'coach' }],
    trainerIds: ['coach-1'],
    trainerCount: 1,
    trainerNames: ['Тренер'],
    clientCount: 21,
  }
  const groups = [...CLIENT_LIST_GROUPS_RESPONSE.items, filterGroup]
  const groupsEnvelope = {
    ...CLIENT_LIST_GROUPS_RESPONSE,
    items: groups,
    totalCount: groups.length,
  }
  const filteredClients = Array.from({ length: 21 }, (_, index) => ({
    ...CLIENT_LIST_ITEM,
    id: `target-filter-client-${index + 1}`,
    fullName: `Тестовый ${index + 1}`,
    phone: `+79990022${String(index + 1).padStart(3, '0')}`,
    status: 'Archived' as const,
    groupCount: 1,
    groups: [
      {
        id: filterGroup.id,
        name: filterGroup.name,
        branchId: filterGroup.branchId,
        branchName: filterGroup.branchName,
      },
    ],
    lastVisitDate: '2026-03-01',
    currentMembershipSummary: null,
    currentMembership: null,
    notes: '',
    attendanceHistory: [],
    attendanceHistoryTotalCount: 0,
    membershipHistory: [],
    membershipWarning: true,
    hasActiveMembership: false,
  }))
  const clientRequests: Array<Record<string, string>> = []

  await page.setViewportSize(target)
  await page.route('**/api/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const { pathname, searchParams } = requestUrl
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
      await fulfillJson(route, HEAD_COACH_SESSION)
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

    if (pathname === '/api/groups' && method === 'GET') {
      await fulfillJson(route, groupsEnvelope)
      return
    }

    if (pathname === '/api/groups/types' && method === 'GET') {
      await fulfillJson(route, [])
      return
    }

    if (pathname === '/api/clients' && method === 'GET') {
      const requestParams = Object.fromEntries(searchParams.entries())
      const pageNumber = Number(requestParams.page ?? 1)
      const isFilteredRequest =
        requestParams.query === 'Фильтр' &&
        requestParams.groupId === filterGroup.id &&
        requestParams.status === 'Archived' &&
        requestParams.hasPhoto === 'false'

      const pageItems = isFilteredRequest
        ? pageNumber === 2
          ? filteredClients.slice(20)
          : filteredClients.slice(0, 20)
        : [
            {
              ...CLIENT_LIST_ITEM,
              id: 'client-1',
            },
          ]

      clientRequests.push(requestParams)
      await fulfillJson(route, {
        items: pageItems,
        totalCount: isFilteredRequest ? filteredClients.length : 1,
        activeCount: isFilteredRequest ? 0 : 1,
        archivedCount: isFilteredRequest ? 21 : 0,
        skip: (pageNumber - 1) * 20,
        take: 20,
        page: pageNumber,
        pageSize: 20,
        hasNextPage: isFilteredRequest ? pageNumber < 2 : false,
        quickFilterCounts: {
          withoutMembership: 0,
          expiringSoon: 0,
          withoutGroup: 0,
          trial: 0,
        },
      })
      return
    }

    if (pathname.startsWith('/api/clients/') && method === 'GET') {
      const clientId = pathname.slice('/api/clients/'.length)
      const client = filteredClients.find((item) => item.id === clientId)

      if (!client) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({ message: 'Клиент не найден' }),
        })
        return
      }

      await fulfillJson(route, client)
      return
    }

    await route.continue()
  })

  await page.goto('/clients')
  await expect(page.getByTestId('clients-screen')).toBeVisible()

  await page.getByLabel('Поиск по имени или телефону').fill('  Фильтр  ')
  await page.getByRole('button', { name: /Открыть фильтры/ }).click()
  await expect(page.getByRole('dialog', { name: 'Фильтры клиентов' })).toBeVisible()
  await page.getByRole('combobox', { name: 'Группа' }).click()
  await page.getByRole('option', { name: 'Фильтр-группа' }).click()
  await page.getByRole('combobox', { name: 'Статус' }).click()
  await page.getByRole('option', { name: 'Архив' }).click()
  await page.getByLabel('Без фото').click()
  await page.getByRole('button', { name: 'Готово' }).click()

  await expect
    .poll(() =>
      clientRequests.some((request) =>
        hasRequestParams(request, {
          page: '1',
          pageSize: '20',
          query: 'Фильтр',
          groupId: filterGroup.id,
          status: 'Archived',
          hasPhoto: 'false',
        }),
      ),
    )
    .toBe(true)

  await page.getByRole('button', { name: 'Дальше' }).click()
  await expect
    .poll(() =>
      clientRequests.some((request) =>
        hasRequestParams(request, {
          page: '2',
          pageSize: '20',
          query: 'Фильтр',
          groupId: filterGroup.id,
          status: 'Archived',
          hasPhoto: 'false',
        }),
      ),
    )
    .toBe(true)

  const targetCard = page.getByTestId('client-card-target-filter-client-21')
  await expect(targetCard).toBeVisible()
  await targetCard.click()
  await expect(page).toHaveURL('/clients/target-filter-client-21/preview')

  await page.goBack()
  await expect(page).toHaveURL('/clients')
  await expect
    .poll(() =>
      clientRequests.filter((request) =>
        hasRequestParams(request, {
          page: '2',
          pageSize: '20',
          query: 'Фильтр',
          groupId: filterGroup.id,
          status: 'Archived',
          hasPhoto: 'false',
        }),
      ).length >= 2,
    )
    .toBe(true)

  await expect(page.getByRole('status')).toContainText('21–21')
  await expect(page.getByRole('status')).toContainText('из 21')
  await expect(page.getByTestId('client-card-target-filter-client-21')).toBeVisible()
  await expectNoHorizontalScroll(page)
})

test('compact-height iPhone filter surface is keyboard-accessible and focus-safe', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)
  const compactViewport = {
    width: target.height,
    height: target.width,
  }

  await page.setViewportSize(compactViewport)
  await mockApi(page, HEAD_COACH_SESSION)
  await page.goto('/clients')

  const filterLauncher = page.getByRole('button', { name: 'Открыть фильтры' })
  await expect(filterLauncher).toBeVisible()
  await expect(filterLauncher).toBeInViewport()
  await filterLauncher.focus()
  await expect(filterLauncher).toBeFocused()
  await page.keyboard.press('Enter')

  const filterDialog = page.getByRole('dialog', { name: 'Фильтры клиентов' })
  const closeButton = filterDialog.getByRole('button', { name: 'Закрыть фильтры клиентов' })
  const applyButton = filterDialog.getByRole('button', { name: 'Готово' })

  await expect(filterDialog).toBeVisible()
  await expect(closeButton).toBeVisible()
  await expect(applyButton).toBeVisible()

  for (const control of [closeButton, applyButton]) {
    const box = await control.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(43.9)
    await expect(control).toBeInViewport()
  }

  const visibleFormControls = filterDialog.locator(
    'input:visible, select:visible, textarea:visible',
  )
  const formControlCount = await visibleFormControls.count()
  expect(formControlCount).toBeGreaterThan(0)

  for (let index = 0; index < formControlCount; index += 1) {
    const fontSize = await visibleFormControls.nth(index).evaluate(
      (element) => Number.parseFloat(getComputedStyle(element).fontSize),
    )
    expect(fontSize).toBeGreaterThanOrEqual(16)
  }

  await expectNoHorizontalScroll(page)
  await page.keyboard.press('Escape')
  await expect(filterDialog).toBeHidden()
  await expect(filterLauncher).toBeFocused()
})

test('TASK-094 iPhone locator surfaces use semantic filter paint tokens', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)

  await page.setViewportSize(target)
  await mockApi(page, HEAD_COACH_SESSION)

  const cases = [
    {
      id: 'clients',
      path: '/clients',
      surfaceSelector: '[data-testid="clients-filter-panel"] .entity-locator-bar',
      focusSelector: 'input',
    },
    {
      id: 'groups',
      path: '/groups',
      surfaceSelector: '[data-testid="groups-list-controls"] .entity-locator-bar',
      focusSelector: 'input',
    },
  ] as const

  for (const surfaceCase of cases) {
    await page.goto(surfaceCase.path)

    const surface = page.locator(surfaceCase.surfaceSelector).first()
    const focusTarget = surface.locator(surfaceCase.focusSelector).first()

    await expect(surface, surfaceCase.id).toBeVisible()
    await expect(surface, surfaceCase.id).toHaveClass(/\bcrm-filter-surface\b/)
    await expectSemanticSurfacePaint(surface, surfaceCase.id)
    await focusTarget.focus()
    await expect(focusTarget, `${surfaceCase.id} focus target`).toBeFocused()
    await expectNoHorizontalScroll(page)
  }
})

test('в целевых iPhone-профилях журнал сохраняет четыре поля без колонки действия', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)

  await page.setViewportSize(target)
  await mockApi(page, HEAD_COACH_SESSION)
  await page.goto('/audit')

  const grid = page.getByTestId('audit-log-grid')
  const row = grid.locator('.audit-log-row').first()
  const detailsTrigger = row.getByTestId('audit-log-details-action')

  await expect(grid).toBeVisible()
  await expect(
    grid.getByRole('columnheader', { includeHidden: true }),
  ).toHaveCount(4)
  await expect(row.getByRole('cell')).toHaveCount(4)
  await expect(
    grid.getByRole('columnheader', { includeHidden: true, name: 'Действие' }),
  ).toHaveCount(0)
  await expect(grid.getByText('Создание клиента', { exact: true })).toHaveCount(0)

  const geometry = await row.evaluate((element) => {
    const style = getComputedStyle(element)
    const description = element.querySelector<HTMLElement>('.audit-log-description')
    const actor = element.querySelector<HTMLElement>('.audit-log-cell--actor')
    const details = element.querySelector<HTMLElement>(
      '[data-testid="audit-log-details-action"]',
    )
    const actorRect = actor?.getBoundingClientRect()
    const detailsRect = details?.getBoundingClientRect()

    return {
      columns: style.gridTemplateColumns.split(/\s+/).filter(Boolean).length,
      areas: style.gridTemplateAreas,
      descriptionClamp: description
        ? getComputedStyle(description).webkitLineClamp
        : '',
      actorWithinRow:
        Boolean(actorRect) &&
        actorRect!.left >= element.getBoundingClientRect().left - 1 &&
        actorRect!.right <= element.getBoundingClientRect().right + 1,
      detailsWidth: detailsRect?.width ?? 0,
      detailsHeight: detailsRect?.height ?? 0,
    }
  })

  expect(geometry.columns).toBe(2)
  expect(geometry.areas).not.toContain('action')
  expect(geometry.areas).not.toContain('source')
  expect(geometry.descriptionClamp).toBe('2')
  expect(geometry.actorWithinRow).toBe(true)
  expect(geometry.detailsWidth).toBeGreaterThanOrEqual(44)
  expect(geometry.detailsHeight).toBeGreaterThanOrEqual(44)
  await expectNoHorizontalScroll(page)

  await detailsTrigger.click()
  const detailsModal = page.getByTestId('audit-log-details-modal')
  await expect(detailsModal).toContainText('Создание клиента')
  await page.keyboard.press('Escape')
  await expect(detailsModal).toBeHidden()
  await expect(detailsTrigger).toBeFocused()
})

test('в целевых iPhone-профилях админ-панель рендерится без горизонтального скролла', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)
  let createPayload: Record<string, unknown> | null = null

  await page.setViewportSize(target)
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
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
      await fulfillJson(route, HEAD_COACH_ADMIN_SESSION)
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

    if (pathname === '/api/groups' && method === 'GET') {
      await fulfillJson(route, CLIENT_LIST_GROUPS_RESPONSE)
      return
    }

    if (pathname === '/api/clients' && method === 'GET') {
      await fulfillJson(route, CLIENTS_LIST_RESPONSE)
      return
    }

    if (pathname === '/api/clients/client-1' && method === 'GET') {
      await fulfillJson(route, CLIENT_LIST_ITEM)
      return
    }

    if (pathname === '/api/clients/expiring-memberships' && method === 'GET') {
      await fulfillJson(route, [])
      return
    }

    if (pathname === '/api/settings/administrators' && method === 'GET') {
      await fulfillJson(route, {
        items: [
          {
            id: 'admin-1',
            fullName: 'Администратор с длинным именем и ролью',
            login: 'admin-1',
            role: 'Administrator',
            mustChangePassword: false,
            isActive: true,
            branchId: 'branch-1',
            branchName: 'Центр',
            allowedActions: ['Edit'],
          },
        ],
        createRoleOptions: ['Administrator', 'SuperAdministrator'],
      })
      return
    }

    if (pathname === '/api/settings/administrators' && method === 'POST') {
      createPayload = route.request().postDataJSON()
      await fulfillJson(route, {
        id: 'superadmin-created',
        fullName: String(createPayload.fullName),
        login: String(createPayload.login),
        role: 'SuperAdministrator',
        mustChangePassword: Boolean(createPayload.mustChangePassword),
        isActive: Boolean(createPayload.isActive),
        branchId: null,
        branchName: null,
        messengerPlatform: null,
        messengerPlatformUserId: null,
        allowedActions: ['Edit'],
        roleOptions: ['SuperAdministrator'],
      })
      return
    }

    if (pathname === '/api/branches' && method === 'GET') {
      await fulfillJson(route, [
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
      ])
      return
    }

    if (pathname === '/api/halls' && method === 'GET') {
      await fulfillJson(route, [
        {
          id: 'hall-1',
          branchId: 'branch-1',
          branchName: 'Центр',
          name: 'Основной зал',
          description: 'Основное пространство',
          isArchived: false,
          groupCount: 0,
        },
      ])
      return
    }

    if (pathname === '/api/group-types' && method === 'GET') {
      await fulfillJson(route, [])
      return
    }

    if (pathname === '/api/settings/membership-catalog' && method === 'GET') {
      await fulfillJson(route, { items: [] })
      return
    }

    if (pathname === '/api/users' && method === 'GET') {
      await fulfillJson(route, {
        items: [],
        createRoleOptions: ['Coach'],
      })
      return
    }

    throw new Error(`Unexpected iPhone target API request: ${method} ${pathname}`)
  })

  await page.goto('/settings')
  await expect(page.getByRole('tab', { name: 'Администраторы' })).toBeVisible()
  await page.getByRole('tab', { name: 'Администраторы' }).click()
  const administratorsPanel = page.getByTestId('administrators-settings-panel')
  const createButton = page.getByRole('button', { name: 'Добавить администратора' }).first()
  const refreshButton = administratorsPanel.getByRole('button', { name: 'Обновить' })
  await expect(createButton).toBeVisible()
  await expect(administratorsPanel.locator('.metric-card')).toHaveCount(0)
  await expect(administratorsPanel.locator(':scope > .page-section').first()).toBeVisible()
  await expect(createButton).toBeInViewport()
  await expect(refreshButton).toBeInViewport()
  await expect(page.getByTestId('administrator-card-admin-1')).toBeInViewport()
  await expectNoHorizontalScroll(page)

  await createButton.click()
  const dialog = page.getByRole('dialog', { name: 'Новый администратор' })
  const save = dialog.getByRole('button', { name: 'Сохранить' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('ФИО')).toBeFocused()
  await expect(save).toBeInViewport()

  const dialogBox = await page.locator('.administrator-form-modal__content').boundingBox()
  expect(dialogBox).not.toBeNull()
  expect(dialogBox!.x).toBeLessThanOrEqual(1)
  expect(dialogBox!.width).toBeGreaterThanOrEqual(target.width - 1)

  for (const control of [
    dialog.getByRole('button', { name: 'Отменить' }),
    save,
  ]) {
    const controlBox = await control.boundingBox()
    expect(controlBox).not.toBeNull()
    expect(controlBox!.height).toBeGreaterThanOrEqual(44)
  }

  await dialog.getByRole('combobox', { name: 'Роль' }).click()
  await page.getByRole('option', { name: 'Суперадминистратор' }).click()
  await expect(dialog.getByLabel('Филиал администратора')).toBeHidden()
  await dialog.getByLabel('ФИО').fill('Новый Суперадминистратор')
  await dialog.getByLabel('Логин').fill('new-superadmin')
  await dialog.getByLabel('Стартовый пароль').fill('Password1!')
  await save.click()

  await expect.poll(() => createPayload).toMatchObject({
    role: 'SuperAdministrator',
    branchId: null,
  })
  await expect(page.getByText('Суперадминистратор создан')).toBeVisible()
  await expect(page.getByTestId('administrator-card-superadmin-created')).toBeVisible()
  await expectNoHorizontalScroll(page)

  await page.setViewportSize({ width: target.height, height: target.width })
  await createButton.click()

  const compactDialog = page.getByRole('dialog', { name: 'Новый администратор' })
  const compactBody = compactDialog.locator('.administrator-form-modal__body')
  const compactContent = page.locator('.administrator-form-modal__content')
  const compactSave = compactDialog.getByRole('button', { name: 'Сохранить' })
  await expect(compactDialog).toBeVisible()
  await compactDialog.getByLabel('Telegram ID').scrollIntoViewIfNeeded()
  await expect(compactSave).toBeInViewport()

  const compactGeometry = await Promise.all([
    compactBody.evaluate((element) => getComputedStyle(element).overflowY),
    compactContent.evaluate((element) => getComputedStyle(element).overflow),
    compactContent.boundingBox(),
  ])
  expect(compactGeometry[0]).toBe('auto')
  expect(compactGeometry[1]).toBe('hidden')
  expect(compactGeometry[2]).not.toBeNull()
  expect(compactGeometry[2]!.height).toBeLessThanOrEqual(target.width)
  expect(compactGeometry[2]!.x).toBeLessThanOrEqual(1)
  expect(compactGeometry[2]!.width).toBeGreaterThanOrEqual(target.height - 1)
  await expectNoHorizontalScroll(page)

  await page.keyboard.press('Escape')
  await expect(compactDialog).toBeHidden()
  await expect(createButton).toBeFocused()
})

test('целевые iPhone-профили сохраняют поиск тренера доступным в портрете и landscape', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)

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
      await fulfillJson(route, HEAD_COACH_SESSION)
      return
    }

    if (pathname === '/api/users' && method === 'GET') {
      await fulfillJson(route, {
        items: [
          {
            id: 'coach-anna',
            fullName: 'Анна Ветрова',
            login: 'anna.login',
            role: 'Coach',
            mustChangePassword: false,
            isActive: true,
            messengerPlatform: null,
            messengerPlatformUserId: null,
            branchId: null,
            branchName: null,
            allowedActions: ['Edit'],
            roleOptions: ['Coach'],
          },
          {
            id: 'coach-boris',
            fullName: 'Борис Соколов',
            login: 'boris.login',
            role: 'Coach',
            mustChangePassword: false,
            isActive: true,
            messengerPlatform: null,
            messengerPlatformUserId: null,
            branchId: null,
            branchName: null,
            allowedActions: ['Edit'],
            roleOptions: ['Coach'],
          },
          {
            id: 'coach-long',
            fullName: 'Александра Константинопольская-Рождественская Очень Длинное Отчество',
            login: 'alexandra.konstantinopolskaya-rozhdestvenskaya.very.long.login',
            role: 'Coach',
            mustChangePassword: false,
            isActive: true,
            messengerPlatform: 'Telegram',
            messengerPlatformUserId: 'telegram-identifier-123456789012345678901234567890',
            branchId: null,
            branchName: null,
            allowedActions: ['Edit'],
            roleOptions: ['Coach'],
          },
        ],
        createRoleOptions: ['Coach'],
      })
      return
    }

    throw new Error(`Unexpected trainer search iPhone API request: ${method} ${pathname}`)
  })

  await page.goto('/users')

  const locator = page.getByTestId('users-list-locator')
  const search = page.getByRole('textbox', { name: 'Найти тренера' })
  const refresh = page.getByRole('button', { name: 'Обновить' })
  const create = page.getByRole('button', { name: 'Создать тренера' })

  await expect(locator).toBeVisible()
  await expect(search).toBeInViewport()
  await expect(refresh).toBeInViewport()
  await expect(create).toBeInViewport()
  await search.fill('  ANNA.LOGIN  ')
  const normalCard = page.getByTestId('user-card-coach-anna')
  await expect(normalCard).toBeVisible()
  await expect(normalCard.getByText('Тренер', { exact: true })).toHaveCount(0)
  await expect(normalCard.getByText('Активен', { exact: true })).toHaveCount(0)
  await expect(normalCard.getByText('Пароль актуален', { exact: true })).toHaveCount(0)
  await expect(page.getByTestId('user-card-coach-boris')).toHaveCount(0)
  await page.getByRole('button', { name: 'Сбросить поисковый запрос' }).click()
  await expect(search).toBeFocused()
  const longCard = page.getByTestId('user-card-coach-long')
  const longName = longCard.getByText(
    'Александра Константинопольская-Рождественская Очень Длинное Отчество',
  )
  await longCard.scrollIntoViewIfNeeded()
  await expect(longName).toBeVisible()
  await expect(longCard.getByRole('button', { name: 'Редактировать' })).toBeVisible()
  await expect.poll(() => longName.evaluate((element) =>
    element.getBoundingClientRect().height > parseFloat(getComputedStyle(element).lineHeight),
  )).toBe(true)
  await expectNoHorizontalScroll(page)

  await page.setViewportSize({ width: target.height, height: target.width })
  await locator.scrollIntoViewIfNeeded()
  await expect(search).toBeInViewport()
  await expect(refresh).toBeInViewport()
  await expect(create).toBeInViewport()
  await expectNoHorizontalScroll(page)
})

test('целевые iPhone-профили сохраняют единственный возврат и достижимый submit тренера', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)
  const trainer = {
    id: 'coach-anna',
    fullName: 'Анна Ветрова',
    login: 'anna.login',
    role: 'Coach',
    mustChangePassword: false,
    isActive: true,
    messengerPlatform: null,
    messengerPlatformUserId: null,
    branchId: null,
    branchName: null,
    allowedActions: ['Edit'],
    roleOptions: ['Coach'],
  }

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
      await fulfillJson(route, HEAD_COACH_SESSION)
      return
    }

    if (pathname === '/api/users/coach-anna' && method === 'GET') {
      await fulfillJson(route, trainer)
      return
    }

    throw new Error(`Unexpected trainer edit iPhone API request: ${method} ${pathname}`)
  })

  await page.goto('/users/coach-anna/edit')

  const routeReturn = page.getByRole('button', { name: 'Назад к списку' })
  const submit = page.getByRole('button', { name: 'Сохранить изменения' })
  await expect(routeReturn).toHaveCount(1)
  await expect(page.getByRole('button', { exact: true, name: 'К списку' })).toHaveCount(0)
  await expect(submit).toBeVisible()
  await submit.scrollIntoViewIfNeeded()
  const submitGeometry = await submit.boundingBox()
  expect(submitGeometry).not.toBeNull()
  expect(submitGeometry!.height).toBeGreaterThanOrEqual(44)
  await expectNoHorizontalScroll(page)

  await page.setViewportSize({ width: target.height, height: target.width })
  await routeReturn.scrollIntoViewIfNeeded()
  await expect(routeReturn).toBeVisible()
  await submit.scrollIntoViewIfNeeded()
  await expect(submit).toBeVisible()
  await expectNoHorizontalScroll(page)
})

test('в целевых iPhone-профилях каталог абонементов рендерит длинное название и доступную кнопку Изменить без горизонтального скролла', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)
  const longName = MEMBERSHIP_CATALOG_LIST_ITEMS[3].name
  const editedItem = MEMBERSHIP_CATALOG_LIST_ITEMS[0]

  await page.setViewportSize(target)
  await mockIphoneMembershipCatalogApi(page, HEAD_COACH_SESSION)
  await page.goto('/settings')

  await expect(page.getByRole('tab', { name: 'Абонементы' })).toBeVisible()
  await page.getByRole('tab', { name: 'Абонементы' }).click()

  const membershipRows = page.locator('.list-row-card')
  await expect(membershipRows).toHaveCount(4)
  await expectNoHorizontalScroll(page)

  const rows = await membershipRows.all()
  for (const row of rows) {
    await expect(row.locator('.mantine-Badge-root')).toHaveCount(0, { timeout: 1000 })
    await expect(row.getByRole('button', { name: /^Редактировать / })).toBeVisible()
  }

  const longNameRow = page.locator('.list-row-card', { hasText: longName })
  await expect(longNameRow).toBeVisible()
  await longNameRow.scrollIntoViewIfNeeded()
  const longNameText = longNameRow.getByText(longName)
  await expect(longNameText).toBeVisible()

  const editButton = longNameRow.getByRole('button', { name: `Редактировать ${longName}` })
  await expect(editButton).toBeVisible()
  await expect(editButton).toBeInViewport()

  const editGeometry = await editButton.boundingBox()
  expect(editGeometry).not.toBeNull()
  expect(editGeometry!.height).toBeGreaterThanOrEqual(44)

  const longNameGeometry = await longNameText.evaluate((element) => ({
    left: element.getBoundingClientRect().left,
    right: element.getBoundingClientRect().right,
    lines: (element as HTMLElement).offsetHeight > parseFloat(getComputedStyle(element).lineHeight),
  }))
  expect(longNameGeometry.left).toBeGreaterThanOrEqual(0)
  expect(longNameGeometry.right).toBeLessThanOrEqual(target.width + 1)
  expect(longNameGeometry.lines).toBe(true)

  await page.getByRole('button', { name: `Редактировать ${editedItem.name}` }).click()
  const dialog = page.getByRole('dialog', { name: 'Редактирование абонемента' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Название')).toHaveValue(editedItem.name)
  await expect(dialog.getByLabel('Цена')).toHaveCount(0)
  await expect(dialog.getByLabel('Поведение')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expectNoHorizontalScroll(page)
})

test('target portrait подтверждает, что на филиалы и залы отсутствуют summary-маркеры', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)

  await page.setViewportSize(target)
  await mockApi(page, HEAD_COACH_ADMIN_SESSION)
  await page.goto('/settings')
  await page.getByRole('tab', { name: 'Филиалы и залы' }).click()

  const settingsScreen = page.locator('[data-testid="settings-screen"]')
  const createButton = settingsScreen.getByRole('button', { name: 'Добавить филиал' })
  const refreshButton = settingsScreen.getByRole('button', { name: 'Обновить' })
  const firstBranch = page.locator('.settings-branch-row').first()

  await expect(createButton).toBeVisible()
  await expect(refreshButton).toBeVisible()
  await expect(firstBranch).toBeVisible()
  await expect(settingsScreen.locator('.metric-card')).toHaveCount(0)
  await expect(createButton).toBeInViewport()
  await expect(refreshButton).toBeInViewport()
  await expectNoHorizontalScroll(page)

  const createBox = await createButton.boundingBox()
  const refreshBox = await refreshButton.boundingBox()
  expect(createBox).not.toBeNull()
  expect(refreshBox).not.toBeNull()
  expect(createBox!.height).toBeGreaterThanOrEqual(44)
  expect(refreshBox!.height).toBeGreaterThanOrEqual(44)
  await page.setViewportSize({ width: target.height, height: target.width })
  await expect(createButton).toBeVisible()
  await expect(refreshButton).toBeVisible()
  await expect(settingsScreen.locator('.metric-card')).toHaveCount(0)
  await expectNoHorizontalScroll(page)
  await expect(createButton).toBeInViewport()
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
  session:
    | typeof UNAUTHENTICATED_SESSION
    | typeof HEAD_COACH_SESSION
    | typeof COACH_RESTRICTED_SESSION,
  appConfig: AppConfigFixture = APP_CONFIG,
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
      await fulfillJson(route, appConfig)
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

    if (pathname === '/api/groups' && method === 'GET') {
      await fulfillJson(route, CLIENT_LIST_GROUPS_RESPONSE)
      return
    }

    if (pathname === '/api/clients' && method === 'GET') {
      await fulfillJson(route, CLIENTS_LIST_RESPONSE)
      return
    }

    if (pathname === '/api/clients/client-1' && method === 'GET') {
      await fulfillJson(route, CLIENT_LIST_ITEM)
      return
    }

    if (pathname === '/api/branches' && method === 'GET') {
      await fulfillJson(route, [
        {
          id: 'branch-1',
          name: 'Центр',
          address: null,
          description: null,
          isArchived: false,
          hallCount: 1,
          groupCount: 1,
          clientCount: 12,
        },
      ])
      return
    }

    if (pathname === '/api/halls' && method === 'GET') {
      await fulfillJson(route, [
        {
          id: 'hall-1',
          branchId: 'branch-1',
          branchName: 'Центр',
          name: 'Основной зал',
          description: 'Основное пространство',
          isArchived: false,
          groupCount: 1,
        },
      ])
      return
    }

    if (pathname === '/api/group-types' && method === 'GET') {
      await fulfillJson(route, [])
      return
    }

    if (pathname === '/api/settings/membership-catalog' && method === 'GET') {
      await fulfillJson(route, { items: [] })
      return
    }

    if (pathname === '/api/audit-logs/options' && method === 'GET') {
      await fulfillJson(route, {
        users: [],
        actionTypes: ['ClientCreated'],
        entityTypes: ['Client'],
        sources: ['Web'],
        messengerPlatforms: ['Telegram'],
      })
      return
    }

    if (pathname === '/api/audit-logs' && method === 'GET') {
      await fulfillJson(route, {
        items: [
          {
            id: 'audit-iphone-1',
            userName: 'Пользователь с очень длинным отображаемым именем',
            userLogin: 'long.audit.user',
            userRole: 'HeadCoach',
            source: 'Web',
            messengerPlatform: 'Telegram',
            actionType: 'ClientCreated',
            entityType: 'Client',
            entityId: 'client-1',
            description:
              'Создан новый клиент с длинным описанием для проверки двухстрочного переноса без горизонтального переполнения',
            oldValueJson: null,
            newValueJson: { status: 'Active' },
            createdAt: '2026-07-30T10:10:10.000Z',
          },
        ],
        totalCount: 1,
        skip: 0,
        take: 20,
        page: 1,
        pageSize: 20,
        hasNextPage: false,
      })
      return
    }

    throw new Error(`Unexpected target iPhone API request: ${method} ${pathname}`)
  })
}

async function mockIphoneMembershipCatalogApi(
  page: Page,
  session:
    | typeof UNAUTHENTICATED_SESSION
    | typeof HEAD_COACH_SESSION
    | typeof COACH_RESTRICTED_SESSION,
) {
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
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
      await fulfillJson(route, [])
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

    if (pathname === '/api/clients/expiring-memberships' && method === 'GET') {
      await fulfillJson(route, [])
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

    if (pathname === '/api/settings/membership-catalog' && method === 'GET') {
      await fulfillJson(route, { items: MEMBERSHIP_CATALOG_LIST_ITEMS })
      return
    }

    if (pathname === '/api/settings/membership-catalog' && method === 'POST') {
      await fulfillJson(route, {
        ...MEMBERSHIP_CATALOG_LIST_ITEMS[0],
        name: 'Новый абонемент',
      })
      return
    }

    if (pathname === '/api/branches' && method === 'GET') {
      await fulfillJson(route, [
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
      ])
      return
    }

    if (pathname === '/api/group-types' && method === 'GET') {
      await fulfillJson(route, [])
      return
    }

    if (pathname === '/api/groups/types' && method === 'GET') {
      await fulfillJson(route, [])
      return
    }

    if (pathname === '/api/settings/administrators' && method === 'GET') {
      await fulfillJson(route, {
        items: [],
        createRoleOptions: ['Administrator'],
      })
      return
    }

    if (pathname === '/api/attendance/group-types' && method === 'GET') {
      await fulfillJson(route, [])
      return
    }

    if (pathname === '/api/groups/summary' && method === 'GET') {
      await fulfillJson(route, { totalCount: 0, activeWithoutTrainerCount: 0 })
      return
    }

    if (pathname === '/api/settings/notifications' && method === 'GET') {
      await route.continue()
      return
    }

    if (pathname === '/api/users' && method === 'GET') {
      await fulfillJson(route, [])
      return
    }

    throw new Error(`Unexpected iPhone target catalog API request: ${method} ${pathname}`)
  })
}

async function fulfillJson(route: Route, payload: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(payload),
  })
}

async function expectSemanticSurfacePaint(
  surface: Locator,
  id: string,
) {
  const paint = await surface.evaluate((element) => {
    const style = window.getComputedStyle(element)
    const probe = document.createElement('div')

    probe.style.position = 'absolute'
    probe.style.width = '0'
    probe.style.height = '0'
    probe.style.overflow = 'hidden'
    probe.style.pointerEvents = 'none'
    probe.style.background = 'var(--crm-surface-card)'
    probe.style.borderColor = 'var(--crm-border-muted)'
    element.appendChild(probe)

    const probeStyle = window.getComputedStyle(probe)
    const result = {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderTopColor,
      borderRadius: style.borderTopLeftRadius,
      borderStyle: style.borderTopStyle,
      borderWidth: style.borderTopWidth,
      boxShadow: style.boxShadow,
      expectedBackgroundColor: probeStyle.backgroundColor,
      expectedBorderColor: probeStyle.borderTopColor,
    }

    probe.remove()
    return result
  })

  expect(paint.backgroundColor, `${id} background`).toBe(paint.expectedBackgroundColor)
  expect(paint.borderColor, `${id} border color`).toBe(paint.expectedBorderColor)
  expect(paint.borderStyle, `${id} border style`).toBe('solid')
  expect(paint.borderWidth, `${id} border width`).toBe('1px')
  expect(paint.borderRadius, `${id} border radius`).toBe('10px')
  expect(paint.boxShadow, `${id} shadow`).toBe('none')
}

function hasRequestParams(
  currentParams: Record<string, string>,
  expectedParams: Record<string, string>,
) {
  return Object.entries(expectedParams).every(
    ([key, expectedValue]) => currentParams[key] === expectedValue,
  )
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
