import { expect, test, type Page } from '@playwright/test'

const APP_CONFIG = {
  clubName: 'Iron Club',
  themeId: 'default-green-v1',
  authBackgroundImageId: 'k4pro-login-v1',
} as const

const ADMIN_SESSION = {
  isAuthenticated: true,
  csrfToken: 'administrator-csrf-token',
  bootstrapMode: false,
  user: {
    id: 'administrator-id',
    fullName: 'Администратор',
    login: 'administrator',
    role: 'Administrator',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Home',
    allowedSections: ['Home', 'Schedule', 'Clients', 'Groups', 'Settings'],
    permissions: {
      canManageUsers: false,
      canManageClients: true,
      canManageGroups: true,
      canManageSettings: true,
      canMarkAttendance: false,
      canViewAuditLog: true,
      canViewFinancialReports: false,
    },
    assignedGroupIds: ['group-1'],
    branchId: 'branch-1',
    createRoleOptions: [],
  },
} as const

const SUPER_ADMIN_SESSION = {
  isAuthenticated: true,
  csrfToken: 'superadministrator-csrf-token',
  bootstrapMode: false,
  user: {
    id: 'superadministrator-id',
    fullName: 'Суперадминистратор',
    login: 'superadministrator',
    role: 'SuperAdministrator',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Home',
    allowedSections: ['Home', 'Schedule', 'Clients', 'Groups', 'Audit', 'Settings'],
    permissions: {
      canManageUsers: true,
      canManageClients: true,
      canManageGroups: true,
      canManageSettings: true,
      canMarkAttendance: true,
      canViewAuditLog: true,
      canViewFinancialReports: false,
    },
    assignedGroupIds: ['group-1'],
    branchId: null,
    createRoleOptions: ['Administrator'],
  },
} as const

const COACH_SESSION = {
  isAuthenticated: true,
  csrfToken: 'coach-csrf-token',
  bootstrapMode: false,
  user: {
    id: 'coach-id',
    fullName: 'Тренер',
    login: 'coach',
    role: 'Coach',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Home',
    allowedSections: ['Home', 'Schedule', 'Clients'],
    permissions: {
      canManageUsers: false,
      canManageClients: false,
      canManageGroups: false,
      canManageSettings: false,
      canMarkAttendance: true,
      canViewAuditLog: false,
      canViewFinancialReports: false,
    },
    assignedGroupIds: ['group-coach'],
    branchId: null,
  },
} as const

type GroupTypeState = {
  id: string
  name: string
  description: string
  groupCount: number
}

type MockState = {
  getCalls: number
  putCalls: number
  putPayload: Record<string, unknown> | null
  putHeaders: string | undefined
}

type MockSession =
  | typeof ADMIN_SESSION
  | typeof SUPER_ADMIN_SESSION
  | typeof COACH_SESSION

type MockOptions = {
  session: MockSession
  updateValidationError?: {
    detail: string
    errors: Record<string, string[]>
  }
  groupTypes?: GroupTypeState[]
}

async function mockSettingsApi(
  page: Page,
  options: MockOptions,
) {
  const state: MockState = {
    getCalls: 0,
    putCalls: 0,
    putPayload: null,
    putHeaders: undefined,
  }

  const groupTypes: GroupTypeState[] = (options.groupTypes ?? [
    {
      id: 'group-type-existing',
      name: 'Базовый тип',
      description: 'Базовый справочник',
      groupCount: 3,
    },
  ]).map((item) => ({ ...item }))

  await page.route('**/api/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    const pathname = requestUrl.pathname
    const method = route.request().method()

    if (!pathname.startsWith('/api/')) {
      await route.continue()
      return
    }

    if (pathname === '/api/auth/session' && method === 'GET') {
      await fulfillJson(route, 200, options.session)
      return
    }

    if (pathname === '/api/config' && method === 'GET') {
      await fulfillJson(route, 200, APP_CONFIG)
      return
    }

    if (pathname === '/api/group-types' && method === 'GET') {
      state.getCalls += 1
      await fulfillJson(route, 200, groupTypes)
      return
    }

    if (pathname === '/api/group-types/group-type-existing' && method === 'PUT') {
      state.putCalls += 1
      state.putHeaders = route.request().headers()['x-csrf-token']
      state.putPayload = route.request().postDataJSON()

      if (options.updateValidationError) {
        await fulfillJson(route, 400, {
          title: 'Validation failed',
          detail: options.updateValidationError.detail,
          errors: options.updateValidationError.errors,
        })
        return
      }

      const payload = state.putPayload as {
        name: string
        description: string | null
      }
      const updated = groupTypes.find((item) => item.id === 'group-type-existing')
      expect(updated).not.toBeNull()

      updated!.name = payload.name
      updated!.description = payload.description ?? ''

      await fulfillJson(route, 200, {
        id: updated!.id,
        name: updated!.name,
        description: updated!.description,
        groupCount: updated!.groupCount,
      })
      return
    }

    if (pathname === '/api/branches' && method === 'GET') {
      await fulfillJson(route, 200, [{ id: 'branch-1', name: 'Центр', isArchived: false }])
      return
    }

    if (
      pathname === '/api/settings/membership-catalog' &&
      method === 'GET'
    ) {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (
      pathname === '/api/settings/membership-catalog' &&
      method === 'POST'
    ) {
      await fulfillJson(route, 200, {
        id: 'catalog-item-1',
        branchId: null,
        name: 'Абонемент',
        price: 1000,
        behaviorKind: 'Term',
        availableFrom: '2026-01-01',
        availableTo: null,
        isSystemOwned: false,
      })
      return
    }

    if (pathname === '/api/membership-catalog/eligible' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (
      pathname === '/api/settings/administrators' &&
      (method === 'GET' || method === 'POST')
    ) {
      await fulfillJson(route, 200, [])
      return
    }

    if (pathname === '/api/auth/login' && method === 'POST') {
      await fulfillJson(route, 200, options.session)
      return
    }

    if (
      pathname === '/api/clients/expiring-memberships' &&
      method === 'GET'
    ) {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (pathname === '/api/clients/attention' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (pathname === '/api/attendance/groups' && method === 'GET') {
      await fulfillJson(route, 200, { items: [] })
      return
    }

    if (pathname === '/api/groups/summary' && method === 'GET') {
      await fulfillJson(route, 200, {
        totalCount: 0,
        activeWithoutTrainerCount: 0,
      })
      return
    }

    if (pathname === '/api/clients' && method === 'GET') {
      await fulfillJson(route, 200, {
        items: [],
        totalCount: 0,
        activeCount: 0,
        archivedCount: 0,
        skip: 0,
        take: 20,
        page: 1,
        pageSize: 20,
        hasNextPage: false,
      })
      return
    }

    throw new Error(`Unexpected API request in settings e2e: ${method} ${pathname}`)
  })

  return state
}

for (const profile of [
  {
    label: 'Administrator',
    roleName: 'Администратор',
    session: ADMIN_SESSION,
    visibleAdministratorsTab: false,
  },
  {
    label: 'SuperAdministrator',
    roleName: 'Суперадминистратор',
    session: SUPER_ADMIN_SESSION,
    visibleAdministratorsTab: true,
  },
]) {
  test(`${profile.label} видит вкладки абонементов и типов групп, не видит соседние вкладки в /settings`, async ({
    page,
  }) => {
    await mockSettingsApi(page, { session: profile.session })

    await page.goto('/settings')

    await expect(page.getByTestId('settings-screen')).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Абонементы' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Типы групп' })).toBeVisible()
    await expect(
      page.getByRole('tab', { name: 'Филиалы и залы' }),
    ).toHaveCount(0)

    if (profile.visibleAdministratorsTab) {
      await expect(
        page.getByRole('tab', { name: 'Администраторы' }),
      ).toBeVisible()
    } else {
      await expect(
        page.getByRole('tab', { name: 'Администраторы' }),
      ).toHaveCount(0)
    }
  })

  test(`${profile.label} редактирует тип группы, отправляет корректный PUT и видит результат после перезагрузки`, async ({
    page,
  }) => {
    const state = await mockSettingsApi(page, {
      session: profile.session,
      groupTypes: [
        {
          id: 'group-type-existing',
          name: 'Базовый тип',
          description: 'Базовый справочник',
          groupCount: 3,
        },
      ],
    })

    const nextName = `${profile.roleName} тип 2 `
    const nextDescription = `Обновленный тип ${profile.label}  `

    await page.goto('/settings')
    await page.getByRole('tab', { name: 'Типы групп' }).click()

    const card = page.getByTestId('group-type-card-group-type-existing')
    await expect(card).toContainText('Базовый тип')

    await card.getByRole('button', { name: 'Редактировать' }).click()

    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()
    await expect(modal.getByLabel('Название')).toHaveValue('Базовый тип')
    await expect(modal.getByLabel('Описание')).toHaveValue('Базовый справочник')

    await modal.getByLabel('Название').fill(nextName)
    await modal.getByLabel('Описание').fill(nextDescription)
    await modal.getByRole('button', { name: 'Сохранить' }).click()

    await expect.poll(() => state.putCalls).toBe(1)
    await expect.poll(() => state.putHeaders).toBe(profile.session.csrfToken)

    await expect.poll(() => state.putPayload).toMatchObject({
      name: nextName.trim(),
      description: nextDescription.trim(),
    })

    await expect(modal).toBeHidden()
    await expect(card).toContainText(nextName.trim())
    await expect(card).toContainText(nextDescription.trim())

    await page.reload()
    await expect(page.getByTestId('settings-screen')).toBeVisible()
    await page.getByRole('tab', { name: 'Типы групп' }).click()
    await expect(
      page.getByTestId('group-type-card-group-type-existing'),
    ).toContainText(nextName.trim())
    await expect(
      page.getByTestId('group-type-card-group-type-existing'),
    ).toContainText(nextDescription.trim())
  })
}

test('Администратор показывает валидационную ошибку в форме редактирования без закрытия модального окна', async ({ page }) => {
  await mockSettingsApi(page, {
    session: ADMIN_SESSION,
    updateValidationError: {
      detail: 'Сохранение типа невозможно.',
      errors: {
        name: ['Название типа уже используется.'],
      },
    },
  })

  await page.goto('/settings')
  await page.getByRole('tab', { name: 'Типы групп' }).click()

  await page
    .getByTestId('group-type-card-group-type-existing')
    .getByRole('button', { name: 'Редактировать' })
    .click()

  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()

  await modal.getByLabel('Название').fill('Уникальное название')
  await modal.getByRole('button', { name: 'Сохранить' }).click()

  await expect(modal).toBeVisible()
  await expect(
    modal.getByText('Название типа уже используется.'),
  ).toBeVisible()
  await expect(
    modal.getByText('Сохранение не выполнено'),
  ).toBeVisible()
  await expect(
    modal.getByText('Сохранение типа невозможно.'),
  ).toBeVisible()
  await expect(modal.getByLabel('Название')).toHaveValue('Уникальное название')
})

test('Coach не видит /settings и получает явное состояние ограничения', async ({ page }) => {
  await mockSettingsApi(page, { session: COACH_SESSION })

  await page.goto('/settings')

  await expect(page).toHaveURL('/settings')
  await expect(page.getByRole('heading', { level: 1, name: 'Нет доступа' })).toBeFocused()
  await expect(page.getByText('У вас нет доступа к разделу «Настройки».')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Открыть Главная' })).toBeVisible()
  await expect(page.getByTestId('settings-screen')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Настройки', exact: true }),
  ).toHaveCount(0)
  await expect(page.getByTestId('home-screen')).toHaveCount(0)
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
