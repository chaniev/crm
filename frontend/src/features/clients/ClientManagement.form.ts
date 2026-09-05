import { useForm } from '@mantine/form'
import type { ClientDetails, UpsertClientRequest } from '../../lib/api'
import { fe6ClientProfileText } from '../../resources/fe-6-client-profile'


export const maxContacts = 2

export const clientFieldErrorAliases = {
  fullName: 'lastName',
  birthDate: 'birthDate',
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
  birthDate: string
  branchId: string
  notes: string
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
      birthDate: '',
      branchId: '',
      notes: '',
      groupIds: [],
      contacts: [],
    },
    validate: {
      phone: (value) => (value.trim() ? null : fe6ClientProfileText.clientManagementForm_string_13f09c7f),
      lastName: (_, values) =>
        hasClientName(values)
          ? null
          : fe6ClientProfileText.clientManagementForm_string_91e74fb3,
    },
  })
}

export function validateClientForm(values: ClientFormValues) {
  const errors: Record<string, string> = {}
  const normalizedContacts = normalizeContacts(values.contacts)

  if (!values.phone.trim()) {
    errors.phone = fe6ClientProfileText.clientManagementForm_string_13f09c7f
  }

  if (!hasClientName(values)) {
    errors.lastName = fe6ClientProfileText.clientManagementForm_string_91e74fb3
  }

  if (normalizedContacts.length > maxContacts) {
    errors.contacts = fe6ClientProfileText.clientManagementForm_string_acb35e79
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
      errors[`contacts.${index}.type`] = fe6ClientProfileText.clientManagementForm_string_f638f9f2
    }

    if (!trimmedContact.fullName) {
      errors[`contacts.${index}.fullName`] =
        fe6ClientProfileText.clientManagementForm_string_259085f9
    }

    if (!trimmedContact.phone) {
      errors[`contacts.${index}.phone`] = fe6ClientProfileText.clientManagementForm_string_735598db
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
    birthDate: client.birthDate ?? '',
    branchId: client.branchId,
    notes: client.notes,
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
    birthDate: values.birthDate || null,
    branchId: values.branchId || undefined,
    notes: values.notes.trim(),
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

  return fullName || fe6ClientProfileText.clientManagementForm_string_db15274f
}

function hasClientName(
  values: Pick<ClientFormValues, 'lastName' | 'firstName' | 'middleName'>,
) {
  return [values.lastName, values.firstName, values.middleName].some((value) =>
    value.trim(),
  )
}
