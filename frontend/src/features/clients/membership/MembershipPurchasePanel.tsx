import { useEffect, useState } from 'react'
import { Alert, Button, Paper, SimpleGrid, Stack, Text, Textarea, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'

import {
  ApiError,
  applyFieldErrors,
  getEligibleMembershipCatalogItems,
  type MembershipCatalogItem,
  type MembershipBehaviorKind,
  type TrainingGroupListItem,
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
  validateTargetGroups,
} from './membershipForms'
import { useClientActionSubmissionKey } from '../useClientActionSubmissionKey'
import { MembershipTargetGroupsField } from './MembershipTargetGroupsField'
import {
  isMembershipTargetLoadAbort,
  loadAllActiveMembershipTargetGroups,
  pickTargetGroupError,
} from './membershipTargetGroups'

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
  const [groups, setGroups] = useState<TrainingGroupListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmationOpened, setConfirmationOpened] = useState(false)
  const getSubmissionKey = useClientActionSubmissionKey()
  const form = useForm<MembershipPurchaseFormValues>({
    initialValues: createMembershipPurchaseInitialValues(businessDate),
  })
  const selected = items.find(
    (item) => item.id === form.values.membershipCatalogItemId,
  )
  const targetBehaviorKind: MembershipBehaviorKind =
    selected?.behaviorKind ?? 'Term'
  const availableGroups = groups.filter((group) => group.branchId === branchId)
  const selectedTargetLabels = form.values.targetGroupIds.map(
    (groupId) => availableGroups.find((group) => group.id === groupId)?.name ?? groupId,
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

  useEffect(() => {
    const controller = new AbortController()
    void loadAllActiveMembershipTargetGroups(controller.signal)
      .then(setGroups)
      .catch((error) => {
        if (!isMembershipTargetLoadAbort(error)) {
          setLoadError(
            error instanceof Error ? error.message : 'Не удалось загрузить группы.',
          )
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setGroupsLoading(false)
      })
    return () => controller.abort()
  }, [])

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
    validateTargetGroups(form.values.targetGroupIds, targetBehaviorKind, errors)
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
        targetGroupIds: form.values.targetGroupIds,
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
        targetGroupLabels={selectedTargetLabels}
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
          <MembershipTargetGroupsField
            behaviorKind={targetBehaviorKind}
            error={pickTargetGroupError(form.errors)}
            groups={availableGroups}
            loading={groupsLoading}
            onChange={(targetGroupIds) => {
              form.setFieldValue('targetGroupIds', targetGroupIds)
              form.clearFieldError('targetGroupIds')
            }}
            targetGroupIds={form.values.targetGroupIds}
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
