import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { ApiError, createBranch, createHall, getBranches, getHalls, type Branch, type Hall } from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import { showAppNotification } from '../shared/notifications'
import { BranchSettingsScreen } from './BranchSettingsScreen'

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  createBranch: vi.fn(),
  createHall: vi.fn(),
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

beforeAll(() => {
  Object.defineProperty(document, 'fonts', { configurable: true, value: { addEventListener: vi.fn(), removeEventListener: vi.fn() } })
})

beforeEach(() => {
  vi.mocked(createBranch).mockReset()
  vi.mocked(createHall).mockReset()
  vi.mocked(getBranches).mockReset()
  vi.mocked(getHalls).mockReset()
  vi.mocked(showAppNotification).mockReset()
})

describe('BranchSettingsScreen', () => {
  test('renders branch rows without top metrics and keeps primary operations visible', async () => {
    vi.mocked(getBranches).mockResolvedValue(branches)
    vi.mocked(getHalls).mockResolvedValue(halls)

    renderWithProviders(<BranchSettingsScreen actions={['View', 'CreateBranch', 'UpdateBranch', 'ArchiveBranch', 'RestoreBranch', 'CreateHall', 'UpdateHall', 'ArchiveHall', 'RestoreHall', 'DeleteHall']} />)

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

    const { container } = renderWithProviders(<BranchSettingsScreen actions={['View', 'CreateBranch', 'UpdateBranch', 'ArchiveBranch', 'RestoreBranch', 'CreateHall', 'UpdateHall', 'ArchiveHall', 'RestoreHall', 'DeleteHall']} embedded />)

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

    renderWithProviders(<BranchSettingsScreen actions={['View', 'CreateBranch', 'UpdateBranch', 'ArchiveBranch', 'RestoreBranch', 'CreateHall', 'UpdateHall', 'ArchiveHall', 'RestoreHall', 'DeleteHall']} />)

    expect(await screen.findByText('Настройки не загрузились')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))

    await waitFor(() => expect(screen.getAllByText('Центр').length).toBeGreaterThan(0))
    expect(vi.mocked(getBranches)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(getHalls)).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: 'Добавить филиал' })).toBeEnabled()
    await waitFor(() => expect(document.querySelector('.metric-card')).not.toBeInTheDocument())
  })

  test('preserves keyboard branch selection and gives every hall action an explicit 44px touch hook', async () => {
    vi.mocked(getBranches).mockResolvedValue(branches)
    vi.mocked(getHalls).mockResolvedValue(halls)

    renderWithProviders(<BranchSettingsScreen actions={['View', 'CreateBranch', 'UpdateBranch', 'ArchiveBranch', 'RestoreBranch', 'CreateHall', 'UpdateHall', 'ArchiveHall', 'RestoreHall', 'DeleteHall']} embedded />)

    const branch = await screen.findByRole('button', { name: 'Открыть филиал Центр' })
    expect(branch).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(branch, { key: 'Enter' })
    expect(branch).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(branch, { key: ' ' })
    expect(branch).toHaveAttribute('aria-selected', 'true')

    const hallActions = [
      screen.getByRole('button', { name: 'Редактировать зал Зал №1' }),
      screen.getByRole('button', { name: 'Архивировать зал Зал №1' }),
      screen.getByRole('button', { name: 'Удалить зал Зал №1' }),
    ]

    for (const action of hallActions) {
      expect(action.style.getPropertyValue('--ai-size')).toContain('2.75rem')
    }
  })
})


test('create-only actions hide destructive controls and revoked create prevents stale form submission', async () => {
  vi.mocked(getBranches).mockResolvedValue(branches)
  vi.mocked(getHalls).mockResolvedValue(halls)
  const { rerender } = renderWithProviders(<BranchSettingsScreen actions={['View', 'CreateBranch', 'CreateHall']} />)
  await screen.findByRole('button', { name: 'Добавить зал' })
  expect(screen.queryByRole('button', { name: /Редактировать|Архивировать|Удалить/ })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Добавить филиал' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Название филиала'), { target: { value: 'Новый филиал' } })
  rerender(<BranchSettingsScreen actions={['View', 'CreateHall']} />)
  expect(within(dialog).getByRole('button', { name: 'Сохранить' })).toBeDisabled()
  fireEvent.submit(dialog.querySelector('form')!)
  expect(createBranch).not.toHaveBeenCalled()
  expect(within(dialog).getByLabelText('Название филиала')).toHaveValue('Новый филиал')
  await waitFor(() => expect(within(dialog).getByRole('alert')).toBeVisible())
  fireEvent.click(within(dialog).getByRole('button', { name: 'Отменить' }))
  await waitFor(() => expect(dialog).not.toBeInTheDocument())
})

test('hall parent error remains inside dialog with values and allows retry without duplicate submission', async () => {
  vi.mocked(getBranches).mockResolvedValue(branches)
  vi.mocked(getHalls).mockResolvedValue(halls)
  vi.mocked(createHall).mockRejectedValueOnce(new ApiError('Проверьте поля', 400, { branchId: ['Филиал должен быть активным.'] }))
  let resolveCreate!: (hall: Hall) => void
  renderWithProviders(<BranchSettingsScreen actions={['View', 'CreateHall']} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Добавить зал' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Название зала'), { target: { value: 'Новый зал' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }))
  expect(await within(dialog).findByText('Филиал должен быть активным.')).toBeVisible()
  expect(within(dialog).getByLabelText('Название зала')).toHaveValue('Новый зал')
  expect(screen.getAllByText('Филиал должен быть активным.')).toHaveLength(1)
  vi.mocked(createHall).mockReset().mockReturnValue(new Promise((resolve) => { resolveCreate = resolve }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }))
  fireEvent.submit(dialog.querySelector('form')!)
  expect(createHall).toHaveBeenCalledTimes(1)
  expect(within(dialog).getByRole('button', { name: 'Сохранить' })).toBeDisabled()
  resolveCreate({ ...halls[0], name: 'Новый зал' })
  await waitFor(() => expect(dialog).not.toBeInTheDocument())
})

test.each([
  ['CreateBranch', 'Добавить филиал', false],
  ['UpdateBranch', 'Редактировать', false],
  ['ArchiveBranch', 'В архив', false],
  ['RestoreBranch', 'Вернуть', true],
  ['CreateHall', 'Добавить зал', false],
  ['UpdateHall', 'Редактировать зал Зал №1', false],
  ['ArchiveHall', 'Архивировать зал Зал №1', false],
  ['RestoreHall', 'Вернуть зал Зал №1', true],
  ['DeleteHall', 'Удалить зал Зал №1', false],
] as const)('shows %s only when its own action exists', async (action, label, archived) => {
  vi.mocked(getBranches).mockResolvedValue([{ ...branches[0], isArchived: archived }])
  vi.mocked(getHalls).mockResolvedValue([{ ...halls[0], isArchived: archived }])
  const { rerender } = renderWithProviders(<BranchSettingsScreen actions={['View', action]} />)
  expect(await screen.findByRole('button', { name: label })).toBeVisible()
  rerender(<BranchSettingsScreen actions={['View']} />)
  expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument()
})

test('no View prevents dictionary requests, including actions without View', () => {
  const { rerender } = renderWithProviders(<BranchSettingsScreen />)
  expect(getBranches).not.toHaveBeenCalled()
  expect(getHalls).not.toHaveBeenCalled()
  rerender(<BranchSettingsScreen actions={['CreateBranch', 'CreateHall']} />)
  expect(getBranches).not.toHaveBeenCalled()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('revoking hall creation retains input and blocks form submit', async () => {
  vi.mocked(getBranches).mockResolvedValue(branches)
  vi.mocked(getHalls).mockResolvedValue(halls)
  const { rerender } = renderWithProviders(<BranchSettingsScreen actions={['View', 'CreateHall']} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Добавить зал' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Название зала'), { target: { value: 'Новый зал' } })
  rerender(<BranchSettingsScreen actions={['View']} />)
  expect(within(dialog).getByRole('button', { name: 'Сохранить' })).toBeDisabled()
  fireEvent.submit(dialog.querySelector('form')!)
  expect(createHall).not.toHaveBeenCalled()
  expect(within(dialog).getByLabelText('Название зала')).toHaveValue('Новый зал')
})

test('branch forbidden error stays in the form and duplicate submits are blocked during retry', async () => {
  vi.mocked(getBranches).mockResolvedValue(branches)
  vi.mocked(getHalls).mockResolvedValue(halls)
  vi.mocked(createBranch).mockRejectedValueOnce(new ApiError('Доступ запрещён', 403))
  renderWithProviders(<BranchSettingsScreen actions={['View', 'CreateBranch']} />)
  fireEvent.click(screen.getByRole('button', { name: 'Добавить филиал' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Название филиала'), { target: { value: 'Новый филиал' } })
  fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }))
  expect(await within(dialog).findByText('Доступ запрещён')).toBeVisible()
  expect(within(dialog).getByLabelText('Название филиала')).toHaveValue('Новый филиал')
  let resolve!: (branch: Branch) => void
  vi.mocked(createBranch).mockReset().mockReturnValue(new Promise((done) => { resolve = done }))
  fireEvent.submit(dialog.querySelector('form')!)
  fireEvent.submit(dialog.querySelector('form')!)
  expect(createBranch).toHaveBeenCalledTimes(1)
  resolve({ ...branches[0], id: 'new', name: 'Новый филиал' })
  await waitFor(() => expect(dialog).not.toBeInTheDocument())
})
