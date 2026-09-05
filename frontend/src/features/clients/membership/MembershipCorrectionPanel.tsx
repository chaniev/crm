import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge, Button, Group, Paper, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'

import {
  ApiError,
  applyFieldErrors,
  getMembershipExpirationSuggestion,
  type ClientMembership,
  type MembershipBehaviorKind,
  type TrainingGroupListItem,
} from '../../../lib/api'
import { ResponsiveButtonGroup } from '../../shared/ux'
import {
  formatCurrencyValue,
  formatDateValue,
} from '../ClientManagement.formatting'
import type {
  MembershipActionSubmission,
  MembershipCorrectionFormValues,
} from '../ClientManagement.types'
import { InfoItem, PaymentDateInput } from '../ClientSharedInfo'
import {
  createMembershipCorrectionInitialValues,
  validateMembershipCorrectionForm,
} from './membershipForms'
import { useClientActionSubmissionKey } from '../useClientActionSubmissionKey'
import { MembershipTargetGroupsField } from './MembershipTargetGroupsField'
import {
  isMembershipTargetLoadAbort,
  loadAllActiveMembershipTargetGroups,
  pickTargetGroupError,
} from './membershipTargetGroups'
import { fe7ClientMembershipText } from '../../../resources/fe-7-client-membership'


type MembershipCorrectionPanelProps = {
  businessDate: string
  currentMembership: ClientMembership
  pending: boolean
  onCancel: () => void
  onSubmit: (submission: MembershipActionSubmission) => Promise<void>
}

export function MembershipCorrectionPanel({
  businessDate,
  currentMembership,
  pending,
  onCancel,
  onSubmit,
}: MembershipCorrectionPanelProps) {
  const initialValues = createMembershipCorrectionInitialValues(currentMembership)
  const form = useForm<MembershipCorrectionFormValues>({ initialValues })
  const formRef = useRef(form)
  formRef.current = form
  const getSubmissionKey = useClientActionSubmissionKey()
  const [expirationManuallyChanged, setExpirationManuallyChanged] =
    useState(false)
  const [expirationSuggestionLoading, setExpirationSuggestionLoading] =
    useState(false)
  const [expirationSuggestionError, setExpirationSuggestionError] = useState<
    string | null
  >(null)
  const [groups, setGroups] = useState<TrainingGroupListItem[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const expirationSuggestionRequestIdRef = useRef(0)
  const reportingBranchId = currentMembership.targetGroups[0]?.branchId
  const availableGroups = reportingBranchId
    ? groups.filter((group) => group.branchId === reportingBranchId)
    : groups

  useEffect(() => {
    const controller = new AbortController()
    setGroupsLoading(true)
    void loadAllActiveMembershipTargetGroups(controller.signal)
      .then(setGroups)
      .catch((error) => {
        if (!isMembershipTargetLoadAbort(error)) {
          setExpirationSuggestionError(
            error instanceof Error ? error.message : fe7ClientMembershipText.membershipCorrectionPanel_string_46bd9402,
          )
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setGroupsLoading(false)
      })
    return () => controller.abort()
  }, [])

  const applySuggestedExpiration = useCallback(
    async (behaviorKind: MembershipBehaviorKind | null, validFrom: string) => {
      const requestId = expirationSuggestionRequestIdRef.current + 1
      expirationSuggestionRequestIdRef.current = requestId
      setExpirationSuggestionError(null)

      if (!behaviorKind || !validFrom || behaviorKind === 'SingleVisit') {
        setExpirationSuggestionLoading(false)
        formRef.current.setFieldValue('validTo', '')
        return
      }

      setExpirationSuggestionLoading(true)

      try {
        const suggestion = await getMembershipExpirationSuggestion(
          behaviorKind,
          validFrom,
        )

        if (expirationSuggestionRequestIdRef.current !== requestId) {
          return
        }

        formRef.current.setFieldValue('validTo', suggestion.expirationDate ?? '')
      } catch (error) {
        if (expirationSuggestionRequestIdRef.current !== requestId) {
          return
        }

        setExpirationSuggestionError(
          error instanceof Error
            ? error.message
            : fe7ClientMembershipText.membershipCorrectionPanel_string_ae65fc7f,
        )
      } finally {
        if (expirationSuggestionRequestIdRef.current === requestId) {
          setExpirationSuggestionLoading(false)
        }
      }
    },
    [],
  )

  function updateSuggestedExpiration(validFrom: string) {
    if (expirationManuallyChanged) {
      return
    }

    void applySuggestedExpiration(currentMembership.behaviorKind, validFrom)
  }

  async function submit(values: MembershipCorrectionFormValues) {
    const validationErrors = validateMembershipCorrectionForm(
      values,
      currentMembership.behaviorKind,
    )

    if (Object.keys(validationErrors).length > 0) {
      form.setErrors(validationErrors)
      return
    }

    try {
      const payload = {
        saleId: currentMembership.saleId,
        expectedMembershipId: currentMembership.id,
        validFrom: values.validFrom,
        validTo: values.validTo || undefined,
        paymentDate: values.paymentDate,
        targetGroupIds: values.targetGroupIds,
      }
      await onSubmit({
        kind: 'correct',
        payload,
        idempotencyKey: getSubmissionKey('correct', payload),
      })
    } catch (error) {
      if (error instanceof ApiError) {
        form.setErrors(applyFieldErrors(error.fieldErrors))
      }
    }
  }

  return (
    <Paper className="hint-card" radius="8px" withBorder>
      <form noValidate onSubmit={form.onSubmit((values) => void submit(values))}>
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Text fw={700}>{fe7ClientMembershipText.membershipCorrectionPanel_jsxText_7d3a232e}</Text>
              <Text c="dimmed" size="sm">
                {fe7ClientMembershipText.membershipCorrectionPanel_jsxText_529702bf}</Text>
            </div>

            <Badge color="var(--crm-brand-primary-soft)" radius="sm" variant="light">
              {fe7ClientMembershipText.membershipCorrectionPanel_jsxText_b3977315}</Badge>
          </Group>

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <InfoItem
              label={fe7ClientMembershipText.membershipCorrectionPanel_label_1139430b}
              value={currentMembership.membershipName}
            />
            <InfoItem
              label={fe7ClientMembershipText.membershipCorrectionPanel_label_c94a6d0e}
              value={formatCurrencyValue(currentMembership.grossAmount)}
            />
            <InfoItem
              label={fe7ClientMembershipText.membershipCorrectionPanel_label_65ce6ae7}
              value={formatDateValue(currentMembership.purchaseDate)}
            />
            <PaymentDateInput
              error={form.errors.paymentDate}
              max={businessDate}
              onChange={(value) => form.setFieldValue('paymentDate', value)}
              value={form.values.paymentDate}
            />
            <TextInput
              error={form.errors.validFrom}
              label={fe7ClientMembershipText.membershipCorrectionPanel_label_f79d7e9d}
              onChange={(event) => {
                const nextValidFrom = event.currentTarget.value
                form.setFieldValue('validFrom', nextValidFrom)
                updateSuggestedExpiration(nextValidFrom)
              }}
              type="date"
              value={form.values.validFrom}
            />
            <TextInput
              description={
                currentMembership.behaviorKind === 'SingleVisit'
                  ? fe7ClientMembershipText.membershipCorrectionPanel_string_95777141
                  : expirationSuggestionLoading
                    ? fe7ClientMembershipText.membershipCorrectionPanel_string_56f2dc95
                    : expirationSuggestionError ??
                      fe7ClientMembershipText.membershipCorrectionPanel_string_1b5e4eb6
              }
              error={form.errors.validTo}
              label={fe7ClientMembershipText.membershipCorrectionPanel_label_b9094c16}
              onChange={(event) => {
                setExpirationManuallyChanged(true)
                form.setFieldValue('validTo', event.currentTarget.value)
              }}
              type="date"
              value={form.values.validTo}
            />
          </SimpleGrid>

          <MembershipTargetGroupsField
            behaviorKind={currentMembership.behaviorKind}
            error={pickTargetGroupError(form.errors)}
            groups={availableGroups}
            loading={groupsLoading}
            onChange={(targetGroupIds) => {
              form.setFieldValue('targetGroupIds', targetGroupIds)
              form.clearFieldError('targetGroupIds')
            }}
            targetGroupIds={form.values.targetGroupIds}
          />

          <Group justify="flex-end" wrap="wrap">
            <Button
              disabled={pending || expirationSuggestionLoading}
              loading={expirationSuggestionLoading}
              onClick={() => {
                setExpirationManuallyChanged(false)
                void applySuggestedExpiration(
                  currentMembership.behaviorKind,
                  form.values.validFrom,
                )
              }}
              type="button"
              variant="subtle"
            >
              {fe7ClientMembershipText.membershipCorrectionPanel_jsxText_489f430b}</Button>
          </Group>

          <ResponsiveButtonGroup justify="space-between">
            <Button onClick={onCancel} type="button" variant="subtle">
              {fe7ClientMembershipText.membershipCorrectionPanel_jsxText_7c47f729}</Button>
            <Button loading={pending} type="submit">
              {fe7ClientMembershipText.membershipCorrectionPanel_jsxText_375934ac}</Button>
          </ResponsiveButtonGroup>
        </Stack>
      </form>
    </Paper>
  )
}
