import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ApiError } from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import { GroupTrainerSubstitutionsSection } from './GroupTrainerSubstitutionsSection'

const apiMocks = vi.hoisted(() => ({
  cancelGroupTrainerSubstitution: vi.fn(),
  createGroupTrainerSubstitution: vi.fn(),
  getGroupTrainerSubstitutions: vi.fn(),
  updateGroupTrainerSubstitution: vi.fn(),
}))

vi.mock('../../lib/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../lib/api')>(),
  cancelGroupTrainerSubstitution: apiMocks.cancelGroupTrainerSubstitution,
  createGroupTrainerSubstitution: apiMocks.createGroupTrainerSubstitution,
  getGroupTrainerSubstitutions: apiMocks.getGroupTrainerSubstitutions,
  updateGroupTrainerSubstitution: apiMocks.updateGroupTrainerSubstitution,
}))

const trainerOptions = [
  { id: 'trainer-2', fullName: 'Ирина Замена', login: 'irina' },
  { id: 'trainer-3', fullName: 'Артем Длиннофамильный', login: 'artem' },
]

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
        <GroupTrainerSubstitutionsSection groupId="group-1" trainerOptions={trainerOptions} />
      </>,
    )

    expect(screen.getByText('Основная форма группы доступна')).toBeVisible()
    expect(await screen.findByRole('alert')).toHaveTextContent('network down')

    fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку замещений' }))

    await waitFor(() => expect(apiMocks.getGroupTrainerSubstitutions).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Текущих и будущих замещений нет')).toBeVisible()
  })

  test('renders backend statuses, inclusive period text and actions only from allowedActions', async () => {
    apiMocks.getGroupTrainerSubstitutions.mockResolvedValue(response({
      current: [
        { ...baseItem, id: 'active-no-edit', status: 'Active', allowedActions: { canEdit: false, canCancel: true } },
        { ...baseItem, id: 'upcoming-no-cancel', startsOn: '2026-08-10', endsOn: '2026-08-12', status: 'Upcoming', allowedActions: { canEdit: true, canCancel: false } },
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
      <GroupTrainerSubstitutionsSection groupId="group-1" trainerOptions={trainerOptions} />,
    )

    expect(await screen.findByRole('heading', { name: 'Текущие и будущие' })).toBeVisible()
    expect(await screen.findByText('Активно')).toBeVisible()
    expect(screen.getByText('Запланировано')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'История' })).toBeVisible()
    expect(screen.getByText('Показано 2 из 2')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Показать историю замещений' })).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Показать историю замещений' }))
    expect(screen.getByText('Завершено')).toBeVisible()
    expect(screen.getByText('Отменено')).toBeVisible()
    expect(screen.getAllByText(/по 05\.08\.2026 включительно/)).toHaveLength(3)

    const activeCard = screen.getByTestId('group-trainer-substitution-active-no-edit')
    expect(within(activeCard).queryByRole('button', { name: /Изменить/ })).not.toBeInTheDocument()
    expect(within(activeCard).getByRole('button', {
      name: 'Отменить замещение Ирина Замена, период 2026-08-01 - 2026-08-05',
    })).toBeEnabled()

    const upcomingCard = screen.getByTestId('group-trainer-substitution-upcoming-no-cancel')
    expect(within(upcomingCard).getByRole('button', {
      name: 'Изменить замещение Ирина Замена, период 2026-08-10 - 2026-08-12',
    })).toBeEnabled()
    expect(within(upcomingCard).queryByRole('button', { name: /Отменить/ })).not.toBeInTheDocument()
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
      <GroupTrainerSubstitutionsSection groupId="group-1" trainerOptions={trainerOptions} />,
    )

    expect(await screen.findByRole('heading', { name: 'Текущие и будущие' })).toBeVisible()
    expect(screen.getByText('Текущих и будущих замещений нет')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'История' })).toBeVisible()
    expect(screen.getByText('Показано 1 из 3')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Показать историю замещений' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Завершено')).not.toBeInTheDocument()
  })

  test('keeps create dialog values and backend field errors after conflict', async () => {
    apiMocks.getGroupTrainerSubstitutions.mockResolvedValue(response())
    apiMocks.createGroupTrainerSubstitution.mockRejectedValue(new ApiError(
      'Период пересекается с существующим замещением.',
      409,
      {
        startsOn: ['Дата начала пересекается.'],
        endsOn: ['Дата окончания пересекается.'],
      },
      'group_trainer_substitution_overlap',
    ))

    renderWithProviders(
      <GroupTrainerSubstitutionsSection groupId="group-1" trainerOptions={trainerOptions} />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Назначить замещение' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Замещающий тренер' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Ирина Замена (irina)' }))
    fireEvent.change(screen.getByLabelText('Начало периода'), { target: { value: '2026-08-01' } })
    fireEvent.change(screen.getByLabelText('Окончание периода'), { target: { value: '2026-08-05' } })
    fireEvent.click(screen.getByRole('button', { name: 'Создать замещение' }))

    expect(await screen.findByText('Дата начала пересекается.')).toBeVisible()
    expect(screen.getByText('Дата окончания пересекается.')).toBeVisible()
    expect(screen.getByLabelText('Начало периода')).toHaveValue('2026-08-01')
    expect(screen.getByLabelText('Окончание периода')).toHaveValue('2026-08-05')
    expect(apiMocks.getGroupTrainerSubstitutions).toHaveBeenCalledTimes(1)
  })

  test('refreshes the section after successful edit and cancel', async () => {
    apiMocks.getGroupTrainerSubstitutions
      .mockResolvedValueOnce(response({ current: [baseItem] }))
      .mockResolvedValueOnce(response({ current: [baseItem] }))
      .mockResolvedValueOnce(response({ current: [] }))
    apiMocks.updateGroupTrainerSubstitution.mockResolvedValue({ ...baseItem, endsOn: '2026-08-07' })
    apiMocks.cancelGroupTrainerSubstitution.mockResolvedValue({
      ...baseItem,
      status: 'Cancelled',
      allowedActions: { canEdit: false, canCancel: false },
    })

    renderWithProviders(
      <GroupTrainerSubstitutionsSection groupId="group-1" trainerOptions={trainerOptions} />,
    )

    fireEvent.click(await screen.findByRole('button', { name: /Изменить замещение Ирина Замена/ }))
    fireEvent.change(screen.getByLabelText('Окончание периода'), { target: { value: '2026-08-07' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить замещение' }))
    await waitFor(() => expect(apiMocks.updateGroupTrainerSubstitution).toHaveBeenCalledWith(
      'group-1',
      'substitution-1',
      {
        substituteTrainerId: 'trainer-2',
        startsOn: '2026-08-01',
        endsOn: '2026-08-07',
      },
    ))

    apiMocks.getGroupTrainerSubstitutions.mockResolvedValue(response({ current: [baseItem] }))
    fireEvent.click(await screen.findByRole('button', { name: /Отменить замещение Ирина Замена/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Отозвать замещение' }))
    await waitFor(() => expect(apiMocks.cancelGroupTrainerSubstitution).toHaveBeenCalledWith('group-1', 'substitution-1'))
    expect(apiMocks.getGroupTrainerSubstitutions).toHaveBeenCalledTimes(3)
  })
})
