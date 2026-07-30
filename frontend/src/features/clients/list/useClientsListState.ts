import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getClient,
  getClients,
  getGroups,
  type ClientDetails,
  type ClientListItem,
  type ClientQuickFilterCounts,
} from '../../../lib/api'
import {
  createDefaultClientListFilters,
  countAdvancedClientListFilters,
  countClientListFilters,
  hasClientListFilters,
  mergeClientGroupFilterOptions,
  mergeStaticGroupFilterOptions,
  normalizeClientListFilters,
  resetAdvancedClientListFilters,
  toClientListQueryParams,
  type ClientGroupFilterOption,
  type ClientListFilterValues,
  type ClientStatusFilter,
} from './clientListFilters'
import { deriveClientSearchMode } from './clientListSearchMode'
import {
  createClientListEntryKey,
  createClientListReturnSnapshot,
  type ClientListReturnSnapshot,
} from './clientListReturnState'

export type ClientsListState = ReturnType<typeof useClientsListState>

type UseClientsListStateOptions = {
  canSeeWithoutGroupQuickFilter?: boolean
  initialReturnSnapshot?: ClientListReturnSnapshot | null
  previewClientId?: string | null
}

export function useClientsListState({
  canSeeWithoutGroupQuickFilter = false,
  initialReturnSnapshot = null,
  previewClientId = null,
}: UseClientsListStateOptions = {}) {
  const [originEntryKey] = useState(
    () => initialReturnSnapshot?.originEntryKey ?? createClientListEntryKey(),
  )
  const [lastReturnScrollY, setLastReturnScrollY] = useState(
    () => initialReturnSnapshot?.scrollY ?? 0,
  )
  const returnRestoreSnapshotRef = useRef<ClientListReturnSnapshot | null>(
    initialReturnSnapshot,
  )
  const [returnRestoreSnapshot, setReturnRestoreSnapshot] =
    useState<ClientListReturnSnapshot | null>(initialReturnSnapshot)
  const [clients, setClients] = useState<ClientListItem[]>([])
  const [groupOptions, setGroupOptions] = useState<ClientGroupFilterOption[]>([])
  const [fallbackGroupOptions, setFallbackGroupOptions] = useState<
    ClientGroupFilterOption[]
  >([])
  const [filters, setFilters] = useState<ClientListFilterValues>(() =>
    initialReturnSnapshot?.filters ?? createDefaultClientListFilters(),
  )
  const [searchDraft, setSearchDraft] = useState(
    () => initialReturnSnapshot?.searchDraft ?? '',
  )
  const [searchFocused, setSearchFocused] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [page, setPage] = useState(() => initialReturnSnapshot?.page ?? 1)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [activeCount, setActiveCount] = useState<number | null>(null)
  const [archivedCount, setArchivedCount] = useState<number | null>(null)
  const [quickFilterCounts, setQuickFilterCounts] =
    useState<ClientQuickFilterCounts | null>(null)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    previewClientId ?? initialReturnSnapshot?.selectedClientId ?? null,
  )
  const [previewCache, setPreviewCache] = useState<Record<string, ClientDetails>>({})
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const activeFiltersCount = useMemo(() => {
    return countClientListFilters(filters)
  }, [filters])
  const activeAdvancedFiltersCount = useMemo(() => {
    return countAdvancedClientListFilters(filters)
  }, [filters])
  const searchMode = useMemo(
    () =>
      deriveClientSearchMode({
        searchFocused,
        searchDraft,
        query: filters.query,
      }),
    [filters.query, searchDraft, searchFocused],
  )
  const hasAppliedFilters = useMemo(
    () => hasClientListFilters(filters),
    [filters],
  )
  const availableGroupOptions = useMemo(
    () => mergeStaticGroupFilterOptions(groupOptions, fallbackGroupOptions),
    [fallbackGroupOptions, groupOptions],
  )
  const pageSize = Number.parseInt(filters.pageSize, 10) || 20
  const pageStart = clients.length === 0 ? 0 : (page - 1) * pageSize + 1
  const pageEnd = pageStart === 0 ? 0 : pageStart + clients.length - 1
  const selectedPreview = selectedClientId
    ? previewCache[selectedClientId] ?? null
    : null
  const isFirstRunEmpty =
    !hasAppliedFilters &&
    !searchDraft.trim() &&
    clients.length === 0 &&
    (activeCount ?? 0) + (archivedCount ?? 0) === 0

  useEffect(() => {
    if (!previewClientId) {
      return
    }

    setSelectedClientId(previewClientId)
  }, [previewClientId])

  useEffect(() => {
    const controller = new AbortController()

    async function loadGroupOptions() {
      try {
        const response = await getGroups({ take: 100 }, controller.signal)

        if (!controller.signal.aborted) {
          setGroupOptions(
            response.items.map((group) => ({
              value: group.id,
              label: group.name,
            })),
          )
        }
      } catch {
        if (!controller.signal.aborted) {
          setGroupOptions([])
        }
      }
    }

    void loadGroupOptions()

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const normalizedDraft = searchDraft.trim()

    if (normalizedDraft === filters.query) {
      return
    }

    const debounceId = window.setTimeout(() => {
      applySearchQuery(normalizedDraft)
    }, 250)

    return () => window.clearTimeout(debounceId)
  }, [filters.query, searchDraft])

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const nextResponse = await getClients(
          toClientListQueryParams(filters, page),
          controller.signal,
        )

        if (controller.signal.aborted) {
          return
        }

        setClients(nextResponse.items)
        setTotalCount(nextResponse.totalCount)
        setActiveCount(nextResponse.activeCount)
        setArchivedCount(nextResponse.archivedCount)
        setQuickFilterCounts(nextResponse.quickFilterCounts)
        setHasNextPage(nextResponse.hasNextPage)
        setFallbackGroupOptions((currentOptions) =>
          mergeClientGroupFilterOptions(currentOptions, nextResponse.items),
        )
        setSelectedClientId((currentClientId) => {
          if (previewClientId) {
            return previewClientId
          }

          const restoreSnapshot = returnRestoreSnapshotRef.current
          if (restoreSnapshot) {
            const restoredClientId =
              restoreSnapshot.selectedClientId ?? restoreSnapshot.anchorClientId

            if (!restoredClientId) {
              return null
            }

            return nextResponse.items.some((client) => client.id === restoredClientId)
              ? restoredClientId
              : null
          }

          return currentClientId &&
            nextResponse.items.some((client) => client.id === currentClientId)
            ? currentClientId
            : nextResponse.items[0]?.id ?? null
        })
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Не удалось загрузить клиентов',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [filters, page, previewClientId, reloadKey])

  useEffect(() => {
    if (!selectedClientId || previewCache[selectedClientId]) {
      return
    }

    const clientId = selectedClientId
    const controller = new AbortController()

    async function loadPreview() {
      setPreviewLoading(true)
      setPreviewError(null)

      try {
        const details = await getClient(clientId, controller.signal)

        if (!controller.signal.aborted) {
          setPreviewCache((currentCache) => ({
            ...currentCache,
            [clientId]: details,
          }))
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setPreviewError(
            loadError instanceof Error
              ? loadError.message
              : 'Не удалось загрузить preview',
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setPreviewLoading(false)
        }
      }
    }

    void loadPreview()

    return () => controller.abort()
  }, [previewCache, selectedClientId])

  const returnSnapshot = useMemo(
    () =>
      createClientListReturnSnapshot(
        {
          filters,
          searchDraft,
          page,
          selectedClientId,
          scrollY: lastReturnScrollY,
          focusTarget: selectedClientId ? 'selected-client' : 'results-region',
          originEntryKey,
          returnDepth: initialReturnSnapshot?.returnDepth ?? 0,
        },
        { canSeeWithoutGroup: canSeeWithoutGroupQuickFilter },
      ),
    [
      canSeeWithoutGroupQuickFilter,
      filters,
      initialReturnSnapshot?.returnDepth,
      lastReturnScrollY,
      originEntryKey,
      page,
      searchDraft,
      selectedClientId,
    ],
  )

  function applySearchQuery(query: string) {
    setFilters((currentFilters) => {
      const nextFilters = normalizeClientListFilters({
        ...currentFilters,
        query,
      })

      if (nextFilters.query === currentFilters.query) {
        return currentFilters
      }

      setPage(1)
      return nextFilters
    })
  }

  function updateFilters(nextFilters: Partial<ClientListFilterValues>) {
    setFilters((currentFilters) =>
      normalizeClientListFilters({
        ...currentFilters,
        ...nextFilters,
      }),
    )
    setPage(1)
  }

  function applySearchNow() {
    applySearchQuery(searchDraft.trim())
  }

  function setStatus(status: ClientStatusFilter) {
    updateFilters({ status })
  }

  function resetFilters() {
    const nextFilters = {
      ...createDefaultClientListFilters(),
      status: 'all' as const,
    }

    setSearchDraft('')
    setFilters(nextFilters)
    setPage(1)
  }

  function clearSearchQuery() {
    setSearchDraft('')
    updateFilters({ query: '' })
  }

  function resetAdvancedFilters() {
    setFilters((currentFilters) =>
      resetAdvancedClientListFilters(currentFilters),
    )
    setPage(1)
  }

  function reload() {
    setReloadKey((currentKey) => currentKey + 1)
  }

  function captureReturnSnapshot(clientId: string | null = selectedClientId) {
    const nextScrollY =
      (initialReturnSnapshot?.returnDepth ?? 0) > 0
        ? lastReturnScrollY
        : typeof window === 'undefined'
          ? 0
          : window.scrollY
    const snapshot = createClientListReturnSnapshot(
      {
        filters,
        searchDraft,
        page,
        selectedClientId: clientId,
        anchorClientId: clientId,
        scrollY: nextScrollY,
        focusTarget: clientId ? 'selected-client' : 'results-region',
        originEntryKey,
        returnDepth: returnSnapshot.returnDepth,
      },
      { canSeeWithoutGroup: canSeeWithoutGroupQuickFilter },
    )

    setLastReturnScrollY(snapshot.scrollY)
    setSearchDraft(snapshot.searchDraft)
    setFilters(snapshot.filters)
    setPage(snapshot.page)
    setSelectedClientId(clientId)

    return snapshot
  }

  const completeReturnRestore = useCallback(() => {
    returnRestoreSnapshotRef.current = null
    setReturnRestoreSnapshot(null)
  }, [])

  return {
    clients,
    filters,
    searchDraft,
    loading,
    error,
    page,
    pageStart,
    pageEnd,
    totalCount,
    activeCount,
    archivedCount,
    quickFilterCounts,
    hasNextPage,
    hasAppliedFilters,
    activeFiltersCount,
    activeAdvancedFiltersCount,
    searchFocused,
    searchMode,
    availableGroupOptions,
    selectedClientId,
    selectedPreview,
    returnSnapshot,
    returnRestoreSnapshot,
    previewLoading,
    previewError,
    isFirstRunEmpty,
    setSearchDraft,
    setSearchFocused,
    updateFilters,
    applySearchNow,
    setStatus,
    resetFilters,
    clearSearchQuery,
    resetAdvancedFilters,
    reload,
    captureReturnSnapshot,
    completeReturnRestore,
    setPage,
    setSelectedClientId,
  }
}
