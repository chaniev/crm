import { useForm } from '@mantine/form'
import type { ClientDetails, UpsertClientRequest } from '../../lib/api'

export const maxContacts = 2

export const clientFieldErrorAliases = {
  fullName: 'lastName',
} as const

export type ClientFormContact = {
  type: string
  fullName: string
  phone: string
}

export type ClientFormValues = {
  lastName: string
  firstName: string
  middleName: string
  phone: string
  groupIds: string[]
  contacts: ClientFormContact[]
}

export function useClientForm() {
  return useForm<ClientFormValues>({
    initialValues: {
      lastName: '',
      firstName: '',
      middleName: '',
      phone: '',
      groupIds: [],
      contacts: [],
    },
    validate: {
      phone: (value) => (value.trim() ? null : 'Укажите телефон клиента.'),
      lastName: (_, values) =>
        hasClientName(values)
          ? null
          : 'Укажите хотя бы одно из полей ФИО клиента.',
    },
  })
}

export function validateClientForm(values: ClientFormValues) {
  const errors: Record<string, string> = {}
  const normalizedContacts = normalizeContacts(values.contacts)

  if (!values.phone.trim()) {
    errors.phone = 'Укажите телефон клиента.'
  }

  if (!hasClientName(values)) {
    errors.lastName = 'Укажите хотя бы одно из полей ФИО клиента.'
  }

  if (normalizedContacts.length > maxContacts) {
    errors.contacts = 'Можно сохранить не более двух контактных лиц.'
  }

  values.contacts.forEach((contact, index) => {
    const trimmedContact = {
      type: contact.type.trim(),
      fullName: contact.fullName.trim(),
      phone: contact.phone.trim(),
    }

    if (
      !trimmedContact.type &&
      !trimmedContact.fullName &&
      !trimmedContact.phone
    ) {
      return
    }

    if (!trimmedContact.type) {
      errors[`contacts.${index}.type`] = 'Укажите тип контактного лица.'
    }

    if (!trimmedContact.fullName) {
      errors[`contacts.${index}.fullName`] =
        'Укажите ФИО контактного лица.'
    }

    if (!trimmedContact.phone) {
      errors[`contacts.${index}.phone`] = 'Укажите телефон контактного лица.'
    }
  })

  return errors
}

export function toClientFormValues(client: ClientDetails): ClientFormValues {
  return {
    lastName: client.lastName,
    firstName: client.firstName,
    middleName: client.middleName,
    phone: client.phone,
    groupIds: client.groupIds,
    contacts:
      client.contacts.length > 0
        ? client.contacts.map((contact) => ({
            type: contact.type,
            fullName: contact.fullName,
            phone: contact.phone,
          }))
        : [],
  }
}

export function toUpsertClientPayload(
  values: ClientFormValues,
): UpsertClientRequest {
  return {
    lastName: values.lastName.trim() || undefined,
    firstName: values.firstName.trim() || undefined,
    middleName: values.middleName.trim() || undefined,
    phone: values.phone.trim(),
    contacts: normalizeContacts(values.contacts),
    groupIds: [...values.groupIds].sort(),
  }
}

export function normalizeContacts(contacts: ClientFormContact[]) {
  return contacts
    .map((contact) => ({
      type: contact.type.trim(),
      fullName: contact.fullName.trim(),
      phone: contact.phone.trim(),
    }))
    .filter((contact) => contact.type || contact.fullName || contact.phone)
}

export function createEmptyContact(): ClientFormContact {
  return {
    type: '',
    fullName: '',
    phone: '',
  }
}

export function buildDraftClientName(values: ClientFormValues) {
  const fullName = [values.lastName, values.firstName, values.middleName]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' ')

  return fullName || 'нового клиента'
}

function hasClientName(
  values: Pick<ClientFormValues, 'lastName' | 'firstName' | 'middleName'>,
) {
  return [values.lastName, values.firstName, values.middleName].some((value) =>
    value.trim(),
  )
}
