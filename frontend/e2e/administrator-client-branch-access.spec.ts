import { expect, test, type Page } from '@playwright/test'

const client = {
  id: 'client-1', fullName: 'Иванов Иван', firstName: 'Иван', lastName: 'Иванов',
  status: 'Active', branchId: 'branch-1', branchName: 'Центр', phone: '+7 999 111-22-33',
  birthDate: '1995-01-01', contacts: [], groupIds: [], groups: [], groupCount: 0,
  currentMemberships: [], membershipHistory: [], attendanceHistory: [], attendanceHistoryTotalCount: 0,
  hasActiveMembership: false, hasCurrentMembership: false, notes: 'Личная заметка', photo: null,
  businessDate: '2026-10-24', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
}

const group = { id: 'group-1', name: 'Группа центра', branchId: 'branch-1', branchName: 'Центр',
  hallId: 'hall-1', hallName: 'Зал', groupTypeId: 'type-1', groupTypeName: 'Базовый',
  trainingStartTime: '19:00', durationMinutes: 60, weekdays: [2, 4], isActive: true,
  trainerIds: [], trainers: [], trainerNames: [], trainerCount: 0, clientCount: 1,
  trainerAssignmentRevision: 'initial', trainerAssignmentPeriods: [] }

async function mockScope(page: Page, options: { denied?: boolean; failTransfer?: boolean } = {}) {
  const state = { transferred: false, denied: options.denied ?? false, cardReads: 0, readsAfterTransfer: 0, failTransfer: options.failTransfer ?? false }
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '')
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (path === '/auth/session') return json({ isAuthenticated: true, csrfToken: 'scope-test-csrf', bootstrapMode: false, user: {
      id: 'admin-a', fullName: 'Администратор', login: 'admin-a', role: 'Administrator', branchId: 'branch-1',
      isActive: true, mustChangePassword: false, landingScreen: 'Clients',
      allowedSections: ['Attendance', 'Attention', 'Schedule', 'Clients', 'Groups', 'Settings'], assignedGroupIds: [],
      attendanceScope: { kind: 'AdministratorGrants', groupIds: [] }, permissions: { canManageClients: true, canManageGroups: true, canManageSettings: true, canMarkAttendance: true, canManageUsers: false, canViewAuditLog: false, canViewFinancialReports: false },
    } })
    if (path === '/config') return json({ clubName: 'Клуб', themeId: 'default-green-v1' })
    if (path === '/clients/client-1/transfer') {
      if (state.failTransfer) return json({ title: 'Проверьте перевод', errors: { targetBranchId: ['Выберите филиал.'] } }, 400)
      state.transferred = true
      return route.fulfill({ status: 204 })
    }
    if (path === '/clients/client-1') {
      state.cardReads += 1
      if (state.transferred) state.readsAfterTransfer += 1
      return state.denied || state.transferred ? route.fulfill({ status: 404 }) : json(client)
    }
    if (path === '/clients' || path === '/clients/') return json({ items: state.transferred ? [] : [client], totalCount: state.transferred ? 0 : 1, activeCount: state.transferred ? 0 : 1, archivedCount: 0, skip: 0, take: 20, page: 1, pageSize: 20, hasNextPage: false })
    if (path === '/branches' || path === '/branches/') return json([{ id: 'branch-1', name: 'Центр', isArchived: false, clientCount: 1, groupCount: 0, hallCount: 0 }, { id: 'branch-2', name: 'Север', isArchived: false, clientCount: null, groupCount: 0, hallCount: 0 }])
    if (path === '/groups' || path === '/groups/') return json({ items: [group], totalCount: 1, skip: 0, take: 100 })
    if (path === '/groups/group-1') return json({ ...group, clientCount: state.transferred ? 0 : 1 })
    if (path === '/groups/group-1/clients') return json({ groupId: group.id, clients: state.transferred ? [] : [client] })
    if (path === '/halls') return json([{ id: 'hall-1', branchId: 'branch-1', branchName: 'Центр', name: 'Зал', isArchived: false, groupCount: 1 }])
    if (path === '/group-types') return json([{ id: 'type-1', name: 'Базовый', groupCount: 1 }])
    if (path === '/groups/options/trainers') return json([])
    if (path.endsWith('/trainer-substitutions')) return json({ current: [], history: { items: [], totalCount: 0, skip: 0, take: 20 }, canCreate: false })
    if (path.endsWith('/lesson-series')) return route.fulfill({ status: 404 })
    if (path.endsWith('/messenger')) return json({ platforms: [], accounts: [], unreadCount: 0 })
    if (path.endsWith('/messages')) return json({ items: [], hasMore: false })
    if (path === '/clients/attention') return json(state.transferred ? [] : [{ clientId: client.id, fullName: client.fullName, phone: client.phone, notes: client.notes, membership: null, telegramLink: null, reasons: [{ type: 'missedTraining', missedCount: 4 }] }])
    return json({ items: [], totalCount: 0 })
  })
  return state
}

test('available card matches the existing mobile flow', async ({ page }, testInfo) => {
  await mockScope(page)
  if (testInfo.project.name === 'chromium') await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/clients/client-1')
  await expect(page.getByRole('heading', { name: client.fullName, level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Перевести', exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('available.png'), fullPage: true })
})

test('204 returns to refreshed clients without a fallback card GET', async ({ page }, testInfo) => {
  const state = await mockScope(page)
  await page.goto('/clients/client-1')
  await page.getByRole('button', { name: 'Перевести', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Перевести клиента' }).click()
  await expect(page).toHaveURL(/\/clients$/)
  await expect(page.getByText('Клиент переведен', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: client.fullName, level: 1 })).toHaveCount(0)
  expect(state.readsAfterTransfer).toBe(0)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('transfer-success.png'), fullPage: true })
  await expect(page.getByText('Клиент переведен', { exact: true })).toBeHidden({ timeout: 10_000 })
})

test('foreign deep link clears PII and exposes focused recovery', async ({ page }, testInfo) => {
  await mockScope(page, { denied: true })
  await page.goto('/clients/client-1')
  await expect(page.getByText('Клиент недоступен.', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Детали клиента' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Перевести', exact: true })).toHaveCount(0)
  await expect(page.getByText(client.fullName)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'К списку клиентов' })).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('restricted.png'), fullPage: true })
  await page.getByRole('button', { name: 'К списку клиентов' }).click()
  await expect(page).toHaveURL(/\/clients$/)
})

test('validation preserves the transfer draft and recovery succeeds', async ({ page }) => {
  const state = await mockScope(page, { failTransfer: true })
  await page.goto('/clients/client-1')
  await page.getByRole('button', { name: 'Перевести', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Перевести клиента' }).click()
  await expect(page.getByRole('dialog').getByText('Выберите филиал.')).toBeVisible()
  await expect(page.getByRole('heading', { name: client.fullName, level: 1 })).toBeVisible()
  state.failTransfer = false
  await page.getByRole('dialog').getByRole('button', { name: 'Перевести клиента' }).click()
  await expect(page).toHaveURL(/\/clients$/)
})

for (const origin of ['attention', 'group'] as const) {
  test(`transfer returns to ${origin} and removes the old client row`, async ({ page }) => {
    const state = await mockScope(page)
    if (origin === 'attention') {
      await page.goto('/attention')
      await page.getByRole('button', { name: `Другие действия для ${client.fullName}` }).click()
      await page.getByRole('menuitem', { name: /Открыть карточку/ }).click()
    } else {
      await page.goto('/groups/group-1/edit')
      await page.getByTestId('group-client-row-client-1').getByRole('button', { name: `Открыть карточку клиента ${client.fullName}` }).click()
    }
    await page.getByRole('button', { name: 'Перевести', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Перевести клиента' }).click()
    await expect(page).toHaveURL(origin === 'attention' ? /\/attention$/ : /\/groups\/group-1\/edit$/)
    await expect(page.getByText(client.fullName, { exact: true })).toHaveCount(0)
    expect(state.readsAfterTransfer).toBe(0)
  })
}

test('restricted state stays reachable across the responsive viewport matrix', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Target iPhone projects use their native profiles in the behavioral scenarios')
  await mockScope(page, { denied: true })
  for (const [width, height] of [[360, 780], [390, 844], [420, 912], [440, 956], [912, 420], [956, 440], [768, 1024], [1440, 1200]]) {
    await page.setViewportSize({ width, height })
    await page.goto('/clients/client-1')
    await expect(page.getByText('Клиент недоступен.', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'К списку клиентов' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`restricted-${width}x${height}.png`), fullPage: true })
  }
})
