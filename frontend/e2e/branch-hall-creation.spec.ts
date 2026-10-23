import { expect, test, type Page, type Route } from '@playwright/test'
import { BRANCH_SETTINGS_ACTIONS, type Branch, type Hall } from '../src/lib/api/types'

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: status >= 400 ? 'application/problem+json' : 'application/json', body: JSON.stringify(body) })
}

async function mockSettings(page: Page, role = 'SuperAdministrator', empty = false) {
  const branches: Branch[] = empty ? [] : [{ id: 'branch-1', name: 'Центр', address: 'ул. Лесная, 1', description: null, isArchived: false, hallCount: 1, groupCount: 4, clientCount: 12 }]
  const halls: Hall[] = empty ? [] : [{ id: 'hall-1', branchId: 'branch-1', branchName: 'Центр', name: 'Основной зал', description: 'Большой зал', isArchived: false, groupCount: 4 }]
  let nextId = 2
  const state = { archiveOnSave: false, failBranch: false }
  const actions = role === 'HeadCoach' ? [...BRANCH_SETTINGS_ACTIONS] : role === 'SuperAdministrator' ? ['View', 'CreateBranch', 'CreateHall'] : []
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (!path.startsWith('/api/')) return route.continue()
    const method = route.request().method()
    if (path === '/api/config') return json(route, { clubName: 'Gym CRM', themeId: 'default-green-v1', authBackgroundImageId: 'k4pro-login-v1' })
    if (path === '/api/auth/session') return json(route, {
      isAuthenticated: true, csrfToken: 'branch-hall-csrf', bootstrapMode: false,
      user: { id: role, fullName: role, login: role, role, isActive: true, mustChangePassword: false,
        landingScreen: role === 'Coach' ? 'Attendance' : 'Settings', allowedSections: role === 'Coach' ? ['Attendance'] : ['Settings'], branchId: role === 'Administrator' ? 'branch-1' : null,
        permissions: { canManageSettings: role !== 'Coach', canManageUsers: role === 'HeadCoach' || role === 'SuperAdministrator' },
        createRoleOptions: role === 'HeadCoach' ? ['Administrator', 'SuperAdministrator'] : role === 'SuperAdministrator' ? ['Administrator'] : [],
        branchSettingsActions: actions, assignedGroupIds: [] },
    })
    if (path === '/api/branches' && method === 'GET') return json(route, branches)
    if (path === '/api/halls' && method === 'GET') return json(route, halls)
    if (path === '/api/settings/membership-catalog' && method === 'GET') return json(route, [])
    if (path === '/api/branches' && method === 'POST') {
      if (state.failBranch) return json(route, { title: 'Не удалось создать филиал', errors: { name: ['Укажите название филиала.'] } }, 400)
      const item = { ...route.request().postDataJSON(), id: `branch-${nextId++}`, isArchived: false, hallCount: 0, groupCount: 0, clientCount: 0 }
      branches.push(item)
      return json(route, item, 201)
    }
    if (path === '/api/halls' && method === 'POST') {
      const input = route.request().postDataJSON()
      const branch = branches.find(item => item.id === input.branchId)!
      if (state.archiveOnSave) branch.isArchived = true
      if (branch.isArchived) return json(route, { title: 'Проверьте поля', errors: { branchId: ['Выбранный филиал архивирован.'] } }, 400)
      const item = { ...input, id: `hall-${nextId++}`, branchName: branch.name, isArchived: false, groupCount: 0 }
      halls.push(item)
      branch.hallCount++
      return json(route, item, 201)
    }
    if (method === 'GET') return json(route, [])
    throw new Error(`Unexpected mutation ${method} ${path}`)
  })
  return { state, branches, halls }
}

async function openBranches(page: Page) {
  await page.goto('/settings')
  await page.getByRole('tab', { name: 'Филиалы и залы' }).click()
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
}

test('SuperAdministrator creates branch then hall, selects branch and reloads', async ({ page }, testInfo) => {
  await mockSettings(page)
  await openBranches(page)
  await expect(page.getByRole('button', { name: /Редактировать|Архивировать|Удалить|В архив/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Добавить филиал' }).click()
  const branchDialog = page.getByRole('dialog', { name: 'Новый филиал' })
  await branchDialog.getByLabel('Название филиала').fill('Северный филиал')
  await branchDialog.getByLabel('Адрес').fill('ул. Северная, 27')
  await branchDialog.getByLabel('Описание').fill('Зал для вечерних тренировок')
  await page.screenshot({ path: testInfo.outputPath('branch-form.png'), fullPage: true, animations: 'disabled', scale: 'css' })
  await branchDialog.getByRole('button', { name: 'Сохранить' }).click()
  await expect(branchDialog).toBeHidden()
  await expect(page.getByRole('button', { name: 'Открыть филиал Северный филиал' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.settings-branch-row')).toHaveCount(2)
  await page.getByRole('button', { name: 'Добавить зал' }).click()
  const hallDialog = page.getByRole('dialog', { name: 'Новый зал' })
  await expect(hallDialog.getByText('Филиал: Северный филиал')).toBeVisible()
  await hallDialog.getByLabel('Название зала').fill('Зал растяжки')
  await hallDialog.getByRole('button', { name: 'Сохранить' }).click()
  await expect(hallDialog).toBeHidden()
  await expect(page.getByText('Зал растяжки', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Добавить зал' })).toBeFocused()
  await page.reload()
  await page.getByRole('tab', { name: 'Филиалы и залы' }).click()
  await page.getByRole('button', { name: 'Открыть филиал Северный филиал' }).click()
  await expect(page.getByText('Зал растяжки', { exact: true })).toBeVisible()
  await noOverflow(page)
})

test('archived-between-load-and-save error stays inside hall form and preserves input for retry', async ({ page }, testInfo) => {
  const fixture = await mockSettings(page)
  await openBranches(page)
  const trigger = page.getByRole('button', { name: 'Добавить зал' })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Новый зал' })
  await dialog.getByLabel('Название зала').fill('Новый зал')
  fixture.state.archiveOnSave = true
  await dialog.getByRole('button', { name: 'Сохранить' }).click()
  await expect(dialog.getByText('Выбранный филиал архивирован.')).toBeVisible()
  await expect(page.getByText('Выбранный филиал архивирован.')).toHaveCount(1)
  await expect(dialog.getByLabel('Название зала')).toHaveValue('Новый зал')
  await page.screenshot({ path: testInfo.outputPath('hall-error.png'), fullPage: true, animations: 'disabled', scale: 'css' })
  await noOverflow(page)
  fixture.state.archiveOnSave = false
  fixture.branches[0].isArchived = false
  await dialog.getByRole('button', { name: 'Сохранить' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText('Новый зал', { exact: true })).toBeVisible()
})

test('empty list offers first branch, branch validation preserves all fields', async ({ page }) => {
  const fixture = await mockSettings(page, 'SuperAdministrator', true)
  await openBranches(page)
  await expect(page.getByRole('button', { name: 'Добавить зал' })).toHaveCount(0)
  const trigger = page.getByRole('button', { name: 'Добавить филиал' })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Новый филиал' })
  await dialog.getByLabel('Название филиала').fill('Первый филиал')
  await dialog.getByLabel('Адрес').fill('ул. Новая, 1')
  fixture.state.failBranch = true
  await dialog.getByRole('button', { name: 'Сохранить' }).click()
  await expect(dialog.getByText('Не удалось создать филиал')).toBeVisible()
  await expect(dialog.getByLabel('Адрес')).toHaveValue('ул. Новая, 1')
  fixture.state.failBranch = false
  await dialog.getByRole('button', { name: 'Сохранить' }).click()
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
  await expect(page.getByRole('button', { name: 'Добавить зал' })).toBeEnabled()
})

for (const role of ['Administrator', 'Coach']) {
  test(`${role} receives no branch panel or create controls`, async ({ page }) => {
    await mockSettings(page, role)
    await page.goto('/settings')
    if (role === 'Administrator') await expect(page.getByRole('tab', { name: 'Абонементы' })).toBeVisible()
    else await expect(page.getByRole('heading', { level: 1, name: 'Нет доступа' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Филиалы и залы' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Добавить филиал' })).toHaveCount(0)
  })
}

test('HeadCoach keeps existing controls and modal focus return', async ({ page }, testInfo) => {
  await mockSettings(page, 'HeadCoach')
  await openBranches(page)
  await expect(page.getByRole('button', { name: 'Редактировать', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'В архив', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Редактировать зал Основной зал' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Архивировать зал Основной зал' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Удалить зал Основной зал' })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('headcoach-panel.png'), fullPage: true, animations: 'disabled', scale: 'css' })
  const trigger = page.getByRole('button', { name: 'Добавить зал' })
  await trigger.click()
  await page.getByRole('dialog').getByRole('button', { name: 'Отменить' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('forms remain reachable at narrow, tablet, desktop and compact heights', async ({ page }, testInfo) => {
  await mockSettings(page)
  const sizes = testInfo.project.name === 'chromium'
    ? [[360, 780], [390, 844], [768, 1024], [1440, 1200]]
    : testInfo.project.name === 'iphone-air-webkit' ? [[912, 420]] : [[956, 440]]
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height })
    await openBranches(page)
    await page.getByRole('button', { name: 'Добавить зал' }).click()
    const dialog = page.getByRole('dialog', { name: 'Новый зал' })
    await dialog.getByLabel('Название зала').fill('Длинное название зала для вечерних занятий')
    const save = dialog.getByRole('button', { name: 'Сохранить' })
    await save.scrollIntoViewIfNeeded()
    await expect(save).toBeInViewport()
    await noOverflow(page)
    await page.screenshot({ path: testInfo.outputPath(`hall-form-${width}x${height}.png`), animations: 'disabled', scale: 'css' })
    await dialog.getByRole('button', { name: 'Отменить' }).click()
    await expect(dialog).toBeHidden()
  }
})
