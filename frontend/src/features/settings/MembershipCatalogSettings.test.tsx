import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  createMembershipCatalogItem,
  getBranches,
  getMembershipCatalogItems,
  updateMembershipCatalogItem,
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
const createItemMock = vi.mocked(createMembershipCatalogItem)
const updateItemMock = vi.mocked(updateMembershipCatalogItem)

const branchOne = {
  id: 'branch-1',
  name: 'Центр',
  address: null,
  description: null,
  isArchived: false,
  hallCount: 0,
  groupCount: 0,
  clientCount: 0,
}

const branchTwo = {
  ...branchOne,
  id: 'branch-2',
  name: 'Северный филиал с очень длинным названием для проверки полного значения',
}

const branchOneItem = {
  id: 'item-1',
  branchId: 'branch-1',
  name: 'Разовое',
  price: 500,
  behaviorKind: 'SingleVisit' as const,
  availableFrom: '2026-01-01',
  availableTo: null,
  isSystemOwned: false,
}

const branchTwoItem = {
  ...branchOneItem,
  id: 'item-2',
  branchId: 'branch-2',
  name: 'Северный',
}

beforeEach(() => {
  vi.clearAllMocks()
  getBranchesMock.mockResolvedValue([branchOne])
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
    expect(screen.queryByRole('heading', { name: 'Каталог абонементов' })).not.toBeInTheDocument()
    expect(
      screen.queryByText('Названия, цены и периоды, доступные для продажи.'),
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Добавить абонемент' })).toHaveLength(1)
    expect(screen.queryByLabelText('Филиал каталога')).not.toBeInTheDocument()
    expect(screen.getByText('Центр')).toBeInTheDocument()
  })

  test('shows branch selector to HeadCoach and error state', async () => {
    getItemsMock.mockRejectedValue(new Error('Нет связи'))
    renderWithProviders(<MembershipCatalogSettings canSelectBranch />)
    expect(await screen.findByRole('combobox', { name: 'Филиал каталога' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Каталог абонементов' })).not.toBeInTheDocument()
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

  test.each([
    {
      label: 'selectable branch scope',
      props: { canSelectBranch: true },
      scope: () => screen.getByRole('combobox', { name: 'Филиал каталога' }),
    },
    {
      label: 'fixed assigned branch scope',
      props: { assignedBranchId: 'branch-1' },
      scope: () => screen.getByText('Филиал каталога').parentElement,
    },
  ])('keeps $label before refresh, create and catalog content in DOM order', async ({ props, scope }) => {
    getItemsMock.mockResolvedValue([branchOneItem])

    renderWithProviders(<MembershipCatalogSettings {...props} />)

    const edit = await screen.findByRole('button', { name: 'Редактировать Разовое' })
    const scopeElement = scope()
    const refresh = screen.getByRole('button', { name: 'Обновить' })
    const create = screen.getByRole('button', { name: 'Добавить абонемент' })

    expect(scopeElement).toBeInstanceOf(HTMLElement)
    expect(scopeElement!.compareDocumentPosition(refresh) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(refresh.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(create.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Добавить абонемент' })).toHaveLength(1)
  })

  test('switches exact catalog scope, creates in selected branch and keeps edit payload unchanged', async () => {
    getBranchesMock.mockResolvedValue([branchOne, branchTwo])
    getItemsMock.mockImplementation(async (branchId) =>
      branchId === 'branch-2' ? [branchTwoItem] : [branchOneItem],
    )
    createItemMock.mockResolvedValue({
      ...branchTwoItem,
      id: 'created-item',
      name: 'Новый северный',
      price: 2500,
      behaviorKind: 'Term',
    })
    updateItemMock.mockResolvedValue({ ...branchTwoItem, name: 'Северный обновлённый' })

    renderWithProviders(<MembershipCatalogSettings canSelectBranch />)

    const scope = await screen.findByRole('combobox', { name: 'Филиал каталога' })
    await waitFor(() => expect(scope).toHaveValue('Центр'))
    fireEvent.click(scope)
    fireEvent.click(await screen.findByRole('option', { name: branchTwo.name }))

    await waitFor(() => expect(getItemsMock).toHaveBeenCalledWith('branch-2', expect.any(AbortSignal)))
    expect(scope).toHaveValue(branchTwo.name)
    expect(scope).toHaveAccessibleDescription(branchTwo.name)

    fireEvent.click(screen.getByRole('button', { name: 'Добавить абонемент' }))
    fireEvent.change(await screen.findByRole('textbox', { name: 'Название' }), {
      target: { value: 'Новый северный' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Цена' }), {
      target: { value: '2500' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    await waitFor(() => expect(createItemMock).toHaveBeenCalledWith(expect.objectContaining({
      branchId: 'branch-2',
      name: 'Новый северный',
      price: 2500,
    })))

    fireEvent.click(await screen.findByRole('button', { name: 'Редактировать Северный' }))
    fireEvent.change(await screen.findByRole('textbox', { name: 'Название' }), {
      target: { value: 'Северный обновлённый' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    await waitFor(() => expect(updateItemMock).toHaveBeenCalledWith('item-2', {
      name: 'Северный обновлённый',
      availableFrom: '2026-01-01',
      availableTo: null,
    }))
  })

  test('keeps branch loading and failure recovery separate from catalog items', async () => {
    let resolveBranches!: (value: (typeof branchOne)[]) => void
    getBranchesMock
      .mockRejectedValueOnce(new Error('branches failed'))
      .mockReturnValueOnce(new Promise((resolve) => { resolveBranches = resolve }))
    getItemsMock.mockResolvedValue([])

    renderWithProviders(<MembershipCatalogSettings canSelectBranch />)

    expect(await screen.findByText('Филиалы не загрузились')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Добавить абонемент' })).toBeDisabled()
    expect(screen.queryByText('В этом филиале ещё нет абонементов')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }))
    await waitFor(() => expect(getBranchesMock).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Загружаем филиалы…')).toBeVisible()
    resolveBranches([branchOne])

    await waitFor(() => expect(getItemsMock).toHaveBeenCalledWith('branch-1', expect.any(AbortSignal)))
    expect(await screen.findByText('В этом филиале ещё нет абонементов')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Добавить абонемент' })).toBeEnabled()
  })

  test('explains unresolved branch scope and does not render catalog empty state', async () => {
    getBranchesMock.mockResolvedValue([])
    getItemsMock.mockResolvedValue([])

    renderWithProviders(<MembershipCatalogSettings canSelectBranch />)

    expect(await screen.findByText('Нет доступного филиала')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Добавить абонемент' })).toBeDisabled()
    expect(screen.queryByText('В этом филиале ещё нет абонементов')).not.toBeInTheDocument()
    expect(getItemsMock).not.toHaveBeenCalled()
  })

  test('does not let a stale branch response replace the selected branch catalog', async () => {
    let resolveBranchOne!: (value: (typeof branchOneItem)[]) => void
    let resolveBranchTwo!: (value: (typeof branchTwoItem)[]) => void
    getBranchesMock.mockResolvedValue([branchOne, branchTwo])
    getItemsMock.mockImplementation((branchId) => new Promise((resolve) => {
      if (branchId === 'branch-1') resolveBranchOne = resolve
      else resolveBranchTwo = resolve
    }))

    renderWithProviders(<MembershipCatalogSettings canSelectBranch />)

    const scope = await screen.findByRole('combobox', { name: 'Филиал каталога' })
    await waitFor(() => expect(scope).toHaveValue('Центр'))
    fireEvent.click(scope)
    fireEvent.click(await screen.findByRole('option', { name: branchTwo.name }))

    await act(async () => { resolveBranchTwo([branchTwoItem]) })
    expect(await screen.findByText('Северный')).toBeVisible()
    await act(async () => { resolveBranchOne([branchOneItem]) })

    expect(screen.getByText('Северный')).toBeVisible()
    expect(screen.queryByText('Разовое')).not.toBeInTheDocument()
  })
})
