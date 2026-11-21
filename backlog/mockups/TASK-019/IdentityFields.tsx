import { createContext, useContext, type ReactNode, type RefObject } from 'react'
import { Alert, Button, FileButton, Stack, TextInput } from '@mantine/core'
import type { UseFormReturnType } from '@mantine/form'
import { IconCamera } from '@tabler/icons-react'
import { getClientAgeDisplayValue } from '../../../frontend/src/features/clients/clientBirthDate'
import { clientPhotoAcceptValue } from '../../../frontend/src/features/clients/ClientManagement.formatting'
import type { ClientFormValues } from '../../../frontend/src/features/clients/ClientManagement.form'

// Only the standalone prototype substitutes this header in the existing client form.
export const IdentityHeader = createContext<ReactNode>(null)
export function IdentitySlot() {
  return useContext(IdentityHeader)
}

export function IdentityFields({ photo, form, businessDate }: {
  photo: ReactNode; form: UseFormReturnType<ClientFormValues>; businessDate: string
}) {
  return <div className="editor-identity">
    {photo}
    <Stack className="editor-names" gap="xs">
      <TextInput label="Фамилия" autoComplete="family-name" {...form.getInputProps('lastName')}/>
      <TextInput label="Имя" autoComplete="given-name" {...form.getInputProps('firstName')}/>
      <TextInput label="Отчество" autoComplete="additional-name" {...form.getInputProps('middleName')}/>
    </Stack>
    <TextInput className="editor-birth-date" label="Дата рождения" type="date"
      description={form.values.birthDate && getClientAgeDisplayValue(form.values.birthDate, businessDate)}
      {...form.getInputProps('birthDate')}/>
  </div>
}

type PortraitProps = {
  preview: ReactNode
  onPick: (file: File | null) => Promise<void>
  resetRef: RefObject<(() => void) | null>
  uploading: boolean
  error: string | null
}

export function EditPortrait({ preview, onPick, resetRef, uploading, error }: PortraitProps) {
  const upload = <FileButton accept={clientPhotoAcceptValue} resetRef={resetRef} onChange={onPick}>
    {props => <Button {...props} type="button" variant={preview ? 'default' : 'subtle'}
      className={preview ? 'portrait-replace' : 'portrait-add'} loading={uploading}
      aria-label={preview ? 'Заменить фото' : 'Добавить фото'} title="JPEG, PNG, WebP, HEIC, HEIF · до 10 МБ">
      <IconCamera size={18} aria-hidden/><span>{preview ? 'Заменить' : 'Добавить фото'}</span>
    </Button>}
  </FileButton>
  return <>
    <div className="editor-portrait">{preview || upload}</div>
    {preview && <div className="editor-photo-action">{upload}</div>}
    {error && <Alert className="editor-photo-error" color="red" role="alert" title="Не удалось загрузить фото">{error}</Alert>}
  </>
}
