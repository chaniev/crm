import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { createDefaultClientListFilters } from './clientListFilters'
import { ClientsToolbar } from './ClientsToolbar'
import { renderWithProviders } from '../../../test/render'
import type { ClientsListState } from './useClientsListState'

describe('ClientsToolbar behavior', () => {
  test('shows the primary create action for managers only', () => {
    const onCreate = vi.fn()

    renderWithProviders(
      <ClientsToolbar
        canManage
        canSeeWithoutGroup
        onCreate={onCreate}
        state={createState()}
      />,
    )

    const createButton = screen.getByRole('button', { name: 'Новый клиент' })

    expect(createButton).toBeInTheDocument()
    fireEvent.click(createButton)
    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  test('hides create action for non-manager users', () => {
    const onCreate = vi.fn()

    renderWithProviders(
      <ClientsToolbar
        canManage={false}
        canSeeWithoutGroup
        onCreate={onCreate}
        state={createState()}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Новый клиент' })).not.toBeInTheDocument()
  })

  test('forwards search focus/blur into list search mode state', () => {
    const setSearchFocused = vi.fn()
    const applySearchNow = vi.fn()

    renderWithProviders(
      <ClientsToolbar
        canManage
        canSeeWithoutGroup
        onCreate={vi.fn()}
        state={createState({
          setSearchFocused,
          applySearchNow,
        })}
      />,
    )

    const locatorInput = screen.getByRole('textbox', { name: 'Поиск по имени или телефону' })

    fireEvent.focus(locatorInput)
    expect(setSearchFocused).toHaveBeenCalledWith(true)

    fireEvent.blur(locatorInput)
    expect(setSearchFocused).toHaveBeenCalledWith(false)
    expect(applySearchNow).toHaveBeenCalledTimes(1)
  })

  test('locator interactions update draft and open filters', () => {
    const setSearchDraft = vi.fn()
    const updateFilters = vi.fn()
    const clearSearchQuery = vi.fn(() => {
      setSearchDraft('')
      updateFilters({ query: '' })
    })

    renderWithProviders(
      <ClientsToolbar
        canManage
        canSeeWithoutGroup
        onCreate={vi.fn()}
        state={createState({
          searchDraft: 'Иван',
          setSearchDraft,
          clearSearchQuery,
        })}
      />,
    )

    const locatorInput = screen.getByRole('textbox', { name: 'Поиск по имени или телефону' })

    fireEvent.change(locatorInput, { target: { value: 'Иванов' } })
    expect(setSearchDraft).toHaveBeenCalledWith('Иванов')

    fireEvent.click(screen.getByRole('button', { name: 'Сбросить поисковый запрос' }))
    expect(clearSearchQuery).toHaveBeenCalledTimes(1)

    const filtersButton = screen.getByRole('button', { name: /Открыть фильтры/i })

    expect(filtersButton).toBeVisible()
  })

  test('uses shared filter surface on locator and keeps active filters as a sibling', () => {
    renderWithProviders(
      <ClientsToolbar
        canManage
        canSeeWithoutGroup
        onCreate={vi.fn()}
        state={createState({
          availableGroupOptions: [{ value: 'group-1', label: 'Вечерняя' }],
          filters: { groupId: 'group-1' },
        })}
      />,
    )

    const panel = screen.getByTestId('clients-filter-panel')
    const locator = within(panel).getByRole('search')
    const activeFilters = screen.getByRole('region', { name: 'Активные фильтры' })

    expect(locator).toHaveClass('entity-locator-bar', 'crm-filter-surface')
    expect(activeFilters).toHaveClass('active-filters-bar')
    expect(locator).not.toContainElement(activeFilters)
    expect(activeFilters.parentElement).toBe(panel)
  })

  test('orders refresh before the sole primary create action through the shared task action recipe', () => {
    renderWithProviders(
      <ClientsToolbar
        canManage
        canSeeWithoutGroup
        onCreate={vi.fn()}
        state={createState()}
      />,
    )

    const panel = screen.getByTestId('clients-filter-panel')
    const actions = panel.querySelector('.task-toolbar-actions')

    expect(actions).toBeTruthy()

    const buttons = within(actions as HTMLElement).getAllByRole('button')

    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Обновить список',
      'Новый клиент',
    ])
    expect(buttons[0]).toHaveClass('task-toolbar-action--refresh')
    expect(buttons[1]).toHaveClass('task-toolbar-action--primary')
    expect(buttons[1]).toHaveAttribute('data-action-priority', 'primary')
  })

  test('uses coach-only locator naming and keeps refresh action available', () => {
    const reload = vi.fn()

    renderWithProviders(
      <ClientsToolbar
        canManage={false}
        canSeeWithoutGroup
        onCreate={vi.fn()}
        state={createState({ reload })}
      />,
    )

    const locatorInput = screen.getByRole('textbox', { name: 'Поиск по имени' })

    expect(locatorInput).toHaveAttribute('placeholder', 'Имя клиента')

    const refreshButton = screen.getByRole('button', { name: 'Обновить список' })

    fireEvent.click(refreshButton)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  test('keeps search, clear and filter controls enabled while results reload', () => {
    renderWithProviders(
      <ClientsToolbar
        canManage
        canSeeWithoutGroup
        onCreate={vi.fn()}
        state={createState({
          loading: true,
          searchDraft: 'Иван',
          searchMode: 'search-focused',
        })}
      />,
    )

    expect(
      screen.getByRole('textbox', { name: 'Поиск по имени или телефону' }),
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Сбросить поисковый запрос' }),
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: /Открыть фильтры/i }),
    ).toBeEnabled()
  })
})

function createState({
  loading = false,
  searchDraft = '',
  searchMode = 'browse',
  setSearchDraft = vi.fn(),
  updateFilters = vi.fn(),
  setSearchFocused = vi.fn(),
  applySearchNow = vi.fn(),
  clearSearchQuery = vi.fn(),
  reload = vi.fn(),
  filters = {},
  availableGroupOptions = [],
}: {
  loading?: boolean
  searchDraft?: string
  searchMode?: 'browse' | 'search-focused'
  setSearchDraft?: (value: string) => void
  updateFilters?: (nextFilters: Partial<ReturnType<typeof createDefaultClientListFilters>>) => void
  setSearchFocused?: (focused: boolean) => void
  applySearchNow?: () => void
  clearSearchQuery?: () => void
  reload?: () => void
  filters?: Partial<ReturnType<typeof createDefaultClientListFilters>>
  availableGroupOptions?: Array<{ value: string; label: string }>
} = {}) {
  const defaultFilters = createDefaultClientListFilters()

  return {
    loading,
    clients: [],
    error: null,
    selectedClientId: null,
    selectedPreview: null,
    previewLoading: false,
    previewError: null,
    returnRestoreSnapshot: null,
    returnSnapshot: null,
    returnDepth: 0,
    searchFocused: false,
    searchMode,
    filters: {
      ...defaultFilters,
      query: searchDraft,
      ...filters,
    },
    searchDraft,
    availableGroupOptions,
    page: 1,
    pageStart: 0,
    pageEnd: 0,
    totalCount: 0,
    activeCount: 0,
    archivedCount: 0,
    quickFilterCounts: null,
    hasNextPage: false,
    isFirstRunEmpty: false,
    activeAdvancedFiltersCount: 0,
    setSearchDraft,
    updateFilters,
    applySearchNow,
    clearSearchQuery,
    setSearchFocused,
    reload,
    setStatus: vi.fn(),
    resetFilters: vi.fn(),
    setPage: vi.fn(),
    setSelectedClientId: vi.fn(),
    setReturnDepth: vi.fn(),
    captureReturnSnapshot: vi.fn(),
    completeReturnRestore: vi.fn(),
    resetAdvancedFilters: vi.fn(),
  } as unknown as ClientsListState
}
