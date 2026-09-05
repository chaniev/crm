import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getGroups,
  getGroupSummary,
  type TrainingGroupListItem,
  type TrainingGroupSummary,
} from '../../lib/api'
import {
  countGroupListFilters,
  createDefaultGroupListFilters,
  getGroupListMaxPage,
  getGroupListRange,
  hasGroupListCriteria,
  normalizeGroupListFilters,
  normalizeGroupSearchQuery,
  toGroupListQueryParams,
  type GroupListFilters,
} from './groupListQuery'
import {
  createGroupListEntryKey,
  createGroupListReturnSnapshot,
  type GroupListReturnSnapshot,
} from './groupListReturnState'
import { fe13GroupsCoreText } from '../../resources/fe-13-groups-core'


export type GroupsListState = ReturnType<typeof useGroupsListState>

type UseGroupsListStateOptions = {
  initialReturnSnapshot?: GroupListReturnSnapshot | null
}

export function useGroupsListState({
  initialReturnSnapshot = null,
}: UseGroupsListStateOptions = {}) {
  const [originEntryKey] = useState(
    () => initialReturnSnapshot?.originEntryKey ?? createGroupListEntryKey(),
  )
  const [groups, setGroups] = useState<TrainingGroupListItem[]>([])
  const [filters, setFilters] = useState<GroupListFilters>(
    () => initialReturnSnapshot?.filters ?? createDefaultGroupListFilters(),
  )
  const [searchDraft, setSearchDraft] = useState(
    () => initialReturnSnapshot?.searchDraft ?? '',
  )
  const [page, setPage] = useState(() => initialReturnSnapshot?.page ?? 1)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [summary, setSummary] = useState<TrainingGroupSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    initialReturnSnapshot?.selectedGroupId ?? null,
  )
  const returnRestoreSnapshotRef = useRef<GroupListReturnSnapshot | null>(
    initialReturnSnapshot,
  )
  const [returnRestoreSnapshot, setReturnRestoreSnapshot] =
    useState<GroupListReturnSnapshot | null>(initialReturnSnapshot)
  const requestIdRef = useRef(0)
  const clampAttemptKeyRef = useRef<string | null>(null)
  const activeFilterCount = useMemo(
    () => countGroupListFilters(filters),
    [filters],
  )
  const hasAppliedCriteria = useMemo(
    () => hasGroupListCriteria(filters),
    [filters],
  )
  const pageSize = 10
  const pageCount =
    totalCount === null ? 1 : getGroupListMaxPage(totalCount, pageSize)
  const { start: pageStart, end: pageEnd } = getGroupListRange(
    groups.length,
    page,
    pageSize,
  )
  const isFirstRunEmpty =
    !hasAppliedCriteria &&
    !searchDraft.trim() &&
    groups.length === 0 &&
    totalCount === 0

  useEffect(() => {
    const normalizedDraft = normalizeGroupSearchQuery(searchDraft)

    if (normalizedDraft === filters.appliedQuery) {
      return
    }

    const debounceId = window.setTimeout(() => {
      applySearchQuery(normalizedDraft)
    }, 250)

    return () => window.clearTimeout(debounceId)
  }, [filters.appliedQuery, searchDraft])

  useEffect(() => {
    const controller = new AbortController()
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    const clampKey = JSON.stringify(filters)

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const response = await getGroups(
          toGroupListQueryParams(filters, page, pageSize),
          controller.signal,
        )

        if (controller.signal.aborted || requestId !== requestIdRef.current) {
          return
        }

        if (response.totalCount > 0) {
          const maxPage = getGroupListMaxPage(response.totalCount, pageSize)

          if (page > maxPage && clampAttemptKeyRef.current !== clampKey) {
            clampAttemptKeyRef.current = clampKey
            setTotalCount(response.totalCount)
            setPage(maxPage)
            return
          }
        }

        setGroups(response.items)
        setTotalCount(response.totalCount)
        setSelectedGroupId((currentGroupId) => {
          const restoreSnapshot = returnRestoreSnapshotRef.current
          const restoredGroupId =
            restoreSnapshot?.selectedGroupId ?? restoreSnapshot?.anchorGroupId

          if (restoredGroupId) {
            return response.items.some((group) => group.id === restoredGroupId)
              ? restoredGroupId
              : null
          }

          return currentGroupId &&
            response.items.some((group) => group.id === currentGroupId)
            ? currentGroupId
            : null
        })
      } catch (loadError) {
        if (controller.signal.aborted || requestId !== requestIdRef.current) {
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : fe13GroupsCoreText.useGroupsListState_string_85b97c29,
        )
      } finally {
        if (!controller.signal.aborted && requestId === requestIdRef.current) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [filters, page, reloadKey])

  useEffect(() => {
    const controller = new AbortController()

    async function loadSummary() {
      try {
        const response = await getGroupSummary(controller.signal)

        if (!controller.signal.aborted) {
          setSummary(response)
        }
      } catch {
        // Summary metrics are supplementary: keep the last known value and
        // never make the paginated registry depend on this request.
      }
    }

    void loadSummary()

    return () => controller.abort()
  }, [reloadKey])

  const returnSnapshot = useMemo(
    () =>
      createGroupListReturnSnapshot({
        filters,
        searchDraft,
        page,
        selectedGroupId,
        scrollY: typeof window === 'undefined' ? 0 : window.scrollY,
        focusTarget: selectedGroupId ? 'selected-group' : 'results-region',
        originEntryKey,
        returnDepth: initialReturnSnapshot?.returnDepth ?? 0,
      }),
    [
      filters,
      initialReturnSnapshot?.returnDepth,
      originEntryKey,
      page,
      searchDraft,
      selectedGroupId,
    ],
  )

  function applySearchQuery(query: string) {
    setFilters((currentFilters) => {
      const nextFilters = normalizeGroupListFilters({
        ...currentFilters,
        appliedQuery: query,
      })

      if (nextFilters.appliedQuery === currentFilters.appliedQuery) {
        return currentFilters
      }

      clampAttemptKeyRef.current = null
      setPage(1)
      return nextFilters
    })
  }

  function updateFilters(nextFilters: Partial<GroupListFilters>) {
    setFilters((currentFilters) =>
      normalizeGroupListFilters({
        ...currentFilters,
        ...nextFilters,
      }),
    )
    clampAttemptKeyRef.current = null
    setPage(1)
  }

  function clearSearchQuery() {
    setSearchDraft('')
    applySearchQuery('')
  }

  function applySearchNow() {
    applySearchQuery(normalizeGroupSearchQuery(searchDraft))
  }

  function resetFilters() {
    setSearchDraft('')
    setFilters(createDefaultGroupListFilters())
    clampAttemptKeyRef.current = null
    setPage(1)
  }

  function reload() {
    setReloadKey((currentKey) => currentKey + 1)
  }

  function goToPage(nextPage: number) {
    if (loading || nextPage === page || nextPage < 1 || nextPage > pageCount) {
      return
    }

    setPage(nextPage)
  }

  function captureReturnSnapshot(groupId: string | null = selectedGroupId) {
    const snapshot = createGroupListReturnSnapshot({
      filters,
      searchDraft,
      page,
      selectedGroupId: groupId,
      anchorGroupId: groupId,
      scrollY: typeof window === 'undefined' ? 0 : window.scrollY,
      focusTarget: groupId ? 'selected-group' : 'results-region',
      originEntryKey,
      returnDepth: returnSnapshot.returnDepth,
    })

    setSearchDraft(snapshot.searchDraft)
    setFilters(snapshot.filters)
    setPage(snapshot.page)
    setSelectedGroupId(groupId)

    return snapshot
  }

  const completeReturnRestore = useCallback(() => {
    returnRestoreSnapshotRef.current = null
    setReturnRestoreSnapshot(null)
  }, [])

  return {
    groups,
    filters,
    searchDraft,
    page,
    pageSize,
    pageCount,
    pageStart,
    pageEnd,
    totalCount,
    summary,
    loading,
    error,
    selectedGroupId,
    returnSnapshot,
    returnRestoreSnapshot,
    activeFilterCount,
    hasAppliedCriteria,
    isFirstRunEmpty,
    setSearchDraft,
    applySearchNow,
    updateFilters,
    clearSearchQuery,
    resetFilters,
    reload,
    goToPage,
    captureReturnSnapshot,
    completeReturnRestore,
    setSelectedGroupId,
  }
}
