import { expect, test, type Page } from '@playwright/test'

const APP_CONFIG = { clubName: 'Iron Club' } as const

const headCoachSession = {
  isAuthenticated: true,
  csrfToken: 'headcoach-csrf-token',
  bootstrapMode: false,
  user: {
    id: 'headcoach-id',
    fullName: 'Главный тренер',
    login: 'headcoach',
    role: 'HeadCoach',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Home',
    allowedSections: ['Home', 'Clients', 'Groups', 'Users', 'Audit', 'Settings'],
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

test('Навигация открывает раздел Тренеры на маршруте /users', async ({ page }) => {
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const requestUrl = new URL(route.request().url())
    const method = route.request().method()

    if (requestUrl.pathname === '/api/auth/session' && method === 'GET') {
      await fulfillJson(route, 200, headCoachSession)
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

    if (requestUrl.pathname === '/api/attendance/groups' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (requestUrl.pathname === '/api/users' && method === 'GET') {
      await fulfillJson(route, 200, [])
      return
    }

    throw new Error(
      `Unexpected API request in users e2e: ${method} ${requestUrl.pathname}`,
    )
  })

  await page.goto('/')

  const desktopNavigation = page.locator(
    'nav.app-shell__side-nav[aria-label="Основная навигация"]',
  )
  const trainersNavButton = desktopNavigation.getByRole('button', { name: 'Тренеры' })

  await expect(desktopNavigation).toBeVisible()
  await trainersNavButton.click()

  await expect(page).toHaveURL(/\/users$/)
  await expect(page.getByTestId('users-screen')).toBeVisible()
  await expect(trainersNavButton).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('button', { name: 'Создать тренера' })).toBeVisible()
})

test('Редактирование пользователя показывает форму после загрузки', async ({ page }) => {
  let userDetailsCalls = 0

  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const requestUrl = new URL(route.request().url())
    const method = route.request().method()

    if (requestUrl.pathname === '/api/auth/session' && method === 'GET') {
      await fulfillJson(route, 200, headCoachSession)
      return
    }

    if (requestUrl.pathname === '/api/config' && method === 'GET') {
      await fulfillJson(route, 200, APP_CONFIG)
      return
    }

    if (
      requestUrl.pathname === '/api/users/headcoach-id' &&
      method === 'GET'
    ) {
      userDetailsCalls += 1
      await fulfillJson(route, 200, {
        id: 'headcoach-id',
        fullName: 'Главный тренер',
        login: 'headcoach',
        role: 'HeadCoach',
        mustChangePassword: false,
        isActive: true,
        messengerPlatform: null,
        messengerPlatformUserId: null,
      })
      return
    }

    throw new Error(
      `Unexpected API request in users e2e: ${method} ${requestUrl.pathname}`,
    )
  })

  await page.goto('/users/headcoach-id/edit')

  await expect(page.getByRole('heading', { name: 'Главный тренер' })).toBeVisible()
  await expect(page.getByText('Редактирование доступа')).toBeVisible()
  await expect(page.getByLabel('ФИО')).toHaveValue('Главный тренер')
  await expect(page.getByLabel('Логин')).toHaveValue('headcoach')
  await expect(
    page.getByRole('button', { name: 'Сохранить изменения' }),
  ).toBeVisible()

  const callsAfterRender = userDetailsCalls
  await page.waitForTimeout(500)

  expect(userDetailsCalls).toBe(callsAfterRender)
  expect(userDetailsCalls).toBeLessThanOrEqual(2)
})

test('Редактирование пользователя показывает серверную ошибку fullName под полем ФИО', async ({
  page,
}) => {
  const fullNameError = 'ФИО должно содержать имя и фамилию.'
  let updateUserPayload: Record<string, unknown> | null = null

  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const requestUrl = new URL(route.request().url())
    const method = route.request().method()

    if (requestUrl.pathname === '/api/auth/session' && method === 'GET') {
      await fulfillJson(route, 200, headCoachSession)
      return
    }

    if (requestUrl.pathname === '/api/config' && method === 'GET') {
      await fulfillJson(route, 200, APP_CONFIG)
      return
    }

    if (
      requestUrl.pathname === '/api/users/headcoach-id' &&
      method === 'GET'
    ) {
      await fulfillJson(route, 200, {
        id: 'headcoach-id',
        fullName: 'Главный тренер',
        login: 'headcoach',
        role: 'HeadCoach',
        mustChangePassword: false,
        isActive: true,
        messengerPlatform: null,
        messengerPlatformUserId: null,
      })
      return
    }

    if (
      requestUrl.pathname === '/api/users/headcoach-id' &&
      method === 'PUT'
    ) {
      updateUserPayload = route.request().postDataJSON()

      expect(route.request().headers()['x-csrf-token']).toBe(
        headCoachSession.csrfToken,
      )

      await fulfillJson(route, 400, {
        title: 'Validation failed',
        detail: 'Проверьте данные пользователя.',
        errors: {
          fullName: [fullNameError],
        },
      })
      return
    }

    throw new Error(
      `Unexpected API request in users e2e: ${method} ${requestUrl.pathname}`,
    )
  })

  await page.goto('/users/headcoach-id/edit')

  await page.getByLabel('ФИО').fill('Главный')
  await page.getByRole('button', { name: 'Сохранить изменения' }).click()

  await expect.poll(() => updateUserPayload).toMatchObject({
    fullName: 'Главный',
  })
  await expect(page.getByLabel('ФИО')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText(fullNameError)).toBeVisible()
})

test('Создание тренера скрывает выбор роли и отправляет фиксированную роль Coach', async ({
  page,
}) => {
  let createUserPayload: Record<string, unknown> | null = null

  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const requestUrl = new URL(route.request().url())
    const method = route.request().method()

    if (requestUrl.pathname === '/api/auth/session' && method === 'GET') {
      await fulfillJson(route, 200, headCoachSession)
      return
    }

    if (requestUrl.pathname === '/api/config' && method === 'GET') {
      await fulfillJson(route, 200, APP_CONFIG)
      return
    }

    if (requestUrl.pathname === '/api/users' && method === 'POST') {
      createUserPayload = route.request().postDataJSON()
      await fulfillJson(route, 200, {
        id: 'coach-created',
        fullName: String(createUserPayload.fullName),
        login: String(createUserPayload.login),
        role: 'Coach',
        mustChangePassword: Boolean(createUserPayload.mustChangePassword),
        isActive: Boolean(createUserPayload.isActive),
        messengerPlatform: createUserPayload.messengerPlatform ?? null,
        messengerPlatformUserId: createUserPayload.messengerPlatformUserId ?? null,
      })
      return
    }

    if (requestUrl.pathname === '/api/users' && method === 'GET') {
      await fulfillJson(route, 200, [])
      return
    }

    throw new Error(
      `Unexpected API request in users e2e: ${method} ${requestUrl.pathname}`,
    )
  })

  await page.goto('/users/new')
  await expect(page.getByRole('heading', { name: 'Новый тренер' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Сохранить тренера' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Роль' })).toHaveCount(0)

  await page.getByLabel('ФИО').fill('Новый Тренер')
  await page.getByLabel('Логин').fill('new-coach')
  await page.getByLabel('Пароль').fill('12345Aa!')
  await page.getByRole('button', { name: 'Сохранить тренера' }).click()

  await expect.poll(() => createUserPayload).toMatchObject({
    fullName: 'Новый Тренер',
    login: 'new-coach',
    password: '12345Aa!',
    role: 'Coach',
    mustChangePassword: true,
    isActive: true,
  })
})

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
