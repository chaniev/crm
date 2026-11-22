import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { GroupTrainerSubstitutionsSection } from './GroupTrainerSubstitutionsSection'

const api = vi.hoisted(() => ({
  getGroupTrainerSubstitutionPeriods: vi.fn(),
  getGroupTrainerSubstitutions: vi.fn(),
  createGroupTrainerSubstitutionPeriod: vi.fn(),
  cancelGroupTrainerSubstitutionPeriod: vi.fn(),
}))
vi.mock('../../lib/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../lib/api')>(),
  ...api,
}))

const trainer = { id: 'trainer-2', fullName: 'Ирина Замена', login: 'irina', isActive: true }
const period = {
  id: 'new', groupId: 'group-1', substituteTrainer: trainer, startsOn: '2026-12-10', endsOn: '2026-12-15',
  status: 'Upcoming', allowedActions: { canCancel: true, canEdit: false },
}
const empty = { current: [], history: { items: [], totalCount: 0, skip: 0, take: 20 }, canCreate: true, createUnavailableReason: null }

function renderSection() {
  renderWithProviders(<GroupTrainerSubstitutionsSection groupId="group-1" groupName="Юниоры" trainerOptions={[trainer]} />)
}

describe('GroupTrainerSubstitutionsSection', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    api.getGroupTrainerSubstitutions.mockResolvedValue(empty)
    api.getGroupTrainerSubstitutionPeriods.mockResolvedValue(empty)
  })

  test('allows retrying a failed list request', async () => {
    api.getGroupTrainerSubstitutionPeriods.mockRejectedValueOnce(new Error('network down'))
    renderSection()
    expect(await screen.findByRole('alert')).toHaveTextContent('network down')
    fireEvent.click(screen.getByRole('button', { name: /Повторить/ }))
    expect(await screen.findByRole('button', { name: 'Назначить на период' })).toBeVisible()
  })

  test('keeps the form after a conflict and uses the confirmed server record after retry', async () => {
    api.createGroupTrainerSubstitutionPeriod.mockRejectedValueOnce(new Error('Период пересекается')).mockResolvedValueOnce(period)
    renderSection()
    fireEvent.click(await screen.findByRole('button', { name: 'Назначить на период' }))
    const form = within(screen.getByRole('dialog'))
    fireEvent.change(form.getByLabelText(/Замещающий тренер/), { target: { value: trainer.id } })
    fireEvent.change(form.getByLabelText(/Дата начала/), { target: { value: period.startsOn } })
    fireEvent.change(form.getByLabelText(/Дата окончания/), { target: { value: period.endsOn } })
    fireEvent.click(form.getByRole('button', { name: 'Назначить' }))
    expect(await form.findByRole('alert')).toHaveTextContent('Период пересекается')
    expect(form.getByLabelText(/Дата окончания/)).toHaveValue(period.endsOn)
    api.getGroupTrainerSubstitutionPeriods.mockResolvedValue({ ...empty, current: [period] })
    fireEvent.click(form.getByRole('button', { name: 'Назначить' }))
    expect(await screen.findByRole('button', { name: 'Отменить замещение Ирина Замена' })).toBeVisible()
    expect(api.createGroupTrainerSubstitutionPeriod).toHaveBeenCalledWith('group-1', {
      substituteTrainerId: trainer.id, startsOn: period.startsOn, endsOn: period.endsOn,
    })
  })

  test('shows server restrictions and offers no mutation for legacy rows even when their dates are current', async () => {
    api.getGroupTrainerSubstitutionPeriods.mockResolvedValue({
      ...empty, canCreate: false, createUnavailableReason: { code: 'group_inactive', message: 'Группа неактивна.' },
      current: [{ ...period, allowedActions: { canCancel: false, canEdit: false } }],
    })
    api.getGroupTrainerSubstitutions.mockResolvedValueOnce({
      ...empty, current: [period],
      history: { items: [{ ...period, id: 'expired' }], totalCount: 2, skip: 0, take: 1 },
    }).mockResolvedValueOnce({ ...empty, current: [period], history: { items: [{ ...period, id: 'oldest' }], totalCount: 2, skip: 1, take: 1 } })
    renderSection()
    expect(await screen.findByText('Группа неактивна.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Назначить на период' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Показать историю' }))
    expect(await screen.findAllByText(/Архивная запись/)).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: /Показать ещё/ }))
    await waitFor(() => expect(screen.getAllByText(/Архивная запись/)).toHaveLength(3))
    expect(screen.queryByRole('button', { name: /Отменить замещение/ })).toBeNull()
  })
})
