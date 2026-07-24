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
      hasActiveMembership: true,
      membershipWarning: false,
      currentMembership: null,
    }],
  })
})

describe('AttendanceWorkspace', () => {
  test('keeps a failed row in the default view and removes it only after exact retry succeeds', async () => {
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
    const initialCard = screen.getByTestId('attendance-client-card-client-1')
    expect(within(initialCard).getByText('Не отмечено')).toBeVisible()
    expect(within(initialCard).getByText('Был')).toBeVisible()
    expect(within(initialCard).getByText('Не был')).toBeVisible()
    expect(screen.getByLabelText('Дата тренировки')).toHaveAttribute('max', '2026-07-12')
    expect(screen.getByRole('button', { name: 'Следующая дата' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Следующая дата' })).toHaveAttribute('title', 'Будущие даты недоступны')

    fireEvent.click(within(initialCard).getByText('Был'))
    expect(screen.getByText('Отмечено 0 из 1')).toBeVisible()
    expect(await screen.findByText(/Не сохранено: Связь прервана/)).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Обновить список' }))
    await waitFor(() => expect(getRoster).toHaveBeenCalledTimes(2))
    expect(screen.getByText(/Не сохранено: Связь прервана/)).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Был' })).toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByText('Все клиенты отмечены')).toBeVisible()
    expect(saveMarks).toHaveBeenNthCalledWith(2, 'group-1', {
      trainingDate: '2026-07-12',
      attendanceMarks: [{ clientId: 'client-1', state: 'Present' }],
    })
    await waitFor(() => expect(getRoster).toHaveBeenCalledTimes(3))
    fireEvent.click(within(screen.getByTestId('attendance-roster-view-control')).getByRole('radio', { name: 'Все' }))
    expect(await screen.findByLabelText('Посещение: Иван Иванов')).toBeVisible()
    expect(screen.getByRole('radio', { name: 'Был' })).toBeChecked()
    expect(screen.getByText('Отмечено 1 из 1')).toBeVisible()
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

  test('renders status-free active membership without paid/unpaid attendance badges', async () => {
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
        hasActiveMembership: true,
        membershipWarning: false,
        currentMembership: null,
      } as unknown as Awaited<ReturnType<typeof getAttendanceGroupClients>>['clients'][number]],
    })

    renderWithProviders(<AttendanceWorkspace user={user} />)

    expect(await screen.findByText('Отметка доступна на выбранную дату')).toBeVisible()
    expect(screen.queryByText('Не оплачено')).not.toBeInTheDocument()
    expect(screen.queryByText('Проблема с абонементом')).not.toBeInTheDocument()
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

    await waitFor(() => expect(screen.queryByTestId('attendance-client-card-client-2')).not.toBeInTheDocument())
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
    await screen.findByText('Все клиенты отмечены')
    fireEvent.click(within(screen.getByTestId('attendance-roster-view-control')).getByRole('radio', { name: 'Все' }))
    fireEvent.click(screen.getByText('Не был'))
    await waitFor(() => expect(saveMarks).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Не был' })).toBeChecked())

    olderRefresh.resolve({
      ...initialRoster,
      clients: initialRoster.clients.map((client) => ({ ...client, state: 'Present' })),
    })

    await waitFor(() => expect(screen.getByRole('radio', { name: 'Не был' })).toBeChecked())
  })

  test('defaults to unmarked clients, shows the complete confirmed roster and resets a client', async () => {
    getRoster.mockResolvedValue({
      groupId: 'group-1', trainingDate: '2026-07-12', today: '2026-07-12', maxTrainingDate: '2026-07-12',
      clients: [
        buildClient('client-1', 'Иван Иванов', 'Unmarked'),
        buildClient('client-2', 'Анна Петрова', 'Present'),
        buildClient('client-3', 'Петр Сидоров', 'Absent'),
      ],
    })
    saveMarks.mockResolvedValue({
      groupId: 'group-1', trainingDate: '2026-07-12', today: '2026-07-12', maxTrainingDate: '2026-07-12',
      attendanceMarks: [{ clientId: 'client-2', state: 'Unmarked' }],
    })

    renderWithProviders(<AttendanceWorkspace user={user} />)

    expect(await screen.findByText('Иван Иванов')).toBeVisible()
    expect(screen.queryByText('Анна Петрова')).not.toBeInTheDocument()
    expect(screen.queryByText('Петр Сидоров')).not.toBeInTheDocument()
    expect(screen.getByText('Отмечено 2 из 3')).toBeVisible()
    expect(screen.getByText('Показывать клиентов')).toBeVisible()

    const requestsBeforeSwitch = getRoster.mock.calls.length
    fireEvent.click(within(screen.getByTestId('attendance-roster-view-control')).getByRole('radio', { name: 'Все' }))
    expect(await screen.findByText('Анна Петрова')).toBeVisible()
    expect(screen.getByText('Петр Сидоров')).toBeVisible()
    expect(within(screen.getByTestId('attendance-client-card-client-1')).getByRole('radio', { name: 'Не отмечено' })).toBeChecked()
    expect(within(screen.getByTestId('attendance-client-card-client-2')).getByRole('radio', { name: 'Был' })).toBeChecked()
    expect(within(screen.getByTestId('attendance-client-card-client-3')).getByRole('radio', { name: 'Не был' })).toBeChecked()
    expect(getRoster).toHaveBeenCalledTimes(requestsBeforeSwitch)
    expect(saveMarks).not.toHaveBeenCalled()

    fireEvent.click(within(screen.getByTestId('attendance-client-card-client-2')).getByRole('radio', { name: 'Не отмечено' }))
    await waitFor(() => expect(saveMarks).toHaveBeenCalledWith('group-1', {
      trainingDate: '2026-07-12', attendanceMarks: [{ clientId: 'client-2', state: 'Unmarked' }],
    }))
    expect(within(screen.getByTestId('attendance-client-card-client-2')).getByRole('radio', { name: 'Не отмечено' })).toBeChecked()
    fireEvent.click(within(screen.getByTestId('attendance-roster-view-control')).getByRole('radio', { name: 'Не отмечено' }))
    expect(await screen.findByText('Анна Петрова')).toBeVisible()
  })

  test('distinguishes an empty group from a completed default view and opens all clients', async () => {
    getRoster.mockResolvedValueOnce({
      groupId: 'group-1', trainingDate: '2026-07-12', today: '2026-07-12', maxTrainingDate: '2026-07-12', clients: [],
    })
    const { unmount } = renderWithProviders(<AttendanceWorkspace user={user} />)
    expect(await screen.findByText('В выбранной группе пока нет клиентов')).toBeVisible()
    expect(screen.queryByText('Все клиенты отмечены')).not.toBeInTheDocument()
    unmount()

    getRoster.mockResolvedValue({
      groupId: 'group-1', trainingDate: '2026-07-12', today: '2026-07-12', maxTrainingDate: '2026-07-12',
      clients: [buildClient('client-2', 'Анна Петрова', 'Present')],
    })
    renderWithProviders(<AttendanceWorkspace user={user} />)
    expect(await screen.findByText('Все клиенты отмечены')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Показать всех' }))
    expect(await screen.findByText('Анна Петрова')).toBeVisible()
  })

  test('returns to the unmarked view when the training date changes', async () => {
    getGroups.mockResolvedValue({
      groups: [{ id: 'group-1', name: 'Вечерняя' }],
      today: '2026-07-12',
      maxTrainingDate: '2026-07-12',
    })
    getRoster.mockImplementation(async (groupId, trainingDate) => ({
      groupId,
      trainingDate,
      today: '2026-07-12',
      maxTrainingDate: '2026-07-12',
      clients: [
        buildClient('client-1', 'Иван Иванов', 'Unmarked'),
        buildClient('client-2', 'Анна Петрова', 'Present'),
      ],
    }))

    renderWithProviders(<AttendanceWorkspace user={user} />)
    await screen.findByText('Иван Иванов')
    const viewControl = screen.getByTestId('attendance-roster-view-control')
    fireEvent.click(within(viewControl).getByRole('radio', { name: 'Все' }))
    expect(await screen.findByText('Анна Петрова')).toBeVisible()

    fireEvent.change(screen.getByLabelText('Дата тренировки'), { target: { value: '2026-07-11' } })

    await waitFor(() => expect(getRoster).toHaveBeenLastCalledWith('group-1', '2026-07-11', expect.any(AbortSignal)))
    expect(within(viewControl).getByRole('radio', { name: 'Не отмечено' })).toBeChecked()
    expect(screen.queryByText('Анна Петрова')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Дата тренировки')).toHaveValue('2026-07-11')
  })
})

function buildClient(id: string, fullName: string, state: 'Unmarked' | 'Present' | 'Absent') {
  return {
    id, fullName, state, groups: [], photo: null, isProfessional: false,
    professionalComment: null, hasActiveMembership: true, membershipWarning: false, currentMembership: null,
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
