import { afterEach, describe, expect, test, vi } from 'vitest'
import { loadAppConfig } from './config'

describe('loadAppConfig', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('requests the public app config endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        clubName: 'Iron Club',
      }),
    )

    vi.stubGlobal('fetch', fetchMock)

    await expect(loadAppConfig()).resolves.toEqual({ clubName: 'Iron Club' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [path, options] = fetchMock.mock.calls[0]!
    expect(path).toBe('/api/config')
    expect(options).toMatchObject({
      credentials: 'include',
      method: 'GET',
    })
    expect((options?.headers as Headers).get('Accept')).toBe('application/json')
  })

  test('maps full TASK-090 config contract fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        clubName: 'Iron Club',
        themeId: 'default-green-v1',
        authBackgroundImageId: 'k4pro-login-v1',
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(loadAppConfig()).resolves.toEqual({
      clubName: 'Iron Club',
      themeId: 'default-green-v1',
      authBackgroundImageId: 'k4pro-login-v1',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
