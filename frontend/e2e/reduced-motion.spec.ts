import { expect, test, type Page, type Route } from '@playwright/test'

const appConfig = {
  clubName: 'Iron Club',
  themeId: 'default-green-v1',
  authBackgroundImageId: 'k4pro-login-v1',
}

const session = {
  isAuthenticated: true,
  csrfToken: 'reduced-motion-csrf',
  bootstrapMode: false,
  user: {
    id: 'headcoach-id',
    fullName: 'Главный тренер',
    login: 'headcoach',
    role: 'HeadCoach',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Schedule',
    allowedSections: ['Attendance', 'Attention', 'Schedule', 'Clients', 'Groups'],
    permissions: {
      canManageUsers: false,
      canManageClients: true,
      canManageGroups: true,
      canManageSettings: false,
      canMarkAttendance: true,
      canViewAuditLog: false,
      canViewFinancialReports: false,
    },
    assignedGroupIds: [],
    attendanceScope: { kind: 'Global', groupIds: [] },
    branchId: null,
  },
}

test('reduced motion keeps loading visible and makes a temporary surface instant', async ({ page }) => {
  let releaseSchedule!: () => void
  const scheduleGate = new Promise<void>((resolve) => {
    releaseSchedule = resolve
  })

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mockApi(page, scheduleGate)
  await page.goto('/schedule?date=2026-08-20&view=day')

  const loadingRegion = page.locator('[aria-label="Загружаем занятия"]')
  await expect(loadingRegion).toHaveAttribute('aria-busy', 'true')
  const skeletonLine = loadingRegion.locator('.schedule-skeleton__line').first()
  await expect(skeletonLine).toBeVisible()
  await expect.poll(() => skeletonLine.evaluate((element) => (
    getComputedStyle(element).animationName
  ))).toBe('none')

  releaseSchedule()
  await expect(loadingRegion).toBeHidden()

  const toolsButton = page.getByRole('button', { name: 'Параметры календаря' })
  await toolsButton.click()
  const drawer = page.getByRole('dialog', { name: 'Параметры календаря' })
  await expect(drawer).toBeVisible()
  const transitionDuration = await drawer.evaluate((element) => (
    getComputedStyle(element).transitionDuration
  ))
  expect(transitionDuration).toMatch(/^(?:0s|0\.001s)(?:, (?:0s|0\.001s))*$/)

  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await expect(toolsButton).toBeFocused()
})

async function mockApi(page: Page, scheduleGate: Promise<void>) {
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname

    if (!pathname.startsWith('/api/')) {
      await route.fallback()
      return
    }

    if (pathname === '/api/config' && request.method() === 'GET') {
      await fulfillJson(route, appConfig)
      return
    }

    if (pathname === '/api/auth/session' && request.method() === 'GET') {
      await fulfillJson(route, session)
      return
    }

    if (pathname === '/api/schedule/lessons' && request.method() === 'GET') {
      await scheduleGate
      await fulfillJson(route, {
        from: '2026-08-20',
        to: '2026-08-20',
        capabilities: { createOneOff: { allowed: true, reason: null } },
        filterOptions: {
          branches: [{ id: 'branch-1', name: 'Центр' }],
          halls: [{ id: 'hall-1', name: 'Основной зал' }],
          trainers: [{ id: 'trainer-1', name: 'Алиса' }],
          groups: [{ id: 'group-1', name: 'Утренняя база' }],
          groupTypes: [{ id: 'type-1', name: 'Кардио' }],
        },
        items: [],
      })
      return
    }

    throw new Error(`Unexpected reduced-motion API request: ${request.method()} ${pathname}`)
  })
}

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}
