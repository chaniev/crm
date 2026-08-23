import { useCallback, useRef, useState } from 'react'
import { Badge, Button, Group, Paper, SimpleGrid, Stack, Text, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'

import {
  ApiError,
  applyFieldErrors,
  getMembershipExpirationSuggestion,
  type ClientMembership,
  type MembershipBehaviorKind,
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
  const expirationSuggestionRequestIdRef = useRef(0)

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
            : 'Не удалось рассчитать срок абонемента.',
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
              <Text fw={700}>Исправить текущий абонемент</Text>
              <Text c="dimmed" size="sm">
                Тип и цена зафиксированы в продаже и не меняются при исправлении.
              </Text>
            </div>

            <Badge color="var(--crm-brand-primary-soft)" radius="sm" variant="light">
              Исправление
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <InfoItem
              label="Абонемент"
              value={currentMembership.membershipName}
            />
            <InfoItem
              label="Сумма продажи"
              value={formatCurrencyValue(currentMembership.grossAmount)}
            />
            <InfoItem
              label="Дата покупки"
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
              label="Действует с"
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
                  ? 'Для разового посещения дату можно оставить пустой.'
                  : expirationSuggestionLoading
                    ? 'Рассчитываем дату окончания...'
                    : expirationSuggestionError ??
                      'Дата предложена автоматически, но ее можно изменить.'
              }
              error={form.errors.validTo}
              label="Действует по"
              onChange={(event) => {
                setExpirationManuallyChanged(true)
                form.setFieldValue('validTo', event.currentTarget.value)
              }}
              type="date"
              value={form.values.validTo}
            />
          </SimpleGrid>

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
              Подставить срок по правилу
            </Button>
          </Group>

          <ResponsiveButtonGroup justify="space-between">
            <Button onClick={onCancel} type="button" variant="subtle">
              Отменить
            </Button>
            <Button loading={pending} type="submit">
              Сохранить исправление
            </Button>
          </ResponsiveButtonGroup>
        </Stack>
      </form>
    </Paper>
  )
}
