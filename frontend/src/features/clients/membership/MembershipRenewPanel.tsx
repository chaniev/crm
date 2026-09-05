import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Group, Paper, SimpleGrid, Stack, Text, Textarea } from '@mantine/core'
import { useForm } from '@mantine/form'

import {
  ApiError,
  applyFieldErrors,
  getEligibleMembershipCatalogItems,
  type ClientMembership,
  type MembershipCatalogItem,
  type TrainingGroupListItem,
} from '../../../lib/api'
import { ResponsiveButtonGroup } from '../../shared/ux'
import {
  buildMembershipSalePricingPayload,
  validateMembershipSalePricing,
} from '../MembershipSalePricing'
import { MembershipSalePricingFields } from '../MembershipSalePricingFields'
import {
  formatCurrencyValue,
  formatExpirationValue,
  formatMembershipPricingProvenance,
  pickPricingFieldErrors,
} from '../ClientManagement.formatting'
import type {
  MembershipActionSubmission,
  MembershipRenewFormValues,
} from '../ClientManagement.types'
import { InfoItem, MembershipSaleConfirmationModal, PaymentDateInput } from '../ClientSharedInfo'
import { createMembershipRenewInitialValues, validateTargetGroups } from './membershipForms'
import { useClientActionSubmissionKey } from '../useClientActionSubmissionKey'
import { MembershipTargetGroupsField } from './MembershipTargetGroupsField'
import {
  isMembershipTargetLoadAbort,
  loadAllActiveMembershipTargetGroups,
  pickTargetGroupError,
} from './membershipTargetGroups'
import { fe7ClientMembershipText } from '../../../resources/fe-7-client-membership'


type MembershipRenewPanelProps = {
  branchId: string
  businessDate: string
  currentMembership: ClientMembership
  pending: boolean
  onCancel: () => void
  onSubmit: (submission: MembershipActionSubmission) => Promise<void>
}

export function MembershipRenewPanel({
  branchId,
  businessDate,
  currentMembership,
  pending,
  onCancel,
  onSubmit,
}: MembershipRenewPanelProps) {
  const form = useForm<MembershipRenewFormValues>({
    initialValues: createMembershipRenewInitialValues(businessDate, currentMembership),
  })
  const [catalogItems, setCatalogItems] = useState<MembershipCatalogItem[]>([])
  const [groups, setGroups] = useState<TrainingGroupListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmationOpened, setConfirmationOpened] = useState(false)
  const getSubmissionKey = useClientActionSubmissionKey()
  const selected = catalogItems.find(
    (item) => item.id === form.values.membershipCatalogItemId,
  )
  const targetBehaviorKind = selected?.behaviorKind ?? currentMembership.behaviorKind
  const reportingBranchId = currentMembership.targetGroups[0]?.branchId ?? branchId
  const availableGroups = groups.filter((group) => group.branchId === reportingBranchId)
  const selectedTargetLabels = form.values.targetGroupIds.map(
    (groupId) => availableGroups.find((group) => group.id === groupId)?.name ?? groupId,
  )

  useEffect(() => {
    const controller = new AbortController()
    void getEligibleMembershipCatalogItems(branchId, controller.signal)
      .then(setCatalogItems)
      .catch((error) =>
        setLoadError(
          error instanceof Error
            ? error.message
            : fe7ClientMembershipText.membershipRenewPanel_string_1284aff0,
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
            error instanceof Error ? error.message : fe7ClientMembershipText.membershipRenewPanel_string_46bd9402,
          )
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setGroupsLoading(false)
      })
    return () => controller.abort()
  }, [])

  function requestConfirmation(values: MembershipRenewFormValues) {
    const errors: Record<string, string> = {
      ...validateMembershipSalePricing(values),
    }
    if (!values.paymentDate) {
      errors.paymentDate = fe7ClientMembershipText.membershipRenewPanel_string_c17309b4
    }
    validateTargetGroups(values.targetGroupIds, targetBehaviorKind, errors)
    if (Object.keys(errors).length > 0) {
      form.setErrors(errors)
      return
    }
    setConfirmationOpened(true)
  }

  async function confirmRenewal() {
    setConfirmationOpened(false)
    setFormError(null)
    try {
      const payload = {
        ...buildMembershipSalePricingPayload(form.values),
        saleId: currentMembership.saleId,
        expectedMembershipId: currentMembership.id,
        paymentDate: form.values.paymentDate,
        targetGroupIds: form.values.targetGroupIds,
        ...(selected?.behaviorKind === 'Professional'
          ? {
              professionalComment:
                form.values.professionalComment.trim() || undefined,
            }
          : {}),
      }
      await onSubmit({
        kind: 'renew',
        payload,
        idempotencyKey: getSubmissionKey('renew', payload),
      })
    } catch (error) {
      if (error instanceof ApiError) {
        form.setErrors(applyFieldErrors(error.fieldErrors))
        setFormError(error.message)
      }
    }
  }

  return (
    <Paper className="hint-card" radius="8px" withBorder>
      <MembershipSaleConfirmationModal
        catalogItem={selected}
        onClose={() => setConfirmationOpened(false)}
        onConfirm={() => void confirmRenewal()}
        opened={confirmationOpened}
        pending={pending}
        targetGroupLabels={selectedTargetLabels}
        values={form.values}
      />
      <form noValidate onSubmit={form.onSubmit(requestConfirmation)}>
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Text fw={700}>{fe7ClientMembershipText.membershipRenewPanel_jsxText_53d9b68d}</Text>
              <Text c="dimmed" size="sm">
                {fe7ClientMembershipText.membershipRenewPanel_jsxText_45df77cf}</Text>
            </div>

            <Badge color="var(--crm-brand-primary-soft)" radius="sm" variant="light">
              {fe7ClientMembershipText.membershipRenewPanel_jsxText_3ec61459}</Badge>
          </Group>

          {loadError ? <Alert color="red">{loadError}</Alert> : null}
          {formError ? <Alert color="red">{formError}</Alert> : null}

          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <InfoItem
              label={fe7ClientMembershipText.membershipRenewPanel_label_69e09d39}
              value={`${currentMembership.membershipName} • ${formatCurrencyValue(currentMembership.grossAmount)}`}
            />
            <InfoItem
              label={fe7ClientMembershipText.membershipRenewPanel_label_c0aa51ea}
              value={formatMembershipPricingProvenance(currentMembership)}
            />
            <InfoItem
              label={fe7ClientMembershipText.membershipRenewPanel_label_7e076a01}
              value={formatExpirationValue(
                currentMembership.behaviorKind,
                currentMembership.expirationDate,
              )}
            />
          </SimpleGrid>

          <MembershipSalePricingFields
            catalogItems={catalogItems}
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

          {selected?.behaviorKind === 'Professional' ? (
            <Textarea
              label={fe7ClientMembershipText.membershipRenewPanel_label_e7a31570}
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
              {fe7ClientMembershipText.membershipRenewPanel_jsxText_7c47f729}</Button>
            <Button loading={pending} type="submit">
              {fe7ClientMembershipText.membershipRenewPanel_jsxText_b62f978a}</Button>
          </ResponsiveButtonGroup>
        </Stack>
      </form>
    </Paper>
  )
}
