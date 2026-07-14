import { afterEach, describe, expect, test, vi } from 'vitest'
import { getGroupSummary } from './groups'

afterEach(() => vi.unstubAllGlobals())

describe('groups API', () => {
  test('loads and maps the independent groups summary endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      totalCount: 100,
      activeWithoutTrainerCount: 4,
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getGroupSummary()).resolves.toEqual({
      totalCount: 100,
      activeWithoutTrainerCount: 4,
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/groups/summary', expect.objectContaining({
      credentials: 'include',
    }))
  })

  test('propagates aborts instead of substituting list-derived data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')))
    await expect(getGroupSummary(new AbortController().signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
