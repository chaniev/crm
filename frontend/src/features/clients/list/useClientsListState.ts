import { useEffect, useMemo, useState } from 'react'
import {
  getClient,
  getClients,
  getGroups,
  type ClientDetails,
  type ClientListItem,
} from '../../../lib/api'
import {
  createDefaultClientListFilters,
  countClientListFilters,
  hasClientListFilters,
  mergeClientGroupFilterOptions,
  mergeStaticGroupFilterOptions,
  normalizeClientListFilters,
  toClientListQueryParams,
  type ClientGroupFilterOption,
  type ClientListFilterValues,
  type ClientStatusFilter,
} from './clientListFilters'

export type ClientsListState = ReturnType<typeof useClientsListState>

export function useClientsListState() {
  const [clients, setClients] = useState<ClientListItem[]>([])
  const [groupOptions, setGroupOptions] = useState<ClientGroupFilterOption[]>([])
  const [fallbackGroupOptions, setFallbackGroupOptions] = useState<
    ClientGroupFilterOption[]
  >([])
  const [filters, setFilters] = useState<ClientListFilterValues>(() =>
    createDefaultClientListFilters(),
  )
  const [searchDraft, setSearchDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [activeCount, setActiveCount] = useState<number | null>(null)
  const [archivedCount, setArchivedCount] = useState<number | null>(null)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [previewCache, setPreviewCache] = useState<Record<string, ClientDetails>>({})
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const activeFiltersCount = useMemo(() => {
    return countClientListFilters(filters)
  }, [filters])
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
    clients.length === 0 &&
    (activeCount ?? 0) + (archivedCount ?? 0) === 0

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
    const debounceId = window.setTimeout(() => {
      updateFilters({ query: searchDraft })
    }, 350)

    return () => window.clearTimeout(debounceId)
  }, [searchDraft])

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
        setHasNextPage(nextResponse.hasNextPage)
        setFallbackGroupOptions((currentOptions) =>
          mergeClientGroupFilterOptions(currentOptions, nextResponse.items),
        )
        setSelectedClientId((currentClientId) =>
          currentClientId &&
          nextResponse.items.some((client) => client.id === currentClientId)
            ? currentClientId
            : nextResponse.items[0]?.id ?? null,
        )
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
  }, [filters, page, reloadKey])

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
    updateFilters({ query: searchDraft })
  }

  function setStatus(status: ClientStatusFilter) {
    updateFilters({ status })
  }

  function resetFilters() {
    const nextFilters = createDefaultClientListFilters()

    setSearchDraft('')
    setFilters(nextFilters)
    setPage(1)
  }

  function reload() {
    setReloadKey((currentKey) => currentKey + 1)
  }

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
    hasNextPage,
    hasAppliedFilters,
    activeFiltersCount,
    availableGroupOptions,
    selectedClientId,
    selectedPreview,
    previewLoading,
    previewError,
    isFirstRunEmpty,
    setSearchDraft,
    updateFilters,
    applySearchNow,
    setStatus,
    resetFilters,
    reload,
    setPage,
    setSelectedClientId,
  }
}
