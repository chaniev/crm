import { fireEvent, screen, waitFor } from '@testing-library/react'
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { StrictMode } from 'react'
import {
  ConfigThemeBootstrap,
  type AuthBackgroundPreloader,
} from './ConfigThemeBootstrap'
import { createConfigThemeBootstrapResource } from './configThemeResource'
import { loadAppConfig, loadSession, type SessionResponse } from '../lib/api'

vi.mock('../features/users/UserManagement', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../features/users/UserManagement')>()

  return {
    ...actual,
    UserEditScreen: ({ onRefreshSession }: { onRefreshSession: () => Promise<SessionResponse> }) => (
      <button type="button" onClick={() => {
        void onRefreshSession()
      }}>
        Обновить сессию
      </button>
    ),
  }
})

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()

  return {
    ...actual,
    loadAppConfig: vi.fn(),
    loadSession: vi.fn(),
    login: vi.fn(),
    changePassword: vi.fn(),
  }
})

const loadAppConfigMock = vi.mocked(loadAppConfig)
const loadSessionMock = vi.mocked(loadSession)

function createDeferred<T>() {
  let resolve!: (value: T) => void

  const promise = new Promise<T>((res) => {
    resolve = res
  })

  return { promise, resolve }
}

type RenderAppOptions = {
  preloadAuthBackground?: AuthBackgroundPreloader
  resourceOptions?: Parameters<typeof createConfigThemeBootstrapResource>[0]
}

function renderApp(options: RenderAppOptions = {}) {
  const resource = createConfigThemeBootstrapResource(options.resourceOptions)

  return render(
    <StrictMode>
      <ConfigThemeBootstrap
        preloadAuthBackground={options.preloadAuthBackground}
        resource={resource}
      />
    </StrictMode>,
  )
}

const unresolvedSession = {
  isAuthenticated: false,
  csrfToken: '',
  user: null,
  bootstrapMode: false,
} satisfies SessionResponse

const authenticatedSession = {
  isAuthenticated: true,
  csrfToken: 'csrf',
  bootstrapMode: false,
  user: {
    id: 'admin-id',
    fullName: 'Администратор',
    login: 'admin',
    role: 'Administrator',
    mustChangePassword: false,
    isActive: true,
    landingScreen: 'Home',
    allowedSections: ['Home', 'Clients', 'Users'],
    permissions: {
      canManageUsers: true,
      canManageClients: true,
      canManageGroups: false,
      canManageSettings: false,
      canMarkAttendance: true,
      canViewAuditLog: true,
      canViewFinancialReports: true,
    },
    assignedGroupIds: [],
    attendanceScope: {
      kind: 'Global',
      groupIds: [],
    },
    branchId: null,
  },
} satisfies SessionResponse

const mustChangeSession = {
  ...authenticatedSession,
  user: {
    ...authenticatedSession.user,
    mustChangePassword: true,
  },
} satisfies SessionResponse

const configContract = {
  clubName: 'K-4PRO',
  themeId: 'default-green-v1',
  authBackgroundImageId: 'k4pro-login-v1',
}

describe('Slice B auth/bootstrap bootstrap behavior', () => {
  beforeEach(() => {
    loadAppConfigMock.mockReset()
    loadSessionMock.mockReset()
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('one actual /api/config fetch happens on initial StrictMode bootstrap', async () => {
    loadAppConfigMock.mockResolvedValue(configContract)
    loadSessionMock.mockResolvedValue(unresolvedSession)

    renderApp()

    expect(await screen.findByRole('heading', { name: 'Добро пожаловать!' })).toBeVisible()

    expect(loadAppConfigMock).toHaveBeenCalledTimes(1)
    expect(loadSessionMock).toHaveBeenCalledTimes(2)
    expect(loadAppConfigMock).toHaveBeenCalledWith(expect.any(AbortSignal))
    expect(loadSessionMock).toHaveBeenCalledWith(expect.any(AbortSignal))
  })

  test('does not auto-retry config; a new bootstrap resource is a separate attempt', async () => {
    loadAppConfigMock
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(configContract)
    loadSessionMock
      .mockResolvedValueOnce(unresolvedSession)
      .mockResolvedValueOnce(unresolvedSession)

    const firstView = renderApp()

    expect(await screen.findByRole('heading', { name: 'Добро пожаловать!' })).toBeVisible()
    expect(loadAppConfigMock).toHaveBeenCalledTimes(1)
    expect(loadSessionMock).toHaveBeenCalledTimes(2)

    firstView.unmount()
    renderApp()

    expect(await screen.findByRole('heading', { name: 'Добро пожаловать!' })).toBeVisible()

    expect(loadAppConfigMock).toHaveBeenCalledTimes(2)
    expect(loadSessionMock).toHaveBeenCalledTimes(4)
  })

  test('session refresh does not refetch /api/config', async () => {
    window.history.replaceState({}, '', '/users/1/edit')

    loadAppConfigMock.mockResolvedValue(configContract)
    loadSessionMock.mockResolvedValue(authenticatedSession)

    renderApp()

    const refreshButton = await screen.findByRole('button', { name: 'Обновить сессию' })
    const sessionCallsBeforeRefresh = loadSessionMock.mock.calls.length

    fireEvent.click(refreshButton)

    await waitFor(() => {
      expect(loadSessionMock).toHaveBeenCalledTimes(sessionCallsBeforeRefresh + 1)
    })

    expect(loadAppConfigMock).toHaveBeenCalledTimes(1)
    expect(refreshButton).toBeInTheDocument()
  })

  test('/api/config transport failure falls back to defaults and does not block login', async () => {
    loadAppConfigMock.mockRejectedValue(new Error('Сеть недоступна'))
    loadSessionMock.mockResolvedValue(unresolvedSession)

    renderApp()

    expect(await screen.findByRole('heading', { name: 'Добро пожаловать!' })).toBeVisible()
    expect(screen.queryByText('Не удалось открыть экран входа')).not.toBeInTheDocument()
    expect(loadAppConfigMock).toHaveBeenCalledTimes(1)
    expect(loadSessionMock).toHaveBeenCalledTimes(2)
  })

  test('/api/config timeout falls back to defaults and does not block login', async () => {
    vi.useFakeTimers()

    loadAppConfigMock.mockReturnValue(new Promise(() => undefined))
    loadSessionMock.mockResolvedValue(unresolvedSession)

    renderApp({ resourceOptions: { timeoutMs: 1 } })

    expect(screen.getByText('Открываем CRM')).toBeVisible()

    await vi.advanceTimersByTimeAsync(1)
    vi.useRealTimers()

    expect(await screen.findByRole('heading', { name: 'Добро пожаловать!' })).toBeVisible()
    expect(loadAppConfigMock).toHaveBeenCalledTimes(1)
    expect(loadSessionMock).toHaveBeenCalledTimes(2)
  })

  test('broken resolved auth background falls back to solid auth surface without blocking login', async () => {
    loadAppConfigMock.mockResolvedValue(configContract)
    loadSessionMock.mockResolvedValue(unresolvedSession)

    renderApp({
      preloadAuthBackground: vi.fn().mockRejectedValue(new Error('decode failed')),
    })

    expect(await screen.findByRole('heading', { name: 'Добро пожаловать!' })).toBeVisible()

    await waitFor(() => {
      expect(document.querySelector('.gym-crm-page--auth-solid')).toBeTruthy()
    })
  })

  test('keeps all auth-facing states inside auth stage shell while backgrounds resolve', async () => {
    const configDeferred = createDeferred<typeof configContract>()
    const sessionDeferred = createDeferred<typeof unresolvedSession>()

    loadAppConfigMock.mockReturnValue(configDeferred.promise)
    loadSessionMock.mockReturnValue(sessionDeferred.promise)

    renderApp()

    expect(await screen.findByText('Открываем CRM')).toBeVisible()
    expect(document.querySelector('.gym-crm-page--auth')).toBeTruthy()

    configDeferred.resolve(configContract)
    sessionDeferred.resolve(unresolvedSession)

    expect(await screen.findByRole('heading', { name: 'Добро пожаловать!' })).toBeVisible()
    expect(document.querySelector('.gym-crm-page--auth')).toBeTruthy()

    loadAppConfigMock.mockResolvedValue(configContract)
    loadSessionMock.mockResolvedValue(mustChangeSession)

    window.history.replaceState({}, '', '/')
    renderApp()

    expect(await screen.findByRole('heading', { name: 'Смените пароль' })).toBeVisible()
    expect(document.querySelector('.gym-crm-page--auth')).toBeTruthy()
  })

  test('pending bootstrap renders only auth shell and no meaningful app content', async () => {
    const configDeferred = createDeferred<typeof configContract>()
    const sessionDeferred = createDeferred<typeof unresolvedSession>()

    loadAppConfigMock.mockReturnValue(configDeferred.promise)
    loadSessionMock.mockReturnValue(sessionDeferred.promise)

    renderApp()

    expect(screen.getByText('Открываем CRM')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Добро пожаловать!' })).not.toBeInTheDocument()
    const pendingAuthShell = document.querySelector('.gym-crm-page--auth')
    expect(pendingAuthShell).toBeTruthy()
    expect(pendingAuthShell?.className).toContain('gym-crm-page--auth-image')

    const pendingStyle = window.getComputedStyle(pendingAuthShell as Element)
    expect(pendingStyle.getPropertyValue('--crm-auth-background-position').trim()).toBe('64% 50%')
    expect(pendingStyle.getPropertyValue('--crm-auth-background-image')).toContain('k4pro-login-bg.png')

    configDeferred.resolve(configContract)

    expect(await screen.findByText('Открываем K-4PRO')).toBeVisible()
    expect(document.querySelector('.loading-card')).toBeTruthy()

    const authShell = document.querySelector('.gym-crm-page--auth')
    expect(authShell).toBeTruthy()
    expect(authShell?.className).toContain('gym-crm-page--auth-image')

    const style = window.getComputedStyle(authShell as Element)
    expect(style.getPropertyValue('--crm-auth-background-position').trim()).toBe('64% 50%')
    expect(style.getPropertyValue('--crm-auth-background-image')).toContain('k4pro-login-bg.png')

    sessionDeferred.resolve(unresolvedSession)

    expect(await screen.findByRole('heading', { name: 'Добро пожаловать!' })).toBeVisible()
  })
})
