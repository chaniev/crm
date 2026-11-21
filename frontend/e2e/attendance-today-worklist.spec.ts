import { expect, test, type Page, type Route } from '@playwright/test'
import { lesson } from './support/schedule-lesson'

const TODAY = '2026-04-18'
const OCCURRENCE_ID = 'occ-today-evening'
const GROUP_ID = 'group-1'
const CLIENT_ID = 'client-1'
const GROUP_NAME = 'Группа с очень длинным названием для мобильной проверки'
const morning = lesson({
  lessonOccurrenceId: 'occ-today-morning', lessonDate: TODAY, groupName: GROUP_NAME,
  startTime: '08:00', endTime: '09:00', durationMinutes: 60,
})
const evening = { ...morning, lessonOccurrenceId: OCCURRENCE_ID, startTime: '19:00', endTime: '20:00' }

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
    await mockToday(page, { eveningMarked: false, detailsUnavailable: false })
    await page.route('**/api/attendance/lessons/today', async route => {
      todayRequests++
      await fulfillJson(route, {
        today: TODAY,
        items: workbenchOpened ? [] : [{
          ...evening,
          branchName: 'Центральный филиал с длинным названием',
          hallName: 'Большой зал',
          effectiveTrainers: [{
            ...evening.effectiveTrainers[0], fullName: 'Александра Константинопольская',
          }],
          openAttendance: evening.allowedActions.viewAttendance,
          unmarkedClientCount: 3,
        }],
      })
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

    workbenchOpened = true
    await page.goBack()

    await expect(page).toHaveURL('/attendance')
    await expect(page.getByText('На сегодня всё отмечено')).toBeVisible()
    await expect(page.getByTestId('attendance-today-refresh')).toBeFocused()
    await expectNoHorizontalScroll(page)
    expect(todayRequests).toBeGreaterThanOrEqual(2)
  })
})

test('two occurrences of one group keep independent marks and restore the refreshed worklist', async ({ page, hasTouch }) => {
  const state = { eveningMarked: false, detailsUnavailable: false }
  await mockToday(page, state)
  await page.goto('/attendance')

  const eveningRow = page.getByTestId(`attendance-today-row-${OCCURRENCE_ID}`)
  const morningRow = page.getByTestId(`attendance-today-row-${morning.lessonOccurrenceId}`)
  const openEvening = eveningRow.getByRole('button', { name: /Открыть:/ })
  await openEvening.scrollIntoViewIfNeeded()
  const sourceScroll = await page.evaluate(() => window.scrollY)
  expect(sourceScroll).toBeGreaterThan(0)
  if (hasTouch) await openEvening.tap()
  else await openEvening.press('Enter')
  await expect(page).toHaveURL(`/attendance/${OCCURRENCE_ID}?lessonDate=${TODAY}`)
  await expect(page.getByRole('heading', { name: GROUP_NAME })).toBeVisible()
  await expect(page.getByText('19:00–20:00', { exact: true })).toBeVisible()
  await page.getByRole('radio', { name: 'Был', exact: true }).click()
  await expect.poll(() => state.eveningMarked).toBe(true)
  await expect(page.getByRole('button', { name: 'Показать всех' })).toBeVisible()

  const back = page.getByRole('button', { name: 'К занятиям на сегодня' })
  if (hasTouch) await back.tap()
  else await back.press('Enter')
  await expect(page).toHaveURL('/attendance')
  await expect(eveningRow).toHaveCount(0)
  await expect(morningRow).toBeFocused()
  await expect.poll(() => page.evaluate((y) => Math.abs(window.scrollY - y), sourceScroll)).toBeLessThanOrEqual(2)
  await morningRow.getByRole('button', { name: /Открыть:/ }).click()
  await expect(page).toHaveURL(`/attendance/${morning.lessonOccurrenceId}?lessonDate=${TODAY}`)
  await expect(page.getByText('08:00–09:00', { exact: true })).toBeVisible()
  const morningCard = page.getByTestId(`attendance-client-card-${CLIENT_ID}`)
  await expect(morningCard.getByRole('radio', { name: 'Не отмечено', exact: true })).toBeChecked()
  const rosterView = page.getByRole('group', { name: 'Показывать клиентов' })
  await expect(rosterView.getByRole('radio', { name: 'Не отмечено', exact: true })).toBeChecked()
})

test('a copied link retries from the keyboard and returns locally in its own tab', async ({ page, context, browserName }) => {
  const state = { eveningMarked: false, detailsUnavailable: true }
  await mockToday(page, state)
  await page.goto('/attendance')
  const direct = await context.newPage()
  await mockToday(direct, state)
  await direct.goto(`/attendance/${OCCURRENCE_ID}?lessonDate=${TODAY}`)
  const back = direct.getByRole('button', { name: 'К занятиям на сегодня' })
  await expect(back).toBeVisible()
  await expect(direct.getByRole('radio')).toHaveCount(0)
  const retry = direct.getByRole('button', { name: 'Повторить', exact: true })
  await expect(retry).toBeVisible()
  state.detailsUnavailable = false
  await retry.press('Enter')
  const heading = direct.getByRole('heading', { name: GROUP_NAME })
  await expect(heading).toBeFocused()

  const sizes = browserName === 'chromium'
    ? [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 1000 }]
    : [direct.viewportSize()!]
  for (const size of sizes) {
    await direct.setViewportSize(size)
    const date = direct.getByText('18 апреля 2026', { exact: true })
    const time = direct.getByText('19:00–20:00', { exact: true })
    await expect(date).toBeVisible()
    await expect(time).toBeVisible()
    await expectNoHorizontalScroll(direct)
    await expect(async () => {
      const [titleBox, timeBox, backBox, rowBox] = await Promise.all(
        [heading, time, back, direct.getByTestId(`attendance-client-card-${CLIENT_ID}`)].map(node => node.boundingBox()),
      )
      expect(titleBox!.y + titleBox!.height).toBeLessThanOrEqual(timeBox!.y + 1)
      expect(backBox!.height).toBeGreaterThanOrEqual(44)
      expect(rowBox!.y).toBeGreaterThan(backBox!.y + backBox!.height)
      if (size.width <= 768) expect(backBox!.y).toBeGreaterThanOrEqual(timeBox!.y + timeBox!.height)
      else expect(backBox!.x).toBeGreaterThanOrEqual(titleBox!.x + titleBox!.width)
    }).toPass({ timeout: 5000 })
    await expect(direct.getByRole('radio', { name: 'Был', exact: true })).toBeInViewport()
  }
  const depth = await direct.evaluate(() => window.history.length)
  await back.press('Enter')
  await expect(direct).toHaveURL('/attendance')
  expect(await direct.evaluate(() => window.history.length)).toBe(depth)
  await expect(direct.getByTestId(`attendance-today-row-${OCCURRENCE_ID}`)).toBeVisible()
  await expect(page.getByTestId(`attendance-today-row-${OCCURRENCE_ID}`)).toBeVisible()
})

async function mockToday(page: Page, state: { eveningMarked: boolean; detailsUnavailable: boolean }) {
  const filler = Array.from({ length: 24 }, (_, index) => ({
    ...morning, lessonOccurrenceId: `occ-${index}`, groupName: `Группа ${index}`,
  }))
  await page.route(/^https?:\/\/[^/]+\/api\//, async route => {
    const { pathname, searchParams } = new URL(route.request().url())
    const method = route.request().method()
    if (pathname === '/api/config') {
      return fulfillJson(route, { clubName: 'Iron Club', themeId: 'default-green-v1', authBackgroundImageId: 'k4pro-login-v1' })
    }
    if (pathname === '/api/auth/session') return fulfillJson(route, session)
    if (pathname === '/api/attendance/lessons/today') {
      const items = [...filler.slice(0, 12), ...(state.eveningMarked ? [] : [evening]), morning, ...filler.slice(12)]
      return fulfillJson(route, {
        today: TODAY, items: items.map(item => ({
          ...item, openAttendance: item.allowedActions.viewAttendance, unmarkedClientCount: 1,
        })),
      })
    }
    for (const item of [morning, evening]) {
      if (pathname === `/api/schedule/lessons/${item.lessonOccurrenceId}` && method === 'GET') {
        expect(searchParams.get('lessonDate')).toBe(TODAY)
        if (state.detailsUnavailable) return route.fulfill({ status: 503, json: { title: 'Временный сбой' } })
        return fulfillJson(route, item)
      }
      if (pathname === `/api/attendance/lessons/${item.lessonOccurrenceId}/clients` && method === 'GET') {
        expect(searchParams.get('lessonDate')).toBe(TODAY)
        const roster = attendanceRoster()
        if (item === evening && state.eveningMarked) roster.clients[0].state = 'Present'
        return fulfillJson(route, { ...roster, lessonOccurrenceId: item.lessonOccurrenceId })
      }
    }
    if (pathname === `/api/attendance/lessons/${OCCURRENCE_ID}` && method === 'POST') {
      expect(searchParams.get('lessonDate')).toBe(TODAY)
      expect(route.request().postDataJSON()).toEqual({
        LessonDate: TODAY, AttendanceMarks: [{ ClientId: CLIENT_ID, State: 'Present' }],
      })
      state.eveningMarked = true
      return fulfillJson(route, { ...attendanceRoster(), attendanceMarks: [{ clientId: CLIENT_ID, state: 'Present' }] })
    }
    throw new Error(`Unexpected API request: ${method} ${pathname}`)
  })
}

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
