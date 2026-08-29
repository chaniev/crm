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

const CLIENT_MEMBERSHIP = {
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
  coverageKind: 'TargetGroups',
  entitlementState: 'Active',
  targetGroups: [],
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
  currentMemberships: [CLIENT_MEMBERSHIP],
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

const ATTENDANCE_GROUPS_RESPONSE = {
  groups: [
    {
      id: 'group-1',
      name: 'Группа 7: вечер',
      trainingStartTime: '19:00',
      durationMinutes: 60,
      weekdays: [2, 4],
      clientCount: 1,
    },
  ],
  today: '2026-04-18',
  maxTrainingDate: '2026-04-18',
} as const

const ATTENDANCE_ROSTER_RESPONSE = {
  groupId: 'group-1',
  trainingDate: '2026-04-18',
  today: '2026-04-18',
  maxTrainingDate: '2026-04-18',
  clients: [
    {
      id: 'client-1',
      fullName: 'Александр Петров',
      state: 'Unmarked',
      hasActiveMembership: false,
      membershipWarning: true,
      membershipWarningMessage: 'Абонемент просрочен, отметка посещения доступна.',
      groups: [
        {
          id: 'group-1',
          name: 'Группа 7: вечер',
          isActive: true,
        },
      ],
    },
    {
      id: 'client-2',
      fullName: 'Мария Зайцева',
      state: 'Absent',
      hasActiveMembership: true,
      membershipWarning: false,
      groups: [
        {
          id: 'group-1',
          name: 'Группа 7: вечер',
          isActive: true,
        },
      ],
    },
  ],
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

const SCHEDULE_GROUPS_RESPONSE = {
  items: Array.from({ length: 6 }, (_, index) => ({
    id: `iphone-schedule-${index + 1}`,
    name: `Мобильная группа ${index + 1} с длинным названием`,
    branchId: 'branch-1',
    branchName: 'Центр',
    hallId: 'hall-1',
    hallName: 'Основной зал',
    groupTypeId: 'type-1',
    groupTypeName: 'Базовый',
    trainingStartTime: '09:00',
    durationMinutes: 60,
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    trainers: [{
      id: `coach-${index + 1}`,
      fullName: `Тренер ${index + 1}`,
      login: `coach-${index + 1}`,
    }],
    trainerIds: [`coach-${index + 1}`],
    trainerCount: 1,
    trainerNames: [`Тренер ${index + 1}`],
    clientCount: 10 + index,
    isActive: true,
  })),
  totalCount: 6,
  skip: 0,
  take: 100,
} as const

const SCHEDULE_IOS_LESSON_CARD = {
  lessonOccurrenceId: 'occ-evening',
  sourceKind: 'Recurring',
  isMaterialized: false,
  lessonSeriesId: 'series-1',
  lessonDate: '2026-08-20',
  startTime: '18:00',
  durationMinutes: 50,
  endTime: '18:50',
  groupId: 'group-1',
  groupName: 'Утренняя база',
  groupTypeId: 'type-1',
  groupTypeName: 'Кардио',
  branchId: 'branch-1',
  branchName: 'Центр',
  hallId: 'hall-1',
  hallName: 'Основной зал',
  effectiveTrainers: [{
    trainerId: 'trainer-1',
    fullName: 'Алиса',
    kind: 'Permanent',
    replacedTrainerId: null,
    substitutionId: null,
  }],
  status: 'Scheduled',
  hasAttendanceMarks: true,
  allowedActions: {
    viewAttendance: { allowed: true, reason: null },
    editAttendance: { allowed: true, reason: null },
    edit: { allowed: false, reason: 'not-implemented' },
    move: { allowed: false, reason: 'not-implemented' },
    cancel: { allowed: false, reason: 'not-implemented' },
    restore: { allowed: false, reason: 'not-cancelled' },
    assignTrainerSubstitution: { allowed: false, reason: 'not-implemented' },
    cancelTrainerSubstitution: { allowed: false, reason: 'no-substitution' },
  },
  revision: 'revision-1',
} as const

const SCHEDULE_IOS_DISABLED_LESSON_CARD = {
  ...SCHEDULE_IOS_LESSON_CARD,
  allowedActions: {
    ...SCHEDULE_IOS_LESSON_CARD.allowedActions,
    viewAttendance: { allowed: false, reason: 'attendance-forbidden' },
  },
} as const

const SCHEDULE_IOS_MOVABLE_LESSON_CARD = {
  ...SCHEDULE_IOS_LESSON_CARD,
  lessonOccurrenceId: 'occ-evening-movable',
  allowedActions: {
    ...SCHEDULE_IOS_LESSON_CARD.allowedActions,
    move: { allowed: true, reason: null },
  },
  revision: 'revision-1',
} as const

const SCHEDULE_IOS_ATTENDANCE_ROSTER = {
  groupId: 'group-1',
  trainingDate: '2026-08-20',
  lessonOccurrenceId: 'occ-evening',
  lessonDate: '2026-08-20',
  canEditAttendance: { allowed: true, reason: null },
  today: '2026-08-20',
  minTrainingDate: null,
  maxTrainingDate: '2026-08-20',
  clients: [{
    id: 'client-1',
    fullName: 'Иван Иванов',
    groups: [{
      id: 'group-1',
      name: 'Утренняя база',
      isActive: true,
      branchId: 'branch-1',
      branchName: 'Центр',
    }],
    photo: null,
    state: 'Unmarked',
    isProfessional: false,
    professionalComment: null,
    hasActiveMembership: true,
    membershipWarning: false,
    membershipWarningMessage: null,
    currentMemberships: [],
  }],
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
  },
} as const

const FINANCE_TARGET_SESSION = {
  ...HEAD_COACH_SESSION,
  csrfToken: 'iphone-target-finance-csrf-token',
  user: {
    ...HEAD_COACH_SESSION.user,
    allowedSections: [...HEAD_COACH_SESSION.user.allowedSections, 'Finance'],
  },
} as const

const TARGET_FINANCE_REPORT = {
  period: {
    preset: 'month',
    anchorDate: '2026-08-23',
    from: '2026-08-01',
    to: '2026-08-31',
  },
  totals: {
    soldMembershipCount: 4,
    grossSales: 18_000,
    refundTotal: 2_000,
    netTotal: 16_000,
    newClientsCount: 3,
  },
  branchBreakdown: [
    {
      branchId: 'branch-1',
      branchName: 'Северный филиал',
      soldMembershipCount: 4,
      grossSales: 18_000,
      refundTotal: 2_000,
      netTotal: 16_000,
      newClientsCount: 3,
    },
  ],
  groupBreakdown: [
    {
      groupId: 'group-1',
      groupName: 'Вечерняя группа',
      branchId: 'branch-1',
      branchName: 'Северный филиал',
      soldMembershipCount: 4,
      grossSales: 18_000,
      refundTotal: 2_000,
      netTotal: 16_000,
      newClientsCount: 3,
    },
  ],
  trainerBreakdown: [
    {
      trainerId: 'trainer-1',
      trainerName: 'Ирина Тренер',
      soldMembershipCount: 4,
      grossSales: 18_000,
      refundTotal: 2_000,
      netTotal: 16_000,
      newClientsCount: 3,
    },
  ],
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
    landingScreen: 'Attendance',
    allowedSections: ['Attendance', 'Schedule', 'Clients'],
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

  const headingStyle = await heading.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      fontSize: Number.parseFloat(style.fontSize),
      fontWeight: Number.parseInt(style.fontWeight, 10),
    }
  })
  expect(headingStyle.fontSize).toBeLessThanOrEqual(22)
  expect(headingStyle.fontWeight).toBeLessThanOrEqual(700)

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

test('TASK-108 target iPhone keeps finance context and compact-height recovery reachable', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)

  await mockIphoneFinanceApi(page)
  await page.goto('/finance')

  const scopeHeader = page.getByTestId('finance-scope-header')
  const filterPanel = page.getByTestId('finance-filter-panel')
  const filterLauncher = filterPanel.getByRole('button', { name: 'Фильтры' })
  const firstBreakdown = page.getByRole('button', { name: 'По филиалам' })

  expect(testInfo.project.use.screen).toEqual(target)
  expect(testInfo.project.use.hasTouch).toBe(true)
  await expect(scopeHeader).toContainText('Отчет: 01.08.2026–31.08.2026')
  await expect(scopeHeader).toContainText('Филиал: Все филиалы')
  await expect(scopeHeader).toContainText('Тренер: Все тренеры')
  await expect(filterLauncher).toBeVisible()
  await expect(page.getByTestId('finance-totals')).toBeVisible()
  await expect(firstBreakdown).toBeVisible()

  const portraitGeometry = await firstBreakdown.evaluate((element) => ({
    breakdownTop: element.getBoundingClientRect().top,
    visualViewportHeight: window.visualViewport?.height ?? window.innerHeight,
  }))
  expect(portraitGeometry.breakdownTop).toBeLessThanOrEqual(
    portraitGeometry.visualViewportHeight + 1,
  )
  await expectNoHorizontalScroll(page)

  await filterLauncher.click()
  const doneButton = page.getByRole('button', { name: 'Готово' })
  await expect(page.getByLabel('Дата в периоде')).toBeVisible()
  await expect(doneButton).toBeInViewport()
  await doneButton.click()
  await expect(filterLauncher).toBeFocused()

  await page.setViewportSize({ width: target.height, height: target.width })
  await expect(filterLauncher).toBeVisible()
  await filterLauncher.click()

  const compactDateInput = page.getByLabel('Дата в периоде')
  const compactDoneButton = page.getByRole('button', { name: 'Готово' })
  await compactDateInput.focus()
  await compactDoneButton.scrollIntoViewIfNeeded()
  await expect(compactDateInput).toBeVisible()
  await expect(compactDoneButton).toBeInViewport()

  const drawerGeometry = await page
    .locator('.compact-filter-panel__sheet-content')
    .evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const actions = element
        .querySelector('.compact-filter-panel__sheet-actions')
        ?.getBoundingClientRect()

      return {
        actionBottom: actions?.bottom ?? Number.POSITIVE_INFINITY,
        drawerHeight: rect.height,
        viewportHeight: window.innerHeight,
      }
    })
  expect(drawerGeometry.drawerHeight).toBeLessThanOrEqual(
    drawerGeometry.viewportHeight + 1,
  )
  expect(drawerGeometry.actionBottom).toBeLessThanOrEqual(
    drawerGeometry.viewportHeight + 1,
  )
  await expectNoHorizontalScroll(page)
})

test('TASK-114 target iPhone keeps membership sale comments isolated through reload', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)
  let commentA = 'Комментарий A'
  const commentB = 'Комментарий B'
  const updateRequests: Array<{ body: unknown; pathname: string }> = []
  const buildDetails = () => {
    const version = (
      id: string,
      saleId: string,
      purchaseDate: string,
      comment: string,
      actor: string,
      changedAt: string,
    ) => ({
      ...CLIENT_MEMBERSHIP,
      id,
      saleId,
      purchaseDate,
      paymentDate: purchaseDate,
      validFrom: changedAt,
      comment,
      commentLastChangedByName: actor,
      commentLastChangedAt: changedAt,
    })
    const saleALatest = version(
      'sale-a-version-2',
      'sale-a',
      '2026-07-01',
      commentA,
      commentA === 'Комментарий A' ? 'Автор A' : 'Главный тренер',
      commentA === 'Комментарий A' ? '2026-07-20T10:00:00Z' : '2026-07-22T12:34:56Z',
    )
    return {
      ...CLIENT_LIST_ITEM,
      currentMemberships: [saleALatest],
      membershipHistory: [
        saleALatest,
        {
          ...version(
            'sale-a-version-1',
            'sale-a',
            '2026-07-01',
            commentA,
            commentA === 'Комментарий A' ? 'Автор A' : 'Главный тренер',
            commentA === 'Комментарий A' ? '2026-07-20T10:00:00Z' : '2026-07-22T12:34:56Z',
          ),
          changeReason: 'NewPurchase',
        },
        version(
          'sale-b-version-1',
          'sale-b',
          '2026-06-01',
          commentB,
          'Автор B',
          '2026-07-21T11:00:00Z',
        ),
      ],
    }
  }

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
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
    if (pathname === '/api/clients/client-1' && method === 'GET') {
      await fulfillJson(route, buildDetails())
      return
    }
    if (pathname === '/api/groups' && method === 'GET') {
      await fulfillJson(route, CLIENT_LIST_GROUPS_RESPONSE)
      return
    }
    if (pathname === '/api/clients/client-1/messenger/telegram' && method === 'GET') {
      await fulfillJson(route, {})
      return
    }
    if (pathname === '/api/clients/client-1/membership/sales/sale-a/comment' && method === 'PUT') {
      const body = request.postDataJSON() as { comment: string }
      updateRequests.push({ body, pathname })
      commentA = body.comment
      await fulfillJson(route, buildDetails())
      return
    }

    throw new Error(`Unexpected TASK-114 iPhone API request: ${method} ${pathname}`)
  })

  await page.goto('/clients/client-1')
  expect(testInfo.project.use.screen).toEqual(target)
  expect(testInfo.project.use.hasTouch).toBe(true)
  await expect(page.getByText('Комментарий к покупке')).toHaveCount(2)
  const saleA = page.getByTestId('membership-sale-comment-sale-a')
  const saleB = page.getByTestId('membership-sale-comment-sale-b')
  await expect(saleB.getByText(commentB)).toBeVisible()

  await saleA.getByRole('button', { name: /Редактировать комментарий/ }).click()
  const input = saleA.getByRole('textbox', { name: 'Комментарий к покупке' })
  await input.fill('Комментарий A обновлён')
  await expect(input).toBeVisible()
  const save = saleA.getByRole('button', { name: 'Сохранить' })
  await save.scrollIntoViewIfNeeded()
  await expect(save).toBeInViewport()
  await save.click()

  await expect(saleA.getByText('Комментарий A обновлён')).toBeVisible()
  await expect(saleB.getByText(commentB)).toBeVisible()
  expect(updateRequests).toEqual([{
    body: { comment: 'Комментарий A обновлён' },
    pathname: '/api/clients/client-1/membership/sales/sale-a/comment',
  }])
  await page.reload()
  await expect(page.getByTestId('membership-sale-comment-sale-a').getByText('Комментарий A обновлён')).toBeVisible()
  await expect(page.getByTestId('membership-sale-comment-sale-b').getByText(commentB)).toBeVisible()
  await expectNoHorizontalScroll(page)

  await page.setViewportSize({ width: target.height, height: target.width })
  await page.getByTestId('membership-sale-comment-sale-a').scrollIntoViewIfNeeded()
  await expect(page.getByTestId('membership-sale-comment-sale-a')).toBeVisible()
  await expect(page.getByTestId('membership-sale-comment-sale-b')).toBeVisible()
  await expectNoHorizontalScroll(page)
})

test('target portrait profile menu trigger stays reachable and keyboard-closeable', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)
  const profileMenuName = `Открыть профильное меню пользователя ${HEAD_COACH_SESSION.user.fullName}`

  await mockApi(page, HEAD_COACH_SESSION)
  await page.goto('/attention')

  const header = page.locator('.app-shell__header')
  const profileTrigger = page.getByRole('button', {
    name: profileMenuName,
  })
  const menu = page.getByRole('menu')

  await expect(profileTrigger).toBeVisible()
  await expect(profileTrigger).toHaveAccessibleName(profileMenuName)
  await expect(profileTrigger).toHaveAttribute('aria-haspopup', 'menu')
  await expect(profileTrigger).toHaveAttribute('aria-expanded', 'false')

  const profileBox = await profileTrigger.boundingBox()
  const headerBox = await header.boundingBox()
  const visualViewport = page.viewportSize()

  expect(profileBox).not.toBeNull()
  expect(headerBox).not.toBeNull()
  expect(visualViewport).not.toBeNull()
  expect(profileBox!.width).toBeGreaterThanOrEqual(44)
  expect(profileBox!.height).toBeGreaterThanOrEqual(44)
  expect(profileBox!.x).toBeGreaterThanOrEqual(headerBox!.x)
  expect(profileBox!.x + profileBox!.width).toBeLessThanOrEqual(
    headerBox!.x + headerBox!.width,
  )
  expect(profileBox!.y).toBeGreaterThanOrEqual(headerBox!.y)
  expect(profileBox!.y + profileBox!.height).toBeLessThanOrEqual(
    headerBox!.y + headerBox!.height,
  )
  expect(profileBox!.x + profileBox!.width).toBeLessThanOrEqual(visualViewport!.width)
  expect(profileBox!.y + profileBox!.height).toBeLessThanOrEqual(visualViewport!.height)

  await page.touchscreen.tap(profileBox!.x + profileBox!.width / 2, profileBox!.y + profileBox!.height / 2)
  await expect(menu).toBeVisible()
  await expect(profileTrigger).toHaveAttribute('aria-expanded', 'true')
  const menuBox = await menu.boundingBox()
  expect(menuBox).not.toBeNull()
  expect(menuBox!.x).toBeGreaterThanOrEqual(0)
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(visualViewport!.width)
  expect(menuBox!.y).toBeGreaterThanOrEqual(0)
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(visualViewport!.height)

  await page.touchscreen.tap(
    profileBox!.x + profileBox!.width / 2,
    profileBox!.y + profileBox!.height / 2,
  )
  await expect(menu).toBeHidden()
  await expect(profileTrigger).toHaveAttribute('aria-expanded', 'false')
  await expectNoHorizontalScroll(page)

  await profileTrigger.focus()
  await page.keyboard.press('Enter')
  await expect(profileTrigger).toHaveAttribute('aria-expanded', 'true')
  await expect(menu).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(profileTrigger).toHaveAttribute('aria-expanded', 'false')
  await expect(menu).toBeHidden()
  await expect(profileTrigger).toBeFocused()

  await page.keyboard.press('Space')
  await expect(profileTrigger).toHaveAttribute('aria-expanded', 'true')
  await expect(menu).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(profileTrigger).toHaveAttribute('aria-expanded', 'false')
  await expect(menu).toBeHidden()
  await expect(profileTrigger).toBeFocused()

  const focusGeometry = await profileTrigger.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const headerRect = element.closest('.app-shell__header')?.getBoundingClientRect()
    const style = getComputedStyle(element)
    const outlineWidth = Number.parseFloat(style.outlineWidth) || 0
    const outlineOffset = Number.parseFloat(style.outlineOffset) || 0
    const outlineOutset = outlineWidth + outlineOffset

    return {
      header: headerRect
        ? {
            bottom: headerRect.bottom,
            left: headerRect.left,
            right: headerRect.right,
            top: headerRect.top,
          }
        : null,
      outlineBottom: rect.bottom + outlineOutset,
      outlineLeft: rect.left - outlineOutset,
      outlineRight: rect.right + outlineOutset,
      outlineStyle: style.outlineStyle,
      outlineTop: rect.top - outlineOutset,
      outlineWidth,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    }
  })

  expect(focusGeometry.header).not.toBeNull()
  expect(focusGeometry.outlineStyle).not.toBe('none')
  expect(focusGeometry.outlineWidth).toBeGreaterThanOrEqual(2)
  expect(focusGeometry.outlineLeft).toBeGreaterThanOrEqual(focusGeometry.header!.left)
  expect(focusGeometry.outlineRight).toBeLessThanOrEqual(focusGeometry.header!.right)
  expect(focusGeometry.outlineTop).toBeGreaterThanOrEqual(focusGeometry.header!.top)
  expect(focusGeometry.outlineBottom).toBeLessThanOrEqual(focusGeometry.header!.bottom)
  expect(focusGeometry.outlineLeft).toBeGreaterThanOrEqual(0)
  expect(focusGeometry.outlineRight).toBeLessThanOrEqual(focusGeometry.viewportWidth)
  expect(focusGeometry.outlineTop).toBeGreaterThanOrEqual(0)
  expect(focusGeometry.outlineBottom).toBeLessThanOrEqual(focusGeometry.viewportHeight)
  await expectNoHorizontalScroll(page)

  const environment = await page.evaluate(() => ({
    devicePixelRatio: window.devicePixelRatio,
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    screenHeight: window.screen.height,
    screenWidth: window.screen.width,
    userAgent: navigator.userAgent,
  }))

  expect(testInfo.project.use.hasTouch).toBe(true)
  expect(environment.devicePixelRatio).toBe(3)
  expect(environment.screenWidth).toBe(target.width)
  expect(environment.innerWidth).toBe(target.width)
  expect(environment.innerHeight).toBeLessThanOrEqual(target.height)
  expect(environment.userAgent).toContain('iPhone')
})

test('target iPhone schedule preserves the mobile timeline in portrait and touch landscape', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)

  await mockApi(page, HEAD_COACH_SESSION)
  await page.goto('/schedule?date=2026-08-20&view=day')

  await expect(page.getByTestId('schedule-screen')).toBeVisible()
  await expect(page.getByTestId('schedule-toolbar')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Параметры календаря' })).toBeVisible()
  await expect(page.getByTestId('schedule-day-section-2026-08-20')).toBeVisible()
  await expect(page.getByTestId('schedule-card-occ-evening')).toContainText(
    'Утренняя база',
  )
  await expect(page.getByTestId('schedule-week-view')).toHaveCount(0)
  await expect(page.locator(MOBILE_BOTTOM_NAVIGATION_SELECTOR)).toBeVisible()
  await expectNoHorizontalScroll(page)

  expect(testInfo.project.use.hasTouch).toBe(true)

  await page.setViewportSize({ width: target.height, height: target.width })

  await expect(page.getByTestId('schedule-toolbar')).toBeVisible()
  await expect(page.getByTestId('schedule-day-section-2026-08-20')).toBeVisible()
  await expect(page.getByTestId('schedule-card-occ-evening')).toContainText(
    'Утренняя база',
  )
  await expect(page.getByRole('button', { name: 'Параметры календаря' })).toBeVisible()
  await expect(page.locator(MOBILE_BOTTOM_NAVIGATION_SELECTOR)).toBeVisible()
  await expectNoHorizontalScroll(page)
})

test('target iPhone opens exact attendance from schedule occurrence and stays state-safe after save', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)
  let savedPayload: unknown = null

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
        today: '2026-08-20',
        maxTrainingDate: '2026-08-20',
      })
      return
    }

    if (pathname === '/api/schedule/lessons' && method === 'GET') {
      await fulfillJson(route, {
        ...scheduleLessonsResponse({}),
        items: [SCHEDULE_IOS_LESSON_CARD],
      })
      return
    }

    if (
      pathname === '/api/attendance/lessons/occ-evening/clients' &&
      method === 'GET'
    ) {
      expect(searchParams.get('lessonDate')).toBe('2026-08-20')
      await fulfillJson(route, SCHEDULE_IOS_ATTENDANCE_ROSTER)
      return
    }

    if (pathname === '/api/attendance/lessons/occ-evening' && method === 'POST') {
      savedPayload = route.request().postDataJSON()
      await fulfillJson(route, {
        ...SCHEDULE_IOS_ATTENDANCE_ROSTER,
        attendanceMarks: [{
          clientId: 'client-1',
          state: 'Present',
        }],
      })
      return
    }

    throw new Error(`Unexpected schedule attendance API request: ${method} ${pathname}`)
  })

  await page.setViewportSize(target)
  await page.goto('/schedule?date=2026-08-20&view=day')

  const eveningCard = page.getByTestId('schedule-card-occ-evening')
  await expect(eveningCard).toBeVisible()
  await eveningCard.getByRole('button', { name: /Открыть посещаемость/ }).click()
  await expect(page).toHaveURL('/attendance/occ-evening?lessonDate=2026-08-20')

  await expect(page.getByTestId('attendance-client-card-client-1')).toBeVisible()
  await page.getByRole('radio', { name: 'Был', exact: true }).click()

  await expect.poll(() => savedPayload).toEqual({
    LessonDate: '2026-08-20',
    AttendanceMarks: [{ ClientId: 'client-1', State: 'Present' }],
  })

  await page.goBack()
  await expect(page).toHaveURL(/\/schedule\?date=2026-08-20&view=day(&.*)?$/)
  await expect(eveningCard).toBeVisible()
  await expectNoHorizontalScroll(page)
})

test('target iPhone creates one-off lesson through preview and opens exact detail route', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)
  let previewPayload: unknown = null
  let executePayload: unknown = null

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
        today: '2026-08-20',
        maxTrainingDate: '2026-08-20',
      })
      return
    }

    if (pathname === '/api/schedule/lessons' && method === 'GET') {
      await fulfillJson(route, {
        ...scheduleLessonsResponse({}),
        items: [SCHEDULE_IOS_LESSON_CARD],
      })
      return
    }

    if (pathname === '/api/schedule/lessons/one-off/preview' && method === 'POST') {
      expect(route.request().headers()['x-csrf-token']).toBe(HEAD_COACH_SESSION.csrfToken)
      previewPayload = route.request().postDataJSON()
      await fulfillJson(route, {
        confirmationToken: 'one-off-preview-token',
        expiresAt: '2026-08-20T09:15:00Z',
        lesson: {
          lessonOccurrenceId: 'preview-one-off',
          sourceKind: 'OneOff',
          isMaterialized: false,
          lessonDate: '2026-08-20',
          startTime: '12:30',
          durationMinutes: 60,
          endTime: '13:30',
          groupId: 'group-1',
          groupName: 'Утренняя база',
          groupTypeId: 'type-1',
          groupTypeName: 'Кардио',
          branchId: 'branch-1',
          branchName: 'Центр',
          hallId: 'hall-1',
          hallName: 'Основной зал',
          effectiveTrainers: [{
            trainerId: 'trainer-1',
            fullName: 'Алиса',
            kind: 'Permanent',
            replacedTrainerId: null,
            substitutionId: null,
          }],
          status: 'Scheduled',
          hasAttendanceMarks: false,
          allowedActions: {
            viewAttendance: { allowed: true, reason: null },
            editAttendance: { allowed: true, reason: null },
            edit: { allowed: false, reason: 'not-implemented' },
            move: { allowed: false, reason: 'not-implemented' },
            cancel: { allowed: false, reason: 'not-implemented' },
            restore: { allowed: false, reason: 'not-cancelled' },
            assignTrainerSubstitution: { allowed: false, reason: 'not-implemented' },
            cancelTrainerSubstitution: { allowed: false, reason: 'no-substitution' },
          },
          revision: 'preview-one-off',
        },
        warnings: [{ code: 'hall-load', message: 'Проверьте нагрузку зала.' }],
      })
      return
    }

    if (pathname === '/api/schedule/lessons/one-off' && method === 'POST') {
      expect(route.request().headers()['x-csrf-token']).toBe(HEAD_COACH_SESSION.csrfToken)
      executePayload = route.request().postDataJSON()
      await fulfillJson(route, {
        lessonOccurrenceId: 'created-one-off',
        sourceKind: 'OneOff',
        isMaterialized: true,
        lessonDate: '2026-08-20',
        startTime: '12:30',
        durationMinutes: 60,
        endTime: '13:30',
        groupId: 'group-1',
        groupName: 'Утренняя база',
        groupTypeId: 'type-1',
        groupTypeName: 'Кардио',
        branchId: 'branch-1',
        branchName: 'Центр',
        hallId: 'hall-1',
        hallName: 'Основной зал',
        effectiveTrainers: [{
          trainerId: 'trainer-1',
          fullName: 'Алиса',
          kind: 'Permanent',
          replacedTrainerId: null,
          substitutionId: null,
        }],
        status: 'Scheduled',
        hasAttendanceMarks: false,
        allowedActions: {
          viewAttendance: { allowed: true, reason: null },
          editAttendance: { allowed: true, reason: null },
          edit: { allowed: false, reason: 'not-implemented' },
          move: { allowed: false, reason: 'not-implemented' },
          cancel: { allowed: false, reason: 'not-implemented' },
          restore: { allowed: false, reason: 'not-cancelled' },
          assignTrainerSubstitution: { allowed: false, reason: 'not-implemented' },
          cancelTrainerSubstitution: { allowed: false, reason: 'no-substitution' },
        },
        revision: 'created-one-off',
      })
      return
    }

    if (pathname === '/api/schedule/lessons/created-one-off' && method === 'GET') {
      await fulfillJson(route, {
        lessonOccurrenceId: 'created-one-off',
        sourceKind: 'OneOff',
        isMaterialized: true,
        lessonDate: '2026-08-20',
        startTime: '12:30',
        durationMinutes: 60,
        endTime: '13:30',
        groupId: 'group-1',
        groupName: 'Утренняя база',
        groupTypeId: 'type-1',
        groupTypeName: 'Кардио',
        branchId: 'branch-1',
        branchName: 'Центр',
        hallId: 'hall-1',
        hallName: 'Основной зал',
        effectiveTrainers: [{
          trainerId: 'trainer-1',
          fullName: 'Алиса',
          kind: 'Permanent',
          replacedTrainerId: null,
          substitutionId: null,
        }],
        status: 'Scheduled',
        hasAttendanceMarks: false,
        allowedActions: {
          viewAttendance: { allowed: true, reason: null },
          editAttendance: { allowed: true, reason: null },
          edit: { allowed: false, reason: 'not-implemented' },
          move: { allowed: false, reason: 'not-implemented' },
          cancel: { allowed: false, reason: 'not-implemented' },
          restore: { allowed: false, reason: 'not-cancelled' },
          assignTrainerSubstitution: { allowed: false, reason: 'not-implemented' },
          cancelTrainerSubstitution: { allowed: false, reason: 'no-substitution' },
        },
        revision: 'created-one-off',
      })
      return
    }

    throw new Error(`Unexpected one-off schedule API request: ${method} ${pathname}`)
  })

  await page.setViewportSize(target)
  await page.goto('/schedule?date=2026-08-20&view=day')

  await page.getByRole('button', { name: 'Создать разовое занятие' }).click()

  const createDialog = page.getByTestId('schedule-lesson-create-screen')
  await expect(createDialog).toBeVisible()
  await createDialog.getByLabel('Дата').fill('2026-08-20')
  await createDialog.getByLabel('Время').fill('12:30')
  await expect(createDialog.getByRole('button', { name: 'Получить предпросмотр' })).toBeEnabled()
  await createDialog.getByRole('button', { name: 'Получить предпросмотр' }).click()

  await expect.poll(() => previewPayload).toEqual({
    groupId: 'group-1',
    lessonDate: '2026-08-20',
    startTime: '12:30',
    durationMinutes: 60,
    hallId: 'hall-1',
  })
  await expect(createDialog.getByText('Проверьте нагрузку зала.')).toBeVisible()

  const createButton = createDialog.getByRole('button', { name: 'Создать занятие' })
  const cancelButton = createDialog.getByRole('button', { name: 'Отмена' })
  const createBox = await createButton.boundingBox()
  const cancelBox = await cancelButton.boundingBox()
  expect(createBox).not.toBeNull()
  expect(cancelBox).not.toBeNull()
  expect(createBox!.height).toBeGreaterThanOrEqual(44)
  expect(cancelBox!.height).toBeGreaterThanOrEqual(44)

  await createButton.click()

  await expect.poll(() => executePayload).toEqual({
    groupId: 'group-1',
    lessonDate: '2026-08-20',
    startTime: '12:30',
    durationMinutes: 60,
    hallId: 'hall-1',
    confirmationToken: 'one-off-preview-token',
  })

  await expect(page).toHaveURL(/\/schedule\/lessons\/created-one-off\?lessonDate=2026-08-20$/)
  await expect(page.getByTestId('schedule-lesson-detail-screen')).toBeVisible()

  await expectNoHorizontalScroll(page)
})

test('target iPhone recovers one-off confirmation when preview becomes stale', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)
  let executeCalls = 0

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
        today: '2026-08-20',
        maxTrainingDate: '2026-08-20',
      })
      return
    }

    if (pathname === '/api/schedule/lessons' && method === 'GET') {
      expect(pathname).toBe('/api/schedule/lessons')
      await fulfillJson(route, {
        ...scheduleLessonsResponse({}),
        items: [SCHEDULE_IOS_LESSON_CARD],
      })
      return
    }

    if (pathname === '/api/schedule/lessons/one-off/preview' && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          confirmationToken: 'stale-preview-token',
          expiresAt: '2026-08-20T09:15:00Z',
          lesson: {
            lessonOccurrenceId: 'preview-one-off',
            sourceKind: 'OneOff',
            isMaterialized: false,
            lessonDate: '2026-08-20',
            startTime: '12:30',
            durationMinutes: 60,
            endTime: '13:30',
            groupId: 'group-1',
            groupName: 'Утренняя база',
            groupTypeId: 'type-1',
            groupTypeName: 'Кардио',
            branchId: 'branch-1',
            branchName: 'Центр',
            hallId: 'hall-1',
            hallName: 'Основной зал',
            effectiveTrainers: [{
              trainerId: 'trainer-1',
              fullName: 'Алиса',
              kind: 'Permanent',
              replacedTrainerId: null,
              substitutionId: null,
            }],
            status: 'Scheduled',
            hasAttendanceMarks: false,
            allowedActions: {
              viewAttendance: { allowed: true, reason: null },
              editAttendance: { allowed: true, reason: null },
              edit: { allowed: false, reason: 'not-implemented' },
              move: { allowed: false, reason: 'not-implemented' },
              cancel: { allowed: false, reason: 'not-implemented' },
              restore: { allowed: false, reason: 'not-cancelled' },
              assignTrainerSubstitution: { allowed: false, reason: 'not-implemented' },
              cancelTrainerSubstitution: { allowed: false, reason: 'no-substitution' },
            },
            revision: 'preview-one-off',
          },
          warnings: [],
        }),
      })
      return
    }

    if (pathname === '/api/schedule/lessons/one-off' && method === 'POST') {
      executeCalls += 1
      await route.fulfill({
        status: 409,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          title: 'Schedule confirmation token is not valid for this mutation.',
          code: 'lesson-mutation-preview-stale',
        }),
      })
      return
    }

    throw new Error(`Unexpected stale one-off API request: ${method} ${pathname}`)
  })

  await page.setViewportSize(target)
  await page.goto('/schedule?date=2026-08-20&view=day')

  await page.getByRole('button', { name: 'Создать разовое занятие' }).click()
  const createDialog = page.getByTestId('schedule-lesson-create-screen')
  await expect(createDialog).toBeVisible()
  await createDialog.getByLabel('Время').fill('12:30')
  await createDialog.getByRole('button', { name: 'Получить предпросмотр' }).click()
  await expect(createDialog.getByText('Проверьте занятие перед созданием')).toBeVisible()
  await createDialog.getByRole('button', { name: 'Создать занятие' }).click()

  await expect(createDialog.getByText('Параметры изменились после предпросмотра. Получите новый предпросмотр.')).toBeVisible()
  await expect(createDialog.getByText('lesson-mutation-preview-stale')).toHaveCount(0)
  await expect(createDialog.getByLabel('Время')).toHaveValue('12:30')
  await expect(createDialog.getByRole('button', { name: 'Обновить предпросмотр' })).toBeVisible()
  expect(executeCalls).toBe(1)
  await expectNoHorizontalScroll(page)
})

test('target iPhone moves exact occurrence after preview and keeps returned lesson date', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)
  let previewPayload: unknown = null
  let executePayload: unknown = null

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
        today: '2026-08-20',
        maxTrainingDate: '2026-08-20',
      })
      return
    }

    if (pathname === '/api/schedule/lessons' && method === 'GET') {
      const requestedFrom = searchParams.get('from')
      const requestedTo = searchParams.get('to')
      expect(['2026-08-20', '2026-08-21']).toContain(requestedFrom)
      expect(['2026-08-20', '2026-08-21']).toContain(requestedTo)
      const isMovedDay = requestedFrom === '2026-08-21'
      await fulfillJson(route, {
        ...scheduleLessonsResponse({
          date: isMovedDay ? '2026-08-21' : '2026-08-20',
          from: requestedFrom ?? undefined,
          to: requestedTo ?? undefined,
        }),
        items: [
          {
            ...SCHEDULE_IOS_MOVABLE_LESSON_CARD,
            lessonOccurrenceId: 'occ-evening',
            lessonDate: isMovedDay ? '2026-08-21' : '2026-08-20',
            startTime: isMovedDay ? '11:15' : '18:00',
            durationMinutes: 60,
            endTime: isMovedDay ? '12:15' : '19:00',
            revision: isMovedDay ? 'revision-2' : 'revision-1',
          },
        ],
      })
      return
    }

    if (pathname === '/api/schedule/lessons/occ-evening' && method === 'GET') {
      await fulfillJson(route, {
        lessonOccurrenceId: 'occ-evening',
        sourceKind: 'Recurring',
        isMaterialized: true,
        lessonDate: searchParams.get('lessonDate') ?? '2026-08-20',
        startTime: searchParams.get('lessonDate') === '2026-08-21' ? '11:15' : '18:00',
        durationMinutes: 60,
        endTime: searchParams.get('lessonDate') === '2026-08-21' ? '12:15' : '19:00',
        groupId: 'group-1',
        groupName: 'Утренняя база',
        groupTypeId: 'type-1',
        groupTypeName: 'Кардио',
        branchId: 'branch-1',
        branchName: 'Центр',
        hallId: 'hall-1',
        hallName: 'Основной зал',
        effectiveTrainers: [{
          trainerId: 'trainer-1',
          fullName: 'Алиса',
          kind: 'Permanent',
          replacedTrainerId: null,
          substitutionId: null,
        }],
        status: 'Scheduled',
        hasAttendanceMarks: false,
        allowedActions: {
          viewAttendance: { allowed: true, reason: null },
          editAttendance: { allowed: true, reason: null },
          edit: { allowed: false, reason: null },
          move: { allowed: true, reason: null },
          cancel: { allowed: false, reason: 'not-implemented' },
          restore: { allowed: false, reason: 'not-cancelled' },
          assignTrainerSubstitution: { allowed: false, reason: 'not-implemented' },
          cancelTrainerSubstitution: { allowed: false, reason: 'no-substitution' },
        },
        revision: searchParams.get('lessonDate') === '2026-08-21' ? 'revision-2' : 'revision-1',
      })
      return
    }

    if (pathname === '/api/schedule/lessons/occ-evening' && method === 'GET') {
      await fulfillJson(route, {
        ...SCHEDULE_IOS_MOVABLE_LESSON_CARD,
        lessonOccurrenceId: 'occ-evening',
        startTime: '18:00',
        durationMinutes: 60,
        endTime: '19:00',
        revision: 'revision-1',
      })
      return
    }

    if (pathname === '/api/schedule/lessons/occ-evening' && method === 'GET') {
      await fulfillJson(route, {
        ...SCHEDULE_IOS_MOVABLE_LESSON_CARD,
        lessonOccurrenceId: 'occ-evening',
        startTime: '18:00',
        durationMinutes: 60,
        endTime: '19:00',
        revision: 'revision-1',
      })
      return
    }

    if (pathname === '/api/schedule/lessons/occ-evening' && method === 'GET') {
      await fulfillJson(route, {
        ...SCHEDULE_IOS_MOVABLE_LESSON_CARD,
        lessonOccurrenceId: 'occ-evening',
        startTime: '18:00',
        durationMinutes: 60,
        endTime: '19:00',
        revision: 'revision-1',
      })
      return
    }

    if (pathname === '/api/schedule/lessons/occ-evening/change/preview' && method === 'POST') {
      expect(searchParams.get('lessonDate')).toBe('2026-08-20')
      previewPayload = route.request().postDataJSON()
      await fulfillJson(route, {
        confirmationToken: 'change-preview-token',
        expiresAt: '2026-08-20T09:15:00Z',
        lesson: {
          lessonOccurrenceId: 'occ-evening',
          sourceKind: 'Recurring',
          isMaterialized: true,
          lessonDate: '2026-08-21',
          startTime: '11:15',
          durationMinutes: 60,
          endTime: '12:15',
          groupId: 'group-1',
          groupName: 'Утренняя база',
          groupTypeId: 'type-1',
          groupTypeName: 'Кардио',
          branchId: 'branch-1',
          branchName: 'Центр',
          hallId: 'hall-1',
          hallName: 'Основной зал',
          effectiveTrainers: [{
            trainerId: 'trainer-1',
            fullName: 'Алиса',
            kind: 'Permanent',
            replacedTrainerId: null,
            substitutionId: null,
          }],
          status: 'Scheduled',
          hasAttendanceMarks: false,
          allowedActions: {
            viewAttendance: { allowed: true, reason: null },
            editAttendance: { allowed: true, reason: null },
            edit: { allowed: false, reason: null },
            move: { allowed: true, reason: null },
            cancel: { allowed: false, reason: 'not-implemented' },
            restore: { allowed: false, reason: 'not-cancelled' },
            assignTrainerSubstitution: { allowed: false, reason: 'not-implemented' },
            cancelTrainerSubstitution: { allowed: false, reason: 'no-substitution' },
          },
          revision: 'preview-change',
        },
        warnings: [{ code: 'lesson-hall-overlap', message: 'Проверьте пересечение зала.' }],
      })
      return
    }

    if (pathname === '/api/schedule/lessons/occ-evening/change' && method === 'POST') {
      expect(searchParams.get('lessonDate')).toBe('2026-08-20')
      expect(route.request().headers()['x-csrf-token']).toBe(HEAD_COACH_SESSION.csrfToken)
      executePayload = route.request().postDataJSON()
      await fulfillJson(route, {
        lessonOccurrenceId: 'occ-evening',
        sourceKind: 'Recurring',
        isMaterialized: true,
        lessonDate: '2026-08-21',
        startTime: '11:15',
        durationMinutes: 60,
        endTime: '12:15',
        groupId: 'group-1',
        groupName: 'Утренняя база',
        groupTypeId: 'type-1',
        groupTypeName: 'Кардио',
        branchId: 'branch-1',
        branchName: 'Центр',
        hallId: 'hall-1',
        hallName: 'Основной зал',
        effectiveTrainers: [{
          trainerId: 'trainer-1',
          fullName: 'Алиса',
          kind: 'Permanent',
          replacedTrainerId: null,
          substitutionId: null,
        }],
        status: 'Scheduled',
        hasAttendanceMarks: false,
        allowedActions: {
          viewAttendance: { allowed: true, reason: null },
          editAttendance: { allowed: true, reason: null },
          edit: { allowed: false, reason: null },
          move: { allowed: true, reason: null },
          cancel: { allowed: false, reason: 'not-implemented' },
          restore: { allowed: false, reason: 'not-cancelled' },
          assignTrainerSubstitution: { allowed: false, reason: 'not-implemented' },
          cancelTrainerSubstitution: { allowed: false, reason: 'no-substitution' },
        },
        revision: 'revision-2',
      })
      return
    }

    throw new Error(`Unexpected move schedule API request: ${method} ${pathname}`)
  })

  await page.setViewportSize(target)
  await page.goto('/schedule?date=2026-08-20&view=day')

  await expect(page.getByTestId('schedule-card-occ-evening')).toBeVisible()
  await page
    .getByTestId('schedule-card-occ-evening')
    .getByRole('button', { name: /Открыть занятие/ })
    .click()

  await expect(page).toHaveURL(/\/schedule\/lessons\/occ-evening\?lessonDate=2026-08-20$/)
  const detailCard = page.getByTestId('schedule-lesson-detail-screen')
  await expect(detailCard).toBeVisible()
  await detailCard.getByRole('button', { name: 'Перенести' }).click()

  const drawer = page.getByTestId('schedule-lesson-move-screen')
  await expect(drawer).toBeVisible()
  await drawer.getByLabel('Дата').fill('2026-08-21')
  await drawer.getByLabel('Время').fill('11:15')
  await expect(drawer.getByRole('button', { name: 'Получить предпросмотр' })).toBeEnabled()
  await drawer.getByRole('button', { name: 'Получить предпросмотр' }).click()

  await expect.poll(() => previewPayload).toEqual({
    scope: 'Occurrence',
    newLessonDate: '2026-08-21',
    startTime: '11:15',
    durationMinutes: 60,
    hallId: 'hall-1',
    expectedRevision: 'revision-1',
  })
  await expect(drawer.getByText('Проверьте пересечение зала.')).toBeVisible()
  await drawer.getByRole('button', { name: 'Сохранить изменение' }).click()

  await expect.poll(() => executePayload).toEqual({
    scope: 'Occurrence',
    newLessonDate: '2026-08-21',
    startTime: '11:15',
    durationMinutes: 60,
    hallId: 'hall-1',
    expectedRevision: 'revision-1',
    confirmationToken: 'change-preview-token',
  })

  await expect(page).toHaveURL(/\/schedule\/lessons\/occ-evening\?lessonDate=2026-08-21$/)
  await expect(detailCard.getByText('11:15-12:15')).toBeVisible()
  await expectNoHorizontalScroll(page)
})

test('target iPhone move draft stays editable after stale confirmation state', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)
  let executeCalls = 0

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
        today: '2026-08-20',
        maxTrainingDate: '2026-08-20',
      })
      return
    }

    if (pathname === '/api/schedule/lessons' && method === 'GET') {
      expect(searchParams.get('from')).toBe('2026-08-20')
      expect(searchParams.get('to')).toBe('2026-08-20')
      await fulfillJson(route, {
        ...scheduleLessonsResponse({}),
        items: [
          {
            ...SCHEDULE_IOS_MOVABLE_LESSON_CARD,
            lessonOccurrenceId: 'occ-evening',
            startTime: '18:00',
            durationMinutes: 60,
            endTime: '19:00',
          },
        ],
      })
      return
    }

    if (pathname === '/api/schedule/lessons/occ-evening' && method === 'GET') {
      await fulfillJson(route, {
        ...SCHEDULE_IOS_MOVABLE_LESSON_CARD,
        lessonOccurrenceId: 'occ-evening',
        startTime: '18:00',
        durationMinutes: 60,
        endTime: '19:00',
        revision: 'revision-1',
      })
      return
    }

    if (pathname === '/api/schedule/lessons/occ-evening/change/preview' && method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          confirmationToken: 'stale-change-token',
          expiresAt: '2026-08-20T09:15:00Z',
          lesson: {
            lessonOccurrenceId: 'occ-evening',
            sourceKind: 'Recurring',
            isMaterialized: true,
            lessonDate: '2026-08-21',
            startTime: '11:15',
            durationMinutes: 60,
            endTime: '12:15',
            groupId: 'group-1',
            groupName: 'Утренняя база',
            groupTypeId: 'type-1',
            groupTypeName: 'Кардио',
            branchId: 'branch-1',
            branchName: 'Центр',
            hallId: 'hall-1',
            hallName: 'Основной зал',
            effectiveTrainers: [{
              trainerId: 'trainer-1',
              fullName: 'Алиса',
              kind: 'Permanent',
              replacedTrainerId: null,
              substitutionId: null,
            }],
            status: 'Scheduled',
            hasAttendanceMarks: false,
            allowedActions: {
              viewAttendance: { allowed: true, reason: null },
              editAttendance: { allowed: true, reason: null },
              edit: { allowed: false, reason: null },
              move: { allowed: true, reason: null },
              cancel: { allowed: false, reason: 'not-implemented' },
              restore: { allowed: false, reason: 'not-cancelled' },
              assignTrainerSubstitution: { allowed: false, reason: 'not-implemented' },
              cancelTrainerSubstitution: { allowed: false, reason: 'no-substitution' },
            },
            revision: 'preview-change',
          },
          warnings: [],
        }),
      })
      return
    }

    if (pathname === '/api/schedule/lessons/occ-evening/change' && method === 'POST') {
      executeCalls += 1
      await route.fulfill({
        status: 409,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          title: 'Schedule confirmation token is not valid for this mutation.',
          code: 'lesson-mutation-preview-stale',
        }),
      })
      return
    }

    throw new Error(`Unexpected stale move API request: ${method} ${pathname}`)
  })

  await page.setViewportSize(target)
  await page.goto('/schedule?date=2026-08-20&view=day')

  await page
    .getByTestId('schedule-card-occ-evening')
    .getByRole('button', { name: /Открыть занятие/ })
    .click()
  const detail = page.getByTestId('schedule-lesson-detail-screen')
  await expect(detail).toBeVisible()
  await detail.getByRole('button', { name: 'Перенести' }).click()

  const drawer = page.getByTestId('schedule-lesson-move-screen')
  await drawer.getByLabel('Дата').fill('2026-08-21')
  await drawer.getByLabel('Время').fill('11:15')
  await drawer.getByRole('button', { name: 'Получить предпросмотр' }).click()
  await expect(drawer.getByText('Проверьте изменение перед сохранением')).toBeVisible()
  await drawer.getByRole('button', { name: 'Сохранить изменение' }).click()

  await expect(drawer.getByText('Параметры изменились после предпросмотра. Получите новый предпросмотр.')).toBeVisible()
  await expect(drawer.getByText('lesson-mutation-preview-stale')).toHaveCount(0)
  await expect(drawer.getByLabel('Дата')).toHaveValue('2026-08-21')
  await expect(drawer.getByRole('button', { name: 'Обновить предпросмотр' })).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Отмена' })).toBeVisible()
  expect(executeCalls).toBe(1)
  await expectNoHorizontalScroll(page)
})

test('target iPhone shows restricted attendance action only and keeps route stable', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)

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

    if (pathname === '/api/schedule/lessons' && method === 'GET') {
      expect(searchParams.get('from')).toBe('2026-08-20')
      expect(searchParams.get('to')).toBe('2026-08-20')
      await fulfillJson(route, {
        ...scheduleLessonsResponse({}),
        items: [SCHEDULE_IOS_DISABLED_LESSON_CARD],
      })
      return
    }

    if (pathname.startsWith('/api/attendance/lessons/') && method === 'POST') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({ message: 'unexpected attendance request in permission-restricted test' }),
      })
      return
    }

    await route.continue()
  })

  await page.setViewportSize(target)
  await page.goto('/schedule?date=2026-08-20&view=day')

  const eveningCard = page.getByTestId('schedule-card-occ-evening')
  const attendanceButton = eveningCard.getByRole('button', { name: /Открыть посещаемость/ })

  await expect(attendanceButton).toBeDisabled()
  await expect(eveningCard).toContainText('Посещаемость недоступна для вашей роли или зоны доступа.')
  await expect(eveningCard).not.toContainText('attendance-forbidden')
  await expect(page).toHaveURL(/\/schedule\?date=2026-08-20&view=day$/)
  await expectNoHorizontalScroll(page)
})

test('target iPhone preserves schedule filters through retry when initial load fails', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)
  const scheduleCalls: string[] = []
  let allowSuccess = false

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
        today: '2026-08-20',
        maxTrainingDate: '2026-08-20',
      })
      return
    }

    if (pathname === '/api/schedule/lessons' && method === 'GET') {
      scheduleCalls.push(searchParams.toString())

      if (!allowSuccess) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({ message: 'temporary error' }),
        })
        return
      }

      await fulfillJson(route, {
        ...scheduleLessonsResponse({ view: 'week' }),
        from: searchParams.get('from') ?? '2026-08-17',
        to: searchParams.get('to') ?? '2026-08-23',
      })
      return
    }

    await route.continue()
  })

  await page.setViewportSize(target)
  await page.goto('/schedule?date=2026-08-20&view=week&branchId=branch-1&trainerId=trainer-1')
  await expect(page.getByText('Расписание не загрузилось')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Повторить' })).toBeVisible()
  await expect(page).toHaveURL('/schedule?date=2026-08-20&view=week&branchId=branch-1&trainerId=trainer-1')

  allowSuccess = true
  await page.getByRole('button', { name: 'Повторить' }).click()
  await expect(page.getByTestId('schedule-week-view')).toBeVisible()
  await expectNoHorizontalScroll(page)
  await expect(page).toHaveURL('/schedule?date=2026-08-20&view=week&branchId=branch-1&trainerId=trainer-1')

  expect(scheduleCalls.length).toBeGreaterThanOrEqual(2)
  const firstQuery = new URLSearchParams(scheduleCalls[0])
  const secondQuery = new URLSearchParams(scheduleCalls[1])
  expect(firstQuery.get('from')).toBe('2026-08-17')
  expect(firstQuery.get('to')).toBe('2026-08-23')
  expect(firstQuery.get('branchId')).toBe('branch-1')
  expect(firstQuery.get('trainerId')).toBe('trainer-1')
  expect(secondQuery.get('branchId')).toBe('branch-1')
  expect(secondQuery.get('trainerId')).toBe('trainer-1')
})

test('target iPhone schedule tools drawer returns focus to the trigger button', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)

  await page.setViewportSize(target)
  await mockApi(page, HEAD_COACH_SESSION)
  await page.goto('/schedule?date=2026-08-20&view=day')

  const toolsButton = page.getByRole('button', { name: 'Параметры календаря' })
  await toolsButton.click()
  const drawer = page.getByRole('dialog', { name: 'Параметры календаря' })

  await expect(drawer).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await expect(toolsButton).toBeFocused()
  await expectNoHorizontalScroll(page)
})

test('target iPhone schedule week mode keeps 7 vertical sections and no overflow', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)
  const viewports = [
    { width: target.width, height: target.height },
    { width: target.height, height: target.width },
    { width: 420, height: 912 },
    { width: 440, height: 956 },
    { width: 912, height: 420 },
    { width: 956, height: 440 },
  ]

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
        today: '2026-08-20',
        maxTrainingDate: '2026-08-20',
      })
      return
    }

    if (pathname === '/api/schedule/lessons' && method === 'GET') {
      await fulfillJson(route, {
        ...scheduleLessonsResponse({
          date: searchParams.get('date') ?? '2026-08-20',
          view: (searchParams.get('view') as 'day' | 'week') ?? 'week',
        }),
        from: searchParams.get('from') ?? '2026-08-17',
        to: searchParams.get('to') ?? '2026-08-23',
      })
      return
    }

    await route.continue()
  })

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)
    await page.goto('/schedule?date=2026-08-20&view=week')

    await expect(page.getByTestId('schedule-week-view')).toBeVisible()
    await expect(page.locator('[data-testid^="schedule-day-section-"]')).toHaveCount(7)
    await expect(page.getByTestId('schedule-calendar-grid')).toHaveCount(0)
    await expect(page.locator('.schedule-events-disclosure')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
    await expect(page.locator(MOBILE_BOTTOM_NAVIGATION_SELECTOR)).toBeVisible()
  }
})

test('target iPhone series editor adds/removes slots and returns to exact lesson', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)
  let previewPayload: unknown = null
  let executePayload: unknown = null

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
      await fulfillJson(route, { groups: [], today: '2026-08-20', maxTrainingDate: '2026-08-20' })
      return
    }

    if (pathname === '/api/schedule/lessons' && method === 'GET') {
      await fulfillJson(route, scheduleLessonsResponse({}))
      return
    }

    if (pathname === '/api/groups/series-1/lesson-series' && method === 'GET') {
      await fulfillJson(route, targetSeriesResponse())
      return
    }

    if (pathname === '/api/groups/series-1/lesson-series/preview' && method === 'POST') {
      previewPayload = route.request().postDataJSON()
      await fulfillJson(route, targetSeriesPreviewResponse())
      return
    }

    if (pathname === '/api/groups/series-1/lesson-series' && method === 'POST') {
      executePayload = route.request().postDataJSON()
      await fulfillJson(route, {
        ...targetSeriesPreviewResponse(),
        revision: 'series-revision-2',
      })
      return
    }

    if (pathname === '/api/schedule/lessons/occ-evening' && method === 'GET') {
      expect(searchParams.get('lessonDate')).toBe('2026-08-20')
      await fulfillJson(route, SCHEDULE_IOS_LESSON_CARD)
      return
    }

    throw new Error(`Unexpected target iPhone series API request: ${method} ${pathname}`)
  })

  await page.goto('/schedule/series/series-1/edit?scope=this-and-future&groupId=group-1&lessonOccurrenceId=occ-evening&lessonDate=2026-08-20')

  const screen = page.getByTestId('schedule-series-edit-screen')
  await expect(screen).toBeVisible()
  const addSlotButton = screen.getByRole('button', { name: 'Добавить слот' })
  await expectTouchTargetAtLeast(addSlotButton, 44)
  await expect(screen.getByRole('button', { name: 'Удалить слот' })).toBeDisabled()

  await screen.getByLabel('Время начала').fill('09:00')
  await addSlotButton.click()
  await expect(screen.locator('[data-testid^="schedule-series-slot-"]')).toHaveCount(2)
  await screen.getByRole('button', { name: 'Удалить слот' }).first().click()
  await expect(screen.locator('[data-testid^="schedule-series-slot-"]')).toHaveCount(1)
  await expectNoHorizontalScroll(page)

  await screen.getByRole('button', { name: 'Получить предпросмотр' }).click()
  await expect(screen.getByText('Проверьте изменение серии')).toBeVisible()
  await screen.getByRole('button', { name: 'Подтвердить изменение серии' }).click()

  await expect(page).toHaveURL(/\/schedule\/lessons\/occ-evening\?lessonDate=2026-08-20$/)
  expect(previewPayload).toEqual(expect.objectContaining({
    scope: 'ThisAndFuture',
    effectiveFrom: '2026-08-20',
    expectedRevision: 'series-revision-1',
    slots: [expect.objectContaining({ startTime: '09:00', hallId: 'hall-1' })],
  }))
  expect(executePayload).toEqual(expect.objectContaining({
    confirmationToken: 'series-token',
    expectedRevision: 'series-revision-1',
  }))
  await expectNoHorizontalScroll(page)
})

test('target iPhone cancels exact trainer substitution from occurrence card', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)
  let previewPayload: unknown = null
  let executePayload: unknown = null

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
      await fulfillJson(route, { groups: [], today: '2026-08-20', maxTrainingDate: '2026-08-20' })
      return
    }

    if (pathname === '/api/schedule/lessons' && method === 'GET') {
      await fulfillJson(route, scheduleLessonsResponse({
        items: [targetSubstitutedLesson()],
      }))
      return
    }

    if (pathname === '/api/schedule/lesson-trainer-substitutions/cancellations/preview' && method === 'POST') {
      previewPayload = route.request().postDataJSON()
      await fulfillJson(route, {
        confirmationToken: 'substitution-cancel-token',
        expiresAt: '2026-08-20T09:15:00Z',
        targets: [{
          lessonOccurrenceId: 'occ-evening',
          lessonDate: '2026-08-20',
          groupId: 'group-1',
          groupName: 'Утренняя база',
          substitutionId: 'substitution-1',
          warnings: [],
        }],
        warnings: [],
      })
      return
    }

    if (pathname === '/api/schedule/lesson-trainer-substitutions/cancellations' && method === 'POST') {
      executePayload = route.request().postDataJSON()
      await fulfillJson(route, {
        lessons: [SCHEDULE_IOS_LESSON_CARD],
        warnings: [],
      })
      return
    }

    if (pathname === '/api/schedule/lessons/occ-evening' && method === 'GET') {
      expect(searchParams.get('lessonDate')).toBe('2026-08-20')
      await fulfillJson(route, SCHEDULE_IOS_LESSON_CARD)
      return
    }

    throw new Error(`Unexpected target iPhone substitution API request: ${method} ${pathname}`)
  })

  await page.goto('/schedule?date=2026-08-20&view=day')

  const card = page.getByTestId('schedule-card-occ-evening')
  await expect(card.getByRole('button', { name: /Снять замену тренера/ })).toHaveCount(0)
  await card.getByRole('button', { name: /Ещё действий/ }).click()
  const moreDrawer = page.getByRole('dialog', { name: /Ещё действий/ })
  const cancelSubstitution = moreDrawer.getByRole('button', { name: /Снять замену тренера/ })
  await expect(cancelSubstitution).toBeVisible()
  await expectTouchTargetAtLeast(cancelSubstitution, 44)
  await cancelSubstitution.click()

  const drawer = page.getByRole('dialog', { name: 'Снять замену тренера' })
  await expect(drawer).toBeVisible()
  await drawer.getByRole('button', { name: 'Получить предпросмотр' }).click()
  await expect(drawer.getByText('Проверьте замену перед подтверждением')).toBeVisible()
  await drawer.getByRole('button', { name: 'Снять замену' }).click()

  await expect(page).toHaveURL(/\/schedule\/lessons\/occ-evening\?lessonDate=2026-08-20$/)
  expect(previewPayload).toEqual({
    targets: [{
      lessonOccurrenceId: 'occ-evening',
      lessonDate: '2026-08-20',
      expectedRevision: 'revision-1',
      substitutionId: 'substitution-1',
    }],
    reason: null,
  })
  expect(executePayload).toEqual({
    targets: [{
      lessonOccurrenceId: 'occ-evening',
      lessonDate: '2026-08-20',
      expectedRevision: 'revision-1',
      substitutionId: 'substitution-1',
    }],
    reason: null,
    confirmationToken: 'substitution-cancel-token',
  })
  await expectNoHorizontalScroll(page)
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

test('target iPhone attendance workbench remains compact, readable, and action-reachable', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)
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
      await fulfillJson(route, COACH_RESTRICTED_SESSION)
      return
    }

    if (
      pathname === '/api/attendance/lessons/occ-evening/clients' &&
      method === 'GET'
    ) {
      const lessonDate = new URL(route.request().url()).searchParams.get('lessonDate')
      expect(lessonDate).toBe('2026-04-18')
      await fulfillJson(route, ATTENDANCE_ROSTER_RESPONSE)
      return
    }

    if (pathname === '/api/attendance/group-types' && method === 'GET') {
      await fulfillJson(route, [])
      return
    }

    if (pathname === '/api/clients/attention' && method === 'GET') {
      await fulfillJson(route, [])
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

    if (pathname === '/api/clients/client-1/messenger/telegram' && method === 'GET') {
      await fulfillJson(route, {})
      return
    }

    throw new Error(
      `Unexpected attendance target API request: ${method} ${pathname}`,
    )
  })

  await page.goto('/attendance/occ-evening?lessonDate=2026-04-18')
  const attendanceScreen = page.getByTestId('attendance-screen')
  const lessonContext = attendanceScreen.getByText('Посещаемость занятия')
  const firstAction = page.getByTestId('attendance-client-card-client-1').getByRole('radio', {
    name: 'Был',
    exact: true,
  })
  const profileAction = page
    .getByTestId('attendance-client-card-client-1')
    .getByRole('button', { name: 'Открыть карточку клиента Александр Петров' })

  await expect(attendanceScreen).toBeVisible()
  await expect(lessonContext).toBeVisible()
  await expect(firstAction).toBeVisible()
  await expect(profileAction).toBeVisible()
  await expect(page.getByTestId('attendance-toolbar')).toHaveCount(0)

  const firstActionBox = await firstAction.boundingBox()
  const profileActionBox = await profileAction.boundingBox()
  expect(firstActionBox).not.toBeNull()
  expect(firstActionBox!.width).toBeGreaterThanOrEqual(44)
  expect(firstActionBox!.height).toBeGreaterThanOrEqual(44)
  expect(profileActionBox).not.toBeNull()
  expect(profileActionBox!.width).toBeGreaterThanOrEqual(44)
  expect(profileActionBox!.height).toBeGreaterThanOrEqual(44)
  const navigation = page.getByRole('navigation', { name: 'Мобильная навигация' })
  const header = await page.locator('.app-shell__header').boundingBox()
  const navigationCount = await navigation.count()
  if (navigationCount > 0) {
    const navigationBox = await navigation.boundingBox()
    expect(firstActionBox).not.toBeNull()
    expect(navigationBox).not.toBeNull()
    expect(firstActionBox!.y + firstActionBox!.height).toBeLessThanOrEqual(
      navigationBox!.y - 8,
    )
  } else {
    const viewport = await page.viewportSize()
    expect(viewport).not.toBeNull()
    expect(firstActionBox).not.toBeNull()
    expect(firstActionBox!.y + firstActionBox!.height).toBeLessThanOrEqual(
      (viewport!.height ?? target.height) + 1,
    )
    expect(firstActionBox!.y).toBeGreaterThanOrEqual((header?.y ?? 0) + (header?.height ?? 0) - 1)
  }

  await expectNoHorizontalScroll(page)
  await expect(
    page.getByRole('heading', { name: ATTENDANCE_GROUPS_RESPONSE.groups[0].name }),
  ).toHaveCount(0)

  const environment = await page.evaluate(() => ({
    devicePixelRatio: window.devicePixelRatio,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    userAgent: navigator.userAgent,
  }))

  expect(testInfo.project.use.hasTouch).toBe(true)
  expect(environment.devicePixelRatio).toBe(3)
  expect(environment.userAgent).toContain('iPhone')
  expect(environment.innerWidth).toBe(target.width)
  expect(environment.innerHeight).toBeLessThanOrEqual(target.height)

  await profileAction.click()
  await expect(page).toHaveURL(/\/clients\/client-1(?:\/|$)/)
  await expect(page.getByRole('button', { name: 'К посещениям' })).toBeVisible()
  await page.getByRole('button', { name: 'К посещениям' }).click()
  await expect(attendanceScreen).toBeVisible()
  await expect(profileAction).toBeFocused()

  await page.setViewportSize({ width: target.height, height: target.width })
  await expect(attendanceScreen).toBeVisible()
  await expect(lessonContext).toBeVisible()
  await firstAction.scrollIntoViewIfNeeded()
  await expect(firstAction).toBeVisible()
  await expect(profileAction).toBeVisible()

  const compactFirstAction = await firstAction.boundingBox()
  expect(compactFirstAction).not.toBeNull()
  const compactViewport = await page.viewportSize()
  expect(compactFirstAction!.y).toBeGreaterThanOrEqual(0)
  expect(compactFirstAction!.y + compactFirstAction!.height).toBeLessThanOrEqual(
    compactViewport!.height + 1,
  )
  await expectNoHorizontalScroll(page)

  await profileAction.click()
  await expect(page).toHaveURL(/\/clients\/client-1(?:\/|$)/)
  await page.getByRole('button', { name: 'К посещениям' }).click()
  await expect(attendanceScreen).toBeVisible()
  await expect(profileAction).toBeFocused()
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
  await page.goto('/attention')

  const sideNavigation = page.locator(SIDE_NAVIGATION_SELECTOR)
  const bottomNavigation = page.locator(MOBILE_BOTTOM_NAVIGATION_SELECTOR)
  const attentionButton = bottomNavigation.getByRole('button', { name: 'Внимание' })
  const attentionScreen = page.getByTestId('attention-screen')

  await expect(attentionScreen).toBeVisible()
  await expect(sideNavigation).toBeHidden()
  await expect(bottomNavigation).toBeVisible()
  await expect(attentionButton).toBeVisible()
  await expect(attentionButton).toBeInViewport()

  const attentionBounds = await attentionScreen.boundingBox()
  const mobileNavBounds = await bottomNavigation.boundingBox()

  expect(attentionBounds).not.toBeNull()
  expect(attentionBounds!.y + attentionBounds!.height).toBeGreaterThanOrEqual(0)
  expect(attentionBounds!.y).toBeLessThanOrEqual(compactViewport.height - 1)
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

test('TASK-161 target iPhone keeps notifications below the header and drawers bottom-anchored', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)

  await page.setViewportSize(target)
  await mockApi(page, HEAD_COACH_SESSION)
  await page.goto('/settings')
  await expect(page.getByTestId('settings-screen')).toBeVisible()
  await page.getByRole('tab', { name: 'Типы групп' }).click()
  await page.getByRole('button', { name: 'Добавить тип' }).click()

  const typeDialog = page.getByRole('dialog')
  await typeDialog.getByLabel('Название').fill('Мобильный тип')
  await typeDialog.getByLabel('Описание').fill('Проверка target iPhone')
  await typeDialog.getByRole('button', { name: 'Сохранить' }).click()

  const notification = page
    .locator('[data-position="top-center"] [role="alert"]')
    .filter({ hasText: /Тип группы создан/ })
  await expect(notification).toBeVisible()
  const notificationBox = await page
    .locator('.app-notifications[data-position="top-center"]')
    .boundingBox()
  expect(notificationBox).not.toBeNull()
  expect(notificationBox!.y).toBeGreaterThanOrEqual(72)
  expect(notificationBox!.x).toBeGreaterThanOrEqual(16)
  expect(target.width - notificationBox!.x - notificationBox!.width).toBeGreaterThanOrEqual(16)

  await page.goto('/clients')
  const filterTrigger = page.getByRole('button', { name: 'Открыть фильтры' })
  await filterTrigger.focus()
  await page.keyboard.press('Enter')
  const drawer = page.getByRole('dialog', { name: /Фильтры/ })
  await expect(drawer).toBeVisible()
  await page.waitForTimeout(300)

  const drawerGeometry = await drawer.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)

    return {
      bottom: rect.bottom,
      borderBottomLeftRadius: style.borderBottomLeftRadius,
      borderTopLeftRadius: style.borderTopLeftRadius,
      viewportHeight: window.innerHeight,
      width: rect.width,
    }
  })
  expect(drawerGeometry.bottom).toBeLessThanOrEqual(drawerGeometry.viewportHeight + 1)
  expect(drawerGeometry.width).toBeGreaterThanOrEqual(target.width - 1)
  expect(drawerGeometry.borderTopLeftRadius).not.toBe('0px')
  expect(drawerGeometry.borderBottomLeftRadius).toBe('0px')

  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await expect(filterTrigger).toBeFocused()

  await page.setViewportSize({ width: target.height, height: target.width })
  await page.keyboard.press('Enter')
  await expect(drawer).toBeVisible()
  await page.waitForTimeout(300)
  const compactGeometry = await drawer.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      bottom: rect.bottom,
      height: rect.height,
      viewportHeight: window.innerHeight,
    }
  })
  expect(compactGeometry.bottom).toBeLessThanOrEqual(compactGeometry.viewportHeight + 1)
  expect(compactGeometry.height).toBeLessThanOrEqual(compactGeometry.viewportHeight + 1)
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await expect(filterTrigger).toBeFocused()
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
    currentMemberships: [],
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
  await expect(row.locator('.audit-log-context')).toContainText('Создание клиента')
  await expect(row.locator('.audit-log-context')).toContainText('Клиент')
  await expect(row.locator('.audit-log-context')).toContainText('client-1')
  await expect(row.locator('.audit-log-context')).toHaveAttribute('aria-hidden', 'true')
  await expect(row.locator('.audit-log-cell__label:visible')).toHaveCount(0)
  await expect(row.getByRole('cell').nth(1)).toHaveAttribute(
    'aria-label',
    /Описание: Создан новый клиент.*Действие: Создание клиента.*Объект: Клиент.*ID объекта: client-1/,
  )
  await expect(detailsTrigger).toHaveAccessibleName(
    'Показать подробности записи: Создан новый клиент',
  )

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
      rowHeight: element.getBoundingClientRect().height,
      actorWithinRow:
        Boolean(actorRect) &&
        actorRect!.left >= element.getBoundingClientRect().left - 1 &&
        actorRect!.right <= element.getBoundingClientRect().right + 1,
      detailsWidth: detailsRect?.width ?? 0,
      detailsHeight: detailsRect?.height ?? 0,
    }
  })

  expect(geometry.columns).toBe(2)
  expect(geometry.areas.replaceAll('"', '').trim()).toBe(
    'time details description details context context actor actor',
  )
  expect(geometry.descriptionClamp).toBe('2')
  expect(geometry.rowHeight).toBeLessThanOrEqual(128)
  expect(geometry.actorWithinRow).toBe(true)
  expect(geometry.detailsWidth).toBeGreaterThanOrEqual(44)
  expect(geometry.detailsHeight).toBeGreaterThanOrEqual(44)
  await expectNoHorizontalScroll(page)

  const pagination = page.getByRole('navigation', {
    name: 'Страницы журнала действий',
  })
  const previous = pagination.getByRole('button', {
    name: 'Предыдущая страница журнала',
  })
  const next = pagination.getByRole('button', {
    name: 'Следующая страница журнала',
  })
  await expect(pagination).toBeVisible()
  await expect(previous).toBeDisabled()
  await expect(next).toBeEnabled()
  await expect(page.getByText('Страница 1 из 3', { exact: true })).toBeVisible()
  await expect(
    pagination.getByRole('button', { name: /^Страница \d+ журнала$/ }),
  ).toHaveCount(0)

  const pagerGeometry = await pagination.evaluate((element) => {
    const pagerRect = element.getBoundingClientRect()
    const controls = Array.from(element.querySelectorAll('button')).map((control) =>
      control.getBoundingClientRect(),
    )

    return {
      minWidth: Math.min(...controls.map((rect) => rect.width)),
      minHeight: Math.min(...controls.map((rect) => rect.height)),
      gap: controls[1].left - controls[0].right,
      left: Math.min(...controls.map((rect) => rect.left)),
      right: Math.max(...controls.map((rect) => rect.right)),
      pagerLeft: pagerRect.left,
      pagerRight: pagerRect.right,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }
  })
  expect(pagerGeometry.minWidth).toBeGreaterThanOrEqual(44)
  expect(pagerGeometry.minHeight).toBeGreaterThanOrEqual(44)
  expect(pagerGeometry.gap).toBeGreaterThanOrEqual(8)
  expect(pagerGeometry.left).toBeGreaterThanOrEqual(pagerGeometry.pagerLeft - 1)
  expect(pagerGeometry.right).toBeLessThanOrEqual(pagerGeometry.pagerRight + 1)
  expect(pagerGeometry.scrollWidth).toBeLessThanOrEqual(pagerGeometry.clientWidth + 1)

  const bottomNavigation = page.locator(
    'nav.mobile-bottom-nav[aria-label="Мобильная навигация"]',
  )
  const bottomNavigationBox = await bottomNavigation.boundingBox()
  const rowBoxes = await grid.locator('.audit-log-row').evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return { bottom: rect.bottom, top: rect.top }
    }),
  )
  const rowsBeforeNavigation = rowBoxes.filter(
    (rowBox) =>
      rowBox.top >= 0 &&
      rowBox.bottom <= (bottomNavigationBox?.y ?? Number.NEGATIVE_INFINITY) + 1,
  )
  expect(rowsBeforeNavigation.length).toBeGreaterThanOrEqual(target.width === 440 ? 4 : 3)

  const longDescription =
    'Обновлены данные клиента Александра Константинопольская-Северная: длинное описание должно оставаться полным для accessibility и details.'
  const longRow = grid.locator('.audit-log-row', { hasText: longDescription })
  await expect(longRow.getByText(longDescription)).toBeVisible()
  await expect(
    longRow.getByRole('button', {
      name: `Показать подробности записи: ${longDescription}`,
    }),
  ).toBeVisible()
  const longContainment = await longRow.evaluate((element) => {
    const rowRect = element.getBoundingClientRect()
    const actorRect = element
      .querySelector<HTMLElement>('.audit-log-cell--actor')
      ?.getBoundingClientRect()
    const contextRect = element
      .querySelector<HTMLElement>('.audit-log-context')
      ?.getBoundingClientRect()
    return {
      actorBottom: actorRect?.bottom ?? Number.POSITIVE_INFINITY,
      contextRight: contextRect?.right ?? Number.POSITIVE_INFINITY,
      rowBottom: rowRect.bottom,
      rowRight: rowRect.right,
    }
  })
  expect(longContainment.actorBottom).toBeLessThanOrEqual(longContainment.rowBottom + 1)
  expect(longContainment.contextRight).toBeLessThanOrEqual(longContainment.rowRight + 1)

  for (const closePath of ['button', 'overlay', 'escape'] as const) {
    await detailsTrigger.click()
    const detailsModal = page.getByTestId('audit-log-details-modal')
    const dialog = page.getByRole('dialog', {
      name: 'Подробности записи журнала',
    })
    const close = dialog.getByRole('button', {
      name: 'Закрыть подробности записи',
    })
    await expect(detailsModal).toContainText('Создание клиента')
    await expect(close).toBeFocused()

    if (closePath === 'button') {
      await close.click()
    } else if (closePath === 'overlay') {
      await page.locator('.mantine-Modal-overlay').click({ position: { x: 4, y: 4 } })
    } else {
      await page.keyboard.press('Escape')
    }

    await expect(detailsModal).toBeHidden()
    await expect(detailsTrigger).toBeFocused()
  }
})

test('мобильный pager не придумывает total при неизвестном количестве записей', async ({
  page,
}, testInfo) => {
  const target = targetScreenFor(testInfo.project.name)

  await page.setViewportSize(target)
  await mockApi(page, HEAD_COACH_SESSION, APP_CONFIG, {
    pageSize: 5,
    totalCount: null,
  })
  await page.goto('/audit')

  const pagination = page.getByRole('navigation', {
    name: 'Страницы журнала действий',
  })
  await expect(page.getByText('Страница 1', { exact: true })).toBeVisible()
  await expect(page.getByText('Страница 1 из 2', { exact: true })).toHaveCount(0)
  await expect(
    pagination.getByRole('button', { name: 'Следующая страница журнала' }),
  ).toBeEnabled()
  await expectNoHorizontalScroll(page)
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

    if (pathname === '/api/coaches' && method === 'GET') {
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

    if (pathname === '/api/coaches' && method === 'GET') {
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

  await page.goto('/coaches')

  const locator = page.getByTestId('users-list-locator')
  const search = page.getByRole('textbox', { name: 'Найти тренера' })
  const filter = page.getByRole('button', { name: 'Открыть фильтры' })
  const refresh = page.getByRole('button', { name: 'Обновить' })
  const create = page.getByRole('button', { name: 'Создать тренера' })

  await expect(locator).toBeVisible()
  await expect(search).toBeInViewport()
  await expect(filter).toBeInViewport()
  await expect(refresh).toBeInViewport()
  await expect(create).toBeInViewport()
  const searchBox = await search.boundingBox()
  expect(searchBox).not.toBeNull()
  expect(searchBox!.width).toBeGreaterThanOrEqual(target.width === 420 ? 200 : 216)
  for (const action of [filter, refresh, create]) {
    const actionBox = await action.boundingBox()
    expect(actionBox).not.toBeNull()
    expect(actionBox!.width).toBeGreaterThanOrEqual(44)
    expect(actionBox!.height).toBeGreaterThanOrEqual(44)
  }
  await search.fill('  ANNA.LOGIN  ')
  const normalCard = page.getByTestId('user-card-coach-anna')
  await expect(normalCard).toBeVisible()
  await expect(normalCard).toHaveAttribute('aria-label', 'Редактировать тренера «Анна Ветрова»')
  await expect(normalCard.getByRole('button')).toHaveCount(0)
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
  await expect(longCard.getByRole('button')).toHaveCount(0)
  await expect(longCard.getByText('Редактировать', { exact: true })).toBeHidden()
  const longCardBox = await longCard.boundingBox()
  expect(longCardBox).not.toBeNull()
  expect(longCardBox!.height).toBeGreaterThanOrEqual(64)
  await expect.poll(() => longName.evaluate((element) =>
    element.getBoundingClientRect().height > parseFloat(getComputedStyle(element).lineHeight),
  )).toBe(true)
  await expectNoHorizontalScroll(page)

  await page.setViewportSize({ width: target.height, height: target.width })
  await locator.scrollIntoViewIfNeeded()
  await expect(search).toBeInViewport()
  await expect(filter).toBeInViewport()
  await expect(refresh).toBeInViewport()
  await expect(create).toBeInViewport()
  await filter.click()
  const filtersDialog = page.getByRole('dialog', { name: 'Фильтры тренеров' })
  await expect(filtersDialog).toBeVisible()
  for (const control of [
    filtersDialog.getByRole('combobox', { name: 'Статус' }),
    filtersDialog.getByRole('combobox', { name: 'Пароль' }),
    filtersDialog.getByRole('button', { name: 'Сбросить', exact: true }),
    filtersDialog.getByRole('button', { name: 'Готово' }),
    filtersDialog.getByRole('button', { name: 'Закрыть фильтры тренеров' }),
  ]) {
    await control.scrollIntoViewIfNeeded()
    await expect(control).toBeInViewport()
  }
  await page.keyboard.press('Escape')
  await expect(filtersDialog).toHaveCount(0)
  await expect(filter).toBeFocused()
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

    if (pathname === '/api/coaches/coach-anna' && method === 'GET') {
      await fulfillJson(route, trainer)
      return
    }

    throw new Error(`Unexpected trainer edit iPhone API request: ${method} ${pathname}`)
  })

  await page.goto('/coaches/coach-anna/edit')

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

  const catalogTab = page.getByRole('tab', { name: 'Абонементы' })
  await expect(catalogTab).toBeVisible()
  await catalogTab.click()

  const catalogPanel = page.getByRole('tabpanel', { name: 'Абонементы' })
  const membershipRows = catalogPanel.locator('.list-row-card')
  await expect(catalogPanel).toBeVisible()
  await expect(catalogPanel.getByRole('heading', { name: 'Каталог абонементов' })).toHaveCount(0)
  await expect(membershipRows).toHaveCount(4)
  await expectNoHorizontalScroll(page)

  const scope = catalogPanel.getByRole('combobox', { name: 'Филиал каталога' })
  const refresh = catalogPanel.getByRole('button', { name: 'Обновить' })
  const create = catalogPanel.getByRole('button', { name: 'Добавить абонемент' })
  const [tabBox, scopeBox, refreshBox, createBox] = await Promise.all([
    catalogTab.boundingBox(),
    scope.boundingBox(),
    refresh.boundingBox(),
    create.boundingBox(),
  ])
  for (const [label, box] of [
    ['tab', tabBox],
    ['scope', scopeBox],
    ['refresh', refreshBox],
    ['create', createBox],
  ] as const) {
    expect(box).not.toBeNull()
    expect.soft(box!.height, `${label} is touch-safe`).toBeGreaterThanOrEqual(44)
  }
  expect.soft(Math.abs(scopeBox!.y - refreshBox!.y), 'scope and actions stay in one row').toBeLessThan(8)
  expect.soft(refreshBox!.x - (scopeBox!.x + scopeBox!.width), 'scope precedes actions').toBeGreaterThanOrEqual(8)

  await catalogTab.focus()
  await page.keyboard.press('Tab')
  expect.soft(await scope.evaluate((element) => element === document.activeElement), 'focus enters scope first').toBe(true)
  const domOrder = await catalogPanel.evaluate((element) => {
    const scopeElement = element.querySelector('[role="combobox"]')
    const refreshElement = element.querySelector('[aria-label="Обновить"]')
    const createElement = element.querySelector('[aria-label="Добавить абонемент"]')
    if (!scopeElement || !refreshElement || !createElement) return false
    return Boolean(
      scopeElement.compareDocumentPosition(refreshElement) & Node.DOCUMENT_POSITION_FOLLOWING
      && refreshElement.compareDocumentPosition(createElement) & Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })
  expect.soft(domOrder, 'DOM order is scope → refresh → create').toBe(true)

  // macOS WebKit follows the host Full Keyboard Access preference and may
  // skip buttons on plain Tab. Chromium covers sequential Tab order; target
  // WebKit still proves each action is independently keyboard-focusable.
  await refresh.focus()
  await expect(refresh).toBeFocused()
  await create.focus()
  await expect(create).toBeFocused()

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

  await page.setViewportSize({ width: target.height, height: target.width })
  await scope.scrollIntoViewIfNeeded()
  await expect(scope).toBeVisible()
  await expect(refresh).toBeVisible()
  await expect(create).toBeVisible()
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
  const activePanel = page.getByRole('tabpanel', { name: 'Филиалы и залы' })
  const createButton = settingsScreen.getByRole('button', { name: 'Добавить филиал' })
  const refreshButton = settingsScreen.getByRole('button', { name: 'Обновить' })
  const firstBranch = page.locator('.settings-branch-row').first()

  await expect(activePanel).toBeVisible()
  await expect(activePanel.getByRole('heading', { name: 'Филиалы и залы' })).toHaveCount(0)
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

function scheduleLessonsResponse({
  date = '2026-08-20',
  from: requestedFrom,
  items = [SCHEDULE_IOS_LESSON_CARD],
  to: requestedTo,
  view = 'day',
  query = new URLSearchParams(),
}: {
  date?: string
  from?: string
  items?: readonly (typeof SCHEDULE_IOS_LESSON_CARD)[]
  to?: string
  view?: 'day' | 'week'
  query?: URLSearchParams
}) {
  const from = requestedFrom ?? (view === 'week'
    ? '2026-08-17'
    : date)

  const to = requestedTo ?? (view === 'week'
    ? '2026-08-23'
    : date)

  return {
    from,
    to,
    capabilities: {
      createOneOff: { allowed: true, reason: null },
    },
    filterOptions: {
      branches: [{ id: 'branch-1', name: 'Центр' }],
      halls: [{ id: 'hall-1', name: 'Основной зал' }],
      trainers: [{ id: 'trainer-1', name: 'Алиса' }],
      groups: [{ id: 'group-1', name: 'Утренняя база' }],
      groupTypes: [{ id: 'type-1', name: 'Кардио' }],
    },
    items,
    query,
  }
}

function targetSeriesResponse() {
  return {
    seriesId: 'series-1',
    groupId: 'group-1',
    groupName: 'Утренняя база',
    businessDate: '2026-08-20',
    startsOn: '2026-08-01',
    endsOn: null,
    revision: 'series-revision-1',
    currentVersion: {
      versionNumber: 1,
      effectiveFrom: '2026-08-01',
      effectiveTo: null,
      thisAndFutureMinEffectiveFrom: '2026-08-20',
      entireSeriesEffectiveFrom: '2026-08-01',
      slots: [{
        isoWeekday: 1,
        startTime: '08:00',
        durationMinutes: 50,
        hallId: 'hall-1',
        hallName: 'Основной зал',
      }],
    },
  }
}

function targetSeriesPreviewResponse() {
  return {
    confirmationToken: 'series-token',
    expiresAt: '2026-08-20T09:15:00Z',
    revision: 'series-revision-1',
    scope: 'ThisAndFuture',
    effectiveFrom: '2026-08-20',
    endsOn: null,
    slots: [{
      isoWeekday: 1,
      startTime: '09:00',
      durationMinutes: 50,
      hallId: 'hall-1',
      hallName: 'Основной зал',
    }],
    impact: {
      totalAffectedOccurrences: 3,
      examples: [{
        lessonOccurrenceId: 'occ-evening',
        lessonDate: '2026-08-20',
        startTime: '09:00',
        hallId: 'hall-1',
        hallName: 'Основной зал',
      }],
      skipped: [],
    },
    warnings: [],
  }
}

function targetSubstitutedLesson() {
  return {
    ...SCHEDULE_IOS_LESSON_CARD,
    allowedActions: {
      ...SCHEDULE_IOS_LESSON_CARD.allowedActions,
      cancelTrainerSubstitution: { allowed: true, reason: null },
    },
    effectiveTrainers: [
      {
        trainerId: 'trainer-1',
        fullName: 'Алиса',
        kind: 'Permanent',
        replacedTrainerId: null,
        substitutionId: null,
      },
      {
        trainerId: 'trainer-2',
        fullName: 'Борис',
        kind: 'Substitute',
        replacedTrainerId: 'trainer-1',
        substitutionId: 'substitution-1',
      },
    ],
  }
}

async function mockApi(
  page: Page,
  session:
    | typeof UNAUTHENTICATED_SESSION
    | typeof HEAD_COACH_SESSION
    | typeof COACH_RESTRICTED_SESSION,
  appConfig: AppConfigFixture = APP_CONFIG,
  auditPagination: { pageSize?: number; totalCount?: number | null } = {},
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
          name: 'Северный филиал с очень длинным названием для target iPhone',
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

    if (pathname === '/api/group-types' && method === 'POST') {
      const payload = route.request().postDataJSON() as {
        description?: string | null
        name?: string
      }
      await fulfillJson(route, {
        id: 'group-type-created',
        name: payload.name ?? 'Мобильный тип',
        description: payload.description ?? null,
        groupCount: 0,
      })
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
      const pageSize = auditPagination.pageSize ?? 20
      const totalCount = Object.prototype.hasOwnProperty.call(
        auditPagination,
        'totalCount',
      )
        ? auditPagination.totalCount!
        : 45
      await fulfillJson(route, {
        items: [
          {
            id: 'audit-iphone-1',
            userName: 'Главный тренер',
            userLogin: 'headcoach',
            userRole: 'HeadCoach',
            source: 'Web',
            messengerPlatform: 'Telegram',
            actionType: 'ClientCreated',
            entityType: 'Client',
            entityId: 'client-1',
            description: 'Создан новый клиент',
            oldValueJson: null,
            newValueJson: { status: 'Active' },
            createdAt: '2026-07-30T10:10:10.000Z',
          },
          {
            id: 'audit-iphone-2',
            userName: 'Главный тренер',
            userLogin: 'headcoach',
            userRole: 'HeadCoach',
            source: 'Web',
            messengerPlatform: 'Telegram',
            actionType: 'ClientUpdated',
            entityType: 'Client',
            entityId: 'client-2',
            description: 'Обновлён телефон клиента',
            oldValueJson: null,
            newValueJson: null,
            createdAt: '2026-07-30T10:00:10.000Z',
          },
          {
            id: 'audit-iphone-3',
            userName: 'Главный тренер',
            userLogin: 'headcoach',
            userRole: 'HeadCoach',
            source: 'ExternalApi',
            messengerPlatform: 'Telegram',
            actionType: 'AttendanceImported',
            entityType: 'ExternalAttendance',
            entityId: 'external-42',
            description: 'Attendance import completed',
            oldValueJson: null,
            newValueJson: null,
            createdAt: '2026-07-30T09:50:10.000Z',
          },
          {
            id: 'audit-iphone-4',
            userName: 'Главный тренер',
            userLogin: 'headcoach',
            userRole: 'HeadCoach',
            source: 'Web',
            messengerPlatform: 'Telegram',
            actionType: 'Login',
            entityType: 'UserSession',
            entityId: 'session-4',
            description: 'Пользователь вошёл в систему',
            oldValueJson: null,
            newValueJson: null,
            createdAt: '2026-07-30T09:40:10.000Z',
          },
          {
            id: 'audit-iphone-long',
            userName: 'Пользователь с очень длинным отображаемым именем',
            userLogin: 'long.audit.user',
            userRole: 'HeadCoach',
            source: 'Web',
            messengerPlatform: 'Telegram',
            actionType: 'ClientUpdated',
            entityType: 'Client',
            entityId: 'client-with-very-long-responsive-identifier',
            description:
              'Обновлены данные клиента Александра Константинопольская-Северная: длинное описание должно оставаться полным для accessibility и details.',
            oldValueJson: null,
            newValueJson: { status: 'Active' },
            createdAt: '2026-07-30T09:30:10.000Z',
          },
        ],
        totalCount,
        skip: 0,
        take: pageSize,
        page: 1,
        pageSize,
        hasNextPage: totalCount === null ? true : totalCount > pageSize,
      })
      return
    }

    if (pathname === '/api/schedule/groups' && method === 'GET') {
      await fulfillJson(route, SCHEDULE_GROUPS_RESPONSE)
      return
    }

    if (pathname === '/api/schedule/lessons' && method === 'GET') {
      const view = requestUrl.searchParams.get('view') === 'week' ? 'week' : 'day'
      await fulfillJson(route, scheduleLessonsResponse({
        from: requestUrl.searchParams.get('from') ?? undefined,
        to: requestUrl.searchParams.get('to') ?? undefined,
        view,
        query: requestUrl.searchParams,
      }))
      return
    }

    throw new Error(`Unexpected target iPhone API request: ${method} ${pathname}`)
  })
}

async function mockIphoneFinanceApi(page: Page) {
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
      await fulfillJson(route, FINANCE_TARGET_SESSION)
      return
    }

    if (pathname === '/api/clients/expiring-memberships' && method === 'GET') {
      await fulfillJson(route, { items: [] })
      return
    }

    if (pathname === '/api/clients/attention' && method === 'GET') {
      await fulfillJson(route, { items: [] })
      return
    }

    if (pathname === '/api/attendance/groups' && method === 'GET') {
      await fulfillJson(route, { items: [] })
      return
    }

    if (pathname === '/api/branches' && method === 'GET') {
      await fulfillJson(route, [
        {
          id: 'branch-1',
          name: 'Северный филиал',
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

    if (pathname === '/api/groups/options/trainers' && method === 'GET') {
      await fulfillJson(route, [
        {
          id: 'trainer-1',
          fullName: 'Ирина Тренер',
          login: 'irina',
        },
      ])
      return
    }

    if (pathname === '/api/reports/financial' && method === 'GET') {
      await fulfillJson(route, TARGET_FINANCE_REPORT)
      return
    }

    throw new Error(`Unexpected TASK-108 target iPhone API request: ${method} ${pathname}`)
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

    if (pathname === '/api/coaches' && method === 'GET') {
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

async function expectTouchTargetAtLeast(locator: Locator, minSize: number) {
  const box = await locator.boundingBox()

  expect(box).not.toBeNull()
  expect(box!.width).toBeGreaterThanOrEqual(minSize)
  expect(box!.height).toBeGreaterThanOrEqual(minSize)
}
