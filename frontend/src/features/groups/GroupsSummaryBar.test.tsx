import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { GroupsSummaryBar } from './GroupsSummaryBar'

const summary = { totalCount: 0, activeWithoutTrainerCount: 0 }

describe('GroupsSummaryBar', () => {
  test('renders exactly two semantic, noninteractive metrics and accessible actions', () => {
    const onCreate = vi.fn()
    const onRefresh = vi.fn()
    renderWithProviders(<GroupsSummaryBar error={null} loading={false} onCreate={onCreate} onRefresh={onRefresh} summary={summary} />)

    const region = screen.getByRole('region', { name: 'Сводка и действия групп' })
    expect(within(region).getByRole('heading', { name: 'Сводка и действия групп' })).toBeInTheDocument()
    expect(region.querySelectorAll('dl')).toHaveLength(1)
    expect(region.querySelectorAll('dt')).toHaveLength(2)
    expect(region.querySelectorAll('dd')).toHaveLength(2)
    expect(within(region).getAllByText('0')).toHaveLength(2)
    expect(within(region).getByText('среди активных')).toBeInTheDocument()
    expect(within(region).queryByText('Активные')).not.toBeInTheDocument()
    expect(region.querySelector('dt[tabindex], dd[tabindex]')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Создать' }))
    fireEvent.click(screen.getByRole('button', { name: 'Обновить список' }))
    expect(onCreate).toHaveBeenCalledOnce()
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  test.each([
    { loading: true, error: null },
    { loading: false, error: 'Сеть недоступна' },
  ])('uses compact placeholders while actions remain available', ({ loading, error }) => {
    renderWithProviders(<GroupsSummaryBar error={error} loading={loading} onCreate={vi.fn()} onRefresh={vi.fn()} summary={null} />)
    expect(screen.getAllByText('—')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Создать' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Обновить список' })).toBeInTheDocument()
  })
})
