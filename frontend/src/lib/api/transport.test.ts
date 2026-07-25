import { afterEach, describe, expect, test, vi } from 'vitest'
import { request } from './transport'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('API transport', () => {
  test('parses application/problem+json validation payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            title: 'One or more validation errors occurred.',
            errors: {
              branchId: ['Укажите филиал клиента.'],
              groupIds: ['Укажите хотя бы одну группу клиента.'],
            },
          }),
          {
            headers: {
              'content-type': 'application/problem+json; charset=utf-8',
            },
            status: 400,
          },
        ),
      ),
    )

    await expect(request('/clients')).rejects.toMatchObject({
      message: 'One or more validation errors occurred.',
      status: 400,
      fieldErrors: {
        branchId: ['Укажите филиал клиента.'],
        groupIds: ['Укажите хотя бы одну группу клиента.'],
      },
    })
  })

  test('preserves stable ProblemDetails code for frontend recovery flows', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      type: '/problems/attendance-group-forbidden',
      title: 'Forbidden',
      detail: 'Доступ к группе запрещен.',
      code: 'attendance_group_forbidden',
    }), {
      status: 403,
      headers: { 'content-type': 'application/problem+json; charset=utf-8' },
    })))

    await expect(request('/attendance/groups/group-1')).rejects.toMatchObject({
      status: 403,
      code: 'attendance_group_forbidden',
      message: 'Доступ к группе запрещен.',
    })
  })

  test('falls back to ProblemDetails type when explicit code is absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      type: '/problems/attendance-grants-must-be-revoked',
      title: 'Conflict',
      detail: 'Сначала отзовите группы посещений.',
    }), {
      status: 409,
      headers: { 'content-type': 'application/problem+json; charset=utf-8' },
    })))

    await expect(request('/settings/administrators/administrator-1')).rejects.toMatchObject({
      status: 409,
      code: 'attendance_grants_must_be_revoked',
      message: 'Сначала отзовите группы посещений.',
    })
  })
})
