import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { AuthenticatedUser, SessionResponse } from '../lib/api'
import { parseRoute, resolveRouteAccess } from '../lib/appRoutes'
import {
  getAppDocumentTitle,
  getPostPasswordReturnDecision,
  stripAppReturnSnapshotsFromHistoryState,
  useAppRoute,
} from './useAppRoute'

const baseUser: AuthenticatedUser = {
  attendanceScope: { kind: 'Global', groupIds: [] },
  allowedSections: ['Home', 'Schedule', 'Clients', 'Groups', 'Users'],
  assignedGroupIds: [],
  branchId: null,
  id: 'headcoach-id',
  isActive: true,
  landingScreen: 'Home',
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
  allowedSections: ['Home', 'Schedule', 'Clients'],
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
      result.current.navigate('/users/trainer-1/edit', {
        replace: true,
        state: { focusedUserId: 'trainer-1' },
      }),
    )

    expect(window.location.pathname).toBe('/users/trainer-1/edit')
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
})

describe('app route helpers', () => {
  test('strips every app-owned return snapshot while preserving foreign state', () => {
    expect(stripAppReturnSnapshotsFromHistoryState({
      crmClientListReturnState: { version: 1 },
      crmClientProfileReturnContext: { version: 1 },
      crmGroupListReturnState: { version: 1 },
      retained: 'keep',
    })).toEqual({ retained: 'keep' })
  })

  test('keeps document titles aligned with session and route access state', () => {
    const session = authenticatedSession(baseUser)

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
  })

  test('recovers a password return when the saved allowed route is now restricted', () => {
    const savedAccess = resolveRouteAccess(baseUser, parseRoute('/users/trainer-1/edit'))

    expect(getPostPasswordReturnDecision(coachUser, {
      access: savedAccess,
      path: '/users/trainer-1/edit',
    })).toMatchObject({
      path: '/',
      recoveryEvent: {
        kind: 'restricted',
        requestedPath: '/users/trainer-1/edit',
      },
    })
  })
})
