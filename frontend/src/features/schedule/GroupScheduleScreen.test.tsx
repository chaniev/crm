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
