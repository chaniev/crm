import { expect, test, type Page } from '@playwright/test'

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
  currentMembership: null,
  currentMembershipSummary: null,
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
    clientDetailsStatus?: 200 | 403 | 404
  },
) {
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

    if (context.pathname === '/api/attendance/groups' && context.method === 'GET') {
      await fulfillJson(context.route, 200, ATTENDANCE_GROUPS_RESPONSE)
      return
    }

    if (
      context.pathname === `/api/attendance/groups/${GROUP_ID}/clients` &&
      context.method === 'GET'
    ) {
      const requestedTrainingDate = context.searchParams.get('trainingDate') ?? ATTENDANCE_TODAY
      await fulfillJson(
        context.route,
        200,
        buildRosterPayload(requestedTrainingDate),
      )
      return
    }

    if (
      context.pathname === `/api/attendance/groups/${GROUP_ID}` &&
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
      }
      const marked = requestPayload.AttendanceMarks?.[0]
      const trainingDate =
        requestPayload.TrainingDate ?? context.searchParams.get('trainingDate') ?? ATTENDANCE_TODAY

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
      attendanceSaveState,
      groupPersistState,
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/attendance')

    const dateInput = page.getByTestId('attendance-date-input')
    const groupSelect = page.getByTestId('attendance-group-select')
    const rosterViewControl = page.getByTestId('attendance-roster-view-control')

    await expect(page.getByTestId('attendance-screen')).toBeVisible()
    await dateInput.fill('2026-04-17')
    await rosterViewControl.getByText('Все', { exact: true }).click()

    await expect(groupSelect).toHaveValue(ATTENDANCE_GROUP.name)
    await expect(dateInput).toHaveValue('2026-04-17')
    await expect(
      rosterViewControl.getByRole('radio', { name: 'Все', exact: true }),
    ).toBeChecked()

    const clientAction = page
      .getByTestId(`attendance-client-card-${CLIENT_ID}`)
      .getByRole('button', { name: `Открыть карточку клиента ${CLIENT_FULL_NAME}` })

    await expect(clientAction).toBeVisible()
    await clientAction.focus()
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(new RegExp(`/clients/${CLIENT_ID}(?:/|$)`))
    await expect(page.getByRole('button', { name: 'К посещениям' })).toBeVisible()

    await page.getByRole('button', { name: 'К посещениям' }).click()

    await expect(page).toHaveURL('/attendance')
    await expect(page.getByTestId('attendance-screen')).toBeVisible()
    await expect(groupSelect).toHaveValue(ATTENDANCE_GROUP.name)
    await expect(dateInput).toHaveValue('2026-04-17')
    await expect(
      rosterViewControl.getByRole('radio', { name: 'Все', exact: true }),
    ).toBeChecked()
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
    await page.goto('/attendance')

    await page
      .getByTestId('attendance-roster-view-control')
      .getByText('Все', { exact: true })
      .click()
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

    await page.goto('/attendance')
    await page
      .getByTestId(`attendance-client-card-${CLIENT_ID}`)
      .getByRole('button', { name: `Открыть карточку клиента ${CLIENT_FULL_NAME}` })
      .click()

    await expect(page.getByText('Карточка клиента не загрузилась')).toBeVisible()
    await expect(page.getByText('Нет доступа')).toBeVisible()
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
      await page.goto('/attendance')

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
