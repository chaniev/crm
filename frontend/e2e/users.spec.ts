import { expect, test, type Page } from '@playwright/test'

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
    allowedSections: ['Home', 'Attendance', 'Clients', 'Groups', 'Users', 'Audit'],
    permissions: {
      canManageUsers: true,
      canManageClients: true,
      canManageGroups: true,
      canMarkAttendance: true,
      canViewAuditLog: true,
    },
    assignedGroupIds: [],
  },
} as const

test('Редактирование пользователя показывает форму после загрузки', async ({ page }) => {
  let userDetailsCalls = 0

  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const requestUrl = new URL(route.request().url())
    const method = route.request().method()

    if (requestUrl.pathname === '/api/auth/session' && method === 'GET') {
      await fulfillJson(route, 200, headCoachSession)
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
