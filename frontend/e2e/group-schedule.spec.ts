import { expect, test, type Page } from '@playwright/test'

const APP_CONFIG = {
  clubName: 'Iron Club',
  themeId: 'default-green-v1',
  authBackgroundImageId: 'k4pro-login-v1',
} as const

const headCoachSession = {
  isAuthenticated: true,
  csrfToken: 'headcoach-schedule-csrf',
  bootstrapMode: false,
  user: {
    id: 'headcoach-id',
    fullName: 'Главный тренер',
    login: 'headcoach',
    role: 'HeadCoach',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Attention',
    allowedSections: ['Attendance', 'Attention', 'Schedule', 'Clients', 'Groups', 'Users', 'Audit', 'Settings'],
    permissions: {
      canManageUsers: true,
      canManageClients: true,
      canManageGroups: true,
      canManageSettings: true,
      canMarkAttendance: true,
      canViewAuditLog: true,
      canViewFinancialReports: true,
    },
    assignedGroupIds: [],
  },
} as const

const coachSession = {
  isAuthenticated: true,
  csrfToken: 'coach-schedule-csrf',
  bootstrapMode: false,
  user: {
    id: 'coach-id',
    fullName: 'Назначенный тренер',
    login: 'coach',
    role: 'Coach',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Attendance',
    allowedSections: ['Attendance', 'Schedule', 'Clients'],
    permissions: {
      canManageUsers: false,
      canManageClients: false,
      canManageGroups: false,
      canManageSettings: false,
      canMarkAttendance: true,
      canViewAuditLog: false,
      canViewFinancialReports: false,
    },
    assignedGroupIds: ['group-early'],
  },
} as const

const I_PHONE_SAFARI_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1'

const administratorSession = {
  isAuthenticated: true,
  csrfToken: 'administrator-schedule-csrf',
  bootstrapMode: false,
  user: {
    id: 'administrator-id',
    fullName: 'Администратор',
    login: 'administrator',
    role: 'Administrator',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Schedule',
    allowedSections: ['Attendance', 'Attention', 'Schedule', 'Clients', 'Groups'],
    permissions: {
      canManageUsers: false,
      canManageClients: true,
      canManageGroups: true,
      canManageSettings: false,
      canMarkAttendance: false,
      canViewAuditLog: false,
      canViewFinancialReports: false,
    },
    assignedGroupIds: [],
  },
} as const

const superAdministratorSession = {
  ...headCoachSession,
  user: {
    ...headCoachSession.user,
    id: 'superadmin-schedule-id',
    fullName: 'Суперадмин',
    login: 'superadmin-schedule',
    role: 'SuperAdministrator',
    permissions: {
      ...headCoachSession.user.permissions,
      canManageUsers: true,
      canViewAuditLog: true,
      canViewFinancialReports: true,
    },
    allowedSections: ['Attendance', 'Attention', 'Schedule', 'Clients', 'Groups', 'Users', 'Audit', 'Finance', 'Settings'],
    assignedGroupIds: ['group-ghost'],
    branchId: null,
  },
} as const

const coachConflictingAssignedIdsSession = {
  ...coachSession,
  user: {
    ...coachSession.user,
    id: 'coach-conflict-id',
    fullName: 'Тренер с конфликтными правами',
    assignedGroupIds: ['group-ghost', 'group-other'],
  },
}

const coachZeroScopeSession = {
  ...coachSession,
  user: {
    ...coachSession.user,
    id: 'coach-zero-scope-id',
    fullName: 'Тренер без активных групп',
    assignedGroupIds: ['group-ghost'],
  },
} as const

type MockApiContext = {
  method: string
  pathname: string
  route: Parameters<Page['route']>[1] extends (route: infer T) => unknown
    ? T
    : never
}

type RequestStats = {
  groupsCollectionGetCalls: number
  scheduleGroupsGetCalls: number
}

type GroupState = {
  id: string
  name: string
  branchId: string
  branchName: string
  hallId: string
  hallName: string
  groupTypeId: string
  groupTypeName: string
  trainingStartTime: string
  durationMinutes: number
  weekdays: number[]
  isActive: boolean
  trainerIds: string[]
  trainerNames: string[]
  clientCount: number
}

const branches = [
  {
    id: 'branch-1',
    name: 'Центр',
    address: 'ул. Тестовая, 1',
    description: 'Основной филиал',
    isArchived: false,
  },
  {
    id: 'branch-2',
    name: 'Север',
    address: 'пр-т Северный, 12',
    description: 'Филиал на севере',
    isArchived: false,
  },
] as const

const halls = [
  {
    id: 'hall-1',
    branchId: 'branch-1',
    branchName: 'Центр',
    name: 'Основной зал',
    description: 'Зал для групп',
    isArchived: false,
    groupCount: 3,
  },
  {
    id: 'hall-2',
    branchId: 'branch-2',
    branchName: 'Север',
    name: 'Loft',
    description: 'Северный зал',
    isArchived: false,
    groupCount: 1,
  },
] as const

const groupTypes = [
  {
    id: 'group-type-1',
    name: 'Кардио',
    description: 'Групповой формат',
    groupCount: 2,
  },
  {
    id: 'group-type-2',
    name: 'База',
    description: 'Базовый поток',
    groupCount: 1,
  },
  {
    id: 'group-type-3',
    name: 'Интенсив',
    description: 'Интенсивный формат',
    groupCount: 1,
  },
] as const

const groupType = groupTypes[0]

const trainers = [
  {
    id: 'trainer-1',
    fullName: 'Ирина Тренер',
    login: 'irina',
  },
  {
    id: 'trainer-2',
    fullName: 'Артем База',
    login: 'artem',
  },
  {
    id: 'trainer-3',
    fullName: 'Ольга Север',
    login: 'olga',
  },
] as const

const scheduleGroups: GroupState[] = [
  {
    id: 'group-late',
    name: 'Вечерняя группа',
    branchId: 'branch-1',
    branchName: 'Центр',
    hallId: 'hall-1',
    hallName: 'Основной зал',
    groupTypeId: groupTypes[0].id,
    groupTypeName: groupTypes[0].name,
    trainingStartTime: '19:00',
    durationMinutes: 60,
    weekdays: [1, 3],
    isActive: true,
    trainerIds: ['trainer-1'],
    trainerNames: ['Ирина Тренер'],
    clientCount: 9,
  },
  {
    id: 'group-early',
    name: 'Утренняя группа',
    branchId: 'branch-1',
    branchName: 'Центр',
    hallId: 'hall-1',
    hallName: 'Основной зал',
    groupTypeId: groupTypes[1].id,
    groupTypeName: groupTypes[1].name,
    trainingStartTime: '09:30',
    durationMinutes: 45,
    weekdays: [1, 4],
    isActive: true,
    trainerIds: ['trainer-2'],
    trainerNames: ['Артем База'],
    clientCount: 5,
  },
  {
    id: 'group-alpha',
    name: 'Альфа',
    branchId: 'branch-1',
    branchName: 'Центр',
    hallId: 'hall-1',
    hallName: 'Основной зал',
    groupTypeId: groupTypes[0].id,
    groupTypeName: groupTypes[0].name,
    trainingStartTime: '09:30',
    durationMinutes: 60,
    weekdays: [1],
    isActive: false,
    trainerIds: ['trainer-1', 'trainer-2'],
    trainerNames: ['Ирина Тренер', 'Артем База'],
    clientCount: 12,
  },
  {
    id: 'group-sunday',
    name: 'Воскресный интенсив',
    branchId: 'branch-2',
    branchName: 'Север',
    hallId: 'hall-2',
    hallName: 'Loft',
    groupTypeId: groupTypes[2].id,
    groupTypeName: groupTypes[2].name,
    trainingStartTime: '10:00',
    durationMinutes: 90,
    weekdays: [7],
    isActive: true,
    trainerIds: ['trainer-3'],
    trainerNames: ['Ольга Север'],
    clientCount: 3,
  },
]

const denseScheduleGroups: GroupState[] = [
  ...Array.from({ length: 6 }, (_, index) => ({
    id: `dense-${index + 1}`,
    name: [
      'База с очень длинным названием для проверки полного переноса',
      'Интенсивный поток продвинутой функциональной подготовки',
      'Кардио утром',
      'Силовой блок',
      'Функциональная подготовка',
      'Восстановление',
    ][index] ?? `Группа ${index + 1}`,
    branchId: 'branch-1',
    branchName: 'Центральный филиал с длинным названием',
    hallId: index === 4 ? 'hall-2' : 'hall-1',
    hallName: index === 4
      ? 'Зал Север с длинным названием'
      : 'Основной зал с длинным названием',
    groupTypeId: index % 2 === 0 ? groupTypes[0].id : groupTypes[2].id,
    groupTypeName: index % 2 === 0 ? groupTypes[0].name : groupTypes[2].name,
    trainingStartTime: '08:00',
    durationMinutes: 45,
    weekdays: [1],
    isActive: index !== 5,
    trainerIds: index === 2 ? [] : [trainers[index % trainers.length].id],
    trainerNames: index === 2
      ? []
      : [`${trainers[index % trainers.length].fullName} с полным длинным именем`],
    clientCount: 8 + index,
  })),
  {
    id: 'dense-following',
    name: 'Следующее отдельное занятие',
    branchId: 'branch-1',
    branchName: 'Центр',
    hallId: 'hall-1',
    hallName: 'Основной зал',
    groupTypeId: groupTypes[1].id,
    groupTypeName: groupTypes[1].name,
    trainingStartTime: '12:00',
    durationMinutes: 60,
    weekdays: [1],
    isActive: true,
    trainerIds: ['trainer-2'],
    trainerNames: ['Артем База'],
    clientCount: 7,
  },
]

const coachScopeProbeGroups: GroupState[] = [
  {
    id: 'group-conflict-visible',
    name: 'Согласованная группа',
    branchId: 'branch-1',
    branchName: 'Центр',
    hallId: 'hall-1',
    hallName: 'Основной зал',
    groupTypeId: groupTypes[0].id,
    groupTypeName: groupTypes[0].name,
    trainingStartTime: '08:15',
    durationMinutes: 45,
    weekdays: [1, 3],
    isActive: true,
    trainerIds: ['trainer-1'],
    trainerNames: ['Ирина Тренер'],
    clientCount: 4,
  },
  {
    id: 'group-filtered-empty',
    name: 'Группа для фильтра',
    branchId: 'branch-2',
    branchName: 'Север',
    hallId: 'hall-2',
    hallName: 'Loft',
    groupTypeId: groupTypes[2].id,
    groupTypeName: groupTypes[2].name,
    trainingStartTime: '19:30',
    durationMinutes: 70,
    weekdays: [2, 4],
    isActive: true,
    trainerIds: ['trainer-3'],
    trainerNames: ['Ольга Север'],
    clientCount: 2,
  },
]

const coachSingleDayResponse: GroupState[] = [
  {
    id: 'group-only-tuesday',
    name: 'Вторник только',
    branchId: 'branch-1',
    branchName: 'Центр',
    hallId: 'hall-1',
    hallName: 'Основной зал',
    groupTypeId: groupTypes[0].id,
    groupTypeName: groupTypes[0].name,
    trainingStartTime: '17:00',
    durationMinutes: 60,
    weekdays: [2],
    isActive: true,
    trainerIds: ['trainer-1'],
    trainerNames: ['Ирина Тренер'],
    clientCount: 5,
  },
]

test.describe('Расписание групповых занятий', () => {
  test('desktop shows weekly calendar grid, overlap disclosure, combined filters and reset', async ({
    page,
  }) => {
    const requestStats = createRequestStats()

    await installScheduleClock(page)
    await mockApi(page, headCoachSession, scheduleGroups, requestStats)
    await page.goto('/schedule')

    await expect(page.getByTestId('schedule-screen')).toBeVisible()
    await expect(page.getByTestId('schedule-calendar-grid')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Расписание' })).toHaveClass(
      /visually-hidden/,
    )
    await expect(page.getByText('Обновлено автоматически')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Обновить' })).toBeVisible()
    await expect(page.getByTestId('schedule-filter-panel')).toBeVisible()
    const filterActions = page
      .getByTestId('schedule-filter-panel')
      .locator('.compact-filter-panel__actions')
      .getByRole('button')
    await expect(filterActions).toHaveCount(2)
    await expect(filterActions.nth(0)).toHaveAccessibleName('Обновить')
    await expect(filterActions.nth(1)).toHaveAccessibleName('Сбросить')
    await expect(page.getByRole('button', { name: 'Расписание' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.getByRole('button', { name: 'Сегодня' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Предыдущ/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Следующ/i })).toHaveCount(0)
    await expect(page.getByText(/12\s*[—-]\s*18\s+мая/)).toHaveCount(0)

    for (const weekday of [1, 2, 3, 4, 5, 6, 7]) {
      await expect(page.getByTestId(`schedule-day-header-${weekday}`)).toBeVisible()
      await expect(page.getByTestId(`schedule-day-${weekday}`)).toBeVisible()
    }
    await expect(page.getByTestId('schedule-day-header-1')).toContainText('Пн')
    await expect(page.getByTestId('schedule-day-header-1')).toContainText('11.05')
    await expect(page.getByTestId('schedule-day-header-7')).toContainText('17.05')
    await expect(page.getByTestId('schedule-day-header-1')).toHaveAttribute(
      'data-current',
      'true',
    )
    await expect(page.getByTestId('schedule-day-1')).toHaveAttribute(
      'data-current',
      'true',
    )
    await expect(page.getByTestId('schedule-day-count-1')).toHaveText('3 занятия')
    await expect(page.getByTestId('schedule-day-count-7')).toHaveText('1 занятие')

    await expect(page.getByTestId('schedule-type-legend')).toContainText('Кардио')
    await expect(page.getByTestId('schedule-type-legend')).toContainText('База')
    await expect(page.getByTestId('schedule-type-legend')).toContainText('Интенсив')

    const mondayOverlapDisclosure = page.getByRole('button', {
      name: 'Пн 11.05, 09:30 - 10:30: 2 занятия в интервале. Открыть детали',
    })
    const mondayEveningCard = page.getByTestId('schedule-card-1-group-late')

    await expect(mondayOverlapDisclosure).toBeVisible()
    await expect(mondayOverlapDisclosure).toContainText('09:30 - 10:30 · 2 занятия')
    await expect(mondayOverlapDisclosure).toContainText('Альфа')
    await expect(mondayOverlapDisclosure).toContainText('Утренняя группа')
    await expect(page.getByTestId('schedule-card-1-group-alpha')).toHaveCount(0)
    await expect(page.getByTestId('schedule-card-1-group-early')).toHaveCount(0)
    await mondayOverlapDisclosure.click()
    const overlapDialog = page.getByRole('dialog', { name: 'Занятия в интервале' })
    await expect(overlapDialog).toContainText('09:30 - 10:30')
    await expect(overlapDialog).toContainText('Основной зал · Центр')
    await expect(overlapDialog).toContainText('Ирина Тренер, Артем База')
    await expect(overlapDialog).toContainText('12 участников')
    await expect(overlapDialog).toContainText('Неактивна')
    await page.getByRole('button', { name: 'Закрыть детали занятий' }).click()
    await expect(page.getByRole('button', { name: /Редактировать группу/i })).toHaveCount(0)
    await expect(mondayEveningCard).toContainText('19:00 - 20:00')

    await selectOption(page, 'Филиал', 'Север')
    await selectOption(page, 'Зал', 'Loft · Север')
    await selectOption(page, 'Тренер', 'Ольга Север')
    await selectOption(page, 'Группа', 'Воскресный интенсив')

    await expect(page.getByTestId('schedule-card-7-group-sunday')).toBeVisible()
    await expect(page.getByTestId('schedule-card-1-group-alpha')).toHaveCount(0)
    await expect(page.getByTestId('schedule-type-legend')).toContainText('Интенсив')

    await page.getByRole('button', { name: 'Сбросить' }).click()
    await expect(mondayOverlapDisclosure).toBeVisible()
    expect(requestStats.scheduleGroupsGetCalls).toBeGreaterThan(0)
    expect(requestStats.groupsCollectionGetCalls).toBe(0)
  })

  test('desktop dense block exposes exact full decision data in one keyboard action', async ({
    page,
  }) => {
    const requestStats = createRequestStats()

    await installScheduleClock(page)
    await page.setViewportSize({ width: 1440, height: 1200 })
    await mockApi(page, headCoachSession, denseScheduleGroups, requestStats)
    await page.goto('/schedule')

    const disclosure = page.getByRole('button', {
      name: 'Пн 11.05, 08:00 - 08:45: 6 занятий в интервале. Открыть детали',
    })
    const followingCard = page.getByTestId('schedule-card-1-dense-following')

    await expect(disclosure).toBeVisible()
    await expect(disclosure).toContainText('08:00 - 08:45 · 6 занятий')
    await expect(disclosure).toContainText(
      'База с очень длинным названием для проверки полного переноса',
    )
    await expect(disclosure).toContainText(
      'Интенсивный поток продвинутой функциональной подготовки',
    )
    await expect(disclosure).toContainText('+4')
    await expect(disclosure).not.toContainText('Основной зал')
    await expect(disclosure).not.toContainText('Тренер')
    await expect(page.locator('[data-testid^="schedule-card-1-dense-"]')).toHaveCount(1)
    await expect(followingCard).toBeVisible()

    const triggerBox = await disclosure.boundingBox()
    const followingBox = await followingCard.boundingBox()

    expect(triggerBox).not.toBeNull()
    expect(followingBox).not.toBeNull()
    expect(triggerBox!.y + triggerBox!.height).toBeLessThanOrEqual(followingBox!.y)

    await disclosure.focus()
    await page.keyboard.press('Enter')

    const dialog = page.getByRole('dialog', { name: 'Занятия в интервале' })
    const close = page.getByRole('button', { name: 'Закрыть детали занятий' })
    const detailRows = dialog.getByRole('listitem')

    await expect(dialog).toBeVisible()
    await expect(close).toBeFocused()
    await expect(detailRows).toHaveCount(6)
    await expect(dialog).toContainText('Основной зал с длинным названием · Центральный филиал с длинным названием')
    await expect(dialog).toContainText('Тренер не назначен')
    await expect(dialog).toContainText('13 участников')
    await expect(dialog).toContainText('Неактивна')
    await expect(detailRows.first()).toHaveAccessibleName(
      /08:00 - 08:45, База с очень длинным названием.*Кардио.*Основной зал.*Ирина Тренер.*8 участников/,
    )

    const geometry = await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const list = element.querySelector<HTMLElement>('.schedule-events-popover__list')

      return {
        bodyScrollWidth: document.body.scrollWidth,
        dialogBottom: rect.bottom,
        dialogLeft: rect.left,
        dialogRight: rect.right,
        dialogWidth: rect.width,
        documentScrollWidth: document.documentElement.scrollWidth,
        listOverflowX: list ? getComputedStyle(list).overflowX : '',
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      }
    })

    expect(geometry.dialogWidth).toBeLessThanOrEqual(420)
    expect(geometry.dialogLeft).toBeGreaterThanOrEqual(16)
    expect(geometry.dialogRight).toBeLessThanOrEqual(geometry.viewportWidth - 16)
    expect(geometry.dialogBottom).toBeLessThanOrEqual(geometry.viewportHeight - 16)
    expect(geometry.listOverflowX).toBe('hidden')
    expect(geometry.documentScrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1)
    expect(geometry.bodyScrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1)

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(disclosure).toBeFocused()

    await page.keyboard.press('Space')
    await expect(dialog).toBeVisible()
    await expect(close).toBeFocused()
    await close.click()
    await expect(dialog).toBeHidden()
    await expect(disclosure).toBeFocused()

    const focusStyle = await disclosure.evaluate((element) => {
      element.focus()
      const style = getComputedStyle(element)

      return {
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
      }
    })

    expect(focusStyle.outlineStyle).not.toBe('none')
    expect(focusStyle.outlineWidth).toBeGreaterThanOrEqual(2)

    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(page.getByTestId('schedule-calendar-grid')).toBeVisible()
    await expect(disclosure).toBeVisible()
    await expect(page.getByTestId('schedule-mobile-day-list')).toHaveCount(0)

    const tabletGeometry = await page.evaluate(() => ({
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }))

    expect(tabletGeometry.documentScrollWidth)
      .toBeLessThanOrEqual(tabletGeometry.viewportWidth + 1)
    expect(tabletGeometry.bodyScrollWidth)
      .toBeLessThanOrEqual(tabletGeometry.viewportWidth + 1)
    expect(requestStats.scheduleGroupsGetCalls).toBeGreaterThan(0)
  })

  test('coach uses /api/schedule/groups and renders backend response read-only', async ({
    page,
  }) => {
    const requestStats = createRequestStats()

    await installScheduleClock(page)
    await mockApi(page, coachSession, scheduleGroups, requestStats)
    await page.goto('/schedule')

    await expect(page.getByTestId('schedule-screen')).toBeVisible()
    await expect(page.getByTestId('schedule-calendar-grid')).toBeVisible()
    await expect(page.getByRole('button', {
      name: 'Пн 11.05, 09:30 - 10:30: 2 занятия в интервале. Открыть детали',
    })).toBeVisible()
    await expect(page.getByTestId('schedule-card-1-group-alpha')).toHaveCount(0)
    await expect(page.getByTestId('schedule-card-7-group-sunday')).toBeVisible()
    await expect(page.getByTestId('schedule-day-header-1')).toHaveAttribute(
      'data-current',
      'true',
    )
    await expect(page.getByRole('button', { name: 'Сегодня' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Редактировать группу/i })).toHaveCount(0)

    expect(requestStats.scheduleGroupsGetCalls).toBeGreaterThan(0)
    expect(requestStats.groupsCollectionGetCalls).toBe(0)
  })

  test('administrator sees the same read-only schedule mockup', async ({ page }) => {
    const requestStats = createRequestStats()

    await installScheduleClock(page)
    await mockApi(page, administratorSession, scheduleGroups, requestStats)
    await page.goto('/schedule')

    await expect(page.getByTestId('schedule-screen')).toBeVisible()
    await expect(page.getByTestId('schedule-calendar-grid')).toBeVisible()
    await expect(page.getByRole('button', {
      name: 'Пн 11.05, 09:30 - 10:30: 2 занятия в интервале. Открыть детали',
    })).toBeVisible()
    await expect(page.getByTestId('schedule-card-1-group-alpha')).toHaveCount(0)
    await expect(page.getByTestId('schedule-type-legend')).toBeVisible()
    await expect(page.getByRole('button', { name: /Редактировать группу/i })).toHaveCount(0)

    expect(requestStats.scheduleGroupsGetCalls).toBeGreaterThan(0)
    expect(requestStats.groupsCollectionGetCalls).toBe(0)
  })

  test('SuperAdministrator remains global and does not receive Coach empty copy', async ({ page }) => {
    const requestStats = createRequestStats()

    await installScheduleClock(page)
    await mockApi(page, superAdministratorSession, scheduleGroups, requestStats)
    await page.goto('/schedule')

    await expect(page.getByTestId('schedule-screen')).toBeVisible()
    await expect(page.getByRole('button', {
      name: 'Пн 11.05, 09:30 - 10:30: 2 занятия в интервале. Открыть детали',
    })).toBeVisible()
    await expect(page.getByTestId('schedule-card-1-group-alpha')).toHaveCount(0)
    await expect(page.getByTestId('schedule-card-7-group-sunday')).toBeVisible()
    await expect(page.getByTestId('schedule-type-legend')).toContainText('Интенсив')
    await expect(page.getByText('Для вас занятий в расписании нет')).toHaveCount(0)

    expect(requestStats.scheduleGroupsGetCalls).toBeGreaterThan(0)
    expect(requestStats.groupsCollectionGetCalls).toBe(0)
  })

  test('mobile shows selected-day time grid with date strip', async ({ page }) => {
    const requestStats = createRequestStats()

    await installScheduleClock(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await mockApi(page, headCoachSession, scheduleGroups, requestStats)
    await page.goto('/schedule')

    await expect(page.getByTestId('schedule-filter-panel').getByLabel('Филиал')).toHaveCount(0)
    await page.getByTestId('schedule-filter-panel').getByRole('button', { name: 'Фильтры' }).click()
    await expect(page.getByRole('combobox', { name: 'Филиал' })).toBeVisible()
    await selectOption(page, 'Филиал', 'Север')
    await expect(page.getByRole('button', { name: 'Сбросить' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Готово' })).toBeVisible()
    await page.getByRole('button', { name: 'Сбросить' }).click()
    await page.getByRole('button', { name: 'Готово' }).click()
    await expect(page.getByRole('combobox', { name: 'Филиал' })).toHaveCount(0)

    await expect(page.getByTestId('schedule-mobile-day-list')).toBeVisible()
    await expect(page.getByTestId('schedule-mobile-day-strip')).toBeVisible()
    await expect(page.getByTestId('schedule-calendar-grid')).toHaveCount(0)
    await expect(page.getByTestId('schedule-mobile-day-tab-1')).toContainText('11.05')
    await expect(page.getByTestId('schedule-mobile-day-tab-1')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.getByTestId('schedule-mobile-day-1')).toContainText('Альфа')
    await expect(page.getByTestId('schedule-mobile-day-1')).toContainText('Утренняя группа')

    await page.getByTestId('schedule-mobile-day-tab-7').click()
    await expect(page.getByTestId('schedule-mobile-day-7')).toContainText(
      'Воскресный интенсив',
    )
    await expect(page.getByTestId('schedule-mobile-day-tab-7')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.getByTestId('schedule-day-count-7')).toHaveText('1 занятие')

    const dimensions = await page.evaluate(() => ({
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }))

    expect(dimensions.documentScrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
    expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)

    expect(requestStats.scheduleGroupsGetCalls).toBeGreaterThan(0)
  })

  test('responsive 720 CSS px equivalent keeps the mobile timeline without desktop disclosure', async ({
    page,
  }) => {
    const requestStats = createRequestStats()

    await installScheduleClock(page)
    await page.setViewportSize({ width: 720, height: 600 })
    await mockApi(page, headCoachSession, denseScheduleGroups, requestStats)
    await page.goto('/schedule')

    await expect(page.getByTestId('schedule-mobile-day-list')).toBeVisible()
    await expect(page.getByTestId('schedule-mobile-day-strip')).toBeVisible()
    await expect(page.getByTestId('schedule-calendar-grid')).toHaveCount(0)
    await expect(page.locator('.schedule-events-disclosure')).toHaveCount(0)
    await expect(page.getByTestId('schedule-mobile-day-1')).toContainText(
      'База с очень длинным названием для проверки полного переноса',
    )

    const dimensions = await page.evaluate(() => ({
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }))

    expect(dimensions.documentScrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
    expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
  })

  test('coach показывает только группы из API без клиентской фильтрации по assignedGroupIds', async ({ page }) => {
    const requestStats = createRequestStats()

    await installScheduleClock(page)
    await mockApi(page, coachConflictingAssignedIdsSession, coachScopeProbeGroups, requestStats)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/schedule')

    await expect(page.getByTestId('schedule-screen')).toBeVisible()
    await expect(page.getByTestId('schedule-card-1-group-conflict-visible')).toBeVisible()
    await expect(page.getByText('Согласованная группа')).toBeVisible()
    await page.getByTestId('schedule-mobile-day-tab-2').click()
    await expect(page.getByTestId('schedule-card-2-group-filtered-empty')).toBeVisible()
    await expect(page.getByText('Группа для фильтра')).toBeVisible()
    await expect(page.getByTestId(`schedule-type-token-${groupTypes[0].id}`)).toContainText('2')
    const filterLauncher = page
      .getByTestId('schedule-filter-panel')
      .getByRole('button', { name: 'Фильтры' })
    await expect(filterLauncher).toBeInViewport()
    await filterLauncher.click()
    await page.getByRole('combobox', { name: 'Группа' }).click()
    await expect(page.getByRole('option', { name: 'Согласованная группа' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Группа для фильтра' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Неизвестная группа' })).toHaveCount(0)

    expect(requestStats.scheduleGroupsGetCalls).toBeGreaterThan(0)
  })

  test('coach zero-scope получает отдельное empty-состояние и оставляет кнопку обновить доступной', async ({ page }) => {
    const requestStats = createRequestStats()

    await installScheduleClock(page)
    await mockApi(page, coachZeroScopeSession, [], requestStats)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/schedule')

    await expect(page.getByTestId('schedule-screen')).toBeVisible()
    await expect(
      page.getByText('Для вас занятий в расписании нет'),
    ).toBeVisible()
    await expect(
      page.getByText(
        'Когда вас назначат на группу или временную замену, занятия появятся здесь.',
      ),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Обновить' })).toHaveCount(1)
    const refreshButton = page.getByRole('button', { name: 'Обновить' })
    const refreshBox = await refreshButton.boundingBox()
    expect(refreshBox).not.toBeNull()
    expect(refreshBox!.width).toBeGreaterThanOrEqual(44)
    expect(refreshBox!.height).toBeGreaterThanOrEqual(44)
    await expect(page.getByRole('button', { name: 'Фильтры' })).toBeHidden()

    expect(requestStats.scheduleGroupsGetCalls).toBeGreaterThan(0)
  })

  test('coach day-empty copy: без фильтра и с фильтром должны отличаться', async ({ page }) => {
    const requestStats = createRequestStats()

    await installScheduleClock(page)
    await mockApi(page, coachSession, coachSingleDayResponse, requestStats)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/schedule')

    await expect(page.getByTestId('schedule-screen')).toBeVisible()
    const mondayTab = page.getByTestId('schedule-mobile-day-tab-1')
    await mondayTab.click()
    await expect(page.getByText('В этот день у вас занятий нет')).toBeVisible()

    await page.getByRole('button', { name: 'Фильтры' }).click()
    await page.getByRole('combobox', { name: 'Группа' }).click()
    await page.getByRole('option', { name: 'Вторник только' }).click()
    await page.getByRole('button', { name: 'Готово' }).click()
    await expect(
      page.getByText('День свободен для выбранных фильтров.'),
    ).toBeVisible()
  })

  test('на mobile стрелки в панели дней переключают выбор и возвращают фокус', async ({ page }) => {
    const requestStats = createRequestStats()

    await installScheduleClock(page)
    await mockApi(page, coachSession, coachScopeProbeGroups, requestStats)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/schedule')

    const mondayTab = page.getByTestId('schedule-mobile-day-tab-1')
    const tuesdayTab = page.getByTestId('schedule-mobile-day-tab-2')
    await mondayTab.click()
    await mondayTab.focus()
    await expect(mondayTab).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowRight')
    await expect(tuesdayTab).toHaveAttribute('aria-selected', 'true')
    await expect(tuesdayTab).toBeFocused()
    await page.keyboard.press('ArrowLeft')
    await expect(mondayTab).toHaveAttribute('aria-selected', 'true')
    await expect(mondayTab).toBeFocused()
  })

  test('schedule has no unintended horizontal overflow across mobile target matrix', async ({ page }) => {
    const requestStats = createRequestStats()
    const targetViewports = [
      { width: 360, height: 780 },
      { width: 390, height: 844 },
      { width: 420, height: 912 },
      { width: 440, height: 956 },
      { width: 912, height: 420 },
      { width: 956, height: 440 },
      { width: 768, height: 1024 },
      { width: 1440, height: 1200 },
    ]

    await page.addInitScript((userAgent) => {
      Object.defineProperty(window.navigator, 'userAgent', {
        configurable: true,
        get: () => userAgent,
      })
    }, I_PHONE_SAFARI_USER_AGENT)
    await installScheduleClock(page)
    await mockApi(page, coachConflictingAssignedIdsSession, coachScopeProbeGroups, requestStats)

    for (const viewport of targetViewports) {
      await page.setViewportSize(viewport)
      await page.goto('/schedule')
      await expect(page.getByTestId('schedule-screen')).toBeVisible()

      const dimensions = await page.evaluate(() => ({
        bodyScrollWidth: document.body.scrollWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      }))

      expect(dimensions.documentScrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
      expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
    }

    expect(requestStats.scheduleGroupsGetCalls).toBeGreaterThanOrEqual(targetViewports.length)
  })

  test('group form sends TASK-034 schedule fields and shows backend field errors', async ({
    page,
  }) => {
    let createGroupPayload: Record<string, unknown> | null = null

    await mockApi(page, headCoachSession, scheduleGroups, createRequestStats(), async ({
      pathname,
      method,
      route,
    }) => {
      if (pathname === '/api/groups' && method === 'POST') {
        const payload = route.request().postDataJSON()
        createGroupPayload = payload

        await fulfillJson(route, 400, {
          title: 'Validation failed',
          detail: 'Проверьте расписание группы.',
          errors: {
            DurationMinutes: ['Укажите длительность занятия.'],
            Weekdays: ['Выберите хотя бы один день недели.'],
          },
        })
        return true
      }

      return false
    })

    await page.goto('/groups/new')
    await page.getByLabel('Название группы').fill('Группа с ошибкой расписания')
    await page.getByLabel('Время начала').fill('18:00')
    await page.getByRole('combobox', { name: 'Зал' }).click()
    await page.getByRole('option', { name: 'Основной зал' }).click()
    await page.getByRole('button', { name: 'Создать группу' }).click()

    await expect.poll(() => createGroupPayload).toEqual({
      name: 'Группа с ошибкой расписания',
      branchId: 'branch-1',
      hallId: 'hall-1',
      groupTypeId: groupType.id,
      trainingStartTime: '18:00',
      durationMinutes: null,
      weekdays: [],
      isActive: true,
      trainerIds: [],
    })
    expect(createGroupPayload).not.toHaveProperty('scheduleText')
    await expect(page.getByText('Укажите длительность занятия.')).toBeVisible()
    await expect(page.getByText('Выберите хотя бы один день недели.')).toBeVisible()
  })
})

async function mockApi(
  page: Page,
  session:
    | typeof headCoachSession
    | typeof coachSession
    | typeof administratorSession
    | typeof superAdministratorSession
    | typeof coachConflictingAssignedIdsSession
    | typeof coachZeroScopeSession,
  groups: GroupState[],
  requestStats: RequestStats,
  override?: (context: MockApiContext) => Promise<boolean>,
) {
  await page.route('**/api/**', async (route) => {
    const requestUrl = new URL(route.request().url())

    if (!requestUrl.pathname.startsWith('/api/')) {
      await route.continue()
      return
    }

    const context = {
      method: route.request().method(),
      pathname: requestUrl.pathname,
      route,
    } satisfies MockApiContext

    if (override && await override(context)) {
      return
    }

    if (context.pathname === '/api/auth/session' && context.method === 'GET') {
      await fulfillJson(route, 200, session)
      return
    }

    if (context.pathname === '/api/config' && context.method === 'GET') {
      await fulfillJson(route, 200, APP_CONFIG)
      return
    }

    if (context.pathname === '/api/schedule/groups' && context.method === 'GET') {
      requestStats.scheduleGroupsGetCalls += 1
      await fulfillJson(route, 200, buildGroupsListPayload(groups))
      return
    }

    if (context.pathname === '/api/groups' && context.method === 'GET') {
      requestStats.groupsCollectionGetCalls += 1
      await fulfillJson(route, 200, buildGroupsListPayload(groups))
      return
    }

    if (context.pathname === '/api/groups/summary' && context.method === 'GET') {
      await fulfillJson(route, 200, {
        totalCount: groups.length,
        activeWithoutTrainerCount: groups.filter(
          (group) => group.isActive && group.trainerIds.length === 0,
        ).length,
      })
      return
    }

    if (context.pathname === '/api/groups/options/trainers' && context.method === 'GET') {
      await fulfillJson(route, 200, trainers)
      return
    }

    if (context.pathname === '/api/branches' && context.method === 'GET') {
      await fulfillJson(route, 200, branches.map(toBranchPayload))
      return
    }

    if (context.pathname === '/api/halls' && context.method === 'GET') {
      await fulfillJson(route, 200, halls.map(toHallPayload))
      return
    }

    if (context.pathname === '/api/group-types' && context.method === 'GET') {
      await fulfillJson(route, 200, groupTypes.map(toGroupTypePayload))
      return
    }

    if (
      context.pathname.startsWith('/api/groups/') &&
      context.pathname.endsWith('/clients') &&
      context.method === 'GET'
    ) {
      await fulfillJson(route, 200, { clients: [] })
      return
    }

    if (context.pathname.startsWith('/api/groups/') && context.method === 'GET') {
      const groupId = context.pathname.slice('/api/groups/'.length)
      const group = groups.find((item) => item.id === groupId)

      if (!group) {
        await fulfillJson(route, 404, { detail: 'Группа не найдена.' })
        return
      }

      await fulfillJson(route, 200, toGroupPayload(group))
      return
    }

    throw new Error(
      `Unexpected API request in group schedule e2e: ${context.method} ${context.pathname}`,
    )
  })
}

function createRequestStats(): RequestStats {
  return {
    groupsCollectionGetCalls: 0,
    scheduleGroupsGetCalls: 0,
  }
}

async function installScheduleClock(page: Page) {
  await page.clock.install({
    time: new Date('2026-05-11T10:30:00'),
  })
}

function buildGroupsListPayload(groups: GroupState[]) {
  return {
    items: groups.map(toGroupPayload),
    totalCount: groups.length,
    skip: 0,
    take: 100,
  }
}

function toGroupPayload(group: GroupState) {
  return {
    id: group.id,
    name: group.name,
    branchId: group.branchId,
    branchName: group.branchName,
    hallId: group.hallId,
    hallName: group.hallName,
    groupTypeId: group.groupTypeId,
    groupTypeName: group.groupTypeName,
    trainingStartTime: group.trainingStartTime,
    durationMinutes: group.durationMinutes,
    weekdays: group.weekdays,
    isActive: group.isActive,
    trainers: group.trainerIds.map((trainerId) => {
      const trainer = trainers.find((item) => item.id === trainerId)

      return {
        id: trainerId,
        fullName: trainer?.fullName ?? trainerId,
        login: trainer?.login ?? trainerId,
      }
    }),
    trainerIds: group.trainerIds,
    trainerCount: group.trainerIds.length,
    trainerNames: group.trainerNames,
    clientCount: group.clientCount,
    updatedAt: '2026-05-13T09:00:00Z',
    createdAt: '2026-05-13T09:00:00Z',
  }
}

function toBranchPayload(branch: typeof branches[number]) {
  return {
    ...branch,
    hallCount: halls.filter((hall) => hall.branchId === branch.id).length,
    groupCount: scheduleGroups.filter((group) => group.branchId === branch.id).length,
    clientCount: 0,
    createdAt: '2026-05-13T09:00:00Z',
    updatedAt: '2026-05-13T09:00:00Z',
  }
}

function toHallPayload(hall: typeof halls[number]) {
  return {
    ...hall,
    createdAt: '2026-05-13T09:00:00Z',
    updatedAt: '2026-05-13T09:00:00Z',
  }
}

function toGroupTypePayload(item: typeof groupTypes[number]) {
  return {
    ...item,
    createdAt: '2026-05-13T09:00:00Z',
    updatedAt: '2026-05-13T09:00:00Z',
  }
}

async function selectOption(page: Page, label: string, optionName: string) {
  await page.getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name: optionName }).click()
}

async function fulfillJson(
  route: MockApiContext['route'],
  status: number,
  payload: unknown,
) {
  await route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(payload),
  })
}
