import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ApiError } from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import { createClientProfileReturnContext } from '../clients/clientProfileReturnState'
import { createGroupListReturnSnapshot } from './groupListReturnState'

const apiMocks = vi.hoisted(() => ({
  createGroup: vi.fn(),
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
  createGroup: apiMocks.createGroup,
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

import {
  GroupCreateScreen,
  GroupEditScreen,
  GroupsListScreen,
} from './GroupManagement'

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

  test('keeps one header return and only submit in edit while create keeps cancel', async () => {
    setupGroupFormOptions()
    apiMocks.getGroup.mockResolvedValue({
      ...group,
      createdAt: '2026-07-01T10:00:00Z',
      updatedAt: '2026-07-20T10:00:00Z',
    })
    apiMocks.getGroupClients.mockResolvedValue({ groupId: 'group-1', clients: [] })
    apiMocks.getGroupTrainerSubstitutions.mockResolvedValue({
      current: [],
      history: { items: [], totalCount: 0, skip: 0, take: 20 },
      canCreate: true,
      createUnavailableReason: null,
    })

    const editView = renderWithProviders(
      <GroupEditScreen groupId="group-1" onBack={vi.fn()} onUpdated={vi.fn()} />,
    )

    expect(await screen.findByRole('button', { name: 'Сохранить изменения' })).toBeVisible()
    expect(screen.getAllByRole('button', { name: 'К списку групп' })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Отменить' })).not.toBeInTheDocument()

    editView.unmount()
    Object.values(apiMocks).forEach((mock) => mock.mockReset())
    setupGroupFormOptions()

    renderWithProviders(
      <GroupCreateScreen onCancel={vi.fn()} onCreated={vi.fn()} />,
    )

    expect(await screen.findByRole('button', { name: 'Создать группу' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Отменить' })).toBeVisible()
  })

  test('create sends the exact schedule payload, keeps backend field errors and retries', async () => {
    setupGroupFormOptions()
    apiMocks.createGroup
      .mockRejectedValueOnce(new ApiError('Проверьте поля группы.', 400, {
        Name: ['Группа с таким названием уже существует.'],
        TrainingStartTime: ['Время начала недоступно.'],
      }))
      .mockResolvedValue({
        ...group,
        name: 'Новая группа',
        trainingStartTime: '18:30',
        durationMinutes: 75,
        weekdays: [3, 5],
      })
    const onCreated = vi.fn()

    renderWithProviders(
      <GroupCreateScreen onCancel={vi.fn()} onCreated={onCreated} />,
    )

    const nameInput = await screen.findByRole('textbox', { name: 'Название группы' })
    fireEvent.change(nameInput, { target: { value: '  Новая группа  ' } })
    fireEvent.change(screen.getByLabelText('Время начала'), {
      target: { value: '18:30' },
    })
    fireEvent.change(screen.getByLabelText('Длительность'), {
      target: { value: '75' },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ср' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Пт' }))
    fireEvent.click(screen.getByRole('button', { name: 'Создать группу' }))

    const exactPayload = {
      name: 'Новая группа',
      branchId: 'branch-1',
      hallId: undefined,
      groupTypeId: 'type-1',
      trainingStartTime: '18:30',
      durationMinutes: 75,
      weekdays: [3, 5],
      isActive: true,
      trainerIds: [],
    }
    await waitFor(() => expect(apiMocks.createGroup).toHaveBeenCalledWith(exactPayload))
    expect(await screen.findByText('Группа с таким названием уже существует.')).toBeVisible()
    expect(screen.getByText('Время начала недоступно.')).toBeVisible()
    expect(nameInput).toHaveValue('  Новая группа  ')
    expect(onCreated).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Создать группу' }))
    await waitFor(() => expect(apiMocks.createGroup).toHaveBeenCalledTimes(2))
    expect(apiMocks.createGroup).toHaveBeenLastCalledWith(exactPayload)
    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce())
  })

  test('edit sends the exact full-update payload and maps backend errors to current fields', async () => {
    setupGroupFormOptions()
    apiMocks.getGroup.mockResolvedValue({
      ...group,
      trainers: [{ id: 'trainer-main', fullName: 'Основной Тренер', login: 'main' }],
      trainerIds: ['trainer-main'],
      createdAt: '2026-07-01T10:00:00Z',
      updatedAt: '2026-07-20T10:00:00Z',
    })
    apiMocks.getTrainerOptions.mockResolvedValue([
      { id: 'trainer-main', fullName: 'Основной Тренер', login: 'main' },
    ])
    apiMocks.getGroupClients.mockResolvedValue({ groupId: 'group-1', clients: [] })
    apiMocks.getGroupTrainerSubstitutions.mockResolvedValue({
      current: [],
      history: { items: [], totalCount: 0, skip: 0, take: 20 },
      canCreate: true,
      createUnavailableReason: null,
    })
    apiMocks.updateGroup.mockRejectedValue(new ApiError('Проверьте поля группы.', 400, {
      Name: ['Название отклонено сервером.'],
      TrainerIds: ['Состав основных тренеров недоступен.'],
    }))
    const onUpdated = vi.fn()

    renderWithProviders(
      <GroupEditScreen groupId="group-1" onBack={vi.fn()} onUpdated={onUpdated} />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Сохранить изменения' }))

    await waitFor(() => expect(apiMocks.updateGroup).toHaveBeenCalledWith('group-1', {
      name: 'Утренняя',
      branchId: 'branch-1',
      hallId: 'hall-1',
      groupTypeId: 'type-1',
      trainingStartTime: '09:00',
      durationMinutes: 60,
      weekdays: [1],
      isActive: true,
      trainerIds: ['trainer-main'],
    }))
    expect(await screen.findByText('Название отклонено сервером.')).toBeVisible()
    expect(screen.getByText('Состав основных тренеров недоступен.')).toBeVisible()
    expect(screen.getByRole('textbox', { name: 'Название группы' })).toHaveValue('Утренняя')
    expect(onUpdated).not.toHaveBeenCalled()
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

  test('does not render locator summary metrics on group edit form', async () => {
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
    ])
    apiMocks.getGroupClients.mockResolvedValue({ groupId: 'group-1', clients: [] })
    apiMocks.getGroupTrainerSubstitutions.mockResolvedValue({
      current: [],
      history: { items: [], totalCount: 0, skip: 0, take: 20 },
      canCreate: true,
      createUnavailableReason: null,
    })

    renderWithProviders(
      <GroupEditScreen groupId="group-1" onBack={vi.fn()} onUpdated={vi.fn()} />,
    )

    expect(await screen.findByText('Название группы')).toBeVisible()
    expect(screen.queryByText('Клиенты, уже привязанные к группе')).not.toBeInTheDocument()
    expect(screen.queryByText('Доступных для выбора активных тренеров')).not.toBeInTheDocument()
    expect(screen.queryByText('Назначено')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Сохранить изменения' })).toBeVisible()
    expect(screen.queryByText('Клиенты группы')).toBeVisible()
    expect(document.querySelector('.metric-card')).not.toBeInTheDocument()
  })

  test('keeps back action available when group edit load fails and hides form body', async () => {
    const onBack = vi.fn()
    apiMocks.getGroup.mockRejectedValue(new Error('group load failed'))
    apiMocks.getBranches.mockResolvedValue([{ id: 'branch-1', name: 'Центр', isArchived: false }])
    apiMocks.getHalls.mockResolvedValue([])
    apiMocks.getGroupTypes.mockResolvedValue([])
    apiMocks.getTrainerOptions.mockResolvedValue([])
    apiMocks.getGroupClients.mockResolvedValue({ groupId: 'group-1', clients: [] })

    renderWithProviders(
      <GroupEditScreen groupId="group-1" onBack={onBack} onUpdated={vi.fn()} />,
    )

    expect(await screen.findByText('Экран редактирования не загрузился')).toBeVisible()
    expect(screen.getByRole('button', { name: 'К списку групп' })).toBeVisible()
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'К списку групп' }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  test('retains edited values after save failure and succeeds on retry without losing state', async () => {
    const onUpdated = vi.fn()
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
      { id: 'trainer-sub', fullName: 'Запасной', login: 'sub' },
    ])
    apiMocks.getGroupClients.mockResolvedValue({ groupId: 'group-1', clients: [] })
    apiMocks.getGroupTrainerSubstitutions.mockResolvedValue({
      current: [],
      history: { items: [], totalCount: 0, skip: 0, take: 20 },
      canCreate: true,
      createUnavailableReason: null,
    })
    apiMocks.updateGroup
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValue({
        ...group,
        name: 'Группа 11 обновлена',
        trainerIds: ['trainer-main'],
      })

    renderWithProviders(
      <GroupEditScreen groupId="group-1" onBack={vi.fn()} onUpdated={onUpdated} />,
    )

    const nameInput = await screen.findByRole('textbox', { name: 'Название группы' })
    fireEvent.change(nameInput, { target: { value: 'Группа 11 обновлена' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }))

    await waitFor(() =>
      expect(screen.getByText('Сохранение не выполнено')).toBeVisible(),
    )
    await waitFor(() => expect(nameInput).toHaveValue('Группа 11 обновлена'))

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }))
    await waitFor(() => expect(apiMocks.updateGroup).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(onUpdated).toHaveBeenCalledOnce())
    expect(screen.queryByText('Сохранение не выполнено')).not.toBeInTheDocument()
  })

  test('opens an exact client immediately from a pristine group form', async () => {
    setupGroupEditWithClient()
    const onOpenClient = vi.fn()

    renderWithProviders(
      <GroupEditScreen
        groupId="group-1"
        onBack={vi.fn()}
        onOpenClient={onOpenClient}
        onUpdated={vi.fn()}
      />,
    )

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Открыть карточку клиента Иван Иванов',
      }),
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onOpenClient).toHaveBeenCalledWith(
      'client-1',
      {
        kind: 'groupEdit',
        route: { kind: 'groupEdit', groupId: 'group-1' },
        anchorClientId: 'client-1',
      },
    )
  })

  test('restores focus to the originating group client action after return', async () => {
    setupGroupEditWithClient()
    const initialReturnContext = createClientProfileReturnContext({
      origin: {
        kind: 'groupEdit',
        route: { kind: 'groupEdit', groupId: 'group-1' },
        anchorClientId: 'client-1',
      },
      originEntryKey: 'client-profile:group-focus',
      returnDepth: 0,
    })

    renderWithProviders(
      <GroupEditScreen
        groupId="group-1"
        initialReturnContext={initialReturnContext}
        onBack={vi.fn()}
        onOpenClient={vi.fn()}
        onUpdated={vi.fn()}
      />,
    )

    const profileAction = await screen.findByRole('button', {
      name: 'Открыть карточку клиента Иван Иванов',
    })
    await waitFor(() => expect(profileAction).toHaveFocus())
  })

  test('keeps a dirty draft and returns focus when profile navigation is cancelled', async () => {
    setupGroupEditWithClient()
    const onOpenClient = vi.fn()

    renderWithProviders(
      <GroupEditScreen
        groupId="group-1"
        onBack={vi.fn()}
        onOpenClient={onOpenClient}
        onUpdated={vi.fn()}
      />,
    )

    const nameInput = await screen.findByRole('textbox', { name: 'Название группы' })
    fireEvent.change(nameInput, { target: { value: 'Черновик группы' } })
    const profileAction = screen.getByRole('button', {
      name: 'Открыть карточку клиента Иван Иванов',
    })
    fireEvent.click(profileAction)

    expect(
      await screen.findByRole('heading', { name: 'Сохранить изменения в группе?' }),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Не сохранять' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(nameInput).toHaveValue('Черновик группы')
    expect(onOpenClient).not.toHaveBeenCalled()
    await waitFor(() => expect(profileAction).toHaveFocus())
  })

  test('explicitly discards a dirty draft without updating and opens the exact client', async () => {
    setupGroupEditWithClient()
    const onOpenClient = vi.fn()

    renderWithProviders(
      <GroupEditScreen
        groupId="group-1"
        onBack={vi.fn()}
        onOpenClient={onOpenClient}
        onUpdated={vi.fn()}
      />,
    )

    fireEvent.change(await screen.findByRole('textbox', { name: 'Название группы' }), {
      target: { value: 'Черновик группы' },
    })
    fireEvent.click(screen.getByRole('button', {
      name: 'Открыть карточку клиента Иван Иванов',
    }))
    fireEvent.click(await screen.findByRole('button', { name: 'Не сохранять' }))

    expect(apiMocks.updateGroup).not.toHaveBeenCalled()
    expect(onOpenClient).toHaveBeenCalledWith(
      'client-1',
      expect.objectContaining({
        kind: 'groupEdit',
        anchorClientId: 'client-1',
      }),
    )
  })

  test('saves a dirty form once and opens the client only after update succeeds', async () => {
    setupGroupEditWithClient()
    const onOpenClient = vi.fn()
    apiMocks.updateGroup.mockResolvedValue({
      ...group,
      name: 'Сохраненная группа',
      createdAt: '2026-07-01T10:00:00Z',
      updatedAt: '2026-08-16T10:00:00Z',
    })

    renderWithProviders(
      <GroupEditScreen
        groupId="group-1"
        onBack={vi.fn()}
        onOpenClient={onOpenClient}
        onUpdated={vi.fn()}
      />,
    )

    fireEvent.change(await screen.findByRole('textbox', { name: 'Название группы' }), {
      target: { value: 'Сохраненная группа' },
    })
    fireEvent.click(screen.getByRole('button', {
      name: 'Открыть карточку клиента Иван Иванов',
    }))
    fireEvent.click(await screen.findByRole('button', { name: 'Сохранить' }))

    await waitFor(() => expect(apiMocks.updateGroup).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onOpenClient).toHaveBeenCalledTimes(1))
    expect(onOpenClient).toHaveBeenCalledWith(
      'client-1',
      expect.objectContaining({ kind: 'groupEdit', anchorClientId: 'client-1' }),
    )
  })

  test('keeps a dirty draft and does not navigate after an update failure', async () => {
    setupGroupEditWithClient()
    const onOpenClient = vi.fn()
    apiMocks.updateGroup.mockRejectedValue(new Error('temporary'))

    renderWithProviders(
      <GroupEditScreen
        groupId="group-1"
        onBack={vi.fn()}
        onOpenClient={onOpenClient}
        onUpdated={vi.fn()}
      />,
    )

    const nameInput = await screen.findByRole('textbox', { name: 'Название группы' })
    fireEvent.change(nameInput, { target: { value: 'Несохраненный черновик' } })
    fireEvent.click(screen.getByRole('button', {
      name: 'Открыть карточку клиента Иван Иванов',
    }))
    fireEvent.click(await screen.findByRole('button', { name: 'Сохранить' }))

    expect(await screen.findByText('Сохранение не выполнено')).toBeVisible()
    expect(nameInput).toHaveValue('Несохраненный черновик')
    expect(onOpenClient).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

function setupGroupFormOptions() {
  apiMocks.getBranches.mockResolvedValue([
    { id: 'branch-1', name: 'Центр', address: 'Адрес', isArchived: false },
  ])
  apiMocks.getHalls.mockResolvedValue([
    { id: 'hall-1', branchId: 'branch-1', name: 'Большой', isArchived: false },
  ])
  apiMocks.getGroupTypes.mockResolvedValue([
    { id: 'type-1', name: 'Общая', description: null, groupCount: 1 },
  ])
  apiMocks.getTrainerOptions.mockResolvedValue([])
}

function setupGroupEditWithClient() {
  setupGroupFormOptions()
  apiMocks.getGroup.mockResolvedValue({
    ...group,
    createdAt: '2026-07-01T10:00:00Z',
    updatedAt: '2026-07-20T10:00:00Z',
  })
  apiMocks.getGroupClients.mockResolvedValue({
    groupId: 'group-1',
    clients: [
      {
        id: 'client-1',
        fullName: 'Иван Иванов',
        phone: '+7 999 000-00-01',
        status: 'Active',
      },
    ],
  })
  apiMocks.getGroupTrainerSubstitutions.mockResolvedValue({
    current: [],
    history: { items: [], totalCount: 0, skip: 0, take: 20 },
    canCreate: true,
    createUnavailableReason: null,
  })
}
