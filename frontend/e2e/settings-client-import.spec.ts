import { expect, test, type Page } from '@playwright/test'
import { resolve } from 'node:path'

async function login(page: Page, role: string, loseResponse = false) {
  const state = { posts: 0, operationId: '', logoutPosts: 0 }
  if (loseResponse) await page.setExtraHTTPHeaders({ 'X-Test-Import-Drop-Response': 'true' })
  page.on('request', request => {
    const path = new URL(request.url()).pathname
    if (path === '/api/clients/import-xlsx' && request.method() === 'POST') state.posts++
    if (path === '/api/auth/logout') state.logoutPosts++
  })
  await page.goto('/settings')
  await page.getByRole('textbox', { name: 'Логин', exact: true }).waitFor()
  await page.evaluate(async role => {
    const session = await (await fetch('/api/auth/session')).json()
    const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': session.csrfToken }, body: JSON.stringify({ login: role, password: 'branch-settings-password' }) })
    if (!response.ok) throw new Error('Fixture login failed')
  }, role)
  await page.goto('/settings')
  return state
}
async function fill(page: Page, role: string, fixture: string) {
  await page.getByRole('tab', { name: 'Импорт', exact: true }).click()
  if (role === 'SuperAdministrator') {
    await page.getByRole('combobox', { name: 'Филиал', exact: true }).click()
    await page.getByRole('option', { name: 'Own branch', exact: true }).click()
  } else await expect(page.getByText('Own branch', { exact: true })).toBeVisible()
  await page.getByLabel('Название группы', { exact: true }).fill('Import group')
  await page.locator('input[type=file]').setInputFiles(resolve(`e2e/fixtures/client-import/${fixture}.xlsx`))
  await expect(page.getByRole('button', { name: 'Импортировать', exact: true })).toBeEnabled()
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
}

for (const role of ['SuperAdministrator', 'Administrator']) {
  test(`${role}: invalid file writes zero, corrected file imports all rows`, async ({ page }, info) => {
    test.setTimeout(120_000)
    if (info.project.name === 'chromium') await page.setViewportSize({ width: 390, height: 844 })
    const state = await login(page, role)
    await fill(page, role, '66-invalid')
    await page.screenshot({ path: info.outputPath('ready.png'), fullPage: true })
    await page.getByRole('button', { name: 'Импортировать', exact: true }).click()
    await expect(page.getByText('Исправьте ошибки импорта', { exact: true })).toBeVisible()
    await expect(page.getByText(/Строка 62 · Телефон/)).toBeVisible()
    await expect(page.getByLabel('Название группы', { exact: true })).toHaveValue('Import group')
    await noOverflow(page)
    await page.screenshot({ path: info.outputPath('errors.png'), fullPage: true })
    await page.locator('input[type=file]').setInputFiles(resolve('e2e/fixtures/client-import/66-corrected.xlsx'))
    await page.getByRole('button', { name: 'Импортировать', exact: true }).click()
    await expect(page.getByText('Создано 66 клиентов', { exact: true })).toBeVisible({ timeout: 30_000 })
    expect(state.posts).toBe(2)
    await page.getByRole('tab', { name: 'Абонементы', exact: true }).click()
    await page.getByRole('tab', { name: 'Импорт', exact: true }).click()
    await expect(page.getByText('Создано 66 клиентов', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Новый импорт', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Импортировать', exact: true })).toBeDisabled()
    await noOverflow(page)
  })
}

test('lost response after commit shows unknown and logout waits for explicit leave', async ({ page }, info) => {
  test.setTimeout(120_000)
  const state = await login(page, 'SuperAdministrator', true)
  await fill(page, 'SuperAdministrator', '48-corrected')
  await page.getByRole('button', { name: 'Импортировать', exact: true }).click()
  await expect(page.getByText('Результат импорта не подтверждён', { exact: true })).toBeVisible({ timeout: 30_000 })
  expect(state.posts).toBe(1)
  state.operationId = (await page.locator('code').first().textContent())!
  await expect(page.getByText(state.operationId, { exact: true })).toBeVisible()
  const audit = await page.evaluate(async () => (await fetch('/api/audit-logs?actionType=ClientImportCompleted&take=100')).json())
  expect(audit.items.some((entry: { entityId: string }) => entry.entityId === state.operationId)).toBe(true)
  await noOverflow(page)
  await page.screenshot({ path: info.outputPath('unknown.png'), fullPage: true })
  await page.getByRole('button', { name: 'Посещения', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Уйти со страницы импорта?' })).toBeVisible()
  await expect(page).toHaveURL(/\/settings$/)
  await page.getByRole('button', { name: 'Остаться', exact: true }).click()
  await page.locator('.app-shell__profile-trigger').click()
  await page.getByRole('menuitem', { name: 'Смена пароля', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page).toHaveURL(/\/settings$/)
  await page.getByRole('button', { name: 'Остаться', exact: true }).click()
  await page.locator('.app-shell__profile-trigger').click()
  await page.getByRole('menuitem', { name: 'Выход', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Уйти со страницы импорта?' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toBeInViewport({ ratio: 0.9 })
  expect(state.logoutPosts).toBe(0)
  await expect(dialog.getByRole('button', { name: 'Остаться', exact: true })).toBeFocused()
  await page.screenshot({ path: info.outputPath('leave-dialog.png'), animations: 'disabled' })
  await dialog.screenshot({ path: info.outputPath('leave-dialog-element.png'), animations: 'disabled' })
  await dialog.getByRole('button', { name: 'Остаться', exact: true }).click()
  expect(state.posts).toBe(1)
  await page.locator('.app-shell__profile-trigger').click()
  await page.getByRole('menuitem', { name: 'Выход', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Уйти со страницы', exact: true }).click()
  await expect.poll(() => state.logoutPosts).toBe(1)
})

for (const role of ['HeadCoach', 'Coach']) test(`${role}: import unavailable`, async ({ page }) => {
  await login(page, role)
  await expect(page.getByRole('tab', { name: 'Импорт', exact: true })).toHaveCount(0)
})

test('form keeps long names and actions reachable at all required widths', async ({ page }, info) => {
  await login(page, 'SuperAdministrator')
  await fill(page, 'SuperAdministrator', '48-corrected')
  for (const [width, height] of info.project.name === 'chromium' ? [[360,780],[390,844],[768,1024],[1440,1200],[912,420],[956,440]] : [[info.project.name === 'iphone-air-webkit' ? 420 : 440, 700]]) {
    await page.setViewportSize({ width, height })
    await page.getByLabel('Название группы', { exact: true }).fill('Очень длинное название существующей группы для проверки переноса текста')
    await page.getByRole('button', { name: 'Импортировать', exact: true }).scrollIntoViewIfNeeded()
    await expect(page.getByRole('button', { name: 'Импортировать', exact: true })).toBeVisible()
    await noOverflow(page)
    await page.screenshot({ path: info.outputPath(`geometry-${width}.png`), fullPage: true })
  }
})
