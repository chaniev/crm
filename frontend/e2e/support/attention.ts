import type { BrowserContext, Page, Route } from '@playwright/test'

const APP_CONFIG = {
  clubName: 'Iron Club',
  themeId: 'default-green-v1',
  authBackgroundImageId: 'k4pro-login-v1',
} as const

export const HEAD_COACH_SESSION = {
  isAuthenticated: true,
  csrfToken: 'attention-csrf-token',
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
    assignedGroupIds: ['group-1'],
    attendanceScope: { kind: 'Global', groupIds: [] },
  },
} as const

type MockAttentionApiOptions = {
  themeId?: string
  attentionItems?: unknown
  onAttentionItems?: (route: Route) => Promise<void>
  onAttendanceGroups?: (route: Route) => Promise<void>
}

export async function mockAttentionApi(page: Page | BrowserContext, options: MockAttentionApiOptions) {
  await page.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url())
    const { pathname } = requestUrl
    const method = route.request().method()

    if (!pathname.startsWith('/api/') && !pathname.startsWith('/auth/') && !pathname.startsWith('/clients/')) {
      await route.continue()
      return
    }

    if ((pathname === '/api/auth/session' || pathname === '/auth/session') && method === 'GET') {
      await fulfillJson(route, 200, HEAD_COACH_SESSION)
      return
    }

    if ((pathname === '/api/config' || pathname === '/config') && method === 'GET') {
      await fulfillJson(route, 200, { ...APP_CONFIG, themeId: options.themeId ?? APP_CONFIG.themeId })
      return
    }

    if (
      (pathname === '/api/clients/attention' ||
        pathname === '/clients/attention') &&
      method === 'GET'
    ) {
      if (options.onAttentionItems) {
        await options.onAttentionItems(route)
        return
      }

      await fulfillJson(route, 200, options.attentionItems ?? [])
      return
    }

    if (
      (pathname === '/api/attendance/groups' ||
        pathname === '/attendance/groups') &&
      method === 'GET'
    ) {
      if (options.onAttendanceGroups) {
        await options.onAttendanceGroups(route)
        return
      }

      await fulfillJson(route, 500, { title: 'Attendance must not load in Attention' })
      return
    }

    await fulfillJson(route, 404, { title: `Unhandled ${method} ${pathname}` })
  })
}

export function membershipReason(index = 1) {
  return {
    type: 'expiringMembership',
    membershipId: `membership-${index}`,
    saleId: `sale-${index}`,
    behaviorKind: 'Term',
    membershipName: 'Месяц',
    expirationDate: '2026-07-21',
    daysUntilExpiration: 1,
    targetGroups: [{ groupId: 'group-1', groupName: 'Самбо', branchName: 'Центр' }],
  }
}

export function attentionCard(index = 1) {
  return {
    clientId: `client-${index}`,
    fullName: index === 1 ? 'Иван Иванов' : `Клиент внимания ${index}`,
    phone: `+7999000000${index}`,
    notes: index === 1 ? 'Позвонить вечером' : `Комментарий клиента ${index}`,
    telegramLink: `https://t.me/client${index}`,
    reasons: [
      { type: 'missedTraining', missedCount: 4 },
      membershipReason(index),
    ],
  }
}

export async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}
