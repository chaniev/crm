import { expect, test } from '@playwright/test'

test('Диалог сброса сохраняет контекст, возвращает фокус и обрабатывает потерю ответа и права', async ({ page }, testInfo) => {
  const coach = {
    id: 'coach-173', fullName: 'Анастасия Александровна Миронова-Лебедева', login: 'a.konstantinova',
    role: 'Coach', isActive: true, mustChangePassword: false, passwordResetPending: false,
    branchId: null, branchName: null, messengerPlatform: null, messengerPlatformUserId: null,
    allowedActions: ['Edit', 'ResetPassword'], roleOptions: ['Coach'],
  }
  let attempts = 0
  await page.route(/^https?:\/\/[^/]+\/api\//, async route => {
    switch (new URL(route.request().url()).pathname) {
      case '/api/config':
        return route.fulfill({ json: { clubName: 'K4 PRO', themeId: 'default-green-v1' } })
      case '/api/auth/session':
        return route.fulfill({ json: {
          isAuthenticated: true, bootstrapMode: false, csrfToken: 'synthetic-csrf',
          user: {
            id: 'admin-173', fullName: 'Администратор', login: 'admin', role: 'Administrator',
            isActive: true, mustChangePassword: false, allowedSections: ['Attendance', 'Users'],
            landingScreen: 'Attendance', createRoleOptions: ['Coach'], assignedGroupIds: [],
            permissions: { canManageUsers: true },
          },
        } })
      case '/api/coaches/coach-173':
        return route.fulfill({ json: coach })
      case '/api/coaches/coach-173/reset-password':
        attempts++
        if (attempts === 1) return route.abort('connectionreset')
        coach.allowedActions = ['Edit']
        return route.fulfill({ status: 403, json: { code: 'branch_scope_forbidden', detail: 'Право на сброс изменилось.' } })
      default:
        throw new Error(`Unexpected request: ${route.request().method()} ${route.request().url()}`)
    }
  })

  if (testInfo.project.name === 'chromium') await page.setViewportSize({ width: 1440, height: 1200 })
  await page.goto('/coaches/coach-173/edit')
  const name = page.getByLabel('ФИО', { exact: true })
  await name.fill('Черновик профиля')
  const opener = page.getByRole('button', { name: 'Сбросить пароль', exact: true })
  await opener.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Сбросить пароль' })
  const password = dialog.getByLabel('Временный пароль', { exact: true })
  const submit = dialog.getByRole('button', { name: 'Сбросить пароль' })
  await expect(password).toBeFocused()
  await expect(dialog).toContainText(coach.fullName)
  await expect(dialog).toContainText(coach.login)
  await expect(dialog).toContainText('Все сеансы сотрудника завершатся')
  await expect(dialog).toContainText('Несохранённые изменения будут потеряны')
  await expect(password).toHaveAttribute('type', 'password')
  await page.screenshot({ path: testInfo.outputPath('reset-dialog.png'), animations: 'disabled' })
  await password.press('Tab')
  const reveal = dialog.getByRole('button', { name: 'Показать пароль' })
  await expect(reveal).toBeFocused()
  await reveal.press('Space')
  await expect(password).toHaveAttribute('type', 'text')
  await dialog.getByRole('button', { name: 'Скрыть пароль' }).press('Space')
  await expect(password).toHaveAttribute('type', 'password')
  await password.fill('example-only')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
  await opener.press('Enter')
  await expect(password).toHaveValue('')
  await dialog.getByRole('button', { name: 'Отмена' }).click()
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
  await opener.press('Enter')

  const portrait = page.viewportSize()!
  const viewports = testInfo.project.name === 'chromium'
    ? [{ width: 1440, height: 1200 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 360, height: 780 }]
    : [{ width: testInfo.project.name === 'iphone-air-webkit' ? 912 : 956, height: portrait.width }, { width: portrait.width, height: 420 }]
  for (const viewport of [...viewports, portrait]) {
    await page.setViewportSize(viewport)
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    await submit.scrollIntoViewIfNeeded()
    await expect(submit).toBeInViewport({ ratio: 1 })
    await submit.click({ trial: true })
    await password.scrollIntoViewIfNeeded()
    await expect(dialog.getByText('Временный пароль', { exact: true })).toBeInViewport({ ratio: 1 })
    await password.click({ trial: true })
  }
  await submit.click()
  await expect(password).toBeFocused()
  await expect(password).toHaveAttribute('aria-invalid', 'true')
  expect(attempts).toBe(0)

  await password.fill('synthetic-first')
  await submit.click()
  await expect(dialog).toContainText('Подтверждение не получено')
  await expect(password).toHaveValue('')
  expect(attempts).toBe(1)
  await password.fill('synthetic-second')
  await submit.click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('button', { name: 'Сбросить пароль' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: coach.fullName })).toBeFocused()
  await expect(name).toHaveValue('Черновик профиля')
  expect(attempts).toBe(2)
})
