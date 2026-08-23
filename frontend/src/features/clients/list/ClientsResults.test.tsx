import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ClientListItem } from '../../../lib/api'
import { renderWithProviders } from '../../../test/render'
import { createDefaultClientListFilters } from './clientListFilters'
import { createClientListReturnSnapshot } from './clientListReturnState'
import { ClientsResults } from './ClientsResults'
import type { ClientsListState } from './useClientsListState'

const originalMatchMedia = window.matchMedia

describe('ClientsResults compact behavior', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: query === '(max-width: 62rem)',
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    })
  })

  test('renders one whole-card action and branch identity only for a global user', () => {
    const onPreview = vi.fn()
    const state = createState({
      clients: [buildClientItem()],
      searchMode: 'search-focused',
    })
    const view = renderWithProviders(
      <ClientsResults
        canManage
        currentUserBranchId={null}
        isSplitLayout={false}
        onOpen={vi.fn()}
        onPreview={onPreview}
        state={state}
      />,
    )

    let card = screen.getByTestId('client-card-client-1')

    expect(card).toHaveAttribute('data-client-search-card', 'true')
    expect(card).toHaveAttribute('data-client-search-mode', 'search-focused')
    expect(card).toHaveAttribute('data-client-branch-visible', 'true')
    expect(card).toHaveAccessibleName(/Центральный/)

    fireEvent.click(card)
    expect(onPreview).toHaveBeenCalledWith('client-1')

    view.rerender(
      <ClientsResults
        canManage
        currentUserBranchId="branch-1"
        isSplitLayout={false}
        onOpen={vi.fn()}
        onPreview={onPreview}
        state={state}
      />,
    )

    card = screen.getByTestId('client-card-client-1')
    expect(card).not.toHaveAttribute('data-client-branch-visible')
    expect(card).not.toHaveAccessibleName(/Центральный/)
  })

  test('renders compact loading rows with the 96px skeleton contract', () => {
    const { container } = renderWithProviders(
      <ClientsResults
        canManage
        currentUserBranchId="branch-1"
        isSplitLayout={false}
        onOpen={vi.fn()}
        onPreview={vi.fn()}
        state={createState({ loading: true })}
      />,
    )

    const rows = container.querySelectorAll(
      '.clients-v7-row-skeleton .skeleton-row',
    )

    expect(rows).toHaveLength(7)
    for (const row of rows) {
      expect(row).toHaveStyle({
        '--skeleton-height': 'calc(6rem * var(--mantine-scale))',
      })
    }
  })

  test('keeps clear-search and reset-filter recovery actions independent', () => {
    const clearSearchQuery = vi.fn()
    const resetAdvancedFilters = vi.fn()

    renderWithProviders(
      <ClientsResults
        canManage
        currentUserBranchId="branch-1"
        isSplitLayout={false}
        onOpen={vi.fn()}
        onPreview={vi.fn()}
        state={createState({
          activeAdvancedFiltersCount: 2,
          clearSearchQuery,
          filtersQuery: 'Иван',
          resetAdvancedFilters,
          searchDraft: 'Иван',
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Очистить поиск' }))
    expect(clearSearchQuery).toHaveBeenCalledTimes(1)
    expect(resetAdvancedFilters).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }))
    expect(resetAdvancedFilters).toHaveBeenCalledTimes(1)
  })

  test('retries a failed load without resetting the list context', () => {
    const reload = vi.fn()
    const clearSearchQuery = vi.fn()
    const resetAdvancedFilters = vi.fn()

    renderWithProviders(
      <ClientsResults
        canManage
        currentUserBranchId="branch-1"
        isSplitLayout={false}
        onOpen={vi.fn()}
        onPreview={vi.fn()}
        state={createState({
          clearSearchQuery,
          error: 'Сеть недоступна',
          reload,
          resetAdvancedFilters,
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(reload).toHaveBeenCalledTimes(1)
    expect(clearSearchQuery).not.toHaveBeenCalled()
    expect(resetAdvancedFilters).not.toHaveBeenCalled()
  })

  test('returns focus to the selected client after restoring list context', async () => {
    const completeReturnRestore = vi.fn()
    const returnRestoreSnapshot = createClientListReturnSnapshot(
      {
        filters: createDefaultClientListFilters(),
        searchDraft: '',
        page: 1,
        selectedClientId: 'client-1',
        scrollY: 0,
        focusTarget: 'selected-client',
        originEntryKey: 'clients:return-focus',
        returnDepth: 1,
      },
      { canSeeWithoutGroup: true },
    )
    window.scrollTo = vi.fn()

    renderWithProviders(
      <ClientsResults
        canManage
        currentUserBranchId="branch-1"
        isSplitLayout={false}
        onOpen={vi.fn()}
        onPreview={vi.fn()}
        state={createState({
          clients: [buildClientItem()],
          completeReturnRestore,
          returnRestoreSnapshot,
          selectedClientId: 'client-1',
        })}
      />,
    )

    const selectedClient = screen.getByTestId('client-card-client-1')
    await waitFor(() => expect(selectedClient).toHaveFocus())
    expect(completeReturnRestore).toHaveBeenCalledTimes(1)
  })
})

describe('ClientsResults desktop split behavior', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: query !== '(max-width: 62rem)',
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    })
  })

  test('renders the exact four desktop decision columns without a row action', () => {
    renderWithProviders(
      <ClientsResults
        canManage
        currentUserBranchId={null}
        isSplitLayout
        onOpen={vi.fn()}
        onPreview={vi.fn()}
        state={createState({ clients: [buildClientItem()] })}
      />,
    )

    expect(screen.getByText('Клиент')).toBeVisible()
    expect(screen.getByText('Филиал')).toBeVisible()
    expect(screen.getByText('Абонемент')).toBeVisible()
    expect(screen.getByText('Следующее действие')).toBeVisible()
    expect(screen.queryByText('Визит')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Открыть' })).not.toBeInTheDocument()
    expect(screen.getByText('+7 999 111-22-33')).toBeVisible()
    expect(screen.getByText(/Центральный/)).toBeVisible()
    expect(screen.getByText(/Нет визитов/)).toBeVisible()
  })

  test('click and Space select/reopen preview while double click and Enter open full details', () => {
    const onOpen = vi.fn()
    const setSelectedClientId = vi.fn()
    const setPreviewIntent = vi.fn()
    renderWithProviders(
      <ClientsResults
        canManage
        currentUserBranchId={null}
        isSplitLayout
        onOpen={onOpen}
        onPreview={vi.fn()}
        state={createState({
          clients: [buildClientItem()],
          setPreviewIntent,
          setSelectedClientId,
        })}
      />,
    )

    const row = screen.getByTestId('client-card-client-1')

    fireEvent.click(row)
    expect(setSelectedClientId).toHaveBeenCalledWith('client-1')
    expect(setPreviewIntent).toHaveBeenCalledWith('expanded')
    expect(onOpen).not.toHaveBeenCalled()

    fireEvent.keyDown(row, { key: ' ' })
    expect(setPreviewIntent).toHaveBeenCalledTimes(2)

    fireEvent.doubleClick(row)
    expect(onOpen).toHaveBeenCalledWith('client-1')

    fireEvent.keyDown(row, { key: 'Enter' })
    expect(onOpen).toHaveBeenCalledTimes(2)
  })

  test('fallback layout keeps route-based preview on click and keyboard', () => {
    const onPreview = vi.fn()
    const onOpen = vi.fn()
    renderWithProviders(
      <ClientsResults
        canManage
        currentUserBranchId={null}
        isSplitLayout={false}
        onOpen={onOpen}
        onPreview={onPreview}
        state={createState({ clients: [buildClientItem()] })}
      />,
    )

    const row = screen.getByTestId('client-card-client-1')

    fireEvent.click(row)
    fireEvent.keyDown(row, { key: 'Enter' })
    fireEvent.keyDown(row, { key: ' ' })

    expect(onPreview).toHaveBeenCalledTimes(3)
    expect(onPreview).toHaveBeenLastCalledWith('client-1')
    expect(onOpen).not.toHaveBeenCalled()
  })
})

function createState({
  activeAdvancedFiltersCount = 0,
  clearSearchQuery = vi.fn(),
  clients = [],
  completeReturnRestore = vi.fn(),
  error = null,
  filtersQuery = '',
  loading = false,
  reload = vi.fn(),
  resetAdvancedFilters = vi.fn(),
  searchDraft = '',
  searchMode = 'browse',
  selectedClientId = null,
  returnRestoreSnapshot = null,
  setPreviewIntent = vi.fn(),
  setSelectedClientId = vi.fn(),
}: {
  activeAdvancedFiltersCount?: number
  clearSearchQuery?: () => void
  clients?: ClientListItem[]
  completeReturnRestore?: () => void
  error?: string | null
  filtersQuery?: string
  loading?: boolean
  reload?: () => void
  resetAdvancedFilters?: () => void
  searchDraft?: string
  searchMode?: 'browse' | 'search-focused'
  selectedClientId?: string | null
  returnRestoreSnapshot?: ClientsListState['returnRestoreSnapshot']
  setPreviewIntent?: (intent: 'expanded' | 'collapsed') => void
  setSelectedClientId?: (clientId: string | null) => void
} = {}) {
  return {
    clients,
    filters: {
      ...createDefaultClientListFilters(),
      query: filtersQuery,
    },
    searchDraft,
    loading,
    error,
    page: 1,
    pageStart: clients.length > 0 ? 1 : 0,
    pageEnd: clients.length,
    totalCount: clients.length,
    activeCount: clients.length,
    archivedCount: 0,
    quickFilterCounts: null,
    hasNextPage: false,
    hasAppliedFilters: Boolean(filtersQuery || activeAdvancedFiltersCount),
    activeFiltersCount: activeAdvancedFiltersCount,
    activeAdvancedFiltersCount,
    searchFocused: false,
    searchMode,
    availableGroupOptions: [],
    selectedClientId,
    selectedPreview: null,
    returnSnapshot: null,
    returnRestoreSnapshot,
    previewLoading: false,
    previewError: null,
    previewIntent: 'expanded',
    isFirstRunEmpty: false,
    setSearchDraft: vi.fn(),
    setSearchFocused: vi.fn(),
    updateFilters: vi.fn(),
    applySearchNow: vi.fn(),
    setStatus: vi.fn(),
    resetFilters: vi.fn(),
    clearSearchQuery,
    resetAdvancedFilters,
    reload,
    captureReturnSnapshot: vi.fn(),
    completeReturnRestore,
    setPage: vi.fn(),
    setSelectedClientId,
    setPreviewIntent,
    reloadPreview: vi.fn(),
  } as unknown as ClientsListState
}

function buildClientItem(): ClientListItem {
  return {
    id: 'client-1',
    fullName: 'Александра Константинопольская-Северная',
    lastName: 'Константинопольская-Северная',
    firstName: 'Александра',
    middleName: '',
    phone: '+7 999 111-22-33',
    branchId: 'branch-1',
    branchName: 'Центральный',
    status: 'Active',
    contactCount: 0,
    groupCount: 0,
    groups: [],
    photo: null,
    professionalComment: null,
    isProfessional: false,
    hasActiveMembership: false,
    hasCurrentMembership: false,
    membershipWarning: false,
    lastVisitDate: null,
    membershipState: 'None',
    currentMembership: null,
    currentMembershipSummary: null,
    actionHints: [],
  }
}
