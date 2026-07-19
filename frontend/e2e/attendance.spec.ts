import { expect, test, type Page } from '@playwright/test'

const APP_CONFIG = { clubName: 'Iron Club' } as const
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
    landingScreen: 'Home',
    allowedSections: ['Home', 'Clients'],
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

    await page.goto('/')

    await page.getByLabel('Логин').fill(COACH_LOGIN)
    await page.getByLabel('Пароль').fill(COACH_PASSWORD)
    await page.getByRole('button', { name: 'Войти' }).click()

    await expect(page).toHaveURL('/')
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
      bottomNavigation.getByRole('button', { name: 'Главная' }),
    ).toHaveAttribute('aria-current', 'page')
    await expect(
      bottomNavigation.getByRole('button', { name: 'Расписание' }),
    ).toBeVisible()
    await expect(
      bottomNavigation.getByRole('button', { name: 'Посещения' }),
    ).toHaveCount(0)
    await expect(
      bottomNavigation.getByRole('button', { name: 'Клиенты' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Открыть остальные разделы' }),
    ).toHaveCount(0)

    await expect(page.getByTestId('attendance-screen')).toBeVisible()
    await expect(page.getByRole('heading', { name: assignedGroup.name })).toBeVisible()
    await expect(page.getByText('Показывать клиентов')).toBeVisible()
    await expect(page.getByText(CLIENT_FULL_NAME)).toBeVisible()
    await expect(page.getByText(ABSENT_CLIENT_FULL_NAME)).toHaveCount(0)
    await expect(page.getByText('Проблема с абонементом')).toBeVisible()
    await expect(page.getByText('Не оплачено')).toBeVisible()
    await expect(
      page.getByText('Абонемент просрочен, отметка посещения доступна.'),
    ).toBeVisible()
    const professionalCard = page.getByTestId(
      `attendance-client-card-${PROFESSIONAL_CLIENT_ID}`,
    )
    await expect(professionalCard).toContainText('Льготный оплаченный статус')
    await expect(professionalCard).toContainText('Профессионал')
    await expect(professionalCard).not.toContainText('Не оплачено')
    await expect(professionalCard).not.toContainText('Проблема с абонементом')

    const trainingDateInput = page.getByLabel('Дата тренировки')
    await expect(trainingDateInput).toBeVisible()
    await trainingDateInput.fill(FIXED_TRAINING_DATE)

    await expect(page.getByText('18.04.2026', { exact: true })).toBeVisible()

    const clientCard = page.getByTestId(`attendance-client-card-${CLIENT_ID}`)
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
    await rosterViewControl.getByRole('radio', { name: 'Все' }).click()
    const savedClientCard = page.getByTestId(`attendance-client-card-${CLIENT_ID}`)
    const absentClientCard = page.getByTestId(`attendance-client-card-${ABSENT_CLIENT_ID}`)
    await expect(savedClientCard.getByRole('radio', { name: 'Был' })).toBeChecked()
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
    await rosterViewControl.getByRole('radio', { name: 'Не отмечено', exact: true }).click()
    await expect(page.getByText(CLIENT_FULL_NAME)).toBeVisible()
    await expect(page.getByText(ABSENT_CLIENT_FULL_NAME)).toHaveCount(0)
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
        hasActivePaidMembership: false,
        hasUnpaidCurrentMembership: true,
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
        hasActivePaidMembership: true,
        hasUnpaidCurrentMembership: false,
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
        hasActivePaidMembership: true,
        hasUnpaidCurrentMembership: false,
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
