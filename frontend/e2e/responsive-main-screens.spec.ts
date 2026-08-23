import { expect, test, type Locator, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

const LONG_CLUB_NAME =
  'Северный центр функциональной подготовки и спортивной реабилитации'
type IPhoneManifest = {
  screens: Array<{
    alternateTheme?: boolean
    id: string
  }>
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

const APP_CONFIG = {
  clubName: LONG_CLUB_NAME,
  themeId: 'default-green-v1',
  authBackgroundImageId: 'k4pro-login-v1',
} as const

type AppConfigFixture = {
  authBackgroundImageId: string
  clubName: string
  themeId: string
}

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
    landingScreen: 'Attention',
    allowedSections: ['Attendance', 'Attention', 'Schedule', 'Clients', 'Groups', 'Users', 'Audit', 'Finance', 'Settings'],
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

const HEAD_COACH_ADMIN_SESSION = {
  ...MANAGEMENT_SESSION,
  user: {
    ...MANAGEMENT_SESSION.user,
    createRoleOptions: ['Administrator', 'SuperAdministrator'],
  },
} as const

const ADMIN_AUDIT_SESSION = {
  ...MANAGEMENT_SESSION,
  csrfToken: 'administrator-audit-csrf-token',
  user: {
    ...MANAGEMENT_SESSION.user,
    branchId: 'branch-1',
    fullName: 'Администратор',
    id: 'administrator-id',
    login: 'administrator',
    permissions: {
      ...MANAGEMENT_SESSION.user.permissions,
      canManageUsers: false,
    },
    role: 'Administrator',
  },
} as const

const SUPER_ADMIN_AUDIT_SESSION = {
  ...MANAGEMENT_SESSION,
  csrfToken: 'superadministrator-audit-csrf-token',
  user: {
    ...MANAGEMENT_SESSION.user,
    fullName: 'Суперадминистратор',
    id: 'superadministrator-id',
    login: 'superadministrator',
    role: 'SuperAdministrator',
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
      hasActiveMembership: false,
      hasCurrentMembership: true,
      membershipState: 'Expired',
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
        saleId: 'sale-1',
        membershipCatalogItemId: 'catalog-1',
        membershipName: 'Месяц',
        behaviorKind: 'Term',
        purchaseDate: '2026-04-01',
        paymentDate: '2026-04-01',
        paymentRecordedAt: '2026-04-01T09:00:00Z',
        paymentRecordedByUserId: 'coach-1',
        paymentRecordedByUserName: 'Тренер',
        expirationDate: '2026-04-22',
        pricingMode: 'Catalog',
        grossAmount: 3500,
        catalogPrice: 3500,
        singleVisitUsed: false,
      },
      currentMembershipSummary: {
        id: 'membership-1',
        saleId: 'sale-1',
        membershipCatalogItemId: 'catalog-1',
        membershipName: 'Месяц',
        behaviorKind: 'Term',
        purchaseDate: '2026-04-01',
        paymentDate: '2026-04-01',
        paymentRecordedAt: '2026-04-01T09:00:00Z',
        paymentRecordedByUserId: 'coach-1',
        paymentRecordedByUserName: 'Тренер',
        expirationDate: '2026-04-22',
        pricingMode: 'Catalog',
        grossAmount: 3500,
        catalogPrice: 3500,
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
  skip: 0,
  take: 20,
  totalCount: 1,
  hasNextPage: false,
} as const

const GROUPS_SUMMARY_RESPONSE = {
  totalCount: 100,
  activeWithoutTrainerCount: 4,
} as const

const SCHEDULE_GROUPS_RESPONSE = GROUPS_RESPONSE

const ATTENDANCE_GROUPS_RESPONSE = {
  groups: [
    {
      id: 'group-1',
      name: 'Группа 7: вечерний поток с длинным названием',
      trainingStartTime: '19:00',
      durationMinutes: 60,
      weekdays: [2, 4],
      clientCount: 123,
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
      fullName: 'Александра Константинопольская-Северная',
      state: 'Unmarked',
      hasActiveMembership: false,
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
    ...Array.from({ length: 122 }, (_, index) => ({
      id: `client-${index + 2}`,
      fullName: `Отмеченный клиент ${index + 2}`,
      state: 'Present' as const,
      hasActiveMembership: true,
      membershipWarning: false,
      groups: [
        {
          id: 'group-1',
          name: 'Группа 7: вечерний поток с длинным названием',
          isActive: true,
        },
      ],
    })),
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
      actionType: 'ClientCreated',
      entityType: 'Client',
      entityId: 'client-1',
      description: 'Создан новый клиент',
      createdAt: '2026-04-18T10:00:00Z',
      oldValueJson: null,
      newValueJson: '{"status":"Active"}',
      userId: 'headcoach-id',
      userName: 'Главный тренер',
      userLogin: 'headcoach',
      source: 'Web',
      messengerPlatform: 'Telegram',
    },
    {
      id: 'audit-2',
      actionType: 'ClientUpdated',
      entityType: 'Client',
      entityId: 'client-2',
      description: 'Обновлён телефон клиента',
      createdAt: '2026-04-18T09:50:00Z',
      oldValueJson: '{"phone":"+7 999 111-22-33"}',
      newValueJson: '{"phone":"+7 999 123-45-67"}',
      userId: 'headcoach-id',
      userName: 'Главный тренер',
      userLogin: 'headcoach',
      source: 'Web',
      messengerPlatform: 'Telegram',
    },
    {
      id: 'audit-3',
      actionType: 'AttendanceImported',
      entityType: 'ExternalAttendance',
      entityId: 'external-42',
      description: 'Attendance import completed',
      createdAt: '2026-04-18T09:40:00Z',
      oldValueJson: null,
      newValueJson: null,
      userId: 'headcoach-id',
      userName: 'Главный тренер',
      userLogin: 'headcoach',
      source: 'ExternalApi',
      messengerPlatform: 'Telegram',
    },
    {
      id: 'audit-4',
      actionType: 'Login',
      entityType: 'UserSession',
      entityId: 'session-4',
      description: 'Пользователь вошёл в систему',
      createdAt: '2026-04-18T09:30:00Z',
      oldValueJson: null,
      newValueJson: null,
      userId: 'headcoach-id',
      userName: 'Главный тренер',
      userLogin: 'headcoach',
      source: 'Web',
      messengerPlatform: 'Telegram',
    },
    {
      id: 'audit-long',
      actionType: 'ClientUpdated',
      entityType: 'Client',
      entityId: 'client-1-with-long-responsive-identifier',
      description:
        'Обновлены данные клиента Александра Константинопольская-Северная: длинное описание должно переноситься внутри grid-строки без горизонтального скролла страницы.',
      createdAt: '2026-04-18T09:20:00Z',
      oldValueJson: null,
      newValueJson: null,
      userId: 'headcoach-id',
      userName: 'Пользователь с очень длинным отображаемым именем и логином',
      userLogin: 'very.long.audit.user.login',
      source: 'Web',
      messengerPlatform: 'Telegram',
    },
  ],
  page: 1,
  pageSize: 20,
  totalCount: 45,
  hasNextPage: true,
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
    path: '/attention',
    screenTestId: 'attention-screen',
    navLabel: 'Внимание',
    expectedPageTitle: 'Внимание',
    expectedPageTitleHidden: true,
    expectedControls: ['Обновить список'],
    checkSharedEdges: true,
  },
  {
    path: '/schedule',
    screenTestId: 'schedule-screen',
    navLabel: 'Расписание',
    expectedPageTitle: 'Расписание',
    expectedPageTitleHidden: true,
    expectedControls: ['Обновить'],
    expectedFilterToolbars: 1,
    checkSharedEdges: true,
    checkScheduleOverflow: true,
  },
  {
    path: '/clients',
    screenTestId: 'clients-screen',
    navLabel: 'Клиенты',
    expectedPageTitle: 'Клиенты',
    expectedPageTitleHidden: true,
    expectedControls: ['Обновить список', 'Новый клиент'],
    expectedFilterToolbars: 0,
    checkSharedEdges: true,
  },
  {
    path: '/groups',
    screenTestId: 'groups-screen',
    navLabel: 'Группы',
    expectedPageTitle: 'Группы',
    expectedPageTitleHidden: true,
    expectedControls: ['Новая группа', 'Обновить список групп'],
    checkSharedEdges: true,
  },
  {
    path: '/coaches',
    screenTestId: 'users-screen',
    navLabel: 'Тренеры',
    expectedPageTitle: 'Тренеры',
    expectedPageTitleHidden: true,
    expectedControls: ['Создать тренера', 'Обновить'],
    checkSharedEdges: true,
  },
  {
    path: '/audit',
    screenTestId: 'audit-screen',
    navLabel: 'Журнал',
    expectedPageTitle: 'Журнал',
    expectedPageTitleHidden: true,
    expectedControls: ['Обновить'],
    expectedFilterToolbars: 1,
  },
  {
    path: '/finance',
    screenTestId: 'finance-screen',
    navLabel: 'Финансы',
    expectedPageTitle: 'Финансы',
    expectedPageTitleHidden: true,
    expectedControls: ['Обновить'],
    expectedFilterToolbars: 1,
  },
  {
    path: '/settings',
    screenTestId: 'settings-screen',
    navLabel: 'Настройки',
    expectedPageTitle: 'Настройки',
    expectedPageTitleHidden: true,
    expectedControls: ['Добавить абонемент', 'Обновить'],
    checkSharedEdges: true,
  },
] as const

const COACH_ROUTES = [
  {
    path: '/attendance',
    screenTestId: 'attendance-screen',
    navLabel: 'Посещения',
    expectedPageTitle: 'Посещения',
    expectedPageTitleHidden: true,
    expectedControls: ['Обновить'],
    expectedFilterToolbars: 0,
  },
  {
    path: '/schedule',
    screenTestId: 'schedule-screen',
    navLabel: 'Расписание',
    expectedPageTitle: 'Расписание',
    expectedPageTitleHidden: true,
    expectedControls: ['Обновить'],
    expectedFilterToolbars: 1,
    checkScheduleOverflow: true,
  },
  {
    path: '/clients',
    screenTestId: 'clients-screen',
    navLabel: 'Клиенты',
    expectedPageTitle: 'Клиенты',
    expectedPageTitleHidden: true,
    expectedControls: [],
    expectedFilterToolbars: 0,
  },
] as const

const SIDE_NAVIGATION_SELECTOR =
  'nav.app-shell__side-nav[aria-label="Основная навигация"]'
const MOBILE_BOTTOM_NAVIGATION_SELECTOR =
  'nav.mobile-bottom-nav[aria-label="Мобильная навигация"]'
const MOBILE_MENU_BREAKPOINT = 768

const RESPONSIVE_VIEWPORTS = [
  { label: 'extreme-mobile-320', width: 320, height: 780 },
  { label: 'stress-mobile-390', width: 390, height: 844 },
  { label: 'iphone-15-class-393', width: 393, height: 852 },
  { label: 'iphone-17-class-402', width: 402, height: 874 },
  { label: 'target-iphone-air', ...TASK_090_MANIFEST.viewports.iphoneAir },
  {
    label: 'target-iphone-17-pro-max',
    ...TASK_090_MANIFEST.viewports.iphone17ProMax,
  },
  { label: 'tablet', width: 768, height: 1024 },
  { label: 'desktop', width: 1440, height: 1200 },
  { label: 'wide-desktop', width: 1920, height: 1080 },
] as const

for (const viewport of RESPONSIVE_VIEWPORTS) {
  test.describe(`Responsive smoke ${viewport.label}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

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
        await expectRoutePageTitle(
          page,
          route.expectedPageTitle,
          'expectedPageTitleHidden' in route && route.expectedPageTitleHidden,
        )
        await expectPrimaryControls(
          page,
          route.expectedControls,
        )
        await expectSharedVisualBaseline(page, route.expectedFilterToolbars ?? 0)
        if ('checkSharedEdges' in route && route.checkSharedEdges) {
          baselineEdges = await expectSharedContentEdges(page, baselineEdges)
        }
        if (route.screenTestId === 'clients-screen') {
          await expectClientsSharedLayoutContract(page, true)
        }
        if (route.screenTestId === 'audit-screen') {
          await expectAuditListContract(page)
        }
        if ('checkScheduleOverflow' in route && route.checkScheduleOverflow) {
          await expectScheduleOverflowContract(page)
        }
        if (viewport.width === 320 && route.path === '/') {
          await expectAttendance320Contract(page)
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
        await expectRoutePageTitle(
          page,
          route.expectedPageTitle,
          'expectedPageTitleHidden' in route && route.expectedPageTitleHidden,
        )
        await expectPrimaryControls(page, route.expectedControls)
        await expectSharedVisualBaseline(page, route.expectedFilterToolbars ?? 0)
        if (route.screenTestId === 'clients-screen') {
          await expectClientsSharedLayoutContract(page, false)
        }
        if ('checkScheduleOverflow' in route && route.checkScheduleOverflow) {
          await expectScheduleOverflowContract(page)
        }
        await expectNoHorizontalScroll(page)
      }
    })
  })
}

const TASK_107_AUDIT_VIEWPORTS = [
  { label: 'audit-narrow-360', width: 360, height: 780 },
  { label: 'audit-stress-390', width: 390, height: 844 },
  { label: 'audit-iphone-air-420', width: 420, height: 912 },
  { label: 'audit-iphone-pro-max-440', width: 440, height: 956 },
  { label: 'audit-compact-air', width: 912, height: 420 },
  { label: 'audit-compact-pro-max', width: 956, height: 440 },
  { label: 'audit-tablet', width: 768, height: 1024 },
  { label: 'audit-desktop', width: 1440, height: 1200 },
] as const

for (const viewport of TASK_107_AUDIT_VIEWPORTS) {
  test.describe(`TASK-107 audit required geometry ${viewport.label}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('keeps compact decision data, pager and details reachable', async ({ page }) => {
      await mockApi(page, ADMIN_AUDIT_SESSION)
      await page.goto('/audit')

      await expectAuditListContract(page)
      await expectNoHorizontalScroll(page)

      if (viewport.height <= 440) {
        const details = page.getByTestId('audit-log-details-action').first()
        await details.click()

        const dialog = page.getByRole('dialog', {
          name: 'Подробности записи журнала',
        })
        const close = dialog.getByRole('button', {
          name: 'Закрыть подробности записи',
        })
        await expect(dialog).toBeVisible()
        await expect(close).toBeInViewport()
        await close.click()
        await expect(details).toBeFocused()
      }
    })

    if (viewport.width === 390) {
      test('rejects repeated labels, oversized rows and undersized unnamed pager controls', async ({
        page,
      }) => {
        await mockApi(page, ADMIN_AUDIT_SESSION)
        await page.goto('/audit')

        const row = page.getByTestId('audit-log-row').first()
        const rowBox = await row.boundingBox()
        const paginationRoot = page.locator('.mantine-Pagination-root')
        const controlBoxes = await paginationRoot.locator('button').evaluateAll((controls) =>
          controls.map((control) => {
            const rect = control.getBoundingClientRect()
            return { height: rect.height, width: rect.width }
          }),
        )

        expect.soft(await row.locator('.audit-log-cell__label:visible').count()).toBe(0)
        expect.soft(rowBox).not.toBeNull()
        expect.soft(rowBox?.height ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(128)
        expect.soft(Math.min(...controlBoxes.map((box) => box.width))).toBeGreaterThanOrEqual(44)
        expect.soft(Math.min(...controlBoxes.map((box) => box.height))).toBeGreaterThanOrEqual(44)
        await expect.soft(
          page.getByRole('button', { name: 'Предыдущая страница журнала' }),
        ).toBeVisible()
        await expect.soft(
          page.getByRole('button', { name: 'Следующая страница журнала' }),
        ).toBeVisible()
      })
    }
  })
}

for (const profile of [
  { label: 'HeadCoach', session: MANAGEMENT_SESSION },
  { label: 'SuperAdministrator', session: SUPER_ADMIN_AUDIT_SESSION },
] as const) {
  test.describe(`TASK-111 audit access parity ${profile.label}`, () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('opens the same API-backed audit surface without duplicating geometry coverage', async ({
      page,
    }) => {
      await mockApi(page, profile.session)
      await page.goto('/audit')

      await expect(page.getByTestId('audit-screen')).toBeVisible()
      await expect(page.getByTestId('audit-log-grid')).toBeVisible()
      await expect(page.getByRole('navigation', {
        name: 'Страницы журнала действий',
      })).toBeVisible()
      await expectNoHorizontalScroll(page)
    })
  })
}

type AttendanceViewportConstraint = {
  label: string
  width: number
  height: number
  dateClusterMinWidth?: number
  dateInputMinWidth?: number
}

const TASK_104_ATTENDANCE_VIEWPORTS: AttendanceViewportConstraint[] = [
  { label: 'attendance-narrow-360', width: 360, height: 780, dateInputMinWidth: 156 },
  { label: 'attendance-stress-390', width: 390, height: 844, dateInputMinWidth: 176 },
  { label: 'attendance-iphone-air-420', ...TASK_090_MANIFEST.viewports.iphoneAir, dateInputMinWidth: 200 },
  { label: 'attendance-iphone-pro-max-440', ...TASK_090_MANIFEST.viewports.iphone17ProMax, dateInputMinWidth: 216 },
  { label: 'attendance-compact-air-912', width: 912, height: 420, dateClusterMinWidth: 332 },
  { label: 'attendance-compact-pro-max-956', width: 956, height: 440, dateClusterMinWidth: 332 },
  { label: 'attendance-tablet-768', width: 768, height: 1024 },
  { label: 'attendance-desktop-1440', width: 1440, height: 1200 },
] as const

for (const viewport of TASK_104_ATTENDANCE_VIEWPORTS) {
  test.describe(`TASK-104 attendance required geometry ${viewport.label}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('keeps primary attendance action and toolbar readable in compact workbench', async ({
      page,
    }) => {
      await mockApi(page, MANAGEMENT_SESSION)
      await page.goto('/attendance')

      await expect(page.getByTestId('attendance-screen')).toBeVisible()
      await expect(page.getByTestId('attendance-toolbar')).toBeVisible()
      await expect(page.getByTestId('attendance-client-card-client-1')).toBeVisible()
      await expectAttendanceToolbarGeometry(page, viewport)
      await expectNoHorizontalScroll(page)
    })
  })
}

const ALTERNATE_THEME_CASES = [
  { id: 'attention-ready', path: '/attention', screenTestId: 'attention-screen' },
  { id: 'schedule-ready', path: '/schedule', screenTestId: 'schedule-screen' },
  {
    id: 'schedule-filter-surface',
    path: '/schedule',
    screenTestId: 'schedule-screen',
    setup: 'schedule-filters',
  },
  { id: 'clients-browse', path: '/clients', screenTestId: 'clients-screen' },
  {
    id: 'clients-preview',
    path: '/clients',
    screenTestId: 'clients-screen',
    setup: 'client-preview',
  },
  { id: 'groups-list', path: '/groups', screenTestId: 'groups-screen' },
  { id: 'audit-list', path: '/audit', screenTestId: 'audit-screen' },
  { id: 'finance-report', path: '/finance', screenTestId: 'finance-screen' },
  {
    id: 'settings-group-types',
    path: '/settings',
    screenTestId: 'settings-screen',
    setup: 'settings-group-types',
  },
] as const

const FILTER_SURFACE_CONFORMANCE_CASES = [
  {
    id: 'schedule',
    path: '/schedule',
    className: 'crm-filter-surface',
    surfaceSelector: '[data-testid="schedule-filter-panel"]',
    focusSelector: 'button',
  },
  {
    id: 'clients',
    path: '/clients',
    className: 'crm-filter-surface',
    surfaceSelector: '[data-testid="clients-filter-panel"] .entity-locator-bar',
    focusSelector: 'input',
  },
  {
    id: 'groups',
    path: '/groups',
    className: 'crm-filter-surface',
    surfaceSelector: '[data-testid="groups-list-controls"] .entity-locator-bar',
    focusSelector: 'input',
  },
  {
    id: 'audit',
    path: '/audit',
    className: 'crm-filter-surface',
    surfaceSelector: '[data-testid="audit-filter-panel"]',
    focusSelector: 'button',
  },
  {
    id: 'finance',
    path: '/finance',
    className: 'crm-filter-surface',
    surfaceSelector: '[data-testid="finance-filter-panel"]',
    focusSelector: 'button',
  },
] as const

const FILTER_CONTEXT_EXCEPTION_CASES = [
  {
    id: 'attendance',
    path: '/attendance',
    className: 'crm-context-surface',
    forbiddenClassName: 'crm-filter-surface',
    surfaceSelector: '[data-testid="attendance-toolbar"]',
    focusSelector: 'input',
  },
] as const

test.describe('Manifest alternate-theme representative matrix', () => {
  test.use({ viewport: TASK_090_MANIFEST.viewports.iphone17ProMax })

  test('preserves operations, focus/status semantics and geometry within one CSS pixel', async ({
    page,
  }) => {
    const manifestAlternateIds = new Set(
      TASK_090_MANIFEST.screens
        .filter((screen) => screen.alternateTheme)
        .map((screen) => screen.id),
    )

    for (const representative of ALTERNATE_THEME_CASES) {
      expect(
        manifestAlternateIds.has(representative.id),
        `${representative.id} must remain part of the normative alternate-theme matrix`,
      ).toBe(true)
    }

    await mockApi(page, MANAGEMENT_SESSION, APP_CONFIG)
    const defaultSnapshots = await captureAlternateThemeSnapshots(page)

    await page.unroute('**/api/**')
    await mockApi(page, MANAGEMENT_SESSION, {
      ...APP_CONFIG,
      themeId: 'test-blue-coral-v1',
    })
    const alternateSnapshots = await captureAlternateThemeSnapshots(page)

    expect(alternateSnapshots.map((snapshot) => snapshot.id)).toEqual(
      defaultSnapshots.map((snapshot) => snapshot.id),
    )

    for (let index = 0; index < defaultSnapshots.length; index += 1) {
      const defaultSnapshot = defaultSnapshots[index]
      const alternateSnapshot = alternateSnapshots[index]

      expect(alternateSnapshot.operations).toEqual(defaultSnapshot.operations)
      expect(alternateSnapshot.statusSemantics).toEqual(
        defaultSnapshot.statusSemantics,
      )
      expect(alternateSnapshot.boxes).toHaveLength(defaultSnapshot.boxes.length)

      for (let boxIndex = 0; boxIndex < defaultSnapshot.boxes.length; boxIndex += 1) {
        const defaultBox = defaultSnapshot.boxes[boxIndex]
        const alternateBox = alternateSnapshot.boxes[boxIndex]

        for (const coordinate of ['x', 'y', 'width', 'height'] as const) {
          expect(
            Math.abs(alternateBox[coordinate] - defaultBox[coordinate]),
            `${defaultSnapshot.id} ${defaultBox.key} ${coordinate}`,
          ).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})

test.describe('TASK-094 filter surface conformance', () => {
  test.use({ viewport: TASK_090_MANIFEST.viewports.iphoneAir })

  test('standard surfaces and attendance context resolve to semantic paint tokens in both themes', async ({
    page,
  }) => {
    await mockApi(page, MANAGEMENT_SESSION, APP_CONFIG)
    const defaultBoxes = await captureFilterSurfaceConformance(page)

    await page.unroute('**/api/**')
    await mockApi(page, MANAGEMENT_SESSION, {
      ...APP_CONFIG,
      themeId: 'test-blue-coral-v1',
    })
    const alternateBoxes = await captureFilterSurfaceConformance(page)

    expect(Object.keys(alternateBoxes)).toEqual(Object.keys(defaultBoxes))

    for (const [id, defaultBox] of Object.entries(defaultBoxes)) {
      const alternateBox = alternateBoxes[id]

      expect(alternateBox).toBeDefined()
      for (const coordinate of ['width', 'height'] as const) {
        expect(
          Math.abs(alternateBox[coordinate] - defaultBox[coordinate]),
          `${id} ${coordinate}`,
        ).toBeLessThanOrEqual(1)
      }
    }
  })
})

for (const width of [320, 390, 420, 440, 768, 1440]) {
  test.describe(`Groups registry ${width}px`, () => {
    test.use({ viewport: { width, height: width < 768 ? 956 : 1200 } })

    test('keeps locator, primary actions and first row accessible without overflow', async ({
      page,
    }) => {
      await mockApi(page, MANAGEMENT_SESSION)
      await page.goto('/groups')

      const main = page.locator('main')
      const locator = main.getByTestId('groups-list-controls')
      const search = main.getByRole('textbox', { name: 'Поиск групп по названию' })
      const filters = main.getByRole('button', { name: 'Открыть фильтры' })
      const create = main.getByRole('button', { name: 'Новая группа', exact: true })
      const refresh = main.getByRole('button', { name: 'Обновить список групп' })
      const taskActions = main.locator('.groups-list-locator .task-toolbar-actions')
      const firstRow = main.locator('[data-testid^="group-card-"]').first()

      await expect(locator).toBeVisible()
      await expect(main.locator('.groups-summary-bar')).toHaveCount(0)
      await expect(main.getByRole('heading', { level: 1, name: 'Группы' })).toBeAttached()
      await expect(main.getByRole('region', { name: 'Список групп' })).toBeVisible()
      await expect(taskActions).toBeVisible()
      await expect(create).toHaveClass(/task-toolbar-action--primary/)
      await expect(refresh).toHaveClass(/task-toolbar-action--refresh/)
      await expect(taskActions.locator(':scope > button').first()).toHaveAttribute(
        'data-action-priority',
        'frequent',
      )

      const boxes = await Promise.all(
        [locator, search, filters, create, firstRow].map((element) =>
          element.boundingBox(),
        ),
      )
      const [locatorBox, searchBox, filtersBox, createBox, firstRowBox] = boxes
      const refreshBox = width === 768 ? null : await refresh.boundingBox()

      for (const box of boxes) expect(box).not.toBeNull()
      expect(searchBox!.height).toBeGreaterThanOrEqual(44)
      expect(filtersBox!.height).toBeGreaterThanOrEqual(44)
      expect(filtersBox!.width).toBeGreaterThanOrEqual(44)
      expect(createBox!.height).toBeGreaterThanOrEqual(44)
      expect(createBox!.width).toBeGreaterThanOrEqual(44)
      if (refreshBox) {
        expect(refreshBox.height).toBeGreaterThanOrEqual(44)
        expect(refreshBox.width).toBeGreaterThanOrEqual(44)
        expect(refreshBox.x).toBeLessThanOrEqual(createBox!.x)
      }
      if (width < 768) {
        expect(refreshBox!.width).toBeLessThanOrEqual(48)
        expect(createBox!.width).toBeLessThanOrEqual(48)
      } else if (width === 768) {
        expect(createBox!.width).toBeLessThanOrEqual(48)
      } else {
        expect(refreshBox!.width).toBeGreaterThan(88)
        expect(createBox!.width).toBeGreaterThan(88)
      }
      for (const box of [searchBox, filtersBox, createBox, refreshBox].filter(Boolean)) {
        expect(box!.x).toBeGreaterThanOrEqual(locatorBox!.x - 1)
        expect(box!.x + box!.width).toBeLessThanOrEqual(
          locatorBox!.x + locatorBox!.width + 1,
        )
      }

      const locatorBottom = locatorBox!.y + locatorBox!.height
      const firstRowGap = firstRowBox!.y - locatorBottom
      expect(firstRowGap).toBeGreaterThanOrEqual(8)

      const headerBox = await page.locator('.app-shell__header').boundingBox()
      expect(locatorBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1)
      expect(await locator.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
      await expectNoHorizontalScroll(page)

      await search.focus()
      await expect(search).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(filters).toBeFocused()

      if (width < MOBILE_MENU_BREAKPOINT) {
        await firstRow.scrollIntoViewIfNeeded()
        const rowAfterScroll = await firstRow.boundingBox()
        const bottomNavigation = await page
          .locator(MOBILE_BOTTOM_NAVIGATION_SELECTOR)
          .boundingBox()
        expect(rowAfterScroll!.y + rowAfterScroll!.height).toBeLessThanOrEqual(
          bottomNavigation!.y + 1,
        )
      }
    })
  })
}

const SETTINGS_BRANCH_VIEWPORTS = [
  { label: 'narrow-360', width: 360, height: 780 },
  { label: 'baseline-390', width: 390, height: 844 },
  { label: 'iphone-air-420', width: 420, height: 912 },
  { label: 'iphone-pro-max-440', width: 440, height: 956 },
  { label: 'compact-air-912', width: 912, height: 420 },
  { label: 'compact-pro-max-956', width: 956, height: 440 },
  { label: 'tablet-768', width: 768, height: 1024 },
  { label: 'desktop-1440', width: 1440, height: 1200 },
] as const

for (const viewport of SETTINGS_BRANCH_VIEWPORTS) {
  test.describe(`Settings branches ${viewport.label}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('keeps primary operations and first branch row visible without metric summary cards', async ({
      page,
    }) => {
      await mockApi(page, HEAD_COACH_ADMIN_SESSION)
      await page.goto('/settings')

      const tabs = page.getByRole('tab', { name: 'Филиалы и залы' })
      await tabs.click()

      const main = page.locator('main')
      const panel = page.locator('[data-testid="settings-screen"]')
      const panelTab = panel.getByRole('tabpanel', { name: 'Филиалы и залы' })
      const duplicateHeading = panelTab.getByRole('heading', { name: 'Филиалы и залы' })
      const create = main.getByRole('button', { name: 'Добавить филиал' })
      const refresh = main.getByRole('button', { name: 'Обновить' })
      const firstRow = main.locator('.settings-branch-row').first()

      await expect(panelTab).toBeVisible()
      await expect(duplicateHeading).toHaveCount(0)
      await expect(panel.locator('.metric-card')).toHaveCount(0)
      await expect(create).toBeVisible()
      await expect(refresh).toBeVisible()
      await expect(firstRow).toBeVisible()
      const boxes = await Promise.all([create.boundingBox(), refresh.boundingBox(), firstRow.boundingBox()])
      const [createBox, refreshBox, firstRowBox] = boxes
      expect(createBox).not.toBeNull()
      expect(refreshBox).not.toBeNull()
      expect(firstRowBox).not.toBeNull()
      expect(createBox!.height).toBeGreaterThanOrEqual(44)
      expect(refreshBox!.height).toBeGreaterThanOrEqual(44)
      expect(firstRowBox!.x).toBeGreaterThanOrEqual(0)
      await expectNoHorizontalScroll(page)

      if (viewport.width < 768) {
        await firstRow.scrollIntoViewIfNeeded()
        const rowAfterScroll = await firstRow.boundingBox()
        const bottomNavigation = await page
          .locator(MOBILE_BOTTOM_NAVIGATION_SELECTOR)
          .boundingBox()
        expect(bottomNavigation).not.toBeNull()
        expect(rowAfterScroll).not.toBeNull()
        expect(rowAfterScroll!.y + rowAfterScroll!.height).toBeLessThanOrEqual(
          bottomNavigation!.y + 1,
        )
      }
    })
  })
}

test.describe('Mobile filter drawer actions', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('clients, audit and finance filters expose a reachable apply action', async ({
    page,
  }) => {
    await mockApi(page, MANAGEMENT_SESSION)

    const filterScreens = [
      {
        path: '/clients',
        panelTestId: 'clients-filter-panel',
        actionsSelector: '.temporary-surface-footer',
      },
      {
        path: '/audit',
        panelTestId: 'audit-filter-panel',
        actionsSelector: '.compact-filter-panel__sheet-actions',
      },
      {
        path: '/finance',
        panelTestId: 'finance-filter-panel',
        actionsSelector: '.compact-filter-panel__sheet-actions',
      },
    ] as const

    for (const screen of filterScreens) {
      await page.goto(screen.path)

      const panel = page.getByTestId(screen.panelTestId)

      await expect(panel).toBeVisible()
      await panel.getByRole('button', { name: /фильтры/i }).click()

      const applyButton = page.getByRole('button', { name: 'Готово' })
      const actions = page.locator(screen.actionsSelector)

      await expect(actions).toBeVisible()
      await expect(applyButton).toBeVisible()

      await expect
        .poll(async () => {
          const actionsBox = await actions.boundingBox()

          return actionsBox
            ? actionsBox.y + actionsBox.height
            : Number.POSITIVE_INFINITY
        })
        .toBeLessThanOrEqual(844)

      await applyButton.click()
      await expect(applyButton).toHaveCount(0)
    }
  })
})

test.describe('Mobile bottom navigation interactions', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('navigates direct and overflow sections without fake notifications', async ({
    page,
  }) => {
    await mockApi(page, MANAGEMENT_SESSION)
    await page.goto('/attention')

    const bottomNavigation = page.locator(MOBILE_BOTTOM_NAVIGATION_SELECTOR)

    await expect(bottomNavigation).toBeVisible()
    await bottomNavigation.getByRole('button', { name: 'Расписание' }).click()
    await expect(page).toHaveURL(/\/schedule$/)
    await expect(
      bottomNavigation.getByRole('button', { name: 'Расписание' }),
    ).toHaveAttribute('aria-current', 'page')

    await bottomNavigation
      .getByRole('button', { name: 'Ещё, открыть остальные разделы' })
      .click()

    const overflowList = page.locator('.mobile-bottom-nav__overflow-list')

    await expect(overflowList).toBeVisible()
    await expect(
      overflowList.getByRole('button', { name: 'Уведомления' }),
    ).toHaveCount(0)
    await overflowList.getByRole('button', { name: 'Финансы' }).click()
    await expect(page).toHaveURL(/\/finance$/)
    await expect(
      bottomNavigation.getByRole('button', { name: 'Финансы' }),
    ).toHaveAttribute('aria-current', 'page')
    await expect(
      bottomNavigation.getByRole('button', { name: 'Ещё, открыть остальные разделы' }),
    ).not.toHaveAttribute('aria-current')
    await expect(overflowList).toBeHidden()
  })
})

test.describe('TASK-089 clients desktop preview split', () => {
  test.use({ viewport: { width: 1440, height: 1200 } })

  test('keeps four decision columns readable with preview open and no row action', async ({
    page,
  }) => {
    await mockApi(page, MANAGEMENT_SESSION)
    await page.goto('/clients')

    const list = page.getByTestId('clients-list')
    const preview = page.getByTestId('client-preview-panel')
    const firstRow = page.getByTestId('client-card-client-1')
    const header = list.locator('.clients-v7-table-header')

    await expect(list).toBeVisible()
    await expect(preview).toBeVisible()
    await expect(header.getByText('Клиент')).toBeVisible()
    await expect(header.getByText('Филиал')).toBeVisible()
    await expect(header.getByText('Абонемент')).toBeVisible()
    await expect(header.getByText('Следующее действие')).toBeVisible()
    await expect(header.getByText('Статус и абонемент')).toHaveCount(0)
    await expect(header.getByText('Визит')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Открыть$/ })).toHaveCount(0)
    await expect(preview.getByRole('button', { name: 'Открыть карточку' })).toBeVisible()

    const listGeometry = await list.evaluate((element) => {
      const rows = Array.from(
        element.querySelectorAll<HTMLElement>('.clients-v7-table-header, .clients-v7-row'),
      )

      return rows.map((row) => ({
        clientWidth: row.clientWidth,
        scrollWidth: row.scrollWidth,
      }))
    })

    for (const row of listGeometry) {
      expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth + 1)
    }

    await page.getByRole('button', { name: 'Свернуть preview' }).click()
    await expect(preview).toHaveCount(0)
    await expect(firstRow).toBeFocused()

    await firstRow.click()
    await expect(preview).toBeVisible()

    await firstRow.dblclick()
    await expect(page).toHaveURL(/\/clients\/client-1$/)
  })
})

test.describe('TASK-089 clients tablet fallback', () => {
  test.use({ viewport: { width: 768, height: 1024 } })

  test('uses the route-based preview instead of a split pane', async ({ page }) => {
    await mockApi(page, MANAGEMENT_SESSION)
    await page.goto('/clients')

    await expect(page.getByTestId('client-preview-panel')).toHaveCount(0)
    await page.getByTestId('client-card-client-1').click()
    await expect(page).toHaveURL(/\/clients\/client-1\/preview$/)
    await expect(page.getByTestId('client-preview-panel')).toBeVisible()
  })
})

test.describe('TASK-089 clients split capability boundary', () => {
  test.use({ viewport: { width: 1700, height: 1200 } })

  test('toggles between split and route fallback exactly on threshold inline-size', async ({
    page,
  }) => {
    await mockApi(page, MANAGEMENT_SESSION)
    await page.goto('/clients')

    const layout = page.locator('#clients-results')
    const row = page.getByTestId('client-card-client-1')
    const preview = page.getByTestId('client-preview-panel')

    await setClientListLayoutInlineSize(page, 1072)
    await expect(layout).toHaveAttribute('data-client-preview-layout', 'expanded')
    await expect(preview).toBeVisible()

    await setClientListLayoutInlineSize(page, 1071)
    await expect.poll(async () => layout.getAttribute('data-client-preview-layout')).toBe(
      'fallback',
    )
    await expect(preview).toHaveCount(0)

    await row.click()
    await expect(page).toHaveURL(/\/clients\/client-1\/preview$/)

    await page.goBack()
    await expect(page).toHaveURL('/clients')
    await setClientListLayoutInlineSize(page, 1071)
    await expect(layout).toHaveAttribute('data-client-preview-layout', 'fallback')

    await setClientListLayoutInlineSize(page, 1072)
    await expect.poll(async () => layout.getAttribute('data-client-preview-layout')).toBe(
      'expanded',
    )
    await expect(preview).toBeVisible()
    await expect(page).toHaveURL('/clients')
  })
})

test.describe('TASK-089 clients 200%-zoom equivalent', () => {
  test.use({ viewport: { width: 1440, height: 1200 } })

  test('falls back to route preview and keeps page/list overflow constrained when effective width is halved', async ({
    page,
  }) => {
    await mockApi(page, MANAGEMENT_SESSION)
    await page.goto('/clients')

    const layout = page.locator('#clients-results')
    const preview = page.getByTestId('client-preview-panel')
    const row = page.getByTestId('client-card-client-1')

    await expect(layout).toHaveAttribute('data-client-preview-layout', 'expanded')
    await expect(preview).toBeVisible()

    // Browser zoom is represented by its effective CSS viewport: 1440 / 200% = 720.
    await page.setViewportSize({ width: 720, height: 600 })
    await expect.poll(async () => layout.getAttribute('data-client-preview-layout')).toBe(
      'fallback',
    )
    await expect(preview).toHaveCount(0)
    await expectNoHorizontalScroll(page)

    await row.click()
    await expect(page).toHaveURL(/\/clients\/client-1\/preview$/)
    await expectNoHorizontalScroll(page)

    await page.goBack()
    await page.setViewportSize({ width: 1440, height: 1200 })
    await expect.poll(async () => layout.getAttribute('data-client-preview-layout')).toBe(
      'expanded',
    )
    await expect(preview).toBeVisible()
    await expectNoHorizontalScroll(page)
  })
})

test.describe('TASK-089 clients split state flow', () => {
  test.use({ viewport: { width: 1700, height: 1200 } })

  test('preserves search, collapsed intent, reopen intent and detail/back state with return snapshot', async ({
    page,
  }) => {
    await mockApi(page, MANAGEMENT_SESSION)

    await page.route(/\/api\/clients(?:\?.*)?$/, async (route) => {
      const requestUrl = new URL(route.request().url())
      const { pathname } = requestUrl
      const method = route.request().method()

      if (pathname !== '/api/clients' || method !== 'GET') {
        await route.continue()
        return
      }

      const params = requestUrl.searchParams
      const query = (params.get('query') ?? '').trim().toLowerCase()
      const status = params.get('status') ?? 'all'
      const page = Number.parseInt(params.get('page') ?? '1', 10) || 1
      const pageSize = Number.parseInt(params.get('pageSize') ?? '20', 10) || 20

      const longClients = Array.from({ length: 36 }, (_, index) => {
        const isArchived = index % 3 === 0
        const suffix = String(index + 1).padStart(2, '0')

        return {
          ...CLIENTS_RESPONSE.items[0],
          id: `client-${suffix}`,
          fullName: `Клиент ${suffix} Александр`,
          phone: `+7 999 22${suffix}`,
          status: isArchived ? 'Archived' : 'Active',
        }
      })

      const filteredByStatus = longClients.filter((client) => {
        if (status === 'all' || status === 'Active') {
          return client.status === status || status === 'all'
        }

        return client.status === status
      })
      const filtered = query.length === 0
        ? filteredByStatus
        : filteredByStatus.filter((client) => client.fullName.toLowerCase().includes(query))
      const skip = (page - 1) * pageSize
      const items = filtered.slice(skip, skip + pageSize)

      await fulfillJson(route, 200, {
        items,
        totalCount: filtered.length,
        activeCount: filtered.length,
        archivedCount: filtered.filter((client) => client.status === 'Archived').length,
        skip,
        take: pageSize,
        page,
        pageSize,
        hasNextPage: skip + pageSize < filtered.length,
        quickFilterCounts: {
          withoutMembership: 0,
          expiringSoon: 0,
          withoutGroup: 0,
          trial: 0,
        },
      })
    })

    await page.route('**/api/clients/client-*', async (route) => {
      const requestUrl = new URL(route.request().url())
      const clientId = requestUrl.pathname.slice('/api/clients/'.length)
      const method = route.request().method()

      if (method !== 'GET') {
        await route.fallback()
        return
      }

      const normalized = clientId.trim().toLowerCase()
      if (!normalized.startsWith('client-')) {
        await route.fallback()
        return
      }

      const details = {
        ...CLIENTS_RESPONSE.items[0],
        id: normalized,
        fullName: `Клиент ${normalized.slice('client-'.length)} Александр`,
      }

      await fulfillJson(route, 200, details)
    })

    await page.goto('/clients')

    const layout = page.locator('#clients-results')
    const preview = page.getByTestId('client-preview-panel')
    const search = page.getByRole('textbox', { name: 'Поиск по имени или телефону' })

    await expect(preview).toBeVisible()
    await expect(layout).toHaveAttribute('data-client-preview-layout', 'expanded')

    await search.fill('Клиент')
    await search.blur()
    await expect.poll(async () => {
      const returnState = await readClientListReturnState(page)

      return returnState?.searchDraft
    }).toBe('Клиент')

    await page.getByRole('button', { name: /Открыть фильтры/ }).click()
    const filtersDialog = page.getByRole('dialog', { name: 'Фильтры клиентов' })
    await filtersDialog.getByRole('combobox', { name: 'Статус' }).click()
    await page.getByRole('option', { name: 'Архив' }).click()
    await filtersDialog.getByRole('button', { name: 'Готово' }).click()
    await expect(page.getByText('Статус: Архив').first()).toBeVisible()

    const selectedRow = page.getByTestId('client-card-client-01')
    await expect(selectedRow).toBeVisible()
    await page.getByRole('button', { name: 'Свернуть preview' }).click()
    await expect(preview).toHaveCount(0)
    await expect(selectedRow).toBeFocused()

    await expect
      .poll(async () => {
        const returnState = await readClientListReturnState(page)

        return returnState?.ui?.previewIntent
      })
      .toBe('collapsed')

    const targetRow = page.getByTestId('client-card-client-34')
    await targetRow.scrollIntoViewIfNeeded()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
    await targetRow.press('Space')
    await expect(preview).toBeVisible()
    await expect
      .poll(async () => {
        const returnState = await readClientListReturnState(page)

        return returnState?.ui?.previewIntent
      })
      .toBe('expanded')
    await expect(layout).toHaveAttribute('data-client-preview-layout', 'expanded')

    const listScrollY = await page.evaluate(() => window.scrollY)
    await targetRow.dblclick()
    await expect(page).toHaveURL(/\/clients\/client-34$/)

    await page.getByRole('button', { name: 'К списку клиентов' }).click()
    await expect(page).toHaveURL('/clients')
    await expect(page.locator('#clients-results')).toBeVisible()
    await expect(targetRow).toBeVisible()
    await expect(page.getByText('Статус: Архив').first()).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThanOrEqual(
      Math.max(1, listScrollY - 2),
    )

    await expect
      .poll(async () => {
        const returnState = await readClientListReturnState(page)

        return returnState?.selectedClientId
      })
      .toBe('client-34')
    await expect
      .poll(async () => {
        const returnState = await readClientListReturnState(page)

        return returnState?.searchDraft
      })
      .toBe('Клиент')
  })
})

async function setClientListLayoutInlineSize(page: Page, inlineSizePx: number) {
  const layout = page.locator('#clients-results')

  await layout.evaluate((element, width) => {
    const root = element as HTMLElement

    root.style.width = `${width}px`
    root.style.maxWidth = `${width}px`
    root.style.minWidth = `${width}px`
  }, inlineSizePx)

  await expect.poll(async () =>
    Math.round(
      (await layout.evaluate((element) => element.getBoundingClientRect().width)) || 0,
    ),
  ).toBe(inlineSizePx)
}

async function readClientListReturnState(page: Page) {
  return page.evaluate(() => {
    return window.history.state?.crmClientListReturnState ?? null
  })
}

async function captureAlternateThemeSnapshots(page: Page) {
  const snapshots = []

  for (const representative of ALTERNATE_THEME_CASES) {
    await page.goto(representative.path)

    const screen = page.getByTestId(representative.screenTestId)
    await expect(screen).toBeVisible()

    let snapshotRoot = screen
    const setup = 'setup' in representative ? representative.setup : undefined

    if (setup === 'schedule-filters') {
      await page
        .getByTestId('schedule-filter-panel')
        .getByRole('button', { name: 'Фильтры' })
        .click()
      snapshotRoot = page.getByRole('dialog', { name: 'Фильтры' })
      await expect(snapshotRoot).toBeVisible()
    }

    if (setup === 'client-preview') {
      await page
        .getByRole('button', {
          name: /Открыть клиента Александра Константинопольская-Северная/,
        })
        .click()
      snapshotRoot = page.getByTestId('client-preview-panel')
      await expect(snapshotRoot).toBeVisible()
    }

    if (setup === 'settings-group-types') {
      await page.getByRole('tab', { name: 'Типы групп' }).click()
      await expect(page.getByRole('tab', { name: 'Типы групп' })).toHaveAttribute(
        'aria-selected',
        'true',
      )
    }

    const snapshot = await snapshotRoot.evaluate((root, id) => {
      function isVisible(element: HTMLElement) {
        const style = window.getComputedStyle(element)
        const rect = element.getBoundingClientRect()

        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0
        )
      }

      function accessibleName(element: HTMLElement) {
        const labelledBy = element.getAttribute('aria-labelledby')
        const labelledText = labelledBy
          ?.split(/\s+/)
          .map((labelId) => document.getElementById(labelId)?.textContent?.trim() ?? '')
          .filter(Boolean)
          .join(' ')

        return (
          element.getAttribute('aria-label') ??
          labelledText ??
          element.textContent?.replace(/\s+/g, ' ').trim() ??
          element.getAttribute('placeholder') ??
          element.getAttribute('title') ??
          ''
        )
      }

      function semanticRole(element: HTMLElement) {
        return (
          element.getAttribute('role') ??
          (element instanceof HTMLButtonElement
            ? 'button'
            : element instanceof HTMLInputElement
              ? element.type || 'input'
              : element.tagName.toLowerCase())
        )
      }

      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(isVisible)
      const operations = focusable.map((element) => ({
        name: accessibleName(element),
        role: semanticRole(element),
      }))
      const statusSemantics = Array.from(
        root.querySelectorAll<HTMLElement>(
          '[role="status"], [role="alert"], [aria-current], [aria-selected], [aria-pressed], [data-tone]',
        ),
      )
        .filter(isVisible)
        .map((element) => ({
          ariaCurrent: element.getAttribute('aria-current'),
          ariaPressed: element.getAttribute('aria-pressed'),
          ariaSelected: element.getAttribute('aria-selected'),
          name: accessibleName(element),
          role: semanticRole(element),
          tone: element.getAttribute('data-tone'),
        }))
      const measuredElements = [root, ...focusable.slice(0, 12)]
      const boxes = measuredElements.map((element, index) => {
        const rect = element.getBoundingClientRect()

        return {
          height: rect.height,
          key:
            index === 0
              ? 'root'
              : `${semanticRole(element)}:${accessibleName(element)}`,
          width: rect.width,
          x: rect.x,
          y: rect.y,
        }
      })

      return {
        boxes,
        id,
        operations,
        statusSemantics,
      }
    }, representative.id)

    snapshots.push(snapshot)
  }

  return snapshots
}

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

    throw new Error(`Current authorized route "${navLabel}" was not promoted into mobile navigation`)
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
  await expect(page.locator('.app-shell__brand-meta')).toHaveCount(0)
  await expect(page.getByText(/стартовый раздел:/i)).toHaveCount(0)
  await expect(page.getByText('Главный тренер и администратор')).toHaveCount(0)
  await expect(page.getByText('Только для главного тренера')).toHaveCount(0)
  await expect(page.getByText('Любая доступная группа')).toHaveCount(0)
  await expect(page.getByText(/Показано\s+\d+\s+из\s+\d+/)).toHaveCount(0)
  await expect(page.getByText(/Фильтры:\s+\d+/)).toHaveCount(0)
}

async function expectRoutePageTitle(page: Page, title: string | null, hidden = false) {
  const main = page.locator('main')

  if (title === null) {
    await expect(main.getByRole('heading', { level: 1 })).toHaveCount(0)
    return
  }
  const heading = main.getByRole('heading', { level: 1, name: title })

  if (hidden) {
    await expect(heading).toBeAttached()
    await expect(heading).toHaveClass(/visually-hidden/)
    const hiddenBox = await heading.boundingBox()
    expect(hiddenBox?.width ?? 0).toBeLessThanOrEqual(1)
    expect(hiddenBox?.height ?? 0).toBeLessThanOrEqual(1)
  } else {
    await expect(heading).toBeVisible()
  }
  await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1)

  if (hidden) return

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
  expectedHiddenControls: readonly string[] = [],
) {
  for (const controlName of expectedControls) {
    const control = page.getByRole('button', { name: controlName }).first()

    if (expectedHiddenControls.includes(controlName)) {
      await expect(control).toBeHidden()
    } else {
      await expect(control).toBeVisible()
    }
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

async function expectClientsSharedLayoutContract(
  page: Page,
  expectsCreateAction: boolean,
) {
  const clientsLayout = page.locator('main [data-testid="clients-screen"].page-layout')
  const locatorBar = clientsLayout.locator('.entity-locator-bar')
  const searchbox = locatorBar.getByRole('textbox', {
    name: /Поиск по имени/,
  })
  const filterButton = locatorBar.getByRole('button', { name: /фильтры/i })
  const refreshAction = locatorBar.locator(
    'button.task-toolbar-action--refresh[aria-label="Обновить список"]',
  )
  const taskActions = locatorBar.locator('.task-toolbar-actions')

  await expect(clientsLayout).toHaveCount(1)
  await expect(locatorBar).toBeVisible()
  await expect(searchbox).toBeVisible()
  await expect(searchbox).toHaveAttribute('aria-controls')
  await expect(filterButton).toHaveAttribute('aria-haspopup', 'dialog')
  await expect(refreshAction).toHaveCount(1)
  await expect(refreshAction).toBeVisible()
  await expect(taskActions.locator(':scope > button').first()).toHaveAttribute(
    'data-action-priority',
    'frequent',
  )
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

  const locatorControls = [searchbox, filterButton, refreshAction]
  const createAction = locatorBar.getByRole('button', { name: 'Новый клиент' })

  if (expectsCreateAction) {
    await expect(createAction).toBeVisible()
    await expect(createAction).toHaveClass(/task-toolbar-action--primary/)
    locatorControls.push(createAction)
  } else {
    await expect(createAction).toHaveCount(0)
  }

  const locatorBoxes = await Promise.all(
    locatorControls.map((control) => control.boundingBox()),
  )
  for (const box of locatorBoxes) expect(box).not.toBeNull()
  const centers = locatorBoxes.map((box) => box!.y + box!.height / 2)
  expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(3)

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

async function expectAuditListContract(page: Page) {
  const grid = page.getByTestId('audit-log-grid')
  const row = grid.locator('.audit-log-row').first()
  const rows = grid.locator('.audit-log-row')
  const details = row.getByTestId('audit-log-details-action')
  const descriptionCell = row.getByRole('cell').nth(1)
  const context = row.locator('.audit-log-context')
  const viewport = page.viewportSize()

  await expect(
    grid.getByRole('columnheader', { includeHidden: true }),
  ).toHaveCount(4)
  await expect(row.getByRole('cell')).toHaveCount(4)
  await expect(
    grid.getByRole('columnheader', { includeHidden: true, name: 'Действие' }),
  ).toHaveCount(0)
  await expect(row).toContainText('Создан новый клиент')
  await expect(row).toContainText('Создание клиента')
  await expect(row).toContainText('Клиент')
  await expect(row).toContainText('client-1')
  await expect(row).toContainText('Главный тренер')
  await expect(row).toContainText('headcoach')
  await expect(context).toHaveAttribute('aria-hidden', 'true')
  await expect(descriptionCell).toHaveAttribute(
    'aria-label',
    /Описание: Создан новый клиент.*Действие: Создание клиента.*Объект: Клиент.*ID объекта: client-1/,
  )
  await expect(row.locator('.audit-log-cell__label:visible')).toHaveCount(0)
  await expect(details).toHaveAttribute('aria-haspopup', 'dialog')
  await expect(details).toHaveAccessibleName(
    'Показать подробности записи: Создан новый клиент',
  )

  const geometry = await row.evaluate((element) => {
    const style = getComputedStyle(element)
    const description = element.querySelector<HTMLElement>('.audit-log-description')
    const detailsAction = element.querySelector<HTMLElement>(
      '[data-testid="audit-log-details-action"]',
    )
    const detailsRect = detailsAction?.getBoundingClientRect()

    return {
      columns: style.gridTemplateColumns.split(/\s+/).filter(Boolean).length,
      areas: style.gridTemplateAreas,
      descriptionClamp: description
        ? getComputedStyle(description).webkitLineClamp
        : '',
      rowHeight: element.getBoundingClientRect().height,
      detailsWidth: detailsRect?.width ?? 0,
      detailsHeight: detailsRect?.height ?? 0,
    }
  })

  expect(geometry.columns).toBe((viewport?.width ?? 0) >= 1200 ? 4 : 2)
  expect(geometry.areas).not.toContain('action')
  expect(geometry.areas).not.toContain('source')
  if ((viewport?.width ?? 0) < 1200) {
    expect(geometry.areas.replaceAll('"', '').trim()).toBe(
      'time details description details context context actor actor',
    )
  }
  expect(geometry.descriptionClamp).toBe('2')
  expect(geometry.detailsWidth).toBeGreaterThanOrEqual(44)
  expect(geometry.detailsHeight).toBeGreaterThanOrEqual(44)
  if ((viewport?.width ?? 0) <= 440 && (viewport?.height ?? 0) >= 780) {
    expect(geometry.rowHeight).toBeLessThanOrEqual(128)
  }

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

  const paginationGeometry = await pagination.evaluate((element) => {
    const rootRect = element.getBoundingClientRect()
    const controls = Array.from(
      element.querySelectorAll<HTMLElement>('button:not([hidden])'),
    )
      .map((control) => control.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .sort((left, right) => left.left - right.left)

    return {
      rootLeft: rootRect.left,
      rootRight: rootRect.right,
      minWidth: Math.min(...controls.map((rect) => rect.width)),
      minHeight: Math.min(...controls.map((rect) => rect.height)),
      minGap:
        controls.length > 1
          ? Math.min(
              ...controls.slice(1).map((rect, index) => rect.left - controls[index].right),
            )
          : Number.POSITIVE_INFINITY,
      controlsLeft: Math.min(...controls.map((rect) => rect.left)),
      controlsRight: Math.max(...controls.map((rect) => rect.right)),
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }
  })
  expect(paginationGeometry.minWidth).toBeGreaterThanOrEqual(44)
  expect(paginationGeometry.minHeight).toBeGreaterThanOrEqual(44)
  expect(paginationGeometry.minGap).toBeGreaterThanOrEqual(8)
  expect(paginationGeometry.controlsLeft).toBeGreaterThanOrEqual(
    paginationGeometry.rootLeft - 1,
  )
  expect(paginationGeometry.controlsRight).toBeLessThanOrEqual(
    paginationGeometry.rootRight + 1,
  )
  expect(paginationGeometry.scrollWidth).toBeLessThanOrEqual(
    paginationGeometry.clientWidth + 1,
  )

  if ((viewport?.width ?? 0) <= 440) {
    await expect(
      pagination.getByRole('button', { name: /^Страница \d+ журнала$/ }),
    ).toHaveCount(0)
  } else {
    await expect(
      pagination.getByRole('button', { name: 'Страница 1 журнала' }),
    ).toHaveAttribute('aria-current', 'page')
  }

  if ((viewport?.width ?? 0) === 390 || (viewport?.width ?? 0) === 440) {
    const bottomNavigation = page.locator(MOBILE_BOTTOM_NAVIGATION_SELECTOR)
    const bottomBox = await bottomNavigation.boundingBox()
    const rowBoxes = await rows.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect()
        return { bottom: rect.bottom, top: rect.top }
      }),
    )
    const visibleRows = rowBoxes.filter(
      (rowBox) => rowBox.top >= 0 && rowBox.bottom <= (bottomBox?.y ?? 0) + 1,
    )
    expect(visibleRows.length).toBeGreaterThanOrEqual(viewport?.width === 440 ? 4 : 3)
  }

  await expect(details).toBeVisible()
  await expect(grid.getByText('Attendance import completed')).toBeVisible()
  await expect(grid.getByText('AttendanceImported')).toBeVisible()
  await expect(grid.getByText('ExternalAttendance')).toBeVisible()
}

async function expectScheduleOverflowContract(page: Page) {
  await expect(page.getByTestId('schedule-filter-panel')).toBeVisible()
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

async function captureFilterSurfaceConformance(page: Page) {
  const boxes: Record<string, { width: number; height: number }> = {}

  for (const surfaceCase of FILTER_SURFACE_CONFORMANCE_CASES) {
    await page.goto(surfaceCase.path)

    const surface = page.locator(surfaceCase.surfaceSelector).first()
    const focusTarget = surface.locator(surfaceCase.focusSelector).first()

    await expect(surface, surfaceCase.id).toBeVisible()
    await expect(surface, surfaceCase.id).toHaveClass(
      new RegExp(`\\b${surfaceCase.className}\\b`),
    )
    await expectSemanticSurfacePaint(surface, surfaceCase.id)

    await focusTarget.focus()
    await expect(focusTarget, `${surfaceCase.id} focus target`).toBeFocused()

    const box = await surface.boundingBox()
    expect(box, surfaceCase.id).not.toBeNull()
    boxes[surfaceCase.id] = {
      height: Math.round(box!.height),
      width: Math.round(box!.width),
    }
  }

  for (const surfaceCase of FILTER_CONTEXT_EXCEPTION_CASES) {
    await page.goto(surfaceCase.path)

    const surface = page.locator(surfaceCase.surfaceSelector).first()
    const focusTarget = surface.locator(surfaceCase.focusSelector).first()

    await expect(surface, surfaceCase.id).toBeVisible()
    await expect(surface, surfaceCase.id).toHaveClass(
      new RegExp(`\\b${surfaceCase.className}\\b`),
    )
    await expect(surface, surfaceCase.id).not.toHaveClass(
      new RegExp(`\\b${surfaceCase.forbiddenClassName}\\b`),
    )
    await expectSemanticSurfacePaint(surface, surfaceCase.id)

    await focusTarget.focus()
    await expect(focusTarget, `${surfaceCase.id} focus target`).toBeFocused()

    const box = await surface.boundingBox()
    expect(box, surfaceCase.id).not.toBeNull()
    boxes[surfaceCase.id] = {
      height: Math.round(box!.height),
      width: Math.round(box!.width),
    }
  }

  return boxes
}

async function expectSemanticSurfacePaint(surface: Locator, id: string) {
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

async function expectAttendance320Contract(page: Page) {
  const group = page.getByTestId('attendance-group-select')
  const date = page.getByTestId('attendance-date-input')
  const today = page.getByRole('button', { name: 'Сегодня' })
  for (const control of [group, date, today]) {
    const box = await control.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
  }

  const card = page.getByTestId('attendance-client-card-client-1')
  const radios = card.getByRole('radio')
  await expect(radios).toHaveCount(3)
  const boxes = await Promise.all([0, 1, 2].map((index) => radios.nth(index).boundingBox()))
  for (const box of boxes) expect(box?.height).toBeGreaterThanOrEqual(44)
  expect(boxes[0]!.width).toBeGreaterThan(boxes[1]!.width)
  expect(Math.abs(boxes[1]!.y - boxes[2]!.y)).toBeLessThanOrEqual(1)
  expect(boxes[0]!.y + boxes[0]!.height).toBeLessThanOrEqual(boxes[1]!.y + 1)
  for (const label of ['Не отмечено', 'Был', 'Не был']) {
    const option = card.getByRole('radio', { name: label, exact: true })
    const clipping = await option.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }))
    expect(clipping.scrollWidth).toBeLessThanOrEqual(clipping.clientWidth)
  }

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  const cardBox = await card.boundingBox()
  const navBox = await page.getByRole('navigation', { name: 'Мобильная навигация' }).boundingBox()
  expect(cardBox!.y + cardBox!.height).toBeLessThanOrEqual(navBox!.y + 1)
}

async function expectAttendanceToolbarGeometry(
  page: Page,
  viewport: AttendanceViewportConstraint,
) {
  const toolbar = page.getByTestId('attendance-toolbar')
  const group = page.getByTestId('attendance-group-select')
  const dateInput = page.getByTestId('attendance-date-input')
  const previous = page.getByRole('button', { name: 'Предыдущая дата' })
  const today = page.getByRole('button', { name: 'Сегодня' })
  const next = page.getByRole('button', { name: 'Следующая дата' })
  const refresh = page.getByRole('button', { name: 'Обновить список' })
  const progress = page.getByRole('progressbar')
  const rosterView = page.getByTestId('attendance-roster-view-control')
  const firstAction = page
    .getByTestId('attendance-client-card-client-1')
    .getByRole('radio', { name: 'Был', exact: true })
  const duplicateHeaders = page.getByRole('heading', {
    name: ATTENDANCE_GROUPS_RESPONSE.groups[0].name,
  })

  await expect(toolbar).toBeVisible()
  await expect(group).toBeVisible()
  await expect(dateInput).toBeVisible()
  await expect(previous).toBeVisible()
  await expect(today).toBeVisible()
  await expect(next).toBeVisible()
  await expect(refresh).toBeVisible()
  await expect(progress).toBeVisible()
  await expect(progress).toHaveAttribute('aria-valuenow', '122')
  await expect(progress).toHaveAttribute('aria-valuemax', '123')
  await expect(rosterView).toBeVisible()
  await expect(firstAction).toBeVisible()

  for (const control of [group, dateInput, previous, today, next, refresh]) {
    const box = await control.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.height).toBeGreaterThanOrEqual(44)
  }

  const dateInputValue = await dateInput.evaluate(
    (element) => (element as HTMLInputElement).value,
  )
  expect(dateInputValue).toBeTruthy()
  const dateInputWidth = await dateInput.evaluate((element) => ({
    clientWidth: (element as HTMLElement).clientWidth,
    scrollWidth: (element as HTMLElement).scrollWidth,
  }))
  expect(dateInputWidth.scrollWidth).toBeLessThanOrEqual(dateInputWidth.clientWidth)
  await expect(toolbar.getByTestId('attendance-group-select')).toBeVisible()
  await expect(toolbar.getByTestId('attendance-date-input')).toBeVisible()
  await expect(toolbar.getByRole('button', { name: 'Предыдущая дата' })).toBeVisible()
  await expect(toolbar.getByRole('button', { name: 'Сегодня' })).toBeVisible()
  await expect(toolbar.getByRole('button', { name: 'Следующая дата' })).toBeVisible()
  await expect(toolbar.getByRole('progressbar')).toBeVisible()
  await expect(toolbar.getByTestId('attendance-roster-view-control')).toBeVisible()
  await expect(toolbar.getByRole('button', { name: 'Обновить список' })).toBeVisible()

  if (viewport.dateClusterMinWidth) {
    const dateControl = page.locator('.attendance-date-control')
    const dateControlBox = await dateControl.boundingBox()
    expect(dateControlBox).not.toBeNull()
    expect(dateControlBox!.width).toBeGreaterThanOrEqual(viewport.dateClusterMinWidth)
  } else {
    const dateInputBox = await dateInput.boundingBox()
    expect(dateInputBox).not.toBeNull()
    expect(dateInputBox!.width).toBeGreaterThanOrEqual(
      viewport.dateInputMinWidth ?? 0,
    )
  }

  expect(await duplicateHeaders.count()).toBe(0)

  const firstActionBox = await firstAction.boundingBox()
  expect(firstActionBox).not.toBeNull()

  const bottomNavigation = page.getByRole('navigation', {
    name: 'Мобильная навигация',
  })
  if (await bottomNavigation.count() > 0) {
    const navigationBox = await bottomNavigation.boundingBox()
    expect(navigationBox).not.toBeNull()
    expect(firstActionBox!.y + firstActionBox!.height).toBeLessThanOrEqual(
      navigationBox!.y - 8,
    )
  }
}

async function mockApi(
  page: Page,
  session:
    | typeof MANAGEMENT_SESSION
    | typeof COACH_SESSION
    | typeof ADMIN_AUDIT_SESSION
    | typeof SUPER_ADMIN_AUDIT_SESSION,
  appConfig: AppConfigFixture = APP_CONFIG,
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
      await fulfillJson(route, 200, appConfig)
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

    if (
      /^\/api\/clients\/[^/]+\/messenger\/telegram$/.test(pathname) &&
      method === 'GET'
    ) {
      await fulfillJson(route, 200, {
        platform: 'Telegram',
        capabilities: {
          visible: false,
          canRead: false,
          canReply: false,
          canCreateLink: false,
          canShowQr: false,
        },
        connection: {
          status: 'NotConnected',
          linkedAt: null,
          telegramUsername: null,
          telegramDisplayName: null,
          pendingLinkExpiresAt: null,
        },
        unreadCount: 0,
        totalMessageCount: 0,
        latestMessageAt: null,
        latestMessage: null,
      })
      return
    }

    if (pathname === '/api/clients/expiring-memberships' && method === 'GET') {
      await fulfillJson(route, 200, {
        items: [
          {
            clientId: 'client-1',
            fullName: 'Александра Константинопольская-Северная',
            behaviorKind: 'Term',
            expirationDate: '2026-04-22',
            daysUntilExpiration: 3,
            state: 'ExpiringSoon',
          },
        ],
      })
      return
    }

    if (pathname === '/api/clients/attention' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
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

    if (pathname === '/api/groups/summary' && method === 'GET') {
      await fulfillJson(route, 200, GROUPS_SUMMARY_RESPONSE)
      return
    }

    if (pathname === '/api/groups/options/trainers' && method === 'GET') {
      await fulfillJson(route, 200, TRAINERS_RESPONSE)
      return
    }

    if (pathname === '/api/coaches' && method === 'GET') {
      await fulfillJson(route, 200, {
        items: USERS_RESPONSE,
        createRoleOptions: ['Coach'],
      })
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

    if (pathname === '/api/settings/membership-catalog' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
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
