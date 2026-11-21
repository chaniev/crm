
import { Fragment, type ReactNode } from 'react'
import { ActionIcon, Alert, Button, Group, MultiSelect, Paper, Select, SimpleGrid, Stack, Text, Textarea, TextInput } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { type UseFormReturnType } from '@mantine/form'
import { IconAlertCircle, IconDeviceFloppy, IconPlus, IconTrash } from '@tabler/icons-react'
import type { Branch, TrainingGroupListItem } from '../../lib/api'
import { StickyFormActions } from '../shared/ux'
import {
  createEmptyContact,
  maxContacts,
  type ClientFormValues,
} from './ClientManagement.form'
import {
  formatBranchOptionLabel,
  formatGroupOptionLabel,
} from './ClientManagement.formatting'
import { fe6ClientProfileText } from '../../resources/fe-6-client-profile'
import { getClientAgeDisplayValue } from './clientBirthDate'
import './ClientEditors.css'


type ClientFormProps = {
  form: UseFormReturnType<ClientFormValues>
  formError: string | null
  branchOptions?: Branch[]
  groupOptions?: TrainingGroupListItem[]
  lockBranch?: boolean
  cancelAction: { label: string; onClick: () => void } | null
  profile?: { photo: ReactNode; branchName: string; businessDate: string }
  photoSection?: ReactNode
  onSubmit: (values: ClientFormValues) => Promise<void>
  submitLabel: string
  submitting: boolean
}

export function ClientForm({
  form,
  formError,
  branchOptions = [],
  groupOptions = [],
  profile,
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

  const phoneLayout = useMediaQuery('(max-width: 37.49em), (max-width: 62em) and (max-height: 30em) and (pointer: coarse)',
    undefined, { getInitialValueInEffect: false })
  const names = (
    <>
      <TextInput
        label={fe6ClientProfileText.clientForm_label_353eafa3}
        placeholder={fe6ClientProfileText.clientForm_placeholder_37f3ddd4}
        autoComplete="family-name"
        {...form.getInputProps('lastName')}
      />
      <TextInput
        label={fe6ClientProfileText.clientForm_label_1da7e937}
        placeholder={fe6ClientProfileText.clientForm_placeholder_cc078195}
        autoComplete="given-name"
        {...form.getInputProps('firstName')}
      />
      <TextInput
        label={fe6ClientProfileText.clientForm_label_e1739d0a}
        placeholder={fe6ClientProfileText.clientForm_placeholder_52028dbd}
        autoComplete="additional-name"
        {...form.getInputProps('middleName')}
      />
    </>
  )
  const birthDate = (
    <TextInput
      className="client-editor-birth"
      label={fe6ClientProfileText.clientForm_label_1ae72066}
      type="date"
      description={profile && form.values.birthDate ? getClientAgeDisplayValue(form.values.birthDate, profile.businessDate) : undefined}
      {...form.getInputProps('birthDate')}
    />
  )
  const profileNames = <Fragment key="fields">
    <Stack className="client-editor-names" gap="xs">{names}</Stack>
    {birthDate}
  </Fragment>
  const portrait = <Fragment key="photo">{profile?.photo}</Fragment>

  return (
    <form
      onSubmit={form.onSubmit((values) =>
        void onSubmit({
          ...values,
          branchId: values.branchId || selectedBranchId,
        }),
      )}
    >
      <fieldset className={profile ? 'client-editor-fieldset client-editor-fieldset--profile' : 'client-editor-fieldset'} disabled={submitting}>
        <Stack gap="lg">
          {formError ? (
            <Alert
              color="red" role="alert"
              icon={<IconAlertCircle size={18} />}
              title={fe6ClientProfileText.clientForm_title_09e1875e}
              variant="light"
            >
              {formError}
            </Alert>
          ) : null}

          <Stack gap="md">
            {profile ? (
              <div className={phoneLayout ? 'client-editor-identity client-editor-identity--phone' : 'client-editor-identity'}>
                {phoneLayout ? [portrait, profileNames] : [profileNames, portrait]}
              </div>
            ) : <SimpleGrid cols={{ base: 1, md: 3 }}>{names}</SimpleGrid>}

            <SimpleGrid cols={{ base: 1, md: 3 }}>
              <TextInput
                label={fe6ClientProfileText.clientForm_label_822f9fd9}
                placeholder={fe6ClientProfileText.clientForm_placeholder_29def5ac}
                {...form.getInputProps('phone')}
              />

              <TextInput
                label={fe6ClientProfileText.telegramContact}
                placeholder="@username"
                autoCapitalize="none" autoCorrect="off" spellCheck={false}
                {...form.getInputProps('telegramContactUsername')}
              />
              {profile ? (
                <TextInput label={fe6ClientProfileText.clientForm_label_2f17c4d2} readOnly value={profile.branchName} />
              ) : (
                <Select
                  allowDeselect={false}
                  data={branchOptions.map((branch) => ({
                    value: branch.id,
                    label: formatBranchOptionLabel(branch),
                    disabled: branch.isArchived,
                  }))}
                  disabled={lockBranch}
                  label={fe6ClientProfileText.clientForm_label_2f17c4d2}
                  onChange={updateBranch}
                  placeholder={fe6ClientProfileText.clientForm_placeholder_4c5ee5d8}
                  searchable
                  value={selectedBranchId || null}
                  error={form.errors.branchId}
                />
              )}
            </SimpleGrid>
            {!profile && (
              <SimpleGrid cols={{ base: 1, md: 2 }}>
                <MultiSelect
                  data={filteredGroupOptions.map((group) => ({
                    value: group.id,
                    label: formatGroupOptionLabel(group),
                  }))}
                  disabled={!selectedBranchId}
                  label={fe6ClientProfileText.clientForm_label_ab308eef}
                  placeholder={
                    selectedBranchId
                      ? fe6ClientProfileText.clientForm_string_3d8d006f
                      : fe6ClientProfileText.clientForm_string_74f8ad03
                  }
                  searchable
                  {...form.getInputProps('groupIds')}
                />
                {birthDate}
              </SimpleGrid>
            )}

            <Textarea
              autosize
              label={fe6ClientProfileText.clientForm_label_6d7987c1}
              minRows={4}
              placeholder={fe6ClientProfileText.clientForm_placeholder_0e86ea4c}
              {...form.getInputProps('notes')}
            />
            {photoSection}
          </Stack>

          <section className="client-form-contacts">
            <Stack gap="md">
              <Group justify="space-between" wrap="wrap">
                <Button
                  disabled={form.values.contacts.length >= maxContacts}
                  leftSection={<IconPlus size={18} />}
                  onClick={addContact}
                  type="button"
                  variant="light"
                >
                  {fe6ClientProfileText.clientForm_jsxText_63492f28}</Button>
              </Group>

              {form.values.contacts.length > 0 && (
                <Stack gap="sm">
                  {form.values.contacts.map((_, index) => (
                    <Paper className="list-row-card" key={index} radius="8px" withBorder>
                      <Stack gap="md">
                        <Group justify="space-between" wrap="wrap">
                          <Text fw={700}>{fe6ClientProfileText.clientForm_jsxText_2c73c938}{index + 1}</Text>
                          <ActionIcon
                            aria-label={fe6ClientProfileText.clientForm_template_8b452ad2(index + 1)}
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
                            label={fe6ClientProfileText.clientForm_label_1a4f2dd4}
                            placeholder={fe6ClientProfileText.clientForm_placeholder_a3f088c6}
                            {...form.getInputProps(`contacts.${index}.type`)}
                          />
                          <TextInput
                            label={fe6ClientProfileText.clientForm_label_3ab1fb44}
                            placeholder={fe6ClientProfileText.clientForm_placeholder_e23f3a45}
                            {...form.getInputProps(`contacts.${index}.fullName`)}
                          />
                          <TextInput
                            label={fe6ClientProfileText.clientForm_label_a49c980a}
                            placeholder={fe6ClientProfileText.clientForm_placeholder_59073e3a}
                            {...form.getInputProps(`contacts.${index}.phone`)}
                          />
                        </SimpleGrid>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Stack>
          </section>

          <StickyFormActions
            secondaryAction={cancelAction ? (
              <Button onClick={cancelAction.onClick} type="button" variant="subtle">
                {cancelAction.label}
              </Button>
            ) : undefined}
            primaryAction={<Button
              leftSection={<IconDeviceFloppy size={18} />}
              disabled={Boolean(profile) && !form.isDirty()}
              loading={submitting}
              type="submit"
            >
              {submitLabel}
            </Button>}
          />
        </Stack>
      </fieldset>
    </form>
  )
}
