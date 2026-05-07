import { expect, test, type Page } from '@playwright/test'

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
    allowedSections: ['Home', 'Attendance', 'Clients', 'Groups', 'Users', 'Audit'],
    permissions: {
      canManageUsers: true,
      canManageClients: true,
      canManageGroups: true,
      canMarkAttendance: true,
      canViewAuditLog: true,
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
    landingScreen: 'Attendance',
    allowedSections: ['Attendance', 'Clients'],
    permissions: {
      canManageUsers: false,
      canManageClients: false,
      canManageGroups: false,
      canMarkAttendance: true,
      canViewAuditLog: false,
    },
    assignedGroupIds: ['group-1'],
  },
} as const

const CLIENTS_RESPONSE = {
  items: [
    {
      id: 'client-1',
      fullName: 'Александра Константинопольская-Северная',
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
          isActive: true,
        },
        {
          id: 'group-2',
          name: 'Группа 9: субботний интенсив',
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
      trainingStartTime: '19:00',
      scheduleText: 'Вт, Чт',
      trainerCount: 2,
      trainerNames: ['Тренер группы', 'Старший тренер'],
      clientCount: 12,
      isActive: true,
    },
  ],
  totalCount: 1,
  hasNextPage: false,
} as const

const ATTENDANCE_GROUPS_RESPONSE = {
  items: [
    {
      id: 'group-1',
      name: 'Группа 7: вечерний поток с длинным названием',
      trainingStartTime: '19:00',
      scheduleText: 'Вт, Чт',
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
} as const

const AUDIT_ENTRIES_RESPONSE = {
  items: [
    {
      id: 'audit-1',
      actionType: 'ClientUpdated',
      entityType: 'Client',
      entityId: 'client-1',
      description: 'Обновлены данные клиента Александра Константинопольская-Северная',
      createdAt: '2026-04-18T10:00:00Z',
      oldValueJson: '{"phone":"+7 999 111-22-33"}',
      newValueJson: '{"phone":"+7 999 123-45-67"}',
      userId: 'headcoach-id',
      userLogin: 'headcoach',
      userFullName: 'Главный тренер',
    },
  ],
  page: 1,
  pageSize: 20,
  totalCount: 1,
} as const

const MANAGEMENT_ROUTES = [
  { path: '/', screenTestId: 'home-screen', navLabel: 'Главная' },
  { path: '/clients', screenTestId: 'clients-screen', navLabel: 'Клиенты' },
  { path: '/groups', screenTestId: 'groups-screen', navLabel: 'Группы' },
  { path: '/audit', screenTestId: 'audit-screen', navLabel: 'Журнал' },
] as const

const COACH_ROUTES = [
  { path: '/attendance', screenTestId: 'attendance-screen', navLabel: 'Посещения' },
  { path: '/clients', screenTestId: 'clients-screen', navLabel: 'Клиенты' },
] as const

const DESKTOP_NAVIGATION_BREAKPOINT = 1200
const DESKTOP_NAVIGATION_SELECTOR =
  'nav.app-shell__side-nav[aria-label="Основная навигация"]'
const MOBILE_NAVIGATION_SELECTOR =
  'nav.app-shell__mobile-nav[aria-label="Основная навигация"]'

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 1200 },
] as const

for (const viewport of VIEWPORTS) {
  test.describe(`Responsive smoke ${viewport.width}px`, () => {
    test.use({ viewport })

    test('management screens keep stable hooks and avoid page-level horizontal scroll', async ({
      page,
    }) => {
      await mockApi(page, MANAGEMENT_SESSION)

      for (const route of MANAGEMENT_ROUTES) {
        await page.goto(route.path)
        await expect(page.getByTestId(route.screenTestId)).toBeVisible()
        await expectActiveNavigation(page, viewport.width, route.navLabel)
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
        await expectActiveNavigation(page, viewport.width, route.navLabel)
        await expectNoHorizontalScroll(page)
      }
    })
  })
}

async function expectActiveNavigation(page: Page, width: number, navLabel: string) {
  const isDesktopLayout = width >= DESKTOP_NAVIGATION_BREAKPOINT
  const desktopNavigation = page.locator(DESKTOP_NAVIGATION_SELECTOR)
  const mobileNavigation = page.locator(MOBILE_NAVIGATION_SELECTOR)

  if (isDesktopLayout) {
    await expect(desktopNavigation).toBeVisible()
  } else {
    await expect(mobileNavigation).toBeVisible()
  }

  const activeNavigation = isDesktopLayout ? desktopNavigation : mobileNavigation

  await expect(activeNavigation.getByRole('button', { name: navLabel })).toHaveAttribute(
    'aria-current',
    'page',
  )
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

    if (pathname === '/api/groups' && method === 'GET') {
      await fulfillJson(route, 200, GROUPS_RESPONSE)
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
