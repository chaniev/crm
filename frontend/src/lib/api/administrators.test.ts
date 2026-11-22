import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  resetAdministratorPassword,
  createAdministrator,
  getAdministratorAttendanceScope,
  getAdministrators,
  replaceAdministratorAttendanceScope,
  updateAdministrator,
} from './administrators'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('administrators API', () => {
  test('posts a temporary password verbatim without profile fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await resetAdministratorPassword('staff-id', '  example  ')
    expect(fetchMock).toHaveBeenCalledWith('/api/settings/administrators/staff-id/reset-password',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ temporaryPassword: '  example  ' }) }))
  })

  test('maps mixed administrative roles, nullable scope and backend actions/options', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      items: [
        {
          id: 'administrator-1',
          fullName: 'Администратор',
          login: 'admin',
          role: 'Administrator',
          isActive: true,
          mustChangePassword: false,
          branchId: 'branch-1',
          branchName: 'Центр',
          attendanceGroupGrantCount: 2,
          allowedActions: ['Edit', 'ManageAttendanceScope', 'ResetPassword'],
          passwordResetPending: true,
          roleOptions: ['Administrator', 'SuperAdministrator'],
        },
        {
          id: 'superadministrator-1',
          fullName: 'Суперадминистратор',
          login: 'superadmin',
          role: 'SuperAdministrator',
          isActive: true,
          mustChangePassword: false,
          branchId: null,
          branchName: null,
          allowedActions: [],
          roleOptions: ['SuperAdministrator'],
        },
      ],
      createRoleOptions: ['Administrator', 'SuperAdministrator'],
    })))

    await expect(getAdministrators()).resolves.toEqual({
      items: [
        expect.objectContaining({
          role: 'Administrator',
          branchId: 'branch-1',
          allowedActions: ['Edit', 'ManageAttendanceScope', 'ResetPassword'],
          passwordResetPending: true,
          roleOptions: ['Administrator', 'SuperAdministrator'],
        }),
        expect.objectContaining({
          role: 'SuperAdministrator',
          branchId: null,
          allowedActions: [],
          roleOptions: ['SuperAdministrator'],
        }),
      ],
      createRoleOptions: ['Administrator', 'SuperAdministrator'],
    })
  })

  test.each([
    [{ BranchId: 'b', BranchName: 'Центр' }, 'b', 'Центр'],
    [{ branchId: null, branchName: null }, null, null],
    [{}, undefined, undefined],
    [{ BranchId: null }, null, undefined],
    [{ branchId: 'b', branchName: '   ' }, 'b', undefined],
  ] as const)('preserves branch fields from %o', async (fields, branchId, branchName) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ items: [fields] })))
    const { items } = await getAdministrators()
    expect(items[0].branchId).toBe(branchId)
    expect(items[0].branchName).toBe(branchName)
  })

  test.each([
    [{ Branch: { Id: 'b', Name: 'Центр' } }, { id: 'b', name: 'Центр' }],
    [{ branch: null }, null],
    [{}, undefined],
    [{ branch: { id: 'b', name: ' ' } }, undefined],
    [{ branch: { name: 'Центр' } }, undefined],
  ] as const)('distinguishes missing attendance branch data in %o', async (fields, expected) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(fields)))
    const { branch } = await getAdministratorAttendanceScope('administrator-1')
    if (expected) {
      expect(branch).toMatchObject(expected)
    } else {
      expect(branch).toBe(expected)
    }
  })

  test('sends explicit role and nullable branch in create and update payloads', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        id: 'superadministrator-1',
        fullName: 'Суперадминистратор',
        login: 'superadmin',
        role: 'SuperAdministrator',
        isActive: true,
        mustChangePassword: true,
        branchId: null,
      }))
      .mockResolvedValueOnce(jsonResponse({
        id: 'superadministrator-1',
        fullName: 'Суперадминистратор',
        login: 'superadmin',
        role: 'SuperAdministrator',
        isActive: true,
        mustChangePassword: false,
        branchId: null,
      }))
    vi.stubGlobal('fetch', fetchMock)

    await createAdministrator({
      fullName: 'Суперадминистратор',
      login: 'superadmin',
      password: 'Password1!',
      role: 'SuperAdministrator',
      branchId: null,
      mustChangePassword: true,
      isActive: true,
      messengerPlatform: null,
      messengerPlatformUserId: null,
    })
    await updateAdministrator('superadministrator-1', {
      fullName: 'Суперадминистратор',
      login: 'superadmin',
      role: 'SuperAdministrator',
      branchId: null,
      mustChangePassword: false,
      isActive: true,
      messengerPlatform: null,
      messengerPlatformUserId: null,
    })

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      role: 'SuperAdministrator',
      branchId: null,
    })
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      role: 'SuperAdministrator',
      branchId: null,
    })
  })

  test('maps backend attendance summary and management action', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      items: [
        {
          id: 'administrator-1',
          fullName: 'Администратор',
          login: 'admin',
          role: 'Administrator',
          isActive: true,
          mustChangePassword: false,
          branchId: 'branch-1',
          branchName: 'Центр',
          attendanceGroupGrantCount: 2,
          allowedActions: ['Read', 'ManageAttendanceScope'],
        },
      ],
      createRoleOptions: ['Administrator'],
    })))

    await expect(getAdministrators()).resolves.toMatchObject({
      items: [
        {
          id: 'administrator-1',
          attendanceGroupGrantCount: 2,
          allowedActions: ['Read', 'ManageAttendanceScope'],
        },
      ],
    })
  })

  test('maps attendance scope groups and unavailable stored grants', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      administrator: {
        id: 'administrator-1',
        fullName: 'Администратор',
        isActive: true,
      },
      branch: {
        id: 'branch-1',
        name: 'Центр',
        isArchived: false,
      },
      grantedGroupIds: ['group-1', 'stale-group'],
      groups: [
        {
          id: 'group-1',
          name: 'Вечерняя',
          trainingStartTime: '19:00',
          durationMinutes: 60,
          weekdays: [1, 3],
          isActive: true,
          isGranted: true,
          canGrant: false,
          canRevoke: true,
          disabledReason: null,
        },
      ],
      unavailableGrants: [
        {
          groupId: 'stale-group',
          canRevoke: true,
          disabledReason: 'grant_scope_invalid',
        },
      ],
    })))

    await expect(getAdministratorAttendanceScope('administrator-1')).resolves.toMatchObject({
      grantedGroupIds: ['group-1', 'stale-group'],
      groups: [
        {
          id: 'group-1',
          isGranted: true,
          canRevoke: true,
        },
      ],
      unavailableGrants: [
        {
          groupId: 'stale-group',
          canRevoke: true,
          disabledReason: 'grant_scope_invalid',
        },
      ],
    })
  })

  test('replaces complete attendance scope with expectedGroupIds compare-and-swap body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      administrator: {
        id: 'administrator-1',
        fullName: 'Администратор',
        isActive: true,
      },
      branch: null,
      grantedGroupIds: ['group-2'],
      groups: [],
      unavailableGrants: [],
    }))
    vi.stubGlobal('fetch', fetchMock)

    await replaceAdministratorAttendanceScope('administrator-1', {
      expectedGroupIds: ['group-1'],
      groupIds: ['group-2'],
    })

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(String(init.body))).toEqual({
      expectedGroupIds: ['group-1'],
      groupIds: ['group-2'],
    })
  })
})

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
