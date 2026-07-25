import { expect, test, type Page } from '@playwright/test'

const APP_CONFIG = { clubName: 'Iron Club' } as const
const ADMINISTRATOR_ID = 'administrator-1'

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
    landingScreen: 'Settings',
    allowedSections: ['Home', 'Clients', 'Groups', 'Users', 'Audit', 'Settings'],
    permissions: {
      canManageUsers: true,
      canManageClients: true,
      canManageGroups: true,
      canManageSettings: true,
      canMarkAttendance: true,
      canViewAuditLog: true,
      canViewFinancialReports: false,
    },
    assignedGroupIds: [],
    attendanceScope: { kind: 'Global', groupIds: [] },
    branchId: null,
    createRoleOptions: ['Administrator'],
  },
} as const

const administrator = {
  id: ADMINISTRATOR_ID,
  fullName: 'Мария Администратор',
  login: 'maria',
  role: 'Administrator',
  mustChangePassword: false,
  isActive: true,
  messengerPlatform: null,
  messengerPlatformUserId: null,
  branchId: 'branch-1',
  branchName: 'Центр',
  attendanceGroupGrantCount: 1,
  allowedActions: ['Edit', 'ManageAttendanceScope'],
}

const initialScope = {
  administrator: {
    id: ADMINISTRATOR_ID,
    fullName: 'Мария Администратор',
    isActive: true,
  },
  branch: {
    id: 'branch-1',
    name: 'Центр',
    isArchived: false,
  },
  grantedGroupIds: ['group-1'],
  groups: [
    {
      id: 'group-1',
      name: 'Вечерняя',
      trainingStartTime: '19:00',
      durationMinutes: 60,
      weekdays: [1, 3],
      isActive: true,
      isGranted: true,
      canGrant: true,
      canRevoke: true,
      disabledReason: null,
    },
    {
      id: 'group-2',
      name: 'Утренняя',
      trainingStartTime: '09:00',
      durationMinutes: 45,
      weekdays: [2, 4],
      isActive: true,
      isGranted: false,
      canGrant: true,
      canRevoke: false,
      disabledReason: null,
    },
    {
      id: 'group-3',
      name: 'Архивная',
      isActive: false,
      isGranted: false,
      canGrant: false,
      canRevoke: false,
      disabledReason: 'group_inactive',
    },
  ],
  unavailableGrants: [],
}

for (const viewport of [
  { label: 'desktop', width: 1024, height: 768 },
  { label: 'mobile-320', width: 320, height: 568 },
  { label: 'mobile-390', width: 390, height: 844 },
]) {
  test(`Administrator attendance scope modal works at ${viewport.label}`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    const state = await mockSettingsApi(page)

    await page.goto('/settings')
    await page.getByRole('tab', { name: 'Администраторы' }).click()

    const card = page.getByTestId(`administrator-card-${ADMINISTRATOR_ID}`)
    await expect(card).toContainText('Посещения: 1 группа')
    await card.getByRole('button', { name: 'Группы посещений' }).click()

    const dialog = page.getByRole('dialog', { name: 'Группы посещений' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('Мария Администратор')
    await expect(dialog).toContainText('Филиал: Центр')
    await expect(dialog.getByText('Выбрано: 1')).toBeVisible()
    await expect(dialog.getByRole('checkbox', { name: /Вечерняя/ })).toBeChecked()
    await expect(dialog.getByRole('checkbox', { name: /Архивная/ })).toBeDisabled()

    await dialog.getByLabel('Поиск группы').fill('нет совпадений')
    await expect(dialog.getByText('По совпадению ничего не найдено')).toBeVisible()
    await dialog.getByLabel('Поиск группы').fill('')

    await dialog.getByRole('checkbox', { name: /Вечерняя/ }).click()
    await dialog.getByRole('checkbox', { name: /Утренняя/ }).click()
    await expect(dialog.getByText('К отзыву: 1')).toBeVisible()

    await dialog.getByRole('button', { name: 'Сохранить' }).click()
    await expect(dialog.getByText(/Будет отозван доступ к 1 группе/)).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Вернуться' })).toBeFocused()
    await dialog.getByRole('button', { name: 'Отозвать и сохранить' }).click()

    await expect.poll(() => state.putPayload).toEqual({
      expectedGroupIds: ['group-1'],
      groupIds: ['group-2'],
    })
    await expect(dialog).toBeHidden()
    await expect(card).toContainText('Посещения: 1 группа')

    const dimensions = await page.evaluate(() => ({
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }))
    expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
    expect(dimensions.documentScrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
  })
}

async function mockSettingsApi(page: Page) {
  const state: {
    putPayload: Record<string, unknown> | null
  } = {
    putPayload: null,
  }

  await page.route('**/api/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const pathname = requestUrl.pathname
    const method = route.request().method()

    if (!pathname.startsWith('/api/')) {
      await route.continue()
      return
    }

    if (pathname === '/api/auth/session' && method === 'GET') {
      await fulfillJson(route, 200, MANAGEMENT_SESSION)
      return
    }

    if (pathname === '/api/config' && method === 'GET') {
      await fulfillJson(route, 200, APP_CONFIG)
      return
    }

    if (pathname === '/api/settings/membership-catalog' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (pathname === '/api/group-types' && method === 'GET') {
      await fulfillJson(route, 200, [])
      return
    }

    if (pathname === '/api/branches' && method === 'GET') {
      await fulfillJson(route, 200, [
        { id: 'branch-1', name: 'Центр', isArchived: false },
      ])
      return
    }

    if (pathname === '/api/settings/administrators' && method === 'GET') {
      await fulfillJson(route, 200, {
        items: [administrator],
        createRoleOptions: ['Administrator'],
      })
      return
    }

    if (
      pathname === `/api/settings/administrators/${ADMINISTRATOR_ID}/attendance-groups` &&
      method === 'GET'
    ) {
      await fulfillJson(route, 200, initialScope)
      return
    }

    if (
      pathname === `/api/settings/administrators/${ADMINISTRATOR_ID}/attendance-groups` &&
      method === 'PUT'
    ) {
      expect(route.request().headers()['x-csrf-token']).toBe(MANAGEMENT_SESSION.csrfToken)
      state.putPayload = route.request().postDataJSON() as Record<string, unknown>
      await fulfillJson(route, 200, {
        ...initialScope,
        grantedGroupIds: ['group-2'],
        groups: [
          { ...initialScope.groups[0], isGranted: false },
          { ...initialScope.groups[1], isGranted: true },
          initialScope.groups[2],
        ],
      })
      return
    }

    throw new Error(`Unexpected API request in administrator scope e2e: ${method} ${pathname}`)
  })

  return state
}

async function fulfillJson(
  route: Parameters<Page['route']>[1] extends (route: infer T) => unknown
    ? T
    : never,
  status: number,
  payload: unknown,
) {
  await route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(payload),
  })
}
