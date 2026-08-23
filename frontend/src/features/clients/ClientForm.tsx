
import type { ReactNode } from 'react'
import { ActionIcon, Alert, Button, Group, MultiSelect, Paper, Select, SimpleGrid, Stack, Text, Textarea, TextInput } from '@mantine/core'
import { type UseFormReturnType } from '@mantine/form'
import { IconAlertCircle, IconDeviceFloppy, IconPlus, IconTrash } from '@tabler/icons-react'
import type { Branch, TrainingGroupListItem } from '../../lib/api'
import { ResponsiveButtonGroup } from '../shared/ux'
import {
  createEmptyContact,
  maxContacts,
  type ClientFormValues,
} from './ClientManagement.form'
import {
  formatBranchOptionLabel,
  formatGroupOptionLabel,
} from './ClientManagement.formatting'

type ClientFormProps = {
  form: UseFormReturnType<ClientFormValues>
  formError: string | null
  branchOptions: Branch[]
  groupOptions: TrainingGroupListItem[]
  lockBranch?: boolean
  cancelAction: { label: string; onClick: () => void } | null
  photoSection?: ReactNode
  onSubmit: (values: ClientFormValues) => Promise<void>
  submitLabel: string
  submitting: boolean
}

export function ClientForm({
  form,
  formError,
  branchOptions,
  groupOptions,
  lockBranch = false,
  cancelAction,
  photoSection,
  onSubmit,
  submitLabel,
  submitting,
}: ClientFormProps) {
  const selectedBranchId =
    form.values.branchId ||
    branchOptions.find((branch) => !branch.isArchived)?.id ||
    ''
  const filteredGroupOptions = selectedBranchId
    ? groupOptions.filter((group) => group.branchId === selectedBranchId)
    : []

  function addContact() {
    if (form.values.contacts.length >= maxContacts) {
      return
    }

    form.setFieldValue('contacts', [...form.values.contacts, createEmptyContact()])
  }

  function removeContact(contactIndex: number) {
    form.setFieldValue(
      'contacts',
      form.values.contacts.filter((_, index) => index !== contactIndex),
    )
  }

  function updateBranch(branchId: string | null) {
    const nextBranchId = branchId ?? ''
    const nextAllowedGroupIds = new Set(
      groupOptions
        .filter((group) => group.branchId === nextBranchId)
        .map((group) => group.id),
    )

    form.setFieldValue('branchId', nextBranchId)
    form.setFieldValue(
      'groupIds',
      form.values.groupIds.filter((groupId) => nextAllowedGroupIds.has(groupId)),
    )
  }

  return (
    <form
      onSubmit={form.onSubmit((values) =>
        void onSubmit({
          ...values,
          branchId: values.branchId || selectedBranchId,
        }),
      )}
    >
      <Stack gap="lg">
        {formError ? (
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            title="Сохранение не выполнено"
            variant="light"
          >
            {formError}
          </Alert>
        ) : null}

        <div className="client-edit-grid">
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, md: 3 }}>
              <TextInput
                label="Фамилия"
                placeholder="Иванов"
                {...form.getInputProps('lastName')}
              />
              <TextInput
                label="Имя"
                placeholder="Иван"
                {...form.getInputProps('firstName')}
              />
              <TextInput
                label="Отчество"
                placeholder="Иванович"
                {...form.getInputProps('middleName')}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <TextInput
                label="Телефон"
                placeholder="+7(999) 000-00-00"
                {...form.getInputProps('phone')}
              />

              <Select
                allowDeselect={false}
                data={branchOptions.map((branch) => ({
                  value: branch.id,
                  label: formatBranchOptionLabel(branch),
                  disabled: branch.isArchived,
                }))}
                disabled={lockBranch}
                label="Филиал"
                onChange={updateBranch}
                placeholder="Выберите филиал"
                searchable
                value={selectedBranchId || null}
                error={form.errors.branchId}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <MultiSelect
                data={filteredGroupOptions.map((group) => ({
                  value: group.id,
                  label: formatGroupOptionLabel(group),
                }))}
                disabled={!selectedBranchId}
                label="Группы клиента"
                placeholder={
                  selectedBranchId
                    ? 'Выберите группы'
                    : 'Сначала выберите филиал'
                }
                searchable
                {...form.getInputProps('groupIds')}
              />
              <TextInput
                label="Дата рождения"
                type="date"
                {...form.getInputProps('birthDate')}
              />
            </SimpleGrid>

            <Textarea
              autosize
              label="Рабочая заметка"
              minRows={4}
              placeholder="Например: предпочитает связь после 18:00, важные детали по посещениям или оплате."
              {...form.getInputProps('notes')}
            />
          </Stack>

          <aside className="client-edit-rail">{photoSection}</aside>
        </div>

        <Paper className="hint-card" radius="8px" withBorder>
          <Stack gap="md">
            <Group justify="space-between" wrap="wrap">
              <div>
                <Text fw={700}>Контактные лица</Text>
                <Text c="dimmed" size="sm">
                  Можно указать до двух контактов. Пустые строки не будут сохранены.
                </Text>
              </div>

              <Button
                disabled={form.values.contacts.length >= maxContacts}
                leftSection={<IconPlus size={18} />}
                onClick={addContact}
                type="button"
                variant="light"
              >
                Добавить контакт
              </Button>
            </Group>

            {form.values.contacts.length === 0 ? (
              <Text c="dimmed" size="sm">
                Контактные лица пока не добавлены.
              </Text>
            ) : (
              <Stack gap="sm">
                {form.values.contacts.map((_, index) => (
                  <Paper className="list-row-card" key={index} radius="8px" withBorder>
                    <Stack gap="md">
                      <Group justify="space-between" wrap="wrap">
                        <Text fw={700}>Контакт #{index + 1}</Text>
                        <ActionIcon
                          aria-label={`Удалить контакт ${index + 1}`}
                          color="red"
                          onClick={() => removeContact(index)}
                          type="button"
                          variant="light"
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>

                      <SimpleGrid cols={{ base: 1, md: 3 }}>
                        <TextInput
                          label="Тип контакта"
                          placeholder="Мама / Папа / Другой"
                          {...form.getInputProps(`contacts.${index}.type`)}
                        />
                        <TextInput
                          label="ФИО контактного лица"
                          placeholder="Анна Иванова"
                          {...form.getInputProps(`contacts.${index}.fullName`)}
                        />
                        <TextInput
                          label="Телефон контакта"
                          placeholder="+7(999) 000-00-01"
                          {...form.getInputProps(`contacts.${index}.phone`)}
                        />
                      </SimpleGrid>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Stack>
        </Paper>

        <ResponsiveButtonGroup justify={cancelAction ? 'space-between' : 'flex-end'}>
          {cancelAction ? (
            <Button onClick={cancelAction.onClick} type="button" variant="subtle">
              {cancelAction.label}
            </Button>
          ) : null}
          <Button
            leftSection={<IconDeviceFloppy size={18} />}
            loading={submitting}
            type="submit"
          >
            {submitLabel}
          </Button>
        </ResponsiveButtonGroup>
      </Stack>
    </form>
  )
}
