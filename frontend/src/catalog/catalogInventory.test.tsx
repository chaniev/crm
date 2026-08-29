import { render, screen, within } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import * as sharedComponents from '../features/shared/ux'
import { CatalogApp } from './CatalogApp'
import { sharedComponentInventory } from './componentInventory'

vi.mock('@mantine/hooks', async (importOriginal) => {
  const original = await importOriginal<typeof import('@mantine/hooks')>()

  return {
    ...original,
    useMediaQuery: () => false,
  }
})

describe('catalog production contract inventory', () => {
  test('audits every retained shared runtime export', () => {
    expect(sharedComponentInventory.map(({ name }) => name).sort()).toEqual(
      Object.keys(sharedComponents).sort(),
    )
  })

  test('renders one source-linked canonical example for every shared component', () => {
    render(<CatalogApp search="?theme=test-blue-coral-v1&viewport=390&motion=reduced&content=long" />)

    for (const item of sharedComponentInventory) {
      const example = screen.getByTestId(`catalog-component-${item.name}`)
      expect(example).toBeVisible()
      expect(within(example).getByRole('link', { name: `Source: ${item.name}` }))
        .toHaveAttribute('href', expect.stringContaining(item.source))
    }

    expect(screen.getByTestId('catalog-preview')).toHaveAttribute('data-theme', 'test-blue-coral-v1')
    expect(screen.getByTestId('catalog-preview')).toHaveAttribute('data-viewport', '390')
    expect(screen.getByTestId('catalog-preview')).toHaveAttribute('data-motion', 'reduced')
    expect(screen.getByText(/Северный спортивный центр имени команды чемпионов/)).toBeVisible()
  })
})
