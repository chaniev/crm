import { Alert, Button, Modal, Paper, Select, SimpleGrid, Stack } from '@mantine/core'
import { type UseFormReturnType } from '@mantine/form'
import { IconAlertCircle, IconGitBranch } from '@tabler/icons-react'
import {
  type Branch,
  type ClientDetails,
  type TrainingGroupListItem,
} from '../../lib/api'
import { ResponsiveButtonGroup } from '../shared/ux'
import type { ClientTransferFormValues } from './ClientManagement.types'
import {
  formatBranchOptionLabel,
  formatGroupOptionLabel,
} from './ClientManagement.formatting'
import { InfoItem } from './ClientSharedInfo'
import { fe6ClientProfileText } from '../../resources/fe-6-client-profile'


type ClientTransferModalProps = {
  branchOptions: Branch[]
  client: ClientDetails
  form: UseFormReturnType<ClientTransferFormValues>
  formError: string | null
  groupOptions: TrainingGroupListItem[]
  loadingOptions: boolean
  opened: boolean
  submitting: boolean
  onClose: () => void
  onSubmit: (values: ClientTransferFormValues) => Promise<void>
}

export function ClientTransferModal({
  branchOptions,
  client,
  form,
  formError,
  groupOptions,
  loadingOptions,
  opened,
  submitting,
  onClose,
  onSubmit,
}: ClientTransferModalProps) {
  const selectedBranchId = form.values.branchId
  const filteredGroupOptions = selectedBranchId
    ? groupOptions.filter((group) => group.branchId === selectedBranchId)
    : []
  const currentGroup = client.groups[0]

  function updateBranch(branchId: string | null) {
    form.setValues({
      ...form.values,
      branchId: branchId ?? '',
      groupId: '',
    })
  }

  function submitAssignment(values: ClientTransferFormValues) {
    if (!values.branchId) {
      form.setErrors({ branchId: fe6ClientProfileText.clientTransferModal_branchId_02733009 })
      return
    }
    void onSubmit(values)
  }

  return (
    <Modal
      centered
      onClose={onClose}
      opened={opened}
      radius="8px"
      title={fe6ClientProfileText.clientTransferModal_title_5df21aa1}
      withCloseButton={!submitting}
    >
      <form noValidate onSubmit={form.onSubmit(submitAssignment)}>
        <Stack gap="md">
          <Paper className="hint-card" radius="8px" withBorder>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <InfoItem
                label={fe6ClientProfileText.clientTransferModal_label_e054a7e5}
                value={client.branchName || fe6ClientProfileText.clientTransferModal_string_0d836c15}
              />
              <InfoItem
                label={fe6ClientProfileText.clientTransferModal_label_4ebcb19f}
                value={currentGroup?.name ?? fe6ClientProfileText.clientTransferModal_string_9ed5aecd}
              />
            </SimpleGrid>
          </Paper>

          {formError ? (
            <Alert
              color="red"
              icon={<IconAlertCircle size={18} />}
              title={fe6ClientProfileText.clientTransferModal_title_3451ed5f}
              variant="light"
            >
              {formError}
            </Alert>
          ) : null}

          <Select
            allowDeselect={false}
            data={branchOptions.map((branch) => ({
              value: branch.id,
              label: formatBranchOptionLabel(branch),
              disabled: branch.isArchived,
            }))}
            disabled={loadingOptions}
            label={fe6ClientProfileText.clientTransferModal_label_9caac9e2}
            onChange={updateBranch}
            placeholder={loadingOptions ? fe6ClientProfileText.clientTransferModal_string_00d475e1 : fe6ClientProfileText.clientTransferModal_string_4c5ee5d8}
            searchable
            value={form.values.branchId || null}
            error={form.errors.branchId}
          />

          <Select
            clearable
            data={filteredGroupOptions.map((group) => ({
              value: group.id,
              label: formatGroupOptionLabel(group),
              disabled: !group.isActive,
            }))}
            disabled={!selectedBranchId || loadingOptions}
            label={fe6ClientProfileText.clientTransferModal_label_c9fd9fc0}
            onChange={(groupId) => form.setFieldValue('groupId', groupId ?? '')}
            placeholder={
              selectedBranchId
                ? fe6ClientProfileText.clientTransferModal_string_49b5e8d1
                : fe6ClientProfileText.clientTransferModal_string_74f8ad03
            }
            searchable
            value={form.values.groupId || null}
            error={form.errors.groupId}
          />

          <ResponsiveButtonGroup justify="space-between">
            <Button disabled={submitting} onClick={onClose} type="button" variant="subtle">
              {fe6ClientProfileText.clientTransferModal_jsxText_7c47f729}</Button>
            <Button
              leftSection={<IconGitBranch size={18} />}
              loading={submitting || loadingOptions}
              type="submit"
            >
              {fe6ClientProfileText.clientTransferModal_jsxText_a8186ce3}</Button>
          </ResponsiveButtonGroup>
        </Stack>
      </form>
    </Modal>
  )
}
