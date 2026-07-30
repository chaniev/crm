import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { createGroupListReturnSnapshot } from './groupListReturnState'

const apiMocks = vi.hoisted(() => ({
  createGroupTrainerSubstitution: vi.fn(),
  getBranches: vi.fn(),
  getGroup: vi.fn(),
  getGroupClients: vi.fn(),
  getGroups: vi.fn(),
  getGroupSummary: vi.fn(),
  getGroupTrainerSubstitutions: vi.fn(),
  getGroupTypes: vi.fn(),
  getHalls: vi.fn(),
  getTrainerOptions: vi.fn(),
  updateGroup: vi.fn(),
}))

vi.mock('../../lib/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../lib/api')>(),
  createGroupTrainerSubstitution: apiMocks.createGroupTrainerSubstitution,
  getBranches: apiMocks.getBranches,
  getGroup: apiMocks.getGroup,
  getGroupClients: apiMocks.getGroupClients,
  getGroups: apiMocks.getGroups,
  getGroupSummary: apiMocks.getGroupSummary,
  getGroupTrainerSubstitutions: apiMocks.getGroupTrainerSubstitutions,
  getGroupTypes: apiMocks.getGroupTypes,
  getHalls: apiMocks.getHalls,
  getTrainerOptions: apiMocks.getTrainerOptions,
  updateGroup: apiMocks.updateGroup,
}))

import { GroupEditScreen, GroupsListScreen } from './GroupManagement'

const group = {
  id: 'group-1', name: 'Утренняя', branchId: 'branch-1', branchName: 'Центр',
  hallId: 'hall-1', hallName: 'Большой', groupTypeId: 'type-1', groupTypeName: 'Общая',
  trainingStartTime: '09:00', durationMinutes: 60, weekdays: [1], isActive: true,
  trainers: [], trainerIds: [], trainerCount: 0, trainerNames: [], clientCount: 2,
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

describe('GroupsListScreen', () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('loads first page with canonical page query args and removes legacy take-only load contract', async () => {
    apiMocks.getGroups.mockResolvedValue({ items: [group], totalCount: 1, skip: 0, take: 10 })
    apiMocks.getGroupSummary.mockRejectedValue(new Error('summary failed'))

    renderWithProviders(<GroupsListScreen onCreate={vi.fn()} onEdit={vi.fn()} />)

    await waitFor(() => expect(apiMocks.getGroups).toHaveBeenCalled())

    const firstCall = apiMocks.getGroups.mock.calls[0]?.[0] as {
      page?: number
      pageSize?: number
      take?: number
    } | undefined

    expect(firstCall).toMatchObject({ page: 1, pageSize: 10 })
    expect(firstCall?.take).toBeUndefined()
  })

  test('search input applies trimmed query only after debounce and keeps first-page baseline', async () => {
    apiMocks.getGroups.mockResolvedValue({ items: [group], totalCount: 1, skip: 0, take: 10 })
    const getGroupsSpy = vi.fn((params) => params)
    apiMocks.getGroups.mockImplementation((params) => {
      getGroupsSpy(params)
      return Promise.resolve({ items: [group], totalCount: 1, skip: 0, take: 10 })
    })

    renderWithProviders(<GroupsListScreen onCreate={vi.fn()} onEdit={vi.fn()} />)
    await waitFor(() => expect(apiMocks.getGroups).toHaveBeenCalledTimes(1))

    const queryInput = screen.getByRole('textbox', { name: 'Поиск групп по названию' })
    fireEvent.change(queryInput, { target: { value: '  Утренняя  ' } })
    await wait(100)
    expect(apiMocks.getGroups).toHaveBeenCalledTimes(1)

    fireEvent.blur(queryInput)
    await waitFor(() => expect(apiMocks.getGroups).toHaveBeenCalledTimes(2))

    expect(getGroupsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        query: 'Утренняя',
        page: 1,
      }),
    )
  })

  test('renders locator-first registry without summary metrics and keeps actions available', async () => {
    apiMocks.getGroups.mockResolvedValue({ items: [group], totalCount: 1, skip: 0, take: 10 })
    const onCreate = vi.fn()
    renderWithProviders(<GroupsListScreen onCreate={onCreate} onEdit={vi.fn()} />)

    expect(await screen.findByText('Утренняя')).toBeVisible()
    expect(screen.getByRole('search')).toBeVisible()
    expect(screen.getByRole('search')).toHaveClass('entity-locator-bar', 'crm-filter-surface')
    expect(screen.queryByText('Поиск групп по названию')).not.toBeInTheDocument()
    expect(screen.getByText('Тренер не назначен')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Редактировать группу «Утренняя»' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Обновить список групп' })).toHaveClass(
      'task-toolbar-action--refresh',
    )
    expect(screen.getByRole('button', { name: 'Новая группа' })).toHaveClass(
      'task-toolbar-action--primary',
    )
    expect(screen.queryByText('Всего')).not.toBeInTheDocument()
    expect(screen.queryByText('Клиентов: 2')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Новая группа' }))
    expect(onCreate).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Обновить список групп' }))
    await waitFor(() => expect(apiMocks.getGroups).toHaveBeenCalledTimes(2))
  })

  test('keeps stale rows when refresh fails and retry preserves current criteria', async () => {
    apiMocks.getGroups
      .mockResolvedValueOnce({ items: [group], totalCount: 1, skip: 0, take: 10 })
      .mockRejectedValueOnce(new Error('list failed'))
      .mockResolvedValueOnce({ items: [group], totalCount: 1, skip: 0, take: 10 })
    renderWithProviders(<GroupsListScreen onCreate={vi.fn()} onEdit={vi.fn()} />)

    expect(await screen.findByText('Утренняя')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Обновить список групп' }))
    expect(await screen.findByText('Обновление списка не загрузилось')).toBeVisible()
    expect(screen.getByText('Утренняя')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    await waitFor(() => expect(apiMocks.getGroups).toHaveBeenCalledTimes(3))
  })

  test('shows blocking retry state without summary dependency when first load fails', async () => {
    apiMocks.getGroups.mockRejectedValue(new Error('list failed'))
    renderWithProviders(<GroupsListScreen onCreate={vi.fn()} onEdit={vi.fn()} />)

    expect(await screen.findByText('Список групп не загрузился')).toBeVisible()
    expect(screen.queryByText('100')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    await waitFor(() => {
      expect(apiMocks.getGroups).toHaveBeenCalledTimes(2)
    })
    expect(screen.getByRole('button', { name: 'Новая группа' })).toBeEnabled()
    expect(screen.getByRole('heading', { level: 1, name: 'Группы' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Список групп' })).toBeInTheDocument()
  })

  test('applies filters immediately and reset clears search and filters', async () => {
    apiMocks.getGroups.mockResolvedValue({ items: [group], totalCount: 1, skip: 0, take: 10 })

    renderWithProviders(<GroupsListScreen onCreate={vi.fn()} onEdit={vi.fn()} />)
    await waitFor(() => expect(apiMocks.getGroups).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: 'Открыть фильтры' }))
    fireEvent.click(await screen.findByRole('combobox', { name: 'Статус' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Неактивные' }))
    await waitFor(() => expect(apiMocks.getGroups).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: 'Удалить фильтр «Неактивные»' })).toBeVisible()
    expect(apiMocks.getGroups).toHaveBeenLastCalledWith(
      expect.objectContaining({ isActive: false, page: 1, pageSize: 10 }),
      expect.any(AbortSignal),
    )

    fireEvent.click(screen.getByRole('switch', { name: 'Без тренера' }))
    await waitFor(() => expect(apiMocks.getGroups).toHaveBeenCalledTimes(3))
    expect(apiMocks.getGroups).toHaveBeenLastCalledWith(
      expect.objectContaining({ isActive: false, withoutTrainer: true }),
      expect.any(AbortSignal),
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'Поиск групп по названию' }), {
      target: { value: '  вечер  ' },
    })
    await wait(250)
    await waitFor(() => expect(apiMocks.getGroups).toHaveBeenCalledTimes(4))
    expect(screen.getByRole('button', { name: 'Удалить фильтр «Поиск: вечер»' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Сбросить все' }))
    await waitFor(() => expect(apiMocks.getGroups).toHaveBeenCalledTimes(5))
    expect(apiMocks.getGroups).toHaveBeenLastCalledWith(
      { page: 1, pageSize: 10 },
      expect.any(AbortSignal),
    )
  })

  test('filtered empty maps recovery action to search or all criteria', async () => {
    apiMocks.getGroups.mockResolvedValue({ items: [], totalCount: 0, skip: 0, take: 10 })

    renderWithProviders(<GroupsListScreen onCreate={vi.fn()} onEdit={vi.fn()} />)

    expect(await screen.findByRole('button', { name: 'Новая группа' })).toBeVisible()
    const queryInput = screen.getByRole('textbox', { name: 'Поиск групп по названию' })
    fireEvent.change(queryInput, { target: { value: 'поиск' } })
    fireEvent.blur(queryInput)
    expect(await screen.findByRole('button', { name: 'Очистить поиск' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Открыть фильтры' }))
    fireEvent.click(await screen.findByRole('switch', { name: 'Без тренера' }))
    expect(await screen.findByRole('button', { name: 'Сбросить все' })).toBeVisible()
  })

  test('restored error state completes recovery focus without reopening search', async () => {
    apiMocks.getGroups.mockRejectedValue(new Error('list failed'))
    const snapshot = createGroupListReturnSnapshot({
      filters: {
        appliedQuery: 'Утренняя',
        isActive: null,
        withoutTrainer: false,
      },
      searchDraft: 'Утренняя',
      page: 1,
      selectedGroupId: 'group-1',
      scrollY: 0,
      originEntryKey: 'groups:seed',
      returnDepth: 1,
    })

    renderWithProviders(
      <GroupsListScreen
        initialReturnSnapshot={snapshot}
        onCreate={vi.fn()}
        onEdit={vi.fn()}
      />,
    )

    const retry = await screen.findByRole('button', { name: 'Повторить' })
    await waitFor(() => expect(retry).toHaveFocus())
    expect(screen.getByRole('textbox', { name: 'Поиск групп по названию' })).not.toHaveFocus()
  })

  test('pagination exposes Russian previous, next and current page labels', async () => {
    apiMocks.getGroups.mockResolvedValue({ items: [group], totalCount: 25, skip: 0, take: 10 })

    renderWithProviders(<GroupsListScreen onCreate={vi.fn()} onEdit={vi.fn()} />)

    expect(await screen.findByRole('button', { name: 'Страница 1, текущая' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Назад' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Дальше' })).toBeEnabled()
  })
})

describe('GroupEditScreen', () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('keeps permanent trainerIds unchanged after creating a temporary substitution', async () => {
    apiMocks.getGroup.mockResolvedValue({
      ...group,
      trainers: [{ id: 'trainer-main', fullName: 'Основной Тренер', login: 'main' }],
      trainerIds: ['trainer-main'],
      trainerCount: 1,
      trainerNames: ['Основной Тренер'],
      createdAt: '2026-07-01T10:00:00Z',
      updatedAt: '2026-07-20T10:00:00Z',
    })
    apiMocks.getBranches.mockResolvedValue([
      { id: 'branch-1', name: 'Центр', address: 'Адрес', isArchived: false },
    ])
    apiMocks.getHalls.mockResolvedValue([
      { id: 'hall-1', branchId: 'branch-1', name: 'Большой', isArchived: false },
    ])
    apiMocks.getGroupTypes.mockResolvedValue([
      { id: 'type-1', name: 'Общая', description: null, groupCount: 1 },
    ])
    apiMocks.getTrainerOptions.mockResolvedValue([
      { id: 'trainer-main', fullName: 'Основной Тренер', login: 'main' },
      { id: 'trainer-substitute', fullName: 'Замещающий Тренер', login: 'sub' },
    ])
    apiMocks.getGroupClients.mockResolvedValue({ groupId: 'group-1', clients: [] })
    apiMocks.getGroupTrainerSubstitutions.mockResolvedValue({
      current: [],
      history: { items: [], totalCount: 0, skip: 0, take: 20 },
      canCreate: true,
      createUnavailableReason: null,
    })
    apiMocks.createGroupTrainerSubstitution.mockResolvedValue({
      id: 'substitution-1',
      groupId: 'group-1',
      substituteTrainer: {
        id: 'trainer-substitute',
        fullName: 'Замещающий Тренер',
        login: 'sub',
        isActive: true,
      },
      startsOn: '2026-08-01',
      endsOn: '2026-08-05',
      status: 'Upcoming',
      cancelledAt: null,
      createdAt: '2026-07-25T08:00:00Z',
      updatedAt: '2026-07-25T08:00:00Z',
      allowedActions: { canEdit: true, canCancel: true },
    })
    apiMocks.updateGroup.mockResolvedValue({
      ...group,
      trainerIds: ['trainer-main'],
      trainers: [{ id: 'trainer-main', fullName: 'Основной Тренер', login: 'main' }],
      createdAt: '2026-07-01T10:00:00Z',
      updatedAt: '2026-07-25T10:00:00Z',
    })

    renderWithProviders(
      <GroupEditScreen groupId="group-1" onBack={vi.fn()} onUpdated={vi.fn()} />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Назначить замещение' }))
    fireEvent.click(
      await screen.findByRole('combobox', { name: 'Замещающий тренер' }),
    )
    fireEvent.click(await screen.findByRole('option', { name: 'Замещающий Тренер (sub)' }))
    fireEvent.change(screen.getByLabelText('Начало периода'), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText('Окончание периода'), { target: { value: '2026-08-05' } })
    fireEvent.click(screen.getByRole('button', { name: 'Создать замещение' }))

    await waitFor(() => expect(apiMocks.createGroupTrainerSubstitution).toHaveBeenCalledWith(
      'group-1',
      {
        substituteTrainerId: 'trainer-substitute',
        startsOn: '2026-08-01',
        endsOn: '2026-08-05',
      },
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }))

    await waitFor(() => expect(apiMocks.updateGroup).toHaveBeenCalledWith(
      'group-1',
      expect.objectContaining({
        trainerIds: ['trainer-main'],
      }),
    ))
  })
})
