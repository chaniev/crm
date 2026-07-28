import { expect, test, type Page } from '@playwright/test'

const APP_CONFIG = {
  clubName: 'Iron Club',
  themeId: 'default-green-v1',
  authBackgroundImageId: 'k4pro-login-v1',
} as const

const HEAD_COACH_SESSION = {
  isAuthenticated: true,
  csrfToken: 'headcoach-role-flow-csrf-token',
  bootstrapMode: false,
  user: {
    id: 'headcoach-role-flow',
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
    createRoleOptions: ['SuperAdministrator', 'Administrator'],
  },
} as const

const BRANCHES = [
  {
    id: 'branch-1',
    name: 'Центр',
    address: 'ул. Тренеров, 1',
    description: 'Базовый',
    isArchived: false,
    hallCount: 1,
    groupCount: 0,
    clientCount: 0,
  },
] as const


test('HeadCoach создаёт суперадминистратора с null branchId после смены роли в форме', async ({ page }) => {
  let createPayload: Record<string, unknown> | null = null
  let nextAdministratorId = 1

  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const requestUrl = new URL(route.request().url())
    const method = route.request().method()

    if (requestUrl.pathname === '/api/auth/session' && method === 'GET') {
      await fulfillJson(route, 200, HEAD_COACH_SESSION)
      return
    }

    if (requestUrl.pathname === '/api/config' && method === 'GET') {
      await fulfillJson(route, 200, APP_CONFIG)
      return
    }

    if (requestUrl.pathname === '/api/clients/expiring-memberships' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (requestUrl.pathname === '/api/clients/attention' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (requestUrl.pathname === '/api/attendance/groups' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (requestUrl.pathname === '/api/branches' && method === 'GET') {
      await fulfillJson(route, 200, BRANCHES)
      return
    }

    if (requestUrl.pathname === '/api/group-types' && method === 'GET') {
      await fulfillJson(route, 200, [])
      return
    }

    if (requestUrl.pathname === '/api/settings/membership-catalog' && method === 'GET') {
      await fulfillJson(route, 200, {
        items: [],
      })
      return
    }

    if (requestUrl.pathname === '/api/settings/administrators' && method === 'GET') {
      await fulfillJson(route, 200, {
        items: [],
        createRoleOptions: ['Administrator', 'SuperAdministrator'],
      })
      return
    }

    if (requestUrl.pathname === '/api/settings/administrators' && method === 'POST') {
      createPayload = route.request().postDataJSON()

      await fulfillJson(route, 200, {
        id: `administrator-${nextAdministratorId++}`,
        fullName: String(createPayload.fullName),
        login: String(createPayload.login),
        role: String(createPayload.role),
        mustChangePassword: Boolean(createPayload.mustChangePassword),
        isActive: Boolean(createPayload.isActive),
        branchId: createPayload.branchId,
        branchName: BRANCHES.find((branch) => branch.id === createPayload.branchId)?.name ?? null,
        messengerPlatform: createPayload.messengerPlatform ?? null,
        messengerPlatformUserId: createPayload.messengerPlatformUserId ?? null,
        allowedActions: ['Edit'],
        roleOptions: ['Administrator', 'SuperAdministrator'],
      })
      return
    }

    throw new Error(
      `Unexpected role-flow API request: ${method} ${requestUrl.pathname}`,
    )
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/settings')

  await expect(page.getByRole('tab', { name: 'Администраторы' })).toBeVisible()
  await page.getByRole('tab', { name: 'Администраторы' }).click()

  const createButton = page.getByRole('button', { name: 'Добавить администратора' }).first()
  await expect(createButton).toBeVisible()
  await createButton.click()

  const createDialog = page.getByRole('dialog', { name: 'Новый администратор' })
  await expect(createDialog).toBeVisible()
  await expect(createDialog.getByRole('combobox', { name: 'Роль' })).toBeVisible()
  await createDialog.getByRole('combobox', { name: 'Роль' }).click()
  await page.getByRole('option', { name: 'Суперадминистратор' }).click()

  await expect(createDialog.getByLabel('Филиал администратора')).toBeHidden()
  await createDialog.getByLabel('ФИО').fill('Новый Суперадмин')
  await createDialog.getByLabel('Логин').fill('superadmin-new')
  await createDialog.getByLabel('Стартовый пароль').fill('Password1!')
  await createDialog.getByRole('button', { name: 'Сохранить' }).click()

  await expect.poll(() => createPayload).toMatchObject({
    role: 'SuperAdministrator',
    branchId: null,
  })
})

test('HeadCoach получает стабильную проблему при попытке forbidden роли на административном endpoint', async ({ page }) => {
  let updatePayload: Record<string, unknown> | null = null

  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const requestUrl = new URL(route.request().url())
    const method = route.request().method()

    if (requestUrl.pathname === '/api/auth/session' && method === 'GET') {
      await fulfillJson(route, 200, HEAD_COACH_SESSION)
      return
    }

    if (requestUrl.pathname === '/api/config' && method === 'GET') {
      await fulfillJson(route, 200, APP_CONFIG)
      return
    }

    if (requestUrl.pathname === '/api/clients/expiring-memberships' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (requestUrl.pathname === '/api/clients/attention' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (requestUrl.pathname === '/api/attendance/groups' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (requestUrl.pathname === '/api/branches' && method === 'GET') {
      await fulfillJson(route, 200, BRANCHES)
      return
    }

    if (requestUrl.pathname === '/api/group-types' && method === 'GET') {
      await fulfillJson(route, 200, [])
      return
    }

    if (requestUrl.pathname === '/api/settings/membership-catalog' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (requestUrl.pathname === '/api/settings/administrators' && method === 'GET') {
      await fulfillJson(route, 200, {
        items: [
          {
            id: 'admin-1',
            fullName: 'Админ',
            login: 'admin',
            role: 'Administrator',
            mustChangePassword: false,
            isActive: true,
            branchId: 'branch-1',
            branchName: 'Центр',
            allowedActions: ['Edit'],
          },
        ],
        createRoleOptions: ['Administrator'],
      })
      return
    }

    if (requestUrl.pathname === '/api/settings/administrators/admin-1' && method === 'PUT') {
      updatePayload = route.request().postDataJSON()
      await fulfillJson(route, 403, {
        title: 'Недостаточно прав.',
        detail: 'role transition forbidden',
        errors: {},
        code: 'staff_role_transition_forbidden',
      })
      return
    }

    throw new Error(
      `Unexpected role-flow API request: ${method} ${requestUrl.pathname}`,
    )
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/settings')

  await page.getByRole('tab', { name: 'Администраторы' }).click()
  await expect(page.getByTestId('administrator-card-admin-1')).toBeVisible()

  await page.getByRole('button', { name: 'Редактировать' }).click()

  const editDialog = page.getByRole('dialog', { name: 'Редактирование администратора' })
  await expect(editDialog).toBeVisible()
  await editDialog.getByLabel('ФИО').fill('Админ Запрещенный')
  await editDialog.getByRole('button', { name: 'Сохранить' }).click({ force: true })

  await expect(editDialog.getByText('role transition forbidden')).toBeVisible()
  await expect.poll(() => updatePayload).toMatchObject({ fullName: 'Админ Запрещенный' })
})

test('форма администратора сохраняет геометрию, footer и focus contract на целевых размерах', async ({
  page,
}) => {
  await mockAdministratorGeometryApi(page)
  await page.setViewportSize({ width: 360, height: 780 })
  await page.goto('/settings')
  await page.getByRole('tab', { name: 'Администраторы' }).click()

  const targetViewports = [
    { width: 360, height: 780, fullScreen: true },
    { width: 390, height: 844, fullScreen: true },
    { width: 768, height: 1024, fullScreen: false },
    { width: 1440, height: 1200, fullScreen: false },
    { width: 912, height: 420, fullScreen: false },
    { width: 956, height: 440, fullScreen: false },
  ]

  for (const viewport of targetViewports) {
    await page.setViewportSize(viewport)
    const createButton = page.getByRole('button', { name: 'Добавить администратора' }).first()
    await createButton.click()

    const dialog = page.getByRole('dialog', { name: 'Новый администратор' })
    const fullName = dialog.getByLabel('ФИО')
    const footer = dialog.locator('.temporary-surface-footer')
    const cancel = footer.getByRole('button', { name: 'Отменить' })
    const save = footer.getByRole('button', { name: 'Сохранить' })

    await expect(dialog).toBeVisible()
    await expect(fullName).toBeFocused()
    await expect(save).toBeInViewport()

    const contentBox = await page.locator('.administrator-form-modal__content').boundingBox()
    expect(contentBox).not.toBeNull()

    if (viewport.fullScreen) {
      expect(contentBox!.x).toBeLessThanOrEqual(1)
      expect(contentBox!.width).toBeGreaterThanOrEqual(viewport.width - 1)
    } else {
      expect(contentBox!.width).toBeLessThanOrEqual(642)
      expect(contentBox!.height).toBeLessThanOrEqual(viewport.height)
    }

    for (const control of [cancel, save]) {
      const controlBox = await control.boundingBox()
      expect(controlBox).not.toBeNull()
      expect(controlBox!.height).toBeGreaterThanOrEqual(44)
      expect(controlBox!.width).toBeGreaterThanOrEqual(44)
    }

    await dialog.getByLabel('Telegram ID').scrollIntoViewIfNeeded()
    await expect(save).toBeInViewport()
    await expectNoHorizontalScroll(page)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(createButton).toBeFocused()
  }
})

test('администрирование администраторов использует allowedActions для карточек действий на мобильном списке', async ({ page }) => {
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const requestUrl = new URL(route.request().url())
    const method = route.request().method()

    if (requestUrl.pathname === '/api/auth/session' && method === 'GET') {
      await fulfillJson(route, 200, HEAD_COACH_SESSION)
      return
    }

    if (requestUrl.pathname === '/api/config' && method === 'GET') {
      await fulfillJson(route, 200, APP_CONFIG)
      return
    }

    if (requestUrl.pathname === '/api/clients/expiring-memberships' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (requestUrl.pathname === '/api/clients/attention' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (requestUrl.pathname === '/api/attendance/groups' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (requestUrl.pathname === '/api/branches' && method === 'GET') {
      await fulfillJson(route, 200, BRANCHES)
      return
    }

    if (requestUrl.pathname === '/api/group-types' && method === 'GET') {
      await fulfillJson(route, 200, [])
      return
    }

    if (requestUrl.pathname === '/api/settings/membership-catalog' && method === 'GET') {
      await fulfillJson(route, 200, {
        items: [],
      })
      return
    }

    if (requestUrl.pathname === '/api/settings/administrators' && method === 'GET') {
      await fulfillJson(route, 200, {
        items: [
          {
            id: 'admin-actions',
            fullName: 'Суперадмин action',
            login: 'admin-actions',
            role: 'SuperAdministrator',
            mustChangePassword: false,
            isActive: true,
            branchId: null,
            branchName: null,
            allowedActions: ['ManageAttendanceScope'],
          },
          {
            id: 'admin-view-only',
            fullName: 'Только просмотр',
            login: 'admin-view-only',
            role: 'Administrator',
            mustChangePassword: false,
            isActive: true,
            branchId: 'branch-1',
            branchName: 'Центр',
            allowedActions: [],
          },
        ],
        createRoleOptions: ['Administrator'],
      })
      return
    }

    throw new Error(
      `Unexpected allowed-actions API request: ${method} ${requestUrl.pathname}`,
    )
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/settings')

  await page.getByRole('tab', { name: 'Администраторы' }).click()

  const managedCard = page.getByTestId('administrator-card-admin-actions')
  const viewOnlyCard = page.getByTestId('administrator-card-admin-view-only')

  await expect(managedCard).toBeVisible()
  await expect(viewOnlyCard).toBeVisible()

  await expect(managedCard.getByRole('button', { name: 'Группы посещений' })).toBeVisible()
  await expect(managedCard.getByRole('button', { name: 'Редактировать' })).toHaveCount(0)

  await expect(viewOnlyCard.getByText('Только просмотр', { exact: true }).first()).toBeVisible()
  await expect(viewOnlyCard.getByRole('button', { name: 'Группы посещений' })).toHaveCount(0)
  await expect(viewOnlyCard.getByRole('button', { name: 'Редактировать' })).toHaveCount(0)
})

async function mockAdministratorGeometryApi(page: Page) {
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const requestUrl = new URL(route.request().url())
    const method = route.request().method()

    if (requestUrl.pathname === '/api/auth/session' && method === 'GET') {
      await fulfillJson(route, 200, HEAD_COACH_SESSION)
      return
    }

    if (requestUrl.pathname === '/api/config' && method === 'GET') {
      await fulfillJson(route, 200, APP_CONFIG)
      return
    }

    if (requestUrl.pathname === '/api/clients/expiring-memberships' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (requestUrl.pathname === '/api/clients/attention' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (requestUrl.pathname === '/api/attendance/groups' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (requestUrl.pathname === '/api/branches' && method === 'GET') {
      await fulfillJson(route, 200, BRANCHES)
      return
    }

    if (requestUrl.pathname === '/api/group-types' && method === 'GET') {
      await fulfillJson(route, 200, [])
      return
    }

    if (requestUrl.pathname === '/api/settings/membership-catalog' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (requestUrl.pathname === '/api/settings/administrators' && method === 'GET') {
      await fulfillJson(route, 200, {
        items: [],
        createRoleOptions: ['Administrator', 'SuperAdministrator'],
      })
      return
    }

    throw new Error(
      `Unexpected responsive role-flow API request: ${method} ${requestUrl.pathname}`,
    )
  })
}

async function expectNoHorizontalScroll(page: Page) {
  const dimensions = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))

  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1)
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1)
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
