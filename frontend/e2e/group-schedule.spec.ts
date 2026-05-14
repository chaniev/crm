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
    allowedSections: ['Attendance', 'Clients'],
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

type MockApiContext = {
  method: string
  pathname: string
  route: Parameters<Page['route']>[1] extends (route: infer T) => unknown
    ? T
    : never
}

type GroupState = {
  id: string
  name: string
  trainingStartTime: string
  durationMinutes: number
  weekdays: number[]
  isActive: boolean
  trainerIds: string[]
  trainerNames: string[]
  clientCount: number
}

const branch = {
  id: 'branch-1',
  name: 'Центр',
  address: 'ул. Тестовая, 1',
  description: 'Основной филиал',
  isArchived: false,
}

const hall = {
  id: 'hall-1',
  branchId: branch.id,
  branchName: branch.name,
  name: 'Основной зал',
  description: 'Зал для групп',
  isArchived: false,
  groupCount: 3,
}

const groupType = {
  id: 'group-type-1',
  name: 'Кардио',
  description: 'Групповой формат',
  systemIdentifier: 'cardio',
  groupCount: 3,
}

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
] as const

const scheduleGroups: GroupState[] = [
  {
    id: 'group-late',
    name: 'Вечерняя группа',
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
    trainingStartTime: '09:30',
    durationMinutes: 60,
    weekdays: [1],
    isActive: true,
    trainerIds: ['trainer-1', 'trainer-2'],
    trainerNames: ['Ирина Тренер', 'Артем База'],
    clientCount: 12,
  },
  {
    id: 'group-sunday',
    name: 'Воскресный интенсив',
    trainingStartTime: '10:00',
    durationMinutes: 90,
    weekdays: [7],
    isActive: true,
    trainerIds: [],
    trainerNames: [],
    clientCount: 3,
  },
]

test.describe('Расписание групповых занятий', () => {
  test('management user sees all weekdays, sorted cards and can open group edit', async ({
    page,
  }) => {
    await mockApi(page, headCoachSession, scheduleGroups)

    await page.goto('/schedule')

    await expect(page.getByTestId('schedule-screen')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Расписание' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    for (const weekday of [1, 2, 3, 4, 5, 6, 7]) {
      await expect(page.getByTestId(`schedule-day-${weekday}`)).toBeVisible()
    }

    const mondayCards = page
      .getByTestId('schedule-day-1')
      .locator('[data-testid^="schedule-card-1-"]')

    await expect(mondayCards).toHaveCount(3)
    await expect(mondayCards.nth(0)).toContainText('09:30')
    await expect(mondayCards.nth(0)).toContainText('Альфа')
    await expect(mondayCards.nth(1)).toContainText('09:30')
    await expect(mondayCards.nth(1)).toContainText('Утренняя группа')
    await expect(mondayCards.nth(2)).toContainText('19:00')
    await expect(mondayCards.nth(2)).toContainText('Вечерняя группа')

    const alphaCard = page.getByTestId('schedule-card-1-group-alpha')
    await expect(alphaCard.getByText('Кардио')).toBeVisible()
    await expect(alphaCard.getByText('60 мин')).toBeVisible()
    await expect(alphaCard.getByText('Центр · Основной зал')).toBeVisible()
    await expect(
      alphaCard.getByText('Тренеры: Ирина Тренер, Артем База'),
    ).toBeVisible()

    await expect(page.getByTestId('schedule-day-2')).toContainText('Занятий нет')
    await expect(page.getByTestId('schedule-day-count-2')).toHaveText('0')

    await alphaCard
      .getByRole('button', { name: 'Редактировать группу Альфа' })
      .click()
    await expect(page).toHaveURL('/groups/group-alpha/edit')
  })

  test('coach sees schedule navigation and read-only cards without Groups access', async ({
    page,
  }) => {
    await mockApi(page, coachSession, [scheduleGroups[1]])

    await page.goto('/schedule')

    await expect(page.getByTestId('schedule-screen')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Расписание' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.getByTestId('schedule-card-1-group-early')).toBeVisible()
    await expect(page.getByRole('button', { name: /Редактировать группу/ })).toHaveCount(0)
  })

  test('group form sends TASK-034 schedule fields and shows backend field errors', async ({
    page,
  }) => {
    let createGroupPayload: Record<string, unknown> | null = null

    await mockApi(page, headCoachSession, scheduleGroups, async ({
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
      branchId: branch.id,
      hallId: hall.id,
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
  session: typeof headCoachSession | typeof coachSession,
  groups: GroupState[],
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

    if (context.pathname === '/api/groups' && context.method === 'GET') {
      await fulfillJson(route, 200, buildGroupsListPayload(groups))
      return
    }

    if (context.pathname === '/api/groups/options/trainers' && context.method === 'GET') {
      await fulfillJson(route, 200, trainers)
      return
    }

    if (context.pathname === '/api/branches' && context.method === 'GET') {
      await fulfillJson(route, 200, [toBranchPayload()])
      return
    }

    if (context.pathname === '/api/halls' && context.method === 'GET') {
      await fulfillJson(route, 200, [toHallPayload()])
      return
    }

    if (context.pathname === '/api/group-types' && context.method === 'GET') {
      await fulfillJson(route, 200, [toGroupTypePayload()])
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
    branchId: branch.id,
    branchName: branch.name,
    hallId: hall.id,
    hallName: hall.name,
    groupTypeId: groupType.id,
    groupTypeName: groupType.name,
    groupTypeSystemIdentifier: groupType.systemIdentifier,
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

function toBranchPayload() {
  return {
    ...branch,
    hallCount: 1,
    groupCount: 3,
    clientCount: 0,
    createdAt: '2026-05-13T09:00:00Z',
    updatedAt: '2026-05-13T09:00:00Z',
  }
}

function toHallPayload() {
  return {
    ...hall,
    createdAt: '2026-05-13T09:00:00Z',
    updatedAt: '2026-05-13T09:00:00Z',
  }
}

function toGroupTypePayload() {
  return {
    ...groupType,
    createdAt: '2026-05-13T09:00:00Z',
    updatedAt: '2026-05-13T09:00:00Z',
  }
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
