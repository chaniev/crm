import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  ApiError,
  applyScheduleLessonCancellation,
  applyGroupLessonSeries,
  applyScheduleLessonTrainerSubstitution,
  applyScheduleLessonTrainerSubstitutionCancellation,
  changeScheduleLesson,
  createScheduleOneOffLesson,
  getGroupLessonSeries,
  getScheduleLesson,
  getScheduleLessons,
  previewGroupLessonSeries,
  previewScheduleLessonCancellation,
  previewScheduleLessonChange,
  previewScheduleOneOffLesson,
  previewScheduleLessonTrainerSubstitution,
  previewScheduleLessonTrainerSubstitutionCancellation,
  type ScheduleLesson,
} from '../../lib/api'
import { renderWithProviders } from '../../test/render'
import {
  createScheduleReturnSnapshot,
  mergeScheduleReturnSnapshotIntoHistoryState,
  readScheduleReturnSnapshot,
  stripScheduleReturnSnapshotFromHistoryState,
} from './scheduleReturnState'
import {
  GroupScheduleScreen,
  ScheduleLessonChangeRouteScreen,
  ScheduleLessonCreateScreen,
  ScheduleSeriesEditScreen,
} from './GroupScheduleScreen'

vi.mock('../../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/api')>()),
  applyScheduleLessonCancellation: vi.fn(),
  applyGroupLessonSeries: vi.fn(),
  applyScheduleLessonTrainerSubstitution: vi.fn(),
  applyScheduleLessonTrainerSubstitutionCancellation: vi.fn(),
  changeScheduleLesson: vi.fn(),
  createScheduleOneOffLesson: vi.fn(),
  getGroupLessonSeries: vi.fn(),
  getScheduleLesson: vi.fn(),
  getScheduleLessons: vi.fn(),
  previewGroupLessonSeries: vi.fn(),
  previewScheduleLessonCancellation: vi.fn(),
  previewScheduleLessonChange: vi.fn(),
  previewScheduleOneOffLesson: vi.fn(),
  previewScheduleLessonTrainerSubstitution: vi.fn(),
  previewScheduleLessonTrainerSubstitutionCancellation: vi.fn(),
}))

const getLessons = vi.mocked(getScheduleLessons)
const getLesson = vi.mocked(getScheduleLesson)
const getSeries = vi.mocked(getGroupLessonSeries)
const previewOneOff = vi.mocked(previewScheduleOneOffLesson)
const createOneOff = vi.mocked(createScheduleOneOffLesson)
const previewSeries = vi.mocked(previewGroupLessonSeries)
const applySeries = vi.mocked(applyGroupLessonSeries)
const previewLessonChange = vi.mocked(previewScheduleLessonChange)
const changeLesson = vi.mocked(changeScheduleLesson)
const previewLessonCancellation = vi.mocked(previewScheduleLessonCancellation)
const applyLessonCancellation = vi.mocked(applyScheduleLessonCancellation)
const previewTrainerSubstitution = vi.mocked(previewScheduleLessonTrainerSubstitution)
const applyTrainerSubstitution = vi.mocked(applyScheduleLessonTrainerSubstitution)
const previewTrainerSubstitutionCancellation = vi.mocked(previewScheduleLessonTrainerSubstitutionCancellation)
const applyTrainerSubstitutionCancellation = vi.mocked(applyScheduleLessonTrainerSubstitutionCancellation)

beforeEach(() => {
  window.history.replaceState({}, '', '/schedule')
  getLessons.mockReset()
  getLesson.mockReset()
  getSeries.mockReset()
  previewOneOff.mockReset()
  createOneOff.mockReset()
  previewSeries.mockReset()
  applySeries.mockReset()
  previewLessonChange.mockReset()
  changeLesson.mockReset()
  previewLessonCancellation.mockReset()
  applyLessonCancellation.mockReset()
  previewTrainerSubstitution.mockReset()
  applyTrainerSubstitution.mockReset()
  previewTrainerSubstitutionCancellation.mockReset()
  applyTrainerSubstitutionCancellation.mockReset()
  getLessons.mockResolvedValue(buildScheduleResponse([
    buildLesson({
      lessonOccurrenceId: 'occurrence-morning',
      startTime: '08:00',
      endTime: '08:50',
      groupName: 'Утренняя база',
    }),
    buildLesson({
      lessonOccurrenceId: 'occurrence-evening',
      startTime: '18:00',
      endTime: '18:50',
      groupName: 'Утренняя база',
      hasAttendanceMarks: true,
    }),
  ]))
  getLesson.mockResolvedValue(buildLesson({
    allowedActions: buildAllowedActions({
      edit: { allowed: true, reason: null },
      move: { allowed: true, reason: null },
    }),
  }))
  getSeries.mockResolvedValue(buildSeriesResponse())
  previewOneOff.mockResolvedValue(buildPreviewResponse())
  createOneOff.mockResolvedValue(buildLesson({
    lessonOccurrenceId: 'created-one-off',
    sourceKind: 'OneOff',
    isMaterialized: true,
    lessonDate: '2026-08-20',
    startTime: '12:30',
    endTime: '13:30',
  }))
  previewLessonChange.mockResolvedValue(buildChangePreviewResponse())
  changeLesson.mockResolvedValue(buildLesson({
    lessonOccurrenceId: 'occurrence-morning',
    isMaterialized: true,
    lessonDate: '2026-08-21',
    startTime: '11:15',
    durationMinutes: 60,
    endTime: '12:15',
    revision: 'revision-2',
  }))
  previewLessonCancellation.mockResolvedValue(buildCancellationPreviewResponse('Cancel'))
  applyLessonCancellation.mockResolvedValue(buildLesson({
    lessonOccurrenceId: 'occurrence-morning',
    isMaterialized: true,
    status: 'Cancelled',
    revision: 'revision-2',
    allowedActions: buildAllowedActions({
      restore: { allowed: true, reason: null },
    }),
  }))
  previewSeries.mockResolvedValue(buildSeriesPreviewResponse())
  applySeries.mockResolvedValue(buildSeriesPreviewResponse())
  previewTrainerSubstitution.mockResolvedValue(buildTrainerSubstitutionPreviewResponse())
  applyTrainerSubstitution.mockResolvedValue({
    lessons: [buildLesson({
      effectiveTrainers: [
        {
          trainerId: 'trainer-1',
          fullName: 'Алиса',
          kind: 'Permanent',
          replacedTrainerId: null,
          substitutionId: null,
        },
        {
          trainerId: 'trainer-2',
          fullName: 'Борис',
          kind: 'Substitute',
          replacedTrainerId: 'trainer-1',
          substitutionId: 'substitution-1',
        },
      ],
      revision: 'after-substitution',
    })],
    warnings: [],
  })
  previewTrainerSubstitutionCancellation.mockResolvedValue(buildTrainerSubstitutionPreviewResponse())
  applyTrainerSubstitutionCancellation.mockResolvedValue({
    lessons: [buildLesson({ revision: 'after-substitution-cancel' })],
    warnings: [],
  })
})

describe('GroupScheduleScreen occurrence calendar', () => {
  test('loads date/view/filter state from URL and keeps same-day occurrences distinct', async () => {
    window.history.replaceState({}, '', '/schedule?date=2026-08-20&view=day&trainerId=trainer-1')
    const onOpenAttendance = vi.fn()
    const onOpenLessonDetail = vi.fn()

    renderSchedule({ onOpenAttendance, onOpenLessonDetail })

    await screen.findByTestId('schedule-card-occurrence-morning')
    expect(getLessons).toHaveBeenCalledWith(
      {
        from: '2026-08-20',
        to: '2026-08-20',
        branchId: null,
        hallId: null,
        trainerId: 'trainer-1',
        groupId: null,
        groupTypeId: null,
      },
      expect.any(AbortSignal),
    )

    expect(screen.getByTestId('schedule-time-group-2026-08-20-08:00-08:50')).toHaveTextContent('08:00-08:50')
    expect(screen.getByTestId('schedule-time-group-2026-08-20-18:00-18:50')).toHaveTextContent('18:00-18:50')
    expect(screen.getByTestId('schedule-card-occurrence-morning')).toHaveAttribute(
      'id',
      'schedule-card-anchor-occurrence-morning',
    )
    // The exact interval is the time-group heading and is not repeated inside sibling cards.
    expect(within(screen.getByTestId('schedule-card-occurrence-morning')).queryByText('08:00-08:50')).not.toBeInTheDocument()
    expect(screen.getByTestId('schedule-card-occurrence-evening')).toHaveTextContent('Отметки есть')

    fireEvent.click(
      within(screen.getByTestId('schedule-card-occurrence-evening')).getByRole(
        'button',
        { name: /Открыть занятие/ },
      ),
    )
    expect(onOpenLessonDetail).toHaveBeenCalledWith('occurrence-evening', '2026-08-20')

    fireEvent.click(
      within(screen.getByTestId('schedule-card-occurrence-evening')).getByRole(
        'button',
        { name: 'Посещение' },
      ),
    )

    expect(onOpenAttendance).toHaveBeenCalledWith('occurrence-evening', '2026-08-20')
    expect(
      within(screen.getByTestId('schedule-card-occurrence-evening')).queryByRole(
        'button',
        { name: /Посещаемость/ },
      ),
    ).not.toBeInTheDocument()
  })

  test('opens tools drawer, uses response filterOptions and writes filters to URL', async () => {
    window.history.replaceState({}, '', '/schedule?date=2026-08-20')
    renderSchedule()

    await screen.findByTestId('schedule-card-occurrence-morning')
    fireEvent.click(screen.getByRole('button', { name: 'Параметры календаря' }))

    const drawer = await screen.findByRole('dialog', { name: 'Параметры календаря' })
    fireEvent.click(within(drawer).getByLabelText('Филиал'))
    fireEvent.click(await screen.findByRole('option', { name: 'Центр' }))

    await waitFor(() =>
      expect(window.location.search).toContain('branchId=branch-1'),
    )
    expect(getLessons).toHaveBeenLastCalledWith(
      expect.objectContaining({ branchId: 'branch-1' }),
      expect.any(AbortSignal),
    )
    expect(
      screen.getByRole('button', { name: /активных фильтров: 1/ }),
    ).toBeVisible()
  })

  test('week mode queries ISO Monday-Sunday and renders seven vertical sections', async () => {
    window.history.replaceState({}, '', '/schedule?date=2026-08-20&view=week')
    renderSchedule()

    await screen.findByTestId('schedule-week-view')

    expect(getLessons).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '2026-08-17',
        to: '2026-08-23',
      }),
      expect.any(AbortSignal),
    )
    expect(screen.getAllByTestId(/^schedule-day-section-/)).toHaveLength(7)
    expect(screen.getByTestId('schedule-day-section-2026-08-20')).toHaveTextContent('2 занятия')
  })

  test('disabled attendance action keeps backend reason visible and does not call route handler', async () => {
    window.history.replaceState({}, '', '/schedule?date=2026-08-20')
    getLessons.mockResolvedValue(buildScheduleResponse([
      buildLesson({
        allowedActions: buildAllowedActions({
          viewAttendance: { allowed: false, reason: 'attendance-forbidden' },
        }),
      }),
    ]))
    const onOpenAttendance = vi.fn()

    renderSchedule({ onOpenAttendance })

    const card = await screen.findByTestId('schedule-card-occurrence-morning')
    const action = within(card).getByRole('button', { name: 'Посещение' })

    expect(action).toBeDisabled()
    expect(card).toHaveTextContent('Посещаемость недоступна для вашей роли или зоны доступа.')
    expect(card).not.toHaveTextContent('attendance-forbidden')
    fireEvent.click(action)
    expect(onOpenAttendance).not.toHaveBeenCalled()
  })

  test('routes edit and move actions from separate backend allowances', async () => {
    window.history.replaceState({}, '', '/schedule?date=2026-08-20')
    getLessons.mockResolvedValue(buildScheduleResponse([
      buildLesson({
        allowedActions: buildAllowedActions({
          edit: { allowed: true, reason: null },
          move: { allowed: true, reason: null },
        }),
      }),
    ]))
    const onEditLesson = vi.fn()
    const onMoveLesson = vi.fn()

    renderSchedule({ onEditLesson, onMoveLesson })

    const card = await screen.findByTestId('schedule-card-occurrence-morning')
    const editSurface = await openMoreActions(card)
    fireEvent.click(within(editSurface).getByRole('button', { name: /Изменить занятие/ }))

    expect(onEditLesson).toHaveBeenCalledWith('occurrence-morning', '2026-08-20')

    // Перенести is a deferred action and is reachable only via the `Ещё` surface.
    const surface = await openMoreActions(card)
    fireEvent.click(within(surface).getByRole('button', { name: /Перенести занятие/ }))
    expect(onMoveLesson).toHaveBeenCalledWith('occurrence-morning', '2026-08-20')
  })

  test('occurrence edit route saves exact change and routes to returned lesson', async () => {
    const onChanged = vi.fn()

    renderLessonChangeRoute({ onChanged })

    const screenRoot = await screen.findByTestId('schedule-lesson-edit-screen')
    expect(within(screenRoot).getByLabelText('Дата')).toHaveValue('2026-08-20')
    expect(within(screenRoot).getByLabelText('Время')).toHaveValue('08:00')
    expect(within(screenRoot).getByLabelText('Зал')).toHaveValue('Основной зал')

    fireEvent.change(within(screenRoot).getByLabelText('Дата'), {
      target: { value: '2026-08-21' },
    })
    fireEvent.change(within(screenRoot).getByLabelText('Время'), {
      target: { value: '11:15' },
    })
    fireEvent.click(within(screenRoot).getByRole('button', { name: 'Получить предпросмотр' }))

    await waitFor(() =>
      expect(previewLessonChange).toHaveBeenCalledWith(
        'occurrence-morning',
        '2026-08-20',
        {
          scope: 'Occurrence',
          newLessonDate: '2026-08-21',
          startTime: '11:15',
          durationMinutes: 50,
          hallId: 'hall-1',
          expectedRevision: 'revision-1',
        },
      ),
    )
    expect(await within(screenRoot).findByText('Проверьте пересечение зала.')).toBeVisible()

    fireEvent.click(within(screenRoot).getByRole('button', { name: 'Сохранить изменение' }))

    await waitFor(() =>
      expect(changeLesson).toHaveBeenCalledWith(
        'occurrence-morning',
        '2026-08-20',
        {
          scope: 'Occurrence',
          newLessonDate: '2026-08-21',
          startTime: '11:15',
          durationMinutes: 50,
          hallId: 'hall-1',
          expectedRevision: 'revision-1',
          confirmationToken: 'change-preview-token',
        },
      ),
    )
    expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({
      lessonOccurrenceId: 'occurrence-morning',
      lessonDate: '2026-08-21',
    }))
  })

  test('stale occurrence change preserves draft and does not show raw backend code', async () => {
    changeLesson.mockRejectedValue(new ApiError(
      'Schedule confirmation token is not valid for this mutation.',
      409,
      {},
      'lesson-mutation-preview-stale',
    ))

    renderLessonChangeRoute()

    const screenRoot = await screen.findByTestId('schedule-lesson-edit-screen')
    fireEvent.change(within(screenRoot).getByLabelText('Время'), {
      target: { value: '11:15' },
    })
    fireEvent.click(within(screenRoot).getByRole('button', { name: 'Получить предпросмотр' }))
    await within(screenRoot).findByText('Проверьте изменение перед сохранением')

    fireEvent.click(within(screenRoot).getByRole('button', { name: 'Сохранить изменение' }))

    expect(await within(screenRoot).findByText('Параметры изменились после предпросмотра. Получите новый предпросмотр.')).toBeVisible()
    expect(within(screenRoot).queryByText('lesson-mutation-preview-stale')).not.toBeInTheDocument()
    expect(within(screenRoot).getByLabelText('Время')).toHaveValue('11:15')
    expect(within(screenRoot).getByRole('button', { name: 'Обновить предпросмотр' })).toBeVisible()
  })

  test('series edit route previews and applies exact backend series contract', async () => {
    const onBack = vi.fn()
    const onSaved = vi.fn()

    renderWithProviders(
      <ScheduleSeriesEditScreen
        groupId="group-1"
        lessonDate="2026-08-20"
        lessonSeriesId="series-1"
        lessonOccurrenceId="occurrence-morning"
        onBack={onBack}
        onSaved={onSaved}
        scope="this-and-future"
      />,
    )

    const screenRoot = await screen.findByTestId('schedule-series-edit-screen')
    expect(await within(screenRoot).findByText('Утренняя база')).toBeVisible()
    expect(within(screenRoot).getByRole('button', { name: 'Удалить слот' })).toBeDisabled()
    fireEvent.change(within(screenRoot).getByLabelText('Время начала'), {
      target: { value: '09:00' },
    })
    fireEvent.click(within(screenRoot).getByRole('button', { name: 'Добавить слот' }))
    expect(within(screenRoot).getAllByTestId(/schedule-series-slot-/)).toHaveLength(2)
    fireEvent.click(within(screenRoot).getAllByRole('button', { name: 'Удалить слот' })[0])
    expect(within(screenRoot).getAllByTestId(/schedule-series-slot-/)).toHaveLength(1)

    fireEvent.click(within(screenRoot).getByRole('button', { name: 'Получить предпросмотр' }))

    expect(await within(screenRoot).findByText('Проверьте изменение серии')).toBeVisible()
    expect(previewSeries).toHaveBeenCalledWith('series-1', expect.objectContaining({
      scope: 'ThisAndFuture',
      effectiveFrom: '2026-08-20',
      expectedRevision: 'series-revision-1',
      slots: [expect.objectContaining({
        isoWeekday: 1,
        startTime: '09:00',
        durationMinutes: 50,
        hallId: 'hall-1',
      })],
    }))

    fireEvent.click(within(screenRoot).getByRole('button', { name: 'Подтвердить изменение серии' }))
    await waitFor(() => expect(applySeries).toHaveBeenCalledWith('series-1', expect.objectContaining({
      confirmationToken: 'series-token',
      expectedRevision: 'series-revision-1',
    })))
    expect(onSaved).toHaveBeenCalled()
  })

  test('opens exact occurrence trainer substitution preview from allowed card action', async () => {
    window.history.replaceState({}, '', '/schedule?date=2026-08-20')
    getLessons.mockResolvedValue(buildScheduleResponse([
      buildLesson({
        allowedActions: buildAllowedActions({
          assignTrainerSubstitution: { allowed: true, reason: null },
        }),
      }),
    ]))

    renderSchedule()

    const card = await screen.findByTestId('schedule-card-occurrence-morning')
    const surface = await openMoreActions(card)
    fireEvent.click(within(surface).getByRole('button', {
      name: /Назначить замену тренера: Утренняя база/,
    }))
    fireEvent.click(await screen.findByRole('button', { name: 'Получить предпросмотр' }))

    await screen.findByTestId('schedule-substitution-preview')
    expect(previewTrainerSubstitution).toHaveBeenCalledWith({
      replacedTrainerId: 'trainer-1',
      substituteTrainerId: null,
      targets: [{
        lessonOccurrenceId: 'occurrence-morning',
        lessonDate: '2026-08-20',
        expectedRevision: 'revision-1',
      }],
    })
  })

  test('opens exact occurrence trainer substitution cancellation with substitution id', async () => {
    window.history.replaceState({}, '', '/schedule?date=2026-08-20')
    getLessons.mockResolvedValue(buildScheduleResponse([
      buildLesson({
        allowedActions: buildAllowedActions({
          cancelTrainerSubstitution: { allowed: true, reason: null },
        }),
        effectiveTrainers: [
          {
            trainerId: 'trainer-1',
            fullName: 'Алиса',
            kind: 'Permanent',
            replacedTrainerId: null,
            substitutionId: null,
          },
          {
            trainerId: 'trainer-2',
            fullName: 'Борис',
            kind: 'Substitute',
            replacedTrainerId: 'trainer-1',
            substitutionId: 'substitution-1',
          },
        ],
      }),
    ]))

    renderSchedule()

    const card = await screen.findByTestId('schedule-card-occurrence-morning')
    const surface = await openMoreActions(card)
    fireEvent.click(within(surface).getByRole('button', {
      name: /Снять замену тренера: Утренняя база/,
    }))
    fireEvent.click(await screen.findByRole('button', { name: 'Получить предпросмотр' }))

    await screen.findByTestId('schedule-substitution-preview')
    expect(previewTrainerSubstitutionCancellation).toHaveBeenCalledWith({
      targets: [{
        lessonOccurrenceId: 'occurrence-morning',
        lessonDate: '2026-08-20',
        expectedRevision: 'revision-1',
        substitutionId: 'substitution-1',
      }],
      reason: null,
    })
  })

  test('cancels occurrence only when backend allows it and routes to returned exact lesson', async () => {
    window.history.replaceState({}, '', '/schedule?date=2026-08-20')
    getLessons.mockResolvedValue(buildScheduleResponse([
      buildLesson({
        allowedActions: buildAllowedActions({
          cancel: { allowed: true, reason: null },
        }),
      }),
    ]))
    const onOpenLessonDetail = vi.fn()

    renderSchedule({ onOpenLessonDetail })

    const card = await screen.findByTestId('schedule-card-occurrence-morning')
    expect(within(card).queryByRole('button', { name: /Отменить занятие/ })).not.toBeInTheDocument()
    const surface = await openMoreActions(card)
    expect(within(surface).getByRole('button', { name: /Отменить занятие/ })).toBeInTheDocument()
    expect(within(surface).queryByRole('button', { name: /Восстановить занятие/ })).not.toBeInTheDocument()
    fireEvent.click(within(surface).getByRole('button', { name: /Отменить занятие/ }))

    const drawer = await screen.findByRole('dialog', { name: 'Отменить занятие' })
    expect(drawer).toHaveTextContent('Утренняя база')
    expect(drawer).toHaveTextContent('08:00-08:50')
    fireEvent.click(within(drawer).getByRole('button', { name: 'Получить предпросмотр' }))

    await waitFor(() =>
      expect(previewLessonCancellation).toHaveBeenCalledWith(
        'occurrence-morning',
        '2026-08-20',
        {
          action: 'Cancel',
          expectedRevision: 'revision-1',
        },
      ),
    )
    expect(await within(drawer).findByText('Проверьте действие перед подтверждением')).toBeVisible()

    fireEvent.click(within(drawer).getByRole('button', { name: 'Отменить занятие' }))

    await waitFor(() =>
      expect(applyLessonCancellation).toHaveBeenCalledWith(
        'occurrence-morning',
        '2026-08-20',
        {
          action: 'Cancel',
          expectedRevision: 'revision-1',
          confirmationToken: 'cancel-preview-token',
        },
      ),
    )
    expect(onOpenLessonDetail).toHaveBeenCalledWith('occurrence-morning', '2026-08-20')
  })

  test('restores cancelled occurrence only from backend restore allowance', async () => {
    window.history.replaceState({}, '', '/schedule?date=2026-08-20')
    getLessons.mockResolvedValue(buildScheduleResponse([
      buildLesson({
        status: 'Cancelled',
        allowedActions: buildAllowedActions({
          cancel: { allowed: false, reason: 'lesson-cancelled' },
          restore: { allowed: true, reason: null },
        }),
      }),
    ]))
    previewLessonCancellation.mockResolvedValue(buildCancellationPreviewResponse('Restore'))
    applyLessonCancellation.mockResolvedValue(buildLesson({
      lessonOccurrenceId: 'occurrence-morning',
      isMaterialized: true,
      status: 'Scheduled',
      revision: 'revision-2',
    }))

    renderSchedule()

    const card = await screen.findByTestId('schedule-card-occurrence-morning')
    expect(within(card).queryByRole('button', { name: /Отменить занятие/ })).not.toBeInTheDocument()
    const surface = await openMoreActions(card)
    fireEvent.click(within(surface).getByRole('button', { name: /Восстановить занятие/ }))
    const drawer = await screen.findByRole('dialog', { name: 'Восстановить занятие' })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Получить предпросмотр' }))

    await waitFor(() =>
      expect(previewLessonCancellation).toHaveBeenCalledWith(
        'occurrence-morning',
        '2026-08-20',
        {
          action: 'Restore',
          expectedRevision: 'revision-1',
        },
      ),
    )
  })

  test('cancellation attendance conflict preserves context and hides raw backend code', async () => {
    window.history.replaceState({}, '', '/schedule?date=2026-08-20')
    getLessons.mockResolvedValue(buildScheduleResponse([
      buildLesson({
        hasAttendanceMarks: true,
        allowedActions: buildAllowedActions({
          cancel: { allowed: true, reason: null },
        }),
      }),
    ]))
    applyLessonCancellation.mockRejectedValue(new ApiError(
      'Cannot cancel occurrence with attendance marks.',
      409,
      {},
      'lesson-attendance-state-conflict',
    ))

    renderSchedule()

    const card = await screen.findByTestId('schedule-card-occurrence-morning')
    const cancelSurface = await openMoreActions(card)
    fireEvent.click(within(cancelSurface).getByRole('button', { name: /Отменить занятие/ }))
    const drawer = await screen.findByRole('dialog', { name: 'Отменить занятие' })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Получить предпросмотр' }))
    await within(drawer).findByText('Проверьте действие перед подтверждением')

    fireEvent.click(within(drawer).getByRole('button', { name: 'Отменить занятие' }))

    expect(await within(drawer).findByText('У занятия уже есть отметки посещаемости.')).toBeVisible()
    expect(within(drawer).getByText('Отметки есть')).toBeVisible()
    expect(within(drawer).getByText('Утренняя база')).toBeVisible()
    expect(within(drawer).queryByText('lesson-attendance-state-conflict')).not.toBeInTheDocument()
    expect(within(drawer).queryByText('Cannot cancel occurrence with attendance marks.')).not.toBeInTheDocument()
    expect(within(drawer).getByRole('button', { name: 'Обновить предпросмотр' })).toBeVisible()
  })

  test('stale cancellation preview recovery preserves exact context without raw backend text', async () => {
    window.history.replaceState({}, '', '/schedule?date=2026-08-20')
    getLessons.mockResolvedValue(buildScheduleResponse([
      buildLesson({
        allowedActions: buildAllowedActions({
          cancel: { allowed: true, reason: null },
        }),
      }),
    ]))
    previewLessonCancellation.mockRejectedValue(new ApiError(
      'Schedule confirmation token is not valid for this mutation.',
      409,
      {},
      'lesson-mutation-preview-stale',
    ))

    renderSchedule()

    const card = await screen.findByTestId('schedule-card-occurrence-morning')
    const cancelSurface = await openMoreActions(card)
    fireEvent.click(within(cancelSurface).getByRole('button', { name: /Отменить занятие/ }))
    const drawer = await screen.findByRole('dialog', { name: 'Отменить занятие' })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Получить предпросмотр' }))

    expect(await within(drawer).findByText('Параметры изменились после предпросмотра. Получите новый предпросмотр.')).toBeVisible()
    expect(within(drawer).getByText('Утренняя база')).toBeVisible()
    expect(within(drawer).queryByText('lesson-mutation-preview-stale')).not.toBeInTheDocument()
    expect(within(drawer).queryByText('Schedule confirmation token is not valid for this mutation.')).not.toBeInTheDocument()
    expect(within(drawer).getByRole('button', { name: 'Обновить предпросмотр' })).toBeVisible()
  })

  test('create toolbar action routes to canonical creation screen when capability allows it', async () => {
    window.history.replaceState({}, '', '/schedule?date=2026-08-20')
    const onCreateLesson = vi.fn()

    renderSchedule({ onCreateLesson })

    await screen.findByTestId('schedule-card-occurrence-morning')
    fireEvent.click(screen.getByRole('button', { name: 'Создать разовое занятие' }))

    expect(onCreateLesson).toHaveBeenCalled()
  })

  test('create route creates one-off through preview confirmation', async () => {
    const onCreated = vi.fn()

    renderLessonCreateRoute({ onCreated })

    const screenRoot = await screen.findByTestId('schedule-lesson-create-screen')
    expect(within(screenRoot).getByLabelText('Группа')).toHaveValue('Утренняя база')
    expect(within(screenRoot).getByLabelText('Зал')).toHaveValue('Основной зал')

    fireEvent.change(within(screenRoot).getByLabelText('Дата'), {
      target: { value: '2026-08-20' },
    })
    fireEvent.change(within(screenRoot).getByLabelText('Время'), {
      target: { value: '12:30' },
    })
    fireEvent.click(within(screenRoot).getByRole('button', { name: 'Получить предпросмотр' }))

    await waitFor(() =>
      expect(previewOneOff).toHaveBeenCalledWith({
        groupId: 'group-1',
        lessonDate: '2026-08-20',
        startTime: '12:30',
        durationMinutes: 60,
        hallId: 'hall-1',
      }),
    )
    expect(await within(screenRoot).findByText('Проверьте нагрузку зала.')).toBeVisible()

    fireEvent.click(within(screenRoot).getByRole('button', { name: 'Создать занятие' }))

    await waitFor(() =>
      expect(createOneOff).toHaveBeenCalledWith({
        groupId: 'group-1',
        lessonDate: '2026-08-20',
        startTime: '12:30',
        durationMinutes: 60,
        hallId: 'hall-1',
        confirmationToken: 'preview-token',
      }),
    )
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({
      lessonOccurrenceId: 'created-one-off',
      lessonDate: '2026-08-20',
    }))
  })

  test('hides create when backend capability denies it without rendering raw reason code', async () => {
    window.history.replaceState({}, '', '/schedule?date=2026-08-20')
    getLessons.mockResolvedValue(buildScheduleResponse([
      buildLesson(),
    ], { allowed: false, reason: 'role-not-allowed' }))

    renderSchedule()

    await screen.findByTestId('schedule-card-occurrence-morning')
    expect(screen.queryByRole('button', { name: 'Создать разовое занятие' })).not.toBeInTheDocument()
    expect(screen.queryByText('role-not-allowed')).not.toBeInTheDocument()
  })

  test('stale one-off confirmation preserves draft and asks for a fresh preview without raw code', async () => {
    createOneOff.mockRejectedValue(new ApiError(
      'Schedule confirmation token is not valid for this mutation.',
      409,
      {},
      'lesson-mutation-preview-stale',
    ))

    renderLessonCreateRoute()

    const screenRoot = await screen.findByTestId('schedule-lesson-create-screen')
    fireEvent.change(within(screenRoot).getByLabelText('Дата'), {
      target: { value: '2026-08-20' },
    })
    fireEvent.change(within(screenRoot).getByLabelText('Время'), {
      target: { value: '12:30' },
    })
    fireEvent.click(within(screenRoot).getByRole('button', { name: 'Получить предпросмотр' }))
    await within(screenRoot).findByText('Проверьте занятие перед созданием')

    fireEvent.click(within(screenRoot).getByRole('button', { name: 'Создать занятие' }))

    expect(await within(screenRoot).findByText('Параметры изменились после предпросмотра. Получите новый предпросмотр.')).toBeVisible()
    expect(within(screenRoot).queryByText('lesson-mutation-preview-stale')).not.toBeInTheDocument()
    expect(within(screenRoot).getByLabelText('Время')).toHaveValue('12:30')
    expect(within(screenRoot).getByRole('button', { name: 'Обновить предпросмотр' })).toBeVisible()
  })

  test('unknown one-off preview problem uses localized fallback without raw backend text', async () => {
    previewOneOff.mockRejectedValue(new ApiError(
      'Schedule confirmation token is not valid for this mutation.',
      409,
      {},
      'backend-technical-code',
    ))

    renderLessonCreateRoute()

    const screenRoot = await screen.findByTestId('schedule-lesson-create-screen')
    fireEvent.change(within(screenRoot).getByLabelText('Дата'), {
      target: { value: '2026-08-20' },
    })
    fireEvent.click(within(screenRoot).getByRole('button', { name: 'Получить предпросмотр' }))

    expect(await within(screenRoot).findByText('Не удалось проверить разовое занятие. Проверьте поля и попробуйте снова.')).toBeVisible()
    expect(within(screenRoot).queryByText('Schedule confirmation token is not valid for this mutation.')).not.toBeInTheDocument()
    expect(within(screenRoot).queryByText('backend-technical-code')).not.toBeInTheDocument()
  })

  test('groups same-interval occurrences under one chronological time-group heading', async () => {
    window.history.replaceState({}, '', '/schedule?date=2026-08-20')
    getLessons.mockResolvedValue(buildScheduleResponse([
      buildLesson({
        lessonOccurrenceId: 'parallel-a',
        startTime: '10:00',
        endTime: '10:50',
        groupName: 'Параллель А',
      }),
      buildLesson({
        lessonOccurrenceId: 'parallel-b',
        startTime: '10:00',
        endTime: '10:50',
        groupName: 'Параллель Б',
        hasAttendanceMarks: true,
      }),
      buildLesson({
        lessonOccurrenceId: 'other-end',
        startTime: '10:00',
        endTime: '11:00',
        groupName: 'Другая длительность',
      }),
      buildLesson({
        lessonOccurrenceId: 'later',
        startTime: '12:00',
        endTime: '12:50',
        groupName: 'Позже',
      }),
    ]))

    renderSchedule()

    await screen.findByTestId('schedule-card-parallel-a')

    const sameIntervalGroup = screen.getByTestId('schedule-time-group-2026-08-20-10:00-10:50')
    expect(within(sameIntervalGroup).getByTestId('schedule-card-parallel-a')).toBeInTheDocument()
    expect(within(sameIntervalGroup).getByTestId('schedule-card-parallel-b')).toBeInTheDocument()
    expect(within(sameIntervalGroup).queryByTestId('schedule-card-other-end')).not.toBeInTheDocument()

    const orderedGroupTestIds = screen
      .getAllByTestId(/^schedule-time-group-/)
      .map((element) => element.getAttribute('data-testid'))
    expect(orderedGroupTestIds).toEqual([
      'schedule-time-group-2026-08-20-10:00-10:50',
      'schedule-time-group-2026-08-20-10:00-11:00',
      'schedule-time-group-2026-08-20-12:00-12:50',
    ])

    // Neutral attendance badge is exhaustive.
    expect(screen.getByTestId('schedule-card-parallel-a')).toHaveTextContent('Без отметок')
    expect(screen.getByTestId('schedule-card-parallel-b')).toHaveTextContent('Отметки есть')
    expect(screen.getByTestId('schedule-card-later')).toHaveTextContent('Без отметок')

    const mobileRow = screen.getByTestId('schedule-card-parallel-a')
    expect(mobileRow).toHaveAttribute('data-mobile-density', 'compact-row')
    expect(within(mobileRow).getByTestId('schedule-location')).toHaveTextContent('Основной зал · Центр')
    expect(within(mobileRow).getByTestId('schedule-trainers')).toHaveTextContent('Алиса')
    expect(within(mobileRow).queryByText('Кардио')).not.toBeInTheDocument()
    expect(within(mobileRow).queryByText('Регулярное')).not.toBeInTheDocument()
    expect(within(mobileRow).getByTestId('schedule-detail-affordance')).toHaveAttribute(
      'data-direction',
      'forward',
    )
  })

  test('more-actions surface shares one ordered capability-derived action model across drawer and menu', async () => {
    window.history.replaceState({}, '', '/schedule?date=2026-08-20')
    getLessons.mockResolvedValue(buildScheduleResponse([
      buildLesson({
        allowedActions: buildAllowedActions({
          edit: { allowed: true, reason: null },
          move: { allowed: true, reason: null },
          assignTrainerSubstitution: { allowed: true, reason: null },
          cancel: { allowed: true, reason: null },
        }),
      }),
    ]))

    renderSchedule()

    const card = await screen.findByTestId('schedule-card-occurrence-morning')
    // Mobile keeps only attendance and `Ещё` next to the body trigger.
    expect(within(card).getByRole('button', { name: 'Посещение' })).toBeVisible()
    expect(within(card).queryByRole('button', { name: /Изменить занятие/ })).not.toBeInTheDocument()
    expect(within(card).getByRole('button', { name: /Ещё действий/ })).toBeVisible()
    expect(within(card).queryByRole('button', { name: /Перенести занятие/ })).not.toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: /Отменить занятие/ })).not.toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: /Снять замену тренера/ })).not.toBeInTheDocument()

    const drawerSurface = await openMoreActions(card)
    expect(within(drawerSurface)
      .getAllByRole('button')
      .map((button) => button.textContent?.trim())
      .filter(Boolean)).toEqual([
      'Изменить',
      'Перенести',
      'Серия',
      'Замена',
      'Отменить',
    ])
    expect(within(drawerSurface).getByText('Утренняя база')).toBeInTheDocument()
    expect(within(drawerSurface).getByText('08:00-08:50')).toBeInTheDocument()

    // Desktop fine-pointer surface (Mantine Menu) consumes the same model.
    const matchMediaSpy = vi
      .spyOn(window, 'matchMedia')
      .mockImplementation((query: string) => makeMediaQueryResult(query, query.includes('pointer: fine')))
    try {
      cleanup()
      renderSchedule()
      const desktopCard = await screen.findByTestId('schedule-card-occurrence-morning')
      expect(within(desktopCard).getByRole('button', { name: /Изменить занятие/ })).toBeVisible()
      const desktopTrigger = within(desktopCard).getByRole('button', { name: /Ещё действий/ })
      fireEvent.click(desktopTrigger)
      await waitFor(() => expect(desktopTrigger).toHaveAttribute('aria-expanded', 'true'))
      const menu = await waitFor(() => {
        const dropdown = document.querySelector('[data-menu-dropdown]')
        expect(dropdown).not.toBeNull()
        return dropdown as HTMLElement
      })
      expect(within(menu).getAllByRole('menuitem', { hidden: true }).map((item) => item.textContent)).toEqual([
        'Перенести',
        'Серия',
        'Замена',
        'Отменить',
      ])
      fireEvent.keyDown(menu, { key: 'Escape' })
      await waitFor(() => expect(desktopTrigger).toHaveAttribute('aria-expanded', 'false'))
      await waitFor(() => expect(desktopTrigger).toHaveFocus())
    } finally {
      matchMediaSpy.mockRestore()
    }
  })

  test('Ещё is absent without deferred actions and Escape returns focus to its trigger', async () => {
    window.history.replaceState({}, '', '/schedule?date=2026-08-20')
    getLessons.mockResolvedValue(buildScheduleResponse([
      buildLesson({
        lessonSeriesId: null,
        allowedActions: buildAllowedActions({
          edit: { allowed: true, reason: null },
        }),
      }),
      buildLesson({
        lessonOccurrenceId: 'occurrence-minimal',
        lessonSeriesId: null,
      }),
    ]))

    renderSchedule()

    const fullCard = await screen.findByTestId('schedule-card-occurrence-morning')
    expect(within(fullCard).queryByRole('button', { name: /Изменить занятие/ })).not.toBeInTheDocument()
    expect(within(fullCard).getByRole('button', { name: /Ещё действий/ })).toBeVisible()

    const minimalCard = screen.getByTestId('schedule-card-occurrence-minimal')
    expect(within(minimalCard).queryByRole('button', { name: /Изменить занятие/ })).not.toBeInTheDocument()
    expect(within(minimalCard).queryByRole('button', { name: /Ещё действий/ })).not.toBeInTheDocument()

    getLessons.mockResolvedValue(buildScheduleResponse([
      buildLesson({
        lessonSeriesId: null,
        allowedActions: buildAllowedActions({
          move: { allowed: true, reason: null },
        }),
      }),
    ]))
    // Re-render a card with deferred actions for the keyboard path.
    cleanup()
    renderSchedule()
    const card = await screen.findByTestId('schedule-card-occurrence-morning')
    const moreTrigger = within(card).getByRole('button', { name: /Ещё действий/ })
    moreTrigger.focus()
    fireEvent.click(moreTrigger)
    const surface = await screen.findByRole('dialog', { name: /Ещё действий/ })
    fireEvent.keyDown(within(surface).getByRole('button', { name: /Перенести занятие/ }), { key: 'Escape' })

    await waitFor(() => expect(moreTrigger).toHaveFocus())
  })

  test('mobile date toolbar keeps previous, full date, next and create only; tools live in the day-summary row', async () => {
    window.history.replaceState({}, '', '/schedule?date=2026-08-20&trainerId=trainer-1')
    renderSchedule()

    await screen.findByTestId('schedule-card-occurrence-morning')

    const toolbar = screen.getByTestId('schedule-toolbar')
    expect(toolbar).toHaveAttribute('data-tools-placement', 'day-summary')
    expect(within(toolbar).getByRole('button', { name: 'Предыдущий день' })).toBeInTheDocument()
    expect(within(toolbar).getByLabelText('Дата расписания')).toHaveValue('2026-08-20')
    expect(within(toolbar).getByRole('button', { name: 'Следующий день' })).toBeInTheDocument()
    expect(within(toolbar).getByRole('button', { name: 'Создать разовое занятие' })).toBeInTheDocument()
    expect(within(toolbar).queryByRole('button', { name: 'Параметры календаря' })).not.toBeInTheDocument()

    const daySummary = screen.getByTestId('schedule-day-summary')
    expect(daySummary).toHaveTextContent('четверг')
    expect(daySummary).toHaveTextContent('2 занятия')
    const toolsTrigger = within(daySummary).getByRole('button', { name: /Параметры календаря, активных фильтров: 1/ })
    expect(toolsTrigger).toHaveAttribute('data-target-size', '44')
  })

  test('loading renders card-shaped skeletons while toolbar stays available', async () => {
    window.history.replaceState({}, '', '/schedule?date=2026-08-20')
    getLessons.mockReturnValue(new Promise(() => undefined))

    renderSchedule()

    const skeletons = await screen.findAllByTestId('schedule-card-skeleton')
    expect(skeletons.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByTestId('schedule-toolbar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Предыдущий день' })).toBeDisabled()
    expect(screen.queryByTestId('schedule-card-occurrence-morning')).not.toBeInTheDocument()
  })

  test('error with retained data marks real stale cards instead of skeletons', async () => {
    window.history.replaceState({}, '', '/schedule?date=2026-08-20')
    getLessons.mockResolvedValueOnce(buildScheduleResponse([
      buildLesson(),
    ]))
    renderSchedule()
    await screen.findByTestId('schedule-card-occurrence-morning')

    getLessons.mockRejectedValue(new Error('network down'))
    fireEvent.click(screen.getByRole('button', { name: /Параметры календаря/ }))
    const toolsDrawer = await screen.findByRole('dialog', { name: 'Параметры календаря' })
    await waitFor(() => expect(within(toolsDrawer).getByRole('button', { name: 'Обновить' })).toBeEnabled())
    fireEvent.click(within(toolsDrawer).getByRole('button', { name: 'Обновить' }))

    expect(await screen.findByText('Не удалось обновить расписание')).toBeVisible()
    expect(screen.getByTestId('schedule-stale-banner')).toHaveTextContent('Данные могут быть устаревшими')
    expect(screen.getByTestId('schedule-card-occurrence-morning')).toBeInTheDocument()
    expect(screen.queryByTestId('schedule-card-skeleton')).not.toBeInTheDocument()
  })

  test('cancelled card uses the shared body detail trigger without a duplicate Подробнее', async () => {
    window.history.replaceState({}, '', '/schedule?date=2026-08-20')
    getLessons.mockResolvedValue(buildScheduleResponse([
      buildLesson({ status: 'Cancelled' }),
    ]))
    const onOpenLessonDetail = vi.fn()

    renderSchedule({ onOpenLessonDetail })

    const card = await screen.findByTestId('schedule-card-occurrence-morning')
    expect(within(card).getByRole('button', { name: /Открыть занятие/ })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Подробнее' })).not.toBeInTheDocument()
    fireEvent.click(within(card).getByRole('button', { name: /Открыть занятие/ }))
    expect(onOpenLessonDetail).toHaveBeenCalledWith('occurrence-morning', '2026-08-20')
  })

  test('restores captured schedule origin anchor and scroll from a return snapshot', async () => {
    window.history.replaceState({}, '', '/schedule?date=2026-08-20')
    renderSchedule()
    await screen.findByTestId('schedule-card-occurrence-morning')
    cleanup()

    window.history.replaceState({}, '', '/schedule?date=2026-08-20&view=day')
    window.history.replaceState(
      {
        crmScheduleReturnState: {
          version: 1,
          path: '/schedule?date=2026-08-20&view=day',
          timeGroupAnchorId: 'schedule-time-group-2026-08-20-18:00-18:50',
          cardAnchorId: 'schedule-card-anchor-occurrence-evening',
          scrollY: 320,
          focusTarget: 'card',
          originEntryKey: 'schedule:test-entry',
          returnDepth: 1,
        },
      },
      '',
      '/schedule?date=2026-08-20&view=day',
    )

    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    const focusSpy = vi.fn()
    HTMLElement.prototype.focus = focusSpy

    renderSchedule()
    await screen.findByTestId('schedule-card-occurrence-evening')

    await waitFor(() =>
      expect(scrollSpy).toHaveBeenCalledWith(expect.objectContaining({ top: 320 })),
    )
    await waitFor(() =>
      expect(focusSpy).toHaveBeenCalled(),
    )

    scrollSpy.mockRestore()
  })
})

async function openMoreActions(card: HTMLElement) {
  fireEvent.click(within(card).getByRole('button', { name: /Ещё действий/ }))
  return await screen.findByRole('dialog', { name: /Ещё действий/ })
}

function makeMediaQueryResult(query: string, matches: boolean) {
  return {
    matches,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }
}

function renderSchedule({
  onCreateLesson = vi.fn(),
  onEditLesson = vi.fn(),
  onEditSeries = vi.fn(),
  onMoveLesson = vi.fn(),
  onOpenAttendance = vi.fn(),
  onOpenLessonDetail = vi.fn(),
}: {
  onCreateLesson?: () => void
  onEditLesson?: (lessonOccurrenceId: string, lessonDate: string) => void
  onEditSeries?: (lesson: ScheduleLesson, scope: 'this-and-future' | 'entire') => void
  onMoveLesson?: (lessonOccurrenceId: string, lessonDate: string) => void
  onOpenAttendance?: (lessonOccurrenceId: string, lessonDate: string) => void
  onOpenLessonDetail?: (lessonOccurrenceId: string, lessonDate: string) => void
} = {}) {
  return renderWithProviders(
    <GroupScheduleScreen
      canManageGroups
      onCreateLesson={onCreateLesson}
      onEditLesson={onEditLesson}
      onEditSeries={onEditSeries}
      onEditGroup={vi.fn()}
      onMoveLesson={onMoveLesson}
      onOpenAttendance={onOpenAttendance}
      onOpenLessonDetail={onOpenLessonDetail}
      viewerRole="HeadCoach"
    />,
  )
}

function renderLessonCreateRoute({
  onBack = vi.fn(),
  onCreated = vi.fn(),
}: {
  onBack?: () => void
  onCreated?: (lesson: ScheduleLesson) => void
} = {}) {
  return renderWithProviders(
    <ScheduleLessonCreateScreen
      onBack={onBack}
      onCreated={onCreated}
    />,
  )
}

function renderLessonChangeRoute({
  mode = 'edit',
  onBack = vi.fn(),
  onChanged = vi.fn(),
}: {
  mode?: 'edit' | 'move'
  onBack?: () => void
  onChanged?: (lesson: ScheduleLesson) => void
} = {}) {
  return renderWithProviders(
    <ScheduleLessonChangeRouteScreen
      lessonDate="2026-08-20"
      lessonOccurrenceId="occurrence-morning"
      mode={mode}
      onBack={onBack}
      onChanged={onChanged}
    />,
  )
}

function buildScheduleResponse(
  items: ScheduleLesson[],
  createOneOff = { allowed: true, reason: null } as { allowed: boolean; reason: string | null },
) {
  return {
    from: '2026-08-20',
    to: '2026-08-20',
    items,
    capabilities: {
      createOneOff,
    },
    filterOptions: {
      branches: [{ id: 'branch-1', name: 'Центр' }],
      halls: [{ id: 'hall-1', name: 'Основной зал' }],
      trainers: [
        { id: 'trainer-1', name: 'Алиса' },
        { id: 'trainer-2', name: 'Борис' },
      ],
      groups: [{ id: 'group-1', name: 'Утренняя база' }],
      groupTypes: [{ id: 'type-1', name: 'Кардио' }],
    },
  }
}

function buildPreviewResponse() {
  return {
    confirmationToken: 'preview-token',
    expiresAt: '2026-08-20T09:15:00Z',
    lesson: buildLesson({
      lessonOccurrenceId: 'preview-one-off',
      sourceKind: 'OneOff',
      isMaterialized: false,
      lessonDate: '2026-08-20',
      startTime: '12:30',
      endTime: '13:30',
    }),
    warnings: [{ code: 'hall-load', message: 'Проверьте нагрузку зала.' }],
  }
}

function buildChangePreviewResponse(
  impact: {
    scope: 'Occurrence' | 'ThisAndFuture' | 'EntireSeries'
    startsOn: string
    affectsFutureProjection: boolean
    skipped: Array<{
      lessonOccurrenceId: string
      lessonDate: string
      reason: string
    }>
  } = {
    scope: 'Occurrence',
    startsOn: '2026-08-21',
    affectsFutureProjection: false,
    skipped: [],
  },
) {
  return {
    confirmationToken: 'change-preview-token',
    expiresAt: '2026-08-20T09:15:00Z',
    lesson: buildLesson({
      lessonOccurrenceId: 'occurrence-morning',
      isMaterialized: false,
      lessonDate: '2026-08-21',
      startTime: '11:15',
      durationMinutes: 50,
      endTime: '12:05',
      revision: 'preview-change',
    }),
    warnings: [{ code: 'lesson_hall_overlap', message: 'Проверьте пересечение зала.' }],
    impact,
  }
}

function buildCancellationPreviewResponse(action: 'Cancel' | 'Restore') {
  return {
    confirmationToken: action === 'Cancel' ? 'cancel-preview-token' : 'restore-preview-token',
    expiresAt: '2026-08-20T09:15:00Z',
    action,
    lesson: buildLesson({
      lessonOccurrenceId: 'occurrence-morning',
      isMaterialized: false,
      status: action === 'Cancel' ? 'Cancelled' : 'Scheduled',
      revision: 'preview-cancellation',
    }),
  }
}

function buildSeriesResponse() {
  return {
    seriesId: 'series-1',
    groupId: 'group-1',
    groupName: 'Утренняя база',
    businessDate: '2026-08-20',
    startsOn: '2026-08-01',
    endsOn: null,
    revision: 'series-revision-1',
    currentVersion: {
      versionNumber: 1,
      effectiveFrom: '2026-08-01',
      effectiveTo: null,
      thisAndFutureMinEffectiveFrom: '2026-08-20',
      entireSeriesEffectiveFrom: '2026-08-01',
      slots: [{
        isoWeekday: 1,
        startTime: '08:00',
        durationMinutes: 50,
        hallId: 'hall-1',
        hallName: 'Основной зал',
      }],
    },
  }
}

function buildSeriesPreviewResponse() {
  return {
    confirmationToken: 'series-token',
    expiresAt: '2026-08-20T09:15:00Z',
    revision: 'series-revision-1',
    scope: 'ThisAndFuture' as const,
    effectiveFrom: '2026-08-20',
    endsOn: null,
    slots: [{
      isoWeekday: 1,
      startTime: '09:00',
      durationMinutes: 50,
      hallId: 'hall-1',
      hallName: 'Основной зал',
    }],
    impact: {
      totalAffectedOccurrences: 3,
      examples: [{
        lessonOccurrenceId: 'occurrence-morning',
        lessonDate: '2026-08-20',
        startTime: '09:00',
        hallId: 'hall-1',
        hallName: 'Основной зал',
      }],
      skipped: [],
    },
    warnings: [],
  }
}

function buildTrainerSubstitutionPreviewResponse() {
  return {
    confirmationToken: 'substitution-token',
    expiresAt: '2026-08-20T09:15:00Z',
    targets: [{
      lessonOccurrenceId: 'occurrence-morning',
      lessonDate: '2026-08-20',
      groupId: 'group-1',
      groupName: 'Утренняя база',
      substitutionId: 'substitution-1',
      warnings: [],
    }],
    warnings: [],
  }
}

function buildLesson(overrides: Partial<ScheduleLesson> = {}): ScheduleLesson {
  return {
    lessonOccurrenceId: 'occurrence-morning',
    sourceKind: 'Recurring',
    isMaterialized: false,
    lessonSeriesId: 'series-1',
    lessonDate: '2026-08-20',
    startTime: '08:00',
    durationMinutes: 50,
    endTime: '08:50',
    groupId: 'group-1',
    groupName: 'Утренняя база',
    groupTypeId: 'type-1',
    groupTypeName: 'Кардио',
    branchId: 'branch-1',
    branchName: 'Центр',
    hallId: 'hall-1',
    hallName: 'Основной зал',
    effectiveTrainers: [{
      trainerId: 'trainer-1',
      fullName: 'Алиса',
      kind: 'Permanent',
      replacedTrainerId: null,
      substitutionId: null,
    }],
    status: 'Scheduled',
    hasAttendanceMarks: false,
    revision: 'revision-1',
    ...overrides,
    allowedActions: overrides.allowedActions ?? buildAllowedActions(),
  }
}

function buildAllowedActions(overrides: Partial<ScheduleLesson['allowedActions']> = {}) {
  return {
    viewAttendance: overrides.viewAttendance ?? { allowed: true, reason: null },
    editAttendance: overrides.editAttendance ?? { allowed: true, reason: null },
    edit: overrides.edit ?? { allowed: false, reason: 'not-implemented' },
    move: overrides.move ?? { allowed: false, reason: 'not-implemented' },
    cancel: overrides.cancel ?? { allowed: false, reason: 'not-implemented' },
    restore: overrides.restore ?? { allowed: false, reason: 'not-cancelled' },
    assignTrainerSubstitution: overrides.assignTrainerSubstitution ?? { allowed: false, reason: 'not-implemented' },
    cancelTrainerSubstitution: overrides.cancelTrainerSubstitution ?? { allowed: false, reason: 'no-substitution' },
  }
}

describe('scheduleReturnState', () => {
  test('captures and reads back a schedule origin snapshot', () => {
    window.history.replaceState({}, '', '/schedule?date=2026-08-20&view=week&groupId=group-1')
    window.scrollTo(0, 0)
    Object.defineProperty(window, 'scrollY', { value: 220, configurable: true })

    const snapshot = createScheduleReturnSnapshot('occurrence-morning')

    expect(snapshot).toMatchObject({
      version: 1,
      path: '/schedule?date=2026-08-20&view=week&groupId=group-1',
      timeGroupAnchorId: null,
      cardAnchorId: 'schedule-card-anchor-occurrence-morning',
      scrollY: 220,
      focusTarget: 'card',
    })
    expect(snapshot.originEntryKey).toBeTruthy()

    window.history.replaceState(
      mergeScheduleReturnSnapshotIntoHistoryState(window.history.state, snapshot),
      '',
      '/schedule?date=2026-08-20&view=week&groupId=group-1',
    )
    expect(readScheduleReturnSnapshot(window.history.state)).toEqual(snapshot)
  })

  test('rejects stale or malformed schedule origins', () => {
    expect(readScheduleReturnSnapshot(null)).toBeNull()
    expect(readScheduleReturnSnapshot({})).toBeNull()
    expect(readScheduleReturnSnapshot({
      crmScheduleReturnState: { version: 2, path: '/schedule' },
    })).toBeNull()
    expect(readScheduleReturnSnapshot({
      crmScheduleReturnState: { version: 1 },
    })).toBeNull()
    expect(readScheduleReturnSnapshot({
      crmScheduleReturnState: {
        version: 1,
        path: '/clients',
        cardAnchorId: 'schedule-card-anchor-occurrence-morning',
        scrollY: 10,
        focusTarget: 'card',
        originEntryKey: 'k',
      },
    })).toBeNull()
  })

  test('strip removes only the schedule snapshot from history state', () => {
    expect(stripScheduleReturnSnapshotFromHistoryState({
      crmScheduleReturnState: { version: 1 },
      retained: 'keep',
    })).toEqual({ retained: 'keep' })
  })
})
