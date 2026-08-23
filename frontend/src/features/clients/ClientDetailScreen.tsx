
import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Group, Loader } from '@mantine/core'
import { useForm } from '@mantine/form'
import {
  IconAlertCircle,
  IconArchive,
  IconArrowLeft,
  IconEdit,
  IconGitBranch,
  IconRefresh,
} from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  archiveClient,
  correctClientMembership,
  getBranches,
  getClient,
  getGroups,
  purchaseClientMembership,
  renewClientMembership,
  restoreClient,
  transferClientBranch,
  uploadClientPhoto,
  type Branch,
  type ClientDetails,
  type ClientMembership,
  type ClientStatus,
  type TrainingGroupListItem,
} from '../../lib/api'
import { ConfirmActionModal, PageLayout, PageSection, ResponsiveButtonGroup } from '../shared/ux'
import { showAppNotification } from '../shared/notifications'
import { ClientMessengerChatSection } from './ClientMessengerChatSection'
import {
  ClientNotesSection,
  ClientRelatedSections,
} from './ClientDetailSections'
import {
  buildMembershipSalePricingPayload,
  createEmptyMembershipSalePricingValues,
  validateMembershipSalePricing,
} from './MembershipSalePricing'
import {
  type ClientTransferFormValues,
  type MembershipActionMode,
  type MembershipActionSubmission,
} from './ClientManagement.types'
import { ClientTransferModal } from './ClientTransferModal'
import { ClientOverviewSection } from './ClientOverviewSection'
import { ClientMembershipSection } from './membership'
import { ClientAttendanceHistorySection } from './ClientAttendanceHistorySection'
import { useClientActionSubmissionKey } from './useClientActionSubmissionKey'

type ClientDetailScreenProps = {
  backLabel?: string
  clientId: string
  canManage: boolean
  onBack: () => void
  onEdit: (clientId: string) => void
}

export function ClientDetailScreen({
  backLabel = 'К списку клиентов',
  clientId,
  canManage,
  onBack,
  onEdit,
}: ClientDetailScreenProps) {
  const [client, setClient] = useState<ClientDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionPending, setActionPending] = useState(false)
  const [archiveConfirmOpened, setArchiveConfirmOpened] = useState(false)
  const [transferModalOpened, setTransferModalOpened] = useState(false)
  const [branchOptions, setBranchOptions] = useState<Branch[]>([])
  const [groupOptions, setGroupOptions] = useState<TrainingGroupListItem[]>([])
  const [transferOptionsLoading, setTransferOptionsLoading] = useState(false)
  const [transferFormError, setTransferFormError] = useState<string | null>(null)
  const [transferSubmitting, setTransferSubmitting] = useState(false)
  const [photoVersion, setPhotoVersion] = useState<number | null>(null)
  const [membershipActionMode, setMembershipActionMode] =
    useState<MembershipActionMode | null>(null)
  const getTransferSubmissionKey = useClientActionSubmissionKey()
  const actionPendingRef = useRef(false)
  const transferForm = useForm<ClientTransferFormValues>({
    initialValues: {
      branchId: '',
      groupId: '',
      ...createEmptyMembershipSalePricingValues(),
      validFrom: '',
      validTo: '',
      paymentDate: client?.businessDate ?? '',
      professionalComment: '',
    },
  })

  function handleMembershipCommentChange(
    updatedMembership: ClientMembership,
  ) {
    setClient((currentClient) =>
      currentClient
        ? applyMembershipSaleComment(currentClient, updatedMembership)
        : currentClient,
    )
  }

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setLoadError(null)

      try {
        const nextClient = await getClient(clientId, controller.signal)

        if (controller.signal.aborted) {
          return
        }

        setClient(nextClient)
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить карточку клиента.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [clientId])

  async function toggleArchive() {
    if (!client) {
      return
    }

    setArchiveConfirmOpened(false)
    setActionPending(true)
    setActionError(null)

    try {
      if (client.status === 'Active') {
        await archiveClient(client.id)
      } else {
        await restoreClient(client.id)
      }

      const nextStatus: ClientStatus =
        client.status === 'Active' ? 'Archived' : 'Active'

      setClient((currentClient) =>
        currentClient
          ? {
              ...currentClient,
              status: nextStatus,
            }
          : currentClient,
      )

      showAppNotification({
        id: `client-archive-toggle-${client.id}`,
        title:
          nextStatus === 'Archived'
            ? 'Клиент переведен в архив'
            : 'Клиент возвращен в активные',
        message:
          nextStatus === 'Archived'
            ? 'Карточка остается доступной для просмотра.'
            : 'Клиент снова помечен как активный.',
        color: 'teal',
      })
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Не удалось изменить статус клиента.',
      )
    } finally {
      setActionPending(false)
    }
  }

  async function openTransferModal() {
    if (!client) {
      return
    }

    setTransferModalOpened(true)
    setTransferOptionsLoading(true)
    setTransferFormError(null)
    transferForm.clearErrors()
    transferForm.setValues({
      branchId: client.branchId,
      groupId: client.groupIds[0] ?? '',
      ...createEmptyMembershipSalePricingValues(),
      validFrom: '',
      validTo: '',
      paymentDate: client.businessDate,
      professionalComment: '',
    })

    try {
      const [branches, groupsResponse] = await Promise.all([
        getBranches({ includeArchived: true }),
        getGroups({ take: 100 }),
      ])
      setBranchOptions(branches)
      setGroupOptions(groupsResponse.items)
    } catch (error) {
      setTransferFormError(
        error instanceof Error
          ? error.message
          : 'Не удалось загрузить филиалы и группы.',
      )
    } finally {
      setTransferOptionsLoading(false)
    }
  }

  async function submitTransfer(values: ClientTransferFormValues) {
    if (!client) {
      return
    }

    setTransferSubmitting(true)
    setTransferFormError(null)
    transferForm.clearErrors()

    try {
      const movesUnusedSingleVisit =
        client.currentMembership?.behaviorKind === 'SingleVisit' &&
        !client.currentMembership.singleVisitUsed
      const pricingErrors = movesUnusedSingleVisit
        ? {}
        : validateMembershipSalePricing(values)

      if (Object.keys(pricingErrors).length > 0) {
        transferForm.setErrors(pricingErrors)
        setTransferFormError('Выберите способ расчёта и проверьте сумму продажи.')
        return
      }

      const payload = movesUnusedSingleVisit
        ? {
              targetBranchId: values.branchId,
              targetGroupIds: values.groupId ? [values.groupId] : [],
            }
        : {
              targetBranchId: values.branchId,
              targetGroupIds: values.groupId ? [values.groupId] : [],
              ...buildMembershipSalePricingPayload(values),
              ...(values.pricingMode === 'AmountOnly'
                ? { membershipCatalogItemId: null }
                : {}),
              validFrom: values.validFrom || undefined,
              validTo: values.validTo || undefined,
              paymentDate: values.paymentDate,
              ...(values.professionalComment.trim()
                ? { professionalComment: values.professionalComment.trim() }
                : {}),
            }
      const updatedClient = await transferClientBranch(
        client.id,
        payload,
        {
          idempotencyKey: getTransferSubmissionKey('transfer', payload),
        },
      )

      setClient(updatedClient ?? (await getClient(client.id)))
      setTransferModalOpened(false)

      showAppNotification({
        id: `client-transfer-${client.id}`,
        title: 'Клиент переведен',
        message: 'Филиал и группа клиента обновлены.',
        color: 'teal',
      })
    } catch (error) {
      if (error instanceof ApiError) {
        transferForm.setErrors(applyFieldErrors(error.fieldErrors))
        setTransferFormError(error.message)
        return
      }

      setTransferFormError('Не удалось перевести клиента.')
    } finally {
      setTransferSubmitting(false)
    }
  }

  async function handleMembershipAction(
    submission: MembershipActionSubmission,
  ) {
    if (!client || actionPendingRef.current) {
      return
    }

    actionPendingRef.current = true
    setActionPending(true)
    setActionError(null)

    try {
      const options = { idempotencyKey: submission.idempotencyKey }
      await (submission.kind === 'purchase'
        ? purchaseClientMembership(client.id, submission.payload, options)
        : submission.kind === 'renew'
          ? renewClientMembership(client.id, submission.payload, options)
          : correctClientMembership(client.id, submission.payload, options))

      setClient(await getClient(client.id))
      setMembershipActionMode(null)

      const feedback =
        submission.kind === 'purchase'
          ? {
              title: 'Абонемент оформлен',
              message: 'Текущий абонемент и история клиента обновлены.',
            }
          : submission.kind === 'renew'
            ? {
                title: 'Абонемент продлен',
                message: 'Новая версия абонемента появилась в карточке клиента.',
              }
            : {
                title: 'Данные абонемента исправлены',
                message: 'Карточка клиента обновлена.',
              }

      showAppNotification({
        id: `client-membership-${client.id}-${submission.kind}`,
        title: feedback.title,
        message: feedback.message,
        color: 'teal',
      })
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Не удалось выполнить действие с абонементом.',
      )
      throw error
    } finally {
      actionPendingRef.current = false
      setActionPending(false)
    }
  }

  async function handlePhotoUpload(file: File) {
    if (!client) {
      return
    }

    await uploadClientPhoto(client.id, file)
    setClient(await getClient(client.id))
    setPhotoVersion(Date.now())
  }

  function toggleMembershipActionMode(mode: MembershipActionMode) {
    setActionError(null)
    setMembershipActionMode((currentMode) => (currentMode === mode ? null : mode))
  }

  function cancelMembershipAction() {
    setActionError(null)
    setMembershipActionMode(null)
  }

  return (
    <PageLayout
      actions={
        <ResponsiveButtonGroup>
          <Button
            leftSection={<IconArrowLeft size={18} />}
            onClick={onBack}
            variant="default"
          >
            {backLabel}
          </Button>
          {canManage && client ? (
            <Button
              leftSection={<IconEdit size={18} />}
              onClick={() => onEdit(client.id)}
              variant="light"
            >
              Редактировать
            </Button>
          ) : null}
          {canManage && client ? (
            <Button
              leftSection={<IconGitBranch size={18} />}
              loading={transferOptionsLoading || transferSubmitting}
              onClick={() => void openTransferModal()}
              variant="light"
            >
              Перевести
            </Button>
          ) : null}
          {canManage && client ? (
            <Button
              color={client.status === 'Active' ? 'gray' : 'teal'}
              leftSection={
                client.status === 'Active' ? (
                  <IconArchive size={18} />
                ) : (
                  <IconRefresh size={18} />
                )
              }
              loading={actionPending}
              onClick={() => setArchiveConfirmOpened(true)}
              variant="light"
            >
              {client.status === 'Active'
                ? 'В архив'
                : 'Вернуть в активные'}
            </Button>
          ) : null}
        </ResponsiveButtonGroup>
      }
      title={client ? client.fullName : 'Детали клиента'}
    >
      {canManage && client ? (
        <ConfirmActionModal
          confirmColor={client.status === 'Active' ? 'gray' : 'teal'}
          confirmLabel={
            client.status === 'Active'
              ? 'Перевести в архив'
              : 'Вернуть в активные'
          }
          description={
            client.status === 'Active'
              ? 'Клиент исчезнет из активных выборок, но карточка и история останутся доступны.'
              : 'Клиент снова появится в активных списках и рабочих сценариях.'
          }
          onClose={() => setArchiveConfirmOpened(false)}
          onConfirm={() => void toggleArchive()}
          opened={archiveConfirmOpened}
          pending={actionPending}
          title={
            client.status === 'Active'
              ? 'Перевести клиента в архив?'
              : 'Вернуть клиента в активные?'
          }
        />
      ) : null}

      {canManage && client ? (
        <ClientTransferModal
          branchOptions={branchOptions}
          client={client}
          form={transferForm}
          formError={transferFormError}
          groupOptions={groupOptions}
          loadingOptions={transferOptionsLoading}
          opened={transferModalOpened}
          submitting={transferSubmitting}
          onClose={() => setTransferModalOpened(false)}
          onSubmit={submitTransfer}
        />
      ) : null}

      {loading ? (
        <PageSection>
          <Group justify="center" py="xl">
            <Loader color="var(--crm-action-primary)" />
          </Group>
        </PageSection>
      ) : null}

      {!loading && loadError ? (
        <PageSection>
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            title="Карточка клиента не загрузилась"
            variant="light"
          >
            {loadError}
          </Alert>
        </PageSection>
      ) : null}

      {!loading && !loadError && client ? (
        <>
          {actionError ? (
            <Alert
              color="red"
              icon={<IconAlertCircle size={18} />}
              title="Действие не выполнено"
              variant="light"
            >
              {actionError}
            </Alert>
          ) : null}

          <ClientOverviewSection
            canManage={canManage}
            client={client}
            membershipActionMode={membershipActionMode}
            onMembershipActionModeChange={toggleMembershipActionMode}
            onPhotoUpload={canManage ? handlePhotoUpload : undefined}
            pending={actionPending}
            photoVersion={photoVersion}
          />

          {canManage ? (
            <ClientMembershipSection
              actionMode={membershipActionMode}
              client={client}
              pending={actionPending}
              onCancelAction={cancelMembershipAction}
              onSubmit={handleMembershipAction}
              onMembershipCommentChange={handleMembershipCommentChange}
            />
          ) : null}

          <ClientAttendanceHistorySection canManage={canManage} client={client} />

          <ClientNotesSection client={client} />

          <ClientMessengerChatSection clientId={client.id} />

          <ClientRelatedSections
            canManage={canManage}
            client={client}
            onEdit={onEdit}
          />
        </>
      ) : null}
    </PageLayout>
  )
}

function applyMembershipSaleComment(
  client: ClientDetails,
  updatedMembership: ClientMembership,
): ClientDetails {
  const applyComment = (membership: ClientMembership) =>
    membership.saleId === updatedMembership.saleId
      ? {
          ...membership,
          comment: updatedMembership.comment,
          commentLastChangedByName:
            updatedMembership.commentLastChangedByName,
          commentLastChangedAt: updatedMembership.commentLastChangedAt,
        }
      : membership

  return {
    ...client,
    currentMembership: client.currentMembership
      ? applyComment(client.currentMembership)
      : null,
    membershipHistory: client.membershipHistory.map(applyComment),
  }
}
