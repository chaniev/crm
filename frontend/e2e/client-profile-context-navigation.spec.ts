import { expect, test, type Page } from '@playwright/test'
import { lesson } from './support/schedule-lesson'

const APP_CONFIG = {
  clubName: 'Iron Club',
  themeId: 'default-green-v1',
  authBackgroundImageId: 'k4pro-login-v1',
} as const

const ATTENDANCE_SESSION = {
  isAuthenticated: true,
  csrfToken: 'task-116-csrf-token',
  bootstrapMode: false,
  user: {
    id: 'coach-task-116',
    fullName: 'Тренер задачи',
    login: 'coach-task-116',
    role: 'Coach',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Attendance',
    allowedSections: ['Attendance', 'Schedule', 'Clients', 'Groups'],
    permissions: {
      canManageUsers: false,
      canManageClients: true,
      canViewClientMessenger: true,
      canManageGroups: true,
      canManageSettings: false,
      canMarkAttendance: true,
      canViewAuditLog: false,
      canViewFinancialReports: false,
    },
    assignedGroupIds: ['group-1'],
  },
} as const

const GROUP_ID = 'group-1'
const CLIENT_ID = 'client-1'
const CLIENT_FULL_NAME = 'Иван Иванов'
const CLIENT_GROUPED_NAME =
  'Алексей Смирнов с очень длинным именем для проверки переноса внутри строки группы'
const ATTENDANCE_TODAY = '2026-04-18'
const LESSON_ID = 'lesson-1'
const LESSON_DATE = '2026-04-17'
const ATTENDANCE_PATH = `/attendance/${LESSON_ID}?lessonDate=${LESSON_DATE}`

const ATTENDANCE_GROUP = {
  id: GROUP_ID,
  name: 'Группа 7: вечер',
  trainingStartTime: '19:00',
  durationMinutes: 60,
  weekdays: [2, 4],
  clientCount: 2,
} as const

const ATTENDANCE_GROUPS_RESPONSE = {
  groups: [ATTENDANCE_GROUP],
  today: ATTENDANCE_TODAY,
  minTrainingDate: '2026-04-01',
  maxTrainingDate: ATTENDANCE_TODAY,
} as const

const CLIENT_DETAILS_RESPONSE = {
  id: CLIENT_ID,
  fullName: CLIENT_FULL_NAME,
  lastName: 'Иванов',
  firstName: 'Иван',
  middleName: 'Иванович',
  phone: '+7 999 111-22-33',
  branchId: 'branch-1',
  branchName: 'Центр',
  status: 'Active',
  contactCount: 0,
  groupCount: 1,
  groups: [
    {
      id: GROUP_ID,
      name: 'Группа 7',
      branchId: 'branch-1',
      branchName: 'Центр',
      hallId: 'hall-1',
      hallName: 'Основной зал',
      groupTypeId: 'type-1',
      groupTypeName: 'Базовый',
      trainingStartTime: '19:00',
      durationMinutes: 60,
      weekdays: [2, 4],
      isActive: true,
    },
  ],
  photo: null,
  isProfessional: false,
  professionalComment: null,
  hasActiveMembership: false,
  membershipWarning: true,
  membershipWarningMessage: 'Абонемент просрочен, отметка посещения доступна.',
  currentMemberships: [],
  hasCurrentMembership: false,
  membershipState: 'Expired',
  actionHints: [],
  contacts: [],
  groupIds: [GROUP_ID],
  notes: '',
  notesLastChangedByName: null,
  notesLastChangedByAt: null,
  businessDate: ATTENDANCE_TODAY,
  createdAt: '2026-01-01T09:00:00Z',
  birthDate: null,
  attendanceHistory: [],
  attendanceHistoryTotalCount: 0,
  membershipHistory: [],
} as const

const GROUP_DETAILS_RESPONSE = {
  id: GROUP_ID,
  name: ATTENDANCE_GROUP.name,
  branchId: 'branch-1',
  branchName: 'Центр',
  hallId: 'hall-1',
  hallName: 'Основной зал',
  groupTypeId: 'type-1',
  groupTypeName: 'Базовый',
  trainingStartTime: '19:00',
  durationMinutes: 60,
  weekdays: [2, 4],
  isActive: true,
  trainerIds: ['trainer-1'],
  trainers: [{ id: 'trainer-1', fullName: 'Тренер', login: 'coach' }],
  clientCount: 2,
  updatedAt: '2026-04-01T08:00:00Z',
  createdAt: '2026-01-01T09:00:00Z',
} as const

const GROUPS_LIST_RESPONSE = {
  items: [GROUP_DETAILS_RESPONSE],
  totalCount: 1,
  skip: 0,
  take: 20,
} as const

const GROUP_LIST_OPTIONS = [
  {
    id: 'branch-1',
    name: 'Центр',
    address: 'Ленина, 1',
    description: 'Филиал',
    isArchived: false,
    hallCount: 1,
    groupCount: 1,
    clientCount: 12,
  },
] as const

const GROUP_HALL_OPTIONS = [
  {
    id: 'hall-1',
    branchId: 'branch-1',
    branchName: 'Центр',
    name: 'Основной зал',
    description: 'Основной зал',
    isArchived: false,
    groupCount: 1,
  },
] as const

const GROUP_TYPES = [
  {
    id: 'type-1',
    name: 'Базовый',
    description: 'Базовый',
    groupCount: 1,
  },
] as const

const GROUP_TRAINER_OPTIONS = [
  {
    id: 'trainer-1',
    fullName: 'Тренер',
    login: 'coach',
  },
] as const

const GROUP_CLIENT_LIST_RESPONSE = {
  groupId: GROUP_ID,
  clients: [
    {
      id: CLIENT_ID,
      fullName: CLIENT_FULL_NAME,
      status: 'Active',
      phone: '+7 999 111-22-33',
    },
    {
      id: 'client-2',
      fullName: CLIENT_GROUPED_NAME,
      status: 'Active',
      phone: '+7 999 444-55-66',
    },
  ],
} as const

const ATTENDANCE_GEO_VIEWPORTS = [
  { width: 390, height: 844, name: '390x844' },
  { width: 360, height: 780, name: '360x780' },
  { width: 420, height: 912, name: '420x912' },
  { width: 440, height: 956, name: '440x956' },
  { width: 912, height: 420, name: '912x420' },
  { width: 956, height: 440, name: '956x440' },
  { width: 768, height: 1024, name: '768x1024' },
  { width: 1440, height: 1200, name: '1440x1200' },
] as const

type RouteMockContext = {
  method: string
  pathname: string
  searchParams: URLSearchParams
  route: Parameters<Page['route']>[1] extends (route: infer T) => unknown
    ? T
    : never
}

type AttendanceSaveState = {
  postCount: number
  blockedByTest: boolean
  blockedHandled: boolean
  releaseBlockedSave: (() => void) | null
  lastPayload: Record<string, unknown> | null
}

type GroupPersistState = {
  updateCalls: number
  failNextUpdate: boolean
}

function createAttendanceSaveState(): AttendanceSaveState {
  return {
    postCount: 0,
    blockedByTest: false,
    blockedHandled: false,
    releaseBlockedSave: null,
    lastPayload: null,
  }
}

function createGroupPersistState(): GroupPersistState {
  return {
    updateCalls: 0,
    failNextUpdate: false,
  }
}

function buildRosterPayload(trainingDate: string) {
  return {
    groupId: GROUP_ID,
    lessonOccurrenceId: LESSON_ID,
    lessonDate: trainingDate,
    canEditAttendance: { allowed: true, reason: null },
    trainingDate,
    today: ATTENDANCE_TODAY,
    minTrainingDate: ATTENDANCE_GROUPS_RESPONSE.minTrainingDate,
    maxTrainingDate: ATTENDANCE_GROUPS_RESPONSE.maxTrainingDate,
    clients: [
      {
        id: CLIENT_ID,
        fullName: CLIENT_FULL_NAME,
        state: 'Unmarked',
        isProfessional: false,
        professionalComment: null,
        hasActiveMembership: false,
        membershipWarning: true,
        membershipWarningMessage: 'Абонемент просрочен, отметка посещения доступна.',
        photo: null,
        groups: [ATTENDANCE_GROUP],
      },
      {
        id: 'client-2',
        fullName: CLIENT_GROUPED_NAME,
        state: 'Absent',
        isProfessional: false,
        professionalComment: null,
        hasActiveMembership: true,
        membershipWarning: false,
        photo: null,
        groups: [ATTENDANCE_GROUP],
      },
    ],
  }
}

async function mockTask116Api(
  page: Page,
  state: {
    session: typeof ATTENDANCE_SESSION
    attendanceSaveState: AttendanceSaveState
    groupPersistState: GroupPersistState
    lessonDate?: string
    clientDetailsStatus?: 200 | 403 | 404
  },
) {
  const occurrence = lesson({
    lessonOccurrenceId: LESSON_ID,
    lessonDate: state.lessonDate ?? LESSON_DATE,
    groupName: ATTENDANCE_GROUP.name,
    startTime: '19:00', endTime: '20:00', durationMinutes: 60,
  })
  await page.route('**/api/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    if (!requestUrl.pathname.startsWith('/api/')) {
      await route.fallback()
      return
    }

    const context: RouteMockContext = {
      method: route.request().method(),
      pathname: requestUrl.pathname,
      searchParams: requestUrl.searchParams,
      route,
    }

    if (context.pathname === '/api/config' && context.method === 'GET') {
      await fulfillJson(context.route, 200, APP_CONFIG)
      return
    }

    if (context.pathname === '/api/auth/session' && context.method === 'GET') {
      await fulfillJson(context.route, 200, state.session)
      return
    }

    if (context.pathname === '/api/clients/attention' && context.method === 'GET') {
      await fulfillJson(context.route, 200, [])
      return
    }

    if (context.pathname === '/api/attendance/lessons/today' && context.method === 'GET') {
      await fulfillJson(context.route, 200, {
        today: ATTENDANCE_TODAY,
        items: [{ ...occurrence, openAttendance: occurrence.allowedActions.viewAttendance, unmarkedClientCount: 1 }],
      })
      return
    }

    if (context.pathname === `/api/schedule/lessons/${LESSON_ID}` && context.method === 'GET') {
      expect(context.searchParams.get('lessonDate')).toBe(occurrence.lessonDate)
      await fulfillJson(context.route, 200, occurrence)
      return
    }

    if (context.pathname === '/api/attendance/groups' && context.method === 'GET') {
      await fulfillJson(context.route, 200, ATTENDANCE_GROUPS_RESPONSE)
      return
    }

    if (
      (context.pathname === `/api/attendance/groups/${GROUP_ID}/clients` ||
        context.pathname === `/api/attendance/lessons/${LESSON_ID}/clients`) &&
      context.method === 'GET'
    ) {
      const requestedTrainingDate = context.searchParams.get('lessonDate') ?? context.searchParams.get('trainingDate') ?? ATTENDANCE_TODAY
      if (context.pathname.includes('/lessons/')) expect(requestedTrainingDate).toBe(occurrence.lessonDate)
      await fulfillJson(
        context.route,
        200,
        buildRosterPayload(requestedTrainingDate),
      )
      return
    }

    if (
      (context.pathname === `/api/attendance/groups/${GROUP_ID}` ||
        context.pathname === `/api/attendance/lessons/${LESSON_ID}`) &&
      context.method === 'POST'
    ) {
      const payload = context.route.request().postDataJSON() as Record<string, unknown>
      state.attendanceSaveState.postCount += 1
      state.attendanceSaveState.lastPayload = payload

      if (state.attendanceSaveState.blockedByTest && !state.attendanceSaveState.blockedHandled) {
        state.attendanceSaveState.blockedHandled = true
        await new Promise<void>((resolve) => {
          state.attendanceSaveState.releaseBlockedSave = resolve
        })
      }

      const requestPayload = payload as {
        AttendanceMarks?: Array<{ ClientId: string; State: string }>
        TrainingDate?: string
        LessonDate?: string
      }
      const marked = requestPayload.AttendanceMarks?.[0]
      const trainingDate =
        requestPayload.LessonDate ?? requestPayload.TrainingDate ?? context.searchParams.get('lessonDate') ?? context.searchParams.get('trainingDate') ?? ATTENDANCE_TODAY

      await fulfillJson(context.route, 200, {
        groupId: GROUP_ID,
        trainingDate,
        today: ATTENDANCE_TODAY,
        minTrainingDate: ATTENDANCE_GROUPS_RESPONSE.minTrainingDate,
        maxTrainingDate: ATTENDANCE_GROUPS_RESPONSE.maxTrainingDate,
        attendanceMarks: marked
          ? [
              {
                clientId: marked.ClientId,
                state: marked.State,
              },
            ]
          : [],
      })
      if (state.attendanceSaveState.blockedByTest) {
        state.attendanceSaveState.blockedByTest = false
      }
      return
    }

    if (context.pathname === '/api/groups/summary') {
      await fulfillJson(context.route, 200, { totalCount: 1, activeWithoutTrainerCount: 0 })
      return
    }

    if (context.pathname === '/api/groups' && context.method === 'GET') {
      await fulfillJson(context.route, 200, GROUPS_LIST_RESPONSE)
      return
    }

    if (context.pathname === '/api/branches' && context.method === 'GET') {
      await fulfillJson(context.route, 200, GROUP_LIST_OPTIONS)
      return
    }

    if (context.pathname === '/api/halls' && context.method === 'GET') {
      await fulfillJson(context.route, 200, GROUP_HALL_OPTIONS)
      return
    }

    if (context.pathname === '/api/group-types' && context.method === 'GET') {
      await fulfillJson(context.route, 200, GROUP_TYPES)
      return
    }

    if (context.pathname === '/api/groups/options/trainers' && context.method === 'GET') {
      await fulfillJson(context.route, 200, GROUP_TRAINER_OPTIONS)
      return
    }

    if (context.pathname.endsWith('/lesson-series') && context.method === 'GET') {
      await fulfillJson(context.route, 404, { title: 'Расписание не найдено', code: 'lesson-series-not-found' })
      return
    }

    if (context.pathname === '/api/groups/group-1/trainer-substitutions' && context.method === 'GET') {
      await fulfillJson(context.route, 200, {
        current: [],
        history: { items: [], totalCount: 0, skip: 0, take: 20 },
        canCreate: true,
        createUnavailableReason: null,
      })
      return
    }

    if (context.pathname === '/api/groups/group-1' && context.method === 'GET') {
      await fulfillJson(context.route, 200, GROUP_DETAILS_RESPONSE)
      return
    }

    if (context.pathname === '/api/groups/group-1/clients' && context.method === 'GET') {
      await fulfillJson(context.route, 200, GROUP_CLIENT_LIST_RESPONSE)
      return
    }

    if (context.pathname === '/api/groups/group-1' && context.method === 'PUT') {
      state.groupPersistState.updateCalls += 1
      if (state.groupPersistState.failNextUpdate) {
        state.groupPersistState.failNextUpdate = false
        await fulfillJson(context.route, 422, {
          title: 'Сохранение не выполнено',
          detail: 'Не удалось сохранить тестовый черновик группы.',
        })
        return
      }

      const payload = context.route.request().postDataJSON() as {
        name?: string
        Name?: string
      }
      await fulfillJson(context.route, 200, {
        ...GROUP_DETAILS_RESPONSE,
        name: payload.name ?? payload.Name ?? GROUP_DETAILS_RESPONSE.name,
      })
      return
    }

    if (
      context.pathname === `/api/clients/${CLIENT_ID}` &&
      context.method === 'GET'
    ) {
      if (state.clientDetailsStatus && state.clientDetailsStatus !== 200) {
        await fulfillJson(context.route, state.clientDetailsStatus, {
          title: state.clientDetailsStatus === 403 ? 'Нет доступа' : 'Клиент не найден',
        })
        return
      }

      await fulfillJson(context.route, 200, CLIENT_DETAILS_RESPONSE)
      return
    }

    if (
      context.pathname === `/api/clients/${CLIENT_ID}/messenger/telegram` &&
      context.method === 'GET'
    ) {
      await fulfillJson(context.route, 200, {})
      return
    }

    throw new Error(
      `Unexpected API request in task-116 e2e: ${context.method} ${context.pathname}`,
    )
  })
}

function releaseBlockedAttendanceSave(state: AttendanceSaveState) {
  state.releaseBlockedSave?.()
  state.releaseBlockedSave = null
}

async function fulfillJson(route: RouteMockContext['route'], status: number, payload: unknown) {
  await route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(payload),
  })
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }))

  expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1)
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1)
}

test.describe('TASK-116: контекст возврата в карточку клиента', () => {
  test('Карточка клиента из посещений открывается и возвращает точный контекст', async ({
    page,
  }) => {
    const attendanceSaveState = createAttendanceSaveState()
    const groupPersistState = createGroupPersistState()

    await mockTask116Api(page, {
      session: ATTENDANCE_SESSION,
      lessonDate: ATTENDANCE_TODAY,
      attendanceSaveState,
      groupPersistState,
    })

    await page.setViewportSize({ width: 390, height: 844 })
    const todayLessonPath = `/attendance/${LESSON_ID}?lessonDate=${ATTENDANCE_TODAY}`
    await page.goto('/attendance')
    const source = page.getByTestId(`attendance-today-row-${LESSON_ID}`)
    await source.getByRole('button', { name: /Открыть:/ }).press('Enter')

    await expect(page.getByTestId('attendance-screen')).toBeVisible()
    await expect(page).toHaveURL(todayLessonPath)

    const clientAction = page
      .getByTestId(`attendance-client-card-${CLIENT_ID}`)
      .getByRole('button', { name: `Открыть карточку клиента ${CLIENT_FULL_NAME}` })

    await expect(clientAction).toBeVisible()
    await clientAction.focus()
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(new RegExp(`/clients/${CLIENT_ID}(?:/|$)`))
    await expect(page.getByRole('button', { name: 'К посещениям' })).toBeVisible()

    const returnState = await page.evaluate(() => history.state)
    await page.getByRole('tab', { name: 'Посещения' }).click()
    expect(await page.evaluate(() => history.state)).toEqual(returnState)
    await page.getByRole('button', { name: 'К посещениям' }).click()

    await expect(page).toHaveURL(todayLessonPath)
    await expect(page.getByTestId('attendance-screen')).toBeVisible()
    await expect(clientAction).toBeFocused()
    await expect(page.getByRole('heading', { name: ATTENDANCE_GROUP.name })).toBeVisible()
    await page.getByRole('button', { name: 'К занятиям на сегодня' }).press('Enter')
    await expect(page).toHaveURL('/attendance')
    await expect(source).toBeFocused()
  })

  test('Во время ожидающейся отправке посещения карточка клиента блокируется и разблокируется после ответа', async ({
    page,
  }) => {
    const attendanceSaveState = createAttendanceSaveState()
    attendanceSaveState.blockedByTest = true
    const groupPersistState = createGroupPersistState()

    await mockTask116Api(page, {
      session: ATTENDANCE_SESSION,
      attendanceSaveState,
      groupPersistState,
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(ATTENDANCE_PATH)

    const clientCard = page.getByTestId(`attendance-client-card-${CLIENT_ID}`)
    await clientCard.getByRole('radio', { name: 'Был', exact: true }).click()

    await expect.poll(() => attendanceSaveState.postCount).toBeGreaterThan(0)

    const profileAction = clientCard.getByRole('button', {
      name: `Открыть карточку клиента ${CLIENT_FULL_NAME}`,
    })

    await expect(profileAction).toHaveAttribute('aria-disabled', 'true')
    const reasonId = await profileAction.getAttribute('aria-describedby')
    expect(reasonId).toBeTruthy()
    await expect(page.locator(`#${reasonId}`)).toHaveText(
      'Сначала дождитесь сохранения посещения',
    )

    await profileAction.click({ force: true })
    await expect(page).not.toHaveURL(new RegExp(`/clients/${CLIENT_ID}(?:/|$)`))

    releaseBlockedAttendanceSave(attendanceSaveState)
    await page.getByRole('button', { name: 'Показать всех', exact: true }).click()

    await expect.poll(() => attendanceSaveState.postCount).toBeGreaterThan(0)
    await expect(profileAction).not.toHaveAttribute('aria-disabled', 'true')

    await profileAction.click()
    await expect(page).toHaveURL(new RegExp(`/clients/${CLIENT_ID}(?:/|$)`))
  })

  test('Pristine-переход из группы и очистка draft только после подтвержденного discard', async ({
    page,
  }) => {
    const attendanceSaveState = createAttendanceSaveState()
    const groupPersistState = createGroupPersistState()

    await mockTask116Api(page, {
      session: ATTENDANCE_SESSION,
      attendanceSaveState,
      groupPersistState,
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/groups')

    const editButton = page.getByRole('button', {
      name: `Редактировать группу «${ATTENDANCE_GROUP.name}»`,
    })
    await editButton.click()

    await expect(
      page.getByRole('heading', { name: `Настройка группы «${ATTENDANCE_GROUP.name}»` }),
    ).toBeVisible()

    const nameInput = page.getByRole('textbox', { name: 'Название группы' })
    await expect(nameInput).toHaveValue(ATTENDANCE_GROUP.name)

    const clientAction = page
      .getByTestId(`group-client-row-${CLIENT_ID}`)
      .getByRole('button', { name: `Открыть карточку клиента ${CLIENT_FULL_NAME}` })

    await clientAction.click()
    await expect(page.getByRole('heading', { level: 1, name: 'Иванов Иван Иванович', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'К группе' })).toBeVisible()

    await page.getByRole('button', { name: 'К группе' }).click()
    await expect(page).toHaveURL(new RegExp(`/groups/${GROUP_ID}/edit(?:/|$)`))
    await expect(
      page.getByRole('heading', { name: `Настройка группы «${ATTENDANCE_GROUP.name}»` }),
    ).toBeVisible()
    await expect(nameInput).toHaveValue(ATTENDANCE_GROUP.name)

    await nameInput.fill('Черновик группы')
    await clientAction.click()
    await expect(
      page.getByRole('dialog', { name: 'Сохранить изменения в группе?' }),
    ).toBeVisible()

    const discardButton = page.getByRole('button', { name: 'Не сохранять', exact: true })
    const cancelButton = page.getByRole('button', { name: 'Отмена', exact: true })
    const saveButton = page.getByRole('button', { name: 'Сохранить', exact: true })

    await expect(discardButton).toBeVisible()
    await expect(cancelButton).toBeVisible()
    await expect(saveButton).toBeVisible()

    await cancelButton.click()
    await expect(
      page.getByRole('dialog', { name: 'Сохранить изменения в группе?' }),
    ).toBeHidden()
    await expect(nameInput).toHaveValue('Черновик группы')
    await expect(clientAction).toBeFocused()

    await clientAction.click()
    await page.getByRole('button', { name: 'Не сохранять' }).click()
    await expect(page).toHaveURL(new RegExp(`/clients/${CLIENT_ID}(?:/|$)`))
    expect(groupPersistState.updateCalls).toBe(0)

    await page.getByRole('button', { name: 'К группе' }).click()
    await expect(nameInput).toHaveValue(ATTENDANCE_GROUP.name)
  })

  test('Dirty-группа сохраняется до перехода, а API failure оставляет draft и recovery', async ({
    page,
  }) => {
    const attendanceSaveState = createAttendanceSaveState()
    const groupPersistState = createGroupPersistState()

    await mockTask116Api(page, {
      session: ATTENDANCE_SESSION,
      attendanceSaveState,
      groupPersistState,
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/groups/${GROUP_ID}/edit`)

    const nameInput = page.getByRole('textbox', { name: 'Название группы' })
    const clientAction = page
      .getByTestId(`group-client-row-${CLIENT_ID}`)
      .getByRole('button', { name: `Открыть карточку клиента ${CLIENT_FULL_NAME}` })

    await nameInput.fill('Сохраненная группа')
    await clientAction.click()
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click()

    await expect.poll(() => groupPersistState.updateCalls).toBe(1)
    await expect(page).toHaveURL(new RegExp(`/clients/${CLIENT_ID}(?:/|$)`))

    await page.getByRole('button', { name: 'К группе' }).click()
    await expect(nameInput).toHaveValue(ATTENDANCE_GROUP.name)

    await expect(clientAction).toBeFocused()
    groupPersistState.failNextUpdate = true
    await nameInput.fill('Черновик после ошибки')
    await clientAction.click()
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click()

    await expect.poll(() => groupPersistState.updateCalls).toBe(2)
    await expect(page).toHaveURL(new RegExp(`/groups/${GROUP_ID}/edit(?:/|$)`))
    await expect(nameInput).toHaveValue('Черновик после ошибки')
    const recoveryAlert = page.getByRole('alert', { name: 'Сохранение не выполнено' })
    await expect(recoveryAlert).toContainText(
      'Не удалось сохранить тестовый черновик группы.',
    )
    await expect(recoveryAlert).toBeFocused()
  })

  test('Backend 403 в карточке сохраняет recovery и возврат в посещения', async ({ page }) => {
    const attendanceSaveState = createAttendanceSaveState()
    const groupPersistState = createGroupPersistState()

    await mockTask116Api(page, {
      session: ATTENDANCE_SESSION,
      attendanceSaveState,
      groupPersistState,
      clientDetailsStatus: 403,
    })

    await page.goto(ATTENDANCE_PATH)
    await page
      .getByTestId(`attendance-client-card-${CLIENT_ID}`)
      .getByRole('button', { name: `Открыть карточку клиента ${CLIENT_FULL_NAME}` })
      .click()

    await expect(page.getByText('Карточка клиента не загрузилась')).toBeVisible()
    await expect(page.getByText('Клиент недоступен.', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'К посещениям' }).click()
    await expect(page.getByTestId('attendance-screen')).toBeVisible()
  })

  test('Group action и dirty-dialog сохраняют touch geometry без overflow', async ({ page }) => {
    const attendanceSaveState = createAttendanceSaveState()
    const groupPersistState = createGroupPersistState()

    await mockTask116Api(page, {
      session: ATTENDANCE_SESSION,
      attendanceSaveState,
      groupPersistState,
    })

    for (const viewport of ATTENDANCE_GEO_VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto(`/groups/${GROUP_ID}/edit`)

      const nameInput = page.getByRole('textbox', { name: 'Название группы' })
      const clientAction = page
        .getByTestId(`group-client-row-${CLIENT_ID}`)
        .getByRole('button', { name: `Открыть карточку клиента ${CLIENT_FULL_NAME}` })

      await expect(clientAction).toBeVisible()
      const actionBox = await clientAction.boundingBox()
      expect(actionBox).not.toBeNull()
      expect(actionBox!.width).toBeGreaterThanOrEqual(44)
      expect(actionBox!.height).toBeGreaterThanOrEqual(44)

      await nameInput.fill(`Черновик ${viewport.name}`)
      await nameInput.blur()
      await expect(nameInput).toHaveValue(`Черновик ${viewport.name}`)
      await clientAction.click()
      const dialog = page.getByRole('dialog', { name: 'Сохранить изменения в группе?' })
      await expect(dialog).toBeVisible()

      for (const name of ['Сохранить', 'Не сохранять', 'Отмена']) {
        const button = dialog.getByRole('button', { name, exact: true })
        const box = await button.boundingBox()
        expect(box).not.toBeNull()
        expect(box!.height).toBeGreaterThanOrEqual(44)
      }

      await expectNoHorizontalOverflow(page)
      await dialog.getByRole('button', { name: 'Отмена', exact: true }).click()
    }
  })

  test('Карточка клиента в attendance не роняет горизонтальный скролл по заданной геометрии', async ({
    page,
  }) => {
    const attendanceSaveState = createAttendanceSaveState()
    const groupPersistState = createGroupPersistState()

    await mockTask116Api(page, {
      session: ATTENDANCE_SESSION,
      attendanceSaveState,
      groupPersistState,
    })

    for (const viewport of ATTENDANCE_GEO_VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto(ATTENDANCE_PATH)

      const cardAction = page
        .getByTestId(`attendance-client-card-${CLIENT_ID}`)
        .getByRole('button', { name: `Открыть карточку клиента ${CLIENT_FULL_NAME}` })
      await expect(page.getByTestId('attendance-screen')).toBeVisible()
      await expect(cardAction).toBeVisible()
      const geometry = await cardAction.boundingBox()
      expect(geometry).not.toBeNull()
      expect(geometry!.width).toBeGreaterThanOrEqual(44)
      expect(geometry!.height).toBeGreaterThanOrEqual(44)

      await expectNoHorizontalOverflow(page)

      expect(viewport.name).toBeTruthy()
    }
  })
})

test.describe('TASK-018 · карточка и формы клиента', () => {
  const lastName = 'Александрова-Воскресенская'
  const fullName = lastName + ' Маргарита Константиновна'
  const profile = '/clients/' + CLIENT_ID
  const portrait = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64')

  test.beforeEach(async ({ page }) => {
    await mockTask116Api(page, {
      session: ATTENDANCE_SESSION,
      attendanceSaveState: createAttendanceSaveState(),
      groupPersistState: createGroupPersistState(),
    })
    const client = {
      ...CLIENT_DETAILS_RESPONSE, lastName, firstName: 'Маргарита', middleName: 'Константиновна', fullName,
      photo: { path: 'portrait.png', contentType: 'image/png' }, hasCurrentMembership: true,
      currentMemberships: [{
        id: 'member', saleId: 'sale', membershipName: 'Месяц', behaviorKind: 'Term',
        purchaseDate: '2026-03-01', paymentDate: '2026-03-01', expirationDate: '2026-04-01',
        grossAmount: 1500, pricingMode: 'Catalog', coverageKind: 'TargetGroups', entitlementState: 'Expired',
      }],
      actionHints: [{ title: 'Продлить абонемент', description: 'Абонемент просрочен', tone: 'orange', iconKey: 'membership' }],
    }
    await page.route(url => url.pathname === '/api' + profile, route => route.fulfill({ json: client }))
    await page.route(url => url.pathname === '/api/clients', route => route.fulfill({
      json: { items: [client], totalCount: 1, activeCount: 1, archivedCount: 0 },
    }))
    await page.route(url => url.pathname === '/api' + profile + '/photo', route => route.fulfill({
      contentType: 'image/png',
      body: portrait,
    }))
    await page.route(url => url.pathname.endsWith('/messenger/telegram'), route => route.fulfill({
      json: { capabilities: { visible: true, canCreateLink: true }, connection: { status: 'NotConnected' } },
    }))
  })

  test('краткая карточка объединяет тип и предупреждение перед филиалом', async ({ page }) => {
    await page.goto(profile + '/preview')
    const panel = page.getByTestId('client-preview-panel')
    await expect(panel.getByText(fullName)).toBeVisible()
    await expect(panel.getByText('Активный', { exact: true })).toHaveCount(1)
    const membership = panel.getByRole('note', { name: 'Состояние абонемента' })
    await expect(membership.getByText('На срок')).toBeVisible()
    await expect(membership.getByText('Абонемент просрочен')).toBeVisible()
    await expect(panel.getByText('Контакты', { exact: true })).toHaveCount(0)
    const warning = await membership.boundingBox()
    const branch = await panel.getByText('Филиал', { exact: true }).boundingBox()
    expect(warning!.y + warning!.height).toBeLessThanOrEqual(branch!.y + 1)
    await expectNoHorizontalOverflow(page)
  })

  test('полная карточка один раз показывает имя и состояние Telegram', async ({ page }) => {
    const messengerRequests: string[] = []
    page.on('request', request => {
      if (request.url().includes('/messenger/telegram')) messengerRequests.push(request.url())
    })
    await page.goto(profile)
    await expect(page.getByRole('heading', { level: 1, name: fullName })).toBeVisible()
    await expect(page.getByRole('heading', { name: fullName })).toHaveCount(1)
    const info = page.getByRole('tab', { name: 'Основная информация' })
    await expect(info).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tab')).toHaveCount(5)
    expect(messengerRequests).toEqual([])
    await info.focus()
    await page.keyboard.press('End')
    const messages = page.getByRole('tab', { name: 'Сообщения' })
    await expect(messages).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(messages).toHaveAttribute('aria-selected', 'true')
    await expect(page).toHaveURL(/#messages$/)
    await page.reload()
    await expect(messages).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('button', { name: 'Ссылка и QR' })).toHaveCount(1)
    await expect(page.getByText('Клиент еще не подключил Telegram')).toBeVisible()
    await expect(page.getByText('Telegram не подключен.', { exact: true })).toHaveCount(0)
    await expectNoHorizontalOverflow(page)
  })

  test('посещения догружаются со следующей позиции', async ({ page }) => {
    await page.route(url => url.pathname === '/api' + profile, route => {
      const skip = new URL(route.request().url()).searchParams.get('attendanceSkip')
      return route.fulfill({ json: { ...CLIENT_DETAILS_RESPONSE, attendanceHistoryTotalCount: 2,
        attendanceHistory: [{ id: skip === '1' ? 'older' : 'recent', isPresent: true, trainingDate: '2026-04-17',
          groupName: skip === '1' ? 'Вторая группа' : 'Первая группа' }] } })
    })
    await page.goto(profile + '#visits')
    await expect(page.getByText('Первая группа')).toBeVisible()
    await page.getByRole('button', { name: 'Показать ещё посещения' }).click()
    await expect(page.getByText('Вторая группа')).toBeVisible()
    await expect(page.getByText('Первая группа')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Показать ещё посещения' })).toHaveCount(0)
  })

  test('тренеру прямой фрагмент переписки открывает доступный профиль', async ({ page }) => {
    const requests: string[] = []
    page.on('request', request => {
      if (request.url().includes('/messenger/telegram')) requests.push(request.url())
    })
    await page.route(url => url.pathname === '/api/auth/session', route => route.fulfill({ json: {
      ...ATTENDANCE_SESSION, user: { ...ATTENDANCE_SESSION.user, permissions: {
        ...ATTENDANCE_SESSION.user.permissions, canManageClients: false, canViewClientMessenger: false,
      } },
    } }))
    await page.goto(profile + '#messages')
    await expect(page.getByRole('tab', { name: 'Основная информация' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tab')).toHaveCount(3)
    await expect(page.getByRole('tab', { name: 'Сообщения' })).toHaveCount(0)
    await expect(page.getByLabel('Telegram', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('tab', { name: 'Абонементы' })).toHaveCount(0)
    expect(requests).toEqual([])
  })

  test('сохранённое фото перед полями открывается с клавиатуры', async ({ page }) => {
    await page.goto(profile + '/edit')
    const photo = page.getByRole('button', { name: /Открыть фотографию/ })
    await expect(photo).toBeEnabled()
    const surname = await page.getByLabel('Фамилия', { exact: true }).boundingBox()
    const image = await photo.boundingBox()
    if ((page.viewportSize()?.width ?? 0) < 600) {
      expect(image!.y + image!.height).toBeLessThanOrEqual(surname!.y)
    } else {
      expect(image!.x).toBeGreaterThanOrEqual(surname!.x + surname!.width)
    }
    await photo.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog').getByRole('img', { name: 'Фотография клиента ' + fullName })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(photo).toBeFocused()
    await expectNoHorizontalOverflow(page)
  })

  test('создание оставляет подсказку о фото и добавляет поля контакта по запросу', async ({ page }) => {
    await page.goto('/clients/new')
    await expect(page.getByLabel('Фамилия', { exact: true })).toBeVisible()
    await expect(page.getByText('Фотографию можно добавить после сохранения клиента.')).toBeVisible()
    await expect(page.getByText('Фото пока не показано')).toHaveCount(0)
    await expect(page.getByText('Контактные лица пока не добавлены.')).toHaveCount(0)
    await page.getByRole('button', { name: 'Добавить контакт' }).click()
    await expect(page.getByLabel('ФИО контактного лица')).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })

  test('ошибка замены сохраняет снимок и допускает повтор с тем же файлом', async ({ page }) => {
    let uploads = 0
    await page.route(url => url.pathname.endsWith('/photo'), route => {
      if (route.request().method() !== 'POST') return route.fallback()
      uploads++
      return route.fulfill(uploads === 1
        ? { status: 503, json: { title: 'Файл не сохранён' } }
        : { status: 204 })
    })
    await page.goto(profile + '/edit')
    const photo = page.getByRole('button', { name: /Открыть фотографию/ })
    await expect(photo).toBeEnabled()
    const surname = page.getByLabel('Фамилия', { exact: true })
    await surname.fill('Черновик')
    const file = { name: 'portrait.png', mimeType: 'image/png', buffer: portrait }
    await page.locator('input[type=file]').setInputFiles(file)
    await expect(page.getByText('Фото не загружено')).toBeVisible()
    await expect(surname).toHaveValue('Черновик')
    await expect(photo).toBeEnabled()
    await page.locator('input[type=file]').setInputFiles(file)
    await expect(page.getByText('Фотография обновлена')).toBeVisible()
    await expect(photo).toBeEnabled()
    expect(uploads).toBe(2)
  })

  test('ошибка чтения фотографии позволяет повторить просмотр с сохранением ввода', async ({ page }) => {
    await page.route(url => url.pathname.endsWith('/photo'), route => route.fulfill({ status: 503 }), { times: 1 })
    await page.goto(profile + '/edit')
    const surname = page.getByLabel('Фамилия', { exact: true })
    await surname.fill('Черновик')
    await page.getByRole('button', { name: 'Повторить просмотр' }).click()
    await expect(page.getByRole('button', { name: /Открыть фотографию/ })).toBeEnabled()
    await expect(surname).toHaveValue('Черновик')
  })
})
