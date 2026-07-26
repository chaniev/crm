import { afterEach, describe, expect, test, vi } from 'vitest'
import { getUser, getUsers } from './users'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('users API', () => {
  test('maps coach list envelope and fixed create options', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
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
      ),
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
  })

  test('preserves target roleOptions from user payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
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
      ),
    )

    await expect(getUser('coach-1')).resolves.toEqual(
      expect.objectContaining({
        role: 'Coach',
        allowedActions: ['Edit'],
        roleOptions: ['Coach'],
      }),
    )
  })
})

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
