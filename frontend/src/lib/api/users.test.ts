import { afterEach, describe, expect, test, vi } from 'vitest'
import { getUser, getUsers } from './users'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('users API', () => {
  test('maps SuperAdministrator staff actions and nullable branch from list envelope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      items: [
        {
          id: 'superadmin-1',
          fullName: 'Суперадминистратор',
          login: 'superadmin',
          role: 'SuperAdministrator',
          mustChangePassword: false,
          isActive: true,
          branchId: null,
          branchName: null,
          allowedActions: [],
        },
      ],
      createRoleOptions: ['Coach', 'SuperAdministrator'],
    })))

    await expect(getUsers()).resolves.toEqual({
      items: [
        expect.objectContaining({
          id: 'superadmin-1',
          role: 'SuperAdministrator',
          branchId: null,
          allowedActions: [],
        }),
      ],
      createRoleOptions: ['Coach', 'SuperAdministrator'],
    })
  })

  test('maps target-specific edit role options without inventing forbidden transitions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      id: 'superadmin-1',
      fullName: 'Суперадминистратор',
      login: 'superadmin',
      role: 'SuperAdministrator',
      mustChangePassword: false,
      isActive: true,
      branchId: null,
      allowedActions: ['Edit'],
      roleOptions: ['SuperAdministrator'],
    })))

    await expect(getUser('superadmin-1')).resolves.toEqual(expect.objectContaining({
      role: 'SuperAdministrator',
      allowedActions: ['Edit'],
      roleOptions: ['SuperAdministrator'],
    }))
  })
})

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
