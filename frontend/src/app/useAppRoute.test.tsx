import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { AuthenticatedUser, SessionResponse } from '../lib/api'
import { parseRoute, resolveRouteAccess } from '../lib/appRoutes'
import {
  getAppDocumentTitle,
  getPostPasswordReturnDecision,
  stripAppReturnSnapshotsFromHistoryState,
  useAppDocumentTitle,
  useAppRoute,
} from './useAppRoute'

const baseUser: AuthenticatedUser = {
  attendanceScope: { kind: 'Global', groupIds: [] },
  allowedSections: ['Attendance', 'Attention', 'Schedule', 'Clients', 'Groups', 'Users'],
  assignedGroupIds: [],
  branchId: null,
  id: 'headcoach-id',
  isActive: true,
  landingScreen: 'Attention',
  login: 'headcoach',
  mustChangePassword: false,
  fullName: 'Главный тренер',
  permissions: {
    canManageClients: true,
    canManageGroups: true,
    canManageSettings: false,
    canMarkAttendance: true,
    canViewAuditLog: false,
    canViewFinancialReports: false,
    canManageUsers: true,
  },
  role: 'HeadCoach',
}

const coachUser: AuthenticatedUser = {
  ...baseUser,
  allowedSections: ['Attendance', 'Schedule', 'Clients'],
  id: 'coach-id',
  permissions: {
    ...baseUser.permissions,
    canManageClients: false,
    canManageGroups: false,
    canManageUsers: false,
  },
  role: 'Coach',
}

function authenticatedSession(user: AuthenticatedUser): SessionResponse {
  return {
    bootstrapMode: false,
    csrfToken: `${user.id}-csrf`,
    isAuthenticated: true,
    user,
  }
}

beforeEach(() => {
  window.history.replaceState({}, '', '/')
  window.scrollTo = vi.fn()
})

describe('useAppRoute', () => {
  test('parses the direct deep link before any navigation occurs', () => {
    window.history.replaceState({}, '', '/clients/client-42/edit')

    const { result } = renderHook(() => useAppRoute())

    expect(result.current.pathname).toBe('/clients/client-42/edit')
    expect(result.current.route).toEqual({
      kind: 'clientEdit',
      clientId: 'client-42',
    })
  })

  test('pushes a typed route and strips app return snapshots by default', () => {
    window.history.replaceState({
      crmClientListReturnState: { version: 1 },
      crmClientProfileReturnContext: { version: 1 },
      crmGroupListReturnState: { version: 1 },
      crmScheduleReturnState: { version: 1 },
      retained: 'keep',
    }, '', '/clients')

    const { result } = renderHook(() => useAppRoute())

    act(() => result.current.navigate({ kind: 'section', section: 'Groups' }))

    expect(window.location.pathname).toBe('/groups')
    expect(result.current.route).toEqual({ kind: 'section', section: 'Groups' })
    expect(window.history.state).toEqual({ retained: 'keep' })
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 })
  })

  test('replaces with explicit state and keeps the provided payload unchanged', () => {
    const { result } = renderHook(() => useAppRoute())

    act(() =>
      result.current.navigate('/coaches/trainer-1/edit', {
        replace: true,
        state: { focusedUserId: 'trainer-1' },
      }),
    )

    expect(window.location.pathname).toBe('/coaches/trainer-1/edit')
    expect(window.history.state).toEqual({ focusedUserId: 'trainer-1' })
    expect(result.current.route).toEqual({
      kind: 'userEdit',
      userId: 'trainer-1',
    })
  })

  test('leaves history state untouched for same-path navigation', () => {
    window.history.replaceState({ retained: 'same-path' }, '', '/groups')
    const { result } = renderHook(() => useAppRoute())

    act(() =>
      result.current.navigate({ kind: 'section', section: 'Groups' }, {
        state: { shouldNotReplace: true },
      }),
    )

    expect(window.location.pathname).toBe('/groups')
    expect(window.history.state).toEqual({ retained: 'same-path' })
    expect(window.scrollTo).not.toHaveBeenCalled()
  })

  test('updates the parsed route from browser popstate', () => {
    const { result } = renderHook(() => useAppRoute())

    window.history.pushState({}, '', '/clients/client-7')
    act(() => window.dispatchEvent(new PopStateEvent('popstate')))

    expect(result.current.pathname).toBe('/clients/client-7')
    expect(result.current.route).toEqual({
      kind: 'clientDetails',
      clientId: 'client-7',
    })
  })

  test('keeps query state in route parsing and browser popstate', () => {
    window.history.replaceState({}, '', '/schedule?date=2026-08-20&view=week')
    const { result } = renderHook(() => useAppRoute())

    expect(result.current.pathname).toBe('/schedule?date=2026-08-20&view=week')
    expect(result.current.route).toEqual({ kind: 'section', section: 'Schedule' })

    window.history.pushState({}, '', '/attendance/lesson-1?lessonDate=2026-08-20')
    act(() => window.dispatchEvent(new PopStateEvent('popstate')))

    expect(result.current.pathname).toBe('/attendance/lesson-1?lessonDate=2026-08-20')
    expect(result.current.route).toEqual({
      kind: 'attendanceLesson',
      lessonOccurrenceId: 'lesson-1',
      lessonDate: '2026-08-20',
    })
  })

  test('clears return snapshots from the current entry through the routing owner', () => {
    window.history.replaceState({
      crmClientListReturnState: { version: 1 },
      crmClientProfileReturnContext: { version: 1 },
      crmGroupListReturnState: { version: 1 },
      crmScheduleReturnState: { version: 1 },
      retained: 'keep',
    }, '', '/clients/client-7')
    const { result } = renderHook(() => useAppRoute())

    act(() => result.current.clearCurrentReturnSnapshots())

    expect(window.location.pathname).toBe('/clients/client-7')
    expect(window.history.state).toEqual({ retained: 'keep' })
    expect(result.current.route).toEqual({
      kind: 'clientDetails',
      clientId: 'client-7',
    })
  })
})

describe('app route helpers', () => {
  test('strips every app-owned return snapshot while preserving foreign state', () => {
    expect(stripAppReturnSnapshotsFromHistoryState({
      crmClientListReturnState: { version: 1 },
      crmClientProfileReturnContext: { version: 1 },
      crmGroupListReturnState: { version: 1 },
      crmScheduleReturnState: { version: 1 },
      retained: 'keep',
    })).toEqual({ retained: 'keep' })
  })

  test('keeps document titles aligned with auth stages and route access state', () => {
    const session = authenticatedSession(baseUser)
    const unauthenticatedSession: SessionResponse = {
      bootstrapMode: false,
      csrfToken: '',
      isAuthenticated: false,
      user: null,
    }
    const forcedPasswordSession = authenticatedSession({
      ...baseUser,
      mustChangePassword: true,
    })

    expect(getAppDocumentTitle(
      'Gym CRM',
      parseRoute('/clients'),
      null,
      null,
      true,
      null,
    )).toBe('Открываем Gym CRM')

    expect(getAppDocumentTitle(
      'Gym CRM',
      parseRoute('/clients'),
      null,
      null,
      false,
      'Network unavailable',
    )).toBe('Вход недоступен • Gym CRM')

    expect(getAppDocumentTitle(
      'Gym CRM',
      parseRoute('/clients'),
      null,
      unauthenticatedSession,
      false,
      null,
    )).toBe('Войти в Gym CRM')

    expect(getAppDocumentTitle(
      'Gym CRM',
      parseRoute('/clients'),
      null,
      forcedPasswordSession,
      false,
      null,
    )).toBe('Смените пароль • Gym CRM')

    expect(getAppDocumentTitle(
      'Gym CRM',
      parseRoute('/clients'),
      resolveRouteAccess(baseUser, parseRoute('/clients')),
      session,
      false,
      null,
    )).toBe('Клиенты • Gym CRM')

    expect(getAppDocumentTitle(
      'Gym CRM',
      parseRoute('/clients/new'),
      resolveRouteAccess(coachUser, parseRoute('/clients/new')),
      authenticatedSession(coachUser),
      false,
      null,
    )).toBe('Новый клиент — нет доступа • Gym CRM')

    expect(getAppDocumentTitle(
      'Gym CRM',
      parseRoute('/missing'),
      resolveRouteAccess(baseUser, parseRoute('/missing')),
      session,
      false,
      null,
    )).toBe('Страница не найдена • Gym CRM')

    expect(getAppDocumentTitle(
      'Gym CRM',
      parseRoute('/password'),
      resolveRouteAccess(baseUser, parseRoute('/password')),
      session,
      false,
      null,
    )).toBe('Смена пароля • Gym CRM')
  })

  test('synchronizes the document title through the routing module hook', () => {
    const session = authenticatedSession(baseUser)
    const route = parseRoute('/clients')

    renderHook(() => useAppDocumentTitle({
      bootstrapError: null,
      clubName: 'Gym CRM',
      loadingSession: false,
      route,
      routeAccess: resolveRouteAccess(baseUser, route),
      session,
    }))

    expect(document.title).toBe('Клиенты • Gym CRM')
  })

  test('recovers a password return when the saved allowed route is now restricted', () => {
    const savedAccess = resolveRouteAccess(baseUser, parseRoute('/coaches/trainer-1/edit'))

    expect(getPostPasswordReturnDecision(coachUser, {
      access: savedAccess,
      path: '/coaches/trainer-1/edit',
    })).toMatchObject({
      path: '/attendance',
      recoveryEvent: {
        kind: 'restricted',
        requestedPath: '/coaches/trainer-1/edit',
      },
    })
  })
})
