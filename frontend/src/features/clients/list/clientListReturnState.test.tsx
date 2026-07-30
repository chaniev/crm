import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { getClient, getClients, getGroups, type ClientListItem } from '../../../lib/api'
import { useClientsListState } from './useClientsListState'
import { createDefaultClientListFilters } from './clientListFilters'
import {
  createClientListReturnSnapshot,
  getClientListReturnHistoryStateForRoute,
  getNextClientListReturnDepth,
  readClientListReturnSnapshot,
  withClientListReturnDepth,
  type ClientListReturnSnapshot,
} from './clientListReturnState'

type ProbeOptions = {
  initialReturnSnapshot?: ClientListReturnSnapshot | null
}

const getClientsMock = vi.mocked(getClients)
const getGroupsMock = vi.mocked(getGroups)
const getClientMock = vi.mocked(getClient)

vi.mock('../../../lib/api', async () => ({
  ...(await vi.importActual('../../../lib/api')),
  getClients: vi.fn(),
  getGroups: vi.fn(),
  getClient: vi.fn(),
}))

describe('client-list return-state helpers', () => {
  beforeEach(() => {
    getClientsMock.mockResolvedValue(buildClientsResponse([buildClientRow('client-initial')]))
    getGroupsMock.mockResolvedValue({
      items: [],
      totalCount: 0,
      skip: 0,
      take: 100,
    })
    getClientMock.mockRejectedValue(new Error('Preview is not part of this test'))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('stores a versioned return-state payload and drops it outside client routes', () => {
    const snapshot = createClientListReturnSnapshot(
      {
        filters: {
          ...createDefaultClientListFilters(),
          query: 'Фильтр',
          status: 'Archived',
          groupId: 'group-42',
        },
        searchDraft: 'Фильтр',
        page: 3,
        selectedClientId: 'client-1',
        scrollY: 222,
        focusTarget: 'selected-client',
        originEntryKey: 'clients:seed',
        returnDepth: 1,
      },
      { canSeeWithoutGroup: true },
    )

    const routeState = getClientListReturnHistoryStateForRoute(
      { randomToken: 'keep-me' },
      { kind: 'section', section: 'Clients' },
      snapshot,
    )

    const serialized = (routeState as Record<string, unknown>)[
      'crmClientListReturnState'
    ] as Record<string, unknown>

    expect(serialized.version).toBe(1)
    expect(serialized.filters).toMatchObject({
      query: 'Фильтр',
      status: 'Archived',
      groupId: 'group-42',
    })
    expect((serialized as { ui: unknown }).ui).toEqual({})
    expect(serialized).toEqual(
      expect.objectContaining({
        version: 1,
        searchDraft: 'Фильтр',
        page: 3,
        selectedClientId: 'client-1',
        scrollY: 222,
        originEntryKey: 'clients:seed',
      }),
    )
    expect(Object.keys(serialized).sort()).toEqual(
      [
        'version',
        'filters',
        'searchDraft',
        'page',
        'selectedClientId',
        'anchorClientId',
        'scrollY',
        'focusTarget',
        'originEntryKey',
        'returnDepth',
        'ui',
      ].sort(),
    )
    expect(
      Object.keys(serialized.filters as Record<string, unknown>).sort(),
    ).toEqual(
      [
        'query',
        'groupId',
        'status',
        'membershipExpiresFrom',
        'membershipExpiresTo',
        'withoutPhoto',
        'withoutMembership',
        'expiringSoon',
        'withoutGroup',
        'trial',
        'pageSize',
      ].sort(),
    )
    expect(JSON.stringify(serialized)).not.toMatch(
      /fullName|phone|items|previewCache|apiResponse/,
    )
    expect(routeState).toEqual(
      expect.objectContaining({
        randomToken: 'keep-me',
      }),
    )

    const dropped = getClientListReturnHistoryStateForRoute(
      routeState,
      { kind: 'section', section: 'Groups' },
      snapshot,
    )

    expect((dropped as Record<string, unknown>).crmClientListReturnState).toBeUndefined()
    expect(dropped).toEqual(expect.objectContaining({ randomToken: 'keep-me' }))
  })

  test('carries the namespace only across the exact list/preview/detail route matrix', () => {
    const snapshot = createClientListReturnSnapshot(
      {
        filters: createDefaultClientListFilters(),
        searchDraft: '',
        page: 1,
        selectedClientId: 'client-1',
        scrollY: 120,
        originEntryKey: 'clients:matrix',
      },
      { canSeeWithoutGroup: true },
    )
    const foreignState = { randomToken: 'keep-me' }
    const carriedRoutes = [
      { kind: 'section', section: 'Clients' },
      { kind: 'clientPreview', clientId: 'client-1' },
      { kind: 'clientDetails', clientId: 'client-1' },
    ] as const
    const strippedRoutes = [
      { kind: 'section', section: 'Home' },
      { kind: 'section', section: 'Groups' },
      { kind: 'password' },
      { kind: 'clientCreate' },
      { kind: 'clientEdit', clientId: 'client-1' },
      { kind: 'groupCreate' },
      { kind: 'userCreate' },
    ] as const

    for (const route of carriedRoutes) {
      const routeState = getClientListReturnHistoryStateForRoute(
        foreignState,
        route,
        snapshot,
      )

      expect(readClientListReturnSnapshot(routeState, {
        canSeeWithoutGroup: true,
      })).toMatchObject({ originEntryKey: 'clients:matrix' })
      expect(routeState).toMatchObject(foreignState)
    }

    for (const route of strippedRoutes) {
      const routeState = getClientListReturnHistoryStateForRoute(
        {
          ...foreignState,
          crmClientListReturnState: snapshot,
        },
        route,
        snapshot,
      )

      expect(routeState).toEqual(foreignState)
    }
  })

  test('sanitizes malformed payload values and enforces withoutGroup capability', () => {
    const rawState = {
      crmClientListReturnState: {
        version: 1,
        filters: {
          query: 123,
          groupId: 500,
          status: 'Unknown',
          withoutPhoto: 1,
          withoutGroup: true,
          pageSize: '20',
        },
        searchDraft: 42,
        page: -4,
        selectedClientId: 10,
        anchorClientId: '',
        scrollY: 'bad',
        focusTarget: 'not-a-target',
        originEntryKey: '  clients:seed  ',
        returnDepth: -100,
      },
      randomToken: 'preserve-this',
    } as const

    const parsedNoPermission = readClientListReturnSnapshot(rawState, {
      canSeeWithoutGroup: false,
    })

    expect(parsedNoPermission).not.toBeNull()
    expect(parsedNoPermission).toMatchObject({
      page: 1,
      searchDraft: '',
      selectedClientId: null,
      anchorClientId: null,
      scrollY: 0,
      returnDepth: 0,
      filters: {
        query: '',
        groupId: null,
        status: 'Active',
        withoutPhoto: false,
        withoutGroup: false,
        pageSize: '20',
      },
      focusTarget: 'results-region',
      originEntryKey: 'clients:seed',
    })
    expect((rawState as Record<string, unknown>).randomToken).toBe('preserve-this')

    const unknownVersion = readClientListReturnSnapshot(
      {
        crmClientListReturnState: {
          ...rawState.crmClientListReturnState,
          version: 2,
        },
      },
      { canSeeWithoutGroup: true },
    )
    const nonObjectState = readClientListReturnSnapshot('not-an-object', {
      canSeeWithoutGroup: true,
    })

    expect(unknownVersion).toBeNull()
    expect(nonObjectState).toBeNull()
  })

  test('tracks return depth for client preview/detail transitions', () => {
    const snapshot = createClientListReturnSnapshot(
      {
        filters: createDefaultClientListFilters(),
        searchDraft: '',
        page: 1,
        selectedClientId: null,
        scrollY: 0,
        focusTarget: 'results-region',
        originEntryKey: 'clients:seed',
      },
      { canSeeWithoutGroup: true },
    )

    const onClients = getNextClientListReturnDepth(
      { kind: 'section', section: 'Clients' },
      snapshot,
    )
    const onPreview = getNextClientListReturnDepth(
      { kind: 'clientPreview', clientId: 'client-1' },
      withClientListReturnDepth(snapshot, onClients),
    )
    const onDetails = getNextClientListReturnDepth(
      { kind: 'clientDetails', clientId: 'client-1' },
      withClientListReturnDepth(snapshot, onPreview),
    )

    expect(onClients).toBe(1)
    expect(onPreview).toBe(2)
    expect(onDetails).toBe(2)
  })
})

describe('useClientsListState with return-state snapshot', () => {
  beforeEach(() => {
    getClientsMock.mockResolvedValue(buildClientsResponse([buildClientRow('client-1')]))
    getGroupsMock.mockResolvedValue({
      items: [],
      totalCount: 0,
      skip: 0,
      take: 100,
    })
    getClientMock.mockRejectedValue(new Error('Preview is not part of this test'))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('hydrates an initial snapshot into first getClients request (no default fallback request)', async () => {
    const snapshot = createClientListReturnSnapshot(
      {
        filters: {
          ...createDefaultClientListFilters(),
          query: 'Возврат',
          groupId: 'group-42',
          withoutPhoto: true,
          pageSize: '50',
        },
        searchDraft: 'Возврат',
        page: 3,
        selectedClientId: 'client-2',
        anchorClientId: 'client-2',
        scrollY: 480,
        focusTarget: 'selected-client',
        originEntryKey: 'clients:seed',
      },
      { canSeeWithoutGroup: true },
    )

    getClientsMock.mockResolvedValueOnce(
      buildClientsResponse([
        buildClientRow('client-2', 'Петров'),
        buildClientRow('client-3', 'Иванов'),
      ]),
    )

    const result = await captureState({ initialReturnSnapshot: snapshot })

    await waitFor(() => expect(getClientsMock).toHaveBeenCalled())

    const [request] = getClientsMock.mock.calls[0]!
    expect(request).toMatchObject({
      page: 3,
      pageSize: 50,
      query: 'Возврат',
      groupId: 'group-42',
      hasPhoto: false,
      status: 'Active',
    })
    expect(result.result.current.searchDraft).toBe('Возврат')
    expect(result.result.current.filters.query).toBe('Возврат')
    expect(result.result.current.page).toBe(3)
    expect(result.result.current.selectedClientId).toBe('client-2')
  })

  test('canonicalizes pending draft on capture and resets restored page to 1', async () => {
    const result = await captureState()

    act(() => {
      result.result.current.setPage(4)
      result.result.current.setSearchDraft('  Новый клиент  ')
    })

    await waitFor(() => {
      expect(result.result.current.page).toBe(4)
      expect(result.result.current.searchDraft).toBe('  Новый клиент  ')
      expect(getClientsMock.mock.calls.at(-1)?.[0]).toMatchObject({ page: 4 })
    })

    const requestCountBeforeCapture = getClientsMock.mock.calls.length
    let snapshot: ClientListReturnSnapshot | null = null

    act(() => {
      snapshot = result.result.current.captureReturnSnapshot('client-1')
    })

    expect(snapshot).toMatchObject({
      page: 1,
      searchDraft: 'Новый клиент',
      filters: { query: 'Новый клиент' },
      selectedClientId: 'client-1',
    })
    await waitFor(() => {
      expect(result.result.current.searchDraft).toBe('Новый клиент')
      expect(getClientsMock.mock.calls.length).toBeGreaterThan(
        requestCountBeforeCapture,
      )
      expect(getClientsMock.mock.calls.at(-1)?.[0]).toMatchObject({
        page: 1,
        query: 'Новый клиент',
      })
    })
    expect(result.result.current.page).toBe(1)
    expect(result.result.current.selectedClientId).toBe('client-1')
    expect(
      getClientsMock.mock.calls
        .slice(requestCountBeforeCapture)
        .every(
          ([request]) =>
            request?.page === 1 && request.query === 'Новый клиент',
        ),
    ).toBe(true)
  })

  test('falls back to first visible row when restored selection is missing on reload', async () => {
    const snapshot = createClientListReturnSnapshot(
      {
        filters: createDefaultClientListFilters(),
        searchDraft: '',
        page: 1,
        selectedClientId: 'client-2',
        anchorClientId: 'client-2',
        scrollY: 0,
        focusTarget: 'selected-client',
        originEntryKey: 'clients:seed',
      },
      { canSeeWithoutGroup: true },
    )

    getClientsMock
      .mockResolvedValueOnce(buildClientsResponse([
        buildClientRow('client-1', 'Иван'),
        buildClientRow('client-2', 'Анна'),
      ]))
      .mockResolvedValueOnce(buildClientsResponse([buildClientRow('client-1', 'Иван')]))

    const result = await captureState({ initialReturnSnapshot: snapshot })

    await waitFor(() => expect(result.result.current.clients).toHaveLength(2))
    expect(result.result.current.selectedClientId).toBe('client-2')

    result.result.current.reload()

    await waitFor(() => expect(result.result.current.clients).toHaveLength(1))
    expect(result.result.current.selectedClientId).toBeNull()
    expect(result.result.current.returnRestoreSnapshot?.selectedClientId).toBe('client-2')
  })

  test('keeps request criteria on error and does not change request shape when retry-capable workflow fails', async () => {
    const snapshot = createClientListReturnSnapshot(
      {
        filters: {
          ...createDefaultClientListFilters(),
          query: 'Ошибка',
          status: 'Archived',
          groupId: 'group-42',
        },
        searchDraft: 'Ошибка',
        page: 2,
        selectedClientId: null,
        scrollY: 0,
        focusTarget: 'results-region',
        originEntryKey: 'clients:seed',
      },
      { canSeeWithoutGroup: true },
    )

    getClientsMock.mockRejectedValueOnce(new Error('Network unavailable'))
    const result = await captureState({ initialReturnSnapshot: snapshot })

    expect(result.result.current.error).toBe('Network unavailable')
    const failedRequest = getClientsMock.mock.calls.at(-1)?.[0]

    expect(failedRequest).toMatchObject(snapshotToRequest(snapshot))

    getClientsMock.mockResolvedValueOnce(
      buildClientsResponse([buildClientRow('client-recovered')]),
    )
    act(() => result.result.current.reload())

    await waitFor(() => {
      expect(result.result.current.loading).toBe(false)
      expect(result.result.current.error).toBeNull()
      expect(result.result.current.clients).toHaveLength(1)
    })
    expect(getClientsMock.mock.calls.at(-1)?.[0]).toEqual(failedRequest)
  })

  test('ignores a stale list response after newer filters have loaded', async () => {
    const staleRequest = createDeferred<Awaited<ReturnType<typeof getClients>>>()
    const currentRequest = createDeferred<Awaited<ReturnType<typeof getClients>>>()

    getClientsMock
      .mockImplementationOnce(() => staleRequest.promise)
      .mockImplementationOnce(() => currentRequest.promise)

    const result = renderHook(() =>
      useClientsListState({ canSeeWithoutGroupQuickFilter: true }),
    )

    await waitFor(() => expect(getClientsMock).toHaveBeenCalledTimes(1))

    act(() => {
      result.result.current.updateFilters({ query: 'Новый запрос' })
    })

    await waitFor(() => expect(getClientsMock).toHaveBeenCalledTimes(2))

    await act(async () => {
      currentRequest.resolve(
        buildClientsResponse([buildClientRow('client-current', 'Новый Клиент')]),
      )
    })

    await waitFor(() => {
      expect(result.result.current.loading).toBe(false)
      expect(result.result.current.clients[0]?.id).toBe('client-current')
    })

    await act(async () => {
      staleRequest.resolve(
        buildClientsResponse([buildClientRow('client-stale', 'Старый Клиент')]),
      )
    })

    expect(result.result.current.loading).toBe(false)
    expect(result.result.current.error).toBeNull()
    expect(result.result.current.clients[0]?.id).toBe('client-current')
  })
})

async function captureState(options: ProbeOptions = {}) {
  const result = renderHook(() =>
    useClientsListState({
      canSeeWithoutGroupQuickFilter: true,
      initialReturnSnapshot: options.initialReturnSnapshot ?? null,
    }),
  )

  await waitFor(() => {
    expect(result.result.current.loading).toBe(false)
  })

  return result
}

function buildClientsResponse(items: ClientListItem[]) {
  const activeCount = items.filter((client) => client.status === 'Active').length

  return {
    items,
    totalCount: items.length,
    activeCount,
    archivedCount: items.length - activeCount,
    skip: 0,
    take: 20,
    page: 1,
    pageSize: 20,
    hasNextPage: false,
    quickFilterCounts: {
      withoutMembership: 0,
      expiringSoon: 0,
      withoutGroup: 0,
      trial: 0,
    },
  }
}

function buildClientRow(id: string, fullName = 'Клиент Имя') {
  const [lastName = '', firstName = '', middleName = ''] = fullName.split(' ')

  return {
    id,
    fullName,
    lastName,
    firstName,
    middleName,
    phone: '+79990000000',
    branchId: 'branch-1',
    branchName: 'Центр',
    status: 'Active',
    contactCount: 0,
    groupCount: 1,
    groups: [],
    photo: null,
    professionalComment: null,
    isProfessional: false,
    hasActiveMembership: false,
    membershipWarning: false,
    lastVisitDate: null,
    membershipState: 'None',
    hasCurrentMembership: false,
    actionHints: [],
    currentMembership: null,
    currentMembershipSummary: null,
  } satisfies ClientListItem
}

function snapshotToRequest(
  snapshot: ClientListReturnSnapshot,
): Record<string, unknown> {
  const status =
    snapshot.filters.status === 'all' ? undefined : snapshot.filters.status

  return {
    page: snapshot.page,
    pageSize: Number(snapshot.filters.pageSize) || 20,
    query: snapshot.searchDraft || undefined,
    groupId: snapshot.filters.groupId ?? undefined,
    status,
    hasPhoto: snapshot.filters.withoutPhoto ? false : undefined,
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}
