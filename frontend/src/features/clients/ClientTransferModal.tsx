
import { useEffect, useState } from 'react'
import { Alert, Button, Modal, Paper, Select, SimpleGrid, Stack, TextInput, Textarea } from '@mantine/core'
import { type UseFormReturnType } from '@mantine/form'
import { IconAlertCircle, IconGitBranch } from '@tabler/icons-react'
import {
  getEligibleMembershipCatalogItems,
  type Branch,
  type ClientDetails,
  type MembershipCatalogItem,
  type TrainingGroupListItem,
} from '../../lib/api'
import { ResponsiveButtonGroup } from '../shared/ux'
import {
  createEmptyMembershipSalePricingValues,
  validateMembershipSalePricing,
} from './MembershipSalePricing'
import { MembershipSalePricingFields } from './MembershipSalePricingFields'
import type { ClientTransferFormValues } from './ClientManagement.types'
import {
  formatBranchOptionLabel,
  formatGroupOptionLabel,
  pickPricingFieldErrors,
} from './ClientManagement.formatting'
import {
  InfoItem,
  MembershipSaleConfirmationModal,
  PaymentDateInput,
} from './ClientSharedInfo'

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
  const [catalogItems, setCatalogItems] = useState<MembershipCatalogItem[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [confirmationOpened, setConfirmationOpened] = useState(false)
  const selectedBranchId = form.values.branchId
  const filteredGroupOptions = selectedBranchId
    ? groupOptions.filter((group) => group.branchId === selectedBranchId)
    : []
  const currentGroup = client.groups[0]
  const movesUnusedSingleVisit = client.currentMembership?.behaviorKind === 'SingleVisit' && !client.currentMembership.singleVisitUsed
  const selectedCatalogItem = catalogItems.find((item) => item.id === form.values.membershipCatalogItemId)

  useEffect(() => {
    if (!opened || !selectedBranchId || movesUnusedSingleVisit) return
    const controller = new AbortController()
    void getEligibleMembershipCatalogItems(selectedBranchId, controller.signal)
      .then(setCatalogItems)
      .catch(() => setCatalogItems([]))
      .finally(() => { if (!controller.signal.aborted) setCatalogLoading(false) })
    return () => controller.abort()
  }, [movesUnusedSingleVisit, opened, selectedBranchId])

  function updateBranch(branchId: string | null) {
    form.setFieldValue('branchId', branchId ?? '')
    form.setFieldValue('groupId', '')
    form.setValues({
      ...form.values,
      branchId: branchId ?? '',
      groupId: '',
      ...createEmptyMembershipSalePricingValues(),
    })
    setCatalogItems([])
    setCatalogLoading(Boolean(branchId))
  }

  function requestConfirmation(values: ClientTransferFormValues) {
    if (movesUnusedSingleVisit) {
      void onSubmit(values)
      return
    }

    const pricingErrors = validateMembershipSalePricing(values)
    const errors: Record<string, string> = { ...pricingErrors }
    if (!values.paymentDate) {
      errors.paymentDate = 'Укажите дату оплаты.'
    }
    if (Object.keys(errors).length > 0) {
      form.setErrors(errors)
      return
    }

    setConfirmationOpened(true)
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
      <MembershipSaleConfirmationModal
        catalogItem={selectedCatalogItem}
        onClose={() => setConfirmationOpened(false)}
        onConfirm={() => {
          setConfirmationOpened(false)
          void onSubmit(form.values)
        }}
        opened={confirmationOpened}
        pending={submitting}
        values={form.values}
      />

      <form noValidate onSubmit={form.onSubmit(requestConfirmation)}>
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

          {movesUnusedSingleVisit ? <Alert color="blue">Разовое посещение ещё не использовано. Оно будет перенесено без новой продажи.</Alert> : <>
            <MembershipSalePricingFields
              catalogItems={catalogItems}
              disabled={!selectedBranchId}
              errors={pickPricingFieldErrors(form.errors)}
              loading={catalogLoading}
              onChange={(pricingValues) => {
                form.setValues({ ...form.values, ...pricingValues })
                form.clearFieldError('pricingMode')
                form.clearFieldError('membershipCatalogItemId')
                form.clearFieldError('manualSaleAmount')
              }}
              values={form.values}
            />
            {form.values.pricingMode === 'AmountOnly' ||
            (selectedCatalogItem !== undefined &&
              selectedCatalogItem.behaviorKind !== 'SingleVisit') ? <SimpleGrid cols={{ base: 1, sm: 2 }}><TextInput label="Действует с" type="date" {...form.getInputProps('validFrom')}/><TextInput label="Действует по" type="date" {...form.getInputProps('validTo')}/></SimpleGrid> : null}
            {selectedCatalogItem?.behaviorKind === 'Professional' ? <Textarea label="Комментарий" {...form.getInputProps('professionalComment')}/> : null}
            <PaymentDateInput
              error={form.errors.paymentDate}
              max={client.businessDate}
              onChange={(value) => form.setFieldValue('paymentDate', value)}
              value={form.values.paymentDate}
            />
          </>}

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
