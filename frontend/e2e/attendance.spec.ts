import { expect, test, type Page } from '@playwright/test'

const COACH_LOGIN = 'coach'
const COACH_PASSWORD = 'coach-password'
const FIXED_TRAINING_DATE = '2026-04-18'
const GROUP_ID = 'group-1'
const CLIENT_ID = 'client-1'
const CLIENT_FULL_NAME = 'Иван Иванов'

const unauthenticatedSession = {
  isAuthenticated: false,
  csrfToken: '',
  user: null,
}

const coachSession = {
  isAuthenticated: true,
  csrfToken: 'coach-csrf-token',
  user: {
    id: 'coach-id',
    fullName: 'Тренер группы',
    login: COACH_LOGIN,
    role: 'Coach',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Attendance',
    allowedSections: ['Attendance', 'Clients'],
    permissions: {
      canManageUsers: false,
      canManageClients: false,
      canManageGroups: false,
      canMarkAttendance: true,
      canViewAuditLog: false,
    },
    assignedGroupIds: [GROUP_ID],
  },
}

const assignedGroup = {
  id: GROUP_ID,
  name: 'Группа 7: вечер',
  trainingStartTime: '19:00',
  scheduleText: 'Вт, Чт',
  clientCount: 1,
}

test.describe('Мобильный attendance flow тренера', () => {
  test.use({
    viewport: {
      width: 390,
      height: 844,
    },
  })

  test('Coach попадает на экран посещений и отмечает клиента в назначенной группе', async ({
    page,
  }) => {
    let attendanceMarked = false
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
          items: [assignedGroup],
        })
        return true
      }

      if (
        pathname === `/api/attendance/groups/${GROUP_ID}/clients` &&
        method === 'GET'
      ) {
        const requestedTrainingDate =
          searchParams.get('trainingDate') ?? FIXED_TRAINING_DATE

        await fulfillJson(route, 200, buildRosterPayload(requestedTrainingDate, attendanceMarked))
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
        attendanceMarked = true

        await fulfillJson(route, 200, {})
        return true
      }

      return false
    })

    await page.goto('/')

    await page.getByLabel('Логин').fill(COACH_LOGIN)
    await page.getByLabel('Пароль').fill(COACH_PASSWORD)
    await page.getByRole('button', { name: 'Войти' }).click()

    await expect(page).toHaveURL(/\/attendance$/)
    await expect(page.getByTestId('attendance-screen')).toBeVisible()

    const navigationToggle = page.getByTestId('app-navigation-toggle')
    await expect(navigationToggle).toBeVisible()
    await navigationToggle.click()

    const mobileNavigation = page.getByTestId('app-navigation')

    await expect(mobileNavigation.getByRole('button')).toHaveCount(2)
    await expect(
      mobileNavigation.getByRole('button', { name: 'Посещения' }),
    ).toBeVisible()
    await expect(
      mobileNavigation.getByRole('button', { name: 'Клиенты' }),
    ).toBeVisible()

    await page
      .getByRole('button', { name: 'Скрыть навигацию' })
      .click()

    await expect(page.getByText('Назначенных групп: 1')).toBeVisible()
    await expect(page.getByText(`Клиенты группы ${assignedGroup.name}`)).toBeVisible()
    await expect(page.getByText(CLIENT_FULL_NAME)).toBeVisible()
    await expect(page.getByText('Проблема с абонементом')).toBeVisible()
    await expect(page.getByText('Не оплачено')).toBeVisible()
    await expect(
      page.getByText('Абонемент просрочен, но backend разрешает отметку посещения.'),
    ).toBeVisible()

    const trainingDateInput = page.getByLabel('Дата тренировки')
    await trainingDateInput.fill(FIXED_TRAINING_DATE)

    await expect(page.getByText('Дата: 18.04.2026')).toBeVisible()

    const attendanceToggle = page.getByLabel(
      `Отметка посещения для клиента ${CLIENT_FULL_NAME}`,
    )

    await expect(attendanceToggle).not.toBeChecked()
    await attendanceToggle.click()

    await expect
      .poll(() => savedAttendancePayload)
      .toEqual({
        TrainingDate: FIXED_TRAINING_DATE,
        AttendanceMarks: [
          {
            ClientId: CLIENT_ID,
            IsPresent: true,
          },
        ],
      })

    await expect(attendanceToggle).toBeChecked()
    await expect(page.getByText('Присутствовал')).toBeVisible()
  })
})

function buildRosterPayload(trainingDate: string, isPresent: boolean) {
  return {
    groupId: GROUP_ID,
    trainingDate,
    items: [
      {
        id: CLIENT_ID,
        fullName: CLIENT_FULL_NAME,
        isPresent,
        hasActivePaidMembership: false,
        hasUnpaidCurrentMembership: true,
        membershipWarning: true,
        membershipWarningMessage:
          'Абонемент просрочен, но backend разрешает отметку посещения.',
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
