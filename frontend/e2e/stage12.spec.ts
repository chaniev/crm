import { expect, test, type Page } from '@playwright/test'

const APP_CONFIG = { clubName: 'Iron Club' } as const
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
    allowedSections: ['Home', 'Clients', 'Groups', 'Users', 'Audit', 'Settings'],
    permissions: {
      canManageUsers: true,
      canManageClients: true,
      canManageGroups: true,
      canManageSettings: true,
      canMarkAttendance: true,
      canViewAuditLog: true,
      canViewFinancialReports: true,
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
    allowedSections: ['Home', 'Clients', 'Groups', 'Audit', 'Settings'],
    permissions: {
      canManageUsers: false,
      canManageClients: true,
      canManageGroups: true,
      canManageSettings: true,
      canMarkAttendance: false,
      canViewAuditLog: true,
      canViewFinancialReports: false,
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
    landingScreen: 'Home',
    allowedSections: ['Home', 'Clients'],
    permissions: {
      canManageUsers: false,
      canManageClients: false,
      canManageGroups: false,
      canManageSettings: false,
      canMarkAttendance: true,
      canViewAuditLog: false,
      canViewFinancialReports: false,
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

type BranchState = {
  id: string
  name: string
  address: string
  description: string
  isArchived: boolean
}

type HallState = {
  id: string
  branchId: string
  branchName: string
  name: string
  description: string
  isArchived: boolean
  groupCount: number
}

type GroupState = {
  id: string
  branchId: string
  branchName: string
  hallId: string
  hallName: string
  groupTypeId: string
  groupTypeName: string
  name: string
  trainingStartTime: string
  durationMinutes: number
  weekdays: number[]
  isActive: boolean
  trainerIds: string[]
  trainerNames: string[]
  clientCount: number
}

type GroupTypeState = {
  id: string
  name: string
  description: string | null
  groupCount: number
}

type ClientState = {
  id: string
  branchId: string
  branchName: string
  lastName: string
  firstName: string
  middleName: string
  phone: string
  notes: string
  status?: 'Active' | 'Archived'
  groupIds: string[]
  contacts: Array<{
    type: string
    fullName: string
    phone: string
  }>
  isProfessional?: boolean
  professionalComment?: string | null
  hasActivePaidMembership: boolean
  hasUnpaidCurrentMembership: boolean
  membershipWarning: boolean
  membershipType?: 'SingleVisit' | 'Monthly' | 'Yearly'
  currentMembershipIsPaid?: boolean
  expirationDate: string
}

const trainers: TrainerOption[] = [
  {
    id: 'headcoach-id',
    fullName: 'Главный тренер',
    login: 'headcoach',
  },
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

const baseBranch: BranchState = {
  id: 'branch-1',
  name: 'Центр',
  address: 'ул. Тестовая, 1',
  description: 'Основной филиал',
  isArchived: false,
}

const secondaryBranch: BranchState = {
  id: 'branch-2',
  name: 'Север',
  address: 'ул. Северная, 2',
  description: 'Второй филиал',
  isArchived: false,
}

const baseHall: HallState = {
  id: 'hall-1',
  branchId: baseBranch.id,
  branchName: baseBranch.name,
  name: 'Основной зал',
  description: 'Зал для групп',
  isArchived: false,
  groupCount: 1,
}

const baseGroupType: GroupTypeState = {
  id: 'group-type-1',
  name: 'Базовый тип',
  description: 'Тип для e2e',
  groupCount: 1,
}

const assignedAttendanceGroup = {
  id: 'group-coach',
  branchId: baseBranch.id,
  branchName: baseBranch.name,
  hallId: baseHall.id,
  hallName: baseHall.name,
  groupTypeId: baseGroupType.id,
  groupTypeName: baseGroupType.name,
  name: 'Назначенная группа',
  trainingStartTime: '19:00',
  durationMinutes: 60,
  weekdays: [2, 4],
  isActive: true,
  trainerIds: ['coach-id'],
  trainerNames: ['Назначенный тренер'],
  clientCount: 1,
}

const baseGroups: GroupState[] = [
  {
    id: 'group-1',
    branchId: baseBranch.id,
    branchName: baseBranch.name,
    hallId: baseHall.id,
    hallName: baseHall.name,
    groupTypeId: baseGroupType.id,
    groupTypeName: baseGroupType.name,
    name: 'Группа 1',
    trainingStartTime: '18:00',
    durationMinutes: 60,
    weekdays: [1, 3, 5],
    isActive: true,
    trainerIds: ['trainer-1'],
    trainerNames: ['Ирина Тренер'],
    clientCount: 1,
  },
]

const baseClient: ClientState = {
  id: 'client-1',
  branchId: baseBranch.id,
  branchName: baseBranch.name,
  lastName: 'Иванов',
  firstName: 'Иван',
  middleName: 'Иванович',
  phone: '+79990001111',
  notes: 'Предпочитает вечерние тренировки.',
  groupIds: ['group-1'],
  contacts: [],
  hasActivePaidMembership: true,
  hasUnpaidCurrentMembership: false,
  membershipWarning: false,
  membershipType: 'Monthly',
  expirationDate: addIsoDays(todayIso(), 20),
}

const SCREEN_CHECKS = [
  {
    path: '/',
    testId: 'home-screen',
  },
  {
    path: '/schedule',
    testId: 'schedule-screen',
  },
  {
    path: '/clients',
    testId: 'clients-screen',
  },
  {
    path: '/groups',
    testId: 'groups-screen',
  },
  {
    path: '/audit',
    testId: 'audit-screen',
  },
  {
    path: '/settings',
    testId: 'settings-screen',
  },
]

const SIDE_NAVIGATION_SELECTOR =
  'nav.app-shell__side-nav[aria-label="Основная навигация"]'
const MOBILE_BOTTOM_NAVIGATION_SELECTOR =
  'nav.mobile-bottom-nav[aria-label="Мобильная навигация"]'
const MOBILE_MENU_BREAKPOINT = 768

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
          branchId: baseBranch.id,
          notes: 'Нужен звонок за день до первого занятия.',
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
          notes: 'Нужен звонок за день до первого занятия.',
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
    await page.getByRole('button', { name: 'Новый клиент' }).click()

    await page.getByLabel('Фамилия').fill('Петров')
    await page.getByLabel('Имя').fill('Пётр')
    await page.getByLabel('Отчество').fill('Петрович')
    await page.getByLabel('Телефон').fill('+79990005555')
    await page
      .getByLabel('Рабочая заметка')
      .fill('Нужен звонок за день до первого занятия.')

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
        branchId: baseBranch.id,
        notes: 'Нужен звонок за день до первого занятия.',
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
      page.getByRole('heading', { level: 1, name: 'Петров Пётр Петрович' }),
    ).toBeVisible()
    await expect(page.getByText('Анна Петрова', { exact: true })).toBeVisible()
    await expect(page.getByText('Олег Петров', { exact: true })).toBeVisible()
    await expect(
      page.getByText('Нужен звонок за день до первого занятия.'),
    ).toBeVisible()
    await expect(page.getByText('Абонемент не оформлен')).toBeVisible()

    await page.getByRole('button', { name: 'К списку клиентов' }).click()
    await expect(page).toHaveURL('/clients')
    await expect(page.getByTestId('clients-screen')).toBeVisible()
    await expect(page.getByText('Петров Пётр Петрович')).toBeVisible()
    expect(clientListCalls).toBeGreaterThan(1)
  })

  test('Редактирование клиента сохраняет заметку и показывает ее после reload', async ({
    page,
  }) => {
    let updateClientPayload: Record<string, unknown> | null = null
    const groups: GroupState[] = [...baseGroups]
    let client: ClientState = {
      ...baseClient,
      notes: 'Исходная заметка клиента.',
    }

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
        await fulfillJson(route, 200, buildClientsListPayload([client], groups, searchParams))
        return true
      }

      if (pathname === '/api/clients/client-1' && method === 'GET') {
        await fulfillJson(route, 200, toClientPayload(client, groups))
        return true
      }

      if (pathname === '/api/clients/client-1' && method === 'PUT') {
        const payload = route.request().postDataJSON()
        updateClientPayload = payload

        expect(payload).toEqual({
          lastName: 'Иванов',
          firstName: 'Иван',
          middleName: 'Иванович',
          phone: '+79990001111',
          branchId: baseBranch.id,
          notes: 'Позвонить маме после 18:00 перед продлением.',
          groupIds: ['group-1'],
          contacts: [],
        })

        client = {
          ...client,
          notes: String(payload.notes ?? ''),
        }

        await fulfillJson(route, 200, toClientPayload(client, groups))
        return true
      }

      return false
    })

    await page.goto('/clients/client-1/edit')

    await expect(
      page.getByRole('heading', { level: 1, name: 'Иванов Иван Иванович' }),
    ).toBeVisible()
    await page
      .getByLabel('Рабочая заметка')
      .fill('Позвонить маме после 18:00 перед продлением.')
    await page.getByRole('button', { name: 'Сохранить изменения' }).click()

    await expect
      .poll(() => updateClientPayload)
      .toEqual({
        lastName: 'Иванов',
        firstName: 'Иван',
        middleName: 'Иванович',
        phone: '+79990001111',
        branchId: baseBranch.id,
        notes: 'Позвонить маме после 18:00 перед продлением.',
        groupIds: ['group-1'],
        contacts: [],
      })

    await expect(page).toHaveURL('/clients/client-1')
    await expect(
      page.getByText('Позвонить маме после 18:00 перед продлением.'),
    ).toBeVisible()

    await page.reload()
    await expect(
      page.getByText('Позвонить маме после 18:00 перед продлением.'),
    ).toBeVisible()
  })

  test('HeadCoach включает льготный статус профессионала с комментарием', async ({
    page,
  }) => {
    const groups: GroupState[] = [...baseGroups]
    let professionalPayload: Record<string, unknown> | null = null
    let client: ClientState = {
      ...baseClient,
      id: 'client-professional',
      lastName: 'Профессионалов',
      firstName: 'Льготный',
      middleName: 'Статус',
      hasActivePaidMembership: false,
      hasUnpaidCurrentMembership: true,
      membershipWarning: true,
      currentMembershipIsPaid: false,
    }

    await mockApi(page, async ({ pathname, method, route }) => {
      if (pathname === '/api/auth/session' && method === 'GET') {
        await fulfillJson(route, 200, headCoachSession)
        return true
      }

      if (pathname === '/api/clients/client-professional' && method === 'GET') {
        await fulfillJson(route, 200, toClientPayload(client, groups))
        return true
      }

      if (
        pathname === '/api/clients/client-professional/professional-status' &&
        method === 'PUT'
      ) {
        professionalPayload = route.request().postDataJSON()
        expect(route.request().headers()['x-csrf-token']).toBe(
          headCoachSession.csrfToken,
        )
        expect(professionalPayload).toEqual({
          IsProfessional: true,
          ProfessionalComment: 'Кандидат сборной, льготный доступ',
        })

        client = {
          ...client,
          isProfessional: true,
          professionalComment: 'Кандидат сборной, льготный доступ',
          hasActivePaidMembership: true,
          hasUnpaidCurrentMembership: false,
          membershipWarning: false,
          currentMembershipIsPaid: false,
        }

        await fulfillJson(route, 200, toClientPayload(client, groups))
        return true
      }

      return false
    })

    await page.goto('/clients/client-professional')

    await expect(
      page.getByRole('heading', {
        level: 1,
        name: 'Профессионалов Льготный Статус',
      }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Профессионал' }).click()
    await page
      .getByLabel('Комментарий')
      .fill('Кандидат сборной, льготный доступ')
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Профессионал' })
      .click()

    await expect.poll(() => professionalPayload).toEqual({
      IsProfessional: true,
      ProfessionalComment: 'Кандидат сборной, льготный доступ',
    })
    await expect(
      page.getByText('Профессионал', { exact: true }).first(),
    ).toBeVisible()
    await expect(
      page
        .getByLabel('Профессионал', { exact: true })
        .getByText('Кандидат сборной, льготный доступ')
        .first(),
    ).toBeVisible()
    await expect(page.getByText('Не оплачен')).toHaveCount(0)
  })

  test('Administrator не видит управление льготным статусом профессионала', async ({
    page,
  }) => {
    const groups: GroupState[] = [...baseGroups]
    const client: ClientState = {
      ...baseClient,
      id: 'client-admin-professional',
      hasActivePaidMembership: false,
      hasUnpaidCurrentMembership: true,
      membershipWarning: true,
      currentMembershipIsPaid: false,
    }

    await mockApi(page, async ({ pathname, method, route }) => {
      if (pathname === '/api/auth/session' && method === 'GET') {
        await fulfillJson(route, 200, administratorSession)
        return true
      }

      if (pathname === '/api/clients/client-admin-professional' && method === 'GET') {
        await fulfillJson(route, 200, toClientPayload(client, groups))
        return true
      }

      return false
    })

    await page.goto('/clients/client-admin-professional')

    await expect(
      page.getByRole('heading', { level: 1, name: 'Иванов Иван Иванович' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Профессионал' }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Снять статус "Профессионал"' }),
    ).toHaveCount(0)
  })

  test('Перевод клиента меняет филиал и может оставить клиента без группы', async ({
    page,
  }) => {
    let transferPayload: Record<string, unknown> | null = null
    const groups: GroupState[] = [...baseGroups]
    let client: ClientState = { ...baseClient }

    await mockApi(page, async ({ pathname, method, route }) => {
      if (pathname === '/api/auth/session' && method === 'GET') {
        await fulfillJson(route, 200, headCoachSession)
        return true
      }

      if (pathname === '/api/groups' && method === 'GET') {
        await fulfillJson(route, 200, buildGroupsListPayload(groups))
        return true
      }

      if (pathname === '/api/clients/client-1' && method === 'GET') {
        await fulfillJson(route, 200, toClientPayload(client, groups))
        return true
      }

      if (pathname === '/api/clients/client-1/transfer' && method === 'POST') {
        transferPayload = route.request().postDataJSON()
        expect(route.request().headers()['x-csrf-token']).toBe(
          headCoachSession.csrfToken,
        )
        expect(transferPayload).toEqual({
          branchId: secondaryBranch.id,
          groupId: null,
        })

        client = {
          ...client,
          branchId: secondaryBranch.id,
          branchName: secondaryBranch.name,
          groupIds: [],
        }

        await fulfillJson(route, 200, toClientPayload(client, groups))
        return true
      }

      return false
    })

    await page.goto('/clients/client-1')
    await page.getByRole('button', { name: 'Перевести' }).click()
    await page.getByRole('combobox', { name: 'Целевой филиал' }).click()
    await page.getByRole('option', { name: /Север/ }).click()
    await page.getByRole('button', { name: 'Перевести клиента' }).click()

    await expect.poll(() => transferPayload).toEqual({
      branchId: secondaryBranch.id,
      groupId: null,
    })
    await expect(page.getByText('Север', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Клиент пока не включен ни в одну группу.')).toBeVisible()
  })

  test('Создание клиента отображает backend errors.fullName под полем Фамилия', async ({
    page,
  }) => {
    const serverFullNameError = 'Укажите ФИО клиента полностью.'
    let createClientPayload: Record<string, unknown> | null = null

    await mockApi(page, async ({ pathname, method, route }) => {
      if (pathname === '/api/auth/session' && method === 'GET') {
        await fulfillJson(route, 200, headCoachSession)
        return true
      }

      if (pathname === '/api/auth/login' && method === 'POST') {
        await fulfillJson(route, 200, headCoachSession)
        return true
      }

      if (pathname === '/api/groups' && method === 'GET') {
        await fulfillJson(route, 200, buildGroupsListPayload(baseGroups))
        return true
      }

      if (pathname === '/api/clients' && method === 'POST') {
        createClientPayload = route.request().postDataJSON()

        await fulfillJson(route, 400, {
          title: 'Validation failed',
          detail: 'Проверьте данные клиента.',
          errors: {
            fullName: [serverFullNameError],
          },
        })
        return true
      }

      return false
    })

    await page.goto('/clients/new')

    await page.getByLabel('Имя').fill('Пётр')
    await page.getByLabel('Телефон').fill('+79990005555')
    await page.getByRole('button', { name: 'Сохранить клиента' }).click()

    await expect.poll(() => createClientPayload).toMatchObject({
      firstName: 'Пётр',
      phone: '+79990005555',
    })
    await expect(page.getByLabel('Фамилия')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    await expect(page.getByText(serverFullNameError)).toBeVisible()
  })

  test('Фильтры списка клиентов сохраняются при переходе на следующую страницу', async ({
    page,
  }) => {
    const filterGroup: GroupState = {
      id: 'group-filter',
      branchId: baseBranch.id,
      branchName: baseBranch.name,
      hallId: baseHall.id,
      hallName: baseHall.name,
      groupTypeId: baseGroupType.id,
      groupTypeName: baseGroupType.name,
      name: 'Фильтр-группа',
      trainingStartTime: '17:00',
      durationMinutes: 60,
      weekdays: [1, 3],
      isActive: true,
      trainerIds: ['trainer-1'],
      trainerNames: ['Ирина Тренер'],
      clientCount: 21,
    }
    const groups = [...baseGroups, filterGroup]
    const filteredClients = Array.from({ length: 21 }, (_, index) => ({
      ...baseClient,
      id: `client-filter-${index + 1}`,
      lastName: `Фильтров-${index + 1}`,
      firstName: 'Клиент',
      middleName: 'Архивный',
      phone: `+79990010${String(index + 1).padStart(2, '0')}`,
      status: 'Archived' as const,
      groupIds: [filterGroup.id],
      hasActivePaidMembership: false,
      hasUnpaidCurrentMembership: true,
      membershipWarning: true,
      expirationDate: '2026-05-20',
    }))
    const clientRequests: Array<Record<string, string>> = []

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

      if (pathname.startsWith('/api/clients/') && method === 'GET') {
        const clientId = pathname.slice('/api/clients/'.length)
        const client = [baseClient, ...filteredClients].find(
          (item) => item.id === clientId,
        )

        if (!client) {
          await fulfillJson(route, 404, { message: 'Клиент не найден' })
          return true
        }

        await fulfillJson(route, 200, toClientPayload(client, groups))
        return true
      }

      if (pathname === '/api/clients' && method === 'GET') {
        clientRequests.push(Object.fromEntries(searchParams.entries()))

        const isFilteredRequest =
          searchParams.get('query') === 'Фильтр' &&
          searchParams.get('groupId') === filterGroup.id &&
          searchParams.get('status') === 'Archived'
        const pageNumber = Number(searchParams.get('page') ?? 1)
        const pageItems = isFilteredRequest
          ? pageNumber === 2
            ? filteredClients.slice(20)
            : filteredClients.slice(0, 20)
          : [baseClient]

        await fulfillJson(
          route,
          200,
          buildClientsListPayload(pageItems, groups, searchParams, {
            totalCount: isFilteredRequest ? filteredClients.length : 1,
          }),
        )
        return true
      }

      return false
    })

    await page.goto('/clients')
    await expect(page.getByTestId('clients-screen')).toBeVisible()

    await page.getByLabel('Поиск по имени или телефону').fill('Фильтр')
    await page.getByRole('combobox', { name: 'Группа' }).click()
    await page.getByRole('option', { name: 'Фильтр-группа' }).click()
    await page.getByRole('combobox', { name: 'Оплата' }).click()
    await page.getByRole('option', { name: 'Неоплаченные' }).click()
    await page.getByRole('button', { name: /Ещё фильтры/ }).click()
    await page.getByLabel('Истекает с').fill('2026-05-01')
    await page.getByRole('combobox', { name: 'Статус' }).click()
    await page.getByRole('option', { name: 'Архив' }).click()
    await page.getByLabel('Истекает по').fill('2026-05-31')
    await page.getByLabel('Без фото').click()
    await page.keyboard.press('Escape')

    await expect
      .poll(() =>
        clientRequests.some((request) =>
          hasRequestParams(request, {
            page: '1',
            pageSize: '20',
            query: 'Фильтр',
            groupId: filterGroup.id,
            status: 'Archived',
            paymentStatus: 'Unpaid',
            membershipExpiresFrom: '2026-05-01',
            membershipExpiresTo: '2026-05-31',
            hasPhoto: 'false',
          }),
        ),
      )
      .toBe(true)
    await expect(page.getByTestId('client-card-client-filter-1')).toBeVisible()
    await expect(page.getByText('Показаны 1-20 из 21')).toBeVisible()

    await expect(page.getByRole('button', { name: 'Дальше' })).toBeEnabled()
    await page.getByRole('button', { name: 'Дальше' }).click()

    await expect
      .poll(() =>
        clientRequests.some((request) =>
          hasRequestParams(request, {
            page: '2',
            pageSize: '20',
            query: 'Фильтр',
            groupId: filterGroup.id,
            status: 'Archived',
            paymentStatus: 'Unpaid',
            membershipExpiresFrom: '2026-05-01',
            membershipExpiresTo: '2026-05-31',
            hasPhoto: 'false',
          }),
        ),
      )
      .toBe(true)
    await expect(page.getByTestId('client-card-client-filter-21')).toBeVisible()
    await expect(page.getByText('Показаны 21-21 из 21')).toBeVisible()
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
          branchId: baseBranch.id,
          hallId: baseHall.id,
          groupTypeId: baseGroupType.id,
          trainingStartTime: '19:00',
          durationMinutes: 60,
          weekdays: [2, 4],
          isActive: true,
          trainerIds: ['headcoach-id', 'trainer-1', 'trainer-2'],
        })

        const assignedTrainerIds = payload.trainerIds ?? []
        const createdGroup: GroupState = {
          id: createdGroupId,
          branchId: payload.branchId,
          branchName: baseBranch.name,
          hallId: payload.hallId,
          hallName: baseHall.name,
          groupTypeId: payload.groupTypeId,
          groupTypeName: baseGroupType.name,
          name: 'Новая тестовая группа',
          trainingStartTime: '19:00',
          durationMinutes: 60,
          weekdays: [2, 4],
          isActive: true,
          trainerIds: assignedTrainerIds,
          trainerNames: resolveTrainerNames(assignedTrainerIds),
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
    await page.getByLabel('Длительность').fill('60')
    await page.getByRole('checkbox', { name: 'Вт' }).check()
    await page.getByRole('checkbox', { name: 'Чт' }).check()
    await page.getByRole('combobox', { name: 'Зал' }).click()
    await page.getByRole('option', { name: 'Основной зал' }).click()

    const trainerSelect = page.getByRole('combobox', { name: 'Тренеры группы' })
    await trainerSelect.click()
    await page.getByRole('option', { name: /Ирина Тренер/ }).click()
    await trainerSelect.click()
    await page.getByRole('option', { name: /Главный тренер/ }).click()
    await trainerSelect.click()
    await page.getByRole('option', { name: /Артем База/ }).click()

    await page.getByRole('button', { name: 'Создать группу' }).click()

    await expect
      .poll(() => createGroupPayload)
      .toEqual({
        name: 'Новая тестовая группа',
        branchId: baseBranch.id,
        hallId: baseHall.id,
        groupTypeId: baseGroupType.id,
        trainingStartTime: '19:00',
        durationMinutes: 60,
        weekdays: [2, 4],
        isActive: true,
        trainerIds: ['headcoach-id', 'trainer-1', 'trainer-2'],
      })

    await expect(page).toHaveURL('/groups')
    const createdGroupCard = page.getByTestId(`group-card-${createdGroupId}`)
    await expect(createdGroupCard).toBeVisible()
    await expect(createdGroupCard.getByText('Новая тестовая группа')).toBeVisible()
    await expect(createdGroupCard.getByText('Тренеры: Главный тренер, Ирина Тренер, Артем База')).toBeVisible()
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
          branchId: payload.branchId,
          branchName: baseBranch.name,
          hallId: payload.hallId,
          hallName: baseHall.name,
          groupTypeId: payload.groupTypeId,
          groupTypeName: baseGroupType.name,
          name: payload.name,
          trainingStartTime: payload.trainingStartTime,
          durationMinutes: payload.durationMinutes,
          weekdays: payload.weekdays,
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
    await page.getByLabel('Длительность').fill('45')
    await page.getByRole('checkbox', { name: 'Пн' }).check()
    await page.getByRole('checkbox', { name: 'Ср' }).check()
    await page.getByRole('combobox', { name: 'Зал' }).click()
    await page.getByRole('option', { name: 'Основной зал' }).click()
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

  test('Настройки позволяют создать и изменить филиал, зал и показывают blocked hall errors', async ({
    page,
  }) => {
    let branchCreatePayload: Record<string, unknown> | null = null
    let branchUpdatePayload: Record<string, unknown> | null = null
    let hallCreatePayload: Record<string, unknown> | null = null
    let hallUpdatePayload: Record<string, unknown> | null = null
    let groupTypeCreatePayload: Record<string, unknown> | null = null
    let administratorCreatePayload: Record<string, unknown> | null = null
    const branches: BranchState[] = [{ ...baseBranch }]
    const halls: HallState[] = [{ ...baseHall }]
    const groupTypes: GroupTypeState[] = [{ ...baseGroupType }]
    const administrators: Array<Record<string, unknown>> = []

    function branchResponse(branch: BranchState) {
      return {
        ...toBranchPayload(branch),
        hallCount: halls.filter((hall) => hall.branchId === branch.id).length,
        groupCount: branch.id === baseBranch.id ? 1 : 0,
        clientCount: branch.id === baseBranch.id ? 1 : 0,
      }
    }

    await mockApi(page, async ({ pathname, method, route, searchParams }) => {
      if (pathname === '/api/auth/session' && method === 'GET') {
        await fulfillJson(route, 200, headCoachSession)
        return true
      }

      if (pathname === '/api/branches' && method === 'GET') {
        await fulfillJson(route, 200, branches.map(branchResponse))
        return true
      }

      if (pathname === '/api/halls' && method === 'GET') {
        const branchId = searchParams.get('branchId')
        const visibleHalls = branchId
          ? halls.filter((hall) => hall.branchId === branchId)
          : halls

        await fulfillJson(route, 200, visibleHalls.map(toHallPayload))
        return true
      }

      if (pathname === '/api/branches' && method === 'POST') {
        branchCreatePayload = route.request().postDataJSON()
        const branch: BranchState = {
          id: 'branch-created',
          name: String(branchCreatePayload.name),
          address: String(branchCreatePayload.address ?? ''),
          description: String(branchCreatePayload.description ?? ''),
          isArchived: false,
        }
        branches.push(branch)
        await fulfillJson(route, 200, branchResponse(branch))
        return true
      }

      if (pathname === '/api/branches/branch-created' && method === 'PUT') {
        branchUpdatePayload = route.request().postDataJSON()
        const branch = branches.find((item) => item.id === 'branch-created')!
        branch.name = String(branchUpdatePayload.name)
        branch.address = String(branchUpdatePayload.address ?? '')
        branch.description = String(branchUpdatePayload.description ?? '')
        await fulfillJson(route, 200, branchResponse(branch))
        return true
      }

      if (pathname === '/api/branches/branch-created/archive' && method === 'PUT') {
        const branch = branches.find((item) => item.id === 'branch-created')!
        branch.isArchived = true
        await fulfillJson(route, 200, branchResponse(branch))
        return true
      }

      if (pathname === '/api/halls' && method === 'POST') {
        hallCreatePayload = route.request().postDataJSON()
        const branch = branches.find(
          (item) => item.id === String(hallCreatePayload?.branchId),
        )!
        const hall: HallState = {
          id: 'hall-created',
          branchId: branch.id,
          branchName: branch.name,
          name: String(hallCreatePayload.name),
          description: String(hallCreatePayload.description ?? ''),
          isArchived: false,
          groupCount: 0,
        }
        halls.push(hall)
        await fulfillJson(route, 200, toHallPayload(hall))
        return true
      }

      if (pathname === '/api/halls/hall-created' && method === 'PUT') {
        hallUpdatePayload = route.request().postDataJSON()
        const hall = halls.find((item) => item.id === 'hall-created')!
        hall.name = String(hallUpdatePayload.name)
        hall.description = String(hallUpdatePayload.description ?? '')
        await fulfillJson(route, 200, toHallPayload(hall))
        return true
      }

      if (pathname === '/api/halls/hall-1/archive' && method === 'PUT') {
        await fulfillJson(route, 400, {
          title: 'Validation failed',
          detail: 'Зал используется группами.',
          errors: {
            hall: ['Зал используется группами.'],
          },
        })
        return true
      }

      if (pathname === '/api/halls/hall-1' && method === 'DELETE') {
        await fulfillJson(route, 400, {
          title: 'Validation failed',
          detail: 'Зал нельзя удалить: он используется группами.',
          errors: {
            hall: ['Зал нельзя удалить: он используется группами.'],
          },
        })
        return true
      }

      if (pathname === '/api/group-types' && method === 'GET') {
        await fulfillJson(route, 200, groupTypes.map(toGroupTypePayload))
        return true
      }

      if (pathname === '/api/group-types' && method === 'POST') {
        groupTypeCreatePayload = route.request().postDataJSON()
        const groupType: GroupTypeState = {
          id: 'group-type-created',
          name: String(groupTypeCreatePayload.name),
          description: String(groupTypeCreatePayload.description ?? ''),
          groupCount: 0,
        }
        groupTypes.push(groupType)
        await fulfillJson(route, 200, toGroupTypePayload(groupType))
        return true
      }

      if (pathname === '/api/settings/administrators' && method === 'GET') {
        await fulfillJson(route, 200, administrators)
        return true
      }

      if (pathname === '/api/settings/administrators' && method === 'POST') {
        administratorCreatePayload = route.request().postDataJSON()
        const administrator = {
          id: 'administrator-created',
          fullName: String(administratorCreatePayload.fullName),
          login: String(administratorCreatePayload.login),
          role: 'Administrator',
          mustChangePassword: Boolean(administratorCreatePayload.mustChangePassword),
          isActive: Boolean(administratorCreatePayload.isActive),
          messengerPlatform: administratorCreatePayload.messengerPlatform ?? null,
          messengerPlatformUserId:
            administratorCreatePayload.messengerPlatformUserId ?? null,
        }
        administrators.push(administrator)
        await fulfillJson(route, 200, administrator)
        return true
      }

      return false
    })

    await page.goto('/settings')
    await page.getByRole('tab', { name: 'Филиалы и залы' }).click()
    await expect(page.getByRole('heading', { name: 'Филиалы и залы' })).toBeVisible()

    await page.getByRole('button', { name: 'Добавить филиал' }).first().click()
    await page.getByLabel('Название филиала').fill('Юг')
    await page.getByLabel('Адрес').fill('ул. Южная, 3')
    await page.getByLabel('Описание').fill('Новый филиал')
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Сохранить' })
      .click()

    await expect.poll(() => branchCreatePayload).toEqual({
      name: 'Юг',
      address: 'ул. Южная, 3',
      description: 'Новый филиал',
    })
    await expect(page.getByText('Юг', { exact: true }).first()).toBeVisible()

    await page.getByRole('button', { name: 'Редактировать' }).click()
    await page.getByLabel('Название филиала').fill('Юг обновленный')
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Сохранить' })
      .click()

    await expect.poll(() => branchUpdatePayload).toMatchObject({
      name: 'Юг обновленный',
    })
    await expect(page.getByText('Юг обновленный', { exact: true }).first()).toBeVisible()

    await page.getByRole('button', { name: 'В архив' }).click()
    await expect(page.getByText('Архивный').first()).toBeVisible()

    await page.getByRole('button', { name: /Открыть филиал Центр/ }).click()
    await page.getByRole('button', { name: 'Добавить зал' }).first().click()
    await page.getByLabel('Название зала').fill('Зал Б')
    await page.getByLabel('Описание').fill('Зал для функциональных тренировок')
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Сохранить' })
      .click()

    await expect.poll(() => hallCreatePayload).toEqual({
      branchId: baseBranch.id,
      name: 'Зал Б',
      description: 'Зал для функциональных тренировок',
    })
    await expect(page.getByText('Зал Б', { exact: true })).toBeVisible()

    await page.getByLabel('Редактировать зал Зал Б').click()
    await page.getByLabel('Название зала').fill('Зал Б обновленный')
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Сохранить' })
      .click()

    await expect.poll(() => hallUpdatePayload).toMatchObject({
      branchId: baseBranch.id,
      name: 'Зал Б обновленный',
    })
    await expect(page.getByText('Зал Б обновленный', { exact: true })).toBeVisible()

    await page.getByLabel('Архивировать зал Основной зал').click()
    await expect(page.getByText('Зал используется группами.')).toBeVisible()

    await page.getByLabel('Удалить зал Основной зал').click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Удалить зал' })
      .click()
    await expect(page.getByText('Зал нельзя удалить: он используется группами.')).toBeVisible()

    await page.getByRole('tab', { name: 'Типы групп' }).click()
    await page.getByRole('button', { name: 'Добавить тип' }).click()
    await page.getByLabel('Название').fill('Подростки')
    await page.getByLabel('Описание').fill('Группы для подростков')
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Сохранить' })
      .click()
    await expect.poll(() => groupTypeCreatePayload).toEqual({
      name: 'Подростки',
      description: 'Группы для подростков',
    })
    await expect(page.getByTestId('group-type-card-group-type-created')).toBeVisible()

    await page.getByRole('tab', { name: 'Администраторы' }).click()
    await page.getByRole('button', { name: 'Добавить администратора' }).first().click()
    const administratorDialog = page.getByRole('dialog')
    await expect(
      administratorDialog.getByText('Администратор активен', { exact: true }),
    ).toBeVisible()
    await expect(
      administratorDialog.getByText('Тренер активен', { exact: true }),
    ).toHaveCount(0)
    await expect(administratorDialog.getByRole('combobox', { name: 'Роль' })).toHaveCount(0)
    await page.getByLabel('ФИО').fill('Администратор настроек')
    await page.getByLabel('Логин').fill('settings-admin')
    await page.getByLabel('Пароль').fill('12345Aa!')
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Сохранить' })
      .click()
    await expect.poll(() => administratorCreatePayload).toMatchObject({
      fullName: 'Администратор настроек',
      login: 'settings-admin',
      password: '12345Aa!',
      mustChangePassword: true,
      isActive: true,
    })
    await expect.poll(() => administratorCreatePayload?.role).toBeUndefined()
    await expect(page.getByTestId('administrator-card-administrator-created')).toBeVisible()
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
        await fulfillJson(route, 200, {
          groups: [toAttendanceGroupPayload(assignedAttendanceGroup)],
          today: todayIso(),
          maxTrainingDate: todayIso(),
        })
        return true
      }

      if (pathname.startsWith('/api/attendance/groups/') && pathname.endsWith('/clients') && method === 'GET') {
        await fulfillJson(route, 200, {
          groupId: 'group-coach',
          trainingDate: todayIso(),
          today: todayIso(),
          maxTrainingDate: todayIso(),
          clients: [
            {
              id: 'client-attendance-1',
              fullName: 'Тренируемый Клиент',
              state: 'Unmarked',
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
    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('attendance-screen')).toBeVisible()
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

      if (pathname === '/api/clients/expiring-memberships' && method === 'GET') {
        await fulfillJson(route, 200, {
          items: [toExpiringMembershipPayload(expiringClient)],
        })
        return true
      }

      return false
    })

    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Абонементы требуют внимания' }),
    ).toBeVisible()
    await expect(page.getByText('Иванов Иван Иванович')).toBeVisible()
    await expect(page.getByText('Осталось 3 дня')).toBeVisible()
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
            sources: ['Web'],
            messengerPlatforms: ['Telegram'],
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
                source: 'Web',
                messengerPlatform: 'Telegram',
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
      await expect(page.getByTestId('audit-screen')).toBeVisible()
      const auditGrid = page.getByTestId('audit-log-grid')
      await expect(auditGrid).toBeVisible()
      await expect(
        auditGrid.getByRole('columnheader', { name: 'Объект' }),
      ).toHaveCount(0)
      await expect(auditGrid.getByText('Объект', { exact: true })).toHaveCount(0)
      await expect(auditGrid.getByTestId('audit-log-actor-cell')).toContainText(
        'Главный тренер',
      )
      await expect(auditGrid).toContainText('Создан новый клиент')

      await auditGrid.getByTestId('audit-log-details-action').first().click()
      const detailsModal = page.getByTestId('audit-log-details-modal')
      await expect(detailsModal).toBeVisible()
      await expect(detailsModal).toContainText('Web')
      await expect(detailsModal.getByText('Старые значения')).toBeVisible()
      await expect(detailsModal.getByText('ID объекта: client-1')).toBeVisible()
      await expect(detailsModal.getByText('"status": "Active"')).toBeVisible()
    })
  }

  test('Фильтры аудита отправляют stable action/entity values', async ({
    page,
  }) => {
    const auditRequests: Array<Record<string, string>> = []

    await mockApi(page, async ({ pathname, method, route, searchParams }) => {
      if (pathname === '/api/auth/session' && method === 'GET') {
        await fulfillJson(route, 200, headCoachSession)
        return true
      }

      if (pathname === '/api/auth/login' && method === 'POST') {
        await fulfillJson(route, 200, headCoachSession)
        return true
      }

      if (pathname === '/api/audit-logs/options' && method === 'GET') {
        await fulfillJson(route, 200, {
          users: [],
          actionTypes: ['ClientCreated', 'AttendanceMarked'],
          entityTypes: ['Client', 'Attendance'],
          sources: [],
          messengerPlatforms: [],
        })
        return true
      }

      if (pathname === '/api/audit-logs' && method === 'GET') {
        auditRequests.push(Object.fromEntries(searchParams.entries()))

        await fulfillJson(route, 200, {
          items: [
            {
              id: 'audit-filtered-1',
              userName: 'Главный тренер',
              userLogin: BOOTSTRAP_LOGIN,
              userRole: 'HeadCoach',
              actionType: 'ClientCreated',
              entityType: 'Client',
              entityId: 'client-filtered-1',
              description: 'Фильтр применен по stable values',
              oldValueJson: null,
              newValueJson: { fullName: 'Фильтр Клиент' },
              createdAt: `${todayIso()}T11:10:10.000Z`,
            },
          ],
          totalCount: 1,
          skip: 0,
          take: 20,
          page: Number(searchParams.get('page') ?? 1),
          pageSize: 20,
          hasNextPage: false,
        })
        return true
      }

      return false
    })

    await page.goto('/audit')
    await expect(page.getByTestId('audit-screen')).toBeVisible()

    await page.getByRole('combobox', { name: 'Тип действия' }).click()
    await page.getByRole('option', { name: 'Создание клиента' }).click()
    await page.getByRole('button', { name: /Ещё фильтры/ }).click()
    await page.getByRole('combobox', { name: 'Тип объекта' }).click()
    await page.getByRole('option', { name: 'Клиент' }).click()

    await expect
      .poll(() =>
        auditRequests.some((request) =>
          hasRequestParams(request, {
            actionType: 'ClientCreated',
            entityType: 'Client',
          }),
        ),
      )
      .toBe(true)
    expect(
      auditRequests.some(
        (request) =>
          request.actionType === 'Создание клиента' ||
          request.entityType === 'Клиент',
      ),
    ).toBe(false)
    await expect(page.getByText('Фильтр применен по stable values')).toBeVisible()
  })

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
        await fulfillJson(route, 200, {
          groups: [toAttendanceGroupPayload(baseGroups[0])],
          today: todayIso(),
          maxTrainingDate: todayIso(),
        })
        return true
      }

      if (pathname.startsWith('/api/attendance/groups/') && pathname.endsWith('/clients') && method === 'GET') {
        const groupId = pathname.split('/')[3]
        await fulfillJson(route, 200, {
          groupId,
          trainingDate: todayIso(),
          today: todayIso(),
          maxTrainingDate: todayIso(),
          clients: [
            {
              id: 'client-attendance-1',
              fullName: 'Текущий клиент',
              state: 'Unmarked',
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

      if (pathname === '/api/schedule/groups' && method === 'GET') {
        await fulfillJson(route, 200, buildGroupsListPayload(baseGroups))
        return true
      }

      if (pathname === '/api/clients' && method === 'GET') {
        clientsCalls += 1
        const responsePayload = buildClientsListPayload([baseClient], baseGroups, searchParams)
        await fulfillJson(route, 200, responsePayload)
        return true
      }

      if (pathname === '/api/clients/client-1' && method === 'GET') {
        await fulfillJson(route, 200, toClientPayload(baseClient, baseGroups))
        return true
      }

      if (pathname === '/api/clients/expiring-memberships' && method === 'GET') {
        await fulfillJson(route, 200, {
          items: [toExpiringMembershipPayload(baseClient)],
        })
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

      for (const screen of SCREEN_CHECKS) {
        await page.goto(screen.path)
        if (screen.testId === 'home-screen') {
          await expect(page.getByTestId('home-screen')).toBeVisible()
          await expect(
            page.getByRole('heading', { name: 'Главная' }),
          ).toHaveCount(0)
        } else {
          await expect(page.getByTestId(screen.testId)).toBeVisible()
        }
        await expectActiveMainNavigation(page, width, screen.path)
        await expectNoHorizontalScroll(page)
      }
    }

    expect(groupsCalls).toBeGreaterThanOrEqual(1)
    expect(clientsCalls).toBeGreaterThanOrEqual(1)
    expect(auditCalls).toBeGreaterThanOrEqual(1)
  })
})

async function expectActiveMainNavigation(page: Page, width: number, path: string) {
  const sideNavigation = page.locator(SIDE_NAVIGATION_SELECTOR)
  const navLabel = getNavLabelByPath(path)

  if (width < MOBILE_MENU_BREAKPOINT) {
    await expect(sideNavigation).toBeHidden()
    await expect(
      page.getByRole('button', { name: 'Открыть основное меню' }),
    ).toHaveCount(0)

    const bottomNavigation = page.locator(MOBILE_BOTTOM_NAVIGATION_SELECTOR)
    const directButton = bottomNavigation.getByRole('button', { name: navLabel })

    await expect(bottomNavigation).toBeVisible()
    await expect(
      bottomNavigation.getByRole('button', { name: 'Уведомления' }),
    ).toHaveCount(0)

    if ((await directButton.count()) > 0) {
      await expect(directButton).toHaveAttribute('aria-current', 'page')
      return
    }

    const overflowButton = bottomNavigation.getByRole('button', {
      name: 'Открыть остальные разделы',
    })

    await expect(overflowButton).toHaveAttribute('aria-current', 'page')
    await overflowButton.click()

    const overflowList = page.locator('.mobile-bottom-nav__overflow-list')

    await expect(overflowList).toBeVisible()
    await expect(
      overflowList.getByRole('button', { name: navLabel }),
    ).toHaveAttribute('aria-current', 'page')
    await expect(
      overflowList.getByRole('button', { name: 'Уведомления' }),
    ).toHaveCount(0)

    await page.keyboard.press('Escape')
    await expect(overflowList).toBeHidden()
    return
  }

  await expect(sideNavigation).toBeVisible()
  await expect(sideNavigation).toHaveAttribute('data-orientation', 'vertical')
  await expect(
    page.getByRole('button', { name: 'Открыть основное меню' }),
  ).toHaveCount(0)
  await expect(page.locator(MOBILE_BOTTOM_NAVIGATION_SELECTOR)).toBeHidden()

  await expect(
    sideNavigation.getByRole('button', { name: navLabel }),
  ).toHaveAttribute('aria-current', 'page')

  const navbarBox = await page.locator('.app-shell__navbar').boundingBox()
  expect(navbarBox?.x).toBeLessThanOrEqual(1)

  if (width < 1200) {
    expect(navbarBox?.width).toBeLessThanOrEqual(230)
  } else {
    expect(navbarBox?.width).toBeGreaterThanOrEqual(220)
  }
}

function getNavLabelByPath(path: string) {
  switch (path) {
    case '/':
      return 'Главная'
    case '/schedule':
      return 'Расписание'
    case '/clients':
      return 'Клиенты'
    case '/groups':
      return 'Группы'
    case '/audit':
      return 'Журнал'
    case '/settings':
      return 'Настройки'
    default:
      return 'Главная'
  }
}

async function mockApi(
  page: Page,
  handler: (context: MockApiContext) => Promise<boolean>,
) {
  await page.route('**/api/**', async (route) => {
    const requestUrl = new URL(route.request().url())

    if (!requestUrl.pathname.startsWith('/api/')) {
      await route.continue()
      return
    }

    const method = route.request().method()
    const pathname = requestUrl.pathname

    if (pathname === '/api/config' && method === 'GET') {
      await fulfillJson(route, 200, APP_CONFIG)
      return
    }

    const handled = await handler({
      method,
      pathname,
      route,
      searchParams: requestUrl.searchParams,
    })

    if (!handled) {
      if (pathname === '/api/branches' && method === 'GET') {
        await fulfillJson(route, 200, [
          toBranchPayload(baseBranch),
          toBranchPayload(secondaryBranch),
        ])
        return
      }

      if (pathname === '/api/halls' && method === 'GET') {
        await fulfillJson(route, 200, [toHallPayload(baseHall)])
        return
      }

      if (pathname === '/api/group-types' && method === 'GET') {
        await fulfillJson(route, 200, [toGroupTypePayload(baseGroupType)])
        return
      }

      if (pathname === '/api/settings/administrators' && method === 'GET') {
        await fulfillJson(route, 200, [])
        return
      }

      if (
        /^\/api\/clients\/[^/]+\/messenger\/telegram$/.test(pathname) &&
        method === 'GET'
      ) {
        await fulfillJson(route, 200, {
          platform: 'Telegram',
          capabilities: {
            visible: false,
            canRead: false,
            canReply: false,
            canCreateLink: false,
            canShowQr: false,
          },
          connection: {
            status: 'NotConnected',
            linkedAt: null,
            telegramUsername: null,
            telegramDisplayName: null,
            pendingLinkExpiresAt: null,
          },
          unreadCount: 0,
          totalMessageCount: 0,
          latestMessageAt: null,
          latestMessage: null,
        })
        return
      }

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

function toBranchPayload(branch: BranchState) {
  const branchGroups = baseGroups.filter((group) => group.branchId === branch.id)

  return {
    id: branch.id,
    name: branch.name,
    address: branch.address,
    description: branch.description,
    isArchived: branch.isArchived,
    hallCount: branch.id === baseBranch.id ? 1 : 0,
    groupCount: branchGroups.length,
    clientCount: branch.id === baseBranch.id ? 1 : 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function toHallPayload(hall: HallState) {
  return {
    id: hall.id,
    branchId: hall.branchId,
    branchName: hall.branchName,
    name: hall.name,
    description: hall.description,
    isArchived: hall.isArchived,
    groupCount: hall.groupCount,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function toGroupTypePayload(groupType: GroupTypeState) {
  return {
    id: groupType.id,
    name: groupType.name,
    description: groupType.description,
    groupCount: groupType.groupCount,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
    durationMinutes: group.durationMinutes,
    weekdays: group.weekdays,
    clientCount: group.clientCount,
  }
}

function buildClientsListPayload(
  clients: ClientState[],
  groups: GroupState[],
  searchParams?: URLSearchParams,
  options: { totalCount?: number } = {},
) {
  const items = clients.map((client) => toClientPayload(client, groups))
  const page = Number(searchParams?.get('page') ?? 1)
  const pageSize = Number(searchParams?.get('pageSize') ?? 20)
  const skip = (page - 1) * pageSize
  const totalCount = options.totalCount ?? (searchParams ? items.length : clients.length)

  return {
    items,
    totalCount,
    activeCount: items.filter((client) => client.status === 'Active').length,
    archivedCount: items.filter((client) => client.status === 'Archived').length,
    skip,
    take: pageSize,
    page,
    pageSize,
    hasNextPage: skip + items.length < totalCount,
  }
}

function toClientPayload(client: ClientState, groups: GroupState[]) {
  const assignedGroups = groups.filter((group) => client.groupIds.includes(group.id))
  const membershipType = client.membershipType
  const isProfessional = client.isProfessional ?? false
  const currentMembershipIsPaid =
    client.currentMembershipIsPaid ?? client.hasActivePaidMembership
  const membershipState = isProfessional
    ? 'ActivePaid'
    : !membershipType
      ? 'None'
      : client.hasUnpaidCurrentMembership
        ? 'Unpaid'
        : client.hasActivePaidMembership
          ? 'ActivePaid'
          : 'Expired'

  return {
    id: client.id,
    lastName: client.lastName,
    firstName: client.firstName,
    middleName: client.middleName,
    fullName: `${client.lastName} ${client.firstName} ${client.middleName}`,
    phone: client.phone,
    branchId: client.branchId,
    branchName: client.branchName,
    notes: client.notes,
    status: client.status ?? 'Active',
    contactCount: client.contacts.length,
    groupCount: assignedGroups.length,
    groups: assignedGroups.map((group) => ({
      id: group.id,
      name: group.name,
      branchId: group.branchId,
      branchName: group.branchName,
      hallId: group.hallId,
      hallName: group.hallName,
      isActive: group.isActive,
      trainingStartTime: group.trainingStartTime,
      durationMinutes: group.durationMinutes,
      weekdays: group.weekdays,
    })),
    contacts: client.contacts,
    groupIds: client.groupIds,
    photo: null,
    isProfessional,
    professionalComment: client.professionalComment ?? null,
    hasActivePaidMembership: client.hasActivePaidMembership,
    hasUnpaidCurrentMembership: client.hasUnpaidCurrentMembership,
    membershipWarning: client.membershipWarning,
    hasCurrentMembership: Boolean(membershipType),
    membershipState,
    lastVisitDate: addIsoDays(todayIso(), -1),
    currentMembershipSummary: membershipType
      ? {
          id: `${client.id}-m1`,
          membershipType,
          purchaseDate: addIsoDays(todayIso(), -20),
          expirationDate: client.expirationDate,
          isPaid: currentMembershipIsPaid,
          singleVisitUsed: false,
        }
      : null,
    currentMembership: membershipType
      ? {
          id: `${client.id}-m1`,
          membershipType,
          purchaseDate: addIsoDays(todayIso(), -20),
          expirationDate: client.expirationDate,
          paymentAmount: 4000,
          isPaid: currentMembershipIsPaid,
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
            isPaid: currentMembershipIsPaid,
            singleVisitUsed: false,
          },
        ]
      : [],
    attendanceHistory: [],
    attendanceHistoryTotalCount: 0,
  }
}

function toExpiringMembershipPayload(client: ClientState) {
  return {
    clientId: client.id,
    fullName: `${client.lastName} ${client.firstName} ${client.middleName}`,
    membershipType: client.membershipType ?? 'Monthly',
    expirationDate: client.expirationDate,
    daysUntilExpiration: Math.max(
      0,
      Math.round(
        (new Date(`${client.expirationDate}T00:00:00.000Z`).getTime() -
          new Date(`${todayIso()}T00:00:00.000Z`).getTime()) /
          86_400_000,
      ),
    ),
    isPaid: client.hasActivePaidMembership,
    state: 'ExpiringSoon',
  }
}

function hasRequestParams(
  actual: Record<string, string>,
  expected: Record<string, string>,
) {
  return Object.entries(expected).every(
    ([key, value]) => actual[key] === value,
  )
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
