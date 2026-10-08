import { expect, test, type Page, type Route } from '@playwright/test'

function session(role: string, audit = role === 'HeadCoach' || role === 'SuperAdministrator') {
  return {
    isAuthenticated: true, csrfToken: 'audit-csrf', bootstrapMode: false,
    user: {
      id: 'audit-user', fullName: 'Сотрудник журнала', login: 'audit-user', role,
      mustChangePassword: false, isActive: true, landingScreen: 'Attendance',
      allowedSections: ['Attendance', 'Clients', ...(audit ? ['Audit'] : [])],
      permissions: {
        canManageUsers: role === 'HeadCoach' || role === 'SuperAdministrator',
        canManageClients: role !== 'Coach', canManageGroups: role !== 'Coach',
        canManageSettings: role !== 'Coach', canMarkAttendance: true,
        canViewAuditLog: audit, canViewFinancialReports: role === 'HeadCoach',
      },
      assignedGroupIds: [], attendanceScope: { kind: 'Global', groupIds: [] }, branchId: null,
    },
  }
}

const entry = {
  id: 'sensitive-entry', userName: 'Мария Иванова', userLogin: 'm.ivanova', userRole: 'Administrator',
  actionType: 'ClientUpdated', entityType: 'Client', entityId: 'client-sensitive', source: 'Web',
  description: 'Изменён телефон клиента', createdAt: '2026-10-08T08:00:00Z',
  oldValueJson: { phone: '+79990000001' }, newValueJson: { phone: '+79990000002' },
}

async function json(route: Route, payload: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) })
}

async function mockAudit(page: Page, role: string, initiallyAllowed?: boolean) {
  const state = { deny: 0, transient: false, sessionRequests: 0, auditRequests: 0, holdSession: false, releaseSession: () => {}, holdDenial: false, releaseDenials: [] as (() => void)[] }
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    if (path === '/api/config') return json(route, { clubName: 'Gym CRM' })
    if (path === '/api/auth/session') {
      state.sessionRequests++
      if (state.holdSession) await new Promise<void>((resolve) => { state.releaseSession = resolve })
      return json(route, state.deny === 401
        ? { isAuthenticated: false, csrfToken: 'anonymous', bootstrapMode: false, user: null }
        : session(role, state.deny ? false : initiallyAllowed))
    }
    if (path.startsWith('/api/audit-logs')) {
      state.auditRequests++
      if (state.deny) {
        if (state.holdDenial) await new Promise<void>((resolve) => state.releaseDenials.push(resolve))
        return json(route, {}, state.deny)
      }
      if (state.transient) return json(route, { title: 'Временная ошибка' }, 500)
      return json(route, path.endsWith('/options')
        ? { users: [{ id: 'author', fullName: 'Мария Иванова', login: 'm.ivanova', role: 'Administrator' }], actionTypes: ['ClientUpdated'], entityTypes: ['Client'], sources: ['Web'], messengerPlatforms: [] }
        : { items: [entry], totalCount: 1, page: 1, pageSize: 20, hasNextPage: false })
    }
    if (path === '/api/attendance/lessons/today') return json(route, { items: [], today: '2026-10-08', totalCount: 0 })
    if (path === '/api/attendance/groups') return json(route, { groups: [], today: '2026-10-08', maxTrainingDate: '2026-10-08' })
    if (path === '/api/groups') return json(route, { items: [], totalCount: 0 })
    if (path === '/api/clients') return json(route, { items: [], totalCount: 0, page: 1, pageSize: 20, hasNextPage: false })
    throw new Error(`Unexpected audit acceptance request: ${path}`)
  })
  return state
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
}

export function registerAuditAccessScenarios() {
  test.describe('TASK-186 audit access', () => {
    for (const role of ['HeadCoach', 'SuperAdministrator']) {
      test(`${role} reads details and recovers from a transient failure`, async ({ page }, info) => {
        if (info.project.name === 'chromium') await page.setViewportSize(role === 'HeadCoach' ? { width: 390, height: 844 } : { width: 1440, height: 1200 })
        const state = await mockAudit(page, role)
        await page.goto('/audit')
        await expect(page.getByTestId('audit-log-grid')).toBeVisible()
        const initialSessions = state.sessionRequests
        await noOverflow(page)
        await page.screenshot({ path: info.outputPath('allowed.png'), fullPage: true })
        await page.getByTestId('audit-log-details-action').click()
        await expect(page.getByRole('dialog')).toContainText('+79990000002')
        await page.screenshot({ path: info.outputPath('details.png'), fullPage: true })
        await page.getByRole('button', { name: 'Закрыть подробности записи' }).click()
        await expect(page.getByTestId('audit-log-details-action')).toBeFocused()
        state.transient = true
        await page.getByRole('button', { name: 'Обновить' }).click()
        await expect(page.getByText('Не удалось обновить, показаны предыдущие данные')).toBeVisible()
        await expect(page.getByTestId('audit-log-grid')).toBeVisible()
        state.transient = false
        await page.getByRole('button', { name: 'Повторить' }).click()
        await expect(page.getByText('Не удалось обновить, показаны предыдущие данные')).toHaveCount(0)
        expect(state.sessionRequests).toBe(initialSessions)
      })
    }

    test('audit list and modal remain usable across the applicable viewport matrix', async ({ page }, info) => {
      await mockAudit(page, 'HeadCoach')
      const sizes = info.project.name === 'chromium'
        ? [[360, 780], [390, 844], [420, 912], [440, 956], [768, 1024], [1440, 1200], [912, 420], [956, 440]]
        : info.project.name === 'iphone-air-webkit' ? [[912, 420]] : [[956, 440]]
      await page.goto('/audit')
      for (const [width, height] of sizes) {
        await page.setViewportSize({ width, height })
        const details = page.getByTestId('audit-log-details-action')
        await expect(details).toBeVisible()
        await noOverflow(page)
        await details.click()
        const close = page.getByRole('button', { name: 'Закрыть подробности записи' })
        await expect(close).toBeVisible()
        await expect(page.getByRole('dialog')).toContainText('+79990000002')
        await noOverflow(page)
        await page.screenshot({ path: info.outputPath(`details-${width}-${height}.png`), fullPage: true })
        await close.click()
        await expect(details).toBeFocused()
      }
    })

    for (const role of ['Administrator', 'Coach']) {
      test(`${role} direct audit URL never loads audit data or navigation`, async ({ page }, info) => {
        const state = await mockAudit(page, role)
        await page.goto('/audit')
        await expect(page.getByRole('heading', { name: 'Нет доступа' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Журнал', exact: true })).toHaveCount(0)
        const more = page.getByRole('button', { name: 'Ещё', exact: true })
        if (await more.isVisible()) {
          await more.click()
          await expect(page.getByRole('button', { name: 'Журнал', exact: true })).toHaveCount(0)
        }
        expect(state.auditRequests).toBe(0)
        await noOverflow(page)
        await page.screenshot({ path: info.outputPath('restricted.png'), fullPage: true })
      })
    }

    for (const status of [401, 403]) {
      test(`${status} removes old Administrator data before bounded session recovery`, async ({ page }, info) => {
        const state = await mockAudit(page, 'Administrator', true)
        await page.goto('/clients')
        await page.evaluate(() => { history.pushState({}, '', '/audit'); dispatchEvent(new PopStateEvent('popstate')) })
        await expect(page.getByTestId('audit-log-grid')).toBeVisible()
        const initialSessions = state.sessionRequests
        const initialAuditRequests = state.auditRequests
        state.deny = status
        // Moving focus/visibility while idle must not start a new authorization poll.
        await page.evaluate(() => { dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')) })
        await page.waitForTimeout(300)
        expect(state.auditRequests).toBe(initialAuditRequests)
        expect(state.sessionRequests).toBe(initialSessions)
        state.holdSession = true
        state.holdDenial = true
        await page.getByRole('button', { name: 'Обновить' }).click()
        await expect.poll(() => state.releaseDenials.length).toBe(2)
        if (status === 401) {
          await page.getByTestId('audit-log-details-action').click()
          await expect(page.getByRole('dialog')).toContainText('+79990000002')
        } else {
          await page.getByRole('button', { name: /^(Ещё фильтры|Фильтры)$/ }).click()
          await expect(page.getByRole('combobox', { name: 'Источник', exact: true })).toBeVisible()
        }
        state.releaseDenials.forEach((release) => release())
        await expect(page.getByTestId('audit-log-grid')).toHaveCount(0)
        await expect(page.getByTestId('audit-filter-panel')).toHaveCount(0)
        await expect(page.getByRole('dialog')).toHaveCount(0)
        await expect(page.getByText(/Мария Иванова/)).toHaveCount(0)
        await expect.poll(() => state.sessionRequests).toBe(initialSessions + 1)
        await noOverflow(page)
        await page.screenshot({ path: info.outputPath('denied-before-session.png'), fullPage: true })
        state.releaseSession()
        if (status === 403) {
          await expect(page).toHaveURL(/\/attendance$/)
          await expect(page.getByRole('button', { name: 'Журнал', exact: true })).toHaveCount(0)
          await page.goBack()
          await expect(page).toHaveURL(/\/clients$/)
          await page.goForward()
          await expect(page).toHaveURL(/\/attendance$/)
        } else {
          await expect(page.getByRole('button', { name: 'Войти', exact: true })).toBeVisible()
        }
        await expect(page.getByTestId('audit-log-grid')).toHaveCount(0)
        expect(state.sessionRequests).toBe(initialSessions + 1)
        expect(state.auditRequests).toBe(initialAuditRequests + 2)
      })
    }
  })
}
