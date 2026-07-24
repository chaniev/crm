import { describe, expect, test } from 'vitest'
import {
  toCreateUserPayload,
  toUpdateUserPayload,
} from './UserManagement.mappers'

describe('UserManagement mappers', () => {
  test('clears branch when creating SuperAdministrator from backend role option', () => {
    expect(toCreateUserPayload({
      fullName: ' Супер Админ ',
      login: ' superadmin ',
      password: 'secret',
      role: 'SuperAdministrator',
      branchId: '',
      messengerPlatform: null,
      messengerPlatformUserId: '',
      mustChangePassword: true,
      isActive: true,
    })).toMatchObject({
      fullName: 'Супер Админ',
      login: 'superadmin',
      role: 'SuperAdministrator',
      branchId: null,
    })
  })

  test('preserves selected branch only for Administrator destination', () => {
    expect(toUpdateUserPayload({
      fullName: 'Администратор',
      login: 'administrator',
      role: 'Administrator',
      branchId: 'branch-2',
      messengerPlatform: null,
      messengerPlatformUserId: '',
      mustChangePassword: false,
      isActive: true,
    })).toMatchObject({
      role: 'Administrator',
      branchId: 'branch-2',
    })

    expect(toUpdateUserPayload({
      fullName: 'Тренер',
      login: 'coach',
      role: 'Coach',
      branchId: 'branch-2',
      messengerPlatform: null,
      messengerPlatformUserId: '',
      mustChangePassword: false,
      isActive: true,
    })).toMatchObject({
      role: 'Coach',
      branchId: null,
    })
  })
})
