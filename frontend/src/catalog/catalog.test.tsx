import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { CatalogApp } from './CatalogApp'
import {
  createCatalogSearch,
  readCatalogControls,
} from './controls'
import { themeProfiles } from '../theme/profiles'

const profileIds = themeProfiles.map((profile) => profile.id)

describe('development-only design-system catalog shell', () => {
  test('normalizes deterministic URL controls and serializes them canonically', () => {
    expect(readCatalogControls(
      '?theme=test-blue-coral-v1&viewport=390&motion=reduced&content=long',
      profileIds,
      'default-green-v1',
    )).toEqual({
      content: 'long',
      motion: 'reduced',
      theme: 'test-blue-coral-v1',
      viewport: '390',
    })

    expect(createCatalogSearch({
      content: 'long',
      motion: 'reduced',
      theme: 'test-blue-coral-v1',
      viewport: '390',
    })).toBe('?theme=test-blue-coral-v1&viewport=390&motion=reduced&content=long')

    expect(readCatalogControls(
      '?theme=unknown&viewport=999&motion=fast&content=random',
      profileIds,
      'default-green-v1',
    )).toEqual({
      content: 'standard',
      motion: 'system',
      theme: 'default-green-v1',
      viewport: 'fluid',
    })
  })

  test('renders a smoke shell from production foundation registries', () => {
    render(<CatalogApp search="?theme=default-green-v1&viewport=440" />)

    expect(screen.getByRole('heading', { name: 'Каталог дизайн-системы' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'Foundation registries' })).toBeVisible()
    expect(screen.getAllByText('default-green-v1')).toHaveLength(2)
    expect(screen.getByText('pageSectionGap')).toBeVisible()
    expect(screen.getAllByText('card')).toHaveLength(2)
    expect(screen.getByTestId('catalog-preview')).toHaveAttribute('data-viewport', '440')
    expect(screen.getByTestId('catalog-preview')).toHaveAttribute('data-motion', 'system')
  })
})
