import { expect, test, type Page, type Route } from '@playwright/test'
import type { UpsertTrainingGroupRequest } from '../src/lib/api'

const session = {
  isAuthenticated: true, csrfToken: 'group-schedule-csrf', bootstrapMode: false,
  user: {
    id: 'headcoach', fullName: 'Главный тренер', login: 'headcoach', role: 'HeadCoach',
    mustChangePassword: false, isActive: true, landingScreen: 'Groups',
    allowedSections: ['Attendance', 'Attention', 'Schedule', 'Clients', 'Groups'],
    permissions: { canManageUsers: false, canManageClients: true, canManageGroups: true,
      canManageSettings: false, canMarkAttendance: true, canViewAuditLog: false, canViewFinancialReports: false },
    assignedGroupIds: [], attendanceScope: { kind: 'Global', groupIds: [] }, branchId: null,
  },
}
const group = {
  id: 'group-1', name: 'Разные времена', branchId: 'branch-1', branchName: 'Центр',
  hallId: 'hall-1', hallName: 'Большой', groupTypeId: 'type-1', groupTypeName: 'Общая',
  trainingStartTime: '18:00', durationMinutes: 60, weekdays: [1, 3, 6], isActive: true,
  trainerIds: [], trainers: [], trainerNames: [], trainerCount: 0, clientCount: 0,
  trainerAssignmentRevision: 'assignments-1', trainerAssignmentPeriods: [],
  createdAt: '2026-10-23T10:00:00Z', updatedAt: '2026-10-23T10:00:00Z',
}
const preview = { confirmationToken: 'create-token', expiresAt: '2099-01-01T12:00:00Z', warnings: [] }
const days = [['Пн', 'Понедельник', '18:00'], ['Ср', 'Среда', '18:00'], ['Сб', 'Суббота', '10:00']] as const

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

async function mockGroups(page: Page, handler: (route: Route, path: string) => Promise<boolean>, canManageGroups = true) {
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/')) return route.fallback()
    if (await handler(route, path)) return
    const responses: Record<string, unknown> = {
      '/api/config': { clubName: 'Iron Club', themeId: 'default-green-v1', authBackgroundImageId: 'k4pro-login-v1' },
      '/api/auth/session': { ...session, user: { ...session.user, permissions: { ...session.user.permissions, canManageGroups } } },
      '/api/branches': [{ id: 'branch-1', name: 'Центр', address: '', isArchived: false }],
      '/api/halls': [{ id: 'hall-1', branchId: 'branch-1', name: 'Большой', isArchived: false }],
      '/api/group-types': [{ id: 'type-1', name: 'Общая', description: null, groupCount: 1 }],
      '/api/groups/options/trainers': [],
      '/api/groups/summary': { totalCount: 1, activeWithoutTrainerCount: 1 },
      '/api/groups': { items: [group], totalCount: 1, skip: 0, take: 10 },
      '/api/groups/group-1': group,
      '/api/groups/group-1/clients': { groupId: 'group-1', clients: [] },
      '/api/groups/group-1/trainer-substitutions': { current: [], history: { items: [], totalCount: 0, skip: 0, take: 20 }, canCreate: false, createUnavailableReason: 'NoPermission' },
    }
    if (route.request().method() === 'GET' && path in responses) return json(route, responses[path])
    throw new Error(`Unexpected group workflow request: ${route.request().method()} ${path}`)
  })
}

async function fillCreate(page: Page) {
  await page.goto('/groups/new')
  await page.getByLabel('Название группы').fill('Разные времена')
  await page.getByLabel('Длительность', { exact: true }).fill('60')
  await page.getByLabel('Начало расписания').fill('2026-10-26')
  for (const [short, full, time] of days) {
    await page.getByRole('checkbox', { name: short, exact: true }).check()
    await page.getByLabel(`Время начала: ${full}`).fill(time)
  }
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
}

test('weekday creation previews, revalidates changed time, creates and reloads calendar times', async ({ page }) => {
  let created: UpsertTrainingGroupRequest | undefined
  const previews: UpsertTrainingGroupRequest[] = []
  await mockGroups(page, async (route, path) => {
    if (path === '/api/groups/preview') {
      previews.push(route.request().postDataJSON())
      await json(route, preview)
      return true
    }
    if (path === '/api/groups' && route.request().method() === 'POST') {
      created = route.request().postDataJSON()
      expect(created).toEqual({ ...previews.at(-1), confirmationToken: 'create-token' })
      await json(route, group, 201)
      return true
    }
    if (path === '/api/schedule/lessons') {
      const date = new URL(route.request().url()).searchParams.get('from')!
      const day = new Date(`${date}T12:00:00`).getDay() || 7
      const slot = created?.initialLessonSeries?.slots.find(slot => slot.isoWeekday === day)
      await json(route, { from: date, to: date, capabilities: { createOneOff: { allowed: false, reason: 'NoPermission' } },
        filterOptions: { branches: [], halls: [], trainers: [], groups: [], groupTypes: [] },
        items: slot ? [{ lessonOccurrenceId: `occ-${day}`, sourceKind: 'Recurring', isMaterialized: false,
          lessonSeriesId: 'series-1', lessonDate: date, ...slot, endTime: `${Number(slot.startTime.slice(0, 2)) + 1}:00`,
          groupId: group.id, groupName: group.name, groupTypeId: group.groupTypeId, groupTypeName: group.groupTypeName,
          branchId: group.branchId, branchName: group.branchName, hallName: group.hallName,
          effectiveTrainers: [], status: 'Scheduled', hasAttendanceMarks: false, revision: 'revision-1',
          allowedActions: Object.fromEntries(['viewAttendance', 'editAttendance', 'edit', 'move', 'cancel', 'restore', 'assignTrainerSubstitution', 'cancelTrainerSubstitution'].map(key => [key, { allowed: false, reason: 'NoPermission' }])),
        }] : [],
      })
      return true
    }
    return false
  })
  await fillCreate(page)
  await page.getByRole('button', { name: 'Получить предпросмотр' }).click()
  await expect(page.getByRole('button', { name: 'Создать группу' })).toBeVisible()
  await page.getByLabel('Время начала: Суббота').fill('11:00')
  await expect(page.getByRole('button', { name: 'Создать группу' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Получить предпросмотр' }).click()
  await page.getByRole('button', { name: 'Создать группу' }).click()
  await expect(page).toHaveURL(/\/groups$/)
  expect(created?.initialLessonSeries?.slots.map(({ isoWeekday, startTime }) => [isoWeekday, startTime]))
    .toEqual([[1, '18:00'], [3, '18:00'], [6, '11:00']])
  await page.reload()
  for (const [date, time] of [['2026-10-26', '18:00'], ['2026-10-28', '18:00'], ['2026-10-31', '11:00']]) {
    await page.goto(`/schedule?date=${date}&view=day`)
    await expect(page.getByTestId('schedule-screen')).toContainText(`${time}-`)
    await noOverflow(page)
  }
})

test('weekday errors target Saturday and retry preserves every time', async ({ page }, testInfo) => {
  let count = 0
  await mockGroups(page, async (route, path) => {
    if (path !== '/api/groups/preview') return false
    count += 1
    await json(route, count === 1 ? { title: 'Проверьте расписание', status: 400,
      errors: { 'InitialLessonSeries.Slots[2].StartTime': ['Выбранное время субботы недоступно. Укажите другое время начала занятия и повторите проверку расписания.'] },
    } : preview, count === 1 ? 400 : 200)
    return true
  })
  await fillCreate(page)
  await page.getByRole('button', { name: 'Получить предпросмотр' }).click()
  const saturday = page.getByLabel('Время начала: Суббота')
  await expect(saturday).toHaveAttribute('aria-invalid', 'true')
  await expect(saturday).toBeFocused()
  await expect(page.getByLabel('Время начала: Понедельник')).toHaveValue('18:00')
  await noOverflow(page)
  await page.screenshot({ path: testInfo.outputPath('weekday-error.png'), fullPage: true })
  await saturday.fill('11:00')
  await page.getByRole('button', { name: 'Получить предпросмотр' }).click()
  await expect(page.getByRole('button', { name: 'Создать группу' })).toBeVisible()
})

test('weekday controls wrap with seven accessible targets at required geometries', async ({ page }, testInfo) => {
  await mockGroups(page, async () => false)
  await fillCreate(page)
  for (const [day, name] of [['Вт', 'Вторник'], ['Чт', 'Четверг'], ['Пт', 'Пятница'], ['Вс', 'Воскресенье']]) {
    await page.getByRole('checkbox', { name: day, exact: true }).check()
    await page.getByLabel(`Время начала: ${name}`).fill('18:00')
  }
  const sizes = testInfo.project.name === 'chromium'
    ? [[360, 780], [390, 844], [420, 912], [440, 956], [768, 1024], [1440, 1200], [912, 420], [956, 440]]
    : [null]
  for (const size of sizes) {
    if (size) await page.setViewportSize({ width: size[0], height: size[1] })
    const targets = page.locator('.group-weekday-choice .mantine-Checkbox-body')
    await expect(targets).toHaveCount(7)
    for (const target of await targets.all()) {
      const box = (await target.boundingBox())!
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
    const fontSize = await page.getByLabel('Время начала: Понедельник').evaluate(element => parseFloat(getComputedStyle(element).fontSize))
    expect(fontSize).toBeGreaterThanOrEqual(16)
    await noOverflow(page)
    await page.locator('.group-weekday-schedule').scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath(`weekdays-${size?.[0] ?? 'iphone'}.png`), fullPage: true })
  }
  const monday = page.getByRole('checkbox', { name: 'Пн', exact: true })
  await monday.focus()
  await page.keyboard.press('Space')
  await expect(page.getByLabel('Время начала: Понедельник')).toHaveCount(0)
  await page.keyboard.press('Space')
  await expect(page.getByLabel('Время начала: Понедельник')).toHaveValue('18:00')
})

test('weekday creation respects backend session permission', async ({ page }) => {
  let mutations = 0
  await mockGroups(page, async route => {
    if (route.request().method() !== 'GET') mutations += 1
    return false
  }, false)
  await page.goto('/groups/new')
  await expect(page.getByRole('button', { name: 'Получить предпросмотр' })).toHaveCount(0)
  await expect(page.getByLabel('Название группы')).toHaveCount(0)
  await expect(page.getByText(/доступ|недоступ/i).first()).toBeVisible()
  expect(mutations).toBe(0)
})
