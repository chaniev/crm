import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const initialPassword = 'Synthetic-original-173'
const firstPassword = 'synthetic-first-173'
const lastPassword = ' synthetic-last-173 '
const personalPassword = 'Synthetic-personal-173'

async function login(request: APIRequestContext, loginName: string, password: string) {
  const anonymous = await (await request.get('/api/auth/session')).json()
  return request.post('/api/auth/login', {
    headers: { 'X-CSRF-TOKEN': anonymous.csrfToken },
    data: { login: loginName, password },
  })
}

async function completeReset(page: Page, temporaryPassword: string) {
  const dialog = page.getByRole('dialog', { name: 'Сбросить пароль' })
  await dialog.getByLabel('Временный пароль', { exact: true }).fill(temporaryPassword)
  const result = page.waitForResponse(r => r.url().endsWith('/reset-password') && r.request().method() === 'POST')
  await dialog.getByRole('button', { name: 'Сбросить пароль' }).click()
  expect((await result).status()).toBe(204)
  await expect(dialog).toBeHidden()
}

test('Сброс отзывает обе сессии тренера, повторный сброс заменяет пароль, замещение не даёт права', async ({ page, browser, baseURL }) => {
  test.skip(!process.env.TASK173_RUNTIME_URL, 'Runs against the managed TASK-173 stack')
  test.setTimeout(150_000)
  expect(baseURL).toBe(process.env.TASK173_RUNTIME_URL)
  expect(new URL(baseURL!).hostname).toBe('127.0.0.1')
  const head = page.request
  const bootstrap = await (await head.get('/api/auth/session')).json()
  const headLogin = await login(head, 'headcoach', bootstrap.bootstrapMode ? '12345678' : initialPassword)
  expect(headLogin.status()).toBe(200)
  let headSession = await headLogin.json()
  if (headSession.user.mustChangePassword) {
    const result = await head.post('/api/auth/change-password', {
      headers: { 'X-CSRF-TOKEN': headSession.csrfToken },
      data: { currentPassword: '12345678', newPassword: initialPassword },
    })
    expect(result.status()).toBe(200)
    headSession = await result.json()
  }
  const post = async (path: string, data: object, status = 201) => {
    const result = await head.post('/api' + path, { data, headers: { 'X-CSRF-TOKEN': headSession.csrfToken } })
    expect(result.status(), path).toBe(status)
    return result.json()
  }
  const suffix = Date.now().toString(36)
  const branch = await post('/branches', { name: 'Филиал ' + suffix })
  const hall = await post('/halls', { name: 'Зал ' + suffix, branchId: branch.id })
  const groupType = await post('/group-types', { name: 'Тип ' + suffix })
  const staff = { password: initialPassword, isActive: true, mustChangePassword: false }
  const administrator = await post('/settings/administrators', {
    ...staff, fullName: 'Администратор Примерова', login: 'admin-' + suffix, role: 'Administrator', branchId: branch.id,
  })
  const coach = await post('/coaches', { ...staff, fullName: 'Тренер Основная', login: 'coach-' + suffix, role: 'Coach' })
  const substitute = await post('/coaches', { ...staff, fullName: 'Тренер Замещающий', login: 'sub-' + suffix, role: 'Coach' })
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(new Date())
  const weekday = new Date(today + 'T12:00:00Z').getUTCDay() || 7
  const groupPayload = {
    name: 'Группа ' + suffix, branchId: branch.id, hallId: hall.id, groupTypeId: groupType.id,
    trainingStartTime: '12:00', durationMinutes: 60, weekdays: [weekday], isActive: true, trainerIds: [coach.id],
    initialLessonSeries: { startsOn: today, endsOn: null, slots: [{ isoWeekday: weekday, startTime: '12:00', durationMinutes: 60, hallId: hall.id }] },
  }
  const preview = await post('/groups/preview', groupPayload, 200)
  const group = await post('/groups', { ...groupPayload, confirmationToken: preview.confirmationToken })
  await post(`/groups/${group.id}/trainer-substitution-periods`, { substituteTrainerId: substitute.id, startsOn: today, endsOn: today })

  const initiator = await browser.newContext({ baseURL })
  const first = await browser.newContext({ baseURL })
  const second = await browser.newContext({ baseURL })
  try {
    expect((await login(first.request, coach.login, initialPassword)).status()).toBe(200)
    expect((await login(second.request, coach.login, initialPassword)).status()).toBe(200)
    for (const recipient of [first, second]) {
      expect((await recipient.request.get('/api/attendance/groups')).status()).toBe(200)
    }
    const recipient = await first.newPage()
    await recipient.goto('/clients')
    const search = recipient.getByRole('textbox', { name: 'Поиск по имени', exact: true })
    await expect(search).toBeVisible()
    const adminLogin = await login(initiator.request, administrator.login, initialPassword)
    expect(adminLogin.status()).toBe(200)
    const csrf = (await adminLogin.json()).csrfToken
    const actor = await initiator.newPage()
    await actor.goto(`/coaches/${substitute.id}/edit`)
    await expect(actor.getByLabel('ФИО', { exact: true })).toHaveValue(substitute.fullName)
    await expect(actor.getByRole('button', { name: 'Сбросить пароль' })).toHaveCount(0)
    const denied = await initiator.request.post(`/api/coaches/${substitute.id}/reset-password`, {
      headers: { 'X-CSRF-TOKEN': csrf }, data: { temporaryPassword: firstPassword },
    })
    expect(denied.status()).toBe(403)
    expect((await denied.json()).code).toBe('branch_scope_forbidden')
    const unchanged = await browser.newContext({ baseURL })
    try {
      const original = await login(unchanged.request, substitute.login, initialPassword)
      expect(original.status()).toBe(200)
      expect((await original.json()).user.mustChangePassword).toBe(false)
    } finally {
      await unchanged.close()
    }

    await actor.goto(`/coaches/${coach.id}/edit`)
    await actor.getByLabel('ФИО', { exact: true }).fill('Черновик инициатора')
    const reset = actor.getByRole('button', { name: 'Сбросить пароль', exact: true })
    await reset.click()
    await completeReset(actor, firstPassword)
    await expect(actor.getByLabel('ФИО', { exact: true })).toHaveValue('Черновик инициатора')
    await expect(actor.getByRole('switch', { name: /Требовать смену пароля/ })).toBeDisabled()
    expect((await second.request.get('/api/attendance/groups')).status()).toBe(401)
    const rejection = recipient.waitForResponse(r => new URL(r.url()).pathname === '/api/clients' && r.status() === 401)
    await search.fill('Незавершённый поиск')
    await rejection
    await expect(recipient.getByLabel('Логин', { exact: true })).toBeVisible()

    await reset.click()
    const dialog = actor.getByRole('dialog', { name: 'Сбросить пароль' })
    const input = dialog.getByLabel('Временный пароль', { exact: true })
    await input.fill(firstPassword)
    await dialog.getByRole('button', { name: 'Сбросить пароль' }).click()
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await completeReset(actor, lastPassword)

    await recipient.getByLabel('Логин', { exact: true }).fill(coach.login)
    await recipient.getByLabel('Пароль', { exact: true }).fill(firstPassword)
    const badLogin = recipient.waitForResponse(r => r.url().endsWith('/auth/login'))
    await recipient.getByRole('button', { name: 'Войти' }).click()
    expect((await badLogin).status()).toBe(401)
    await recipient.getByLabel('Пароль', { exact: true }).fill(lastPassword)
    await recipient.getByRole('button', { name: 'Войти' }).click()
    await expect(recipient.getByRole('heading', { name: 'Смените пароль' })).toBeVisible()
    expect((await first.request.get('/api/attendance/groups')).status()).toBe(403)
    await recipient.getByLabel('Текущий пароль').fill(lastPassword)
    const personal = recipient.getByLabel('Новый пароль', { exact: true })
    const confirmation = recipient.getByLabel('Повторите новый пароль')
    await personal.fill('Synthetic 173')
    await confirmation.fill('Synthetic 173')
    await recipient.getByRole('button', { name: 'Сменить пароль и продолжить' }).click()
    await expect(personal).toHaveAccessibleDescription(/недопустимые символы/)
    expect((await first.request.get('/api/attendance/groups')).status()).toBe(403)
    await personal.fill(personalPassword)
    await confirmation.fill(personalPassword)
    await recipient.getByRole('button', { name: 'Сменить пароль и продолжить' }).click()
    await expect(recipient.getByRole('heading', { name: 'Смените пароль' })).toBeHidden()
    expect((await first.request.get('/api/attendance/groups')).status()).toBe(200)
    await recipient.goto('/clients')
    await expect(search).toHaveValue('')
    const restored = await (await first.request.get('/api/auth/session')).json()
    expect(restored.user.id).toBe(coach.id)
    expect(restored.user.mustChangePassword).toBe(false)
    expect((await second.request.get('/api/attendance/groups')).status()).toBe(401)
    const persistentAdmin = await (await initiator.request.get('/api/auth/session')).json()
    expect(persistentAdmin.user.id).toBe(administrator.id)

    await page.goto('/settings')
    await page.getByRole('tab', { name: 'Администраторы' }).click()
    const row = page.getByTestId('administrator-card-' + administrator.id)
    await row.getByRole('button', { name: /Сбросить пароль/ }).click()
    await completeReset(page, firstPassword)
    expect((await initiator.request.get('/api/coaches')).status()).toBe(401)
    await row.getByRole('button', { name: /Редактировать/ }).click()
    const locked = page.getByRole('dialog').getByRole('switch', { name: /Требовать смену пароля/ })
    await expect(locked).toBeChecked()
    await expect(locked).toBeDisabled()
  } finally {
    await Promise.all([initiator.close(), first.close(), second.close()])
  }
})
