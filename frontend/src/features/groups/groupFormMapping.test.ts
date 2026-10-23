import { describe, expect, test } from 'vitest'
import type { TrainingGroupDetails } from '../../lib/api'
import {
  toCreateGroupWithInitialSeriesPayload,
  toFormValues,
  toUpdateGroupIdentityPayload,
  toUpsertGroupPayload,
  type GroupFormValues,
} from './groupFormMapping'

describe('groupFormMapping', () => {
  test('builds the exact upsert payload shape and preserves schedule boundaries', () => {
    const values: GroupFormValues = {
      branchId: 'branch-1',
      hallId: 'hall-1',
      groupTypeId: 'type-1',
      name: '  Вечерняя группа  ',
      weekdayStartTimes: {},
      trainingStartTime: ' 18:30 ',
      durationMinutes: 75,
      weekdays: ['5', '2', '4'],
      initialSeriesStartsOn: '2026-09-01',
      initialSeriesEndsOn: '',
      isActive: true,
      trainerIds: ['trainer-2', 'trainer-1'],
    }

    const payload = toUpsertGroupPayload(values)

    expect(Object.keys(payload)).toEqual([
      'name',
      'branchId',
      'hallId',
      'groupTypeId',
      'trainingStartTime',
      'durationMinutes',
      'weekdays',
      'isActive',
      'trainerIds',
    ])
    expect(payload).toEqual({
      name: 'Вечерняя группа',
      branchId: 'branch-1',
      hallId: 'hall-1',
      groupTypeId: 'type-1',
      trainingStartTime: '18:30',
      durationMinutes: 75,
      weekdays: [5, 2, 4],
      isActive: true,
      trainerIds: ['trainer-1', 'trainer-2'],
    })
  })

  test('keeps optional ids undefined and empty duration null for backend validation', () => {
    const payload = toUpsertGroupPayload({
      branchId: '',
      hallId: '',
      groupTypeId: '',
      name: 'Группа без расписания',
      weekdayStartTimes: {},
      trainingStartTime: '',
      durationMinutes: '',
      weekdays: [],
      initialSeriesStartsOn: '2026-09-01',
      initialSeriesEndsOn: '',
      isActive: false,
      trainerIds: [],
    })

    expect(payload).toEqual({
      name: 'Группа без расписания',
      branchId: undefined,
      hallId: undefined,
      groupTypeId: undefined,
      trainingStartTime: '',
      durationMinutes: null,
      weekdays: [],
      isActive: false,
      trainerIds: [],
    })
  })

  test('builds identity-only update payload without schedule or trainer fields', () => {
    const payload = toUpdateGroupIdentityPayload({
      branchId: 'branch-1',
      hallId: 'hall-1',
      groupTypeId: 'type-1',
      name: '  Новое имя  ',
      weekdayStartTimes: {},
      trainingStartTime: '18:30',
      durationMinutes: 75,
      weekdays: ['2', '4'],
      initialSeriesStartsOn: '2026-09-01',
      initialSeriesEndsOn: '',
      isActive: false,
      trainerIds: ['trainer-2', 'trainer-1'],
    })

    expect(payload).toEqual({
      name: 'Новое имя',
      branchId: 'branch-1',
      groupTypeId: 'type-1',
      isActive: false,
    })
    expect(payload).not.toHaveProperty('hallId')
    expect(payload).not.toHaveProperty('trainingStartTime')
    expect(payload).not.toHaveProperty('durationMinutes')
    expect(payload).not.toHaveProperty('weekdays')
    expect(payload).not.toHaveProperty('trainerIds')
  })

  test('maps group details into controlled form values without changing trainer order', () => {
    const details: TrainingGroupDetails = {
      id: 'group-1',
      branchId: 'branch-1',
      branchName: 'Центр',
      hallId: 'hall-1',
      hallName: 'Большой',
      groupTypeId: 'type-1',
      groupTypeName: 'Общая',
      name: 'Утренняя',
      trainingStartTime: '09:00',
      durationMinutes: 60,
      weekdays: [1, 3],
      isActive: true,
      trainers: [],
      trainerIds: ['trainer-2', 'trainer-1'],
      clientCount: 4,
      createdAt: '2026-07-01T10:00:00Z',
      updatedAt: '2026-07-20T10:00:00Z',
      trainerAssignmentRevision: 'assignment-revision-1',
      trainerAssignmentPeriods: [],
    }

    expect(toFormValues(details)).toEqual({
      branchId: 'branch-1',
      hallId: 'hall-1',
      groupTypeId: 'type-1',
      name: 'Утренняя',
      weekdayStartTimes: {},
      trainingStartTime: '09:00',
      durationMinutes: 60,
      weekdays: ['1', '3'],
      initialSeriesStartsOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      initialSeriesEndsOn: '',
      isActive: true,
      trainerIds: ['trainer-2', 'trainer-1'],
    })
  })
})

const createValues: GroupFormValues = {
  branchId: 'branch-1', hallId: 'hall-1', groupTypeId: 'type-1', name: ' Группа ',
  trainingStartTime: '07:00', durationMinutes: 60, weekdays: ['6', '1', '3'],
  weekdayStartTimes: { '1': '18:00', '3': '18:00', '6': '10:00' },
  initialSeriesStartsOn: '2026-10-26', initialSeriesEndsOn: '2026-11-30',
  isActive: true, trainerIds: [],
}

test('create maps weekday times in canonical order and projects legacy fields from the first slot', () => {
  const payload = toCreateGroupWithInitialSeriesPayload(createValues)
  expect(payload.trainingStartTime).toBe('18:00')
  expect(payload.weekdays).toEqual([1, 3, 6])
  expect(payload.initialLessonSeries).toEqual({
    startsOn: '2026-10-26', endsOn: '2026-11-30',
    slots: [
      { isoWeekday: 1, startTime: '18:00', durationMinutes: 60, hallId: 'hall-1' },
      { isoWeekday: 3, startTime: '18:00', durationMinutes: 60, hallId: 'hall-1' },
      { isoWeekday: 6, startTime: '10:00', durationMinutes: 60, hallId: 'hall-1' },
    ],
  })
  expect(toCreateGroupWithInitialSeriesPayload(createValues, 'token')).toEqual({
    ...payload, confirmationToken: 'token',
  })
})

test('removing a weekday omits its draft and preserves the remaining times', () => {
  expect(toCreateGroupWithInitialSeriesPayload({ ...createValues, weekdays: ['6', '3'] }))
    .toMatchObject({ trainingStartTime: '18:00', weekdays: [3, 6], initialLessonSeries: {
      slots: [expect.objectContaining({ isoWeekday: 3, startTime: '18:00' }),
        expect.objectContaining({ isoWeekday: 6, startTime: '10:00' })],
    } })
})

test('equal times remain independent and an empty selection has no legacy time', () => {
  expect(toCreateGroupWithInitialSeriesPayload({ ...createValues,
    weekdayStartTimes: { '1': '09:00', '3': '09:00', '6': '09:00' },
  }).initialLessonSeries?.slots.map(slot => slot.startTime)).toEqual(['09:00', '09:00', '09:00'])
  expect(toCreateGroupWithInitialSeriesPayload({ ...createValues, weekdays: [] }))
    .toMatchObject({ trainingStartTime: '', weekdays: [], initialLessonSeries: { slots: [] } })
})
