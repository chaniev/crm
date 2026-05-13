import { describe, expect, test } from 'vitest'
import {
  buildGroupWeekSchedule,
  formatTrainingStartTime,
} from './groupSchedule'

const groups = [
  {
    id: 'group-evening',
    name: 'Вечерняя группа',
    trainingStartTime: '19:00',
    weekdays: [1, 3],
  },
  {
    id: 'group-morning',
    name: 'Утренняя группа',
    trainingStartTime: '09:30',
    weekdays: [1, 5],
  },
  {
    id: 'group-same-time',
    name: 'Альфа',
    trainingStartTime: '09:30',
    weekdays: [1],
  },
]

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
  })

  test('sorts entries by raw start time and then group name', () => {
    const schedule = buildGroupWeekSchedule(groups)

    expect(schedule[0].entries.map((group) => group.name)).toEqual([
      'Альфа',
      'Утренняя группа',
      'Вечерняя группа',
    ])
  })

  test('formats start time as HH:mm without Date parsing', () => {
    expect(formatTrainingStartTime('9:05')).toBe('09:05')
    expect(formatTrainingStartTime('19:00:00')).toBe('19:00')
  })
})
