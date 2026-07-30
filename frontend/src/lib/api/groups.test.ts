import { afterEach, describe, expect, test, vi } from 'vitest'
import { getGroupSummary } from './groups'
import { getGroups } from './groups'

type GroupSearchParams = Parameters<typeof getGroups>[0]

afterEach(() => vi.unstubAllGlobals())

describe('groups API', () => {
  test('uses canonical group paging query parameters and defaults', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        items: [],
        totalCount: 0,
        skip: 0,
        take: 0,
      }), { status: 200, headers: { 'content-type': 'application/json' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await getGroups()

    const requestUrl = String(fetchMock.mock.calls[0]?.[0])
    const searchParams = new URL(requestUrl, 'http://localhost').searchParams

    expect(searchParams.get('page')).toBe('1')
    expect(searchParams.get('pageSize')).toBe('100')
  })

  test('normalizes trimmed query and sends active/without-trainer filters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        items: [],
        totalCount: 0,
        skip: 0,
        take: 0,
      }), { status: 200, headers: { 'content-type': 'application/json' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const params = {
      page: 2,
      pageSize: 10,
      query: '  Ранний  ',
      isActive: true,
      withoutTrainer: true,
    } as GroupSearchParams

    await getGroups(params)

    const requestUrl = String(fetchMock.mock.calls[0]?.[0])
    const searchParams = new URL(requestUrl, 'http://localhost').searchParams

    expect(searchParams.get('page')).toBe('2')
    expect(searchParams.get('pageSize')).toBe('10')
    expect(searchParams.get('query')).toBe('Ранний')
    expect(searchParams.get('isActive')).toBe('true')
    expect(searchParams.get('withoutTrainer')).toBe('true')
  })

  test('does not tolerate legacy array response payloads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([
        {
          id: 'legacy-group',
          name: 'Легаси',
          branchId: 'branch-1',
          branchName: 'Филиал',
          hallId: 'hall-1',
          hallName: 'Зал',
          groupTypeId: 'type-1',
          groupTypeName: 'Общая',
          trainingStartTime: '08:00',
          durationMinutes: 60,
          weekdays: [1],
          isActive: true,
          trainers: [],
          trainerIds: [],
          trainerCount: 0,
          clientCount: 0,
          trainerNames: [],
          updatedAt: null,
        },
      ]), { status: 200, headers: { 'content-type': 'application/json' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(getGroups()).rejects.toThrowError()
  })

  test('sends query-only payloads with zero filters as page-based envelope requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        items: [],
        totalCount: 0,
        skip: 0,
        take: 0,
      }), { status: 200, headers: { 'content-type': 'application/json' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await getGroups({ isActive: false })

    const requestUrl = String(fetchMock.mock.calls[0]?.[0])
    const search = new URL(requestUrl, 'http://localhost').searchParams

    expect(search.has('query')).toBe(false)
    expect(search.get('isActive')).toBe('false')
    expect(search.get('page')).toBe('1')
    expect(search.get('pageSize')).toBe('100')
  })

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
