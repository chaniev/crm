import type { UserRole } from '../../lib/api'
import { resources } from '../../lib/resources'

export type UserRoleOption = {
  value: UserRole
  label: string
}

export const userRoleLabels: Record<UserRole, string> = resources.users.roles

export const userRoleOptions: UserRoleOption[] = [
  { value: 'Administrator', label: userRoleLabels.Administrator },
  { value: 'Coach', label: userRoleLabels.Coach },
]

export const headCoachRoleOptions: UserRoleOption[] = [
  { value: 'HeadCoach', label: userRoleLabels.HeadCoach },
]
