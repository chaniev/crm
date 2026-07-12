import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  getAttendanceGroupClients,
  getAttendanceGroups,
  saveAttendanceMarks,
  type AuthenticatedUser,
} from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import { AttendanceWorkspace } from './AttendanceScreen'

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  getAttendanceGroupClients: vi.fn(),
  getAttendanceGroups: vi.fn(),
  saveAttendanceMarks: vi.fn(),
}))

const user = {
  role: 'Coach',
  permissions: { canMarkAttendance: true },
} as AuthenticatedUser
const getGroups = vi.mocked(getAttendanceGroups)
const getRoster = vi.mocked(getAttendanceGroupClients)
const saveMarks = vi.mocked(saveAttendanceMarks)

beforeEach(() => {
  getGroups.mockReset()
  getRoster.mockReset()
  saveMarks.mockReset()
  getGroups.mockResolvedValue({
    groups: [{ id: 'group-1', name: 'Вечерняя' }],
    today: '2026-07-12',
    maxTrainingDate: '2026-07-12',
  })
  getRoster.mockResolvedValue({
    groupId: 'group-1',
    trainingDate: '2026-07-12',
    today: '2026-07-12',
    maxTrainingDate: '2026-07-12',
    clients: [{
      id: 'client-1',
      fullName: 'Иван Иванов',
      state: 'Unmarked',
      groups: [],
      photo: null,
      isProfessional: false,
      professionalComment: null,
      hasActivePaidMembership: true,
      hasUnpaidCurrentMembership: false,
      membershipWarning: false,
      currentMembership: null,
    }],
  })
})

describe('AttendanceWorkspace', () => {
  test('shows three states, optimistic progress, row failure and exact retry', async () => {
    saveMarks
      .mockRejectedValueOnce(new Error('Связь прервана'))
      .mockResolvedValueOnce({
        groupId: 'group-1',
        trainingDate: '2026-07-12',
        today: '2026-07-12',
        maxTrainingDate: '2026-07-12',
        attendanceMarks: [{ clientId: 'client-1', state: 'Present' }],
      })

    renderWithProviders(<AttendanceWorkspace user={user} />)

    expect(await screen.findByLabelText('Посещение: Иван Иванов')).toBeVisible()
    expect(screen.getByText('Отмечено 0 из 1')).toBeVisible()
    expect(screen.getByText('Не отмечено')).toBeVisible()
    expect(screen.getByText('Был')).toBeVisible()
    expect(screen.getByText('Не был')).toBeVisible()
    expect(screen.getByLabelText('Дата тренировки')).toHaveAttribute('max', '2026-07-12')
    expect(screen.getByRole('button', { name: 'Следующая дата' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Следующая дата' })).toHaveAttribute('title', 'Будущие даты недоступны')

    fireEvent.click(screen.getByText('Был'))
    expect(screen.getByText('Отмечено 1 из 1')).toBeVisible()
    expect(await screen.findByText(/Не сохранено: Связь прервана/)).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Обновить список' }))
    await waitFor(() => expect(getRoster).toHaveBeenCalledTimes(2))
    expect(screen.getByText(/Не сохранено: Связь прервана/)).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Был' })).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    await waitFor(() => expect(screen.getByText('Сохранено')).toBeVisible())
    expect(saveMarks).toHaveBeenNthCalledWith(2, 'group-1', {
      trainingDate: '2026-07-12',
      attendanceMarks: [{ clientId: 'client-1', state: 'Present' }],
    })
    await waitFor(() => expect(getRoster).toHaveBeenCalledTimes(3))
  })

  test('disables manual refresh while a row save is pending', async () => {
    const pendingSave = createDeferred<Awaited<ReturnType<typeof saveAttendanceMarks>>>()
    saveMarks.mockReturnValueOnce(pendingSave.promise)
    renderWithProviders(<AttendanceWorkspace user={user} />)
    await screen.findByLabelText('Посещение: Иван Иванов')

    fireEvent.click(screen.getByText('Был'))

    expect(screen.getByRole('button', { name: 'Обновить список' })).toBeDisabled()
    pendingSave.resolve({
      groupId: 'group-1', trainingDate: '2026-07-12', today: '2026-07-12', maxTrainingDate: '2026-07-12',
      attendanceMarks: [{ clientId: 'client-1', state: 'Present' }],
    })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Обновить список' })).toBeEnabled())
  })

  test('a failed row does not block saving another client', async () => {
    const roster = await getRoster('group-1', '2026-07-12')
    getRoster.mockReset()
    getRoster.mockResolvedValue({
      ...roster,
      clients: [
        roster.clients[0],
        { ...roster.clients[0], id: 'client-2', fullName: 'Анна Петрова' },
      ],
    })
    saveMarks
      .mockRejectedValueOnce(new Error('Ошибка первой строки'))
      .mockResolvedValueOnce({
        groupId: 'group-1', trainingDate: '2026-07-12', today: '2026-07-12', maxTrainingDate: '2026-07-12',
        attendanceMarks: [{ clientId: 'client-2', state: 'Present' }],
      })
    renderWithProviders(<AttendanceWorkspace user={user} />)
    const first = await screen.findByTestId('attendance-client-card-client-1')
    const second = screen.getByTestId('attendance-client-card-client-2')

    fireEvent.click(within(first).getByRole('radio', { name: 'Был' }))
    expect(await within(first).findByText(/Не сохранено/)).toBeVisible()
    fireEvent.click(within(second).getByRole('radio', { name: 'Был' }))

    expect(await within(second).findByText('Сохранено')).toBeVisible()
    expect(within(first).getByText(/Не сохранено/)).toBeVisible()
  })

  test('an older background refresh cannot overwrite a newer saved choice', async () => {
    const olderRefresh = createDeferred<Awaited<ReturnType<typeof getAttendanceGroupClients>>>()
    const initialRoster = await getRoster('group-1', '2026-07-12')
    getRoster.mockReset()
    getRoster
      .mockResolvedValueOnce(initialRoster)
      .mockReturnValueOnce(olderRefresh.promise)
      .mockResolvedValueOnce({
        ...initialRoster,
        clients: initialRoster.clients.map((client) => ({ ...client, state: 'Absent' })),
      })
    saveMarks
      .mockResolvedValueOnce({
        groupId: 'group-1', trainingDate: '2026-07-12', today: '2026-07-12', maxTrainingDate: '2026-07-12',
        attendanceMarks: [{ clientId: 'client-1', state: 'Present' }],
      })
      .mockResolvedValueOnce({
        groupId: 'group-1', trainingDate: '2026-07-12', today: '2026-07-12', maxTrainingDate: '2026-07-12',
        attendanceMarks: [{ clientId: 'client-1', state: 'Absent' }],
      })

    renderWithProviders(<AttendanceWorkspace user={user} />)
    await screen.findByLabelText('Посещение: Иван Иванов')
    fireEvent.click(screen.getByText('Был'))
    await screen.findByText('Сохранено')
    fireEvent.click(screen.getByText('Не был'))
    await waitFor(() => expect(saveMarks).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Не был' })).toBeChecked())

    olderRefresh.resolve({
      ...initialRoster,
      clients: initialRoster.clients.map((client) => ({ ...client, state: 'Present' })),
    })

    await waitFor(() => expect(screen.getByRole('radio', { name: 'Не был' })).toBeChecked())
  })
})

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
