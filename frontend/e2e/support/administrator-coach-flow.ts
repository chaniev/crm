import { expect, type Page } from '@playwright/test'
import type { SessionResponse, UserDetails } from '../../src/lib/api'

export async function administratorCoachFlow(page: Page) {
  const session: SessionResponse = {
    isAuthenticated: true, csrfToken: 'task187', bootstrapMode: false,
    user: {
      id: 'admin-187', fullName: 'Администратор', login: 'admin187', role: 'Administrator',
      mustChangePassword: false, isActive: true, landingScreen: 'Attendance',
      allowedSections: ['Attendance', 'Attention', 'Schedule', 'Clients', 'Groups', 'Users', 'Settings'],
      permissions: {
        canManageUsers: true, canManageClients: true, canManageGroups: true,
        canManageSettings: true, canMarkAttendance: true, canViewAuditLog: false, canViewFinancialReports: false,
      },
      assignedGroupIds: [], attendanceScope: { kind: 'AdministratorGrants', groupIds: [] },
      branchId: 'branch-1', createRoleOptions: ['Coach'],
    },
  }
  let coach: UserDetails | null = null
  let failList = false
  let failCreate = true
  let createCalls = 0
  let updateCalls = 0
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    let status = 200
    let body: unknown = { items: [] }
    if (path === '/api/auth/session') body = session
    else if (path === '/api/attendance/lessons/today') body = { today: '2026-10-08', items: [] }
    else if (path === '/api/config') body = { clubName: 'Iron Club', themeId: 'default-green-v1' }
    else if (path === '/api/coaches' && method === 'GET') {
      if (failList) { status = 503; body = { title: 'Список временно недоступен' } }
      else body = { items: coach ? [coach] : [], createRoleOptions: ['Coach'] }
    } else if (path === '/api/coaches' && method === 'POST') {
      createCalls += 1
      const payload = route.request().postDataJSON()
      expect(payload.role).toBe('Coach')
      expect(payload.branchId).toBeNull()
      if (failCreate) {
        failCreate = false; status = 400; body = { title: 'Проверьте логин', errors: { Password: ['Пароль нужно изменить'], Login: ['Логин уже занят'] } }
      } else {
        coach = { ...payload, id: 'coach-187', allowedActions: ['Edit', 'Deactivate', 'Reactivate'], roleOptions: ['Coach'] }
        body = coach; status = 201
      }
    } else if (path === '/api/coaches/coach-187') {
      body = coach
      if (method === 'PUT') {
        updateCalls += 1
        if (updateCalls === 1) {
          status = 400
          body = { title: 'Проверьте ФИО', errors: { FullName: ['Введите полное ФИО'] } }
        } else {
          coach = { ...coach!, ...route.request().postDataJSON() }
          body = coach
        }
      }
    } else if (!['/api/attendance/lessons/today', '/api/attendance/groups', '/api/clients/attention', '/api/clients/expiring-memberships'].includes(path)) {
      throw new Error(`Unexpected TASK-187 request: ${method} ${path}`)
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await page.goto('/attendance')
  await expect(page.getByRole('button', { name: 'Открыть профильное меню пользователя Администратор' })).toBeVisible()
  const desktop = page.locator('.app-shell__side-nav').getByRole('link', { name: 'Тренеры', exact: true })
  if (await desktop.isVisible()) await desktop.click()
  else {
    const more = page.getByRole('button', { name: 'Ещё, открыть остальные разделы', exact: true })
    await more.click()
    await page.getByRole('button', { name: 'Закрыть остальные разделы' }).click()
    await expect(more).toBeFocused()
    await more.click()
    await page.getByRole('link', { name: 'Тренеры', exact: true }).click()
  }
  await expect(page).toHaveURL(/\/coaches$/)
  await expect(page.getByRole('button', { name: 'Создать тренера' })).toBeVisible()
  failList = true
  await page.getByRole('button', { name: 'Обновить', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Повторить' })).toBeVisible()
  failList = false
  await page.getByRole('button', { name: 'Повторить' }).click()
  await page.getByRole('button', { name: 'Создать тренера' }).click()
  await expect(page).toHaveURL(/\/coaches\/new$/)
  await expect(page.getByRole('combobox', { name: 'Роль' })).toHaveCount(0)
  await expect(page.getByLabel('Филиал администратора')).toHaveCount(0)
  const fullName = page.getByLabel('ФИО', { exact: true })
  await page.getByRole('button', { name: 'Сохранить тренера' }).press('Enter')
  await expect(fullName).toBeFocused()
  await expect(fullName).toBeInViewport({ ratio: 1 })
  await expect(fullName).toHaveCSS('outline-style', 'solid')
  await expect(fullName).toHaveAccessibleDescription('Введите ФИО тренера.')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
  await fullName.fill('Александра Константинова')
  await page.getByLabel('Логин', { exact: true }).fill('coach187')
  const password = page.getByLabel('Стартовый пароль', { exact: true })
  await page.getByRole('button', { name: 'Сохранить тренера' }).press('Enter')
  await expect(password).toBeFocused()
  await expect(password).toHaveAccessibleDescription('Введите стартовый пароль.')
  await password.fill('initial-password')
  await password.press('Tab')
  await expect(page.getByRole('button', { name: 'Показать пароль' })).toBeFocused()
  await page.keyboard.press('Space')
  await expect(password).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Скрыть пароль' }).press('Enter')
  await expect(password).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Сохранить тренера' }).click()
  await expect(page.getByText('Логин уже занят', { exact: true })).toBeVisible()
  const login = page.getByLabel('Логин', { exact: true })
  await expect(login).toBeFocused()
  await expect(login).toBeInViewport({ ratio: 1 })
  await expect(login).toHaveAccessibleDescription('Логин уже занят')
  await login.fill('coach187-new')
  await password.fill('new-initial-password')
  await page.getByRole('button', { name: 'Сохранить тренера' }).click()
  await expect(page).toHaveURL(/\/coaches$/)
  await page.reload()
  const search = page.getByRole('textbox', { name: 'Найти тренера' })
  await search.fill('coach187-new')
  await page.getByTestId('user-card-coach-187').click()
  await expect(page.getByLabel('Логин', { exact: true })).toHaveAttribute('readonly', '')
  await expect(page.getByRole('combobox', { name: 'Роль' })).toHaveCount(0)
  await fullName.fill('')
  await page.getByRole('button', { name: 'Сохранить изменения' }).press('Enter')
  await expect(fullName).toBeFocused()
  await expect(fullName).toHaveAccessibleDescription('Введите ФИО тренера.')
  await fullName.fill('Александра')
  await page.getByRole('button', { name: 'Сохранить изменения' }).press('Enter')
  await expect(fullName).toBeFocused()
  await expect(fullName).toBeInViewport({ ratio: 1 })
  await expect(fullName).toHaveAccessibleDescription('Введите полное ФИО')
  await fullName.fill('Александра Константинова Новая')
  await page.getByRole('switch', { name: 'Тренер активен' }).uncheck()
  await page.getByRole('button', { name: 'Сохранить изменения' }).click()
  await expect(search).toHaveValue('coach187-new')
  await expect(page.getByTestId('user-card-coach-187')).toBeFocused()
  const savedNotification = page.getByRole('alert').filter({ hasText: 'Карточка тренера обновлена.' })
  await expect(savedNotification).toBeVisible()
  await savedNotification.getByRole('button', { name: 'Закрыть уведомление' }).click()
  await expect(savedNotification).toBeHidden()
  await page.getByRole('button', { name: 'Открыть фильтры', exact: true }).click()
  await page.getByRole('combobox', { name: 'Статус' }).click()
  await page.getByRole('option', { name: 'Отключённые' }).click()
  await page.getByRole('button', { name: 'Готово', exact: true }).click()
  await expect(page.getByTestId('user-card-coach-187')).toContainText('Александра Константинова Новая')
  await expect(page.getByTestId('user-card-coach-187')).toContainText('Отключен')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  expect(createCalls).toBe(2)
  expect(updateCalls).toBe(2)

  session.user = {
    ...session.user!, role: 'Coach', allowedSections: ['Attendance', 'Schedule', 'Clients'],
    createRoleOptions: [], permissions: { ...session.user!.permissions, canManageUsers: false, canManageGroups: false, canManageSettings: false },
  }
  await page.goto('/coaches/new')
  await expect(page.getByRole('heading', { name: 'Нет доступа' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Сохранить тренера' })).toHaveCount(0)
}
