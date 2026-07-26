import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderWithProviders } from '../../test/render'

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

describe('GroupsListScreen', () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset())
  })

  test('keeps a successful list and actions available when summary fails', async () => {
    apiMocks.getGroups.mockResolvedValue({ items: [group], totalCount: 1, skip: 0, take: 50 })
    apiMocks.getGroupSummary.mockRejectedValue(new Error('summary failed'))
    const onCreate = vi.fn()
    renderWithProviders(<GroupsListScreen onCreate={onCreate} onEdit={vi.fn()} />)

    expect(await screen.findByText('Утренняя')).toBeVisible()
    expect(screen.getAllByText('—')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }))
    expect(onCreate).toHaveBeenCalledOnce()
  })

  test('keeps summary and actions available when list fails and refreshes both requests', async () => {
    apiMocks.getGroups.mockRejectedValue(new Error('list failed'))
    apiMocks.getGroupSummary.mockResolvedValue({ totalCount: 100, activeWithoutTrainerCount: 4 })
    renderWithProviders(<GroupsListScreen onCreate={vi.fn()} onEdit={vi.fn()} />)

    expect(await screen.findByText('Список групп не загрузился')).toBeVisible()
    expect(screen.getByText('100')).toBeVisible()
    expect(screen.getByText('4')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Обновить список' }))
    await waitFor(() => {
      expect(apiMocks.getGroups).toHaveBeenCalledTimes(2)
      expect(apiMocks.getGroupSummary).toHaveBeenCalledTimes(2)
    })
    expect(screen.getByRole('button', { name: 'Создать' })).toBeEnabled()
    expect(screen.getByRole('heading', { level: 1, name: 'Группы' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Список групп' })).toBeInTheDocument()
  })
})

describe('GroupEditScreen', () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset())
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
