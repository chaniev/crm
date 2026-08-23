import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { renderWithProviders } from '../../test/render'
import { GroupScheduleScreen } from './GroupScheduleScreen'

const apiMocks = vi.hoisted(() => ({
  getScheduleGroups: vi.fn(),
}))

vi.mock('../../lib/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../lib/api')>(),
  getScheduleGroups: apiMocks.getScheduleGroups,
}))

import { getScheduleGroups } from '../../lib/api'

type ScheduleGroupState = {
  id: string
  name: string
  branchId: string
  branchName: string
  hallId: string
  hallName: string
  groupTypeId: string
  groupTypeName: string
  trainingStartTime: string
  durationMinutes: number
  weekdays: number[]
  isActive: boolean
  trainerIds: string[]
  trainerNames: string[]
  trainerCount: number
  clientCount: number
}

function createScheduleItem(group: ScheduleGroupState) {
  return {
    ...group,
    trainers: group.trainerIds.map((trainerId) => ({
      id: trainerId,
      fullName: group.trainerNames[0] ?? trainerId,
      login: trainerId,
    })),
  }
}

function setupDesktopMediaQuery(enabled: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
    const isTargeted = query.includes('max-width: 47.99em') ||
      query.includes('max-height: 30rem') ||
      query.includes('pointer: coarse')

    return {
      addEventListener: () => undefined,
      addListener: () => undefined,
      dispatchEvent: () => false,
      media: query,
      matches: enabled && isTargeted ? true : false,
      onchange: null,
      removeEventListener: () => undefined,
      removeListener: () => undefined,
    }
  })
}

const visibleScheduleGroups = [
  createScheduleItem({
    id: 'group-core-1',
    name: 'Утренняя база',
    branchId: 'branch-1',
    branchName: 'Центр',
    hallId: 'hall-1',
    hallName: 'Основной зал',
    groupTypeId: 'type-cardio',
    groupTypeName: 'Кардио',
    trainingStartTime: '08:00',
    durationMinutes: 50,
    weekdays: [1, 3],
    isActive: true,
    trainerIds: ['trainer-1'],
    trainerNames: ['Алиса'],
    trainerCount: 1,
    clientCount: 12,
  }),
  createScheduleItem({
    id: 'group-core-2',
    name: 'Дневная интенсив',
    branchId: 'branch-1',
    branchName: 'Центр',
    hallId: 'hall-1',
    hallName: 'Основной зал',
    groupTypeId: 'type-intense',
    groupTypeName: 'Интенсив',
    trainingStartTime: '14:00',
    durationMinutes: 55,
    weekdays: [2, 4],
    isActive: true,
    trainerIds: ['trainer-2'],
    trainerNames: ['Борис'],
    trainerCount: 1,
    clientCount: 8,
  }),
  createScheduleItem({
    id: 'group-core-3',
    name: 'Вечерняя',
    branchId: 'branch-2',
    branchName: 'Север',
    hallId: 'hall-2',
    hallName: 'Зал Север',
    groupTypeId: 'type-cardio',
    groupTypeName: 'Кардио',
    trainingStartTime: '18:30',
    durationMinutes: 40,
    weekdays: [2],
    isActive: false,
    trainerIds: ['trainer-3'],
    trainerNames: ['Света'],
    trainerCount: 1,
    clientCount: 6,
  }),
]

const tuesdayOnlyScheduleGroups = [
  createScheduleItem({
    id: 'group-tuesday-only',
    name: 'Только вторник',
    branchId: 'branch-1',
    branchName: 'Центр',
    hallId: 'hall-1',
    hallName: 'Основной зал',
    groupTypeId: 'type-cardio',
    groupTypeName: 'Кардио',
    trainingStartTime: '17:00',
    durationMinutes: 50,
    weekdays: [2],
    isActive: true,
    trainerIds: ['trainer-1'],
    trainerNames: ['Алиса'],
    trainerCount: 1,
    clientCount: 10,
  }),
]

const denseScheduleGroups = [
  ...Array.from({ length: 6 }, (_, index) => createScheduleItem({
    id: `dense-${index + 1}`,
    name: [
      'База длинное название',
      'Интенсивный поток',
      'Кардио утром',
      'Силовой блок',
      'Функциональная подготовка',
      'Восстановление',
    ][index] ?? `Группа ${index + 1}`,
    branchId: 'branch-1',
    branchName: 'Центр',
    hallId: index === 4 ? 'hall-2' : 'hall-1',
    hallName: index === 4 ? 'Зал Север' : 'Основной зал',
    groupTypeId: index % 2 === 0 ? 'type-cardio' : 'type-intense',
    groupTypeName: index % 2 === 0 ? 'Кардио' : 'Интенсив',
    trainingStartTime: '08:00',
    durationMinutes: 45,
    weekdays: [1],
    isActive: index !== 5,
    trainerIds: index === 2 ? [] : [`trainer-${index + 1}`],
    trainerNames: index === 2 ? [] : [`Тренер ${index + 1}`],
    trainerCount: index === 2 ? 0 : 1,
    clientCount: 8 + index,
  })),
]

const roomyTwoLaneScheduleGroups = [
  createScheduleItem({
    id: 'roomy-first',
    name: 'Просторная первая',
    branchId: 'branch-1',
    branchName: 'Центр',
    hallId: 'hall-1',
    hallName: 'Основной зал',
    groupTypeId: 'type-cardio',
    groupTypeName: 'Кардио',
    trainingStartTime: '10:00',
    durationMinutes: 90,
    weekdays: [1],
    isActive: true,
    trainerIds: ['trainer-1'],
    trainerNames: ['Алиса Полное Имя'],
    trainerCount: 1,
    clientCount: 10,
  }),
  createScheduleItem({
    id: 'roomy-second',
    name: 'Просторная вторая',
    branchId: 'branch-1',
    branchName: 'Центр',
    hallId: 'hall-2',
    hallName: 'Зал Север',
    groupTypeId: 'type-intense',
    groupTypeName: 'Интенсив',
    trainingStartTime: '10:20',
    durationMinutes: 90,
    weekdays: [1],
    isActive: true,
    trainerIds: ['trainer-2'],
    trainerNames: ['Борис Полное Имя'],
    trainerCount: 1,
    clientCount: 8,
  }),
]

function renderScheduleScreen({
  canManageGroups = false,
  viewerRole = 'HeadCoach',
}: Partial<ComponentProps<typeof GroupScheduleScreen>> = {}) {
  return renderWithProviders(
    <GroupScheduleScreen
      canManageGroups={canManageGroups}
      onEditGroup={vi.fn()}
      viewerRole={viewerRole}
    />,
  )
}

describe('GroupScheduleScreen', () => {
  beforeEach(() => {
    apiMocks.getScheduleGroups.mockReset().mockResolvedValue({
      items: visibleScheduleGroups,
      totalCount: visibleScheduleGroups.length,
      skip: 0,
      take: visibleScheduleGroups.length,
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test('рендерит сетку и легенду строго по ответу API', async () => {
    renderScheduleScreen()

    expect(screen.getByTestId('schedule-screen')).toBeInTheDocument()
    await waitFor(() =>
      expect(apiMocks.getScheduleGroups).toHaveBeenCalledWith(
        { skip: 0, take: 100 },
        expect.any(AbortSignal),
      ),
    )
    await waitFor(() =>
      expect(screen.getByTestId('schedule-calendar-grid')).toBeInTheDocument(),
    )
    expect(screen.getByTestId('schedule-filter-panel')).toHaveClass(
      'compact-filter-panel',
      'crm-filter-surface',
    )
    await waitFor(() => expect(screen.getAllByText('Утренняя база').length).toBeGreaterThan(0))

    expect(screen.getByTestId('schedule-card-1-group-core-1')).toBeVisible()
    expect(screen.getByTestId('schedule-card-2-group-core-2')).toBeVisible()
    expect(screen.getByTestId('schedule-card-2-group-core-3')).toBeVisible()
    expect(screen.getByTestId('schedule-type-token-type-cardio')).toHaveTextContent('3')
    expect(screen.getByTestId('schedule-type-token-type-intense')).toHaveTextContent('2')
    expect(screen.getByTestId('schedule-card-2-group-core-3')).toHaveTextContent('Зал Север')
    expect(screen.getByTestId('schedule-card-1-group-core-1')).toHaveTextContent('Алиса')
    expect(screen.queryByRole('textbox', { name: 'Поиск по названию', hidden: true }))
      .not.toBeInTheDocument()
  })

  test('desktop dense overlap renders one disclosure with full details and focus recovery', async () => {
    apiMocks.getScheduleGroups.mockResolvedValue({
      items: denseScheduleGroups,
      totalCount: denseScheduleGroups.length,
      skip: 0,
      take: 100,
    })

    renderScheduleScreen()

    const disclosure = await screen.findByRole('button', {
      name: /Пн \d{2}\.\d{2}, 08:00 - 08:45: 6 занятий в интервале\. Открыть детали/,
    })

    expect(disclosure).toBeVisible()
    expect(disclosure).toHaveAttribute('aria-haspopup', 'dialog')
    expect(disclosure).toHaveAttribute('aria-expanded', 'false')
    expect(disclosure).toHaveAttribute('aria-controls')
    expect(disclosure).toHaveTextContent('08:00 - 08:45 · 6 занятий')
    expect(disclosure).toHaveTextContent('База длинное название')
    expect(disclosure).toHaveTextContent('Интенсивный поток')
    expect(disclosure).toHaveTextContent('+4')
    expect(screen.queryByTestId('schedule-card-1-dense-1')).not.toBeInTheDocument()

    disclosure.focus()
    fireEvent.click(disclosure)

    const dialog = await screen.findByRole('dialog', { name: 'Занятия в интервале' })

    expect(dialog).toBeVisible()
    expect(disclosure).toHaveAttribute('aria-expanded', 'true')
    expect(dialog).toHaveTextContent('База длинное название')
    expect(dialog).toHaveTextContent('08:00 - 08:45')
    expect(dialog).toHaveTextContent('Основной зал · Центр')
    expect(dialog).toHaveTextContent('Тренер не назначен')
    expect(dialog).toHaveTextContent('Неактивна')
    expect(screen.getByRole('button', { name: 'Закрыть детали занятий' })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'Закрыть детали занятий' }))
    await waitFor(() => expect(disclosure).toHaveAttribute('aria-expanded', 'false'))
    expect(disclosure).toHaveFocus()

    fireEvent.click(disclosure)
    await screen.findByRole('dialog', { name: 'Занятия в интервале' })

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Занятия в интервале' }), {
      key: 'Escape',
    })
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Занятия в интервале' }))
        .not.toBeInTheDocument(),
    )
    expect(disclosure).toHaveFocus()
  })

  test('readable two-lane cards keep full time, group, hall and trainer without compact mode', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(420)
    apiMocks.getScheduleGroups.mockResolvedValue({
      items: roomyTwoLaneScheduleGroups,
      totalCount: roomyTwoLaneScheduleGroups.length,
      skip: 0,
      take: 100,
    })

    renderScheduleScreen()

    const firstCard = await screen.findByTestId('schedule-card-1-roomy-first')
    const secondCard = screen.getByTestId('schedule-card-1-roomy-second')

    expect(screen.queryByRole('button', { name: /занятий в интервале/ }))
      .not.toBeInTheDocument()
    expect(firstCard).toHaveTextContent('10:00 - 11:30')
    expect(firstCard).toHaveTextContent('Просторная первая')
    expect(firstCard).toHaveTextContent('Основной зал · Алиса Полное Имя')
    expect(secondCard).toHaveTextContent('10:20 - 11:50')
    expect(secondCard).toHaveTextContent('Зал Север · Борис Полное Имя')
    expect(firstCard).not.toHaveAttribute('data-compact')
    expect(secondCard).not.toHaveAttribute('data-compact')
  })

  test('successful refresh closes an orphaned disclosure and focuses the schedule board', async () => {
    apiMocks.getScheduleGroups
      .mockResolvedValueOnce({
        items: denseScheduleGroups,
        totalCount: denseScheduleGroups.length,
        skip: 0,
        take: 100,
      })
      .mockResolvedValueOnce({
        items: [visibleScheduleGroups[0]],
        totalCount: 1,
        skip: 0,
        take: 100,
      })

    renderScheduleScreen()

    const disclosure = await screen.findByRole('button', {
      name: /6 занятий в интервале\. Открыть детали/,
    })
    fireEvent.click(disclosure)
    await screen.findByRole('dialog', { name: 'Занятия в интервале' })

    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Занятия в интервале' }))
        .not.toBeInTheDocument(),
    )
    await waitFor(() => expect(screen.getByTestId('schedule-board')).toHaveFocus())
  })

  test('stale refresh error keeps the open disclosure and current detail rows available', async () => {
    apiMocks.getScheduleGroups
      .mockResolvedValueOnce({
        items: denseScheduleGroups,
        totalCount: denseScheduleGroups.length,
        skip: 0,
        take: 100,
      })
      .mockRejectedValueOnce(new Error('Сеть недоступна'))

    renderScheduleScreen()

    const disclosure = await screen.findByRole('button', {
      name: /6 занятий в интервале\. Открыть детали/,
    })
    fireEvent.click(disclosure)
    const dialog = await screen.findByRole('dialog', { name: 'Занятия в интервале' })

    fireEvent.click(screen.getByRole('button', { name: 'Обновить' }))

    expect(await screen.findByText('Не удалось обновить расписание')).toBeVisible()
    expect(dialog).toBeVisible()
    expect(dialog).toHaveTextContent('База длинное название')
    expect(disclosure).toHaveAttribute('aria-expanded', 'true')
  })

  test('в списке фильтров есть только значения из ответа и используются как единственный источник опций', async () => {
    renderScheduleScreen()

    await waitFor(() => expect(screen.getAllByText('Утренняя база').length).toBeGreaterThan(0))

    fireEvent.click(screen.getByRole('combobox', { name: 'Филиал' }))
    expect(screen.getByRole('option', { name: 'Центр' })).toBeVisible()
    expect(screen.getByRole('option', { name: 'Север' })).toBeVisible()
    expect(screen.queryByRole('option', { name: 'Юг' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('combobox', { name: 'Группа' }))
    expect(screen.getByRole('option', { name: 'Утренняя база' })).toBeVisible()
    expect(screen.getByRole('option', { name: 'Вечерняя' })).toBeVisible()
    expect(screen.queryByRole('option', { name: 'Неизвестная группа' })).not.toBeInTheDocument()
    expect(screen.getByTestId('schedule-day-count-2')).toHaveTextContent('2 занятия')
  })

  test('в мобильном списке переключение дней по стрелкам обновляет выбранный таб и фокус', async () => {
    setupDesktopMediaQuery(true)

    renderScheduleScreen()

    await waitFor(() =>
      expect(screen.getByTestId('schedule-mobile-day-strip')).toBeInTheDocument(),
    )
    const mondayTab = screen.getByTestId('schedule-mobile-day-tab-1')
    const tuesdayTab = screen.getByTestId('schedule-mobile-day-tab-2')

    fireEvent.click(mondayTab)
    await mondayTab.focus()
    expect(mondayTab).toHaveAttribute('aria-selected', 'true')
    expect(document.activeElement).toBe(mondayTab)

    fireEvent.keyDown(mondayTab, { key: 'ArrowRight' })
    await waitFor(() => expect(tuesdayTab).toHaveAttribute('aria-selected', 'true'))
    await waitFor(() => expect(document.activeElement).toBe(tuesdayTab))

    fireEvent.keyDown(tuesdayTab, { key: 'ArrowLeft' })
    await waitFor(() => expect(mondayTab).toHaveAttribute('aria-selected', 'true'))
    await waitFor(() => expect(document.activeElement).toBe(mondayTab))
  })

  test('Coach zero-scope показывает role-specific copy и оставляет только refresh', async () => {
    setupDesktopMediaQuery(true)
    apiMocks.getScheduleGroups.mockResolvedValue({
      items: [],
      totalCount: 0,
      skip: 0,
      take: 100,
    })

    renderScheduleScreen({ viewerRole: 'Coach' })

    await waitFor(() =>
      expect(screen.getByText('Для вас занятий в расписании нет')).toBeVisible(),
    )
    expect(
      screen.getByText(
        'Когда вас назначат на группу или временную замену, занятия появятся здесь.',
      ),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Фильтры' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Сбросить' })).not.toBeInTheDocument()
  })

  test('elevated empty state не получает Coach copy даже без group-management permission', async () => {
    apiMocks.getScheduleGroups.mockResolvedValue({
      items: [],
      totalCount: 0,
      skip: 0,
      take: 100,
    })

    renderScheduleScreen({ canManageGroups: false, viewerRole: 'SuperAdministrator' })

    await waitFor(() => expect(screen.getByText('Расписание пока пустое')).toBeVisible())
    expect(screen.queryByText('Для вас занятий в расписании нет')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Сбросить' })).toBeVisible()
  })

  test('Coach day-empty без фильтра отличается от filtered empty copy', async () => {
    setupDesktopMediaQuery(true)
    apiMocks.getScheduleGroups.mockResolvedValue({
      items: tuesdayOnlyScheduleGroups,
      totalCount: tuesdayOnlyScheduleGroups.length,
      skip: 0,
      take: 100,
    })

    renderScheduleScreen({ viewerRole: 'Coach' })

    await waitFor(() =>
      expect(screen.getByTestId('schedule-mobile-day-strip')).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByTestId('schedule-mobile-day-tab-1'))
    expect(screen.getByText('В этот день у вас занятий нет')).toBeVisible()
    expect(
      screen.getByText('На выбранный день в вашем расписании нет занятий.'),
    ).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Фильтры' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Группа' }))
    fireEvent.click(screen.getByRole('option', { name: 'Только вторник' }))
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }))

    await waitFor(() =>
      expect(screen.getByText('День свободен для выбранных фильтров.')).toBeVisible(),
    )
    expect(screen.queryByText('В этот день у вас занятий нет')).not.toBeInTheDocument()
  })

  test('elevated no-filter day-empty остаётся global, не Coach-scoped', async () => {
    setupDesktopMediaQuery(true)
    apiMocks.getScheduleGroups.mockResolvedValue({
      items: tuesdayOnlyScheduleGroups,
      totalCount: tuesdayOnlyScheduleGroups.length,
      skip: 0,
      take: 100,
    })

    renderScheduleScreen({ viewerRole: 'SuperAdministrator' })

    await waitFor(() =>
      expect(screen.getByTestId('schedule-mobile-day-strip')).toBeInTheDocument(),
    )
    fireEvent.click(screen.getByTestId('schedule-mobile-day-tab-1'))

    expect(screen.getByText('Занятий нет')).toBeVisible()
    expect(screen.getByText('В этот день в расписании нет занятий.')).toBeVisible()
    expect(screen.queryByText('В этот день у вас занятий нет')).not.toBeInTheDocument()
  })

  test('не рендерит состояние ошибки при корректном ответе API', async () => {
    renderScheduleScreen()

    await waitFor(() => expect(screen.queryByText('Расписание не загрузилось')).toBeNull())
    expect(screen.queryByText('Не удалось загрузить расписание.')).toBeNull()
    await waitFor(() => expect(getScheduleGroups).toHaveBeenCalledTimes(1))
  })
})
