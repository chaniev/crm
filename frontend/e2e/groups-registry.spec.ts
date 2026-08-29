import { expect, test, type Page } from '@playwright/test'

const APP_CONFIG = {
  clubName: 'Gym CRM',
  themeId: 'default-green-v1',
  authBackgroundImageId: 'k4pro-login-v1',
} as const

const headCoachSession = {
  isAuthenticated: true,
  csrfToken: 'groups-registry-csrf',
  bootstrapMode: false,
  user: {
    id: 'headcoach-id',
    fullName: 'Главный тренер',
    login: 'headcoach',
    role: 'HeadCoach',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Attention',
    allowedSections: ['Attendance', 'Attention', 'Schedule', 'Clients', 'Groups'],
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
    branchId: 'branch-1',
  },
} as const

const coachReadOnlySession = {
  ...headCoachSession,
  user: {
    ...headCoachSession.user,
    id: 'coach-readonly-id',
    fullName: 'Тренер без управления группами',
    login: 'coach-readonly',
    role: 'Coach',
    landingScreen: 'Attendance',
    allowedSections: ['Attendance', 'Schedule', 'Clients'],
    permissions: {
      ...headCoachSession.user.permissions,
      canManageGroups: false,
      canManageUsers: false,
    canManageSettings: false,
    },
    branchId: 'branch-1',
  },
} as const

const administratorSession = {
  ...headCoachSession,
  user: {
    ...headCoachSession.user,
    id: 'administrator-id',
    fullName: 'Администратор',
    login: 'administrator',
    role: 'Administrator',
    permissions: {
      ...headCoachSession.user.permissions,
      canManageUsers: true,
      canViewFinancialReports: true,
    },
    allowedSections: ['Attendance', 'Attention', 'Schedule', 'Clients', 'Groups', 'Users', 'Audit', 'Settings'],
    branchId: 'branch-1',
  },
} as const

const superAdministratorSession = {
  ...headCoachSession,
  user: {
    ...headCoachSession.user,
    id: 'superadministrator-id',
    fullName: 'Суперадминистратор',
    login: 'superadministrator',
    role: 'SuperAdministrator',
    permissions: {
      ...headCoachSession.user.permissions,
      canManageUsers: true,
      canViewFinancialReports: true,
    },
    allowedSections: ['Attendance', 'Attention', 'Schedule', 'Clients', 'Groups', 'Users', 'Audit', 'Finance', 'Settings'],
    branchId: null,
  },
} as const

type GroupData = {
  id: string
  name: string
  branchId: string
  branchName: string
  hallId: string
  hallName: string
  groupTypeId: string
  groupTypeName: string
  trainingStartTime: string
  durationMinutes: number
  weekdays: number[]
  trainerIds: string[]
  trainerNames: string[]
  isActive: boolean
  clientCount: number
}

type GroupsSession =
  | typeof headCoachSession
  | typeof coachReadOnlySession
  | typeof administratorSession
  | typeof superAdministratorSession

const SCOPE_PROBE_GROUPS: GroupData[] = [
  {
    id: 'group-scope-branch-1',
    name: 'Группа филиала Центр',
    branchId: 'branch-1',
    branchName: 'Центр',
    hallId: 'hall-1',
    hallName: 'Основной зал',
    groupTypeId: 'group-type-1',
    groupTypeName: 'Базовый',
    trainingStartTime: '18:00',
    durationMinutes: 60,
    weekdays: [2, 4],
    trainerIds: ['trainer-1'],
    trainerNames: ['Тренер'],
    isActive: true,
    clientCount: 12,
  },
  {
    id: 'group-scope-branch-2',
    name: 'Группа филиала Восток',
    branchId: 'branch-2',
    branchName: 'Восток',
    hallId: 'hall-2',
    hallName: 'Зал Восток',
    groupTypeId: 'group-type-1',
    groupTypeName: 'Базовый',
    trainingStartTime: '18:00',
    durationMinutes: 60,
    weekdays: [2, 4],
    trainerIds: ['trainer-1'],
    trainerNames: ['Тренер'],
    isActive: true,
    clientCount: 12,
  },
] as const

const registryGroups: GroupData[] = [
  ...SCOPE_PROBE_GROUPS,
  ...Array.from({ length: 36 }, (_, index) => {
  const id = index + 1
  const withoutTrainer = id % 3 === 0

  return {
    id: `group-${id}`,
    name: `Группа ${id}`,
    branchId: 'branch-1',
    branchName: 'Центр',
    hallId: 'hall-1',
    hallName: 'Основной зал',
    groupTypeId: 'group-type-1',
    groupTypeName: 'Базовый',
    trainingStartTime: '18:00',
    durationMinutes: 60,
    weekdays: [2, 4],
    trainerIds: withoutTrainer ? [] : ['trainer-1'],
    trainerNames: withoutTrainer ? [] : ['Тренер'],
    isActive: id % 2 === 0,
    clientCount: 8,
  }
}),
] as const

const BRANCHES = [
  {
    id: 'branch-1',
    name: 'Центр',
    address: null,
    description: 'Основной филиал',
    isArchived: false,
    hallCount: 1,
    groupCount: 38,
    clientCount: 0,
  },
  {
    id: 'branch-2',
    name: 'Восток',
    address: null,
    description: 'Филиал Восток',
    isArchived: false,
    hallCount: 1,
    groupCount: 2,
    clientCount: 0,
  },
] as const

const HALLS = [
  {
    id: 'hall-1',
    branchId: 'branch-1',
    branchName: 'Центр',
    name: 'Основной зал',
    description: 'Основной зал',
    isArchived: false,
    groupCount: 36,
  },
  {
    id: 'hall-2',
    branchId: 'branch-2',
    branchName: 'Восток',
    name: 'Зал Восток',
    description: 'Зал филиала Восток',
    isArchived: false,
    groupCount: 2,
  },
] as const

const GROUP_TYPES = [
  {
    id: 'group-type-1',
    name: 'Базовый',
    description: 'Базовый',
    groupCount: 38,
  },
] as const

const TRAINER_OPTIONS = [
  {
    id: 'trainer-1',
    fullName: 'Тренер',
    login: 'trainer-1',
  },
] as const

const TRAINER_SUBSTITUTIONS_RESPONSE = {
  canCreate: false,
  createUnavailableReason: null,
  current: [],
  history: {
    items: [],
    totalCount: 0,
    skip: 0,
    take: 20,
  },
} as const

type ListRequestRecord = {
  page: number
  pageSize: number
  query?: string
  isActive?: boolean
  withoutTrainer?: boolean
}

type RequestCounters = {
  groupsListCalls: number
  groupCreateCalls?: number
  groupGetCalls: number
  groupPreviewCalls?: number
  groupTrainerAssignmentExecuteCalls?: number
  groupTrainerAssignmentPreviewCalls?: number
  groupPutCalls: number
  lastCreatePayload?: unknown
  lastPreviewPayload?: unknown
  lastTrainerAssignmentExecutePayload?: unknown
  lastTrainerAssignmentPreviewPayload?: unknown
  lastUpdatePayload: Record<string, unknown> | null
}

type MockFailureState = {
  active: boolean
}

type MockResponseContext = {
  method: string
  pathname: string
  searchParams: URLSearchParams
  route: Parameters<Page['route']>[1] extends (route: infer T) => unknown
    ? T
    : never
}

test('Группы: поиск, без тренера, статус и пагинация строят корректные параметры /api/groups', async ({ page }) => {
  const listRequests: ListRequestRecord[] = []
  const counters: RequestCounters = {
    groupsListCalls: 0,
    groupGetCalls: 0,
    groupPutCalls: 0,
    lastUpdatePayload: null,
  }

  await mockApi(page, {
    session: headCoachSession,
    listRequests,
    counters,
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/groups')

  await expect(page.getByRole('heading', { name: 'Группы' })).toBeVisible()
  await expect(page.getByTestId('groups-list')).toBeVisible()
  await expect(page.getByTestId('groups-summary-bar')).toHaveCount(0)
  const firstEditButton = page.locator('[data-group-edit-action="true"]').first()
  const firstEditButtonBox = await firstEditButton.boundingBox()
  expect(firstEditButtonBox).not.toBeNull()
  expect(firstEditButtonBox!.height).toBeGreaterThanOrEqual(44)
  expect(firstEditButtonBox!.width).toBeGreaterThanOrEqual(44)
  await expectNoHorizontalOverflow(page)

  await expect.poll(() => listRequests.length).toBeGreaterThanOrEqual(1)
  expect(listRequests.at(-1)).toEqual({ page: 1, pageSize: 10 })

  const search = page.getByRole('textbox', { name: 'Поиск групп по названию' })
  await search.fill('Группа 2')

  await expect.poll(() => listRequests.at(-1)?.query).toBe('Группа 2')
  expect(listRequests.at(-1)).toMatchObject({
    page: 1,
    pageSize: 10,
    query: 'Группа 2',
  })

  await page.getByRole('button', { name: 'Открыть фильтры' }).click()
  await page.getByRole('combobox', { name: 'Статус' }).click()
  await page.getByRole('option', { name: 'Неактивные' }).click()

  await expect.poll(() => listRequests.at(-1)?.isActive).toBe(false)
  expect(listRequests.at(-1)).toMatchObject({
    page: 1,
    pageSize: 10,
    isActive: false,
  })

  await page.getByRole('switch', { name: 'Без тренера' }).click()

  await expect.poll(() => listRequests.at(-1)?.withoutTrainer).toBe(true)
  expect(listRequests.at(-1)).toMatchObject({
    page: 1,
    pageSize: 10,
    isActive: false,
    withoutTrainer: true,
  })

  await expect(page.getByRole('navigation', { name: 'Страницы списка групп' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await page.getByRole('button', { name: 'Готово' }).click()
  await page.getByRole('button', { name: 'Сбросить все' }).click()
  await expect.poll(() => listRequests.at(-1)).toEqual({
    page: 1,
    pageSize: 10,
  })
  expect(listRequests.at(-1)).toMatchObject({
    page: 1,
    pageSize: 10,
  })
  await expect(counters.groupPutCalls).toBe(0)
})

test('Группы: пагинация, редактирование и возврат с сохранением состояния списка', async ({ page }) => {
  const listRequests: ListRequestRecord[] = []
  const counters: RequestCounters = {
    groupsListCalls: 0,
    groupGetCalls: 0,
    groupPutCalls: 0,
    lastUpdatePayload: null,
  }

  await mockApi(page, {
    session: headCoachSession,
    listRequests,
    counters,
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/groups')

  await page.waitForLoadState('networkidle')
  const pagination = page.getByRole('navigation', { name: 'Страницы списка групп' })
  await expect(pagination).toBeVisible()

  const pageTwo = pagination.getByRole('button', { name: '2' })
  await pageTwo.click()

  await expect.poll(() => listRequests.at(-1)?.page).toBe(2)
  expect(listRequests.at(-1)?.page).toBe(2)

  const editButton = page.getByTestId('group-card-group-11').getByRole('button', { name: /Редактировать группу/ })
  const editButtonBox = await editButton.boundingBox()
  expect(editButtonBox).not.toBeNull()
  expect(editButtonBox!.height).toBeGreaterThanOrEqual(44)
  expect(editButtonBox!.width).toBeGreaterThanOrEqual(44)

  await editButton.click()
  await expect(page).toHaveURL('/groups/group-11/edit')
  await expect(page.getByRole('heading', { name: 'Настройка группы «Группа 11»' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'К списку групп' })).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Отменить' })).toHaveCount(0)

  const listRequestCountBeforeSave = listRequests.length
  await page.getByRole('textbox', { name: 'Название группы' }).fill('Группа 11 обновлена')
  await page.getByRole('button', { name: 'Сохранить изменения' }).click()

  await expect.poll(() => counters.groupGetCalls).toBeGreaterThanOrEqual(1)
  await expect.poll(() => counters.groupPutCalls).toBe(1)
  await expect.poll(() => page.url()).toMatch(/\/groups$/)

  await expect(page.getByRole('textbox', { name: 'Поиск групп по названию' })).toHaveValue('')
  await expect(page.getByTestId('group-card-group-11')).toHaveAttribute(
    'data-selected',
    'true',
  )
  await expect(page.getByTestId('group-card-group-11')).toBeVisible()
  await expect(page.getByTestId('group-card-group-1')).toHaveCount(0)
  await expect.poll(() => listRequests.length).toBeGreaterThan(listRequestCountBeforeSave)
  expect(listRequests.at(-1)).toMatchObject({ page: 2, pageSize: 10 })
  expect(counters.lastUpdatePayload?.name).toBe('Группа 11 обновлена')
  expect(counters.lastUpdatePayload).not.toHaveProperty('trainerIds')
  expect(counters.lastUpdatePayload).not.toHaveProperty('trainingStartTime')
  expect(counters.lastUpdatePayload).not.toHaveProperty('weekdays')
  await expectNoHorizontalOverflow(page)
})

test('Группы: создание выполняется через preview initialLessonSeries и confirmation token', async ({ page }) => {
  const listRequests: ListRequestRecord[] = []
  const counters: RequestCounters = {
    groupsListCalls: 0,
    groupCreateCalls: 0,
    groupGetCalls: 0,
    groupPreviewCalls: 0,
    groupPutCalls: 0,
    lastCreatePayload: null,
    lastPreviewPayload: null,
    lastUpdatePayload: null,
  }

  await mockApi(page, {
    session: headCoachSession,
    listRequests,
    counters,
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/groups')
  await page.getByRole('button', { name: 'Новая группа' }).click()

  await expect(page.getByRole('heading', { name: 'Новая группа' })).toBeVisible()
  const stickyActions = page.locator('.sticky-form-actions--page')
  const primaryAction = stickyActions.getByRole('button', { name: 'Получить предпросмотр' })
  const secondaryAction = stickyActions.getByRole('button', { name: 'Отменить' })
  await expect(primaryAction).toBeInViewport()
  await expect(secondaryAction).toBeInViewport()
  const [stickyBox, navigationBox] = await Promise.all([
    stickyActions.boundingBox(),
    page.getByTestId('mobile-bottom-navigation').boundingBox(),
  ])
  expect(stickyBox).not.toBeNull()
  expect(navigationBox).not.toBeNull()
  expect(stickyBox!.height).toBeGreaterThanOrEqual(60)
  expect(stickyBox!.y + stickyBox!.height).toBeLessThanOrEqual(navigationBox!.y + 1)
  await page.getByRole('textbox', { name: 'Название группы' }).fill('Новая серия')
  await page.getByLabel('Время начала').fill('10:00')
  await page.getByLabel('Длительность').fill('60')
  await page.getByRole('checkbox', { name: 'Пн' }).click()
  await page.getByLabel('Начало расписания').fill('2026-09-01')
  await primaryAction.click()

  await expect.poll(() => counters.lastPreviewPayload).toEqual({
    name: 'Новая серия',
    branchId: 'branch-1',
    hallId: 'hall-1',
    groupTypeId: 'group-type-1',
    trainingStartTime: '10:00',
    durationMinutes: 60,
    weekdays: [1],
    isActive: true,
    trainerIds: [],
    initialLessonSeries: {
      startsOn: '2026-09-01',
      endsOn: null,
      slots: [{
        isoWeekday: 1,
        startTime: '10:00',
        durationMinutes: 60,
        hallId: 'hall-1',
      }],
    },
  })
  await expect(page.getByText('Проверьте расписание перед созданием')).toBeVisible()

  await page.getByRole('button', { name: 'Создать группу' }).click()

  await expect.poll(() => counters.lastCreatePayload).toEqual({
    ...(counters.lastPreviewPayload as Record<string, unknown>),
    confirmationToken: 'group-preview-token',
  })
  await expect.poll(() => counters.groupCreateCalls).toBe(1)
  await expect(page).toHaveURL('/groups')
})

test('Группы: постоянные назначения тренеров идут через preview/execute с revision и token', async ({ page }) => {
  const listRequests: ListRequestRecord[] = []
  const counters: RequestCounters = {
    groupsListCalls: 0,
    groupGetCalls: 0,
    groupPutCalls: 0,
    groupTrainerAssignmentExecuteCalls: 0,
    groupTrainerAssignmentPreviewCalls: 0,
    lastUpdatePayload: null,
  }

  await mockApi(page, {
    session: headCoachSession,
    listRequests,
    counters,
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/groups/group-11/edit')

  await expect(page.getByRole('heading', { name: 'Настройка группы «Группа 11»' })).toBeVisible()
  await expect(page.getByText('Постоянные назначения тренеров')).toBeVisible()
  await expect(page.getByLabel('Время начала')).toHaveCount(0)
  await expect(page.getByText('Основные тренеры группы')).toHaveCount(0)

  await page.getByLabel('Окончание периода 1').fill('2026-09-30')
  await page.getByRole('button', { name: 'Получить предпросмотр' }).click()

  await expect.poll(() => counters.groupTrainerAssignmentPreviewCalls).toBe(1)
  expect(counters.lastTrainerAssignmentPreviewPayload).toEqual({
    assignments: [
      {
        trainerId: 'trainer-1',
        validFrom: '2026-08-23',
        validTo: '2026-09-30',
      },
    ],
    expectedRevision: 'assignment-revision-group-11',
  })
  await expect(page.getByText('Предпросмотр изменений')).toBeVisible()
  await expect(page.getByText('У тренера есть пересекающееся постоянное назначение в другой группе.')).toBeVisible()
  await expect(page.getByText('assignment-preview-token')).toHaveCount(0)
  await expect(page.getByText('technical backend warning')).toHaveCount(0)

  await page.getByRole('button', { name: 'Сохранить назначения' }).click()

  await expect.poll(() => counters.groupTrainerAssignmentExecuteCalls).toBe(1)
  expect(counters.lastTrainerAssignmentExecutePayload).toEqual({
    assignments: [
      {
        trainerId: 'trainer-1',
        validFrom: '2026-08-23',
        validTo: '2026-09-30',
      },
    ],
    expectedRevision: 'assignment-revision-group-11',
    confirmationToken: 'assignment-preview-token',
  })
  await expect(page.getByText('Предпросмотр изменений')).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
})

test('Группы: при временной ошибке сохранения изменения удерживаются и применяются после повторной отправки', async ({ page }) => {
  const listRequests: ListRequestRecord[] = []
  const counters: RequestCounters = {
    groupsListCalls: 0,
    groupGetCalls: 0,
    groupPutCalls: 0,
    lastUpdatePayload: null,
  }
  const failGroupPut: MockFailureState = { active: true }

  await mockApi(page, {
    session: headCoachSession,
    listRequests,
    counters,
    failGroupPut,
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/groups')

  await page.waitForLoadState('networkidle')
  const pagination = page.getByRole('navigation', { name: 'Страницы списка групп' })
  await expect(pagination).toBeVisible()
  await pagination.getByRole('button', { name: '2' }).click()
  await expect.poll(() => listRequests.at(-1)?.page).toBe(2)

  const editButton = page.getByTestId('group-card-group-11').getByRole('button', { name: /Редактировать группу/ })
  await editButton.click()

  await expect(page.getByRole('heading', { name: 'Настройка группы «Группа 11»' })).toBeVisible()
  await expect(page.locator('.metric-card')).toHaveCount(0)

  await page.getByRole('textbox', { name: 'Название группы' }).fill('Группа 11 обновлена')
  await page.getByRole('button', { name: 'Сохранить изменения' }).click()

  await expect(page.getByText('Сохранение не выполнено')).toBeVisible()
  await expect(
    page.getByRole('textbox', { name: 'Название группы' }),
  ).toHaveValue('Группа 11 обновлена')

  await page.getByRole('button', { name: 'Сохранить изменения' }).click()
  await expect.poll(() => counters.groupPutCalls).toBe(2)
  await expect(page).toHaveURL('/groups')
  await expectNoHorizontalOverflow(page)
})

test('Группы: браузерный возврат возвращает сохраненный фильтр и выделенную карточку', async ({ page }) => {
  const listRequests: ListRequestRecord[] = []
  const counters: RequestCounters = {
    groupsListCalls: 0,
    groupGetCalls: 0,
    groupPutCalls: 0,
    lastUpdatePayload: null,
  }

  await mockApi(page, {
    session: headCoachSession,
    listRequests,
    counters,
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/groups')

  const search = page.getByRole('textbox', { name: 'Поиск групп по названию' })
  await search.fill('Группа 11')
  await search.blur()
  await expect.poll(() => listRequests.at(-1)?.query).toBe('Группа 11')

  const editButton = page.getByTestId('group-card-group-11').getByRole('button', { name: /Редактировать группу/ })
  await editButton.click()
  await expect(page).toHaveURL('/groups/group-11/edit')
  await page.goBack()

  await expect(page).toHaveURL('/groups')
  await expect(search).toHaveValue('Группа 11')
  await expect(page.getByTestId('group-card-group-11')).toHaveAttribute(
    'data-selected',
    'true',
  )
})

test('Группы: Coach без разрешения видит явный запрет без запроса реестра', async ({ page }) => {
  const listRequests: ListRequestRecord[] = []
  const counters: RequestCounters = {
    groupsListCalls: 0,
    groupGetCalls: 0,
    groupPutCalls: 0,
    lastUpdatePayload: null,
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await mockApi(page, {
    session: coachReadOnlySession,
    listRequests,
    counters,
  })

  await page.goto('/groups')

  await expect(page).toHaveURL('/groups')
  await expect(page.getByRole('heading', { level: 1, name: 'Нет доступа' })).toBeFocused()
  await expect(page.getByText('У вас нет доступа к разделу «Группы».')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Открыть Посещения' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Поиск групп по названию' })).toHaveCount(0)
  expect(listRequests).toHaveLength(0)
  expect(counters.groupsListCalls).toBe(0)
})

test('Группы: Administrator видит только свой филиал, SuperAdministrator — оба филиала', async ({ page }) => {
  const listRequests: ListRequestRecord[] = []
  const counters: RequestCounters = {
    groupsListCalls: 0,
    groupGetCalls: 0,
    groupPutCalls: 0,
    lastUpdatePayload: null,
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await mockApi(page, {
    session: administratorSession,
    listRequests,
    counters,
  })

  await page.goto('/groups')
  await expect(page.getByRole('heading', { name: 'Группы' })).toBeVisible()
  await expect(page.getByTestId('group-card-group-scope-branch-1')).toBeVisible()
  await expect(page.getByTestId('group-card-group-scope-branch-2')).toHaveCount(0)
  await expect(
    page
      .getByTestId('group-card-group-scope-branch-1')
      .getByRole('button', { name: 'Редактировать' }),
  ).toBeVisible()

  await page.unroute('**/api/**')

  await mockApi(page, {
    session: superAdministratorSession,
    listRequests,
    counters,
  })
  await page.goto('/groups')

  await expect(page.getByTestId('group-card-group-scope-branch-1')).toBeVisible()
  await expect(page.getByTestId('group-card-group-scope-branch-2')).toBeVisible()
  await expect(
    page.getByTestId('group-card-group-scope-branch-2'),
  ).toContainText('Восток')
  await expect(
    page
      .getByTestId('group-card-group-scope-branch-2')
      .getByRole('button', { name: 'Редактировать' }),
  ).toBeVisible()
})

test('Группы: ошибка списка показывает retry и восстанавливает список после повторной загрузки', async ({ page }) => {
  const listRequests: ListRequestRecord[] = []
  const counters: RequestCounters = {
    groupsListCalls: 0,
    groupGetCalls: 0,
    groupPutCalls: 0,
    lastUpdatePayload: null,
  }

  const groupsListFailure = { active: true }
  await mockApi(page, {
    failGroupsList: groupsListFailure,
    session: headCoachSession,
    listRequests,
    counters,
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/groups')

  await expect(page.getByRole('alert', { name: 'Список групп не загрузился' })).toBeVisible()
  const failedRequestCount = listRequests.length
  groupsListFailure.active = false
  await page.getByRole('button', { name: 'Повторить' }).click()
  await expect.poll(() => listRequests.length).toBeGreaterThan(failedRequestCount)
  await expect(page.getByRole('heading', { name: 'Группы' })).toBeVisible()
})

test('Группы: поддерживает компактную ориентацию без горизонтального переполнения', async ({ page }) => {
  const listRequests: ListRequestRecord[] = []
  const counters: RequestCounters = {
    groupsListCalls: 0,
    groupGetCalls: 0,
    groupPutCalls: 0,
    lastUpdatePayload: null,
  }

  await mockApi(page, {
    session: headCoachSession,
    listRequests,
    counters,
  })

  await page.setViewportSize({ width: 912, height: 420 })
  await page.goto('/groups')

  await expect(page.getByRole('heading', { name: 'Группы' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await expect(page.locator('#groups-results')).toBeVisible()
})

async function mockApi(
  page: Page,
  options: {
    session: GroupsSession
    listRequests: ListRequestRecord[]
    counters: RequestCounters
    failGroupsList?: { active: boolean }
    failGroupPut?: MockFailureState
  },
) {
  const branchScope = options.session.user.branchId
  const isAdministratorRole = options.session.user.role === 'Administrator'
  const scopedGroups = isAdministratorRole && branchScope
    ? registryGroups.filter((group) => group.branchId === branchScope)
    : registryGroups
  const scopedBranches = isAdministratorRole && branchScope
    ? BRANCHES.filter((branch) => branch.id === branchScope)
    : BRANCHES
  const scopedHalls = isAdministratorRole && branchScope
    ? HALLS.filter((hall) => hall.branchId === branchScope)
    : HALLS

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const requestUrl = new URL(request.url())
    const pathname = requestUrl.pathname
    const method = request.method()

    if (!pathname.startsWith('/api/')) {
      await route.continue()
      return
    }

    const context: MockResponseContext = {
      method,
      pathname,
      searchParams: requestUrl.searchParams,
      route,
    }

    if (pathname === '/api/config' && method === 'GET') {
      await fulfillJson(context.route, 200, APP_CONFIG)
      return
    }

    if (pathname === '/api/auth/session' && method === 'GET') {
      await fulfillJson(context.route, 200, options.session)
      return
    }

    if (pathname === '/api/attendance/groups' && method === 'GET') {
      await fulfillJson(context.route, 200, {
        groups: [],
        today: '2026-07-30',
        maxTrainingDate: '2026-07-30',
      })
      return
    }

    if (pathname === '/api/clients/attention' && method === 'GET') {
      await fulfillJson(context.route, 200, [])
      return
    }

    if (pathname === '/api/groups' && method === 'GET') {
      const query = normalizeGroupListQuery(context.searchParams)
      options.counters.groupsListCalls += 1
      options.listRequests.push(query)
      if (options.failGroupsList?.active) {
        await context.route.fulfill({
          status: 503,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify({ message: 'groups list is temporarily unavailable' }),
        })
        return
      }

      await fulfillJson(context.route, 200, filterGroupsPayload(scopedGroups, query))
      return
    }

    if (pathname === '/api/groups/preview' && method === 'POST') {
      options.counters.groupPreviewCalls = (options.counters.groupPreviewCalls ?? 0) + 1
      options.counters.lastPreviewPayload = route.request().postDataJSON()
      await fulfillJson(context.route, 200, {
        confirmationToken: 'group-preview-token',
        expiresAt: '2026-09-01T09:15:00Z',
        warnings: [],
      })
      return
    }

    if (pathname === '/api/groups' && method === 'POST') {
      options.counters.groupCreateCalls = (options.counters.groupCreateCalls ?? 0) + 1
      const payload = route.request().postDataJSON() as {
        durationMinutes?: number
        groupTypeId?: string
        initialLessonSeries?: { slots?: Array<{ hallId?: string; isoWeekday?: number; startTime?: string }> }
        isActive?: boolean
        name?: string
        trainingStartTime?: string
        weekdays?: number[]
      }
      options.counters.lastCreatePayload = payload
      const firstSlot = payload.initialLessonSeries?.slots?.[0]
      await fulfillJson(context.route, 201, buildGroupPayload({
        id: 'created-group',
        name: payload.name ?? 'Новая группа',
        branchId: 'branch-1',
        branchName: 'Центр',
        hallId: firstSlot?.hallId ?? 'hall-1',
        hallName: 'Основной зал',
        groupTypeId: payload.groupTypeId ?? 'group-type-1',
        groupTypeName: 'Базовый',
        trainingStartTime: firstSlot?.startTime ?? payload.trainingStartTime ?? '10:00',
        durationMinutes: payload.durationMinutes ?? 60,
        weekdays: firstSlot?.isoWeekday ? [firstSlot.isoWeekday] : payload.weekdays ?? [1],
        trainerIds: [],
        trainerNames: [],
        isActive: payload.isActive ?? true,
        clientCount: 0,
      }))
      return
    }

    if (context.pathname === '/api/groups/options/trainers' && context.method === 'GET') {
      await fulfillJson(context.route, 200, TRAINER_OPTIONS)
      return
    }

    if (context.pathname === '/api/branches' && context.method === 'GET') {
      await fulfillJson(context.route, 200, scopedBranches)
      return
    }

    if (context.pathname === '/api/halls' && context.method === 'GET') {
      await fulfillJson(context.route, 200, scopedHalls)
      return
    }

    if (context.pathname === '/api/group-types' && context.method === 'GET') {
      await fulfillJson(context.route, 200, GROUP_TYPES)
      return
    }

    if (pathname.startsWith('/api/groups/') && pathname.endsWith('/clients') && method === 'GET') {
      await fulfillJson(context.route, 200, { clients: [] })
      return
    }

    if (pathname.endsWith('/trainer-substitutions') && method === 'GET') {
      await fulfillJson(context.route, 200, TRAINER_SUBSTITUTIONS_RESPONSE)
      return
    }

    const trainerAssignmentsPreviewMatch = pathname.match(
      /^\/api\/groups\/([^/]+)\/trainer-assignments\/preview$/,
    )
    if (trainerAssignmentsPreviewMatch && method === 'POST') {
      options.counters.groupTrainerAssignmentPreviewCalls =
        (options.counters.groupTrainerAssignmentPreviewCalls ?? 0) + 1
      options.counters.lastTrainerAssignmentPreviewPayload = route.request().postDataJSON()
      const assignmentsPayload = route.request().postDataJSON() as {
        assignments?: Array<{ trainerId?: string; validFrom?: string; validTo?: string | null }>
      }
      await fulfillJson(context.route, 200, {
        confirmationToken: 'assignment-preview-token',
        expiresAt: '2026-08-23T10:15:00Z',
        revision: `assignment-revision-${trainerAssignmentsPreviewMatch[1]}`,
        assignments: (assignmentsPayload.assignments ?? []).map((assignment) => ({
          trainerId: assignment.trainerId ?? 'trainer-1',
          trainerName: 'Тренер',
          validFrom: assignment.validFrom ?? '2026-08-23',
          validTo: assignment.validTo ?? null,
        })),
        impact: {
          totalAffectedOccurrences: 2,
          examples: [
            {
              lessonOccurrenceId: 'occurrence-preview-1',
              lessonDate: '2026-08-24',
              startTime: '18:00',
              hallId: 'hall-1',
              hallName: 'Основной зал',
            },
          ],
        },
        warnings: [
          {
            code: 'group_trainer_assignment_overlap',
            message: 'technical backend warning',
          },
        ],
      })
      return
    }

    const trainerAssignmentsExecuteMatch = pathname.match(
      /^\/api\/groups\/([^/]+)\/trainer-assignments$/,
    )
    if (trainerAssignmentsExecuteMatch && method === 'POST') {
      options.counters.groupTrainerAssignmentExecuteCalls =
        (options.counters.groupTrainerAssignmentExecuteCalls ?? 0) + 1
      options.counters.lastTrainerAssignmentExecutePayload = route.request().postDataJSON()
      const assignmentsPayload = route.request().postDataJSON() as {
        assignments?: Array<{ trainerId?: string; validFrom?: string; validTo?: string | null }>
      }
      await fulfillJson(context.route, 200, {
        revision: `assignment-revision-${trainerAssignmentsExecuteMatch[1]}-2`,
        assignments: (assignmentsPayload.assignments ?? []).map((assignment) => ({
          trainerId: assignment.trainerId ?? 'trainer-1',
          trainerName: 'Тренер',
          validFrom: assignment.validFrom ?? '2026-08-23',
          validTo: assignment.validTo ?? null,
        })),
        impact: { totalAffectedOccurrences: 2, examples: [] },
        warnings: [],
      })
      return
    }

    if (pathname.startsWith('/api/groups/') && pathname.length > '/api/groups/'.length) {
      const groupId = pathname.slice('/api/groups/'.length)

      if (method === 'GET') {
        options.counters.groupGetCalls += 1
        const group = scopedGroups.find((item) => item.id === groupId)

        if (!group) {
          await fulfillJson(context.route, 404, { title: 'Группа не найдена.' })
          return
        }

        await fulfillJson(context.route, 200, buildGroupPayload(group))
        return
      }

      if (method === 'PUT') {
        options.counters.groupPutCalls += 1
        const payload = route.request().postDataJSON() as Record<string, unknown> & { name?: string }
        options.counters.lastUpdatePayload = payload

        if (options.failGroupPut?.active) {
          options.failGroupPut.active = false
          await context.route.fulfill({
            status: 500,
            contentType: 'application/json; charset=utf-8',
            body: JSON.stringify({
              title: 'Временная ошибка сохранения',
              detail: 'Подробности позже',
            }),
          })
          return
        }

        await fulfillJson(context.route, 200, buildGroupPayload({
          ...registryGroups[0],
          id: groupId,
          name: payload.name ?? 'Группа обновлена',
        }))
        return
      }
    }

    throw new Error(`Unexpected request in groups registry e2e: ${method} ${pathname}`)
  })
}

function normalizeGroupListQuery(searchParams: URLSearchParams): ListRequestRecord {
  return {
    page: Number.parseInt(searchParams.get('page') ?? '1', 10) || 1,
    pageSize: Number.parseInt(searchParams.get('pageSize') ?? '10', 10) || 10,
    query: searchParams.get('query')?.trim() || undefined,
    isActive: searchParams.get('isActive') === 'true'
      ? true
      : searchParams.get('isActive') === 'false'
        ? false
        : undefined,
    withoutTrainer: searchParams.get('withoutTrainer') === 'true' ? true : undefined,
  }
}

function filterGroupsPayload(groups: GroupData[], query: ListRequestRecord) {
  const filtered = groups.filter((group) => {
    if (query.query && !group.name.toLowerCase().includes(query.query.toLowerCase())) {
      return false
    }

    if (typeof query.isActive === 'boolean' && group.isActive !== query.isActive) {
      return false
    }

    if (query.withoutTrainer && group.trainerIds.length > 0) {
      return false
    }

    return true
  })

  const skip = (query.page - 1) * query.pageSize
  const payloadGroups = filtered.slice(skip, skip + query.pageSize)

  return {
    items: payloadGroups.map(buildGroupPayload),
    totalCount: filtered.length,
    skip,
    take: query.pageSize,
  }
}

function buildGroupPayload(group: GroupData) {
  return {
    id: group.id,
    name: group.name,
    branchId: group.branchId,
    branchName: group.branchName,
    hallId: group.hallId,
    hallName: group.hallName,
    groupTypeId: group.groupTypeId,
    groupTypeName: group.groupTypeName,
    trainingStartTime: group.trainingStartTime,
    durationMinutes: group.durationMinutes,
    weekdays: group.weekdays,
    isActive: group.isActive,
    trainers: group.trainerIds.length === 0
      ? []
      : group.trainerIds.map((trainerId) => ({
        id: trainerId,
        fullName: TRAINER_OPTIONS.find((item) => item.id === trainerId)?.fullName
          ?? trainerId,
        login: TRAINER_OPTIONS.find((item) => item.id === trainerId)?.login
          ?? trainerId,
      })),
    trainerIds: group.trainerIds,
    trainerCount: group.trainerIds.length,
    trainerNames: group.trainerNames,
    clientCount: group.clientCount,
    trainerAssignmentRevision: `assignment-revision-${group.id}`,
    trainerAssignmentPeriods: group.trainerIds.map((trainerId) => ({
      trainerId,
      trainerName: TRAINER_OPTIONS.find((item) => item.id === trainerId)?.fullName
        ?? trainerId,
      validFrom: '2026-08-23',
      validTo: null,
    })),
    updatedAt: '2026-07-22T10:00:00Z',
    createdAt: '2026-06-01T10:00:00Z',
  }
}

async function fulfillJson(route: MockResponseContext['route'], status: number, payload: unknown) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  })
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() =>
    page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true)
}
