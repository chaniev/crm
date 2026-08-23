import { describe, expect, test } from 'vitest'
import type { UserListItem } from '../../lib/api'
import {
  countActiveTrainerFilters,
  filterTrainerListItems,
  isTrainerSearchMatch,
  normalizeTrainerListSearchQuery,
} from './trainerListSearch'

const TRAINERS: Array<
  Pick<UserListItem, 'id' | 'fullName' | 'login' | 'role' | 'mustChangePassword' | 'isActive' | 'messengerPlatform' | 'messengerPlatformUserId' | 'branchId' | 'branchName'>
> = [
  {
    id: 'coach-1',
    fullName: 'Александр Ветров',
    login: 'headcoach',
    role: 'Coach',
    mustChangePassword: false,
    isActive: true,
    messengerPlatform: null,
    messengerPlatformUserId: null,
    branchId: null,
    branchName: null,
  },
  {
    id: 'admin-1',
    fullName: 'Суперадминистратор',
    login: 'super-admin',
    role: 'SuperAdministrator',
    mustChangePassword: true,
    isActive: true,
    messengerPlatform: null,
    messengerPlatformUserId: null,
    branchId: null,
    branchName: null,
  },
  {
    id: 'coach-2',
    fullName: 'Тренер-исследователь',
    login: 'Trainer-Search',
    role: 'Coach',
    mustChangePassword: true,
    isActive: false,
    messengerPlatform: 'Telegram',
    messengerPlatformUserId: 'telegram-hidden-value',
    branchId: null,
    branchName: null,
  },
  {
    id: 'coach-3',
    fullName: 'Олег Соколов',
    login: 'inactive-only',
    role: 'Coach',
    mustChangePassword: false,
    isActive: false,
    messengerPlatform: null,
    messengerPlatformUserId: null,
    branchId: null,
    branchName: null,
  },
]

describe('trainerListSearch', () => {
  test('normalizes query with trim + locale-aware lowercasing', () => {
    expect(normalizeTrainerListSearchQuery('  ИВАн   ')).toBe('иван')
    expect(normalizeTrainerListSearchQuery('  TRN-Search  ')).toBe('trn-search')
    expect(normalizeTrainerListSearchQuery('   ')).toBe('')
  })

  test('matches by full name and login only', () => {
    const first = TRAINERS[0]
    const third = TRAINERS[2]

    expect(isTrainerSearchMatch(first, 'иван')).toBe(false)
    expect(isTrainerSearchMatch(first, 'Александр')).toBe(true)
    expect(isTrainerSearchMatch(first, 'HEADCOACH')).toBe(true)
    expect(isTrainerSearchMatch(third, 'Trainer')).toBe(true)
    expect(isTrainerSearchMatch(third, 'super')).toBe(false)
    expect(isTrainerSearchMatch(third, 'Coach')).toBe(false)
  })

  test('filters trainer list while preserving backend order and excluding hidden fields', () => {
    const resultByName = filterTrainerListItems(TRAINERS, 'р')
    expect(resultByName.map((item) => item.id)).toEqual([
      'coach-1',
      'admin-1',
      'coach-2',
    ])

    const resultByLogin = filterTrainerListItems(TRAINERS, 'TRAIN')
    expect(resultByLogin.map((item) => item.id)).toEqual(['coach-2'])

    const resultByHiddenField = filterTrainerListItems(TRAINERS, 'superadministrator')
    expect(resultByHiddenField).toEqual([])
  })

  test('filters by inactive and required password dimensions simultaneously', () => {
    expect(
      filterTrainerListItems(TRAINERS, '', {
        status: 'inactive',
        password: 'all',
      }).map((item) => item.id),
    ).toEqual(['coach-2', 'coach-3'])

    expect(
      filterTrainerListItems(TRAINERS, '', {
        status: 'all',
        password: 'mustChange',
      }).map((item) => item.id),
    ).toEqual(['admin-1', 'coach-2'])

    expect(
      filterTrainerListItems(TRAINERS, '', {
        status: 'inactive',
        password: 'mustChange',
      }).map((item) => item.id),
    ).toEqual(['coach-2'])

    expect(
      filterTrainerListItems(TRAINERS, 'исследователь', {
        status: 'inactive',
        password: 'mustChange',
      }).map((item) => item.id),
    ).toEqual(['coach-2'])

    expect(
      filterTrainerListItems(TRAINERS, 'telegram-hidden-value', {
        status: 'all',
        password: 'all',
      }),
    ).toEqual([])

    expect(countActiveTrainerFilters({ status: 'all', password: 'all' })).toBe(0)
    expect(countActiveTrainerFilters({ status: 'inactive', password: 'all' })).toBe(1)
    expect(countActiveTrainerFilters({ status: 'all', password: 'mustChange' })).toBe(1)
    expect(countActiveTrainerFilters({ status: 'inactive', password: 'mustChange' })).toBe(2)
  })

  test('returns full backend order when query is blank', () => {
    const result = filterTrainerListItems(TRAINERS, '   ')

    expect(result.map((item) => item.id)).toEqual(
      TRAINERS.map((item) => item.id),
    )
  })
})
