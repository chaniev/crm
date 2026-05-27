import { describe, expect, test } from 'vitest'
import type { TrainingGroupListItem } from './api'
import {
  EMPTY_SCHEDULE_FILTERS,
  applyScheduleFilters,
  buildGroupWeekSchedule,
  buildScheduleCalendarWeek,
  buildScheduleDayCounts,
  buildScheduleFilterOptions,
  buildScheduleHourMarks,
  buildScheduleTodaySummary,
  buildScheduleTypeLegend,
  buildScheduleWeekdayLabels,
  formatScheduleEntryTimeRange,
  formatTrainingStartTime,
  getCurrentScheduleWeekday,
  getScheduleEntryGridMetrics,
  getScheduleTypePalette,
  getVisibleScheduleHourRange,
  hasActiveScheduleFilters,
  parseTrainingStartTime,
} from './groupSchedule'

const groups = [
  createGroup({
    id: 'group-evening',
    name: 'Вечерняя группа',
    trainingStartTime: '19:15',
    durationMinutes: 45,
    weekdays: [1, 3],
    branchId: 'branch-center',
    branchName: 'Центр',
    hallId: 'hall-main',
    hallName: 'Основной зал',
    trainerIds: ['trainer-irina'],
    trainerNames: ['Ирина Тренер'],
    trainers: [
      {
        id: 'trainer-irina',
        fullName: 'Ирина Тренер',
        login: 'irina',
      },
    ],
  }),
  createGroup({
    id: 'group-morning',
    name: 'Утренняя группа',
    trainingStartTime: '09:30',
    durationMinutes: 45,
    weekdays: [1, 5],
    branchId: 'branch-center',
    branchName: 'Центр',
    hallId: 'hall-main',
    hallName: 'Основной зал',
    trainerIds: ['trainer-artem'],
    trainerNames: ['Артем База'],
    trainers: [
      {
        id: 'trainer-artem',
        fullName: 'Артем База',
        login: 'artem',
      },
    ],
  }),
  createGroup({
    id: 'group-same-time',
    name: 'Альфа',
    trainingStartTime: '09:30',
    durationMinutes: 60,
    weekdays: [1],
    branchId: 'branch-center',
    branchName: 'Центр',
    hallId: 'hall-main',
    hallName: 'Основной зал',
    trainerIds: ['trainer-irina', 'trainer-artem'],
    trainerNames: ['Ирина Тренер', 'Артем База'],
    trainers: [
      {
        id: 'trainer-irina',
        fullName: 'Ирина Тренер',
        login: 'irina',
      },
      {
        id: 'trainer-artem',
        fullName: 'Артем База',
        login: 'artem',
      },
    ],
  }),
  createGroup({
    id: 'group-branch-two',
    name: 'Субботний интенсив',
    trainingStartTime: '11:00',
    durationMinutes: 90,
    weekdays: [6],
    branchId: 'branch-north',
    branchName: 'Север',
    hallId: 'hall-loft',
    hallName: 'Loft',
    trainerIds: ['trainer-olga'],
    trainerNames: ['Ольга Север'],
    trainers: [
      {
        id: 'trainer-olga',
        fullName: 'Ольга Север',
        login: 'olga',
      },
    ],
  }),
] satisfies TrainingGroupListItem[]

describe('groupSchedule helpers', () => {
  test('returns all weekdays in stable order', () => {
    const schedule = buildGroupWeekSchedule(groups)

    expect(schedule.map((day) => day.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(schedule.map((day) => day.label)).toEqual([
      'Пн',
      'Вт',
      'Ср',
      'Чт',
      'Пт',
      'Сб',
      'Вс',
    ])
  })

  test('includes groups in every selected weekday', () => {
    const schedule = buildGroupWeekSchedule(groups)

    expect(schedule[0].entries.map((group) => group.id)).toEqual([
      'group-same-time',
      'group-morning',
      'group-evening',
    ])
    expect(schedule[2].entries.map((group) => group.id)).toEqual([
      'group-evening',
    ])
    expect(schedule[4].entries.map((group) => group.id)).toEqual([
      'group-morning',
    ])
    expect(schedule[5].entries.map((group) => group.id)).toEqual([
      'group-branch-two',
    ])
  })

  test('sorts entries by local start time and then group name', () => {
    const schedule = buildGroupWeekSchedule([
      createGroup({
        id: 'group-1',
        name: 'Бета',
        trainingStartTime: '9:05',
        weekdays: [1],
      }),
      createGroup({
        id: 'group-2',
        name: 'Альфа',
        trainingStartTime: '09:05',
        weekdays: [1],
      }),
      createGroup({
        id: 'group-3',
        name: 'Позже',
        trainingStartTime: '10:00',
        weekdays: [1],
      }),
    ])

    expect(schedule[0].entries.map((group) => group.name)).toEqual([
      'Альфа',
      'Бета',
      'Позже',
    ])
  })

  test('formats start time as HH:mm without Date parsing', () => {
    expect(formatTrainingStartTime('9:05')).toBe('09:05')
    expect(formatTrainingStartTime('19:00:00')).toBe('19:00')
    expect(parseTrainingStartTime('23:45')).toEqual({
      hours: 23,
      minutes: 45,
      totalMinutes: 1_425,
      label: '23:45',
    })
  })

  test('maps local Date weekday to schedule ISO weekday', () => {
    expect(getCurrentScheduleWeekday(new Date(2026, 4, 11))).toBe(1)
    expect(getCurrentScheduleWeekday(new Date(2026, 4, 15))).toBe(5)
    expect(getCurrentScheduleWeekday(new Date(2026, 4, 17))).toBe(7)
  })

  test('builds presentation-only weekday date labels for the current local week', () => {
    expect(buildScheduleWeekdayLabels(new Date(2026, 4, 13, 10, 30))).toEqual([
      { weekday: 1, label: 'Пн', dateLabel: '11.05' },
      { weekday: 2, label: 'Вт', dateLabel: '12.05' },
      { weekday: 3, label: 'Ср', dateLabel: '13.05' },
      { weekday: 4, label: 'Чт', dateLabel: '14.05' },
      { weekday: 5, label: 'Пт', dateLabel: '15.05' },
      { weekday: 6, label: 'Сб', dateLabel: '16.05' },
      { weekday: 7, label: 'Вс', dateLabel: '17.05' },
    ])
    expect(buildScheduleWeekdayLabels(new Date(2026, 4, 17))[0]).toEqual({
      weekday: 1,
      label: 'Пн',
      dateLabel: '11.05',
    })
  })

  test('derives day counters from visible calendar entries', () => {
    const calendarWeek = buildScheduleCalendarWeek(groups)

    expect(buildScheduleDayCounts(calendarWeek.days)).toEqual({
      1: 3,
      2: 0,
      3: 1,
      4: 0,
      5: 1,
      6: 1,
      7: 0,
    })
  })

  test('formats visible entry time range from local HH:mm schedule fields', () => {
    const calendarWeek = buildScheduleCalendarWeek(groups)
    const morningEntry = calendarWeek.days[0].entries.find((entry) =>
      entry.group.id === 'group-morning',
    )

    expect(morningEntry).toBeDefined()
    expect(formatScheduleEntryTimeRange(morningEntry!)).toBe('09:30 - 10:15')
  })

  test('computes visible hour range from visible entries and rounds to full hours', () => {
    const filteredGroups = applyScheduleFilters(groups, {
      ...EMPTY_SCHEDULE_FILTERS,
      branchId: 'branch-center',
    })
    const calendarWeek = buildScheduleCalendarWeek(filteredGroups)

    expect(calendarWeek.visibleHourRange).toEqual({
      startHour: 9,
      endHour: 20,
    })
    expect(getVisibleScheduleHourRange(calendarWeek.days[0].entries)).toEqual({
      startHour: 9,
      endHour: 20,
    })
    expect(buildScheduleHourMarks(calendarWeek.visibleHourRange)).toEqual([
      9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ])
  })

  test('builds stable type legend from visible entries', () => {
    const calendarWeek = buildScheduleCalendarWeek([
      createGroup({
        id: 'group-cardio',
        name: 'Кардио старт',
        groupTypeId: 'type-cardio',
        groupTypeName: 'Кардио',
        weekdays: [1, 2],
      }),
      createGroup({
        id: 'group-strength',
        name: 'Сила',
        groupTypeId: 'type-strength',
        groupTypeName: 'Сила',
        weekdays: [1],
      }),
    ])
    const legend = buildScheduleTypeLegend(calendarWeek.days.flatMap((day) => day.entries))

    expect(legend.map((item) => ({
      key: item.key,
      label: item.label,
      count: item.count,
      palette: item.palette,
    }))).toEqual([
      {
        key: 'type-cardio',
        label: 'Кардио',
        count: 2,
        palette: getScheduleTypePalette('type-cardio'),
      },
      {
        key: 'type-strength',
        label: 'Сила',
        count: 1,
        palette: getScheduleTypePalette('type-strength'),
      },
    ])
  })

  test('summarizes current weekday entries and hall load from visible schedule payload', () => {
    const calendarWeek = buildScheduleCalendarWeek(groups)
    const summary = buildScheduleTodaySummary(calendarWeek.days, 1)

    expect(summary.totalEntries).toBe(3)
    expect(summary.typeItems).toEqual([
      expect.objectContaining({
        key: 'group-type',
        label: 'Кардио',
        count: 3,
      }),
    ])
    expect(summary.hallItems).toEqual([
      {
        key: 'hall-main',
        label: 'Основной зал',
        count: 3,
        totalMinutes: 150,
      },
    ])
  })

  test('assigns side-by-side lanes for overlapping entries inside one day', () => {
    const overlappingWeek = buildScheduleCalendarWeek([
      createGroup({
        id: 'first',
        name: 'Первая',
        trainingStartTime: '10:00',
        durationMinutes: 60,
        weekdays: [1],
      }),
      createGroup({
        id: 'second',
        name: 'Вторая',
        trainingStartTime: '10:30',
        durationMinutes: 60,
        weekdays: [1],
      }),
      createGroup({
        id: 'third',
        name: 'Третья',
        trainingStartTime: '11:00',
        durationMinutes: 30,
        weekdays: [1],
      }),
    ])

    expect(overlappingWeek.days[0].entries.map((entry) => ({
      id: entry.group.id,
      lane: entry.lane,
      laneCount: entry.laneCount,
    }))).toEqual([
      { id: 'first', lane: 0, laneCount: 2 },
      { id: 'second', lane: 1, laneCount: 2 },
      { id: 'third', lane: 0, laneCount: 2 },
    ])
  })

  test('derives constrained grid metrics for mobile lane positioning', () => {
    const overlappingWeek = buildScheduleCalendarWeek([
      createGroup({
        id: 'first',
        name: 'Первая',
        trainingStartTime: '10:00',
        durationMinutes: 60,
        weekdays: [1],
      }),
      createGroup({
        id: 'second',
        name: 'Вторая',
        trainingStartTime: '10:30',
        durationMinutes: 60,
        weekdays: [1],
      }),
    ])
    const secondEntry = overlappingWeek.days[0].entries[1]

    expect(getScheduleEntryGridMetrics(secondEntry, {
      startHour: 10,
      endHour: 12,
    })).toEqual({
      topPercent: 25,
      heightPercent: 50,
      laneLeftPercent: 50,
      laneWidthPercent: 50,
    })
  })

  test('combines branch, hall, trainer and group filters and can reset to full dataset', () => {
    const filteredGroups = applyScheduleFilters(groups, {
      branchId: 'branch-center',
      hallId: 'hall-main',
      trainerId: 'trainer-artem',
      groupId: 'group-same-time',
    })

    expect(filteredGroups.map((group) => group.id)).toEqual(['group-same-time'])
    expect(hasActiveScheduleFilters(EMPTY_SCHEDULE_FILTERS)).toBe(false)
    expect(hasActiveScheduleFilters({
      ...EMPTY_SCHEDULE_FILTERS,
      trainerId: 'trainer-artem',
    })).toBe(true)
    expect(applyScheduleFilters(groups, EMPTY_SCHEDULE_FILTERS)).toEqual(groups)
  })

  test('derives contextual filter options from loaded schedule groups', () => {
    const filterOptions = buildScheduleFilterOptions(groups, {
      ...EMPTY_SCHEDULE_FILTERS,
      branchId: 'branch-center',
      trainerId: 'trainer-artem',
    })

    expect(filterOptions.halls).toEqual([
      {
        value: 'hall-main',
        label: 'Основной зал · Центр',
      },
    ])
    expect(filterOptions.groups).toEqual([
      {
        value: 'group-same-time',
        label: 'Альфа',
      },
      {
        value: 'group-morning',
        label: 'Утренняя группа',
      },
    ])
  })
})

function createGroup(
  overrides: Partial<TrainingGroupListItem> & Pick<TrainingGroupListItem, 'id' | 'name'>,
): TrainingGroupListItem {
  return {
    id: overrides.id,
    name: overrides.name,
    branchId: overrides.branchId ?? 'branch-center',
    branchName: overrides.branchName ?? 'Центр',
    hallId: overrides.hallId ?? 'hall-main',
    hallName: overrides.hallName ?? 'Основной зал',
    groupTypeId: overrides.groupTypeId ?? 'group-type',
    groupTypeName: overrides.groupTypeName ?? 'Кардио',
    trainingStartTime: overrides.trainingStartTime ?? '09:00',
    durationMinutes: overrides.durationMinutes ?? 60,
    weekdays: overrides.weekdays ?? [1],
    isActive: overrides.isActive ?? true,
    trainers: overrides.trainers ?? [],
    trainerIds: overrides.trainerIds ?? [],
    trainerCount: overrides.trainerCount ?? overrides.trainerIds?.length ?? 0,
    trainerNames: overrides.trainerNames ?? [],
    clientCount: overrides.clientCount ?? 0,
    updatedAt: overrides.updatedAt,
  }
}
