import {
  Paper,
  Radio,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import type {
  MembershipCatalogItem,
  MembershipSalePricingMode,
} from '../../lib/api'
import {
  membershipSalePricingModeLabels,
  type MembershipSalePricingFieldErrors,
  type MembershipSalePricingValues,
} from './MembershipSalePricing'
import { fe7ClientMembershipText } from '../../resources/fe-7-client-membership'


type MembershipSalePricingFieldsProps = {
  catalogItems: MembershipCatalogItem[]
  catalogLabel?: string
  disabled?: boolean
  errors?: MembershipSalePricingFieldErrors
  loading?: boolean
  values: MembershipSalePricingValues
  onChange: (values: MembershipSalePricingValues) => void
}

export function MembershipSalePricingFields({
  catalogItems,
  catalogLabel = fe7ClientMembershipText.membershipSalePricingFields_string_38cc78d4,
  disabled = false,
  errors = {},
  loading = false,
  values,
  onChange,
}: MembershipSalePricingFieldsProps) {
  const selectedCatalogItem = catalogItems.find(
    (item) => item.id === values.membershipCatalogItemId,
  )
  const needsCatalog =
    values.pricingMode === 'Catalog' ||
    values.pricingMode === 'CatalogOverride'
  const needsManualAmount =
    values.pricingMode === 'CatalogOverride' ||
    values.pricingMode === 'AmountOnly'

  function changeMode(mode: string) {
    onChange({
      pricingMode: mode as MembershipSalePricingMode,
      membershipCatalogItemId: '',
      manualSaleAmount: '',
    })
  }

  return (
    <Stack gap="md">
      <Radio.Group
        error={errors.pricingMode}
        label={fe7ClientMembershipText.membershipSalePricingFields_label_acf9468c}
        onChange={changeMode}
        value={values.pricingMode ?? ''}
      >
        <SimpleGrid cols={{ base: 1, sm: 3 }} mt="xs">
          {(
            Object.entries(membershipSalePricingModeLabels) as Array<
              [MembershipSalePricingMode, string]
            >
          ).map(([mode, label]) => (
            <Paper key={mode} p="sm" radius="md" withBorder>
              <Radio disabled={disabled} label={label} value={mode} />
            </Paper>
          ))}
        </SimpleGrid>
      </Radio.Group>

      {needsCatalog ? (
        <Select
          allowDeselect={false}
          data={catalogItems.map((item) => ({
            value: item.id,
            label: fe7ClientMembershipText.membershipSalePricingFields_label_7d7837d2(item.name, formatCurrencyValue(item.price)),
          }))}
          disabled={disabled || loading}
          error={errors.membershipCatalogItemId}
          label={catalogLabel}
          onChange={(membershipCatalogItemId) =>
            onChange({
              ...values,
              membershipCatalogItemId: membershipCatalogItemId ?? '',
              manualSaleAmount: '',
            })
          }
          placeholder={loading ? fe7ClientMembershipText.membershipSalePricingFields_string_ef27abbb : fe7ClientMembershipText.membershipSalePricingFields_string_cbcc2c45}
          searchable
          value={values.membershipCatalogItemId || null}
        />
      ) : null}

      {selectedCatalogItem ? (
        <Paper p="sm" radius="md" withBorder>
          <Text c="dimmed" fw={600} size="xs">
            {fe7ClientMembershipText.membershipSalePricingFields_jsxText_de5a7f2f}</Text>
          <Text fw={700}>{formatCurrencyValue(selectedCatalogItem.price)}</Text>
        </Paper>
      ) : null}

      {needsManualAmount ? (
        <TextInput
          description={
            values.pricingMode === 'AmountOnly'
              ? fe7ClientMembershipText.membershipSalePricingFields_string_6a823a40
              : fe7ClientMembershipText.membershipSalePricingFields_string_70431854
          }
          disabled={disabled}
          error={errors.manualSaleAmount}
          label={fe7ClientMembershipText.membershipSalePricingFields_label_ee4d70c4}
          min="1"
          onChange={(event) =>
            onChange({ ...values, manualSaleAmount: event.currentTarget.value })
          }
          step="1"
          type="number"
          value={values.manualSaleAmount}
        />
      ) : null}
    </Stack>
  )
}

function formatCurrencyValue(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value)
}
