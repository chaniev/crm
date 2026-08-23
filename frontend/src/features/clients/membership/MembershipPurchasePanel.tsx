import { useEffect, useState } from 'react'
import { Alert, Button, Paper, SimpleGrid, Stack, Text, Textarea, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'

import {
  ApiError,
  applyFieldErrors,
  getEligibleMembershipCatalogItems,
  type MembershipCatalogItem,
} from '../../../lib/api'
import { ResponsiveButtonGroup } from '../../shared/ux'
import {
  buildMembershipSalePricingPayload,
  validateMembershipSalePricing,
} from '../MembershipSalePricing'
import { MembershipSalePricingFields } from '../MembershipSalePricingFields'
import { pickPricingFieldErrors } from '../ClientManagement.formatting'
import type { MembershipActionSubmission } from '../ClientManagement.types'
import { MembershipSaleConfirmationModal, PaymentDateInput } from '../ClientSharedInfo'
import {
  createMembershipPurchaseInitialValues,
  type MembershipPurchaseFormValues,
} from './membershipForms'
import { useMembershipSubmissionKey } from './useMembershipSubmissionKey'

type MembershipPurchasePanelProps = {
  branchId: string
  businessDate: string
  pending: boolean
  onCancel: () => void
  onSubmit: (submission: MembershipActionSubmission) => Promise<void>
}

export function MembershipPurchasePanel({
  branchId,
  businessDate,
  pending,
  onCancel,
  onSubmit,
}: MembershipPurchasePanelProps) {
  const [items, setItems] = useState<MembershipCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmationOpened, setConfirmationOpened] = useState(false)
  const getSubmissionKey = useMembershipSubmissionKey()
  const form = useForm<MembershipPurchaseFormValues>({
    initialValues: createMembershipPurchaseInitialValues(businessDate),
  })
  const selected = items.find(
    (item) => item.id === form.values.membershipCatalogItemId,
  )

  useEffect(() => {
    const controller = new AbortController()
    void getEligibleMembershipCatalogItems(branchId, controller.signal)
      .then(setItems)
      .catch((error) =>
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить абонементы.',
        ),
      )
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [branchId])

  function requestConfirmation() {
    setFormError(null)
    const errors: Record<string, string> = {
      ...validateMembershipSalePricing(form.values),
    }
    const needsValidity =
      form.values.pricingMode === 'AmountOnly' ||
      (selected !== undefined && selected.behaviorKind !== 'SingleVisit')

    if (needsValidity && !form.values.validFrom) {
      errors.validFrom = 'Укажите начало срока.'
    }
    if (needsValidity && !form.values.validTo) {
      errors.validTo = 'Укажите окончание срока.'
    }
    if (
      selected?.behaviorKind === 'Professional' &&
      !form.values.professionalComment.trim()
    ) {
      errors.professionalComment = 'Укажите комментарий.'
    }
    if (!form.values.paymentDate) {
      errors.paymentDate = 'Укажите дату оплаты.'
    }
    if (Object.keys(errors).length > 0) {
      form.setErrors(errors)
      return
    }

    setConfirmationOpened(true)
  }

  async function confirmPurchase() {
    setConfirmationOpened(false)
    setFormError(null)

    try {
      const payload = {
        ...buildMembershipSalePricingPayload(form.values),
        validFrom:
          selected?.behaviorKind === 'SingleVisit'
            ? undefined
            : form.values.validFrom || undefined,
        validTo:
          selected?.behaviorKind === 'SingleVisit'
            ? undefined
            : form.values.validTo || undefined,
        paymentDate: form.values.paymentDate,
        ...(selected?.behaviorKind === 'Professional'
          ? { professionalComment: form.values.professionalComment.trim() }
          : {}),
      }
      await onSubmit({
        kind: 'purchase',
        payload,
        idempotencyKey: getSubmissionKey('purchase', payload),
      })
    } catch (error) {
      if (error instanceof ApiError) {
        form.setErrors(applyFieldErrors(error.fieldErrors))
        setFormError(error.message)
      }
    }
  }

  const needsValidity =
    form.values.pricingMode === 'AmountOnly' ||
    (selected !== undefined && selected.behaviorKind !== 'SingleVisit')

  return (
    <Paper className="hint-card" radius="8px" withBorder>
      <MembershipSaleConfirmationModal
        catalogItem={selected}
        onClose={() => setConfirmationOpened(false)}
        onConfirm={() => void confirmPurchase()}
        opened={confirmationOpened}
        pending={pending}
        values={form.values}
      />
      <form noValidate onSubmit={form.onSubmit(requestConfirmation)}>
        <Stack gap="md">
          <div>
            <Text fw={700}>Оформить новый абонемент</Text>
            <Text c="dimmed" size="sm">
              Выберите способ расчёта и подтвердите фактическую сумму этой продажи.
            </Text>
          </div>
          {loadError ? <Alert color="red">{loadError}</Alert> : null}
          {formError ? <Alert color="red">{formError}</Alert> : null}
          <MembershipSalePricingFields
            catalogItems={items}
            errors={pickPricingFieldErrors(form.errors)}
            loading={loading}
            onChange={(pricingValues) => {
              form.setValues({ ...form.values, ...pricingValues })
              form.clearFieldError('pricingMode')
              form.clearFieldError('membershipCatalogItemId')
              form.clearFieldError('manualSaleAmount')
            }}
            values={form.values}
          />
          {needsValidity ? (
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <TextInput
                label="Действует с"
                type="date"
                {...form.getInputProps('validFrom')}
              />
              <TextInput
                label="Действует по"
                type="date"
                {...form.getInputProps('validTo')}
              />
            </SimpleGrid>
          ) : null}
          {selected?.behaviorKind === 'Professional' ? (
            <Textarea
              label="Комментарий к профессиональному абонементу"
              {...form.getInputProps('professionalComment')}
            />
          ) : null}
          <PaymentDateInput
            error={form.errors.paymentDate}
            max={businessDate}
            onChange={(value) => form.setFieldValue('paymentDate', value)}
            value={form.values.paymentDate}
          />
          <ResponsiveButtonGroup justify="space-between">
            <Button onClick={onCancel} type="button" variant="subtle">
              Отменить
            </Button>
            <Button loading={pending} type="submit">
              Оформить абонемент
            </Button>
          </ResponsiveButtonGroup>
        </Stack>
      </form>
    </Paper>
  )
}
