
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
import { fe6ClientProfileText } from '../../resources/fe-6-client-profile'


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
      label={fe6ClientProfileText.clientSharedInfo_label_6611d56d}
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
      title={fe6ClientProfileText.clientSharedInfo_title_d1df3de6}
      withCloseButton={!pending}
    >
      <Stack gap="lg">
        <Text c="dimmed" size="sm">
          {fe6ClientProfileText.clientSharedInfo_jsxText_5e85c193}</Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <InfoItem
            label={fe6ClientProfileText.clientSharedInfo_label_1413919e}
            value={
              values.pricingMode
                ? membershipSalePricingModeLabels[values.pricingMode]
                : fe6ClientProfileText.clientSharedInfo_string_d77dfdcd
            }
          />
          <InfoItem
            label={fe6ClientProfileText.clientSharedInfo_label_625ac7ac}
            value={
              typeof actualAmount === 'number' && Number.isFinite(actualAmount)
                ? formatCurrencyValue(actualAmount)
                : fe6ClientProfileText.clientSharedInfo_string_f16cbd32
            }
          />
          <InfoItem
            label={fe6ClientProfileText.clientSharedInfo_label_6611d56d}
            value={formatDateValue(values.paymentDate)}
          />
        </SimpleGrid>
        {targetGroupLabels.length > 0 ? (
          <Stack gap="xs">
            <Text c="dimmed" fw={600} size="xs">
              {fe6ClientProfileText.clientSharedInfo_jsxText_bb3893c5}</Text>
            {targetGroupLabels.map((label, index) => (
              <Text key={`${label}-${index}`} size="sm">
                {index + 1} {index === 0 ? fe6ClientProfileText.clientSharedInfo_string_68f7b035 : ''}{label}
              </Text>
            ))}
          </Stack>
        ) : null}
        <ResponsiveButtonGroup justify="flex-end">
          <Button disabled={pending} onClick={onClose} variant="subtle">
            {fe6ClientProfileText.clientSharedInfo_jsxText_7c47f729}</Button>
          <Button loading={pending} onClick={onConfirm}>
            {fe6ClientProfileText.clientSharedInfo_jsxText_cc77c58c}</Button>
        </ResponsiveButtonGroup>
      </Stack>
    </Modal>
  )
}
