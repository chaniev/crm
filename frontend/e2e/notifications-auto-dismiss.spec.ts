import { expect, test, type Page } from '@playwright/test'

const APP_NOTIFICATION_AUTO_CLOSE_MS = 10_000
const NOTIFICATION_TRANSITION_MS = 250
const APP_CONFIG = { clubName: 'Iron Club' } as const

const HEAD_COACH_SESSION = {
  isAuthenticated: true,
  csrfToken: 'notifications-e2e-csrf-token',
  bootstrapMode: false,
  user: {
    id: 'headcoach-id',
    fullName: 'Главный тренер',
    login: 'headcoach',
    role: 'HeadCoach',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Home',
    allowedSections: [
      'Home',
      'Schedule',
      'Attendance',
      'Clients',
      'Groups',
      'Users',
      'Audit',
      'Finance',
      'Settings',
    ],
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

type GroupTypePayload = {
  id: string
  name: string
  description: string | null
  systemIdentifier: string
  groupCount: number
}

test.describe('Уведомления', () => {
  test('автоматически скрываются и не накапливаются при повторных действиях', async ({
    page,
  }) => {
    await page.clock.install()
    const apiState = await mockSettingsApi(page)

    await page.goto('/settings')
    await expect(page.getByTestId('settings-screen')).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Типы групп' })).toBeVisible()

    const groupTypeNotifications = getGroupTypeCreatedNotifications(page)

    await createGroupType(page, 'Тип 1', 'type-1')
    await expect(groupTypeNotifications.first()).toBeVisible()
    await page.clock.runFor(APP_NOTIFICATION_AUTO_CLOSE_MS + NOTIFICATION_TRANSITION_MS + 100)
    await expect(groupTypeNotifications).toHaveCount(0)

    for (let index = 2; index <= 7; index += 1) {
      await createGroupType(page, `Тип ${index}`, `type-${index}`)
    }

    await expect.poll(async () => groupTypeNotifications.count()).toBeLessThanOrEqual(5)
    await page.clock.runFor(APP_NOTIFICATION_AUTO_CLOSE_MS + NOTIFICATION_TRANSITION_MS + 100)
    await expect(groupTypeNotifications).toHaveCount(0)
    expect(apiState.createGroupTypeCalls).toBe(7)
  })

  test('на mobile исчезают и освобождают основные действия', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.clock.install()
    await mockSettingsApi(page)

    await page.goto('/settings')
    await expect(page.getByTestId('settings-screen')).toBeVisible()

    const addTypeButton = page.getByRole('button', { name: 'Добавить тип' })
    await expect(addTypeButton).toBeInViewport()

    const groupTypeNotifications = getGroupTypeCreatedNotifications(page)
    await createGroupType(page, 'Мобильный тип', 'mobile-type')

    await expect(groupTypeNotifications.first()).toBeVisible()
    await page.clock.runFor(APP_NOTIFICATION_AUTO_CLOSE_MS + NOTIFICATION_TRANSITION_MS + 100)

    await expect(groupTypeNotifications).toHaveCount(0)
    await expect(addTypeButton).toBeInViewport()
  })
})

function getGroupTypeCreatedNotifications(page: Page) {
  return page
    .locator('[data-position="top-right"] [role="alert"]')
    .filter({ hasText: /Тип группы создан/ })
}

async function createGroupType(
  page: Page,
  name: string,
  systemIdentifier: string,
) {
  await page.getByRole('button', { name: 'Добавить тип' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Название').fill(name)
  await dialog.getByLabel('Системный идентификатор').fill(systemIdentifier)
  await dialog.getByLabel('Описание').fill(`Автотестовый тип ${name}`)

  await dialog.getByRole('button', { name: 'Сохранить' }).click()
  await expect(dialog).toBeHidden()
}

async function mockSettingsApi(page: Page) {
  const groupTypes: GroupTypePayload[] = [
    {
      id: 'group-type-existing',
      name: 'Базовый тип',
      description: 'Стартовый тип для e2e.',
      systemIdentifier: 'base',
      groupCount: 0,
    },
  ]
  const apiState = {
    createGroupTypeCalls: 0,
  }

  await page.route('**/api/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const method = route.request().method()
    const pathname = requestUrl.pathname

    if (!pathname.startsWith('/api/')) {
      await route.continue()
      return
    }

    if (pathname === '/api/auth/session' && method === 'GET') {
      await fulfillJson(route, 200, HEAD_COACH_SESSION)
      return
    }

    if (pathname === '/api/config' && method === 'GET') {
      await fulfillJson(route, 200, APP_CONFIG)
      return
    }

    if (pathname === '/api/group-types' && method === 'GET') {
      await fulfillJson(route, 200, groupTypes)
      return
    }

    if (pathname === '/api/group-types' && method === 'POST') {
      apiState.createGroupTypeCalls += 1

      expect(route.request().headers()['x-csrf-token']).toBe(
        HEAD_COACH_SESSION.csrfToken,
      )

      const payload = route.request().postDataJSON() as {
        name: string
        description: string | null
        systemIdentifier: string
      }

      const createdGroupType = {
        id: `group-type-${apiState.createGroupTypeCalls}`,
        name: payload.name,
        description: payload.description,
        systemIdentifier: payload.systemIdentifier,
        groupCount: 0,
      }

      groupTypes.push(createdGroupType)
      await fulfillJson(route, 200, createdGroupType)
      return
    }

    throw new Error(`Unexpected API request: ${method} ${pathname}`)
  })

  return apiState
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
