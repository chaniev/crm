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
  id: 'sensitive-entry', userId: 'author', messengerPlatform: null, userName: 'Мария Иванова', userLogin: 'm.ivanova', userRole: 'Administrator',
  actionType: 'ClientUpdated', entityType: 'Client', entityId: 'client-sensitive', source: 'Web',
  description: 'Изменён телефон клиента', createdAt: '2026-10-08T08:00:00Z',
  oldValueJson: { phone: '+79990000001' }, newValueJson: { phone: '+79990000002' },
}

const botEntry = {
  ...entry, id: 'attendance-entry', userId: 'coach',
  userName: 'Александра Константиновна Соловьёва-Воскресенская', userLogin: 'a.soloveva',
  actionType: 'ArchivedNoteEdited', entityType: 'LegacyNote', entityId: 'f115622b-b982-4243-b572-24dba46952ec',
  source: 'Bot', messengerPlatform: 'Telegram',
  description: 'Обновлена рабочая заметка клиента Константина Воронцова после обсуждения переноса занятий из вечерней группы в утреннюю.',
}

async function json(route: Route, payload: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) })
}

async function mockAudit(page: Page, role: string, initiallyAllowed?: boolean, entries: (typeof entry | typeof botEntry)[] = [entry]) {
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
      if (path.endsWith('/options')) {
        const users = new Map(entries.map(item => [item.userId, {
          id: item.userId, fullName: item.userName, login: item.userLogin, role: item.userRole,
        }]))
        return json(route, {
          users: [...users.values()],
          actionTypes: [...new Set(entries.map(item => item.actionType))],
          entityTypes: [...new Set(entries.map(item => item.entityType))],
          sources: [...new Set(entries.map(item => item.source))],
          messengerPlatforms: [...new Set(entries.flatMap(item => item.messengerPlatform ?? []))],
        })
      }
      const params = new URL(route.request().url()).searchParams
      const items = entries.filter(item => (['userId', 'source', 'messengerPlatform', 'actionType'] as const)
        .every(key => !params.has(key) || params.get(key) === item[key]))
      const pageNumber = Number(params.get('page') ?? 1)
      const pageSize = Number(params.get('pageSize') ?? 20)
      const skip = (pageNumber - 1) * pageSize
      return json(route, { items: items.slice(skip, skip + pageSize), totalCount: items.length, page: pageNumber, pageSize })
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

async function selectAuditFilter(page: Page, field: string, option: string) {
  const filter = page.getByRole('combobox', { name: field, exact: true })
  if (!await filter.isVisible()) {
    await page.getByRole('button', { name: /^(Фильтры|Ещё фильтры)$/ }).click()
  }
  await filter.focus()
  if (await filter.getAttribute('aria-expanded') !== 'true') await filter.press('ArrowDown')
  await page.getByRole('option', { name: option, exact: true }).click()
  const sheet = page.getByRole('dialog')
  const apply = sheet.getByRole('button', { name: 'Готово' })
  if (await apply.isVisible()) await apply.click()
  else {
    // Dismiss the desktop select and its parent popover together.
    await page.getByRole('banner').getByText('Gym CRM').click()
    await expect(page.getByRole('dialog', { name: 'Ещё фильтры' })).toBeHidden()
  }
}

export function registerAuditPresentationScenarios() {
  test.describe('TASK-208 audit metadata', () => {
    test('an incomplete historical entry keeps a neutral description and author', async ({ page }) => {
      await mockAudit(page, 'HeadCoach')
      await page.route('**/api/audit-logs?*', route => json(route, {
        items: [{ ...entry, description: undefined, userName: undefined, user: { login: entry.userLogin } }],
        page: 1, pageSize: 20, totalCount: 1,
      }))
      await page.goto('/audit')
      const row = page.getByTestId('audit-log-row')
      await expect(row).toContainText('Описание не передано')
      await expect(row).not.toContainText(/client-sensitive|ClientUpdated|m\.ivanova/)
      await row.getByRole('button').click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toContainText('Описание не передано')
      await expect(dialog).not.toContainText(/client-sensitive|ClientUpdated|m\.ivanova/)
    })

    test('opens a second-page entry and recovers from empty combined filters', async ({ page }) => {
      const webEntries = Array.from({ length: 20 }, (_, i) => ({ ...entry, id: `web-${i}` }))
      await mockAudit(page, 'HeadCoach', true, [...webEntries, botEntry])
      await page.goto('/audit')
      const next = page.getByRole('button', { name: 'Следующая страница журнала' })
      await next.focus()
      await next.press('Enter')
      const row = page.getByTestId('audit-log-row')
      await expect(row).toHaveCount(1)
      await expect(row).toContainText(botEntry.description)
      const trigger = row.getByRole('button')
      await trigger.click()
      await expect(page.getByRole('dialog')).toContainText(botEntry.userName)
      await page.keyboard.press('Escape')
      await expect(trigger).toBeFocused()
      await selectAuditFilter(page, 'Тип действия', 'Редактирование клиента')
      await expect(row).toHaveCount(20)
      await selectAuditFilter(page, 'Источник', 'Бот')
      await expect(page.getByText('Под выбранные фильтры записей нет.')).toBeVisible()
      await page.getByRole('button', { name: 'Сбросить фильтры', exact: true }).click()
      await expect(row).toHaveCount(20)
      await expect(next).toBeEnabled()
    })

    for (const [field, option] of [
      ['Источник', 'Бот'], ['Мессенджер', 'Telegram'], ['Пользователь', botEntry.userName],
    ]) {
      test(`finds the historical bot entry by ${field}`, async ({ page }) => {
        await mockAudit(page, 'HeadCoach', true, [entry, botEntry])
        await page.goto('/audit')
        const rows = page.getByTestId('audit-log-row')
        await expect(rows).toHaveCount(2)
        await selectAuditFilter(page, field, option)
        await expect(rows).toHaveCount(1)
        await expect(rows).toContainText(botEntry.description)
        await expect(rows.getByTestId('audit-log-actor-cell')).toHaveAccessibleName(`Автор: ${botEntry.userName}`)
        const hidden = /Бот|Telegram|ArchivedNoteEdited|LegacyNote|f115622b|a\.soloveva/
        await expect(rows).not.toContainText(hidden)
        expect(await rows.ariaSnapshot()).not.toMatch(hidden)
        const trigger = rows.getByRole('button')
        await trigger.focus()
        await page.keyboard.press('Enter')
        const details = page.getByRole('dialog', { name: 'Подробности записи журнала' })
        await expect(details).toContainText(botEntry.description)
        await expect(details).toContainText(botEntry.userName)
        await expect(details).not.toContainText(hidden)
        expect(await details.ariaSnapshot()).not.toMatch(hidden)
        await page.keyboard.press('Escape')
        await expect(trigger).toBeFocused()
      })
    }
  })
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
        const row = page.getByTestId('audit-log-row')
        const metadata = /ClientUpdated|client-sensitive|Клиент|m\.ivanova/
        await expect(row).not.toContainText(/Web|Редактирование клиента/)
        await expect(row).not.toContainText(metadata)
        expect(await row.ariaSnapshot()).not.toMatch(/Web|ClientUpdated|client-sensitive|Клиент|m\.ivanova/)
        await row.getByRole('button').click()
        const dialog = page.getByRole('dialog')
        for (const value of ['+79990000001', '+79990000002', 'Web', 'Редактирование клиента', entry.userName, entry.description]) {
          await expect(dialog).toContainText(value)
        }
        await expect(dialog).not.toContainText(metadata)
        expect(await dialog.ariaSnapshot()).not.toMatch(metadata)
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
        await expect(page.getByRole('link', { name: 'Журнал', exact: true })).toHaveCount(0)
        const more = page.getByRole('button', { name: 'Ещё, открыть остальные разделы', exact: true })
        if (await more.isVisible()) {
          await more.click()
          await expect(page.getByRole('link', { name: 'Журнал', exact: true })).toHaveCount(0)
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
          await expect(page.getByRole('link', { name: 'Журнал', exact: true })).toHaveCount(0)
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
