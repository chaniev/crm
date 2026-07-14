import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderWithProviders } from '../../test/render'

const apiMocks = vi.hoisted(() => ({
  getGroups: vi.fn(),
  getGroupSummary: vi.fn(),
}))

vi.mock('../../lib/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../lib/api')>(),
  getGroups: apiMocks.getGroups,
  getGroupSummary: apiMocks.getGroupSummary,
}))

import { GroupsListScreen } from './GroupManagement'

const group = {
  id: 'group-1', name: 'Утренняя', branchId: 'branch-1', branchName: 'Центр',
  hallId: 'hall-1', hallName: 'Большой', groupTypeId: 'type-1', groupTypeName: 'Общая',
  trainingStartTime: '09:00', durationMinutes: 60, weekdays: [1], isActive: true,
  trainers: [], trainerIds: [], trainerCount: 0, trainerNames: [], clientCount: 2,
}

describe('GroupsListScreen', () => {
  beforeEach(() => {
    apiMocks.getGroups.mockReset()
    apiMocks.getGroupSummary.mockReset()
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
