import { expect, test, type Page } from '@playwright/test'

const APP_CONFIG = {
  clubName: 'Iron Club',
  themeId: 'default-green-v1',
  authBackgroundImageId: 'k4pro-login-v1',
} as const

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
    createRoleOptions: ['SuperAdministrator', 'Administrator', 'Coach'],
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

    if (requestUrl.pathname === '/api/clients/attention' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (requestUrl.pathname === '/api/attendance/groups' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (requestUrl.pathname === '/api/users' && method === 'GET') {
      await fulfillJson(route, 200, {
        items: [],
        createRoleOptions: ['Coach'],
      })
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

test('Поиск тренера фильтрует список и сохраняется при возврате из карточки', async ({
  page,
}) => {
  let updateCalls = 0
  const trainers = [
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
      mustChangePassword: true,
      isActive: true,
      messengerPlatform: null,
      messengerPlatformUserId: null,
      branchId: null,
      branchName: null,
      allowedActions: ['Edit'],
      roleOptions: ['Coach'],
    },
    {
      id: 'coach-inactive',
      fullName: 'Ирина Петрова',
      login: 'irina.login',
      role: 'Coach',
      mustChangePassword: false,
      isActive: false,
      messengerPlatform: null,
      messengerPlatformUserId: null,
      branchId: null,
      branchName: null,
      allowedActions: ['Edit'],
      roleOptions: ['Coach'],
    },
    {
      id: 'coach-read-only',
      fullName: 'Алексей Романов',
      login: 'alexey.login',
      role: 'Coach',
      mustChangePassword: false,
      isActive: true,
      messengerPlatform: null,
      messengerPlatformUserId: null,
      branchId: null,
      branchName: null,
      allowedActions: [],
      roleOptions: ['Coach'],
    },
    {
      id: 'superadmin-exception',
      fullName: 'Сервисная учетная запись',
      login: 'service.account',
      role: 'SuperAdministrator',
      mustChangePassword: false,
      isActive: true,
      messengerPlatform: null,
      messengerPlatformUserId: null,
      branchId: null,
      branchName: null,
      allowedActions: ['Edit'],
      roleOptions: ['SuperAdministrator'],
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
  ]

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

    if (requestUrl.pathname === '/api/users' && method === 'GET') {
      await fulfillJson(route, 200, {
        items: trainers,
        createRoleOptions: ['Coach'],
      })
      return
    }

    if (requestUrl.pathname === '/api/users/coach-anna' && method === 'GET') {
      await fulfillJson(route, 200, trainers[0])
      return
    }

    if (requestUrl.pathname === '/api/users/coach-anna' && method === 'PUT') {
      updateCalls += 1
      await fulfillJson(route, 200, trainers[0])
      return
    }

    throw new Error(
      `Unexpected API request in users search e2e: ${method} ${requestUrl.pathname}`,
    )
  })

  await page.goto('/users')

  const search = page.getByRole('textbox', { name: 'Найти тренера' })
  await expect(search).toHaveAttribute('placeholder', 'ФИО или логин')
  const normalCard = page.getByTestId('user-card-coach-anna')
  const passwordCard = page.getByTestId('user-card-coach-boris')
  await expect(normalCard).toBeVisible()
  await expect(passwordCard).toBeVisible()
  await expect(normalCard.getByText('Тренер', { exact: true })).toHaveCount(0)
  await expect(normalCard.getByText('Активен', { exact: true })).toHaveCount(0)
  await expect(normalCard.getByText('Пароль актуален', { exact: true })).toHaveCount(0)
  await expect(passwordCard.getByText('Требуется смена пароля', { exact: true })).toBeVisible()
  await expect(page.getByTestId('user-card-coach-inactive').getByText('Отключен', { exact: true })).toBeVisible()
  await expect(page.getByTestId('user-card-coach-read-only').getByText('Только просмотр', { exact: true })).toBeVisible()
  await expect(page.getByTestId('user-card-superadmin-exception').getByText('Суперадминистратор', { exact: true })).toBeVisible()

  await search.fill('  ANNA.LOGIN  ')
  await expect(page.getByTestId('user-card-coach-anna')).toBeVisible()
  await expect(page.getByTestId('user-card-coach-boris')).toHaveCount(0)

  await page.getByTestId('user-card-coach-anna')
    .getByRole('button', { name: 'Редактировать' })
    .click()
  await expect(page).toHaveURL(/\/users\/coach-anna\/edit$/)
  await expect(page.getByRole('button', { name: 'Назад к списку' })).toHaveCount(1)
  await expect(page.getByRole('button', { exact: true, name: 'К списку' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Назад к списку' }).click()

  await expect(page).toHaveURL(/\/users$/)
  await expect(search).toHaveValue('  ANNA.LOGIN  ')
  await expect(normalCard).toBeVisible()
  await expect(normalCard.getByText('Тренер', { exact: true })).toHaveCount(0)
  await expect(normalCard.getByText('Активен', { exact: true })).toHaveCount(0)
  await expect(normalCard.getByText('Пароль актуален', { exact: true })).toHaveCount(0)

  await page.getByTestId('user-card-coach-anna')
    .getByRole('button', { name: 'Редактировать' })
    .click()
  await expect(page.getByRole('button', { name: 'Назад к списку' })).toHaveCount(1)
  await expect(page.getByRole('button', { exact: true, name: 'К списку' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Сохранить изменения' }).click()
  await expect(page).toHaveURL(/\/users$/)
  expect(updateCalls).toBe(1)
  await expect(search).toHaveValue('  ANNA.LOGIN  ')

  await page.getByTestId('user-card-coach-anna')
    .getByRole('button', { name: 'Редактировать' })
    .click()
  for (const viewport of [
    { width: 360, height: 780 },
    { width: 390, height: 844 },
    { width: 420, height: 912 },
    { width: 440, height: 956 },
    { width: 912, height: 420 },
    { width: 956, height: 440 },
    { width: 768, height: 1024 },
    { width: 1440, height: 1200 },
  ]) {
    await page.setViewportSize(viewport)
    await expect(page.getByRole('button', { name: 'Назад к списку' })).toHaveCount(1)
    await expect(page.getByRole('button', { exact: true, name: 'К списку' })).toHaveCount(0)
    const submit = page.getByRole('button', { name: 'Сохранить изменения' })
    await submit.scrollIntoViewIfNeeded()
    await expect(submit).toBeVisible()
    await expect.poll(() => page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    )).toBe(true)
  }
  await page.goBack()
  await expect(page).toHaveURL(/\/users$/)
  await expect(search).toHaveValue('  ANNA.LOGIN  ')

  await search.fill('никого')
  await expect(page.getByText('Тренеры не найдены')).toBeVisible()
  await page.getByRole('button', { name: 'Очистить поиск' }).click()
  await expect(search).toHaveValue('')
  await expect(page.getByTestId('user-card-coach-anna')).toBeVisible()
  await expect(page.getByTestId('user-card-coach-boris')).toBeVisible()

  for (const viewport of [
    { width: 360, height: 780 },
    { width: 390, height: 844 },
    { width: 420, height: 912 },
    { width: 440, height: 956 },
    { width: 912, height: 420 },
    { width: 956, height: 440 },
    { width: 768, height: 1024 },
    { width: 1440, height: 1200 },
  ]) {
    await page.setViewportSize(viewport)
    const longCard = page.getByTestId('user-card-coach-long')
    const longName = longCard.getByText(
      'Александра Константинопольская-Рождественская Очень Длинное Отчество',
    )
    const longEdit = longCard.getByRole('button', { name: 'Редактировать' })
    await expect(search).toBeVisible()
    await expect(page.getByRole('button', { name: 'Обновить' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Создать тренера' })).toBeVisible()
    await longCard.scrollIntoViewIfNeeded()
    await expect(longName).toBeVisible()
    await expect(longCard.getByText(/alexandra\.konstantinopolskaya/)).toBeVisible()
    await expect(longCard.getByText(/telegram-identifier/)).toBeVisible()
    await expect(longEdit).toBeVisible()
    if (viewport.width <= 440) {
      await expect.poll(() => longName.evaluate((element) =>
        element.getBoundingClientRect().height > parseFloat(getComputedStyle(element).lineHeight),
      )).toBe(true)
    }
    await expect.poll(() => page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    )).toBe(true)
  }
})

test('Поиск сохраняется при blocking и stale ошибках с явным retry', async ({
  page,
}) => {
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
  let usersCalls = 0

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

    if (requestUrl.pathname === '/api/users' && method === 'GET') {
      usersCalls += 1

      if (usersCalls === 1 || usersCalls === 2 || usersCalls === 4) {
        await fulfillJson(route, 503, {
          title: 'Сервис недоступен',
          detail: 'Список тренеров временно недоступен.',
        })
        return
      }

      await fulfillJson(route, 200, {
        items: [trainer],
        createRoleOptions: ['Coach'],
      })
      return
    }

    throw new Error(
      `Unexpected API request in users error e2e: ${method} ${requestUrl.pathname}`,
    )
  })

  await page.goto('/users')

  const search = page.getByRole('textbox', { name: 'Найти тренера' })
  await search.fill('anna')
  await expect(page.getByText('Список не загрузился')).toBeVisible()
  await expect(page.getByText('Список тренеров временно недоступен.')).toBeVisible()
  await page.getByRole('button', { name: 'Повторить загрузку списка тренеров' }).click()

  await expect(page.getByTestId('user-card-coach-anna')).toBeVisible()
  await expect(search).toHaveValue('anna')
  await page.getByRole('button', { name: 'Обновить' }).click()

  await expect(page.getByText('Список не обновился')).toBeVisible()
  await expect(page.getByText('Список тренеров временно недоступен.')).toBeVisible()
  await expect(page.getByTestId('user-card-coach-anna')).toBeVisible()
  await expect(search).toHaveValue('anna')
  await page.getByRole('button', { name: 'Повторить' }).click()

  await expect.poll(() => usersCalls).toBe(5)
  await expect(page.getByText('Список не обновился')).toHaveCount(0)
  await expect(page.getByTestId('user-card-coach-anna')).toBeVisible()
  await expect(search).toHaveValue('anna')
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
  await expect(page.getByText('Редактирование доступа')).toHaveCount(0)
  await expect(page.getByText('Логин фиксируется после создания тренера.')).toHaveCount(0)
  await expect(page.getByText('Что можно менять на этом экране')).toHaveCount(0)
  await expect(
    page.getByText(/Если очистить поле, тренер потеряет доступ к боту/),
  ).toBeVisible()
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
      await fulfillJson(route, 200, {
        items: [],
        createRoleOptions: ['Coach'],
      })
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
  await expect(page.getByText('Тренер активен', { exact: true })).toBeVisible()

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

test('Редактирование администратора через /users завершается ошибкой staff_not_found', async ({
  page,
}) => {
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

    if (requestUrl.pathname === '/api/clients/attention' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (requestUrl.pathname === '/api/attendance/groups' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (requestUrl.pathname === '/api/users/admin-1' && method === 'GET') {
      await fulfillJson(route, 404, {
        title: 'Не найдено',
        detail: 'Сотрудник не найден.',
        code: 'staff_not_found',
      })
      return
    }

    throw new Error(
      `Unexpected API request in users e2e: ${method} ${requestUrl.pathname}`,
    )
  })

  await page.goto('/users/admin-1/edit')

  await expect(page.getByText('Карточка не загрузилась')).toBeVisible()
  await expect(page.getByText('Сотрудник не найден.')).toBeVisible()
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
