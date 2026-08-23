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
      form.setErrors({ branchId: 'Выберите целевой филиал.' })
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
      title="Перевод клиента"
      withCloseButton={!submitting}
    >
      <form noValidate onSubmit={form.onSubmit(submitAssignment)}>
        <Stack gap="md">
          <Paper className="hint-card" radius="8px" withBorder>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <InfoItem
                label="Текущий филиал"
                value={client.branchName || 'Не указан'}
              />
              <InfoItem
                label="Текущая группа"
                value={currentGroup?.name ?? 'Без группы'}
              />
            </SimpleGrid>
          </Paper>

          {formError ? (
            <Alert
              color="red"
              icon={<IconAlertCircle size={18} />}
              title="Перевод не выполнен"
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
            label="Целевой филиал"
            onChange={updateBranch}
            placeholder={loadingOptions ? 'Загружаем филиалы' : 'Выберите филиал'}
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
            label="Новая группа"
            onChange={(groupId) => form.setFieldValue('groupId', groupId ?? '')}
            placeholder={
              selectedBranchId
                ? 'Можно оставить без группы'
                : 'Сначала выберите филиал'
            }
            searchable
            value={form.values.groupId || null}
            error={form.errors.groupId}
          />

          <ResponsiveButtonGroup justify="space-between">
            <Button disabled={submitting} onClick={onClose} type="button" variant="subtle">
              Отменить
            </Button>
            <Button
              leftSection={<IconGitBranch size={18} />}
              loading={submitting || loadingOptions}
              type="submit"
            >
              Перевести клиента
            </Button>
          </ResponsiveButtonGroup>
        </Stack>
      </form>
    </Modal>
  )
}
