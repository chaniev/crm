import { expect, test, type Page } from '@playwright/test'

const headCoachSession = {
  isAuthenticated: true,
  csrfToken: 'headcoach-schedule-csrf',
  bootstrapMode: false,
  user: {
    id: 'headcoach-id',
    fullName: 'Главный тренер',
    login: 'headcoach',
    role: 'HeadCoach',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Home',
    allowedSections: ['Home', 'Attendance', 'Clients', 'Groups', 'Users', 'Audit', 'Settings'],
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

const coachSession = {
  isAuthenticated: true,
  csrfToken: 'coach-schedule-csrf',
  bootstrapMode: false,
  user: {
    id: 'coach-id',
    fullName: 'Назначенный тренер',
    login: 'coach',
    role: 'Coach',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Attendance',
    allowedSections: ['Schedule', 'Attendance', 'Clients'],
    permissions: {
      canManageUsers: false,
      canManageClients: false,
      canManageGroups: false,
      canManageSettings: false,
      canMarkAttendance: true,
      canViewAuditLog: false,
      canViewFinancialReports: false,
    },
    assignedGroupIds: ['group-early'],
  },
} as const

const administratorSession = {
  isAuthenticated: true,
  csrfToken: 'administrator-schedule-csrf',
  bootstrapMode: false,
  user: {
    id: 'administrator-id',
    fullName: 'Администратор',
    login: 'administrator',
    role: 'Administrator',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Schedule',
    allowedSections: ['Schedule', 'Attendance', 'Clients', 'Groups'],
    permissions: {
      canManageUsers: false,
      canManageClients: true,
      canManageGroups: true,
      canManageSettings: false,
      canMarkAttendance: true,
      canViewAuditLog: false,
      canViewFinancialReports: false,
    },
    assignedGroupIds: [],
  },
} as const

type MockApiContext = {
  method: string
  pathname: string
  route: Parameters<Page['route']>[1] extends (route: infer T) => unknown
    ? T
    : never
}

type RequestStats = {
  groupsCollectionGetCalls: number
  scheduleGroupsGetCalls: number
}

type GroupState = {
  id: string
  name: string
  branchId: string
  branchName: string
  hallId: string
  hallName: string
  groupTypeId: string
  groupTypeName: string
  groupTypeSystemIdentifier: string
  trainingStartTime: string
  durationMinutes: number
  weekdays: number[]
  isActive: boolean
  trainerIds: string[]
  trainerNames: string[]
  clientCount: number
}

const branches = [
  {
    id: 'branch-1',
    name: 'Центр',
    address: 'ул. Тестовая, 1',
    description: 'Основной филиал',
    isArchived: false,
  },
  {
    id: 'branch-2',
    name: 'Север',
    address: 'пр-т Северный, 12',
    description: 'Филиал на севере',
    isArchived: false,
  },
] as const

const halls = [
  {
    id: 'hall-1',
    branchId: 'branch-1',
    branchName: 'Центр',
    name: 'Основной зал',
    description: 'Зал для групп',
    isArchived: false,
    groupCount: 3,
  },
  {
    id: 'hall-2',
    branchId: 'branch-2',
    branchName: 'Север',
    name: 'Loft',
    description: 'Северный зал',
    isArchived: false,
    groupCount: 1,
  },
] as const

const groupTypes = [
  {
    id: 'group-type-1',
    name: 'Кардио',
    description: 'Групповой формат',
    systemIdentifier: 'cardio',
    groupCount: 2,
  },
  {
    id: 'group-type-2',
    name: 'База',
    description: 'Базовый поток',
    systemIdentifier: 'basics',
    groupCount: 1,
  },
  {
    id: 'group-type-3',
    name: 'Интенсив',
    description: 'Интенсивный формат',
    systemIdentifier: 'intensive',
    groupCount: 1,
  },
] as const

const groupType = groupTypes[0]

const trainers = [
  {
    id: 'trainer-1',
    fullName: 'Ирина Тренер',
    login: 'irina',
  },
  {
    id: 'trainer-2',
    fullName: 'Артем База',
    login: 'artem',
  },
  {
    id: 'trainer-3',
    fullName: 'Ольга Север',
    login: 'olga',
  },
] as const

const scheduleGroups: GroupState[] = [
  {
    id: 'group-late',
    name: 'Вечерняя группа',
    branchId: 'branch-1',
    branchName: 'Центр',
    hallId: 'hall-1',
    hallName: 'Основной зал',
    groupTypeId: groupTypes[0].id,
    groupTypeName: groupTypes[0].name,
    groupTypeSystemIdentifier: groupTypes[0].systemIdentifier,
    trainingStartTime: '19:00',
    durationMinutes: 60,
    weekdays: [1, 3],
    isActive: true,
    trainerIds: ['trainer-1'],
    trainerNames: ['Ирина Тренер'],
    clientCount: 9,
  },
  {
    id: 'group-early',
    name: 'Утренняя группа',
    branchId: 'branch-1',
    branchName: 'Центр',
    hallId: 'hall-1',
    hallName: 'Основной зал',
    groupTypeId: groupTypes[1].id,
    groupTypeName: groupTypes[1].name,
    groupTypeSystemIdentifier: groupTypes[1].systemIdentifier,
    trainingStartTime: '09:30',
    durationMinutes: 45,
    weekdays: [1, 4],
    isActive: true,
    trainerIds: ['trainer-2'],
    trainerNames: ['Артем База'],
    clientCount: 5,
  },
  {
    id: 'group-alpha',
    name: 'Альфа',
    branchId: 'branch-1',
    branchName: 'Центр',
    hallId: 'hall-1',
    hallName: 'Основной зал',
    groupTypeId: groupTypes[0].id,
    groupTypeName: groupTypes[0].name,
    groupTypeSystemIdentifier: groupTypes[0].systemIdentifier,
    trainingStartTime: '09:30',
    durationMinutes: 60,
    weekdays: [1],
    isActive: false,
    trainerIds: ['trainer-1', 'trainer-2'],
    trainerNames: ['Ирина Тренер', 'Артем База'],
    clientCount: 12,
  },
  {
    id: 'group-sunday',
    name: 'Воскресный интенсив',
    branchId: 'branch-2',
    branchName: 'Север',
    hallId: 'hall-2',
    hallName: 'Loft',
    groupTypeId: groupTypes[2].id,
    groupTypeName: groupTypes[2].name,
    groupTypeSystemIdentifier: groupTypes[2].systemIdentifier,
    trainingStartTime: '10:00',
    durationMinutes: 90,
    weekdays: [7],
    isActive: true,
    trainerIds: ['trainer-3'],
    trainerNames: ['Ольга Север'],
    clientCount: 3,
  },
]

test.describe('Расписание групповых занятий', () => {
  test('desktop shows weekly calendar grid, overlapping cards, combined filters and reset', async ({
    page,
  }) => {
    const requestStats = createRequestStats()

    await installScheduleClock(page)
    await mockApi(page, headCoachSession, scheduleGroups, requestStats)
    await page.goto('/schedule')

    await expect(page.getByTestId('schedule-screen')).toBeVisible()
    await expect(page.getByTestId('schedule-calendar-grid')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Расписание' })).toBeVisible()
    await expect(page.getByTestId('schedule-auto-refresh-status')).toContainText(
      'Обновляется автоматически',
    )
    await expect(page.getByRole('button', { name: 'Расписание' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.getByRole('button', { name: 'Сегодня' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Предыдущ/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Следующ/i })).toHaveCount(0)
    await expect(page.getByText(/12\s*[—-]\s*18\s+мая/)).toHaveCount(0)

    for (const weekday of [1, 2, 3, 4, 5, 6, 7]) {
      await expect(page.getByTestId(`schedule-day-header-${weekday}`)).toBeVisible()
      await expect(page.getByTestId(`schedule-day-${weekday}`)).toBeVisible()
    }
    await expect(page.getByTestId('schedule-day-header-1')).toHaveAttribute(
      'data-current',
      'true',
    )
    await expect(page.getByTestId('schedule-day-1')).toHaveAttribute(
      'data-current',
      'true',
    )
    await expect(page.getByTestId('schedule-day-count-1')).toHaveText('3 занятия')
    await expect(page.getByTestId('schedule-day-count-7')).toHaveText('1 занятие')

    await expect(page.getByTestId('schedule-overview')).toBeVisible()
    await expect(page.getByTestId('schedule-today-summary')).toContainText('3')
    await expect(page.getByTestId('schedule-today-type-summary')).toContainText('Кардио')
    await expect(page.getByTestId('schedule-today-type-summary')).toContainText('База')
    await expect(page.getByTestId('schedule-hall-load')).toContainText('Основной зал')
    await expect(page.getByTestId('schedule-hall-load')).toContainText('3 занятия')
    await expect(page.getByTestId('schedule-type-legend')).toContainText('Кардио')
    await expect(page.getByTestId('schedule-type-legend')).toContainText('База')
    await expect(page.getByTestId('schedule-type-legend')).toContainText('Интенсив')

    const mondayAlphaCard = page.getByTestId('schedule-card-1-group-alpha')
    const mondayMorningCard = page.getByTestId('schedule-card-1-group-early')
    const mondayEveningCard = page.getByTestId('schedule-card-1-group-late')

    await expect(mondayAlphaCard).toContainText('09:30')
    await expect(mondayAlphaCard).toContainText('Альфа')
    await expect(mondayAlphaCard).toContainText('Кардио')
    await expect(mondayAlphaCard).toContainText('Основной зал')
    await expect(mondayAlphaCard).toContainText('12 участников')
    await expect(mondayAlphaCard).toContainText('Неактивна')
    await expect(mondayAlphaCard).toHaveAttribute('data-schedule-type', 'cardio')
    await expect(page.getByRole('button', { name: /Редактировать группу/i })).toHaveCount(0)

    const alphaBox = await mondayAlphaCard.boundingBox()
    const morningBox = await mondayMorningCard.boundingBox()

    expect(alphaBox).not.toBeNull()
    expect(morningBox).not.toBeNull()
    expect(alphaBox?.x).not.toBe(morningBox?.x)
    await expect(mondayEveningCard).toContainText('19:00 - 20:00')

    await selectOption(page, 'Филиал', 'Север')
    await selectOption(page, 'Зал', 'Loft · Север')
    await selectOption(page, 'Тренер', 'Ольга Север')
    await selectOption(page, 'Группа', 'Воскресный интенсив')

    await expect(page.getByTestId('schedule-card-7-group-sunday')).toBeVisible()
    await expect(page.getByTestId('schedule-card-1-group-alpha')).toHaveCount(0)
    await expect(page.getByTestId('schedule-type-legend')).toContainText('Интенсив')

    await page.getByRole('button', { name: 'Сбросить фильтры' }).click()
    await expect(page.getByTestId('schedule-card-1-group-alpha')).toBeVisible()
    expect(requestStats.scheduleGroupsGetCalls).toBeGreaterThan(0)
    expect(requestStats.groupsCollectionGetCalls).toBe(0)
  })

  test('coach uses /api/schedule/groups and sees read-only full schedule dataset', async ({
    page,
  }) => {
    const requestStats = createRequestStats()

    await installScheduleClock(page)
    await mockApi(page, coachSession, scheduleGroups, requestStats)
    await page.goto('/schedule')

    await expect(page.getByTestId('schedule-screen')).toBeVisible()
    await expect(page.getByTestId('schedule-calendar-grid')).toBeVisible()
    await expect(page.getByTestId('schedule-card-1-group-alpha')).toBeVisible()
    await expect(page.getByTestId('schedule-card-7-group-sunday')).toBeVisible()
    await expect(page.getByTestId('schedule-day-header-1')).toHaveAttribute(
      'data-current',
      'true',
    )
    await expect(page.getByRole('button', { name: 'Сегодня' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Редактировать группу/i })).toHaveCount(0)

    expect(requestStats.scheduleGroupsGetCalls).toBeGreaterThan(0)
    expect(requestStats.groupsCollectionGetCalls).toBe(0)
  })

  test('administrator sees the same read-only schedule mockup', async ({ page }) => {
    const requestStats = createRequestStats()

    await installScheduleClock(page)
    await mockApi(page, administratorSession, scheduleGroups, requestStats)
    await page.goto('/schedule')

    await expect(page.getByTestId('schedule-screen')).toBeVisible()
    await expect(page.getByTestId('schedule-calendar-grid')).toBeVisible()
    await expect(page.getByTestId('schedule-card-1-group-alpha')).toBeVisible()
    await expect(page.getByTestId('schedule-type-legend')).toBeVisible()
    await expect(page.getByRole('button', { name: /Редактировать группу/i })).toHaveCount(0)

    expect(requestStats.scheduleGroupsGetCalls).toBeGreaterThan(0)
    expect(requestStats.groupsCollectionGetCalls).toBe(0)
  })

  test('mobile shows selected-day list with segmented control', async ({ page }) => {
    const requestStats = createRequestStats()

    await installScheduleClock(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await mockApi(page, headCoachSession, scheduleGroups, requestStats)
    await page.goto('/schedule')

    await expect(page.getByTestId('schedule-mobile-day-list')).toBeVisible()
    await expect(page.getByTestId('schedule-calendar-grid')).toHaveCount(0)
    await expect(page.getByTestId('schedule-mobile-day-1')).toContainText('Альфа')
    await expect(page.getByTestId('schedule-mobile-day-1')).toContainText('Утренняя группа')

    await page.getByText('Вс').click()
    await expect(page.getByTestId('schedule-mobile-day-7')).toContainText(
      'Воскресный интенсив',
    )
    await expect(page.getByTestId('schedule-day-count-7')).toHaveText('1 занятие')

    const dimensions = await page.evaluate(() => ({
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }))

    expect(dimensions.documentScrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
    expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)

    expect(requestStats.scheduleGroupsGetCalls).toBeGreaterThan(0)
  })

  test('group form sends TASK-034 schedule fields and shows backend field errors', async ({
    page,
  }) => {
    let createGroupPayload: Record<string, unknown> | null = null

    await mockApi(page, headCoachSession, scheduleGroups, createRequestStats(), async ({
      pathname,
      method,
      route,
    }) => {
      if (pathname === '/api/groups' && method === 'POST') {
        const payload = route.request().postDataJSON()
        createGroupPayload = payload

        await fulfillJson(route, 400, {
          title: 'Validation failed',
          detail: 'Проверьте расписание группы.',
          errors: {
            DurationMinutes: ['Укажите длительность занятия.'],
            Weekdays: ['Выберите хотя бы один день недели.'],
          },
        })
        return true
      }

      return false
    })

    await page.goto('/groups/new')
    await page.getByLabel('Название группы').fill('Группа с ошибкой расписания')
    await page.getByLabel('Время начала').fill('18:00')
    await page.getByRole('combobox', { name: 'Зал' }).click()
    await page.getByRole('option', { name: 'Основной зал' }).click()
    await page.getByRole('button', { name: 'Создать группу' }).click()

    await expect.poll(() => createGroupPayload).toEqual({
      name: 'Группа с ошибкой расписания',
      branchId: 'branch-1',
      hallId: 'hall-1',
      groupTypeId: groupType.id,
      trainingStartTime: '18:00',
      durationMinutes: null,
      weekdays: [],
      isActive: true,
      trainerIds: [],
    })
    expect(createGroupPayload).not.toHaveProperty('scheduleText')
    await expect(page.getByText('Укажите длительность занятия.')).toBeVisible()
    await expect(page.getByText('Выберите хотя бы один день недели.')).toBeVisible()
  })
})

async function mockApi(
  page: Page,
  session: typeof headCoachSession | typeof coachSession | typeof administratorSession,
  groups: GroupState[],
  requestStats: RequestStats,
  override?: (context: MockApiContext) => Promise<boolean>,
) {
  await page.route('**/api/**', async (route) => {
    const requestUrl = new URL(route.request().url())

    if (!requestUrl.pathname.startsWith('/api/')) {
      await route.continue()
      return
    }

    const context = {
      method: route.request().method(),
      pathname: requestUrl.pathname,
      route,
    } satisfies MockApiContext

    if (override && await override(context)) {
      return
    }

    if (context.pathname === '/api/auth/session' && context.method === 'GET') {
      await fulfillJson(route, 200, session)
      return
    }

    if (context.pathname === '/api/schedule/groups' && context.method === 'GET') {
      requestStats.scheduleGroupsGetCalls += 1
      await fulfillJson(route, 200, buildGroupsListPayload(groups))
      return
    }

    if (context.pathname === '/api/groups' && context.method === 'GET') {
      requestStats.groupsCollectionGetCalls += 1
      await fulfillJson(route, 200, buildGroupsListPayload(groups))
      return
    }

    if (context.pathname === '/api/groups/options/trainers' && context.method === 'GET') {
      await fulfillJson(route, 200, trainers)
      return
    }

    if (context.pathname === '/api/branches' && context.method === 'GET') {
      await fulfillJson(route, 200, branches.map(toBranchPayload))
      return
    }

    if (context.pathname === '/api/halls' && context.method === 'GET') {
      await fulfillJson(route, 200, halls.map(toHallPayload))
      return
    }

    if (context.pathname === '/api/group-types' && context.method === 'GET') {
      await fulfillJson(route, 200, groupTypes.map(toGroupTypePayload))
      return
    }

    if (
      context.pathname.startsWith('/api/groups/') &&
      context.pathname.endsWith('/clients') &&
      context.method === 'GET'
    ) {
      await fulfillJson(route, 200, { clients: [] })
      return
    }

    if (context.pathname.startsWith('/api/groups/') && context.method === 'GET') {
      const groupId = context.pathname.slice('/api/groups/'.length)
      const group = groups.find((item) => item.id === groupId)

      if (!group) {
        await fulfillJson(route, 404, { detail: 'Группа не найдена.' })
        return
      }

      await fulfillJson(route, 200, toGroupPayload(group))
      return
    }

    throw new Error(
      `Unexpected API request in group schedule e2e: ${context.method} ${context.pathname}`,
    )
  })
}

function createRequestStats(): RequestStats {
  return {
    groupsCollectionGetCalls: 0,
    scheduleGroupsGetCalls: 0,
  }
}

async function installScheduleClock(page: Page) {
  await page.clock.install({
    time: new Date('2026-05-11T10:30:00'),
  })
}

function buildGroupsListPayload(groups: GroupState[]) {
  return {
    items: groups.map(toGroupPayload),
    totalCount: groups.length,
    skip: 0,
    take: 100,
  }
}

function toGroupPayload(group: GroupState) {
  return {
    id: group.id,
    name: group.name,
    branchId: group.branchId,
    branchName: group.branchName,
    hallId: group.hallId,
    hallName: group.hallName,
    groupTypeId: group.groupTypeId,
    groupTypeName: group.groupTypeName,
    groupTypeSystemIdentifier: group.groupTypeSystemIdentifier,
    trainingStartTime: group.trainingStartTime,
    durationMinutes: group.durationMinutes,
    weekdays: group.weekdays,
    isActive: group.isActive,
    trainers: group.trainerIds.map((trainerId) => {
      const trainer = trainers.find((item) => item.id === trainerId)

      return {
        id: trainerId,
        fullName: trainer?.fullName ?? trainerId,
        login: trainer?.login ?? trainerId,
      }
    }),
    trainerIds: group.trainerIds,
    trainerCount: group.trainerIds.length,
    trainerNames: group.trainerNames,
    clientCount: group.clientCount,
    updatedAt: '2026-05-13T09:00:00Z',
    createdAt: '2026-05-13T09:00:00Z',
  }
}

function toBranchPayload(branch: typeof branches[number]) {
  return {
    ...branch,
    hallCount: halls.filter((hall) => hall.branchId === branch.id).length,
    groupCount: scheduleGroups.filter((group) => group.branchId === branch.id).length,
    clientCount: 0,
    createdAt: '2026-05-13T09:00:00Z',
    updatedAt: '2026-05-13T09:00:00Z',
  }
}

function toHallPayload(hall: typeof halls[number]) {
  return {
    ...hall,
    createdAt: '2026-05-13T09:00:00Z',
    updatedAt: '2026-05-13T09:00:00Z',
  }
}

function toGroupTypePayload(item: typeof groupTypes[number]) {
  return {
    ...item,
    createdAt: '2026-05-13T09:00:00Z',
    updatedAt: '2026-05-13T09:00:00Z',
  }
}

async function selectOption(page: Page, label: string, optionName: string) {
  await page.getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name: optionName }).click()
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
