import { afterEach, describe, expect, test, vi } from 'vitest'
import { createUser, getUser, getUsers, updateUser } from './users'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('users API', () => {
  test('maps coach list envelope and fixed create options', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [
          {
            id: 'coach-1',
            fullName: 'Тренер',
            login: 'coach',
            role: 'Coach',
            mustChangePassword: false,
            isActive: true,
            branchId: null,
            branchName: null,
            allowedActions: ['Edit'],
          },
        ],
        createRoleOptions: ['Coach'],
      }),
    )
    vi.stubGlobal(
      'fetch',
      fetchMock,
    )

    await expect(getUsers()).resolves.toEqual({
      items: [
        expect.objectContaining({
          id: 'coach-1',
          role: 'Coach',
          branchId: null,
          allowedActions: ['Edit'],
        }),
      ],
      createRoleOptions: ['Coach'],
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/coaches',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  test('preserves target roleOptions from user payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 'coach-1',
        fullName: 'Тренер',
        login: 'coach',
        role: 'Coach',
        mustChangePassword: false,
        isActive: true,
        branchId: null,
        allowedActions: ['Edit'],
        roleOptions: ['Coach'],
      }),
    )
    vi.stubGlobal(
      'fetch',
      fetchMock,
    )

    await expect(getUser('coach-1')).resolves.toEqual(
      expect.objectContaining({
        role: 'Coach',
        allowedActions: ['Edit'],
        roleOptions: ['Coach'],
      }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/coaches/coach-1',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  test('posts and updates only through canonical coaches API paths', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({
      id: 'coach-1',
      fullName: 'Тренер',
      login: 'coach',
      role: 'Coach',
      mustChangePassword: false,
      isActive: true,
      branchId: null,
      allowedActions: ['Edit'],
      roleOptions: ['Coach'],
    })))
    vi.stubGlobal('fetch', fetchMock)

    const sharedPayload = {
      fullName: 'Тренер',
      login: 'coach',
      role: 'Coach' as const,
      branchId: null,
      mustChangePassword: false,
      isActive: true,
      messengerPlatform: null,
      messengerPlatformUserId: null,
    }

    await createUser({ ...sharedPayload, password: 'secret' })
    await updateUser('coach-1', sharedPayload)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/coaches',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/coaches/coach-1',
      expect.objectContaining({ method: 'PUT' }),
    )
    expect(fetchMock.mock.calls.flatMap(([url]) => [url])).not.toContain('/api/users')
  })
})

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
