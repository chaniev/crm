import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { getBranches, getHalls, type Branch, type Hall } from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import { showAppNotification } from '../shared/notifications'
import { BranchSettingsScreen } from './BranchSettingsScreen'

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  getBranches: vi.fn(),
  getHalls: vi.fn(),
}))

vi.mock('../shared/notifications', () => ({
  showAppNotification: vi.fn(),
}))

const branches: Branch[] = [
  {
    id: 'branch-1',
    name: 'Центр',
    address: 'ул. Лесная, 1',
    description: 'Основной филиал',
    isArchived: false,
    hallCount: 2,
    groupCount: 4,
    clientCount: 12,
  },
]

const halls: Hall[] = [
  {
    id: 'hall-1',
    branchId: 'branch-1',
    branchName: 'Центр',
    name: 'Зал №1',
    description: 'Большой',
    isArchived: false,
    groupCount: 4,
  },
]

beforeEach(() => {
  vi.mocked(getBranches).mockReset()
  vi.mocked(getHalls).mockReset()
  vi.mocked(showAppNotification).mockReset()
})

describe('BranchSettingsScreen', () => {
  test('renders branch rows without top metrics and keeps primary operations visible', async () => {
    vi.mocked(getBranches).mockResolvedValue(branches)
    vi.mocked(getHalls).mockResolvedValue(halls)

    renderWithProviders(<BranchSettingsScreen />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Филиалы и залы' })).toBeVisible()
    expect(screen.getAllByText('Центр').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Добавить филиал' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeVisible()
    expect(screen.getByText('Залов: 2 · Групп: 4 · Клиентов: 12')).toBeVisible()
    expect(screen.queryByText('Всего заведенных филиалов')).not.toBeInTheDocument()
    expect(screen.queryByText('Активные залы во всех филиалах')).not.toBeInTheDocument()
    expect(document.querySelector('.settings-branch-details .hint-card')).not.toBeInTheDocument()
    expect(document.querySelector('.metric-card')).not.toBeInTheDocument()
  })

  test('keeps the embedded settings actions directly before operational content', async () => {
    vi.mocked(getBranches).mockResolvedValue(branches)
    vi.mocked(getHalls).mockResolvedValue(halls)

    const { container } = renderWithProviders(<BranchSettingsScreen embedded />)

    const firstBranch = await screen.findByRole('button', { name: 'Открыть филиал Центр' })
    const sections = container.querySelectorAll('.page-section')
    const toolbar = container.querySelector('.task-toolbar-actions')

    expect(screen.queryByRole('heading', { name: 'Филиалы и залы' })).not.toBeInTheDocument()
    expect(sections).toHaveLength(1)
    expect(toolbar).toBeInstanceOf(HTMLElement)
    expect(
      toolbar!.compareDocumentPosition(firstBranch) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Добавить филиал' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeVisible()
    expect(document.querySelector('.metric-card')).not.toBeInTheDocument()
    expect(document.querySelector('.settings-branch-details .hint-card')).not.toBeInTheDocument()
  })

  test('shows settings load error state and supports retry without locking actions', async () => {
    vi.mocked(getBranches).mockRejectedValueOnce(new Error('branches failed')).mockResolvedValue(branches)
    vi.mocked(getHalls).mockRejectedValueOnce(new Error('halls failed')).mockResolvedValue(halls)

    renderWithProviders(<BranchSettingsScreen />)

    expect(await screen.findByText('Настройки не загрузились')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))

    await waitFor(() => expect(screen.getAllByText('Центр').length).toBeGreaterThan(0))
    expect(vi.mocked(getBranches)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(getHalls)).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: 'Добавить филиал' })).toBeEnabled()
    await waitFor(() => expect(document.querySelector('.metric-card')).not.toBeInTheDocument())
  })
})
