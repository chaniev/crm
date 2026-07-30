import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  createMembershipCatalogItem,
  getBranches,
  getMembershipCatalogItems,
} from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import { MembershipCatalogSettings } from './MembershipCatalogSettings'

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  createMembershipCatalogItem: vi.fn(),
  getBranches: vi.fn(),
  getMembershipCatalogItems: vi.fn(),
  updateMembershipCatalogItem: vi.fn(),
}))

const getBranchesMock = vi.mocked(getBranches)
const getItemsMock = vi.mocked(getMembershipCatalogItems)

beforeEach(() => {
  vi.clearAllMocks()
  getBranchesMock.mockResolvedValue([{ id: 'branch-1', name: 'Центр', address: null, description: null, isArchived: false, hallCount: 0, groupCount: 0, clientCount: 0 }])
})

describe('MembershipCatalogSettings', () => {
  const catalogItemMatrix = [
    {
      id: 'single-visit-item',
      branchId: 'branch-1',
      name: 'Базовый разовый формат',
      price: 500,
      behaviorKind: 'SingleVisit' as const,
      availableFrom: '2026-01-01',
      availableTo: null,
      isSystemOwned: false,
    },
    {
      id: 'term-item',
      branchId: 'branch-1',
      name: '10 тренировок подряд',
      price: 1500,
      behaviorKind: 'Term' as const,
      availableFrom: '2026-01-01',
      availableTo: null,
      isSystemOwned: false,
    },
    {
      id: 'professional-item-current',
      branchId: 'branch-1',
      name: 'Профессиональный',
      price: 4500,
      behaviorKind: 'Professional' as const,
      availableFrom: '2026-01-01',
      availableTo: null,
      isSystemOwned: true,
    },
    {
      id: 'professional-item-renamed',
      branchId: 'branch-1',
      name: 'Премиум пакет',
      price: 6500,
      behaviorKind: 'Professional' as const,
      availableFrom: '2026-01-01',
      availableTo: null,
      isSystemOwned: true,
    },
  ]
  test('covers loading and empty state in a fixed administrator branch', async () => {
    let resolveItems!: (value: []) => void
    getItemsMock.mockReturnValue(new Promise((resolve) => { resolveItems = resolve }))
    renderWithProviders(<MembershipCatalogSettings assignedBranchId="branch-1" />)
    expect(screen.getByText('Загружаем каталог...')).toBeInTheDocument()
    resolveItems([])
    expect(await screen.findByText('В этом филиале ещё нет абонементов')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Добавить абонемент' })).toHaveLength(1)
    expect(screen.queryByLabelText('Филиал каталога')).not.toBeInTheDocument()
    expect(screen.getByText('Центр')).toBeInTheDocument()
  })

  test('shows branch selector to HeadCoach and error state', async () => {
    getItemsMock.mockRejectedValue(new Error('Нет связи'))
    renderWithProviders(<MembershipCatalogSettings canSelectBranch />)
    expect(await screen.findByRole('combobox', { name: 'Филиал каталога' })).toBeInTheDocument()
    expect(await screen.findByText('Нет связи')).toBeInTheDocument()
  })

  test('shows branch selector to SuperAdministrator as a global settings consumer', async () => {
    getItemsMock.mockRejectedValue(new Error('Нет связи'))
    renderWithProviders(<MembershipCatalogSettings canSelectBranch />)
    expect(await screen.findByRole('combobox', { name: 'Филиал каталога' })).toBeInTheDocument()
  })

  test('edit form omits immutable controls and delete action', async () => {
    getItemsMock.mockResolvedValue([{ id: 'item-1', branchId: 'branch-1', name: 'Разовое', price: 500, behaviorKind: 'SingleVisit', availableFrom: '2026-01-01', availableTo: null, isSystemOwned: false }])
    renderWithProviders(<MembershipCatalogSettings canSelectBranch />)
    fireEvent.click(await screen.findByRole('button', { name: 'Редактировать Разовое' }))
    expect(await screen.findByRole('textbox', { name: 'Название' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Цена')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Поведение')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete|удалить/i })).not.toBeInTheDocument()
  })

  test('catalog row matrix has no behavior badges and no generic behavior labels', async () => {
    getItemsMock.mockResolvedValue(catalogItemMatrix)
    renderWithProviders(<MembershipCatalogSettings canSelectBranch />)

    await waitFor(() => {
      for (const item of catalogItemMatrix) {
        const row = screen.getByText(item.name).closest('.list-row-card')
        expect(row).toBeInstanceOf(HTMLElement)
        expect(row!.querySelectorAll('.mantine-Badge-root').length).toBe(0)
        const rowText = row!.textContent ?? ''
        const hasSingleVisitLabel = rowText.includes('Разовый')
        const hasTermLabel = rowText.includes('На срок')
        const professionalLabelCount = rowText.split('Профессиональный').length - 1
        expect(hasSingleVisitLabel).toBe(false)
        expect(hasTermLabel).toBe(false)
        if (item.name === 'Профессиональный') {
          expect(professionalLabelCount).toBe(1)
        } else {
          expect(professionalLabelCount).toBe(0)
        }
      }
    })
  })

  test('preserves server field errors on create', async () => {
    getItemsMock.mockResolvedValue([])
    vi.mocked(createMembershipCatalogItem).mockRejectedValue(Object.assign(new Error('Периоды пересекаются'), { fieldErrors: { name: ['Уже есть такой вариант.'] } }))
    renderWithProviders(<MembershipCatalogSettings canSelectBranch />)
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить абонемент' }))
    fireEvent.change(await screen.findByRole('textbox', { name: 'Название' }), { target: { value: 'Месяц' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Цена' }), { target: { value: '3000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(screen.getByText('Уже есть такой вариант.')).toBeInTheDocument())
  })
})
