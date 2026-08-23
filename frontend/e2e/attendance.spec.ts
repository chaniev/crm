import { expect, test, type Page } from '@playwright/test'

const APP_CONFIG = {
  clubName: 'Iron Club',
  themeId: 'default-green-v1',
  authBackgroundImageId: 'k4pro-login-v1',
} as const
const COACH_LOGIN = 'coach'
const COACH_PASSWORD = 'coach-password'
const FIXED_TRAINING_DATE = '2026-04-18'
const GROUP_ID = 'group-1'
const CLIENT_ID = 'client-1'
const CLIENT_FULL_NAME = 'Иван Иванов'
const PROFESSIONAL_CLIENT_ID = 'client-professional'
const PROFESSIONAL_CLIENT_FULL_NAME = 'Проф Клиент'
const ABSENT_CLIENT_ID = 'client-absent'
const ABSENT_CLIENT_FULL_NAME = 'Отсутствующий Клиент'

const unauthenticatedSession = {
  isAuthenticated: false,
  csrfToken: '',
  user: null,
  bootstrapMode: false,
}

const coachSession = {
  isAuthenticated: true,
  csrfToken: 'coach-csrf-token',
  bootstrapMode: false,
  user: {
    id: 'coach-id',
    fullName: 'Тренер группы',
    login: COACH_LOGIN,
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
    assignedGroupIds: [GROUP_ID],
  },
}

const administratorAttendanceSession = {
  ...coachSession,
  csrfToken: 'administrator-attendance-csrf-token',
  user: {
    ...coachSession.user,
    assignedGroupIds: [],
    branchId: 'branch-1',
    fullName: 'Администратор филиала',
    id: 'administrator-id',
    login: 'administrator',
    role: 'Administrator',
  },
} as const

const coachWithoutAssignmentSession = {
  ...coachSession,
  csrfToken: 'coach-empty-scope-csrf-token',
  user: {
    ...coachSession.user,
    assignedGroupIds: [],
  },
} as const

const assignedGroup = {
  id: GROUP_ID,
  name: 'Группа 7: вечер',
  trainingStartTime: '19:00',
  durationMinutes: 60,
  weekdays: [2, 4],
  clientCount: 3,
}

test.describe('Мобильный сценарий посещений тренера', () => {
  test.use({
    viewport: {
      width: 390,
      height: 844,
    },
  })

  test('Coach попадает на экран посещений и отмечает клиента в назначенной группе', async ({
    page,
  }) => {
    let attendanceState = 'Unmarked'
    let savedAttendancePayload: Record<string, unknown> | null = null

    await mockApi(page, async ({ method, pathname, route, searchParams }) => {
      if (pathname === '/api/auth/session' && method === 'GET') {
        await fulfillJson(route, 200, unauthenticatedSession)
        return true
      }

      if (pathname === '/api/auth/login' && method === 'POST') {
        const payload = route.request().postDataJSON()

        expect(payload).toEqual({
          login: COACH_LOGIN,
          password: COACH_PASSWORD,
        })

        await fulfillJson(route, 200, coachSession)
        return true
      }

      if (pathname === '/api/attendance/groups' && method === 'GET') {
        await fulfillJson(route, 200, {
          groups: [assignedGroup],
          today: FIXED_TRAINING_DATE,
          maxTrainingDate: FIXED_TRAINING_DATE,
        })
        return true
      }

      if (
        pathname === `/api/attendance/groups/${GROUP_ID}/clients` &&
        method === 'GET'
      ) {
        const requestedTrainingDate =
          searchParams.get('trainingDate') ?? FIXED_TRAINING_DATE

        await fulfillJson(route, 200, buildRosterPayload(requestedTrainingDate, attendanceState))
        return true
      }

      if (
        pathname === `/api/attendance/groups/${GROUP_ID}` &&
        method === 'POST'
      ) {
        expect(route.request().headers()['x-csrf-token']).toBe(
          coachSession.csrfToken,
        )

        savedAttendancePayload =
          route.request().postDataJSON() as Record<string, unknown>
        const requestPayload = savedAttendancePayload as {
          AttendanceMarks?: Array<{ State?: string }>
        }
        attendanceState = requestPayload.AttendanceMarks?.[0]?.State ?? attendanceState

        await fulfillJson(route, 200, {
          groupId: GROUP_ID,
          trainingDate: FIXED_TRAINING_DATE,
          today: FIXED_TRAINING_DATE,
          maxTrainingDate: FIXED_TRAINING_DATE,
          attendanceMarks: [{ clientId: CLIENT_ID, state: attendanceState }],
        })
        return true
      }

      return false
    })

    await page.goto('/attendance')

    await page.getByLabel('Логин').fill(COACH_LOGIN)
    await page.getByLabel('Пароль').fill(COACH_PASSWORD)
    await page.getByRole('button', { name: 'Войти' }).click()

    await expect(page).toHaveURL('/attendance')
    await expect(page.getByTestId('attendance-screen')).toBeVisible()

    const sideNavigation = page.locator(
      'nav.app-shell__side-nav[aria-label="Основная навигация"]',
    )
    const bottomNavigation = page.getByRole('navigation', {
      name: 'Мобильная навигация',
    })

    await expect(sideNavigation).toBeHidden()
    await expect(
      page.getByRole('button', { name: 'Открыть основное меню' }),
    ).toHaveCount(0)
    await expect(bottomNavigation).toBeVisible()
    await expect(bottomNavigation.getByRole('button')).toHaveCount(3)
    await expect(
      bottomNavigation.getByRole('button', { name: 'Посещения' }),
    ).toHaveAttribute('aria-current', 'page')
    await expect(
      bottomNavigation.getByRole('button', { name: 'Расписание' }),
    ).toBeVisible()
    await expect(
      bottomNavigation.getByRole('button', { name: 'Клиенты' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Открыть остальные разделы' }),
    ).toHaveCount(0)

    await expect(page.getByTestId('attendance-screen')).toBeVisible()
    await expect(page.getByRole('heading', { name: assignedGroup.name })).toHaveCount(0)
    await expect(page.getByText('Показывать клиентов')).toBeVisible()
    await expect(page.getByText(CLIENT_FULL_NAME)).toBeVisible()
    await expect(page.getByText(ABSENT_CLIENT_FULL_NAME)).toHaveCount(0)
    await expect(page.getByText('Проблема с абонементом')).toBeVisible()
    await expect(page.getByText('Не оплачено')).toHaveCount(0)
    await expect(
      page.getByText('Абонемент просрочен, отметка посещения доступна.'),
    ).toBeVisible()
    const professionalCard = page.getByTestId(
      `attendance-client-card-${PROFESSIONAL_CLIENT_ID}`,
    )
    await expect(professionalCard).toContainText('Профессиональный статус')
    await expect(professionalCard).toContainText('Профессионал')
    await expect(professionalCard).not.toContainText('Не оплачено')
    await expect(professionalCard).not.toContainText('Проблема с абонементом')

    const trainingDateInput = page.getByLabel('Дата тренировки')
    await expect(trainingDateInput).toBeVisible()
    await trainingDateInput.fill(FIXED_TRAINING_DATE)

    const clientCard = page.getByTestId(`attendance-client-card-${CLIENT_ID}`)

    const dateInput = page.getByTestId('attendance-date-input')
    const dateInputBox = await dateInput.boundingBox()
    expect(dateInputBox).not.toBeNull()
    expect(dateInputBox!.width).toBeGreaterThanOrEqual(176)
    expect(await dateInput.evaluate((element) => (element as HTMLInputElement).value)).toBe(
      FIXED_TRAINING_DATE,
    )
    const dateInputOverflow = await dateInput.evaluate((element) => ({
      clientWidth: (element as HTMLElement).clientWidth,
      scrollWidth: (element as HTMLElement).scrollWidth,
    }))
    expect(dateInputOverflow.scrollWidth).toBeLessThanOrEqual(dateInputOverflow.clientWidth)

    const groupSelect = page.getByTestId('attendance-group-select')
    const datePrevious = page.getByRole('button', { name: 'Предыдущая дата' })
    const dateToday = page.getByRole('button', { name: 'Сегодня' })
    const dateNext = page.getByRole('button', { name: 'Следующая дата' })

    await trainingDateInput.fill('2026-04-17')
    await expect(trainingDateInput).toHaveValue('2026-04-17')
    await expect(clientCard).toBeVisible()

    await groupSelect.focus()
    await expect(groupSelect).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(trainingDateInput).toBeFocused()
    await pressTabUntilFocused(page, datePrevious)
    await page.keyboard.press('Tab')
    await expect(dateToday).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(dateNext).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(
      page.getByTestId('attendance-roster-view-control').getByRole('radio', {
        name: 'Не отмечено',
        exact: true,
      }),
    ).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Обновить список' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(
      clientCard.getByRole('radio', { name: 'Не отмечено', exact: true }),
    ).toBeFocused()

    await trainingDateInput.fill(FIXED_TRAINING_DATE)
    await expect(trainingDateInput).toHaveValue(FIXED_TRAINING_DATE)
    await expect(clientCard).toBeVisible()

    for (const control of [groupSelect, dateInput, datePrevious, dateToday, dateNext]) {
      const box = await control.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.height).toBeGreaterThanOrEqual(44)
    }

    const [groupBox, previousBox, todayBox, nextBox] = await Promise.all([
      groupSelect.boundingBox(),
      datePrevious.boundingBox(),
      dateToday.boundingBox(),
      dateNext.boundingBox(),
    ])

    expect(groupBox).not.toBeNull()
    expect(previousBox).not.toBeNull()
    expect(todayBox).not.toBeNull()
    expect(nextBox).not.toBeNull()

    const isDateControlsRow =
      Math.abs((previousBox!.y - todayBox!.y)) < 3 &&
      Math.abs((todayBox!.y - nextBox!.y)) < 3

    if (isDateControlsRow) {
      expect(todayBox!.x - (previousBox!.x + previousBox!.width)).toBeGreaterThanOrEqual(8)
      expect(nextBox!.x - (todayBox!.x + todayBox!.width)).toBeGreaterThanOrEqual(8)
    } else {
      expect(todayBox!.y - (previousBox!.y + previousBox!.height)).toBeGreaterThanOrEqual(8)
      expect(nextBox!.y - (todayBox!.y + todayBox!.height)).toBeGreaterThanOrEqual(8)
    }

    const firstAction = clientCard.getByRole('radio', { exact: true, name: 'Был' })
    await expect(firstAction).toBeVisible()
    const firstActionBox = await firstAction.boundingBox()
    const navigation = page.getByRole('navigation', { name: 'Мобильная навигация' })
    const navigationBox = await navigation.boundingBox()
    expect(firstActionBox).not.toBeNull()
    expect(navigationBox).not.toBeNull()
    expect(firstActionBox!.y + firstActionBox!.height).toBeLessThanOrEqual(
      navigationBox!.y - 8,
    )

    const pageGeometry = await page.evaluate(() => ({
      documentScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      bodyScrollWidth: document.body.scrollWidth,
    }))

    expect(pageGeometry.documentScrollWidth).toBeLessThanOrEqual(pageGeometry.viewportWidth + 1)
    expect(pageGeometry.bodyScrollWidth).toBeLessThanOrEqual(pageGeometry.viewportWidth + 1)

    await clientCard.getByText('Был', { exact: true }).click()

    await expect
      .poll(() => savedAttendancePayload)
      .toEqual({
        TrainingDate: FIXED_TRAINING_DATE,
        AttendanceMarks: [
          {
            ClientId: CLIENT_ID,
            State: 'Present',
          },
        ],
      })

    await expect(clientCard).toHaveCount(0)
    await expect(page.getByText('Отмечено 2 из 3')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Следующая дата' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Следующая дата' })).toHaveAttribute('title', 'Будущие даты недоступны')

    const rosterViewControl = page.getByTestId('attendance-roster-view-control')
    await rosterViewControl.getByText('Все', { exact: true }).click()
    const savedClientCard = page.getByTestId(`attendance-client-card-${CLIENT_ID}`)
    const absentClientCard = page.getByTestId(`attendance-client-card-${ABSENT_CLIENT_ID}`)
    await expect(savedClientCard.getByRole('radio', { name: 'Был', exact: true })).toBeChecked()
    await expect(absentClientCard.getByRole('radio', { name: 'Не был' })).toBeChecked()

    await savedClientCard.getByText('Не был', { exact: true }).click()
    await expect.poll(() => savedAttendancePayload).toMatchObject({
      AttendanceMarks: [{ ClientId: CLIENT_ID, State: 'Absent' }],
    })
    await expect(savedClientCard.getByRole('radio', { name: 'Не был' })).toBeChecked()

    await savedClientCard.getByText('Не отмечено', { exact: true }).click()
    await expect.poll(() => savedAttendancePayload).toMatchObject({
      AttendanceMarks: [{ ClientId: CLIENT_ID, State: 'Unmarked' }],
    })
    await expect(savedClientCard.getByRole('radio', { name: 'Не отмечено' })).toBeChecked()
    await expect(page.getByText('Отмечено 1 из 3')).toBeVisible()
    await rosterViewControl.getByText('Не отмечено', { exact: true }).click()
    await expect(page.getByText(CLIENT_FULL_NAME)).toBeVisible()
    await expect(page.getByText(ABSENT_CLIENT_FULL_NAME)).toHaveCount(0)
  })
})

test.describe('TASK-111 attendance role and scope regression', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('Administrator consumes the backend-issued attendance group grant', async ({ page }) => {
    await mockAttendanceWorkspace(
      page,
      administratorAttendanceSession,
      [assignedGroup],
    )

    await page.goto('/attendance')

    await expect(page.getByTestId('attendance-screen')).toBeVisible()
    await expect(page.getByTestId('attendance-group-select')).toHaveValue(assignedGroup.name)
    await expect(page.getByTestId(`attendance-client-card-${CLIENT_ID}`)).toBeVisible()
    await expect(page.getByText(CLIENT_FULL_NAME)).toBeVisible()
  })

  test('Coach without an assigned backend scope gets the restricted empty state', async ({
    page,
  }) => {
    let rosterRequests = 0
    await mockAttendanceWorkspace(page, coachWithoutAssignmentSession, [], () => {
      rosterRequests += 1
    })

    await page.goto('/attendance')

    await expect(page.getByTestId('attendance-screen')).toBeVisible()
    await expect(page.getByText('Назначенные группы отсутствуют')).toBeVisible()
    await expect(page.getByText(
      'Когда вам назначат группу, экран посещений автоматически покажет рабочий список.',
    )).toBeVisible()
    await expect(page.getByTestId('attendance-roster')).toHaveCount(0)
    expect(rosterRequests).toBe(0)
  })
})

function buildRosterPayload(trainingDate: string, state: string) {
  return {
    groupId: GROUP_ID,
    trainingDate,
    today: FIXED_TRAINING_DATE,
    maxTrainingDate: FIXED_TRAINING_DATE,
    clients: [
      {
        id: CLIENT_ID,
        fullName: CLIENT_FULL_NAME,
        state,
        hasActiveMembership: false,
        membershipWarning: true,
        membershipWarningMessage:
          'Абонемент просрочен, отметка посещения доступна.',
        groups: [
          {
            id: GROUP_ID,
            name: assignedGroup.name,
            isActive: true,
          },
        ],
      },
      {
        id: PROFESSIONAL_CLIENT_ID,
        fullName: PROFESSIONAL_CLIENT_FULL_NAME,
        state: 'Unmarked',
        isProfessional: true,
        professionalComment: 'Сборная',
        hasActiveMembership: true,
        membershipWarning: false,
        groups: [
          {
            id: GROUP_ID,
            name: assignedGroup.name,
            isActive: true,
          },
        ],
      },
      {
        id: ABSENT_CLIENT_ID,
        fullName: ABSENT_CLIENT_FULL_NAME,
        state: 'Absent',
        hasActiveMembership: true,
        membershipWarning: false,
        groups: [
          {
            id: GROUP_ID,
            name: assignedGroup.name,
            isActive: true,
          },
        ],
      },
    ],
  }
}

async function mockAttendanceWorkspace(
  page: Page,
  session: typeof administratorAttendanceSession | typeof coachWithoutAssignmentSession,
  groups: readonly (typeof assignedGroup)[],
  onRosterRequest?: () => void,
) {
  await mockApi(page, async ({ method, pathname, route, searchParams }) => {
    if (pathname === '/api/auth/session' && method === 'GET') {
      await fulfillJson(route, 200, session)
      return true
    }

    if (pathname === '/api/attendance/groups' && method === 'GET') {
      await fulfillJson(route, 200, {
        groups,
        today: FIXED_TRAINING_DATE,
        maxTrainingDate: FIXED_TRAINING_DATE,
      })
      return true
    }

    if (
      pathname === `/api/attendance/groups/${GROUP_ID}/clients`
      && method === 'GET'
    ) {
      onRosterRequest?.()
      await fulfillJson(
        route,
        200,
        buildRosterPayload(
          searchParams.get('trainingDate') ?? FIXED_TRAINING_DATE,
          'Unmarked',
        ),
      )
      return true
    }

    return false
  })
}

type MockApiContext = {
  method: string
  pathname: string
  route: Parameters<Page['route']>[1] extends (route: infer T) => unknown ? T : never
  searchParams: URLSearchParams
}

async function mockApi(
  page: Page,
  handler: (context: MockApiContext) => Promise<boolean>,
) {
  await page.route('**/api/**', async (route) => {
    const requestUrl = new URL(route.request().url())
    if (!requestUrl.pathname.startsWith('/api/')) {
      await route.continue()
      return
    }

    if (requestUrl.pathname === '/api/config' && route.request().method() === 'GET') {
      await fulfillJson(route, 200, APP_CONFIG)
      return
    }

    const handled = await handler({
      method: route.request().method(),
      pathname: requestUrl.pathname,
      route,
      searchParams: requestUrl.searchParams,
    })

    if (!handled) {
      throw new Error(
        `Unexpected API request in attendance e2e: ${route.request().method()} ${requestUrl.pathname}`,
      )
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

async function pressTabUntilFocused(
  page: Page,
  target: ReturnType<Page['locator']>,
  maxPresses = 4,
) {
  for (let press = 0; press < maxPresses; press += 1) {
    await page.keyboard.press('Tab')
    if (await target.evaluate((element) => element === document.activeElement)) return
  }

  await expect(target).toBeFocused()
}
