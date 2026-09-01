import { expect, test, type Page, type Route } from '@playwright/test'

const TODAY = '2026-04-18'
const OCCURRENCE_ID = 'occ-today-evening'
const GROUP_ID = 'group-1'
const CLIENT_ID = 'client-1'

const session = {
  isAuthenticated: true,
  csrfToken: 'coach-csrf-token',
  bootstrapMode: false,
  user: {
    id: 'coach-id',
    fullName: 'Тренер группы',
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
    assignedGroupIds: [GROUP_ID],
  },
}

test.describe('TASK-168 today attendance worklist', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('opens the exact occurrence and refreshes the source list on browser back', async ({ page }) => {
    let todayRequests = 0
    let workbenchOpened = false

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url())
      const method = route.request().method()

      if (!url.pathname.startsWith('/api/')) {
        await route.continue()
        return
      }

      if (url.pathname === '/api/config' && method === 'GET') {
        await fulfillJson(route, {
          clubName: 'Iron Club',
          themeId: 'default-green-v1',
          authBackgroundImageId: 'k4pro-login-v1',
        })
        return
      }

      if (url.pathname === '/api/auth/session' && method === 'GET') {
        await fulfillJson(route, session)
        return
      }

      if (url.pathname === '/api/attendance/lessons/today' && method === 'GET') {
        todayRequests += 1
        await fulfillJson(route, {
          today: TODAY,
          items: workbenchOpened ? [] : [{
            lessonOccurrenceId: OCCURRENCE_ID,
            lessonDate: TODAY,
            groupId: GROUP_ID,
            groupName: 'Группа с очень длинным названием для мобильной проверки',
            startTime: '19:00',
            endTime: '20:00',
            branchName: 'Центральный филиал с длинным названием',
            hallName: 'Большой зал',
            effectiveTrainers: [{
              trainerId: 'trainer-1',
              fullName: 'Александра Константинопольская',
              kind: 'Permanent',
            }],
            openAttendance: { allowed: true, reason: null },
            unmarkedClientCount: 3,
          }],
        })
        return
      }

      if (
        url.pathname === `/api/attendance/lessons/${OCCURRENCE_ID}/clients`
        && method === 'GET'
      ) {
        workbenchOpened = true
        expect(url.searchParams.get('lessonDate')).toBe(TODAY)
        await fulfillJson(route, attendanceRoster())
        return
      }

      throw new Error(`Unexpected TASK-168 API request: ${method} ${url.pathname}`)
    })

    await page.goto('/attendance')

    const row = page.getByTestId(`attendance-today-row-${OCCURRENCE_ID}`)
    await expect(row).toContainText('Не отмечено 3')
    await expect(row.getByRole('button', { name: /Открыть:/ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Посещения' })).toHaveCount(1)
    await expect(page.getByText('Посещаемость открывается из занятия')).toHaveCount(0)
    await expectNoHorizontalScroll(page)

    await row.getByRole('button', { name: /Открыть:/ }).click()
    await expect(page).toHaveURL(`/attendance/${OCCURRENCE_ID}?lessonDate=${TODAY}`)
    await expect(page.getByTestId(`attendance-client-card-${CLIENT_ID}`)).toBeVisible()

    await page.goBack()

    await expect(page).toHaveURL('/attendance')
    await expect(page.getByText('На сегодня всё отмечено')).toBeVisible()
    await expect(page.getByTestId('attendance-today-refresh')).toBeFocused()
    await expectNoHorizontalScroll(page)
    expect(todayRequests).toBeGreaterThanOrEqual(2)
  })
})

function attendanceRoster() {
  return {
    groupId: GROUP_ID,
    trainingDate: TODAY,
    lessonOccurrenceId: OCCURRENCE_ID,
    lessonDate: TODAY,
    canEditAttendance: { allowed: true, reason: null },
    today: TODAY,
    minTrainingDate: null,
    maxTrainingDate: TODAY,
    clients: [{
      id: CLIENT_ID,
      fullName: 'Иван Иванов',
      state: 'Unmarked',
      groups: [{ id: GROUP_ID, name: 'Группа', isActive: true }],
      photo: null,
      isProfessional: false,
      professionalComment: null,
      hasActiveMembership: true,
      membershipWarning: false,
      membershipWarningMessage: null,
      currentMemberships: [],
    }],
  }
}

async function fulfillJson(route: Route, payload: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(payload),
  })
}

async function expectNoHorizontalScroll(page: Page) {
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  ))).toBe(true)
}
