import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  ApiError,
  getAttendanceGroupClients,
  getAttendanceGroups,
  getAttendanceLessonClients,
  saveAttendanceMarks,
  saveAttendanceLessonMarks,
  type AuthenticatedUser,
} from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import { createClientProfileReturnContext } from '../clients/clientProfileReturnState'
import { AttendanceScreen, AttendanceWorkspace } from './AttendanceScreen'

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  getAttendanceGroupClients: vi.fn(),
  getAttendanceGroups: vi.fn(),
  getAttendanceLessonClients: vi.fn(),
  saveAttendanceMarks: vi.fn(),
  saveAttendanceLessonMarks: vi.fn(),
}))

const user = {
  role: 'Coach',
  permissions: { canMarkAttendance: true },
} as AuthenticatedUser
const administratorUser = {
  role: 'Administrator',
  permissions: { canMarkAttendance: true },
} as AuthenticatedUser
const getGroups = vi.mocked(getAttendanceGroups)
const getRoster = vi.mocked(getAttendanceGroupClients)
const getLessonRoster = vi.mocked(getAttendanceLessonClients)
const saveMarks = vi.mocked(saveAttendanceMarks)
const saveLessonMarks = vi.mocked(saveAttendanceLessonMarks)

beforeEach(() => {
  getGroups.mockReset()
  getRoster.mockReset()
  getLessonRoster.mockReset()
  saveMarks.mockReset()
  saveLessonMarks.mockReset()
  getGroups.mockResolvedValue({
    groups: [{ id: 'group-1', name: 'Вечерняя' }],
    today: '2026-07-12',
    minTrainingDate: '2026-07-10',
    maxTrainingDate: '2026-07-12',
  })
  getRoster.mockResolvedValue({
    groupId: 'group-1',
    trainingDate: '2026-07-12',
    today: '2026-07-12',
    minTrainingDate: '2026-07-10',
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
      currentMemberships: [],
    }],
  })
  getLessonRoster.mockResolvedValue({
    groupId: 'group-1',
    trainingDate: '2026-07-12',
    lessonOccurrenceId: 'lesson-1',
    lessonDate: '2026-07-12',
    canEditAttendance: { allowed: true, reason: null },
    today: '2026-07-12',
    minTrainingDate: '2026-07-10',
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
      currentMemberships: [],
    }],
  })
  saveLessonMarks.mockResolvedValue({
    groupId: 'group-1',
    trainingDate: '2026-07-12',
    lessonOccurrenceId: 'lesson-1',
    lessonDate: '2026-07-12',
    today: '2026-07-12',
    minTrainingDate: '2026-07-10',
    maxTrainingDate: '2026-07-12',
    attendanceMarks: [{ clientId: 'client-1', state: 'Present' }],
  })
})

describe('AttendanceWorkspace', () => {
  test('top-level Attendance does not load or mutate by legacy group/date', () => {
    renderWithProviders(<AttendanceScreen user={user} />)

    expect(screen.getByText('Посещаемость открывается из занятия')).toBeVisible()
    expect(getGroups).not.toHaveBeenCalled()
    expect(getRoster).not.toHaveBeenCalled()
    expect(saveMarks).not.toHaveBeenCalled()
  })

  test('occurrence route loads and saves by lessonOccurrenceId plus lessonDate', async () => {
    renderWithProviders(
      <AttendanceScreen
        lessonTarget={{
          lessonOccurrenceId: 'lesson-1',
          lessonDate: '2026-07-12',
        }}
        user={user}
      />,
    )

    const card = await screen.findByTestId('attendance-client-card-client-1')
    expect(getLessonRoster).toHaveBeenCalledWith(
      'lesson-1',
      '2026-07-12',
      expect.any(AbortSignal),
    )
    expect(screen.queryByText('lesson-1')).not.toBeInTheDocument()

    fireEvent.click(within(card).getByText('Был'))

    await waitFor(() =>
      expect(saveLessonMarks).toHaveBeenCalledWith('lesson-1', {
        lessonDate: '2026-07-12',
        trainingDate: '2026-07-12',
        attendanceMarks: [{ clientId: 'client-1', state: 'Present' }],
      }),
    )
  })

  test('occurrence route captures backend roster group for client return navigation', async () => {
    const onOpenClient = vi.fn()
    renderWithProviders(
      <AttendanceWorkspace
        lessonTarget={{
          lessonOccurrenceId: 'lesson-1',
          lessonDate: '2026-07-12',
        }}
        onOpenClient={onOpenClient}
        user={user}
      />,
    )

    const card = await screen.findByTestId('attendance-client-card-client-1')
    fireEvent.click(
      within(card).getByRole('button', {
        name: 'Открыть карточку клиента Иван Иванов',
      }),
    )

    expect(onOpenClient).toHaveBeenCalledWith(
      'client-1',
      {
        kind: 'attendance',
        route: {
          kind: 'attendanceLesson',
          lessonOccurrenceId: 'lesson-1',
          lessonDate: '2026-07-12',
        },
        groupId: 'group-1',
        lessonOccurrenceId: 'lesson-1',
        lessonDate: '2026-07-12',
        trainingDate: '2026-07-12',
        rosterView: 'unmarked',
        anchorClientId: 'client-1',
      },
    )
  })

  test('occurrence read-only roster disables row controls from backend canEditAttendance', async () => {
    getLessonRoster.mockResolvedValueOnce({
      groupId: 'group-1',
      trainingDate: '2026-07-12',
      lessonOccurrenceId: 'lesson-1',
      lessonDate: '2026-07-12',
      canEditAttendance: { allowed: false, reason: 'future-lesson' },
      today: '2026-07-12',
      minTrainingDate: '2026-07-10',
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
        currentMemberships: [],
      }],
    })

    renderWithProviders(
      <AttendanceWorkspace
        lessonTarget={{
          lessonOccurrenceId: 'lesson-1',
          lessonDate: '2026-07-12',
        }}
        user={user}
      />,
    )

    const card = await screen.findByTestId('attendance-client-card-client-1')
    expect(card).toHaveTextContent('Будущее занятие доступно только для просмотра.')
    expect(within(card).getByRole('radio', { name: 'Был' })).toBeDisabled()
  })

  test('captures the selected attendance group, date, view and exact client', async () => {
    const onOpenClient = vi.fn()
    renderWithProviders(
      <AttendanceWorkspace onOpenClient={onOpenClient} user={user} />,
    )

    const card = await screen.findByTestId('attendance-client-card-client-1')
    fireEvent.click(
      within(screen.getByTestId('attendance-roster-view-control')).getByRole(
        'radio',
        { name: 'Все' },
      ),
    )
    fireEvent.click(
      within(card).getByRole('button', {
        name: 'Открыть карточку клиента Иван Иванов',
      }),
    )

    expect(onOpenClient).toHaveBeenCalledWith(
      'client-1',
      {
        kind: 'attendance',
        route: { kind: 'section', section: 'Attendance' },
        groupId: 'group-1',
        trainingDate: '2026-07-12',
        rosterView: 'all',
        anchorClientId: 'client-1',
      },
    )
  })

  test('reconciles a stale group after scope load while preserving a valid date and view', async () => {
    const initialReturnContext = createClientProfileReturnContext({
      origin: {
        kind: 'attendance',
        route: { kind: 'section', section: 'Attendance' },
        groupId: 'stale-group',
        trainingDate: '2026-07-11',
        rosterView: 'all',
        anchorClientId: 'client-1',
      },
      originEntryKey: 'client-profile:attendance-stale-group',
      returnDepth: 0,
    })

    renderWithProviders(
      <AttendanceWorkspace
        initialReturnContext={initialReturnContext}
        onOpenClient={vi.fn()}
        user={user}
      />,
    )

    await screen.findByTestId('attendance-client-card-client-1')
    expect(getRoster).toHaveBeenCalledWith(
      'group-1',
      '2026-07-11',
      expect.any(AbortSignal),
    )
    expect(
      getRoster.mock.calls.some(([groupId]) => groupId === 'stale-group'),
    ).toBe(false)
    expect(
      within(screen.getByTestId('attendance-roster-view-control')).getByRole(
        'radio',
        { name: 'Все' },
      ),
    ).toBeChecked()
    expect(screen.getByText(/группа.*измен/i)).toBeVisible()
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: 'Открыть карточку клиента Иван Иванов',
        }),
      ).toHaveFocus(),
    )
  })

  test('reconciles a stale date to today while preserving an allowed group', async () => {
    const initialReturnContext = createClientProfileReturnContext({
      origin: {
        kind: 'attendance',
        route: { kind: 'section', section: 'Attendance' },
        groupId: 'group-1',
        trainingDate: '2026-06-01',
        rosterView: 'unmarked',
        anchorClientId: 'client-1',
      },
      originEntryKey: 'client-profile:attendance-stale-date',
      returnDepth: 0,
    })

    renderWithProviders(
      <AttendanceWorkspace
        initialReturnContext={initialReturnContext}
        onOpenClient={vi.fn()}
        user={user}
      />,
    )

    await screen.findByTestId('attendance-client-card-client-1')
    expect(getRoster).toHaveBeenCalledWith(
      'group-1',
      '2026-07-12',
      expect.any(AbortSignal),
    )
    expect(
      getRoster.mock.calls.some(([, date]) => date === '2026-06-01'),
    ).toBe(false)
    expect(screen.getByText(/дата.*измен/i)).toBeVisible()
  })

  test('keeps a failed row in the default view and removes it only after exact retry succeeds', async () => {
    saveMarks
      .mockRejectedValueOnce(new Error('Связь прервана'))
      .mockResolvedValueOnce({
        groupId: 'group-1',
        trainingDate: '2026-07-12',
        today: '2026-07-12',
        minTrainingDate: '2026-07-10',
        maxTrainingDate: '2026-07-12',
        attendanceMarks: [{ clientId: 'client-1', state: 'Present' }],
      })

    renderWithProviders(<AttendanceWorkspace user={user} />)

    expect(await screen.findByLabelText('Посещение: Иван Иванов')).toBeVisible()
    expect(screen.getByTestId('attendance-toolbar')).toHaveClass(
      'attendance-context-controls',
      'crm-context-surface',
    )
    expect(screen.getByTestId('attendance-toolbar')).not.toHaveClass('crm-filter-surface')
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

  test('keeps the attendance workbench controls in a single compact toolbar', async () => {
    renderWithProviders(<AttendanceWorkspace user={user} />)

    await screen.findByTestId('attendance-client-card-client-1')
    const toolbar = screen.getByTestId('attendance-toolbar')
    const selectedGroupHeading = screen.queryByRole('heading', { name: 'Вечерняя' })
    const groupSelect = screen.getByRole('combobox', { name: 'Группа' })
    const trainingDate = screen.getByLabelText('Дата тренировки')
    const previousDate = screen.getByRole('button', { name: 'Предыдущая дата' })
    const todayButton = screen.getByRole('button', { name: 'Сегодня' })
    const nextDate = screen.getByRole('button', { name: 'Следующая дата' })
    const progress = screen.getByRole('progressbar', { name: 'Отмечено 0 из 1' })
    const viewControl = screen.getByTestId('attendance-roster-view-control')
    const refreshButton = screen.getByRole('button', { name: 'Обновить список' })

    expect(selectedGroupHeading).not.toBeInTheDocument()
    expect(toolbar).toBeVisible()
    expect(groupSelect).toBeVisible()
    expect(trainingDate).toBeVisible()
    expect(previousDate).toBeVisible()
    expect(todayButton).toBeVisible()
    expect(nextDate).toBeVisible()
    expect(progress).toBeVisible()
    expect(viewControl).toBeVisible()
    expect(refreshButton).toBeVisible()

    expect(toolbar).toContainElement(progress)
    expect(toolbar).toContainElement(viewControl)
    expect(toolbar).toContainElement(refreshButton)
    expect(progress).toHaveAttribute('aria-valuenow', '0')
    expect(progress).toHaveAttribute('aria-valuemin', '0')
    expect(progress).toHaveAttribute('aria-valuemax', '1')
  })

  test('reports large progress from the complete confirmed roster', async () => {
    getRoster.mockResolvedValue({
      groupId: 'group-1',
      trainingDate: '2026-07-12',
      today: '2026-07-12',
      minTrainingDate: '2026-07-10',
      maxTrainingDate: '2026-07-12',
      clients: [
        buildClient('client-1', 'Александра Константинопольская-Северная', 'Unmarked'),
        ...Array.from({ length: 122 }, (_, index) =>
          buildClient(`client-${index + 2}`, `Отмеченный клиент ${index + 2}`, 'Present'),
        ),
      ],
    })

    renderWithProviders(<AttendanceWorkspace user={user} />)

    await screen.findByTestId('attendance-client-card-client-1')
    const progress = screen.getByRole('progressbar', { name: 'Отмечено 122 из 123' })
    expect(progress).toHaveAttribute('aria-valuenow', '122')
    expect(progress).toHaveAttribute('aria-valuemax', '123')
    expect(screen.getByText('Отмечено 122 из 123')).toBeVisible()
  })

  test('disables manual refresh while a row save is pending', async () => {
    const pendingSave = createDeferred<Awaited<ReturnType<typeof saveAttendanceMarks>>>()
    saveMarks.mockReturnValueOnce(pendingSave.promise)
    renderWithProviders(<AttendanceWorkspace user={user} />)
    await screen.findByLabelText('Посещение: Иван Иванов')

    fireEvent.click(screen.getByText('Был'))

    expect(screen.getByRole('button', { name: 'Обновить список' })).toBeDisabled()
    pendingSave.resolve({
      groupId: 'group-1', trainingDate: '2026-07-12', today: '2026-07-12', minTrainingDate: '2026-07-10', maxTrainingDate: '2026-07-12',
      attendanceMarks: [{ clientId: 'client-1', state: 'Present' }],
    })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Обновить список' })).toBeEnabled())
  })

  test('preserves professional/inactive/warning copy in roster rows', async () => {
    getRoster.mockResolvedValue({
      groupId: 'group-1',
      trainingDate: '2026-07-12',
      today: '2026-07-12',
      minTrainingDate: '2026-07-10',
      maxTrainingDate: '2026-07-12',
      clients: [
        {
          id: 'client-pro',
          fullName: 'Профессионал Клиент',
          state: 'Unmarked',
          groups: [],
          photo: null,
          isProfessional: true,
          professionalComment: 'Сборная',
          hasActiveMembership: true,
          membershipWarning: false,
          currentMemberships: [],
        },
        {
          id: 'client-inactive',
          fullName: 'Клиент без статуса',
          state: 'Unmarked',
          groups: [],
          photo: null,
          isProfessional: false,
          professionalComment: null,
          hasActiveMembership: false,
          membershipWarning: false,
          currentMemberships: [],
        },
        {
          id: 'client-warning',
          fullName: 'Клиент с предупреждением',
          state: 'Unmarked',
          groups: [],
          photo: null,
          isProfessional: false,
          professionalComment: null,
          hasActiveMembership: false,
          membershipWarning: true,
          membershipWarningMessage: 'Абонемент просрочен, отметка посещения доступна.',
          currentMemberships: [],
        } as unknown as Awaited<ReturnType<typeof getAttendanceGroupClients>>['clients'][number],
      ],
    })

    renderWithProviders(<AttendanceWorkspace user={user} />)

    const professionalCard = await screen.findByTestId('attendance-client-card-client-pro')
    const inactiveCard = screen.getByTestId('attendance-client-card-client-inactive')
    const warningCard = screen.getByTestId('attendance-client-card-client-warning')

    expect(within(professionalCard).getByText('Профессиональный статус')).toBeVisible()
    expect(within(professionalCard).getByText('Профессионал')).toBeVisible()
    expect(within(inactiveCard).getByText('Нужна проверка статуса абонемента')).toBeVisible()
    expect(within(warningCard).getByText('Есть предупреждение по абонементу')).toBeVisible()
    expect(within(warningCard).getByText('Абонемент просрочен, отметка посещения доступна.')).toBeVisible()
  })

  test('shows groups load errors and retries the existing groups reload path', async () => {
    getGroups
      .mockRejectedValueOnce(new Error('Группы временно недоступны'))
      .mockResolvedValueOnce({
        groups: [{ id: 'group-1', name: 'Вечерняя' }],
        today: '2026-07-12',
        minTrainingDate: '2026-07-10',
        maxTrainingDate: '2026-07-12',
      })

    renderWithProviders(<AttendanceWorkspace user={user} />)

    expect(await screen.findByText('Группы для посещений не загрузились')).toBeVisible()
    expect(screen.getByText('Группы временно недоступны')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку групп' }))

    await waitFor(() => expect(getGroups).toHaveBeenCalledTimes(2))
    expect(await screen.findByTestId('attendance-toolbar')).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Группа' })).toBeVisible()
  })

  test('keeps a saved row and exposes stale retry when refresh after save fails', async () => {
    const roster = await getRoster('group-1', '2026-07-12')
    getRoster.mockReset()
    getRoster
      .mockResolvedValueOnce(roster)
      .mockRejectedValueOnce(new Error('Сбой фонового обновления'))
      .mockResolvedValueOnce({
        ...roster,
        clients: roster.clients.map((client) => ({ ...client, state: 'Present' })),
      })

    saveMarks.mockResolvedValue({
      groupId: 'group-1',
      trainingDate: '2026-07-12',
      today: '2026-07-12',
      minTrainingDate: '2026-07-10',
      maxTrainingDate: '2026-07-12',
      attendanceMarks: [{ clientId: 'client-1', state: 'Present' }],
    })

    renderWithProviders(<AttendanceWorkspace user={user} />)

    await screen.findByLabelText('Посещение: Иван Иванов')
    fireEvent.click(screen.getByText('Был'))

    expect(await screen.findByText('Все клиенты отмечены')).toBeVisible()
    await waitFor(() => expect(getRoster).toHaveBeenCalledTimes(2))
    expect(
      await screen.findByText('Не удалось обновить список после сохранения.'),
    ).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Показать всех' }))
    expect(await screen.findByRole('radio', { name: 'Был' })).toBeChecked()
    expect(screen.getByText('Сохранено')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Повторить обновление списка' }))
    await waitFor(() => expect(getRoster).toHaveBeenCalledTimes(3))
    await waitFor(() =>
      expect(screen.queryByText('Не удалось обновить список после сохранения.')).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('radio', { name: 'Был' })).toBeChecked()
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
        groupId: 'group-1', trainingDate: '2026-07-12', today: '2026-07-12', minTrainingDate: '2026-07-10', maxTrainingDate: '2026-07-12',
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
        groupId: 'group-1', trainingDate: '2026-07-12', today: '2026-07-12', minTrainingDate: '2026-07-10', maxTrainingDate: '2026-07-12',
        attendanceMarks: [{ clientId: 'client-1', state: 'Present' }],
      })
      .mockResolvedValueOnce({
        groupId: 'group-1', trainingDate: '2026-07-12', today: '2026-07-12', minTrainingDate: '2026-07-10', maxTrainingDate: '2026-07-12',
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
      groupId: 'group-1', trainingDate: '2026-07-12', today: '2026-07-12', minTrainingDate: '2026-07-10', maxTrainingDate: '2026-07-12',
      clients: [
        buildClient('client-1', 'Иван Иванов', 'Unmarked'),
        buildClient('client-2', 'Анна Петрова', 'Present'),
        buildClient('client-3', 'Петр Сидоров', 'Absent'),
      ],
    })
    saveMarks.mockResolvedValue({
      groupId: 'group-1', trainingDate: '2026-07-12', today: '2026-07-12', minTrainingDate: '2026-07-10', maxTrainingDate: '2026-07-12',
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
      groupId: 'group-1', trainingDate: '2026-07-12', today: '2026-07-12', minTrainingDate: '2026-07-10', maxTrainingDate: '2026-07-12', clients: [],
    })
    const { unmount } = renderWithProviders(<AttendanceWorkspace user={user} />)
    expect(await screen.findByText('В выбранной группе пока нет клиентов')).toBeVisible()
    expect(screen.queryByText('Все клиенты отмечены')).not.toBeInTheDocument()
    unmount()

    getRoster.mockResolvedValue({
      groupId: 'group-1', trainingDate: '2026-07-12', today: '2026-07-12', minTrainingDate: '2026-07-10', maxTrainingDate: '2026-07-12',
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
      minTrainingDate: '2026-07-10',
      maxTrainingDate: '2026-07-12',
    })
    getRoster.mockImplementation(async (groupId, trainingDate) => ({
      groupId,
      trainingDate,
      today: '2026-07-12',
      minTrainingDate: '2026-07-10',
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

  test('clears an Administrator roster and reloads groups after attendance scope is revoked', async () => {
    getGroups
      .mockResolvedValueOnce({
        groups: [{ id: 'group-1', name: 'Вечерняя' }],
        today: '2026-07-12',
        minTrainingDate: null,
        maxTrainingDate: '2026-07-12',
      })
      .mockResolvedValueOnce({
        groups: [],
        today: '2026-07-12',
        minTrainingDate: null,
        maxTrainingDate: '2026-07-12',
      })
    saveMarks.mockRejectedValueOnce(
      new ApiError(
        'Доступ к группе запрещен.',
        403,
        {},
        'attendance_group_forbidden',
      ),
    )

    renderWithProviders(<AttendanceWorkspace user={administratorUser} />)

    const card = await screen.findByTestId('attendance-client-card-client-1')
    fireEvent.click(within(card).getByRole('radio', { name: 'Был' }))

    expect(await screen.findByText('Доступ к группе изменился')).toBeVisible()
    await waitFor(() => expect(getGroups).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Нет групп для отметки посещений')).toBeVisible()
    expect(
      screen.getByText('Главный тренер или суперадминистратор назначит группы, после этого они появятся здесь.'),
    ).toBeVisible()
    expect(screen.queryByTestId('attendance-roster')).not.toBeInTheDocument()
  })

  test('treats a bare attendance 403 as revoked scope for current backend compatibility', async () => {
    getGroups
      .mockResolvedValueOnce({
        groups: [{ id: 'group-1', name: 'Вечерняя' }],
        today: '2026-07-12',
        minTrainingDate: null,
        maxTrainingDate: '2026-07-12',
      })
      .mockResolvedValueOnce({
        groups: [],
        today: '2026-07-12',
        minTrainingDate: null,
        maxTrainingDate: '2026-07-12',
      })
    saveMarks.mockRejectedValueOnce(
      new ApiError('Не удалось выполнить запрос.', 403),
    )

    renderWithProviders(<AttendanceWorkspace user={administratorUser} />)

    const card = await screen.findByTestId('attendance-client-card-client-1')
    fireEvent.click(within(card).getByRole('radio', { name: 'Был' }))

    expect(await screen.findByText('Доступ к группе изменился')).toBeVisible()
    await waitFor(() => expect(getGroups).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Нет групп для отметки посещений')).toBeVisible()
  })
})

function buildClient(id: string, fullName: string, state: 'Unmarked' | 'Present' | 'Absent') {
  return {
    id, fullName, state, groups: [], photo: null, isProfessional: false,
    professionalComment: null, hasActiveMembership: true, membershipWarning: false, currentMemberships: [],
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
