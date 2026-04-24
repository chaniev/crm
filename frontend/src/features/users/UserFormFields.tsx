import {
  PasswordInput,
  Select,
  SimpleGrid,
  Switch,
  TextInput,
} from '@mantine/core'
import type { UseFormReturnType } from '@mantine/form'
import type { ReactNode } from 'react'
import type { MessengerPlatform, UserRole } from '../../lib/api'
import { resources } from '../../lib/resources'
import {
  messengerPlatformOptions,
  type UserRoleOption,
} from './UserManagement.constants'

export type BaseUserFormValues = {
  fullName: string
  role: UserRole | null
  messengerPlatform: MessengerPlatform | null
  messengerPlatformUserId: string
  mustChangePassword: boolean
  isActive: boolean
}

export type CreateUserFormValues = BaseUserFormValues & {
  login: string
  password: string
}

export type EditUserFormValues = BaseUserFormValues & {
  login: string
}

type UserFormFieldsProps<FormValues extends BaseUserFormValues> = {
  credentialsFields: ReactNode
  form: UseFormReturnType<FormValues>
  isActiveDisabled?: boolean
  roleDisabled?: boolean
  roleOptions: UserRoleOption[]
}

export function UserFormFields<FormValues extends BaseUserFormValues>({
  credentialsFields,
  form,
  isActiveDisabled = false,
  roleDisabled = false,
  roleOptions,
}: UserFormFieldsProps<FormValues>) {
  return (
    <>
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <TextInput
          label={resources.users.form.labels.fullName}
          placeholder={resources.users.form.placeholders.fullName}
          {...form.getInputProps('fullName')}
        />
        <Select
          allowDeselect={false}
          data={roleOptions}
          disabled={roleDisabled}
          label={resources.users.form.labels.role}
          {...form.getInputProps('role')}
        />
      </SimpleGrid>

      {credentialsFields}

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Select
          clearable
          data={messengerPlatformOptions}
          description={resources.users.form.descriptions.messengerPlatform}
          label={resources.users.form.labels.messengerPlatform}
          placeholder={resources.users.form.placeholders.messengerPlatform}
          {...form.getInputProps('messengerPlatform')}
        />
        <TextInput
          description={resources.users.form.descriptions.messengerPlatformUserId}
          label={resources.users.form.labels.messengerPlatformUserId}
          placeholder={resources.users.form.placeholders.messengerPlatformUserId}
          {...form.getInputProps('messengerPlatformUserId')}
        />
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Switch
          disabled={isActiveDisabled}
          label={resources.users.form.labels.isActive}
          {...form.getInputProps('isActive', { type: 'checkbox' })}
        />
        <Switch
          label={resources.users.form.labels.mustChangePassword}
          {...form.getInputProps('mustChangePassword', {
            type: 'checkbox',
          })}
        />
      </SimpleGrid>
    </>
  )
}

type UserCreateCredentialsFieldsProps = {
  form: UseFormReturnType<CreateUserFormValues>
}

export function UserCreateCredentialsFields({
  form,
}: UserCreateCredentialsFieldsProps) {
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }}>
      <TextInput
        autoComplete="username"
        label={resources.users.form.labels.login}
        placeholder={resources.users.form.placeholders.login}
        {...form.getInputProps('login')}
      />
      <PasswordInput
        autoComplete="new-password"
        label={resources.users.form.labels.password}
        placeholder={resources.users.form.placeholders.password}
        {...form.getInputProps('password')}
      />
    </SimpleGrid>
  )
}

type UserEditCredentialsFieldsProps = {
  form: UseFormReturnType<EditUserFormValues>
}

export function UserEditCredentialsFields({
  form,
}: UserEditCredentialsFieldsProps) {
  return (
    <TextInput
      label={resources.users.form.labels.login}
      readOnly
      {...form.getInputProps('login')}
    />
  )
}
