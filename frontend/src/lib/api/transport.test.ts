import { afterEach, describe, expect, test, vi } from 'vitest'
import { request } from './transport'

describe('request', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

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
})
