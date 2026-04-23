import { expect, test, type Page } from '@playwright/test'

const BOOTSTRAP_LOGIN = 'headcoach'

const headCoachSession = {
  isAuthenticated: true,
  csrfToken: 'headcoach-csrf-token',
  bootstrapMode: false,
  user: {
    id: 'headcoach-id',
    fullName: 'Главный тренер',
    login: BOOTSTRAP_LOGIN,
    role: 'HeadCoach',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Home',
    allowedSections: ['Home', 'Attendance', 'Clients', 'Groups', 'Users', 'Audit'],
    permissions: {
      canManageUsers: true,
      canManageClients: true,
      canManageGroups: true,
      canMarkAttendance: true,
      canViewAuditLog: true,
    },
    assignedGroupIds: ['group-1'],
  },
}

const administratorSession = {
  isAuthenticated: true,
  csrfToken: 'administrator-csrf-token',
  bootstrapMode: false,
  user: {
    id: 'administrator-id',
    fullName: 'Администратор',
    login: 'administrator',
    role: 'Administrator',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Home',
    allowedSections: ['Home', 'Attendance', 'Clients', 'Groups', 'Users', 'Audit'],
    permissions: {
      canManageUsers: true,
      canManageClients: true,
      canManageGroups: true,
      canMarkAttendance: true,
      canViewAuditLog: true,
    },
    assignedGroupIds: ['group-1'],
  },
}

const coachSession = {
  isAuthenticated: true,
  csrfToken: 'coach-csrf-token',
  bootstrapMode: false,
  user: {
    id: 'coach-id',
    fullName: 'Назначенный тренер',
    login: 'coach',
    role: 'Coach',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Attendance',
    allowedSections: ['Attendance', 'Clients'],
    permissions: {
      canManageUsers: false,
      canManageClients: false,
      canManageGroups: false,
      canMarkAttendance: true,
      canViewAuditLog: false,
    },
    assignedGroupIds: ['group-coach'],
  },
}

type MockApiContext = {
  method: string
  pathname: string
  route: Parameters<Page['route']>[1] extends (route: infer T) => unknown
    ? T
    : never
  searchParams: URLSearchParams
}

type TrainerOption = {
  id: string
  fullName: string
  login: string
}

type GroupState = {
  id: string
  name: string
  trainingStartTime: string
  scheduleText: string
  isActive: boolean
  trainerIds: string[]
  trainerNames: string[]
  clientCount: number
}

type ClientState = {
  id: string
  lastName: string
  firstName: string
  middleName: string
  phone: string
  groupIds: string[]
  contacts: Array<{
    type: string
    fullName: string
    phone: string
  }>
  hasActivePaidMembership: boolean
  hasUnpaidCurrentMembership: boolean
  membershipWarning: boolean
  membershipType?: 'SingleVisit' | 'Monthly' | 'Yearly'
  expirationDate: string
}

const trainers: TrainerOption[] = [
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
]

const assignedAttendanceGroup = {
  id: 'group-coach',
  name: 'Назначенная группа',
  trainingStartTime: '19:00',
  scheduleText: 'Вт, Чт',
  isActive: true,
  trainerIds: ['coach-id'],
  trainerNames: ['Назначенный тренер'],
  clientCount: 1,
}

const baseGroups: GroupState[] = [
  {
    id: 'group-1',
    name: 'Группа 1',
    trainingStartTime: '18:00',
    scheduleText: 'Пн, Ср, Пт',
    isActive: true,
    trainerIds: ['trainer-1'],
    trainerNames: ['Ирина Тренер'],
    clientCount: 1,
  },
]

const baseClient: ClientState = {
  id: 'client-1',
  lastName: 'Иванов',
  firstName: 'Иван',
  middleName: 'Иванович',
  phone: '+79990001111',
  groupIds: ['group-1'],
  contacts: [],
  hasActivePaidMembership: true,
  hasUnpaidCurrentMembership: false,
  membershipWarning: false,
  membershipType: 'Monthly',
  expirationDate: addIsoDays(todayIso(), 20),
}

const SCREEN_HEADINGS = [
  {
    path: '/',
    heading: 'Истекающие абонементы',
  },
  {
    path: '/attendance',
    heading: 'Быстрая отметка посещений',
  },
  {
    path: '/clients',
    heading: 'Клиентская база со встроенным поиском и фильтрацией',
  },
  {
    path: '/groups',
    heading: 'Группы и назначение тренеров',
  },
  {
    path: '/audit',
    heading: 'Журнал действий показывает важные изменения в клубе',
  },
]

test.describe('Основные e2e сценарии', () => {
  test('Создание клиента: отправляет корректный payload и открывает карточку клиента', async ({
    page,
  }) => {
    const createdClientId = 'client-new-1'
    let createClientPayload: Record<string, unknown> | null = null
    let clientListCalls = 0

    const groups: GroupState[] = [...baseGroups]
    const clients: ClientState[] = [baseClient]

    await mockApi(page, async ({ pathname, method, route, searchParams }) => {
      if (pathname === '/api/auth/session' && method === 'GET') {
        await fulfillJson(route, 200, headCoachSession)
        return true
      }

      if (pathname === '/api/auth/login' && method === 'POST') {
        await fulfillJson(route, 200, headCoachSession)
        return true
      }

      if (pathname === '/api/groups' && method === 'GET') {
        await fulfillJson(route, 200, buildGroupsListPayload(groups))
        return true
      }

      if (pathname === '/api/clients' && method === 'GET') {
        clientListCalls += 1
        await fulfillJson(route, 200, buildClientsListPayload(clients, groups, searchParams))
        return true
      }

      if (pathname.startsWith('/api/clients/') && method === 'GET') {
        const clientId = pathname.slice('/api/clients/'.length)
        const client = clients.find((item) => item.id === clientId)

        if (!client) {
          await fulfillJson(route, 404, { message: 'Клиент не найден' })
          return true
        }

        await fulfillJson(route, 200, toClientPayload(client, groups))
        return true
      }

      if (pathname === '/api/clients' && method === 'POST') {
        const payload = route.request().postDataJSON()
        createClientPayload = payload

        expect(route.request().headers()['x-csrf-token']).toBe(
          headCoachSession.csrfToken,
        )
        expect(payload).toEqual({
          lastName: 'Петров',
          firstName: 'Пётр',
          middleName: 'Петрович',
          phone: '+79990005555',
          groupIds: ['group-1'],
          contacts: [
            {
              type: 'Мама',
              fullName: 'Анна Петрова',
              phone: '+79990005501',
            },
            {
              type: 'Папа',
              fullName: 'Олег Петров',
              phone: '+79990005502',
            },
          ],
        })

        const nextClient: ClientState = {
          ...baseClient,
          id: createdClientId,
          lastName: 'Петров',
          firstName: 'Пётр',
          middleName: 'Петрович',
          phone: '+79990005555',
          groupIds: ['group-1'],
          contacts: [
            {
              type: 'Мама',
              fullName: 'Анна Петрова',
              phone: '+79990005501',
            },
            {
              type: 'Папа',
              fullName: 'Олег Петров',
              phone: '+79990005502',
            },
          ],
          hasActivePaidMembership: false,
          hasUnpaidCurrentMembership: false,
          membershipWarning: false,
          membershipType: undefined,
          expirationDate: '',
        }

        clients.push(nextClient)
        await fulfillJson(route, 200, toClientPayload(nextClient, groups))
        return true
      }

      return false
    })

    await page.goto('/clients')
    await page.getByRole('button', { name: 'Создать клиента' }).click()

    await page.getByLabel('Фамилия').fill('Петров')
    await page.getByLabel('Имя').fill('Пётр')
    await page.getByLabel('Отчество').fill('Петрович')
    await page.getByLabel('Телефон').fill('+79990005555')

    await page.getByRole('combobox', { name: 'Группы клиента' }).click()
    await page.getByRole('option', { name: 'Группа 1' }).click()

    await page.getByRole('button', { name: 'Добавить контакт' }).click()
    await page.getByRole('button', { name: 'Добавить контакт' }).click()
    await page.getByLabel('Тип контакта').nth(0).fill('Мама')
    await page.getByLabel('ФИО контактного лица').nth(0).fill('Анна Петрова')
    await page.getByLabel('Телефон контакта').nth(0).fill('+79990005501')
    await page.getByLabel('Тип контакта').nth(1).fill('Папа')
    await page.getByLabel('ФИО контактного лица').nth(1).fill('Олег Петров')
    await page.getByLabel('Телефон контакта').nth(1).fill('+79990005502')

    await page.getByRole('button', { name: 'Сохранить клиента' }).click()

    await expect
      .poll(() => createClientPayload)
      .toEqual({
        lastName: 'Петров',
        firstName: 'Пётр',
        middleName: 'Петрович',
        phone: '+79990005555',
        groupIds: ['group-1'],
        contacts: [
          {
            type: 'Мама',
            fullName: 'Анна Петрова',
            phone: '+79990005501',
          },
          {
            type: 'Папа',
            fullName: 'Олег Петров',
            phone: '+79990005502',
          },
        ],
      })

    await expect(page).toHaveURL(`/clients/${createdClientId}`)
    await expect(
      page.getByRole('heading', { name: 'Петров Пётр Петрович' }),
    ).toBeVisible()
    await expect(page.getByText('Анна Петрова')).toBeVisible()
    await expect(page.getByText('Олег Петров')).toBeVisible()
    await expect(page.getByText('Текущий абонемент не задан')).toBeVisible()

    await page.getByRole('button', { name: 'К списку клиентов' }).click()
    await expect(page).toHaveURL('/clients')
    await expect(
      page.getByRole('heading', { name: 'Клиентская база со встроенным поиском и фильтрацией' }),
    ).toBeVisible()
    await expect(page.getByText('Петров Пётр Петрович')).toBeVisible()
    expect(clientListCalls).toBeGreaterThan(1)
  })

  test('Создание группы с назначением тренеров', async ({ page }) => {
    let createGroupPayload: Record<string, unknown> | null = null
    const groups: GroupState[] = [...baseGroups]
    const createdGroupId = 'group-new-1'

    await mockApi(page, async ({ pathname, method, route }) => {
      if (pathname === '/api/auth/session' && method === 'GET') {
        await fulfillJson(route, 200, headCoachSession)
        return true
      }

      if (pathname === '/api/auth/login' && method === 'POST') {
        await fulfillJson(route, 200, headCoachSession)
        return true
      }

      if (pathname === '/api/groups/options/trainers' && method === 'GET') {
        await fulfillJson(route, 200, trainers)
        return true
      }

      if (pathname === '/api/groups' && method === 'GET') {
        await fulfillJson(route, 200, buildGroupsListPayload(groups))
        return true
      }

      if (pathname === '/api/groups' && method === 'POST') {
        const payload = route.request().postDataJSON()
        createGroupPayload = payload

        expect(route.request().headers()['x-csrf-token']).toBe(
          headCoachSession.csrfToken,
        )
        expect(payload).toEqual({
          name: 'Новая тестовая группа',
          trainingStartTime: '19:00',
          scheduleText: 'Вт, Чт',
          isActive: true,
          trainerIds: ['trainer-1', 'trainer-2'],
        })

        const createdGroup: GroupState = {
          id: createdGroupId,
          name: 'Новая тестовая группа',
          trainingStartTime: '19:00',
          scheduleText: 'Вт, Чт',
          isActive: true,
          trainerIds: ['trainer-1', 'trainer-2'],
          trainerNames: ['Ирина Тренер', 'Артем База'],
          clientCount: 0,
        }

        groups.push(createdGroup)
        await fulfillJson(route, 200, toGroupPayload(createdGroup))
        return true
      }

      return false
    })

    await page.goto('/groups')
    await page.getByRole('button', { name: 'Создать группу' }).click()

    await page.getByLabel('Название группы').fill('Новая тестовая группа')
    await page.getByLabel('Время начала').fill('19:00')
    await page.getByLabel('Расписание').fill('Вт, Чт')

    const trainerSelect = page.getByRole('combobox', { name: 'Тренеры группы' })
    await trainerSelect.click()
    await page.getByRole('option', { name: /Ирина Тренер/ }).click()
    await trainerSelect.click()
    await page.getByRole('option', { name: /Артем База/ }).click()

    await page.getByRole('button', { name: 'Создать группу' }).click()

    await expect
      .poll(() => createGroupPayload)
      .toEqual({
        name: 'Новая тестовая группа',
        trainingStartTime: '19:00',
        scheduleText: 'Вт, Чт',
        isActive: true,
        trainerIds: ['trainer-1', 'trainer-2'],
      })

    await expect(page).toHaveURL('/groups')
    const createdGroupCard = page.getByTestId(`group-card-${createdGroupId}`)
    await expect(createdGroupCard).toBeVisible()
    await expect(createdGroupCard.getByText('Новая тестовая группа')).toBeVisible()
    await expect(createdGroupCard.getByText('Тренеры: Ирина Тренер, Артем База')).toBeVisible()
  })

  test('Проверяет auto-refresh после создания группы и обновляет список без ручного перезагрузки', async ({
    page,
  }) => {
    const groups: GroupState[] = [...baseGroups]
    let groupListCalls = 0
    let createdGroupId: string | null = null

    await mockApi(page, async ({ pathname, method, route }) => {
      if (pathname === '/api/auth/session' && method === 'GET') {
        await fulfillJson(route, 200, headCoachSession)
        return true
      }

      if (pathname === '/api/auth/login' && method === 'POST') {
        await fulfillJson(route, 200, headCoachSession)
        return true
      }

      if (pathname === '/api/groups/options/trainers' && method === 'GET') {
        await fulfillJson(route, 200, trainers)
        return true
      }

      if (pathname.startsWith('/api/groups/') && method === 'GET') {
        if (pathname.endsWith('/clients')) {
          await fulfillJson(route, 200, {
            clients: [],
          })
          return true
        }

        const groupId = pathname.slice('/api/groups/'.length)
        const group = groups.find((item) => item.id === groupId)

        if (!group) {
          await fulfillJson(route, 404, { message: 'Группа не найдена' })
          return true
        }

        await fulfillJson(route, 200, toGroupPayload(group))
        return true
      }

      if (pathname === '/api/groups' && method === 'GET') {
        groupListCalls += 1
        await fulfillJson(route, 200, buildGroupsListPayload(groups))
        return true
      }

      if (pathname === '/api/groups' && method === 'POST') {
        const payload = route.request().postDataJSON()
        const created: GroupState = {
          id: 'group-auto-1',
          name: payload.name,
          trainingStartTime: payload.trainingStartTime,
          scheduleText: payload.scheduleText,
          isActive: payload.isActive,
          trainerIds: payload.trainerIds ?? [],
          trainerNames: resolveTrainerNames(payload.trainerIds ?? []),
          clientCount: 0,
        }

        createdGroupId = created.id
        groups.push(created)
        await fulfillJson(route, 200, toGroupPayload(created))
        return true
      }

      return false
    })

    await page.goto('/groups')
    await page.getByRole('button', { name: 'Создать группу' }).click()
    await page.getByLabel('Название группы').fill('Черновик для автообновления')
    await page.getByLabel('Время начала').fill('20:00')
    await page.getByLabel('Расписание').fill('Пн, Ср')
    await page.getByRole('combobox', { name: 'Тренеры группы' }).click()
    await page.getByRole('option', { name: /Ирина Тренер/ }).click()
    await page.getByRole('button', { name: 'Создать группу' }).click()

    await expect.poll(() => createdGroupId).toBe('group-auto-1')

    const createdGroupCard = page.getByTestId(`group-card-${createdGroupId}`)
    await expect(page).toHaveURL('/groups')
    await expect(createdGroupCard).toBeVisible()
    await expect(createdGroupCard.getByText('Черновик для автообновления')).toBeVisible()
    await expect(createdGroupCard.getByText('Тренеры: Ирина Тренер')).toBeVisible()
    expect(groupListCalls).toBeGreaterThanOrEqual(2)
  })

  test('Ограничивает доступ тренера к модулю управления группами', async ({ page }) => {
    await mockApi(page, async ({ pathname, method, route }) => {
      if (pathname === '/api/auth/session' && method === 'GET') {
        await fulfillJson(route, 200, coachSession)
        return true
      }

      if (pathname === '/api/auth/login' && method === 'POST') {
        await fulfillJson(route, 200, coachSession)
        return true
      }

      if (pathname === '/api/attendance/groups' && method === 'GET') {
        await fulfillJson(route, 200, [toAttendanceGroupPayload(assignedAttendanceGroup)])
        return true
      }

      if (pathname.startsWith('/api/attendance/groups/') && pathname.endsWith('/clients') && method === 'GET') {
        await fulfillJson(route, 200, {
          groupId: 'group-coach',
          trainingDate: todayIso(),
          items: [
            {
              id: 'client-attendance-1',
              fullName: 'Тренируемый Клиент',
              isPresent: false,
              hasActivePaidMembership: false,
              hasUnpaidCurrentMembership: true,
              membershipWarning: false,
              groups: [
                {
                  id: 'group-coach',
                  name: 'Назначенная группа',
                  isActive: true,
                },
              ],
            },
          ],
        })
        return true
      }

      if (pathname === '/api/groups' && method === 'GET') {
        await fulfillJson(route, 200, buildGroupsListPayload([baseGroups[0]]))
        return true
      }

      return false
    })

    await page.goto('/groups')
    await expect(page).toHaveURL('/attendance')
    await expect(
      page.getByRole('heading', { name: 'Быстрая отметка посещений' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Группы' })).toHaveCount(0)
  })

  test('Просмотр главной страницы', async ({ page }) => {
    const expiringClient: ClientState = {
      ...baseClient,
      expirationDate: addIsoDays(todayIso(), 3),
      hasActivePaidMembership: true,
      hasUnpaidCurrentMembership: false,
      membershipWarning: false,
    }

    await mockApi(page, async ({ pathname, method, route }) => {
      if (pathname === '/api/auth/session' && method === 'GET') {
        await fulfillJson(route, 200, administratorSession)
        return true
      }

      if (pathname === '/api/auth/login' && method === 'POST') {
        await fulfillJson(route, 200, administratorSession)
        return true
      }

      if (pathname === '/api/clients' && method === 'GET') {
        await fulfillJson(route, 200, buildClientsListPayload([expiringClient], baseGroups))
        return true
      }

      return false
    })

    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Истекающие абонементы' }),
    ).toBeVisible()
    await expect(page.getByText('Иванов Иван Иванович')).toBeVisible()
    await expect(page.getByText('3 дня')).toBeVisible()
  })

  for (const profile of [
    {
      label: 'HeadCoach',
      session: headCoachSession,
    },
    {
      label: 'Administrator',
      session: administratorSession,
    },
  ]) {
    test(`Просмотр журнала действий доступен для ${profile.label}`, async ({ page }) => {
      await mockApi(page, async ({ pathname, method, route }) => {
        if (pathname === '/api/auth/session' && method === 'GET') {
          await fulfillJson(route, 200, profile.session)
          return true
        }

        if (pathname === '/api/auth/login' && method === 'POST') {
          await fulfillJson(route, 200, profile.session)
          return true
        }

        if (pathname === '/api/audit-logs/options' && method === 'GET') {
          await fulfillJson(route, 200, {
            users: [
              {
                id: 'user-1',
                fullName: 'Главный тренер',
                login: BOOTSTRAP_LOGIN,
                role: 'HeadCoach',
              },
            ],
            actionTypes: ['Login', 'ClientCreated', 'AttendanceMarked'],
            entityTypes: ['User', 'Client', 'Attendance'],
          })
          return true
        }

        if (pathname === '/api/audit-logs' && method === 'GET') {
          await fulfillJson(route, 200, {
            items: [
              {
                id: 'audit-1',
                userName: 'Главный тренер',
                userLogin: BOOTSTRAP_LOGIN,
                userRole: 'HeadCoach',
                actionType: 'ClientCreated',
                entityType: 'Client',
                entityId: 'client-1',
                description: 'Создан новый клиент',
                oldValueJson: { status: 'Draft' },
                newValueJson: { status: 'Active' },
                createdAt: `${todayIso()}T10:10:10.000Z`,
              },
            ],
            totalCount: 1,
            skip: 0,
            take: 20,
            page: 1,
            pageSize: 20,
            hasNextPage: false,
          })
          return true
        }

        return false
      })

      await page.goto('/audit')
      await expect(
        page.getByRole('heading', {
          name: 'Журнал действий показывает важные изменения в клубе',
        }),
      ).toBeVisible()
      await expect(page.getByText('Создан новый клиент')).toBeVisible()
      await page
        .getByRole('button', { name: /Создан новый клиент/ })
        .first()
        .click()
      await expect(page.getByText('Старые значения')).toBeVisible()
      await expect(page.getByText('"status": "Active"')).toBeVisible()
    })
  }

  test('Проверяет ключевые экраны на 390, 768 и 1440 px', async ({ page }) => {
    let auditCalls = 0
    let groupsCalls = 0
    let clientsCalls = 0

    await mockApi(page, async ({ pathname, method, route, searchParams }) => {
      if (pathname === '/api/auth/session' && method === 'GET') {
        await fulfillJson(route, 200, headCoachSession)
        return true
      }

      if (pathname === '/api/auth/login' && method === 'POST') {
        await fulfillJson(route, 200, headCoachSession)
        return true
      }

      if (pathname === '/api/attendance/groups' && method === 'GET') {
        await fulfillJson(route, 200, [toAttendanceGroupPayload(baseGroups[0])])
        return true
      }

      if (pathname.startsWith('/api/attendance/groups/') && pathname.endsWith('/clients') && method === 'GET') {
        const groupId = pathname.split('/')[3]
        await fulfillJson(route, 200, {
          groupId,
          trainingDate: todayIso(),
          items: [
            {
              id: 'client-attendance-1',
              fullName: 'Текущий клиент',
              isPresent: false,
              hasActivePaidMembership: true,
              hasUnpaidCurrentMembership: false,
              membershipWarning: false,
              groups: [
                {
                  id: 'group-1',
                  name: 'Группа 1',
                  isActive: true,
                },
              ],
            },
          ],
        })
        return true
      }

      if (pathname === '/api/groups' && method === 'GET') {
        groupsCalls += 1
        await fulfillJson(route, 200, buildGroupsListPayload(baseGroups))
        return true
      }

      if (pathname === '/api/clients' && method === 'GET') {
        clientsCalls += 1
        const responsePayload = buildClientsListPayload([baseClient], baseGroups, searchParams)
        await fulfillJson(route, 200, responsePayload)
        return true
      }

      if (pathname === '/api/audit-logs/options' && method === 'GET') {
        await fulfillJson(route, 200, {
          users: [],
          actionTypes: ['Login'],
          entityTypes: ['User'],
        })
        return true
      }

      if (pathname === '/api/audit-logs' && method === 'GET') {
        auditCalls += 1
        await fulfillJson(route, 200, {
          items: [],
          totalCount: 0,
          skip: 0,
          take: 20,
          page: 1,
          pageSize: 20,
          hasNextPage: false,
        })
        return true
      }

      return false
    })

    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })

      for (const screen of SCREEN_HEADINGS) {
        await page.goto(screen.path)
        await expect(page.getByRole('heading', { name: screen.heading })).toBeVisible()
        await expectNoHorizontalScroll(page)

        if (width === 390) {
          await expect(page.getByRole('button', { name: 'Показать навигацию' })).toBeVisible()
        }
      }
    }

    expect(groupsCalls).toBeGreaterThanOrEqual(1)
    expect(clientsCalls).toBeGreaterThanOrEqual(1)
    expect(auditCalls).toBeGreaterThanOrEqual(1)
  })
})

async function mockApi(
  page: Page,
  handler: (context: MockApiContext) => Promise<boolean>,
) {
  await page.route('**/api/**', async (route) => {
    const requestUrl = new URL(route.request().url())

    const handled = await handler({
      method: route.request().method(),
      pathname: requestUrl.pathname,
      route,
      searchParams: requestUrl.searchParams,
    })

    if (!handled) {
      throw new Error(
        `Unexpected API request in stage 12 e2e: ${route.request().method()} ${requestUrl.pathname}`,
      )
    }
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
    trainingStartTime: group.trainingStartTime,
    scheduleText: group.scheduleText,
    isActive: group.isActive,
    trainers: group.trainerIds.map((trainerId) => {
      const trainer = trainers.find((item) => item.id === trainerId)

      return {
        id: trainerId,
        fullName: trainer?.fullName ?? `Тренер ${trainerId}`,
        login: trainer?.login ?? trainerId,
      }
    }),
    trainerIds: group.trainerIds,
    clientCount: group.clientCount,
    trainerCount: group.trainerIds.length,
    trainerNames: group.trainerNames,
    updatedAt: new Date().toISOString(),
  }
}

function toAttendanceGroupPayload(group: GroupState) {
  return {
    id: group.id,
    name: group.name,
    trainingStartTime: group.trainingStartTime,
    scheduleText: group.scheduleText,
    clientCount: group.clientCount,
  }
}

function buildClientsListPayload(
  clients: ClientState[],
  groups: GroupState[],
  searchParams?: URLSearchParams,
) {
  const items = clients.map((client) => toClientPayload(client, groups))

  return {
    items,
    totalCount: searchParams ? items.length : clients.length,
    skip: 0,
    take: Number(searchParams?.get('pageSize') ?? 20),
    page: Number(searchParams?.get('page') ?? 1),
    pageSize: Number(searchParams?.get('pageSize') ?? 20),
    hasNextPage: false,
  }
}

function toClientPayload(client: ClientState, groups: GroupState[]) {
  const assignedGroups = groups.filter((group) => client.groupIds.includes(group.id))
  const membershipType = client.membershipType

  return {
    id: client.id,
    lastName: client.lastName,
    firstName: client.firstName,
    middleName: client.middleName,
    fullName: `${client.lastName} ${client.firstName} ${client.middleName}`,
    phone: client.phone,
    status: 'Active',
    contactCount: client.contacts.length,
    groupCount: assignedGroups.length,
    groups: assignedGroups.map((group) => ({
      id: group.id,
      name: group.name,
      isActive: group.isActive,
      trainingStartTime: group.trainingStartTime,
      scheduleText: group.scheduleText,
    })),
    contacts: client.contacts,
    groupIds: client.groupIds,
    photo: null,
    hasActivePaidMembership: client.hasActivePaidMembership,
    hasUnpaidCurrentMembership: client.hasUnpaidCurrentMembership,
    membershipWarning: client.membershipWarning,
    currentMembership: membershipType
      ? {
          id: `${client.id}-m1`,
          membershipType,
          purchaseDate: addIsoDays(todayIso(), -20),
          expirationDate: client.expirationDate,
          paymentAmount: 4000,
          isPaid: client.hasActivePaidMembership,
          singleVisitUsed: false,
          changedByUserName: 'Тест',
        }
      : null,
    membershipHistory: membershipType
      ? [
          {
            id: `${client.id}-m1`,
            membershipType,
            purchaseDate: addIsoDays(todayIso(), -20),
            expirationDate: client.expirationDate,
            paymentAmount: 4000,
            isPaid: client.hasActivePaidMembership,
            singleVisitUsed: false,
          },
        ]
      : [],
    attendanceHistory: [],
    attendanceHistoryTotalCount: 0,
  }
}

function resolveTrainerNames(trainerIds: string[]) {
  return trainerIds
    .map((trainerId) => {
      const trainer = trainers.find((item) => item.id === trainerId)
      return trainer?.fullName ?? `Тренер ${trainerId}`
    })
    .filter(Boolean)
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function addIsoDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
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

async function expectNoHorizontalScroll(page: Page) {
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const root = document.documentElement
        return root.scrollWidth <= root.clientWidth + 1
      }),
    )
    .toBe(true)
}
