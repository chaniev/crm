import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { getClients, getGroups } from '../../../lib/api'
import { useClientsListState } from './useClientsListState'

vi.mock('../../../lib/api', () => ({ getClients: vi.fn(), getGroups: vi.fn(), getClient: vi.fn() }))
afterEach(() => vi.resetAllMocks())
const response = (totalCount: number) => ({ items: [], totalCount, activeCount: totalCount, archivedCount: 0, hasNextPage: false, quickFilterCounts: null })

for (const clear of [false, true]) {
  test(`late response cannot replace ${clear ? 'cleared' : 'new'} query results`, async () => {
    vi.mocked(getGroups).mockResolvedValue({ items: [] } as never)
    let finishA!: (value: Awaited<ReturnType<typeof getClients>>) => void
    vi.mocked(getClients).mockResolvedValue(response(0) as never)
    const { result } = renderHook(() => useClientsListState({}))
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => result.current.setPage(2))
    await waitFor(() => expect(getClients).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.anything()))
    vi.mocked(getClients).mockImplementationOnce(() => new Promise(resolve => { finishA = resolve }))
    act(() => result.current.updateFilters({ query: 'Алексеев' }))
    await waitFor(() => expect(result.current.loading).toBe(true))
    vi.mocked(getClients).mockResolvedValueOnce(response(7) as never)
    act(() => clear ? result.current.clearSearchQuery() : result.current.updateFilters({ query: 'Алексеев Алексей' }))
    await waitFor(() => expect(result.current.totalCount).toBe(7))
    await act(async () => finishA(response(99) as never))
    expect(result.current.totalCount).toBe(7)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.page).toBe(1)
    expect(result.current.filters.status).toBe('Active')
  })
}
