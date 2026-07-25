import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  getAdministratorAttendanceScope,
  getAdministrators,
  replaceAdministratorAttendanceScope,
} from './administrators'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('administrators API', () => {
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
