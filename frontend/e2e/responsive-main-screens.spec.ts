import { expect, test, type Locator, type Page } from '@playwright/test'

const LONG_CLUB_NAME =
  'Северный центр функциональной подготовки и спортивной реабилитации'
const APP_CONFIG = { clubName: LONG_CLUB_NAME } as const

const MANAGEMENT_SESSION = {
  isAuthenticated: true,
  csrfToken: 'management-csrf-token',
  bootstrapMode: false,
  user: {
    id: 'headcoach-id',
    fullName: 'Главный тренер',
    login: 'headcoach',
    role: 'HeadCoach',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Home',
    allowedSections: ['Home', 'Clients', 'Groups', 'Users', 'Audit', 'Finance', 'Settings'],
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

const COACH_SESSION = {
  isAuthenticated: true,
  csrfToken: 'coach-csrf-token',
  bootstrapMode: false,
  user: {
    id: 'coach-id',
    fullName: 'Тренер группы',
    login: 'coach',
    role: 'Coach',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Home',
    allowedSections: ['Home', 'Clients'],
    permissions: {
      canManageUsers: false,
      canManageClients: false,
      canManageGroups: false,
      canManageSettings: false,
      canMarkAttendance: true,
      canViewAuditLog: false,
      canViewFinancialReports: false,
    },
    assignedGroupIds: ['group-1'],
  },
} as const

const CLIENTS_RESPONSE = {
  items: [
    {
      id: 'client-1',
      fullName: 'Александра Константинопольская-Северная',
      branchId: 'branch-1',
      branchName: 'Центр',
      status: 'Active',
      phone: '+7 999 123-45-67',
      notes: 'Клиент предпочитает вечерние слоты и напоминание в день занятия.',
      groupCount: 2,
      contactCount: 1,
      membershipWarning: true,
      hasActivePaidMembership: false,
      hasUnpaidCurrentMembership: true,
      hasCurrentMembership: true,
      membershipState: 'Unpaid',
      lastVisitDate: '2026-04-20',
      photo: null,
      groups: [
        {
          id: 'group-1',
          name: 'Группа 7: вечерний поток с длинным названием',
          branchId: 'branch-1',
          branchName: 'Центр',
          hallId: 'hall-1',
          hallName: 'Основной зал',
          isActive: true,
        },
        {
          id: 'group-2',
          name: 'Группа 9: субботний интенсив',
          branchId: 'branch-1',
          branchName: 'Центр',
          hallId: 'hall-1',
          hallName: 'Основной зал',
          isActive: true,
        },
      ],
      currentMembership: {
        id: 'membership-1',
        membershipType: 'Monthly',
        purchaseDate: '2026-04-01',
        expirationDate: '2026-04-22',
        isPaid: false,
        paymentAmount: 3500,
        singleVisitUsed: false,
      },
      currentMembershipSummary: {
        id: 'membership-1',
        membershipType: 'Monthly',
        purchaseDate: '2026-04-01',
        expirationDate: '2026-04-22',
        isPaid: false,
        singleVisitUsed: false,
      },
      membershipHistory: [],
      attendanceHistory: [],
      attendanceHistoryTotalCount: 0,
    },
  ],
  totalCount: 1,
  activeCount: 1,
  archivedCount: 0,
  skip: 0,
  take: 20,
  page: 1,
  pageSize: 20,
  hasNextPage: false,
} as const

const GROUPS_RESPONSE = {
  items: [
    {
      id: 'group-1',
      name: 'Группа 7: вечерний поток с длинным названием',
      branchId: 'branch-1',
      branchName: 'Центр',
      hallId: 'hall-1',
      hallName: 'Основной зал',
      groupTypeId: 'group-type-1',
      groupTypeName: 'Базовый тип',
      trainingStartTime: '19:00',
      durationMinutes: 60,
      weekdays: [2, 4],
      trainers: [
        {
          id: 'coach-id',
          fullName: 'Тренер группы',
          login: 'coach',
        },
      ],
      trainerIds: ['coach-id'],
      trainerCount: 2,
      trainerNames: ['Тренер группы', 'Старший тренер'],
      clientCount: 12,
      isActive: true,
    },
  ],
  totalCount: 1,
  hasNextPage: false,
} as const

const SCHEDULE_GROUPS_RESPONSE = GROUPS_RESPONSE

const ATTENDANCE_GROUPS_RESPONSE = {
  items: [
    {
      id: 'group-1',
      name: 'Группа 7: вечерний поток с длинным названием',
      trainingStartTime: '19:00',
      durationMinutes: 60,
      weekdays: [2, 4],
      clientCount: 1,
    },
  ],
} as const

const ATTENDANCE_ROSTER_RESPONSE = {
  groupId: 'group-1',
  trainingDate: '2026-04-18',
  items: [
    {
      id: 'client-1',
      fullName: 'Александра Константинопольская-Северная',
      isPresent: false,
      hasActivePaidMembership: false,
      hasUnpaidCurrentMembership: true,
      membershipWarning: true,
      membershipWarningMessage:
        'Абонемент просрочен, отметка посещения доступна.',
      groups: [
        {
          id: 'group-1',
          name: 'Группа 7: вечерний поток с длинным названием',
          isActive: true,
        },
      ],
    },
  ],
} as const

const AUDIT_FILTER_OPTIONS_RESPONSE = {
  users: [
    {
      id: 'headcoach-id',
      fullName: 'Главный тренер',
      login: 'headcoach',
    },
  ],
  actionTypes: ['Login', 'ClientUpdated'],
  entityTypes: ['UserSession', 'Client'],
  sources: ['Web'],
  messengerPlatforms: ['Telegram'],
} as const

const AUDIT_ENTRIES_RESPONSE = {
  items: [
    {
      id: 'audit-1',
      actionType: 'ClientUpdated',
      entityType: 'Client',
      entityId: 'client-1-with-long-responsive-identifier',
      description:
        'Обновлены данные клиента Александра Константинопольская-Северная: длинное описание должно переноситься внутри grid-строки без горизонтального скролла страницы.',
      createdAt: '2026-04-18T10:00:00Z',
      oldValueJson: '{"phone":"+7 999 111-22-33"}',
      newValueJson: '{"phone":"+7 999 123-45-67"}',
      userId: 'headcoach-id',
      userLogin: 'headcoach',
      userFullName: 'Главный тренер',
      source: 'Web',
      messengerPlatform: 'Telegram',
    },
  ],
  page: 1,
  pageSize: 20,
  totalCount: 1,
} as const

const FINANCE_REPORT_RESPONSE = {
  period: {
    preset: 'month',
    anchorDate: '2026-05-14',
    from: '2026-05-01',
    to: '2026-05-31',
  },
  totals: {
    soldMembershipCount: 1,
    grossSales: 4_500,
    refundTotal: 0,
    netTotal: 4_500,
    newClientsCount: 1,
  },
  branchBreakdown: [
    {
      branchId: 'branch-1',
      branchName: 'Центр',
      soldMembershipCount: 1,
      grossSales: 4_500,
      refundTotal: 0,
      netTotal: 4_500,
      newClientsCount: 1,
    },
  ],
  groupBreakdown: [],
  trainerBreakdown: [],
} as const

const USERS_RESPONSE = [
  {
    id: 'coach-id',
    fullName: 'Тренер группы',
    login: 'coach',
    role: 'Coach',
    messengerPlatform: 'Telegram',
    messengerPlatformUserId: '123456789',
    mustChangePassword: false,
    isActive: true,
    createdAt: '2026-05-01T10:00:00Z',
    updatedAt: '2026-05-01T10:00:00Z',
  },
] as const

const TRAINERS_RESPONSE = [
  {
    id: 'coach-id',
    fullName: 'Тренер группы',
    login: 'coach',
  },
] as const

const MANAGEMENT_ROUTES = [
  {
    path: '/',
    screenTestId: 'home-screen',
    navLabel: 'Главная',
    expectedPageTitle: 'Главная',
    expectedControls: ['Обновить'],
    checkSharedEdges: true,
  },
  {
    path: '/schedule',
    screenTestId: 'schedule-screen',
    navLabel: 'Расписание',
    expectedPageTitle: 'Расписание',
    expectedControls: ['Обновить'],
    expectedFilterToolbars: 0,
    checkSharedEdges: true,
    checkScheduleOverflow: true,
  },
  {
    path: '/clients',
    screenTestId: 'clients-screen',
    navLabel: 'Клиенты',
    expectedPageTitle: 'Клиенты',
    expectedControls: ['Обновить список', 'Новый клиент'],
    expectedFilterToolbars: 1,
    checkSharedEdges: true,
  },
  {
    path: '/groups',
    screenTestId: 'groups-screen',
    navLabel: 'Группы',
    expectedPageTitle: 'Группы',
    expectedControls: ['Создать группу', 'Обновить список'],
    checkSharedEdges: true,
  },
  {
    path: '/users',
    screenTestId: 'users-screen',
    navLabel: 'Тренеры',
    expectedPageTitle: 'Тренеры',
    expectedControls: ['Создать тренера', 'Обновить'],
    checkSharedEdges: true,
  },
  {
    path: '/audit',
    screenTestId: 'audit-screen',
    navLabel: 'Журнал',
    expectedPageTitle: 'Журнал',
    expectedControls: ['Обновить'],
    expectedFilterToolbars: 1,
  },
  {
    path: '/finance',
    screenTestId: 'finance-screen',
    navLabel: 'Финансы',
    expectedPageTitle: 'Финансы',
    expectedControls: ['Обновить'],
    expectedFilterToolbars: 1,
  },
  {
    path: '/settings',
    screenTestId: 'settings-screen',
    navLabel: 'Настройки',
    expectedPageTitle: 'Настройки',
    expectedControls: ['Добавить тип', 'Обновить'],
    checkSharedEdges: true,
  },
] as const

const COACH_ROUTES = [
  {
    path: '/schedule',
    screenTestId: 'schedule-screen',
    navLabel: 'Расписание',
    expectedPageTitle: 'Расписание',
    expectedControls: ['Обновить'],
    expectedFilterToolbars: 0,
    checkScheduleOverflow: true,
  },
  {
    path: '/',
    screenTestId: 'home-screen',
    navLabel: 'Главная',
    expectedPageTitle: 'Главная',
    expectedControls: ['Обновить посещения'],
    expectedFilterToolbars: 1,
  },
  {
    path: '/clients',
    screenTestId: 'clients-screen',
    navLabel: 'Клиенты',
    expectedPageTitle: 'Клиенты',
    expectedControls: [],
    expectedFilterToolbars: 1,
  },
] as const

const SIDE_NAVIGATION_SELECTOR =
  'nav.app-shell__side-nav[aria-label="Основная навигация"]'
const MOBILE_BOTTOM_NAVIGATION_SELECTOR =
  'nav.mobile-bottom-nav[aria-label="Мобильная навигация"]'
const MOBILE_MENU_BREAKPOINT = 768

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 402, height: 874 },
  { width: 420, height: 912 },
  { width: 440, height: 956 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1200 },
  { width: 1920, height: 1080 },
] as const

for (const viewport of VIEWPORTS) {
  test.describe(`Responsive smoke ${viewport.width}px`, () => {
    test.use({ viewport })

    test('management screens keep stable hooks and avoid page-level horizontal scroll', async ({
      page,
    }) => {
      await mockApi(page, MANAGEMENT_SESSION)
      let baselineEdges: { left: number; right: number } | null = null

      for (const route of MANAGEMENT_ROUTES) {
        await page.goto(route.path)
        await expect(page.getByTestId(route.screenTestId)).toBeVisible()
        await expectLongBrandHeader(page)
        await expectActiveNavigation(page, viewport.width, route.navLabel)
        await expectNoServiceIntro(page)
        await expectRoutePageTitle(page, route.expectedPageTitle)
        await expectPrimaryControls(page, route.expectedControls)
        await expectSharedVisualBaseline(page, route.expectedFilterToolbars ?? 0)
        if ('checkSharedEdges' in route && route.checkSharedEdges) {
          baselineEdges = await expectSharedContentEdges(page, baselineEdges)
        }
        if (route.screenTestId === 'clients-screen') {
          await expectClientsSharedLayoutContract(page)
        }
        if ('checkScheduleOverflow' in route && route.checkScheduleOverflow) {
          await expectScheduleOverflowContract(page)
        }
        await expectNoHorizontalScroll(page)
      }
    })

    test('coach screens keep stable hooks and avoid page-level horizontal scroll', async ({
      page,
    }) => {
      await mockApi(page, COACH_SESSION)

      for (const route of COACH_ROUTES) {
        await page.goto(route.path)
        await expect(page.getByTestId(route.screenTestId)).toBeVisible()
        await expectLongBrandHeader(page)
        await expectActiveNavigation(page, viewport.width, route.navLabel)
        await expectNoServiceIntro(page)
        await expectRoutePageTitle(page, route.expectedPageTitle)
        await expectPrimaryControls(page, route.expectedControls)
        await expectSharedVisualBaseline(page, route.expectedFilterToolbars ?? 0)
        if (route.screenTestId === 'clients-screen') {
          await expectClientsSharedLayoutContract(page)
        }
        if ('checkScheduleOverflow' in route && route.checkScheduleOverflow) {
          await expectScheduleOverflowContract(page)
        }
        await expectNoHorizontalScroll(page)
      }
    })
  })
}

test.describe('Mobile bottom navigation interactions', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('navigates direct and overflow sections without fake notifications', async ({
    page,
  }) => {
    await mockApi(page, MANAGEMENT_SESSION)
    await page.goto('/')

    const bottomNavigation = page.locator(MOBILE_BOTTOM_NAVIGATION_SELECTOR)

    await expect(bottomNavigation).toBeVisible()
    await bottomNavigation.getByRole('button', { name: 'Расписание' }).click()
    await expect(page).toHaveURL(/\/schedule$/)
    await expect(
      bottomNavigation.getByRole('button', { name: 'Расписание' }),
    ).toHaveAttribute('aria-current', 'page')

    await bottomNavigation
      .getByRole('button', { name: 'Открыть остальные разделы' })
      .click()

    const overflowList = page.locator('.mobile-bottom-nav__overflow-list')

    await expect(overflowList).toBeVisible()
    await expect(
      overflowList.getByRole('button', { name: 'Уведомления' }),
    ).toHaveCount(0)
    await overflowList.getByRole('button', { name: 'Финансы' }).click()
    await expect(page).toHaveURL(/\/finance$/)
    await expect(
      bottomNavigation.getByRole('button', { name: 'Открыть остальные разделы' }),
    ).toHaveAttribute('aria-current', 'page')
    await expect(overflowList).toBeHidden()
  })
})

async function expectLongBrandHeader(page: Page) {
  const brandTitle = page.locator('.app-shell__brand-title')

  await expect(brandTitle).toHaveText(LONG_CLUB_NAME)
  await expect(brandTitle).toHaveAttribute('title', LONG_CLUB_NAME)
}

async function expectActiveNavigation(page: Page, width: number, navLabel: string) {
  const sideNavigation = page.locator(SIDE_NAVIGATION_SELECTOR)

  if (width < MOBILE_MENU_BREAKPOINT) {
    await expect(sideNavigation).toBeHidden()
    await expect(
      page.getByRole('button', { name: 'Открыть основное меню' }),
    ).toHaveCount(0)

    const bottomNavigation = page.locator(MOBILE_BOTTOM_NAVIGATION_SELECTOR)
    const directButton = bottomNavigation.getByRole('button', { name: navLabel })

    await expect(bottomNavigation).toBeVisible()
    await expect(
      bottomNavigation.getByRole('button', { name: 'Уведомления' }),
    ).toHaveCount(0)

    if ((await directButton.count()) > 0) {
      await expect(directButton).toHaveAttribute('aria-current', 'page')
      await expectActiveMenuItemContrast(directButton)
      return
    }

    const overflowButton = bottomNavigation.getByRole('button', {
      name: 'Открыть остальные разделы',
    })

    await expect(overflowButton).toBeVisible()
    await expect(overflowButton).toHaveAttribute('aria-current', 'page')
    await expectActiveMenuItemContrast(overflowButton)
    await overflowButton.click()

    const overflowList = page.locator('.mobile-bottom-nav__overflow-list')
    const activeOverflowButton = overflowList.getByRole('button', { name: navLabel })

    await expect(overflowList).toBeVisible()
    await expect(activeOverflowButton).toHaveAttribute('aria-current', 'page')
    await expectActiveMenuItemContrast(activeOverflowButton)
    await expect(
      overflowList.getByRole('button', { name: 'Уведомления' }),
    ).toHaveCount(0)

    await page.keyboard.press('Escape')
    await expect(overflowList).toBeHidden()
    return
  }

  await expect(sideNavigation).toBeVisible()
  await expect(sideNavigation).toHaveAttribute('data-orientation', 'vertical')
  await expect(
    page.getByRole('button', { name: 'Открыть основное меню' }),
  ).toHaveCount(0)
  await expect(page.locator(MOBILE_BOTTOM_NAVIGATION_SELECTOR)).toBeHidden()

  await expect(sideNavigation.getByRole('button', { name: navLabel })).toHaveAttribute(
    'aria-current',
    'page',
  )

  const navbarBox = await page.locator('.app-shell__navbar').boundingBox()
  expect(navbarBox?.x).toBeLessThanOrEqual(1)

  if (width < 1200) {
    expect(navbarBox?.width).toBeLessThanOrEqual(230)
  } else {
    expect(navbarBox?.width).toBeGreaterThanOrEqual(220)
  }
}

async function expectActiveMenuItemContrast(activeButton: Locator) {
  const activeStyle = await activeButton.evaluate((element) => {
    const style = window.getComputedStyle(element)

    return {
      backgroundImage: style.backgroundImage,
      color: style.color,
    }
  })

  expect(activeStyle.backgroundImage).toContain('linear-gradient')
  expect(activeStyle.color).toBe('rgb(255, 255, 255)')

  const mantineLabel = activeButton.locator('.mantine-Button-label')
  if ((await mantineLabel.count()) > 0) {
    const labelColor = await mantineLabel.evaluate(
      (element) => window.getComputedStyle(element).color,
    )
    expect(labelColor).toBe('rgb(255, 255, 255)')
  }
}

async function expectNoServiceIntro(page: Page) {
  await expect(page.locator('.page-header-card')).toHaveCount(0)
  await expect(page.locator('.finance-header-card')).toHaveCount(0)
  await expect(page.getByText('Главный тренер и администратор')).toHaveCount(0)
  await expect(page.getByText('Только для главного тренера')).toHaveCount(0)
  await expect(page.getByText('Любая доступная группа')).toHaveCount(0)
  await expect(page.getByText(/Показано\s+\d+\s+из\s+\d+/)).toHaveCount(0)
  await expect(page.getByText(/Фильтры:\s+\d+/)).toHaveCount(0)
}

async function expectRoutePageTitle(page: Page, title: string) {
  const main = page.locator('main')
  const heading = main.getByRole('heading', { level: 1, name: title })

  await expect(heading).toBeVisible()
  await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1)

  const headingBox = await heading.boundingBox()
  const headerBox = await page.locator('.app-shell__header').boundingBox()
  const layoutBox = await main.locator('.page-layout').first().boundingBox()
  const firstSectionBox = await main.locator('.page-section').first().boundingBox()
  const headingContext = await heading.evaluate((element) => ({
    insideCard: Boolean(
      element.closest(
        '.page-section, .page-card, .surface-card, .filter-toolbar, .list-row-card, .clients-v7-row, .clients-v7-preview, .schedule-board',
      ),
    ),
  }))

  expect(headingBox).not.toBeNull()
  expect(headerBox).not.toBeNull()
  expect(layoutBox).not.toBeNull()
  expect(firstSectionBox).not.toBeNull()
  expect(headingContext.insideCard).toBe(false)
  expect(Math.round(layoutBox!.y - (headerBox!.y + headerBox!.height))).toBeLessThanOrEqual(16)
  expect(headingBox!.y + headingBox!.height).toBeLessThanOrEqual(firstSectionBox!.y + 1)
}

async function expectPrimaryControls(
  page: Page,
  expectedControls: readonly string[],
) {
  for (const controlName of expectedControls) {
    await expect(
      page.getByRole('button', { name: controlName }).first(),
    ).toBeVisible()
  }
}

async function expectSharedVisualBaseline(
  page: Page,
  expectedFilterToolbars: number,
) {
  const main = page.locator('main')

  await expect(
    main.locator(
      '.page-layout, .page-section, .filter-toolbar, .list-row-card, .clients-v7-row, .schedule-board',
    ).first(),
  ).toBeVisible()

  if (expectedFilterToolbars > 0) {
    await expect(main.locator('.filter-toolbar')).toHaveCount(expectedFilterToolbars)
  }
}

async function expectSharedContentEdges(
  page: Page,
  baseline: { left: number; right: number } | null,
) {
  const layout = page.locator('main .page-layout').first()
  const firstSection = layout.locator('.page-section').first()
  const box = await layout.boundingBox()
  const firstSectionBox = await firstSection.boundingBox()
  const navbarBox = await page.locator('.app-shell__navbar').boundingBox()
  const viewportWidth = await page.evaluate(() => window.innerWidth)

  expect(box).not.toBeNull()
  expect(firstSectionBox).not.toBeNull()

  const edges = {
    left: Math.round(box!.x),
    right: Math.round(box!.x + box!.width),
  }
  const navbarRight = navbarBox ? navbarBox.x + navbarBox.width : 0
  const expectedLeft = Math.round(navbarRight + 16)
  const expectedRightGap = 16

  expect(Math.abs(edges.left - expectedLeft)).toBeLessThanOrEqual(2)
  expect(Math.abs(viewportWidth - edges.right - expectedRightGap)).toBeLessThanOrEqual(2)
  expect(Math.abs(edges.left - Math.round(firstSectionBox!.x))).toBeLessThanOrEqual(2)
  expect(
    Math.abs(edges.right - Math.round(firstSectionBox!.x + firstSectionBox!.width)),
  ).toBeLessThanOrEqual(2)

  if (baseline) {
    expect(Math.abs(edges.left - baseline.left)).toBeLessThanOrEqual(2)
    expect(Math.abs(edges.right - baseline.right)).toBeLessThanOrEqual(2)
  }

  return baseline ?? edges
}

async function expectClientsSharedLayoutContract(page: Page) {
  const clientsLayout = page.locator('main [data-testid="clients-screen"].page-layout')

  await expect(clientsLayout).toHaveCount(1)
  expect(await clientsLayout.locator(':scope > .page-section').count()).toBeGreaterThanOrEqual(2)

  const inlineLayoutOverrides = await clientsLayout.evaluate((element) => ({
    maxWidth: element.style.maxWidth,
    padding: element.style.padding,
    paddingInline: element.style.paddingInline,
    width: element.style.width,
  }))

  expect(inlineLayoutOverrides).toEqual({
    maxWidth: '',
    padding: '',
    paddingInline: '',
    width: '',
  })

  const geometry = await clientsLayout.evaluate((element) => {
    const layoutRect = element.getBoundingClientRect()
    const sectionRects = Array.from(
      element.querySelectorAll<HTMLElement>(':scope > .page-section'),
      (section) => {
        const rect = section.getBoundingClientRect()

        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
        }
      },
    )

    return {
      layout: {
        left: layoutRect.left,
        right: layoutRect.right,
        width: layoutRect.width,
      },
      sections: sectionRects,
    }
  })

  expect(geometry.sections.length).toBeGreaterThanOrEqual(2)

  for (const section of geometry.sections) {
    expect(Math.abs(section.left - geometry.layout.left)).toBeLessThanOrEqual(2)
    expect(Math.abs(section.right - geometry.layout.right)).toBeLessThanOrEqual(2)
    expect(section.width).toBeLessThanOrEqual(geometry.layout.width + 2)
  }
}

async function expectScheduleOverflowContract(page: Page) {
  await expect(page.getByTestId('schedule-filters')).toBeVisible()
  const boardBox = await page.getByTestId('schedule-board').boundingBox()

  expect(boardBox).not.toBeNull()

  const viewport = page.locator('.schedule-board__viewport')
  const viewportCount = await viewport.count()

  if (viewportCount === 0) {
    return
  }

  await expect(viewport.first()).toHaveCSS('overflow-x', 'auto')

  const containment = await page.getByTestId('schedule-board').evaluate((board) => {
    const section = board.closest<HTMLElement>('.page-section')
    const viewport = board.querySelector<HTMLElement>('.schedule-board__viewport')

    if (!section || !viewport) {
      return null
    }

    const sectionRect = section.getBoundingClientRect()
    const viewportRect = viewport.getBoundingClientRect()

    return {
      section: {
        left: sectionRect.left,
        right: sectionRect.right,
        width: sectionRect.width,
      },
      viewport: {
        left: viewportRect.left,
        right: viewportRect.right,
        width: viewportRect.width,
      },
    }
  })

  expect(containment).not.toBeNull()
  expect(containment!.viewport.left).toBeGreaterThanOrEqual(containment!.section.left - 2)
  expect(containment!.viewport.right).toBeLessThanOrEqual(containment!.section.right + 2)
  expect(containment!.viewport.width).toBeLessThanOrEqual(containment!.section.width + 2)

  const overflow = await viewport.first().evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))

  expect(overflow.scrollWidth).toBeGreaterThanOrEqual(overflow.clientWidth)
}

async function expectNoHorizontalScroll(page: Page) {
  await expect
    .poll(async () =>
      page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      })),
    )
    .toEqual(
      expect.objectContaining({
        clientWidth: expect.any(Number),
        scrollWidth: expect.any(Number),
      }),
    )

  const dimensions = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }))

  expect(dimensions.documentScrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
  expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)

  const overflowingElements = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('main *'))
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        const style = window.getComputedStyle(element)

        if (rect.width === 0 || rect.height === 0 || style.display === 'none') {
          return false
        }

        let parent = element.parentElement
        while (parent && parent.tagName !== 'MAIN') {
          const parentStyle = window.getComputedStyle(parent)
          if (['auto', 'scroll'].includes(parentStyle.overflowX)) {
            return false
          }
          parent = parent.parentElement
        }

        return rect.left < -1 || rect.right > window.innerWidth + 1
      })
      .slice(0, 5)
      .map((element) => ({
        className: element.className.toString(),
        tagName: element.tagName,
        text: element.textContent?.trim().slice(0, 80) ?? '',
      })),
  )

  expect(overflowingElements).toEqual([])
}

async function mockApi(
  page: Page,
  session: typeof MANAGEMENT_SESSION | typeof COACH_SESSION,
) {
  await page.route('**/api/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    if (!requestUrl.pathname.startsWith('/api/')) {
      await route.continue()
      return
    }

    const { pathname } = requestUrl
    const method = route.request().method()

    if (pathname === '/api/auth/session' && method === 'GET') {
      await fulfillJson(route, 200, session)
      return
    }

    if (pathname === '/api/config' && method === 'GET') {
      await fulfillJson(route, 200, APP_CONFIG)
      return
    }

    if (pathname === '/api/clients' && method === 'GET') {
      await fulfillJson(route, 200, CLIENTS_RESPONSE)
      return
    }

    if (pathname === '/api/clients/client-1' && method === 'GET') {
      await fulfillJson(route, 200, CLIENTS_RESPONSE.items[0])
      return
    }

    if (pathname === '/api/clients/expiring-memberships' && method === 'GET') {
      await fulfillJson(route, 200, {
        items: [
          {
            clientId: 'client-1',
            fullName: 'Александра Константинопольская-Северная',
            membershipType: 'Monthly',
            expirationDate: '2026-04-22',
            daysUntilExpiration: 3,
            isPaid: false,
          },
        ],
      })
      return
    }

    if (pathname === '/api/schedule/groups' && method === 'GET') {
      await fulfillJson(route, 200, SCHEDULE_GROUPS_RESPONSE)
      return
    }

    if (pathname === '/api/groups' && method === 'GET') {
      await fulfillJson(route, 200, GROUPS_RESPONSE)
      return
    }

    if (pathname === '/api/groups/options/trainers' && method === 'GET') {
      await fulfillJson(route, 200, TRAINERS_RESPONSE)
      return
    }

    if (pathname === '/api/users' && method === 'GET') {
      await fulfillJson(route, 200, USERS_RESPONSE)
      return
    }

    if (pathname === '/api/branches' && method === 'GET') {
      await fulfillJson(route, 200, [
        {
          id: 'branch-1',
          name: 'Центр',
          address: 'ул. Тестовая, 1',
          description: 'Основной филиал',
          isArchived: false,
          hallCount: 1,
          groupCount: 1,
          clientCount: 1,
          createdAt: '2026-05-01T10:00:00Z',
          updatedAt: '2026-05-01T10:00:00Z',
        },
      ])
      return
    }

    if (pathname === '/api/halls' && method === 'GET') {
      await fulfillJson(route, 200, [
        {
          id: 'hall-1',
          branchId: 'branch-1',
          branchName: 'Центр',
          name: 'Основной зал',
          description: 'Зал для групп',
          isArchived: false,
          groupCount: 1,
          createdAt: '2026-05-01T10:00:00Z',
          updatedAt: '2026-05-01T10:00:00Z',
        },
      ])
      return
    }

    if (pathname === '/api/group-types' && method === 'GET') {
      await fulfillJson(route, 200, [
        {
          id: 'group-type-1',
          name: 'Базовый тип',
          description: 'Тип для smoke',
          groupCount: 1,
          createdAt: '2026-05-01T10:00:00Z',
          updatedAt: '2026-05-01T10:00:00Z',
        },
      ])
      return
    }

    if (pathname === '/api/settings/administrators' && method === 'GET') {
      await fulfillJson(route, 200, [])
      return
    }

    if (pathname === '/api/attendance/groups' && method === 'GET') {
      await fulfillJson(route, 200, ATTENDANCE_GROUPS_RESPONSE)
      return
    }

    if (pathname === '/api/attendance/groups/group-1/clients' && method === 'GET') {
      await fulfillJson(route, 200, ATTENDANCE_ROSTER_RESPONSE)
      return
    }

    if (pathname === '/api/audit-logs/options' && method === 'GET') {
      await fulfillJson(route, 200, AUDIT_FILTER_OPTIONS_RESPONSE)
      return
    }

    if (pathname === '/api/audit-logs' && method === 'GET') {
      await fulfillJson(route, 200, AUDIT_ENTRIES_RESPONSE)
      return
    }

    if (pathname === '/api/reports/financial' && method === 'GET') {
      await fulfillJson(route, 200, FINANCE_REPORT_RESPONSE)
      return
    }

    throw new Error(
      `Unexpected API request in responsive smoke: ${method} ${pathname}`,
    )
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
