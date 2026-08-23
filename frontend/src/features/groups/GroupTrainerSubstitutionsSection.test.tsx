import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { GroupTrainerSubstitutionsSection } from './GroupTrainerSubstitutionsSection'

const apiMocks = vi.hoisted(() => ({
  getGroupTrainerSubstitutions: vi.fn(),
}))

vi.mock('../../lib/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../lib/api')>(),
  getGroupTrainerSubstitutions: apiMocks.getGroupTrainerSubstitutions,
}))

const baseItem = {
  id: 'substitution-1',
  groupId: 'group-1',
  substituteTrainer: {
    id: 'trainer-2',
    fullName: 'Ирина Замена',
    login: 'irina',
    isActive: true,
  },
  startsOn: '2026-08-01',
  endsOn: '2026-08-05',
  status: 'Upcoming',
  cancelledAt: null,
  createdAt: '2026-07-25T08:00:00Z',
  updatedAt: '2026-07-25T08:00:00Z',
  allowedActions: {
    canEdit: true,
    canCancel: true,
  },
} as const

function response(overrides: Partial<Awaited<ReturnType<typeof apiMocks.getGroupTrainerSubstitutions>>> = {}) {
  return {
    current: [],
    history: {
      items: [],
      totalCount: 0,
      skip: 0,
      take: 20,
    },
    canCreate: true,
    createUnavailableReason: null,
    ...overrides,
  }
}

describe('GroupTrainerSubstitutionsSection', () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset())
  })

  test('loads independently, shows an alert on failure and retries without blocking parent content', async () => {
    apiMocks.getGroupTrainerSubstitutions
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(response())

    renderWithProviders(
      <>
        <div>Основная форма группы доступна</div>
        <GroupTrainerSubstitutionsSection groupId="group-1" />
      </>,
    )

    expect(screen.getByText('Основная форма группы доступна')).toBeVisible()
    expect(await screen.findByRole('alert')).toHaveTextContent('network down')

    fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку замещений' }))

    await waitFor(() => expect(apiMocks.getGroupTrainerSubstitutions).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Текущих и будущих замещений нет')).toBeVisible()
  })

  test('renders backend statuses and periods read-only without legacy mutation controls', async () => {
    apiMocks.getGroupTrainerSubstitutions.mockResolvedValue(response({
      current: [
        { ...baseItem, id: 'active', status: 'Active' },
        { ...baseItem, id: 'upcoming', startsOn: '2026-08-10', endsOn: '2026-08-12', status: 'Upcoming' },
      ],
      history: {
        items: [
          { ...baseItem, id: 'expired', status: 'Expired', allowedActions: { canEdit: false, canCancel: false } },
          { ...baseItem, id: 'cancelled', status: 'Cancelled', allowedActions: { canEdit: false, canCancel: false } },
        ],
        totalCount: 2,
        skip: 0,
        take: 20,
      },
    }))

    renderWithProviders(
      <GroupTrainerSubstitutionsSection groupId="group-1" />,
    )

    expect(await screen.findByRole('heading', { name: 'Текущие и будущие' })).toBeVisible()
    expect(await screen.findByText('Активно')).toBeVisible()
    expect(screen.getByText('Запланировано')).toBeVisible()
    expect(screen.getByText('Создание, изменение и отмена периодных замещений отключены в календаре занятий.')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'История' })).toBeVisible()
    expect(screen.getByText('Показано 2 из 2')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Показать историю замещений' })).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Показать историю замещений' }))
    expect(screen.getByText('Завершено')).toBeVisible()
    expect(screen.getByText('Отменено')).toBeVisible()
    expect(screen.getAllByText(/по 05\.08\.2026 включительно/)).toHaveLength(3)

    expect(screen.queryByRole('button', { name: 'Назначить замещение' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Изменить замещение/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Отменить замещение/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Замещающий тренер' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Начало периода')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Окончание периода')).not.toBeInTheDocument()
  })

  test('keeps current block visible with an empty message when only history exists', async () => {
    apiMocks.getGroupTrainerSubstitutions.mockResolvedValue(response({
      history: {
        items: [
          { ...baseItem, id: 'expired', status: 'Expired', allowedActions: { canEdit: false, canCancel: false } },
        ],
        totalCount: 3,
        skip: 0,
        take: 1,
      },
    }))

    renderWithProviders(
      <GroupTrainerSubstitutionsSection groupId="group-1" />,
    )

    expect(await screen.findByRole('heading', { name: 'Текущие и будущие' })).toBeVisible()
    expect(screen.getByText('Текущих и будущих замещений нет')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'История' })).toBeVisible()
    expect(screen.getByText('Показано 1 из 3')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Показать историю замещений' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Завершено')).not.toBeInTheDocument()
  })

  test('loads additional history through read-only pagination only', async () => {
    apiMocks.getGroupTrainerSubstitutions
      .mockResolvedValueOnce(response({
        history: {
          items: [{ ...baseItem, id: 'expired-1', status: 'Expired' }],
          totalCount: 2,
          skip: 0,
          take: 1,
        },
      }))
      .mockResolvedValueOnce(response({
        history: {
          items: [{ ...baseItem, id: 'expired-2', startsOn: '2026-08-10', endsOn: '2026-08-11', status: 'Expired' }],
          totalCount: 2,
          skip: 1,
          take: 1,
        },
      }))

    renderWithProviders(
      <GroupTrainerSubstitutionsSection groupId="group-1" />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Показать историю замещений' }))
    fireEvent.click(screen.getByRole('button', { name: 'Показать ещё' }))

    await waitFor(() => expect(apiMocks.getGroupTrainerSubstitutions).toHaveBeenLastCalledWith(
      'group-1',
      { historySkip: 1, historyTake: 20 },
    ))
    expect(await screen.findByTestId('group-trainer-substitution-expired-2')).toBeVisible()
  })
})
