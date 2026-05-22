import { afterEach, describe, expect, test, vi } from 'vitest'
import { loadAppConfig } from './config'

describe('loadAppConfig', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('requests the public app config endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ clubName: 'Iron Club' }), {
        headers: {
          'content-type': 'application/json; charset=utf-8',
        },
        status: 200,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(loadAppConfig()).resolves.toEqual({ clubName: 'Iron Club' })

    expect(fetchMock).toHaveBeenCalledWith('/api/config', expect.any(Object))
  })
})
