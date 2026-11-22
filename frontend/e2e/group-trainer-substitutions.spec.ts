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
  trainerAssignmentRevision: 'assignment-revision-group-1',
  trainerAssignmentPeriods: [
    {
      trainerId: 'trainer-main',
      trainerName: 'Основной Тренер',
      validFrom: '2026-08-23',
      validTo: null,
    },
  ],
  createdAt: '2026-07-01T10:00:00Z',
  updatedAt: '2026-07-20T10:00:00Z',
} as const

const trainerOptions = [
  { id: 'trainer-main', fullName: 'Основной Тренер', login: 'main' },
  { id: 'trainer-substitute', fullName: 'Анастасия Александровна Миронова-Лебедева', login: 'sub' },
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

test('assigns after resolving a conflict, distinguishes legacy data and confirms revocation', async ({ page }) => {
  await mockApi(page, { session: headCoachSession, substitutions: [buildSubstitution({ id: 'legacy' })], overlap: true })
  await page.goto('/groups/group-1/edit')
  const section = page.getByRole('region', { name: 'Временные замещения' })
  const assign = section.getByRole('button', { name: 'Назначить на период' })
  await assign.click()
  await page.keyboard.press('Escape')
  await expect(assign).toBeFocused()
  await assign.click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Замещающий тренер').selectOption('trainer-substitute')
  await dialog.getByLabel('Дата начала').fill('2026-12-10')
  await dialog.getByLabel('Дата окончания').fill('2026-12-15')
  await expect(dialog).toContainText('Миронова-Лебедева получит доступ к группе «Юниоры 18:00»')
  await dialog.getByRole('button', { name: 'Назначить', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Проверьте период')
  await expect(dialog.getByLabel('Дата начала')).toHaveValue('2026-12-10')
  await expect(dialog.getByLabel('Замещающий тренер')).toHaveValue('trainer-substitute')
  await dialog.getByLabel('Дата окончания').fill('2026-12-14')
  await dialog.getByRole('button', { name: 'Назначить', exact: true }).click()
  await expect(section.getByRole('status')).toContainText('Замещение назначено.')
  await expect(assign).toBeFocused()
  const cancel = section.getByRole('button', { name: /Отменить замещение Анастасия/ })
  await expect(section.getByRole('list', { name: 'Текущие и будущие' })).toContainText('10.12.2026 — 14.12.2026')
  await section.getByRole('button', { name: 'Показать историю' }).click()
  const history = section.getByRole('list', { name: 'История замещений' })
  await expect(history).toContainText('Архивная запись. Доступ к группе не предоставляется.')
  await expect(history.getByRole('button')).toHaveCount(0)
  await cancel.click()
  await expect(dialog).toContainText('Отмена прекращает доступ по этому назначению.')
  await dialog.getByRole('button', { name: 'Оставить' }).click()
  await expect(cancel).toBeFocused()
  await cancel.click()
  await dialog.getByRole('button', { name: 'Отменить замещение' }).click()
  await expect(section.getByRole('heading', { name: 'Временные замещения' })).toBeFocused()
  await expect(section.getByRole('status')).toContainText('Замещение отменено.')
  await expect(cancel).toHaveCount(0)
  await expect(history).toContainText('Отменено')
  await expectNoHorizontalOverflow(page)
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

test('section, confirmation and date fields fit the desktop, narrow and compact-height layouts', async ({ page, browserName }) => {
  await mockApi(page, { session: headCoachSession, substitutions: [] })
  await page.goto('/groups/group-1/edit')
  const sizes = browserName === 'chromium'
    ? [[360, 780], [390, 844], [420, 912], [440, 956], [768, 1024], [1440, 1200], [912, 420], [956, 440]]
    : []
  const verifyDialog = async () => {
    const assign = page.getByRole('button', { name: 'Назначить на период' })
    await assign.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel('Замещающий тренер')).toBeFocused()
    await dialog.getByLabel('Замещающий тренер').selectOption('trainer-substitute')
    await expect(dialog).toContainText('Анастасия Александровна Миронова-Лебедева получит доступ')
    await expectNoHorizontalOverflow(page)
    const controls = dialog.locator('input, select, button')
    for (const target of await controls.all()) {
      const bounds = await target.boundingBox()
      expect(bounds?.height).toBeGreaterThanOrEqual(44)
      expect(bounds?.width).toBeGreaterThanOrEqual(44)
    }
    await dialog.getByRole('button', { name: 'Назначить', exact: true }).scrollIntoViewIfNeeded()
    await dialog.getByRole('button', { name: 'Закрыть', exact: true }).last().click()
    await expect(assign).toBeFocused()
  }
  if (!sizes.length) await verifyDialog()
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height })
    await verifyDialog()
  }
})

async function mockApi(
  page: Page,
  options: {
    session: typeof headCoachSession | typeof coachSession
    substitutions: Substitution[]
    overlap?: boolean
  },
) {
  const periods: Substitution[] = []
  let overlap = options.overlap
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

    if (pathname.endsWith('/lesson-series') && method === 'GET') {
      await fulfillJson(route, 404, { title: 'Расписание не найдено', code: 'lesson-series-not-found' })
      return
    }

    const periodsPath = '/api/groups/group-1/trainer-substitution-periods'
    if (pathname === periodsPath && method === 'GET') {
      await fulfillJson(route, 200, { ...buildSubstitutionsResponse(periods), canCreate: true, createUnavailableReason: null })
      return
    }
    if (pathname === periodsPath && method === 'POST') {
      expect(request.headers()['x-csrf-token']).toBe(options.session.csrfToken)
      const payload = request.postDataJSON()
      expect(payload.substituteTrainerId).toBe('trainer-substitute')
      if (overlap) {
        overlap = false
        await fulfillJson(route, 409, { code: 'group_trainer_substitution_overlap', detail: 'Проверьте период или выберите другого тренера.' })
        return
      }
      const row = buildSubstitution({
        id: 'period-1', startsOn: payload.startsOn, endsOn: payload.endsOn,
        substituteTrainer: { ...trainerOptions[1], isActive: true }, allowedActions: { canEdit: false, canCancel: true },
      })
      periods.push(row)
      await fulfillJson(route, 201, row)
      return
    }
    if (pathname === `${periodsPath}/period-1/cancel` && method === 'POST') {
      expect(request.headers()['x-csrf-token']).toBe(options.session.csrfToken)
      periods[0] = { ...periods[0], status: 'Cancelled', allowedActions: { canEdit: false, canCancel: false } }
      await fulfillJson(route, 200, periods[0])
      return
    }

    if (pathname === '/api/groups/group-1/trainer-substitutions' && method === 'GET') {
      await fulfillJson(route, 200, buildSubstitutionsResponse(options.substitutions))
      return
    }

    if (pathname === '/api/groups/group-1' && method === 'GET') {
      await fulfillJson(route, 200, group)
      return
    }

    if (pathname === '/api/groups/group-1' && method === 'PUT') {
      const payload = request.postDataJSON()
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
      totalCount: substitutions.filter((item) => item.status === 'Expired' || item.status === 'Cancelled').length,
      skip: 0,
      take: 20,
    },
    canCreate: false,
    createUnavailableReason: {
      code: 'legacy_group_date_substitution_disabled',
      message: 'Периодные замещения доступны только для просмотра.',
    },
  }
}

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() =>
    page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true)
}
