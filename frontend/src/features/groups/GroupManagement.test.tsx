import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ApiError } from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import { createClientProfileReturnContext } from '../clients/clientProfileReturnState'
import { createGroupListReturnSnapshot } from './groupListReturnState'

const apiMocks = vi.hoisted(() => ({
  createGroup: vi.fn(),
  getBranches: vi.fn(),
  getGroup: vi.fn(),
  getGroupLessonSeries: vi.fn(),
  getGroupClients: vi.fn(),
  getGroups: vi.fn(),
  getGroupSummary: vi.fn(),
  getGroupTrainerSubstitutions: vi.fn(),
  getGroupTypes: vi.fn(),
  getHalls: vi.fn(),
  getTrainerOptions: vi.fn(),
  applyGroupTrainerAssignments: vi.fn(),
  previewGroupCreate: vi.fn(),
  previewGroupTrainerAssignments: vi.fn(),
  updateGroup: vi.fn(),
}))

vi.mock('../../lib/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../lib/api')>(),
  createGroup: apiMocks.createGroup,
  getBranches: apiMocks.getBranches,
  getGroup: apiMocks.getGroup,
  getGroupLessonSeries: apiMocks.getGroupLessonSeries,
  getGroupClients: apiMocks.getGroupClients,
  getGroups: apiMocks.getGroups,
  getGroupSummary: apiMocks.getGroupSummary,
  getGroupTrainerSubstitutions: apiMocks.getGroupTrainerSubstitutions,
  getGroupTypes: apiMocks.getGroupTypes,
  getHalls: apiMocks.getHalls,
  getTrainerOptions: apiMocks.getTrainerOptions,
  applyGroupTrainerAssignments: apiMocks.applyGroupTrainerAssignments,
  previewGroupCreate: apiMocks.previewGroupCreate,
  previewGroupTrainerAssignments: apiMocks.previewGroupTrainerAssignments,
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
  trainerAssignmentRevision: 'assignment-revision-1',
  trainerAssignmentPeriods: [],
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

  test('renders compact registry metrics inside the status row and keeps decision data available', async () => {
    apiMocks.getGroups.mockResolvedValue({ items: [group], totalCount: 1, skip: 0, take: 10 })
    apiMocks.getGroupSummary.mockResolvedValue({ totalCount: 12, activeWithoutTrainerCount: 3 })
    const onCreate = vi.fn()
    renderWithProviders(<GroupsListScreen onCreate={onCreate} onEdit={vi.fn()} />)

    expect(await screen.findByText('Утренняя')).toBeVisible()
    expect(screen.getByRole('search')).toBeVisible()
    expect(screen.getByRole('search')).toHaveClass('entity-locator-bar', 'crm-filter-surface')
    expect(screen.queryByText('Поиск групп по названию')).not.toBeInTheDocument()
    expect(screen.getByText('Центр · Большой')).toBeVisible()
    expect(screen.getByText('Пн · 60 мин')).toBeVisible()
    expect(screen.getByText('Тренер не назначен')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Редактировать группу «Утренняя»' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Обновить список групп' })).toHaveClass(
      'task-toolbar-action--refresh',
    )
    expect(screen.getByRole('button', { name: 'Новая группа' })).toHaveClass(
      'task-toolbar-action--primary',
    )
    const statusRow = screen.getByTestId('groups-list-status-row')
    expect(statusRow).toHaveTextContent('Всего: 12')
    expect(statusRow).toHaveTextContent('Без тренера: 3')
    expect(screen.getByLabelText('Всего групп: 12')).toBeVisible()
    expect(screen.getByLabelText('Активных групп без тренера: 3')).toBeVisible()
    expect(screen.getByTestId('group-card-group-1')).toHaveClass('crm-list-row-surface')
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

    expect(await screen.findByRole('button', { name: 'Получить предпросмотр' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Отменить' })).toBeVisible()
  })

  test('create previews exact initial series payload, confirms with token and preserves field recovery', async () => {
    setupGroupFormOptions()
    apiMocks.previewGroupCreate
      .mockRejectedValueOnce(new ApiError('Проверьте поля группы.', 400, {
        Name: ['Группа с таким названием уже существует.'],
        'InitialLessonSeries.Slots[2].StartTime': ['Время субботы недоступно.'],
        'InitialLessonSeries.Slots[1].DurationMinutes': ['Проверьте длительность.'],
        'InitialLessonSeries.Slots[2].HallId': ['Проверьте зал.'],
      }))
      .mockResolvedValue({
        confirmationToken: 'group-preview-token',
        expiresAt: '2026-09-01T09:15:00Z',
        warnings: [],
      })
    apiMocks.createGroup
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
    for (const [day, label, time] of [['Сб', 'Суббота', '10:00'], ['Пн', 'Понедельник', '18:00'], ['Ср', 'Среда', '18:00']]) {
      fireEvent.click(screen.getByRole('checkbox', { name: day }))
      fireEvent.change(screen.getByLabelText(`Время начала: ${label}`), { target: { value: time } })
    }
    fireEvent.change(screen.getByLabelText('Длительность'), {
      target: { value: '75' },
    })
    fireEvent.change(screen.getByLabelText('Начало расписания'), {
      target: { value: '2026-09-01' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Получить предпросмотр' }))

    const exactPayload = {
      name: 'Новая группа',
      branchId: 'branch-1',
      hallId: 'hall-1',
      groupTypeId: 'type-1',
      trainingStartTime: '18:00',
      durationMinutes: 75,
      weekdays: [1, 3, 6],
      isActive: true,
      trainerIds: [],
      initialLessonSeries: {
        startsOn: '2026-09-01',
        endsOn: null,
        slots: [
          { isoWeekday: 1, startTime: '18:00', durationMinutes: 75, hallId: 'hall-1' },
          { isoWeekday: 3, startTime: '18:00', durationMinutes: 75, hallId: 'hall-1' },
          { isoWeekday: 6, startTime: '10:00', durationMinutes: 75, hallId: 'hall-1' },
        ],
      },
    }
    await waitFor(() => expect(apiMocks.previewGroupCreate).toHaveBeenCalledWith(exactPayload))
    expect(await screen.findByText('Группа с таким названием уже существует.')).toBeVisible()
    expect(screen.getByLabelText('Время начала: Суббота')).toHaveAccessibleDescription('Время субботы недоступно.')
    expect(screen.getByLabelText('Время начала: Понедельник')).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Длительность')).toHaveAccessibleDescription(expect.stringContaining('Проверьте длительность.'))
    expect(screen.getByLabelText('Зал', { selector: 'input' })).toHaveAccessibleDescription('Проверьте зал.')
    expect(nameInput).toHaveValue('  Новая группа  ')
    expect(onCreated).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Получить предпросмотр' }))
    expect(await screen.findByText('Проверьте расписание перед созданием')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Создать группу' }))

    await waitFor(() => expect(apiMocks.createGroup).toHaveBeenCalledTimes(1))
    expect(apiMocks.createGroup).toHaveBeenLastCalledWith({
      ...exactPayload,
      confirmationToken: 'group-preview-token',
    })
    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce())
  })

  test('weekday drafts survive removal, new days are empty, and every active change invalidates preview', async () => {
    setupGroupFormOptions()
    renderWithProviders(<GroupCreateScreen onCancel={vi.fn()} onCreated={vi.fn()} />)
    fireEvent.change(await screen.findByLabelText('Название группы'), { target: { value: 'Разные дни' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Пн' }))
    fireEvent.change(screen.getByLabelText('Время начала: Понедельник'), { target: { value: '18:00' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Сб' }))
    expect(screen.getByLabelText('Время начала: Суббота')).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: 'Получить предпросмотр' }))
    expect(apiMocks.previewGroupCreate).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByLabelText('Время начала: Суббота')).toHaveFocus())
    fireEvent.change(screen.getByLabelText('Время начала: Суббота'), { target: { value: '10:00' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Пн' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Пн' }))
    expect(screen.getByLabelText('Время начала: Понедельник')).toHaveValue('18:00')
    fireEvent.click(screen.getByRole('button', { name: 'Получить предпросмотр' }))
    expect(await screen.findByRole('button', { name: 'Создать группу' })).toBeVisible()
    fireEvent.change(screen.getByLabelText('Время начала: Суббота'), { target: { value: '11:00' } })
    expect(screen.queryByRole('button', { name: 'Создать группу' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Получить предпросмотр' }))
    await screen.findByRole('button', { name: 'Создать группу' })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Сб' }))
    expect(screen.queryByText('Проверьте расписание перед созданием')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Получить предпросмотр' }))
    await screen.findByRole('button', { name: 'Создать группу' })
    expect(apiMocks.previewGroupCreate).toHaveBeenLastCalledWith(expect.objectContaining({
      initialLessonSeries: expect.objectContaining({ slots: [expect.objectContaining({ isoWeekday: 1, startTime: '18:00' })] }),
    }))
    expect(apiMocks.createGroup).not.toHaveBeenCalled()
  })

  test.each(['success', 'failure'] as const)('ignores stale preview %s after a day changes without losing errors or draft', async (outcome) => {
    setupGroupFormOptions()
    let resolve!: (value: unknown) => void
    let reject!: (reason: unknown) => void
    apiMocks.previewGroupCreate.mockReturnValueOnce(new Promise((yes, no) => { resolve = yes; reject = no }))
    renderWithProviders(<GroupCreateScreen onCancel={vi.fn()} onCreated={vi.fn()} />)
    fireEvent.change(await screen.findByLabelText('Название группы'), { target: { value: 'Черновик' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Пн' }))
    fireEvent.change(screen.getByLabelText('Время начала: Понедельник'), { target: { value: '18:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Получить предпросмотр' }))
    fireEvent.click(screen.getByRole('button', { name: 'Получить предпросмотр' }))
    expect(apiMocks.previewGroupCreate).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Пн' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Сб' }))
    fireEvent.change(screen.getByLabelText('Время начала: Суббота'), { target: { value: '10:00' } })
    if (outcome === 'success') resolve({ confirmationToken: 'stale-token', warnings: [], expiresAt: '2026-11-01T10:00:00Z' })
    else reject(new ApiError('Отказ', 400, { 'InitialLessonSeries.Slots[0].StartTime': ['Ошибка старого понедельника.'] }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Получить предпросмотр' })).not.toBeDisabled())
    expect(screen.queryByRole('button', { name: 'Создать группу' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Время начала: Суббота')).toHaveValue('10:00')
    expect(screen.getByLabelText('Время начала: Суббота')).not.toHaveAttribute('aria-invalid', 'true')
    if (outcome === 'failure') expect(screen.getByText(/Ошибка старого понедельника/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Получить предпросмотр' }))
    await screen.findByRole('button', { name: 'Создать группу' })
    apiMocks.createGroup.mockRejectedValueOnce(new ApiError('Stale', 409, {}, 'lesson-mutation-preview-invalid'))
    fireEvent.click(screen.getByRole('button', { name: 'Создать группу' }))
    await screen.findByRole('button', { name: 'Получить предпросмотр' })
    expect(screen.getByLabelText('Время начала: Суббота')).toHaveValue('10:00')
  })

  test('edit sends identity-only payload and maps backend errors to current fields', async () => {
    setupGroupFormOptions()
    apiMocks.getGroup.mockResolvedValue({
      ...group,
      trainingStartTime: '',
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
    }))
    const onUpdated = vi.fn()

    renderWithProviders(
      <GroupEditScreen groupId="group-1" onBack={vi.fn()} onUpdated={onUpdated} />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Сохранить изменения' }))

    await waitFor(() => expect(apiMocks.updateGroup).toHaveBeenCalledWith('group-1', {
      name: 'Утренняя',
      branchId: 'branch-1',
      groupTypeId: 'type-1',
      isActive: true,
    }))
    expect(await screen.findByText('Название отклонено сервером.')).toBeVisible()
    expect(apiMocks.updateGroup.mock.calls[0]?.[1]).not.toHaveProperty('trainerIds')
    expect(apiMocks.updateGroup.mock.calls[0]?.[1]).not.toHaveProperty('trainingStartTime')
    expect(screen.getByRole('textbox', { name: 'Название группы' })).toHaveValue('Утренняя')
    expect(onUpdated).not.toHaveBeenCalled()
  })

  test('does not expose legacy substitution writes and keeps group identity save narrow', async () => {
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
      current: [
        {
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
        },
      ],
      history: { items: [], totalCount: 0, skip: 0, take: 20 },
      canCreate: true,
      createUnavailableReason: null,
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

    expect(await screen.findByText('Временные замещения')).toBeVisible()
    expect(await screen.findByText('Замещающий Тренер')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Назначить замещение' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Изменить замещение/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Отменить замещение/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Замещающий тренер' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить изменения' }))

    await waitFor(() => expect(apiMocks.updateGroup).toHaveBeenCalled())
    const payload = apiMocks.updateGroup.mock.calls[0]?.[1]
    expect(payload).not.toHaveProperty('trainerIds')
    expect(payload).not.toHaveProperty('trainingStartTime')
    expect(payload).not.toHaveProperty('weekdays')
  })

  test('previews and executes permanent trainer assignments with revision token', async () => {
    setupGroupFormOptions()
    apiMocks.getGroup.mockResolvedValue({
      ...group,
      trainers: [{ id: 'trainer-main', fullName: 'Основной Тренер', login: 'main' }],
      trainerIds: ['trainer-main'],
      trainerAssignmentRevision: 'assignment-revision-1',
      trainerAssignmentPeriods: [
        {
          trainerId: 'trainer-main',
          trainerName: 'Основной Тренер',
          validFrom: '2026-08-23',
          validTo: null,
        },
      ],
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
    apiMocks.previewGroupTrainerAssignments.mockResolvedValue({
      confirmationToken: 'assignment-preview-token',
      expiresAt: '2026-08-23T10:15:00Z',
      revision: 'assignment-revision-1',
      assignments: [
        {
          trainerId: 'trainer-main',
          trainerName: 'Основной Тренер',
          validFrom: '2026-08-23',
          validTo: '2026-09-30',
        },
      ],
      impact: {
        totalAffectedOccurrences: 2,
        examples: [
          {
            lessonOccurrenceId: 'occurrence-1',
            lessonDate: '2026-08-24',
            startTime: '09:00',
            hallId: 'hall-1',
            hallName: 'Большой',
          },
        ],
      },
      warnings: [
        {
          code: 'group_trainer_assignment_overlap',
          message: 'technical backend warning',
        },
      ],
    })
    apiMocks.applyGroupTrainerAssignments.mockResolvedValue({
      revision: 'assignment-revision-2',
      assignments: [
        {
          trainerId: 'trainer-main',
          trainerName: 'Основной Тренер',
          validFrom: '2026-08-23',
          validTo: '2026-09-30',
        },
      ],
      impact: { totalAffectedOccurrences: 2, examples: [] },
      warnings: [],
    })

    renderWithProviders(
      <GroupEditScreen groupId="group-1" onBack={vi.fn()} onUpdated={vi.fn()} />,
    )

    expect(await screen.findByText('Постоянные назначения тренеров')).toBeVisible()
    fireEvent.change(screen.getByLabelText('Окончание периода 1'), {
      target: { value: '2026-09-30' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Получить предпросмотр' }))

    await waitFor(() => expect(apiMocks.previewGroupTrainerAssignments).toHaveBeenCalledWith(
      'group-1',
      {
        assignments: [
          {
            trainerId: 'trainer-main',
            validFrom: '2026-08-23',
            validTo: '2026-09-30',
          },
        ],
        expectedRevision: 'assignment-revision-1',
      },
    ))
    expect(await screen.findByText('Предпросмотр изменений')).toBeVisible()
    expect(screen.getByText('У тренера есть пересекающееся постоянное назначение в другой группе.')).toBeVisible()
    expect(screen.queryByText('assignment-preview-token')).not.toBeInTheDocument()
    expect(screen.queryByText('technical backend warning')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить назначения' }))

    await waitFor(() => expect(apiMocks.applyGroupTrainerAssignments).toHaveBeenCalledWith(
      'group-1',
      {
        assignments: [
          {
            trainerId: 'trainer-main',
            validFrom: '2026-08-23',
            validTo: '2026-09-30',
          },
        ],
        expectedRevision: 'assignment-revision-1',
        confirmationToken: 'assignment-preview-token',
      },
    ))
  })

  test('preserves trainer assignment draft and hides raw stale code after execute conflict', async () => {
    setupGroupFormOptions()
    apiMocks.getGroup.mockResolvedValue({
      ...group,
      trainers: [{ id: 'trainer-main', fullName: 'Основной Тренер', login: 'main' }],
      trainerIds: ['trainer-main'],
      trainerAssignmentRevision: 'assignment-revision-1',
      trainerAssignmentPeriods: [
        {
          trainerId: 'trainer-main',
          trainerName: 'Основной Тренер',
          validFrom: '2026-08-23',
          validTo: null,
        },
      ],
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
    apiMocks.previewGroupTrainerAssignments.mockResolvedValue({
      confirmationToken: 'assignment-preview-token',
      expiresAt: '2026-08-23T10:15:00Z',
      revision: 'assignment-revision-1',
      assignments: [
        {
          trainerId: 'trainer-main',
          trainerName: 'Основной Тренер',
          validFrom: '2026-08-23',
          validTo: '2026-09-30',
        },
      ],
      impact: { totalAffectedOccurrences: 1, examples: [] },
      warnings: [],
    })
    apiMocks.applyGroupTrainerAssignments.mockRejectedValue(
      new ApiError(
        'lesson-mutation-preview-stale',
        409,
        {},
        'lesson-mutation-preview-stale',
      ),
    )

    renderWithProviders(
      <GroupEditScreen groupId="group-1" onBack={vi.fn()} onUpdated={vi.fn()} />,
    )

    const endsOn = await screen.findByLabelText('Окончание периода 1')
    fireEvent.change(endsOn, { target: { value: '2026-09-30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Получить предпросмотр' }))
    await screen.findByText('Предпросмотр изменений')
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить назначения' }))

    expect(await screen.findByText('Параметры изменились после предпросмотра. Получите новый предпросмотр.')).toBeVisible()
    expect(screen.queryByText('lesson-mutation-preview-stale')).not.toBeInTheDocument()
    expect(endsOn).toHaveValue('2026-09-30')
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
  apiMocks.previewGroupCreate.mockResolvedValue({
    confirmationToken: 'group-preview-token',
    expiresAt: '2026-09-01T09:15:00Z',
    warnings: [],
  })
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

const groupSeries = {
  seriesId: 'series-distinct', groupId: 'group-1', groupName: 'Утренняя', businessDate: '2026-10-23',
  startsOn: '2026-10-01', endsOn: null, revision: 'series-r1',
  currentVersion: { versionNumber: 1, effectiveFrom: '2026-10-01', effectiveTo: null,
    thisAndFutureMinEffectiveFrom: '2026-10-23', entireSeriesEffectiveFrom: '2026-10-01',
    slots: [
      { isoWeekday: 1, startTime: '18:00', durationMinutes: 60, hallId: 'hall-1', hallName: 'Большой' },
      { isoWeekday: 1, startTime: '20:00', durationMinutes: 45, hallId: 'hall-2', hallName: 'Малый' },
      { isoWeekday: 6, startTime: '10:00', durationMinutes: 60, hallId: 'hall-1', hallName: 'Большой' },
    ],
  },
}

describe('Group schedule entry', () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach(mock => mock.mockReset())
    setupGroupEditWithClient()
    apiMocks.getGroupLessonSeries.mockResolvedValue(groupSeries)
    apiMocks.updateGroup.mockImplementation(async (_id, payload) => ({ ...group, ...payload }))
  })

  function renderEntry(onOpenSchedule = vi.fn(), canManageGroups = true) {
    return { onOpenSchedule, ...renderWithProviders(<GroupEditScreen groupId="group-1"
      onBack={vi.fn()} onUpdated={vi.fn()} onOpenSchedule={onOpenSchedule} canManageGroups={canManageGroups} />) }
  }

  test('loads canonical series independently and shows every slot with its hall/duration', async () => {
    const { onOpenSchedule } = renderEntry()
    expect(await screen.findByRole('button', { name: 'Изменить расписание' })).toBeVisible()
    expect(apiMocks.getGroupLessonSeries).toHaveBeenCalledWith('group-1', expect.any(AbortSignal))
    for (const text of ['Пн 18:00', 'Пн 20:00', 'Сб 10:00']) expect(screen.getByText(text)).toBeVisible()
    expect(screen.getByText(/45 мин.*Малый/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Изменить расписание' }))
    expect(onOpenSchedule).toHaveBeenCalledWith('group-1', 'series-distinct')
    expect(apiMocks.updateGroup).not.toHaveBeenCalled()
  })

  test.each([404, 403, 500])('lookup %s keeps identity editable and only transient failures offer retry', async status => {
    apiMocks.getGroupLessonSeries.mockRejectedValueOnce(new ApiError('Ошибка чтения', status, {}, status === 404 ? 'lesson-series-not-found' : null))
    const { onOpenSchedule } = renderEntry()
    const name = await screen.findByLabelText('Название группы')
    fireEvent.change(name, { target: { value: 'Черновик' } })
    expect(await screen.findByText(status === 404 ? 'Расписание не найдено' : status === 403 ? 'Нет доступа к расписанию' : 'Ошибка чтения')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Изменить расписание' })).not.toBeInTheDocument()
    if (status === 500) {
      fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
      await screen.findByRole('button', { name: 'Изменить расписание' })
    } else expect(screen.queryByRole('button', { name: 'Повторить' })).not.toBeInTheDocument()
    expect(name).toHaveValue('Черновик')
    expect(onOpenSchedule).not.toHaveBeenCalled()
  })

  test('ignores a late lookup of the previous group and never exposes its series', async () => {
    let resolve!: (value: unknown) => void
    apiMocks.getGroupLessonSeries.mockReturnValueOnce(new Promise(done => { resolve = done }))
    const { rerender, onOpenSchedule } = renderEntry()
    await screen.findByLabelText('Название группы')
    expect(screen.getByText('Загружаем расписание...')).toBeVisible()
    apiMocks.getGroupLessonSeries.mockResolvedValue({ ...groupSeries, groupId: 'group-2', seriesId: 'series-2' })
    rerender(<GroupEditScreen groupId="group-2" onBack={vi.fn()} onUpdated={vi.fn()}
      onOpenSchedule={onOpenSchedule} canManageGroups />)
    await screen.findByRole('button', { name: 'Изменить расписание' })
    resolve(groupSeries)
    await waitFor(() => expect(apiMocks.getGroupLessonSeries).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: 'Изменить расписание' }))
    expect(onOpenSchedule).toHaveBeenCalledWith('group-2', 'series-2')
  })

  test('mismatched group and restricted session cannot open an editor', async () => {
    apiMocks.getGroupLessonSeries.mockResolvedValue({ ...groupSeries, groupId: 'wrong-group' })
    const view = renderEntry()
    expect(await screen.findByText('Не удалось подтвердить расписание этой группы.')).toBeVisible()
    expect(view.onOpenSchedule).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Изменить расписание' })).not.toBeInTheDocument()
    view.unmount()
    apiMocks.getGroupLessonSeries.mockClear()
    renderEntry(vi.fn(), false)
    await screen.findByLabelText('Название группы')
    expect(apiMocks.getGroupLessonSeries).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Изменить расписание' })).not.toBeInTheDocument()
  })

  test.each(['Остаться', 'Escape', 'Перейти без сохранения', 'Сохранить и перейти'])('dirty schedule entry: %s', async choice => {
    const { onOpenSchedule } = renderEntry()
    const name = await screen.findByLabelText('Название группы')
    fireEvent.change(name, { target: { value: 'Изменённая группа' } })
    const trigger = await screen.findByRole('button', { name: 'Изменить расписание' })
    fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog')
    if (choice === 'Escape') fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' })
    else fireEvent.click(screen.getByRole('button', { name: choice }))
    if (choice === 'Остаться' || choice === 'Escape') {
      await waitFor(() => expect(trigger).toHaveFocus())
      expect(name).toHaveValue('Изменённая группа')
      expect(onOpenSchedule).not.toHaveBeenCalled()
    } else {
      await waitFor(() => expect(onOpenSchedule).toHaveBeenCalledWith('group-1', 'series-distinct'))
    }
    expect(apiMocks.updateGroup).toHaveBeenCalledTimes(choice === 'Сохранить и перейти' ? 1 : 0)
    if (choice === 'Сохранить и перейти') {
      expect(apiMocks.updateGroup).toHaveBeenCalledWith('group-1', { name: 'Изменённая группа', branchId: 'branch-1', groupTypeId: 'type-1', isActive: true })
      expect(apiMocks.getGroupLessonSeries).toHaveBeenCalledTimes(2)
    }
  })

  test('dirty schedule save stays single while pending', async () => {
    let resolve!: (value: unknown) => void
    apiMocks.updateGroup.mockReturnValue(new Promise(done => { resolve = done }))
    const { onOpenSchedule } = renderEntry()
    fireEvent.change(await screen.findByLabelText('Название группы'), { target: { value: 'Черновик' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить расписание' }))
    const save = await screen.findByRole('button', { name: 'Сохранить и перейти' })
    fireEvent.click(save)
    fireEvent.click(save)
    expect(save).toBeDisabled()
    expect(apiMocks.updateGroup).toHaveBeenCalledOnce()
    expect(onOpenSchedule).not.toHaveBeenCalled()
    resolve({ ...group, name: 'Черновик' })
    await waitFor(() => expect(onOpenSchedule).toHaveBeenCalledOnce())
  })

  test.each(['validation', 'server', 'scope'])('dirty save %s failure keeps draft and refuses navigation', async failure => {
    const { onOpenSchedule } = renderEntry()
    const name = await screen.findByLabelText('Название группы')
    fireEvent.change(name, { target: { value: failure === 'validation' ? '' : 'Черновик' } })
    if (failure === 'server') apiMocks.updateGroup.mockRejectedValue(new ApiError('Сохранение отклонено', 400, { Name: ['Исправьте название.'] }))
    if (failure === 'scope') apiMocks.getGroupLessonSeries.mockRejectedValue(new ApiError('Охват изменён', 403))
    fireEvent.click(await screen.findByRole('button', { name: 'Изменить расписание' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Сохранить и перейти' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onOpenSchedule).not.toHaveBeenCalled()
    if (failure !== 'scope') expect(name).toHaveValue(failure === 'validation' ? '' : 'Черновик')
    else expect(await screen.findByText('Нет доступа к расписанию')).toBeVisible()
  })
})
