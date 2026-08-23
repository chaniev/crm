import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  applyGroupTrainerAssignments,
  applyGroupLessonSeries,
  getGroup,
  getGroupLessonSeries,
  getGroupSummary,
  getGroups,
  previewGroupLessonSeries,
  previewGroupTrainerAssignments,
  updateGroup,
} from './groups'

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

  test('maps group detail trainer assignment revision and dated periods', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(buildGroupPayload({
        trainerAssignmentRevision: 'assignment-revision-1',
        trainerAssignmentPeriods: [
          {
            trainerId: 'trainer-1',
            trainerName: 'Тренер',
            validFrom: '2026-08-23',
            validTo: null,
          },
        ],
      })), { status: 200, headers: { 'content-type': 'application/json' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(getGroup('group-1')).resolves.toMatchObject({
      trainerAssignmentRevision: 'assignment-revision-1',
      trainerAssignmentPeriods: [
        {
          trainerId: 'trainer-1',
          trainerName: 'Тренер',
          validFrom: '2026-08-23',
          validTo: null,
        },
      ],
    })
  })

  test('updates group identity without legacy schedule or trainer payload fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(buildGroupPayload()), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await updateGroup('group-1', {
      name: 'Группа',
      branchId: 'branch-1',
      groupTypeId: 'type-1',
      isActive: true,
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/groups/group-1', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({
        name: 'Группа',
        branchId: 'branch-1',
        groupTypeId: 'type-1',
        isActive: true,
      }),
    }))
  })

  test('uses canonical trainer assignment preview and execute endpoints', async () => {
    const previewResponse = {
      confirmationToken: 'assignment-token',
      expiresAt: '2026-08-23T10:15:00Z',
      revision: 'assignment-revision-1',
      assignments: [],
      impact: { totalAffectedOccurrences: 0, examples: [] },
      warnings: [],
    }
    const executeResponse = {
      revision: 'assignment-revision-2',
      assignments: [],
      impact: { totalAffectedOccurrences: 0, examples: [] },
      warnings: [],
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(previewResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(executeResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
    vi.stubGlobal('fetch', fetchMock)

    const previewPayload = {
      assignments: [{ trainerId: 'trainer-1', validFrom: '2026-08-23', validTo: null }],
      expectedRevision: 'assignment-revision-1',
    }
    await expect(previewGroupTrainerAssignments('group-1', previewPayload))
      .resolves.toEqual(previewResponse)
    await expect(applyGroupTrainerAssignments('group-1', {
      ...previewPayload,
      confirmationToken: 'assignment-token',
    })).resolves.toEqual(executeResponse)

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/groups/group-1/trainer-assignments/preview', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(previewPayload),
    }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/groups/group-1/trainer-assignments', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        ...previewPayload,
        confirmationToken: 'assignment-token',
      }),
    }))
  })

  test('uses lesson series read, preview and execute endpoints with series id', async () => {
    const readResponse = {
      seriesId: 'series-1',
      groupId: 'group-1',
      groupName: 'Группа',
      businessDate: '2026-08-23',
      startsOn: '2026-08-01',
      endsOn: null,
      revision: 'series-revision-1',
      currentVersion: {
        versionNumber: 1,
        effectiveFrom: '2026-08-01',
        effectiveTo: null,
        thisAndFutureMinEffectiveFrom: '2026-08-23',
        entireSeriesEffectiveFrom: '2026-08-01',
        slots: [],
      },
    }
    const previewResponse = {
      confirmationToken: 'series-token',
      expiresAt: '2026-08-23T10:15:00Z',
      revision: 'series-revision-1',
      scope: 'ThisAndFuture',
      effectiveFrom: '2026-08-23',
      endsOn: null,
      slots: [],
      impact: { totalAffectedOccurrences: 0, examples: [], skipped: [] },
      warnings: [],
    }
    const executeResponse = {
      revision: 'series-revision-2',
      scope: 'ThisAndFuture',
      effectiveFrom: '2026-08-23',
      endsOn: null,
      slots: [],
      impact: { totalAffectedOccurrences: 0, examples: [], skipped: [] },
      warnings: [],
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(readResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(previewResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(executeResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }))
    vi.stubGlobal('fetch', fetchMock)

    const payload = {
      scope: 'ThisAndFuture' as const,
      effectiveFrom: '2026-08-23',
      endsOn: null,
      slots: [],
      expectedRevision: 'series-revision-1',
    }

    await expect(getGroupLessonSeries('series-1')).resolves.toEqual(readResponse)
    await expect(previewGroupLessonSeries('series-1', payload)).resolves.toEqual(previewResponse)
    await expect(applyGroupLessonSeries('series-1', {
      ...payload,
      confirmationToken: 'series-token',
    })).resolves.toEqual(executeResponse)

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/groups/series-1/lesson-series', expect.objectContaining({
      method: 'GET',
    }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/groups/series-1/lesson-series/preview', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(payload),
    }))
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/groups/series-1/lesson-series', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        confirmationToken: 'series-token',
      }),
    }))
  })
})

function buildGroupPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: 'group-1',
    name: 'Группа',
    branchId: 'branch-1',
    branchName: 'Центр',
    hallId: 'hall-1',
    hallName: 'Зал',
    groupTypeId: 'type-1',
    groupTypeName: 'Общая',
    trainingStartTime: '09:00',
    durationMinutes: 60,
    weekdays: [1],
    isActive: true,
    trainers: [],
    trainerIds: [],
    trainerCount: 0,
    trainerNames: [],
    clientCount: 0,
    updatedAt: '2026-08-23T10:00:00Z',
    trainerAssignmentRevision: 'assignment-revision-0',
    trainerAssignmentPeriods: [],
    ...overrides,
  }
}
