
/* eslint-disable react-refresh/only-export-components -- TASK-127 keeps membership idempotency inside the opaque TASK-128 handoff module. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Badge, Button, Group, Paper, SimpleGrid, Stack, Table, Text, Textarea, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import {
  ApiError,
  applyFieldErrors,
  getEligibleMembershipCatalogItems,
  getMembershipExpirationSuggestion,
  updateClientMembershipComment,
  type ClientDetails,
  type ClientMembership,
  type MembershipBehaviorKind,
  type MembershipCatalogItem,
} from '../../lib/api'
import { PageSection, ResponsiveButtonGroup } from '../shared/ux'
import {
  buildMembershipSalePricingPayload,
  createEmptyMembershipSalePricingValues,
  validateMembershipSalePricing,
  type MembershipSalePricingValues,
} from './MembershipSalePricing'
import { MembershipSalePricingFields } from './MembershipSalePricingFields'
import {
  compareMembershipHistory,
  formatCurrencyValue,
  formatDateValue,
  formatExpirationValue,
  formatMembershipChangeReason,
  formatMembershipPricingProvenance,
  formatMembershipVersionDate,
  formatPaymentRecordingValue,
  pickPricingFieldErrors,
} from './ClientManagement.formatting'
import type {
  MembershipActionMode,
  MembershipActionSubmission,
  MembershipCorrectionFormValues,
  MembershipRenewFormValues,
} from './ClientManagement.types'
import {
  InfoItem,
  MembershipSaleConfirmationModal,
  PaymentDateInput,
} from './ClientSharedInfo'
import { formatNoteAttributionDate } from './noteAttribution'

type ClientMembershipSectionProps = {
  actionMode: MembershipActionMode | null
  client: ClientDetails
  pending: boolean
  onCancelAction: () => void
  onSubmit: (submission: MembershipActionSubmission) => Promise<void>
  onClientChange: (client: ClientDetails) => void
}

export function ClientMembershipSection({
  actionMode,
  client,
  pending,
  onCancelAction,
  onSubmit,
  onClientChange,
}: ClientMembershipSectionProps) {
  const currentMembership = client.currentMembership
  const history = [...client.membershipHistory].sort(compareMembershipHistory)
  const canEditMembership = !client.isProfessional
  const canRenewFiniteProfessional =
    client.isProfessional &&
    currentMembership?.behaviorKind === 'Professional' &&
    currentMembership.expirationDate !== null
  const sales = groupMembershipVersionsBySale(history)

  return (
    <PageSection className="client-detail-card client-membership-card">
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap">
          <div>
            <Text fw={700}>История абонемента</Text>
            <Text c="dimmed" size="sm">
              Изменения срока, суммы и оплаты по клиенту.
            </Text>
          </div>

          <Badge color="sand" radius="sm" variant="light">
            Версий: {history.length}
          </Badge>
        </Group>

        {canEditMembership && actionMode === 'purchase' ? (
          <CatalogPurchasePanel
            key={`purchase-${currentMembership?.id ?? 'empty'}`}
            branchId={client.branchId}
            businessDate={client.businessDate}
            pending={pending}
            onCancel={onCancelAction}
            onSubmit={onSubmit}
          />
        ) : null}

        {(canEditMembership || canRenewFiniteProfessional) &&
        actionMode === 'renew' &&
        currentMembership ? (
          <MembershipRenewPanel
            key={`renew-${currentMembership.id}`}
            branchId={client.branchId}
            businessDate={client.businessDate}
            currentMembership={currentMembership}
            pending={pending}
            onCancel={onCancelAction}
            onSubmit={onSubmit}
          />
        ) : null}

        {canEditMembership && actionMode === 'correct' && currentMembership ? (
          <MembershipEditPanel
            key={`correct-${currentMembership.id}`}
            businessDate={client.businessDate}
            currentMembership={currentMembership}
            pending={pending}
            onCancel={onCancelAction}
            onSubmit={onSubmit}
          />
        ) : null}

        {history.length === 0 ? (
          <Text c="dimmed" size="sm">
            История появится после первого действия с абонементом.
          </Text>
        ) : (
          <Stack gap="md">
            {sales.map(({ saleId, versions }) => (
              <Paper className="membership-sale-card" key={saleId} radius="md" withBorder>
                <MembershipSaleComment
                  clientId={client.id}
                  membership={versions[0]}
                  onClientChange={onClientChange}
                />
                <div className="membership-history-table-wrap">
                  <Table className="membership-history-table" horizontalSpacing="md" verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Событие</Table.Th>
                  <Table.Th>Период</Table.Th>
                  <Table.Th>Сумма</Table.Th>
                  <Table.Th>Дата оплаты</Table.Th>
                  <Table.Th>Дата версии</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {versions.map((membership) => (
                  <Table.Tr key={membership.id}>
                    <Table.Td>
                      <Group gap="xs" wrap="wrap">
                        <Text fw={700} size="sm">
                          {membership.membershipName}
                        </Text>
                        <Badge radius="sm" variant="light">
                          {formatMembershipChangeReason(membership.changeReason)}
                        </Badge>
                        {membership.validTo ? null : (
                          <Badge color="teal" radius="sm" variant="light">
                            Текущая
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text c="dimmed" size="sm">
                        {formatDateValue(membership.purchaseDate)} -{' '}
                        {formatExpirationValue(
                          membership.behaviorKind,
                          membership.expirationDate,
                        )}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={2}>
                        <Text size="sm">{formatCurrencyValue(membership.grossAmount)}</Text>
                        <Text c="dimmed" size="xs">
                          {formatMembershipPricingProvenance(membership)}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Stack gap={2}>
                        <Text size="sm">{formatDateValue(membership.paymentDate)}</Text>
                        <Text c="dimmed" size="xs">
                          {formatPaymentRecordingValue(membership)}
                        </Text>
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Text c="dimmed" size="sm">
                        {formatMembershipVersionDate(membership)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
                  </Table>
                </div>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    </PageSection>
  )
}

function groupMembershipVersionsBySale(history: ClientMembership[]) {
  const sales = new Map<string, ClientMembership[]>()
  for (const membership of history) {
    const versions = sales.get(membership.saleId) ?? []
    versions.push(membership)
    sales.set(membership.saleId, versions)
  }
  return [...sales].map(([saleId, versions]) => ({ saleId, versions }))
}

function MembershipSaleComment({ clientId, membership, onClientChange }: {
  clientId: string
  membership: ClientMembership
  onClientChange: (client: ClientDetails) => void
}) {
  const [editing, setEditing] = useState(false)
  const [comment, setComment] = useState(membership.comment ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const attribution = membership.commentLastChangedByName && membership.commentLastChangedAt
    ? formatNoteAttributionDate(membership.commentLastChangedAt)
    : null

  useEffect(() => {
    if (!editing) setComment(membership.comment ?? '')
  }, [editing, membership.comment])

  function toggleEditing() {
    if (pending) return
    if (editing) {
      setComment(membership.comment ?? '')
      setError(null)
    }
    setEditing((value) => !value)
  }

  async function save() {
    setPending(true)
    setError(null)
    try {
      onClientChange(await updateClientMembershipComment(clientId, membership.saleId, comment))
      setEditing(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Не удалось сохранить комментарий.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Stack className="membership-sale-comment" data-testid={`membership-sale-comment-${membership.saleId}`} gap="xs">
      <Group justify="space-between" wrap="wrap">
        <Text fw={700} size="sm">Комментарий к покупке</Text>
        <Button aria-label={`${editing ? 'Отменить редактирование' : 'Редактировать комментарий'} к покупке от ${formatDateValue(membership.purchaseDate)}`} disabled={pending} onClick={toggleEditing} size="compact-sm" variant="subtle">
          {editing ? 'Отмена' : 'Редактировать'}
        </Button>
      </Group>
      {editing ? (
        <Stack gap="xs">
          <Textarea aria-label="Комментарий к покупке" disabled={pending} maxLength={2000} minRows={3} onChange={(event) => setComment(event.currentTarget.value)} value={comment} />
          {error ? <Alert color="red" variant="light">{error}</Alert> : null}
          <Group justify="flex-end"><Button loading={pending} onClick={() => void save()} size="sm">Сохранить</Button></Group>
        </Stack>
      ) : (
        <Stack gap={4}>
          {membership.comment ? <Text className="membership-sale-comment__text" size="sm">{membership.comment}</Text> : <Text c="dimmed" size="sm">Комментарий пока не добавлен.</Text>}
          {attribution ? <Text className="membership-sale-comment__attribution" c="dimmed" size="xs">{membership.commentLastChangedByName} · {attribution}</Text> : null}
        </Stack>
      )}
    </Stack>
  )
}

export function useMembershipSubmissionKey() {
  const submissionRef = useRef<{ fingerprint: string; key: string } | null>(null)

  return useCallback((kind: MembershipActionMode | 'transfer', payload: unknown) => {
    const fingerprint = JSON.stringify({ kind, payload })
    if (submissionRef.current?.fingerprint !== fingerprint) {
      submissionRef.current = {
        fingerprint,
        key: createIdempotencyKey(),
      }
    }

    return submissionRef.current.key
  }, [])
}

function createIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

type MembershipEditPanelProps = {
  businessDate: string
  currentMembership: ClientMembership
  pending: boolean
  onCancel: () => void
  onSubmit: (submission: MembershipActionSubmission) => Promise<void>
}

function MembershipEditPanel({
  businessDate,
  currentMembership,
  pending,
  onCancel,
  onSubmit,
}: MembershipEditPanelProps) {
  const initialValues = createMembershipCorrectionInitialValues(currentMembership)
  const form = useForm<MembershipCorrectionFormValues>({
    initialValues,
  })
  const formRef = useRef(form)
  formRef.current = form
  const getSubmissionKey = useMembershipSubmissionKey()
  const [expirationManuallyChanged, setExpirationManuallyChanged] = useState(false)
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

        formRef.current.setFieldValue(
          'validTo',
          suggestion.expirationDate ?? '',
        )
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
              label="Действует с"
              type="date"
              value={form.values.validFrom}
              onChange={(event) => {
                const nextValidFrom = event.currentTarget.value
                form.setFieldValue('validFrom', nextValidFrom)
                updateSuggestedExpiration(nextValidFrom)
              }}
              error={form.errors.validFrom}
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
              label="Действует по"
              type="date"
              value={form.values.validTo}
              onChange={(event) => {
                setExpirationManuallyChanged(true)
                form.setFieldValue('validTo', event.currentTarget.value)
              }}
              error={form.errors.validTo}
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

type CatalogPurchasePanelProps = {
  branchId: string
  businessDate: string
  pending: boolean
  onCancel: () => void
  onSubmit: (submission: MembershipActionSubmission) => Promise<void>
}

function CatalogPurchasePanel({ branchId, businessDate, pending, onCancel, onSubmit }: CatalogPurchasePanelProps) {
  const [items, setItems] = useState<MembershipCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmationOpened, setConfirmationOpened] = useState(false)
  const getSubmissionKey = useMembershipSubmissionKey()
  const form = useForm<MembershipPurchaseFormValues>({
    initialValues: {
      ...createEmptyMembershipSalePricingValues(),
      validFrom: '',
      validTo: '',
      paymentDate: businessDate,
      professionalComment: '',
    },
  })
  const selected = items.find((item) => item.id === form.values.membershipCatalogItemId)

  useEffect(() => {
    const controller = new AbortController()
    void getEligibleMembershipCatalogItems(branchId, controller.signal)
      .then(setItems)
      .catch((error) => setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить абонементы.'))
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
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
    if (selected?.behaviorKind === 'Professional' && !form.values.professionalComment.trim()) {
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
        ...(
          selected?.behaviorKind === 'Professional'
            ? { professionalComment: form.values.professionalComment.trim() }
            : {}
        ),
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

  return <Paper className="hint-card" radius="8px" withBorder>
    <MembershipSaleConfirmationModal
      catalogItem={selected}
      onClose={() => setConfirmationOpened(false)}
      onConfirm={() => void confirmPurchase()}
      opened={confirmationOpened}
      pending={pending}
      values={form.values}
    />
    <form noValidate onSubmit={form.onSubmit(requestConfirmation)}><Stack gap="md">
    <div><Text fw={700}>Оформить новый абонемент</Text><Text c="dimmed" size="sm">Выберите способ расчёта и подтвердите фактическую сумму этой продажи.</Text></div>
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
    {needsValidity ? <SimpleGrid cols={{ base: 1, md: 2 }}><TextInput label="Действует с" type="date" {...form.getInputProps('validFrom')}/><TextInput label="Действует по" type="date" {...form.getInputProps('validTo')}/></SimpleGrid> : null}
    {selected?.behaviorKind === 'Professional' ? <Textarea label="Комментарий к профессиональному абонементу" {...form.getInputProps('professionalComment')}/> : null}
    <PaymentDateInput
      error={form.errors.paymentDate}
      max={businessDate}
      onChange={(value) => form.setFieldValue('paymentDate', value)}
      value={form.values.paymentDate}
    />
    <ResponsiveButtonGroup justify="space-between"><Button onClick={onCancel} type="button" variant="subtle">Отменить</Button><Button loading={pending} type="submit">Оформить абонемент</Button></ResponsiveButtonGroup>
  </Stack></form></Paper>
}

type MembershipPurchaseFormValues = MembershipSalePricingValues & {
  validFrom: string
  validTo: string
  paymentDate: string
  professionalComment: string
}

type MembershipRenewPanelProps = {
  branchId: string
  businessDate: string
  currentMembership: ClientMembership
  pending: boolean
  onCancel: () => void
  onSubmit: (submission: MembershipActionSubmission) => Promise<void>
}

function MembershipRenewPanel({
  branchId,
  businessDate,
  currentMembership,
  pending,
  onCancel,
  onSubmit,
}: MembershipRenewPanelProps) {
  const form = useForm<MembershipRenewFormValues>({
    initialValues: createMembershipRenewInitialValues(businessDate),
  })
  const [catalogItems, setCatalogItems] = useState<MembershipCatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmationOpened, setConfirmationOpened] = useState(false)
  const getSubmissionKey = useMembershipSubmissionKey()
  const selected = catalogItems.find(
    (item) => item.id === form.values.membershipCatalogItemId,
  )

  useEffect(() => {
    const controller = new AbortController()
    void getEligibleMembershipCatalogItems(branchId, controller.signal)
      .then(setCatalogItems)
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

  function requestConfirmation(values: MembershipRenewFormValues) {
    const errors: Record<string, string> = {
      ...validateMembershipSalePricing(values),
    }
    if (!values.paymentDate) {
      errors.paymentDate = 'Укажите дату оплаты.'
    }
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
        paymentDate: form.values.paymentDate,
        ...(
          selected?.behaviorKind === 'Professional'
            ? {
                professionalComment:
                  form.values.professionalComment.trim() || undefined,
              }
            : {}
        ),
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
        values={form.values}
      />
      <form noValidate onSubmit={form.onSubmit(requestConfirmation)}>
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Text fw={700}>Продлить текущий абонемент</Text>
              <Text c="dimmed" size="sm">
                Предыдущая продажа показана только для контекста. Выберите способ расчёта заново.
              </Text>
            </div>

              <Badge color="var(--crm-brand-primary-soft)" radius="sm" variant="light">
              Новая продажа
            </Badge>
          </Group>

          {loadError ? <Alert color="red">{loadError}</Alert> : null}
          {formError ? <Alert color="red">{formError}</Alert> : null}

          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <InfoItem
              label="Предыдущая продажа"
              value={`${currentMembership.membershipName} • ${formatCurrencyValue(currentMembership.grossAmount)}`}
            />
            <InfoItem
              label="Предыдущий расчёт"
              value={formatMembershipPricingProvenance(currentMembership)}
            />
            <InfoItem
              label="Предыдущий период"
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
              Продлить абонемент
            </Button>
          </ResponsiveButtonGroup>
        </Stack>
      </form>
    </Paper>
  )
}

function createMembershipCorrectionInitialValues(
  currentMembership: ClientMembership,
): MembershipCorrectionFormValues {
  return {
    validFrom: currentMembership.validFrom ?? currentMembership.purchaseDate,
    validTo: currentMembership.expirationDate ?? '',
    paymentDate: currentMembership.paymentDate,
  }
}

function createMembershipRenewInitialValues(businessDate: string): MembershipRenewFormValues {
  return {
    ...createEmptyMembershipSalePricingValues(),
    paymentDate: businessDate,
    professionalComment: '',
  }
}

function validateMembershipCorrectionForm(
  values: MembershipCorrectionFormValues,
  behaviorKind: MembershipBehaviorKind,
) {
  const errors: Record<string, string> = {}

  if (!values.validFrom) {
    errors.validFrom = 'Укажите начало срока.'
  }

  if (isExpirationRequired(behaviorKind)) {
    if (!values.validTo) {
      errors.validTo = 'Укажите дату окончания.'
    }
  }

  if (!values.paymentDate) {
    errors.paymentDate = 'Укажите дату оплаты.'
  }

  return errors
}

function isExpirationRequired(behaviorKind: MembershipBehaviorKind) {
  return behaviorKind !== 'SingleVisit'
}
