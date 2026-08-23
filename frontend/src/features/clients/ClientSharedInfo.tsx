
import type { ReactNode } from 'react'
import { Button, Modal, Paper, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import type { MembershipCatalogItem } from '../../lib/api'
import { ResponsiveButtonGroup } from '../shared/ux'
import {
  membershipSalePricingModeLabels,
  type MembershipSalePricingValues,
} from './MembershipSalePricing'
import {
  formatCurrencyValue,
  formatDateValue,
} from './ClientManagement.formatting'

type InfoItemProps = {
  label: string
  value: string
}

export function InfoItem({
  label,
  value,
}: InfoItemProps) {
  return (
    <Paper className="hint-card" radius="8px" withBorder>
      <Stack gap={4}>
        <Text c="dimmed" fw={600} size="xs">
          {label}
        </Text>
        <Text fw={700}>{value}</Text>
      </Stack>
    </Paper>
  )
}

type PaymentDateInputProps = {
  value: string
  max: string
  error?: ReactNode
  onChange: (value: string) => void
}

export function PaymentDateInput({
  value,
  max,
  error,
  onChange,
}: PaymentDateInputProps) {
  return (
    <TextInput
      error={error}
      label="Дата оплаты"
      max={max}
      onChange={(event) => onChange(event.currentTarget.value)}
      required
      type="date"
      value={value}
      withAsterisk={false}
    />
  )
}

type MembershipSaleConfirmationModalProps = {
  catalogItem?: MembershipCatalogItem
  opened: boolean
  pending: boolean
  values: MembershipSalePricingValues & { paymentDate: string }
  targetGroupLabels?: string[]
  onClose: () => void
  onConfirm: () => void
}

export function MembershipSaleConfirmationModal({
  catalogItem,
  opened,
  pending,
  values,
  targetGroupLabels = [],
  onClose,
  onConfirm,
}: MembershipSaleConfirmationModalProps) {
  const actualAmount =
    values.pricingMode === 'Catalog'
      ? catalogItem?.price
      : Number(values.manualSaleAmount)

  return (
    <Modal
      centered
      onClose={onClose}
      opened={opened}
      radius="24px"
      title="Подтвердить новую продажу?"
      withCloseButton={!pending}
    >
      <Stack gap="lg">
        <Text c="dimmed" size="sm">
          Проверьте способ расчёта и фактическую сумму. Эти данные сохранятся
          в истории продажи.
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <InfoItem
            label="Способ расчёта"
            value={
              values.pricingMode
                ? membershipSalePricingModeLabels[values.pricingMode]
                : 'Не выбран'
            }
          />
          <InfoItem
            label="Фактическая сумма"
            value={
              typeof actualAmount === 'number' && Number.isFinite(actualAmount)
                ? formatCurrencyValue(actualAmount)
                : 'Не указана'
            }
          />
          <InfoItem
            label="Дата оплаты"
            value={formatDateValue(values.paymentDate)}
          />
        </SimpleGrid>
        {targetGroupLabels.length > 0 ? (
          <Stack gap="xs">
            <Text c="dimmed" fw={600} size="xs">
              Группы абонемента
            </Text>
            {targetGroupLabels.map((label, index) => (
              <Text key={`${label}-${index}`} size="sm">
                {index + 1} {index === 0 ? 'Отчётность · ' : ''}{label}
              </Text>
            ))}
          </Stack>
        ) : null}
        <ResponsiveButtonGroup justify="flex-end">
          <Button disabled={pending} onClick={onClose} variant="subtle">
            Отменить
          </Button>
          <Button loading={pending} onClick={onConfirm}>
            Подтвердить продажу
          </Button>
        </ResponsiveButtonGroup>
      </Stack>
    </Modal>
  )
}
