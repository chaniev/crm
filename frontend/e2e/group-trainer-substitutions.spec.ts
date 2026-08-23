import { expect, test, type Page, type Route } from '@playwright/test'

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
    landingScreen: 'Attention',
    allowedSections: ['Attendance', 'Attention', 'Schedule', 'Clients', 'Groups', 'Users', 'Audit', 'Settings'],
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
    attendanceScope: { kind: 'Global', groupIds: [] },
  },
} as const

const coachSession = {
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
    attendanceScope: { kind: 'TrainerAssignments', groupIds: ['group-1'] },
  },
} as const

const group = {
  id: 'group-1',
  branchId: 'branch-1',
  branchName: 'Центр',
  hallId: 'hall-1',
  hallName: 'Большой зал',
  groupTypeId: 'type-1',
  groupTypeName: 'Общая',
  name: 'Юниоры 18:00',
  trainingStartTime: '18:00',
  durationMinutes: 60,
  weekdays: [1, 3],
  isActive: true,
  trainerIds: ['trainer-main'],
  trainers: [{ id: 'trainer-main', fullName: 'Основной Тренер', login: 'main' }],
  trainerCount: 1,
  trainerNames: ['Основной Тренер'],
  clientCount: 0,
  createdAt: '2026-07-01T10:00:00Z',
  updatedAt: '2026-07-20T10:00:00Z',
} as const

const trainerOptions = [
  { id: 'trainer-main', fullName: 'Основной Тренер', login: 'main' },
  { id: 'trainer-substitute', fullName: 'Замещающий Тренер', login: 'sub' },
] as const

type Substitution = {
  id: string
  groupId: string
  substituteTrainer: {
    id: string
    fullName: string
    login: string
    isActive: boolean
  }
  startsOn: string
  endsOn: string
  status: 'Upcoming' | 'Active' | 'Expired' | 'Cancelled'
  cancelledAt: string | null
  createdAt: string
  updatedAt: string
  allowedActions: {
    canEdit: boolean
    canCancel: boolean
  }
}

test('HeadCoach creates, edits and cancels a substitution without changing main trainers', async ({ page }) => {
  const substitutions: Substitution[] = []
  const groupUpdates: unknown[] = []
  await mockApi(page, {
    session: headCoachSession,
    substitutions,
    onGroupUpdate: (payload) => groupUpdates.push(payload),
  })

  await page.goto('/groups/group-1/edit')
  await expect(page.getByRole('heading', { name: 'Временные замещения' })).toBeVisible()
  await expect(page.getByText('Основные тренеры группы')).toBeVisible()

  await page.getByRole('button', { name: 'Назначить замещение' }).click()
  await page.getByRole('combobox', { name: 'Замещающий тренер' }).click()
  await page.getByRole('option', { name: 'Замещающий Тренер (sub)' }).click()
  await page.getByLabel('Начало периода').fill('2026-08-02')
  await page.getByLabel('Окончание периода').fill('2026-08-05')
  await page.getByRole('button', { name: 'Создать замещение' }).click()

  await expect(page.getByText('Дата начала пересекается.')).toBeVisible()
  await expect(page.getByLabel('Начало периода')).toHaveValue('2026-08-02')

  await page.getByLabel('Начало периода').fill('2026-08-10')
  await page.getByRole('button', { name: 'Создать замещение' }).click()

  const substitutionRow = page.getByTestId('group-trainer-substitution-substitution-created')
  await expect(substitutionRow.getByText('Замещающий Тренер')).toBeVisible()
  await expect(substitutionRow.getByText('по 15.08.2026 включительно')).toBeVisible()

  await page.getByRole('button', { name: /Изменить замещение Замещающий Тренер/ }).click()
  await page.getByLabel('Окончание периода').fill('2026-08-20')
  await page.getByRole('button', { name: 'Сохранить замещение' }).click()
  await expect(page.getByText('по 20.08.2026 включительно')).toBeVisible()

  await page.getByRole('button', { name: /Отменить замещение Замещающий Тренер/ }).click()
  await page.getByRole('button', { name: 'Отозвать замещение' }).click()
  await expect(page.getByText('Текущих и будущих замещений нет')).toBeVisible()

  await page.getByRole('button', { name: 'Сохранить изменения' }).click()
  await expect.poll(() => groupUpdates.length).toBe(1)
  expect(groupUpdates[0]).toMatchObject({ trainerIds: ['trainer-main'] })
})

test('Coach direct group management route is denied by app routing', async ({ page }) => {
  await mockApi(page, {
    session: coachSession,
    substitutions: [],
  })

  await page.goto('/groups/group-1/edit')

  await expect(page).toHaveURL(/\/groups\/group-1\/edit$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Нет доступа' })).toBeFocused()
  await expect(
    page.getByText('У вас нет доступа к операции «Редактирование группы».'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Открыть Посещения' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Временные замещения' })).toHaveCount(0)
})

for (const width of [320, 390, 440, 1440]) {
  test(`substitution section has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 860 })
    await mockApi(page, {
      session: headCoachSession,
      substitutions: [
        buildSubstitution({
          id: 'substitution-long',
          startsOn: '2026-08-10',
          endsOn: '2026-08-20',
        }),
      ],
    })

    await page.goto('/groups/group-1/edit')
    await expect(page.getByRole('heading', { name: 'Временные замещения' })).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.getByRole('button', { name: 'Назначить замещение' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
}

async function mockApi(
  page: Page,
  options: {
    session: typeof headCoachSession | typeof coachSession
    substitutions: Substitution[]
    onGroupUpdate?: (payload: unknown) => void
  },
) {
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const pathname = url.pathname
    const method = request.method()

    if (!pathname.startsWith('/api/')) {
      await route.continue()
      return
    }

    if (pathname === '/api/config' && method === 'GET') {
      await fulfillJson(route, 200, APP_CONFIG)
      return
    }

    if (pathname === '/api/auth/session' && method === 'GET') {
      await fulfillJson(route, 200, options.session)
      return
    }

    if (pathname === '/api/groups/group-1/trainer-substitutions' && method === 'GET') {
      await fulfillJson(route, 200, buildSubstitutionsResponse(options.substitutions))
      return
    }

    if (pathname === '/api/groups/group-1/trainer-substitutions' && method === 'POST') {
      const payload = request.postDataJSON() as {
        substituteTrainerId: string
        startsOn: string
        endsOn: string
      }

      if (payload.startsOn === '2026-08-02') {
        await fulfillJson(route, 409, {
          title: 'Conflict',
          detail: 'Период пересекается с существующим замещением.',
          code: 'group_trainer_substitution_overlap',
          errors: {
            startsOn: ['Дата начала пересекается.'],
            endsOn: ['Дата окончания пересекается.'],
          },
        }, 'application/problem+json')
        return
      }

      const substitution = buildSubstitution({
        id: 'substitution-created',
        startsOn: payload.startsOn,
        endsOn: payload.endsOn === '2026-08-05' ? '2026-08-15' : payload.endsOn,
      })
      options.substitutions.splice(0, options.substitutions.length, substitution)
      await fulfillJson(route, 201, substitution)
      return
    }

    const substitutionMatch = pathname.match(/^\/api\/groups\/group-1\/trainer-substitutions\/([^/]+)$/)
    if (substitutionMatch && method === 'PUT') {
      const payload = request.postDataJSON() as {
        substituteTrainerId: string
        startsOn: string
        endsOn: string
      }
      const updated = buildSubstitution({
        id: substitutionMatch[1],
        startsOn: payload.startsOn,
        endsOn: payload.endsOn,
      })
      options.substitutions.splice(0, options.substitutions.length, updated)
      await fulfillJson(route, 200, updated)
      return
    }

    const cancelMatch = pathname.match(/^\/api\/groups\/group-1\/trainer-substitutions\/([^/]+)\/cancel$/)
    if (cancelMatch && method === 'POST') {
      const cancelled = buildSubstitution({
        id: cancelMatch[1],
        status: 'Cancelled',
        allowedActions: { canEdit: false, canCancel: false },
      })
      options.substitutions.splice(0, options.substitutions.length)
      await fulfillJson(route, 200, cancelled)
      return
    }

    if (pathname === '/api/groups/group-1' && method === 'GET') {
      await fulfillJson(route, 200, group)
      return
    }

    if (pathname === '/api/groups/group-1' && method === 'PUT') {
      const payload = request.postDataJSON()
      options.onGroupUpdate?.(payload)
      await fulfillJson(route, 200, { ...group, ...payload })
      return
    }

    if (pathname === '/api/branches' && method === 'GET') {
      await fulfillJson(route, 200, [
        { id: 'branch-1', name: 'Центр', address: 'Адрес', isArchived: false },
      ])
      return
    }

    if (pathname === '/api/halls' && method === 'GET') {
      await fulfillJson(route, 200, [
        {
          id: 'hall-1',
          branchId: 'branch-1',
          branchName: 'Центр',
          name: 'Большой зал',
          isArchived: false,
        },
      ])
      return
    }

    if (pathname === '/api/group-types' && method === 'GET') {
      await fulfillJson(route, 200, [
        { id: 'type-1', name: 'Общая', description: null, groupCount: 1 },
      ])
      return
    }

    if (pathname === '/api/groups/options/trainers' && method === 'GET') {
      await fulfillJson(route, 200, trainerOptions)
      return
    }

    if (pathname === '/api/groups/group-1/clients' && method === 'GET') {
      await fulfillJson(route, 200, { clients: [] })
      return
    }

    if (pathname === '/api/attendance/groups' && method === 'GET') {
      await fulfillJson(route, 200, { groups: [], today: '2026-07-25', maxTrainingDate: '2026-07-25' })
      return
    }

    await fulfillJson(route, 404, { detail: `Unhandled ${method} ${pathname}` })
  })
}

function buildSubstitution(overrides: Partial<Substitution> = {}): Substitution {
  return {
    id: 'substitution-1',
    groupId: 'group-1',
    substituteTrainer: {
      id: 'trainer-substitute',
      fullName: 'Замещающий Тренер',
      login: 'sub',
      isActive: true,
    },
    startsOn: '2026-08-10',
    endsOn: '2026-08-15',
    status: 'Upcoming',
    cancelledAt: null,
    createdAt: '2026-07-25T08:00:00Z',
    updatedAt: '2026-07-25T08:00:00Z',
    allowedActions: {
      canEdit: true,
      canCancel: true,
    },
    ...overrides,
  }
}

function buildSubstitutionsResponse(substitutions: Substitution[]) {
  return {
    current: substitutions.filter((item) => item.status === 'Active' || item.status === 'Upcoming'),
    history: {
      items: substitutions.filter((item) => item.status === 'Expired' || item.status === 'Cancelled'),
      totalCount: 0,
      skip: 0,
      take: 20,
    },
    canCreate: true,
    createUnavailableReason: null,
  }
}

async function fulfillJson(
  route: Route,
  status: number,
  payload: unknown,
  contentType = 'application/json',
) {
  await route.fulfill({
    status,
    contentType,
    body: JSON.stringify(payload),
  })
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(
    () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true)
}
