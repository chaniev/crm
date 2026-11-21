import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ClientForm } from '../../../frontend/src/features/clients/ClientForm'
import { normalizeContacts, useClientForm, validateClientForm, type ClientFormValues } from '../../../frontend/src/features/clients/ClientManagement.form'
import { branches, groups } from './fixtures'

export function PrototypeForm({ initial, photo, onSave, onCancel, failNextSave }: {
  initial: ClientFormValues | null; photo: ReactNode; onCancel: () => void
  onSave: (values: ClientFormValues) => void; failNextSave: { current: boolean }
}) {
  const form = useClientForm()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const mounted = useRef(true)
  useEffect(() => {
    if (initial) form.setValues(initial)
    else form.setFieldValue('branchId', 'north')
    return () => { mounted.current = false }
  }, [])
  async function save(values: ClientFormValues) {
    const errors = validateClientForm(values)
    if (Object.keys(errors).length) {
      form.setErrors(errors)
      setError('Проверьте выделенные поля.')
      return
    }
    setBusy(true)
    await new Promise(resolve => setTimeout(resolve, 350))
    if (!mounted.current) return
    setBusy(false)
    if (failNextSave.current) {
      failNextSave.current = false
      setError('Не удалось сохранить карточку. Данные остались в форме. Повторите сохранение.')
      requestAnimationFrame(() => document.querySelector<HTMLElement>('form [role=alert]')?.scrollIntoView({block:'center'}))
      return
    }
    onSave({ ...values, contacts: normalizeContacts(values.contacts) })
  }
  return <div className="sheet form-sheet" data-contacts={form.values.contacts.length}>
    {initial && <div className="edit-photo">{photo}</div>}
    <ClientForm form={form} formError={error} branchOptions={branches} groupOptions={groups} lockBranch={!!initial}
      cancelAction={{ label: 'Отмена', onClick: onCancel }}
      photoSection={initial ? undefined : <small>Фотографию можно добавить после сохранения клиента.</small>}
      onSubmit={save} submitLabel={initial ? 'Сохранить изменения' : 'Создать клиента'} submitting={busy}/>
  </div>
}
