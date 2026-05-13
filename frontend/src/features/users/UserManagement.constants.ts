import type { MessengerPlatform, UserRole } from '../../lib/api'
import { resources } from '../../lib/resources'

export type UserRoleOption = {
  value: UserRole
  label: string
}

export type MessengerPlatformOption = {
  value: MessengerPlatform
  label: string
}

export const userRoleLabels: Record<UserRole, string> = resources.users.roles

export const userRoleOptions: UserRoleOption[] = [
  { value: 'Coach', label: userRoleLabels.Coach },
]

export const headCoachRoleOptions: UserRoleOption[] = [
  { value: 'HeadCoach', label: userRoleLabels.HeadCoach },
]

export const messengerPlatformOptions: MessengerPlatformOption[] = [
  {
    value: 'Telegram',
    label: resources.users.messenger.platforms.Telegram,
  },
]
