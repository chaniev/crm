import { describe, expect, test } from 'vitest'
import type { TrainingGroupDetails } from '../../lib/api'
import {
  toFormValues,
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
      trainingStartTime: ' 18:30 ',
      durationMinutes: 75,
      weekdays: ['5', '2', '4'],
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
      trainingStartTime: '',
      durationMinutes: '',
      weekdays: [],
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
    }

    expect(toFormValues(details)).toEqual({
      branchId: 'branch-1',
      hallId: 'hall-1',
      groupTypeId: 'type-1',
      name: 'Утренняя',
      trainingStartTime: '09:00',
      durationMinutes: 60,
      weekdays: ['1', '3'],
      isActive: true,
      trainerIds: ['trainer-2', 'trainer-1'],
    })
  })
})
