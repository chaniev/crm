import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

// Invoked by TASK-187's managed runtime probe against a disposable task stack.
const runtimeUrl = process.env.TASK187_RUNTIME_URL
const password = 'task187-runtime-password'

test('TASK-187 real backend: two administrators, global coaches and branch-owned groups', async ({ browser, playwright }, testInfo) => {
  test.skip(!runtimeUrl, 'Requires the isolated TASK-187 runtime stack')
  test.setTimeout(180_000)
  const baseURL = runtimeUrl!
  expect(new URL(baseURL).hostname).toBe('127.0.0.1')
  const head = await playwright.request.newContext({ baseURL })
  const suffix = Date.now().toString()
  const initial = await (await head.get('/api/auth/session')).json()
  const login = await head.post('/api/auth/login', {
    headers: { 'X-CSRF-TOKEN': initial.csrfToken },
    data: { login: 'headcoach', password: initial.bootstrapMode ? '12345678' : password },
  })
  expect(login.status()).toBe(200)
  let headSession = await login.json()
  if (headSession.user.mustChangePassword) {
    const changed = await head.post('/api/auth/change-password', {
      headers: { 'X-CSRF-TOKEN': headSession.csrfToken },
      data: { currentPassword: '12345678', newPassword: password },
    })
    expect(changed.status()).toBe(200)
    headSession = await changed.json()
  }
  const create = async (path: string, data: unknown) => {
    const response = await head.post(`/api${path}`, { headers: { 'X-CSRF-TOKEN': headSession.csrfToken }, data })
    expect(response.status(), await response.text()).toBe(201)
    return response.json()
  }
  const branchA = await create('/branches', { name: `Центр ${suffix}` })
  const branchB = await create('/branches', { name: `Север ${suffix}` })
  const hallA = await create('/halls', { branchId: branchA.id, name: `Зал центра ${suffix}` })
  const hallB = await create('/halls', { branchId: branchB.id, name: `Зал севера ${suffix}` })
  const groupType = await create('/group-types', { name: `Групповой ${suffix}` })
  const admins = []
  for (const [index, branch] of [branchA, branchB].entries()) {
    admins.push(await create('/settings/administrators', {
      fullName: `Администратор ${index + 1}`, login: `admin-${index}-${suffix}`, password,
      role: 'Administrator', branchId: branch.id, isActive: true, mustChangePassword: false,
    }))
  }
  const foreignPayload = {
    name: `Чужая группа ${suffix}`, branchId: branchB.id, hallId: hallB.id, groupTypeId: groupType.id,
    trainingStartTime: '12:00', durationMinutes: 60, weekdays: [1], isActive: true, trainerIds: [],
    initialLessonSeries: { startsOn: '2035-01-01', endsOn: null, slots: [{ isoWeekday: 1, startTime: '12:00', durationMinutes: 60, hallId: hallB.id }] },
  }
  const foreignPreview = await head.post('/api/groups/preview', { headers: { 'X-CSRF-TOKEN': headSession.csrfToken }, data: foreignPayload })
  expect(foreignPreview.status()).toBe(200)
  const foreignGroup = await create('/groups', { ...foreignPayload, confirmationToken: (await foreignPreview.json()).confirmationToken })
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } })
  const second = await playwright.request.newContext({ baseURL })
  try {
    const firstSession = await signIn(context.request, admins[0].login)
    const secondSession = await signIn(second, admins[1].login)
    expect(firstSession.user.createRoleOptions).toEqual(['Coach'])
    expect(firstSession.user.allowedSections).toContain('Users')
    expect(firstSession.user.attendanceScope.kind).toBe('AdministratorGrants')
    const page = await context.newPage()
    page.setDefaultTimeout(15_000)
    await page.goto('/attendance')
    await page.getByRole('button', { name: 'Ещё, открыть остальные разделы', exact: true }).click()
    await page.getByRole('button', { name: 'Тренеры', exact: true }).click()
    await page.getByRole('button', { name: 'Создать тренера' }).click()
    await expect(page.getByRole('combobox', { name: 'Роль' })).toHaveCount(0)
    await expect(page.getByLabel('Филиал администратора')).toHaveCount(0)
    await page.getByLabel('ФИО', { exact: true }).fill('Александра Константинова')
    const coachLogin = `coach-${suffix}`
    await page.getByLabel('Логин', { exact: true }).fill(coachLogin)
    await page.getByLabel('Стартовый пароль').fill(password)
    const createdResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/coaches' && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Сохранить тренера' }).click()
    const created = await createdResponse
    expect(created.status()).toBe(201)
    const coach = await created.json()
    expect(coach.branchId).toBeNull()
    await expect(page).toHaveURL(/\/coaches$/)
    await page.reload()
    await page.getByRole('textbox', { name: 'Найти тренера' }).fill(coachLogin)
    await page.getByTestId(`user-card-${coach.id}`).click()
    await expect(page.getByLabel('Логин', { exact: true })).toHaveAttribute('readonly', '')
    await page.getByLabel('ФИО', { exact: true }).fill('Александра Константинова Новая')
    await page.getByRole('switch', { name: 'Тренер активен' }).uncheck()
    await page.getByRole('button', { name: 'Сохранить изменения' }).click()
    await expect(page).toHaveURL(/\/coaches$/)
    const otherRead = await second.get(`/api/coaches/${coach.id}`)
    expect(otherRead.status()).toBe(200)
    const updated = await otherRead.json()
    expect(updated.fullName).toBe('Александра Константинова Новая')
    expect(updated.isActive).toBe(false)
    const reactivated = await second.put(`/api/coaches/${coach.id}`, {
      headers: { 'X-CSRF-TOKEN': secondSession.csrfToken }, data: { ...updated, isActive: true },
    })
    expect(reactivated.status()).toBe(200)
    await page.reload()
    await page.getByTestId(`user-card-${coach.id}`).click()
    for (const width of [390, 420, 440, 1440]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1200 : 956 })
      await expect(page.getByRole('button', { name: 'Сохранить изменения' })).toBeVisible()
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`runtime-edit-${width}.png`), fullPage: true })
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/groups/new')
    await choose(page, 'Филиал', branchA.name)
    await choose(page, 'Зал', hallA.name)
    await choose(page, 'Тип группы', groupType.name)
    await page.getByRole('textbox', { name: 'Название группы' }).fill(`Своя группа ${suffix}`)
    await page.getByLabel('Время начала', { exact: true }).fill('10:00')
    await page.getByLabel('Длительность', { exact: true }).fill('60')
    await page.getByRole('checkbox', { name: 'Пн', exact: true }).check()
    await page.getByLabel('Начало расписания', { exact: true }).fill('2035-01-01')
    await choose(page, 'Основные тренеры группы', `${updated.fullName} (${coachLogin})`)
    await page.getByRole('heading', { name: 'Новая группа', exact: true }).click()
    await page.getByRole('button', { name: 'Получить предпросмотр', exact: true }).click()
    const groupCreated = page.waitForResponse(response => new URL(response.url()).pathname === '/api/groups' && response.request().method() === 'POST')
    await page.getByRole('button', { name: 'Создать группу', exact: true }).click()
    const groupResponse = await groupCreated
    expect(groupResponse.status()).toBe(201)
    const group = await groupResponse.json()
    await expect(page).toHaveURL(/\/groups$/)
    await page.goto(`/groups/${group.id}/edit`)
    const assignments = page.locator('.group-trainer-assignments-card')
    await assignments.getByLabel('Окончание периода 1', { exact: true }).fill('2035-12-31')
    const assignmentPreview = page.waitForResponse(response => response.url().endsWith(`/groups/${group.id}/trainer-assignments/preview`) && response.request().method() === 'POST')
    await assignments.getByRole('button', { name: 'Получить предпросмотр', exact: true }).click()
    const previewResponse = await assignmentPreview
    expect(previewResponse.status(), await previewResponse.text()).toBe(200)
    const assignmentSaved = page.waitForResponse(response => response.url().endsWith(`/groups/${group.id}/trainer-assignments`) && response.request().method() === 'POST')
    await assignments.getByRole('button', { name: 'Сохранить назначения', exact: true }).click()
    expect((await assignmentSaved).status()).toBe(200)
    const foreignDenied = await context.request.get(`/api/groups/${foreignGroup.id}`)
    expect(foreignDenied.status()).toBe(403)
    expect((await foreignDenied.json()).code).toBe('branch_scope_forbidden')
    const foreignAssignment = await context.request.post(`/api/groups/${foreignGroup.id}/trainer-assignments/preview`, {
      headers: { 'X-CSRF-TOKEN': firstSession.csrfToken }, data: { assignments: [{ trainerId: coach.id, validFrom: '2035-01-01', validTo: null }] },
    })
    expect(foreignAssignment.status()).toBe(403)
    await page.goto(`/groups/${foreignGroup.id}/edit`)
    await expect(page.getByRole('button', { name: 'Сохранить назначения', exact: true })).toHaveCount(0)
    await expect(page.getByText('Экран редактирования не загрузился', { exact: true })).toBeVisible()
    await page.goto('/settings')
    await expect(page.getByRole('tab', { name: 'Администраторы', exact: true })).toHaveCount(0)
    expect((await context.request.get('/api/settings/administrators')).status()).toBe(403)
    expect((await second.get(`/api/coaches/${coach.id}`)).status()).toBe(200)
    await testInfo.attach('runtime-scope', { body: JSON.stringify({ branches: [branchA.id, branchB.id], administrators: admins.map(admin => admin.id), coachId: coach.id, groupId: group.id, foreignGroupId: foreignGroup.id }), contentType: 'application/json' })
  } finally {
    await context.close()
    await second.dispose()
    await head.dispose()
  }
})

async function signIn(request: APIRequestContext, login: string) {
  const initial = await (await request.get('/api/auth/session')).json()
  const response = await request.post('/api/auth/login', { headers: { 'X-CSRF-TOKEN': initial.csrfToken }, data: { login, password } })
  expect(response.status()).toBe(200)
  return response.json()
}

async function choose(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}
