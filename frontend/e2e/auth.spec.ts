import { expect, test, type Page } from '@playwright/test'

const BOOTSTRAP_LOGIN = 'headcoach'
const BOOTSTRAP_PASSWORD = '12345678'
const UPDATED_PASSWORD = 'gym-crm-e2e-password'

const unauthenticatedSession = {
  isAuthenticated: false,
  csrfToken: '',
  user: null,
}

const forcedPasswordSession = {
  isAuthenticated: true,
  csrfToken: 'csrf-login-token',
  user: {
    id: 'bootstrap-headcoach-id',
    fullName: 'Главный тренер',
    login: BOOTSTRAP_LOGIN,
    role: 'HeadCoach',
    mustChangePassword: true,
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
}

const authenticatedSession = {
  ...forcedPasswordSession,
  csrfToken: 'csrf-changed-password-token',
  user: {
    ...forcedPasswordSession.user,
    mustChangePassword: false,
  },
}

test.describe('Аутентификация', () => {
  test('Отображает экран логина и показывает ошибку для неверных учетных данных', async ({
    page,
  }) => {
    await mockApi(page, async ({ pathname, method, route }) => {
      if (pathname === '/api/auth/session' && method === 'GET') {
        await fulfillJson(route, 200, unauthenticatedSession)
        return true
      }

      if (pathname === '/api/auth/login' && method === 'POST') {
        const payload = route.request().postDataJSON()

        expect(payload).toEqual({
          login: BOOTSTRAP_LOGIN,
          password: 'wrong-password',
        })

        await fulfillJson(route, 401, {
          detail: 'Неверный логин или пароль.',
        })
        return true
      }

      return false
    })

    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Войти в систему' })).toBeVisible()
    await expect(page.getByLabel('Логин')).toBeVisible()
    await expect(page.getByLabel('Пароль')).toBeVisible()

    await page.getByLabel('Логин').fill(BOOTSTRAP_LOGIN)
    await page.getByLabel('Пароль').fill('wrong-password')

    await page.getByRole('button', { name: 'Войти' }).click()

    await expect(
      page.getByText('Неверный логин или пароль.'),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('Проводит пользователя через forced first login и отправляет CSRF при смене пароля', async ({
    page,
  }) => {
    await mockApi(page, async ({ pathname, method, route }) => {
      if (pathname === '/api/auth/session' && method === 'GET') {
        await fulfillJson(route, 200, unauthenticatedSession)
        return true
      }

      if (pathname === '/api/auth/login' && method === 'POST') {
        const payload = route.request().postDataJSON()

        expect(payload).toEqual({
          login: BOOTSTRAP_LOGIN,
          password: BOOTSTRAP_PASSWORD,
        })

        await fulfillJson(route, 200, forcedPasswordSession)
        return true
      }

      if (pathname === '/api/auth/change-password' && method === 'POST') {
        const payload = route.request().postDataJSON()

        expect(route.request().headers()['x-csrf-token']).toBe(
          forcedPasswordSession.csrfToken,
        )
        expect(payload).toEqual({
          currentPassword: BOOTSTRAP_PASSWORD,
          newPassword: UPDATED_PASSWORD,
        })

        await fulfillJson(route, 200, authenticatedSession)
        return true
      }

      if (pathname === '/api/clients' && method === 'GET') {
        await fulfillJson(route, 200, {
          items: [],
          totalCount: 0,
        })
        return true
      }

      return false
    })

    await page.goto('/')

    await page.getByLabel('Логин').fill(BOOTSTRAP_LOGIN)
    await page.getByLabel('Пароль').fill(BOOTSTRAP_PASSWORD)
    await page.getByRole('button', { name: 'Войти' }).click()

    await expect(
      page.getByRole('heading', {
        name: 'Задайте новый пароль для первого входа',
      }),
    ).toBeVisible()

    await page.getByLabel('Текущий пароль').fill(BOOTSTRAP_PASSWORD)
    await page.getByPlaceholder('Придумайте новый пароль').fill(UPDATED_PASSWORD)
    await page.getByPlaceholder('Повторите новый пароль').fill(UPDATED_PASSWORD)
    await page.getByRole('button', { name: 'Сменить пароль и продолжить' }).click()

    await expect(
      page.getByRole('heading', { name: 'Истекающие абонементы' }),
    ).toBeVisible()
    await expect(
      page.getByText('В ближайшие 10 дней истекающих абонементов нет.'),
    ).toBeVisible()
  })
})

type MockApiContext = {
  method: string
  pathname: string
  route: Parameters<Page['route']>[1] extends (route: infer T) => unknown ? T : never
}

async function mockApi(
  page: Page,
  handler: (context: MockApiContext) => Promise<boolean>,
) {
  await page.route('**/api/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const handled = await handler({
      method: route.request().method(),
      pathname: requestUrl.pathname,
      route,
    })

    if (!handled) {
      throw new Error(`Unexpected API request in auth e2e: ${route.request().method()} ${requestUrl.pathname}`)
    }
  })
}

async function fulfillJson(
  route: MockApiContext['route'],
  status: number,
  payload: unknown,
) {
  await route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(payload),
  })
}
