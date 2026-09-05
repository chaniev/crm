
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
  type ClientTransferFormValues,
  type MembershipActionMode,
  type MembershipActionSubmission,
} from './ClientManagement.types'
import { ClientTransferModal } from './ClientTransferModal'
import { ClientOverviewSection } from './ClientOverviewSection'
import { ClientMembershipSection } from './membership'
import { ClientAttendanceHistorySection } from './ClientAttendanceHistorySection'
import { useClientActionSubmissionKey } from './useClientActionSubmissionKey'
import { fe6ClientProfileText } from '../../resources/fe-6-client-profile'


type ClientDetailScreenProps = {
  backLabel?: string
  clientId: string
  canManage: boolean
  onBack: () => void
  onEdit: (clientId: string) => void
}

export function ClientDetailScreen({
  backLabel = fe6ClientProfileText.clientDetailScreen_string_fde25c93,
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
  const [selectedMembershipId, setSelectedMembershipId] = useState<string | null>(null)
  const getTransferSubmissionKey = useClientActionSubmissionKey()
  const actionPendingRef = useRef(false)
  const transferForm = useForm<ClientTransferFormValues>({
    initialValues: {
      branchId: '',
      groupId: '',
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
            : fe6ClientProfileText.clientDetailScreen_string_63fa9b9e,
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
            ? fe6ClientProfileText.clientDetailScreen_string_9a24f729
            : fe6ClientProfileText.clientDetailScreen_string_a1149493,
        message:
          nextStatus === 'Archived'
            ? fe6ClientProfileText.clientDetailScreen_string_840e7ca3
            : fe6ClientProfileText.clientDetailScreen_string_ee9b8461,
        color: 'teal',
      })
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : fe6ClientProfileText.clientDetailScreen_string_da7e2d4f,
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
          : fe6ClientProfileText.clientDetailScreen_string_a2e2cac2,
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
      const payload = {
        targetBranchId: values.branchId,
        targetGroupIds: values.groupId ? [values.groupId] : [],
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
        title: fe6ClientProfileText.clientDetailScreen_title_a6f3283a,
        message: fe6ClientProfileText.clientDetailScreen_message_66eefff6,
        color: 'teal',
      })
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = applyFieldErrors(error.fieldErrors)
        transferForm.setErrors({
          ...fieldErrors,
          branchId:
            fieldErrors.branchId ??
            fieldErrors.targetBranchId,
          groupId:
            fieldErrors.groupId ??
            fieldErrors.targetGroupIds,
        })
        setTransferFormError(error.message)
        return
      }

      setTransferFormError(fe6ClientProfileText.clientDetailScreen_setTransferFormError_3cbae865)
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
      setSelectedMembershipId(null)

      const feedback =
        submission.kind === 'purchase'
          ? {
              title: fe6ClientProfileText.clientDetailScreen_title_7d8a509d,
              message: fe6ClientProfileText.clientDetailScreen_message_43ee725f,
            }
          : submission.kind === 'renew'
            ? {
                title: fe6ClientProfileText.clientDetailScreen_title_3c069df0,
                message: fe6ClientProfileText.clientDetailScreen_message_e33f1080,
              }
            : {
                title: fe6ClientProfileText.clientDetailScreen_title_db7198dc,
                message: fe6ClientProfileText.clientDetailScreen_message_154f1c05,
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
          : fe6ClientProfileText.clientDetailScreen_string_07dec05f,
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

  function toggleMembershipActionMode(mode: MembershipActionMode, membershipId?: string) {
    setActionError(null)
    setMembershipActionMode((currentMode) => {
      const nextMode = currentMode === mode && selectedMembershipId === (membershipId ?? null) ? null : mode
      setSelectedMembershipId(nextMode === null ? null : membershipId ?? null)
      return nextMode
    })
  }

  function cancelMembershipAction() {
    setActionError(null)
    setMembershipActionMode(null)
    setSelectedMembershipId(null)
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
              {fe6ClientProfileText.clientDetailScreen_jsxText_59792556}</Button>
          ) : null}
          {canManage && client ? (
            <Button
              leftSection={<IconGitBranch size={18} />}
              loading={transferOptionsLoading || transferSubmitting}
              onClick={() => void openTransferModal()}
              variant="light"
            >
              {fe6ClientProfileText.clientDetailScreen_jsxText_4ac45591}</Button>
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
                ? fe6ClientProfileText.clientDetailScreen_string_1ca66519
                : fe6ClientProfileText.clientDetailScreen_string_b2b51d6b}
            </Button>
          ) : null}
        </ResponsiveButtonGroup>
      }
      title={client ? client.fullName : fe6ClientProfileText.clientDetailScreen_string_48186f7a}
    >
      {canManage && client ? (
        <ConfirmActionModal
          confirmColor={client.status === 'Active' ? 'gray' : 'teal'}
          confirmLabel={
            client.status === 'Active'
              ? fe6ClientProfileText.clientDetailScreen_string_592928a6
              : fe6ClientProfileText.clientDetailScreen_string_b2b51d6b
          }
          description={
            client.status === 'Active'
              ? fe6ClientProfileText.clientDetailScreen_string_f868f3a1
              : fe6ClientProfileText.clientDetailScreen_string_62845e23
          }
          onClose={() => setArchiveConfirmOpened(false)}
          onConfirm={() => void toggleArchive()}
          opened={archiveConfirmOpened}
          pending={actionPending}
          title={
            client.status === 'Active'
              ? fe6ClientProfileText.clientDetailScreen_string_2f986cea
              : fe6ClientProfileText.clientDetailScreen_string_f988138d
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
            title={fe6ClientProfileText.clientDetailScreen_title_6c247ce7}
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
              title={fe6ClientProfileText.clientDetailScreen_title_7530f803}
              variant="light"
            >
              {actionError}
            </Alert>
          ) : null}

          <ClientOverviewSection
            canManage={canManage}
            client={client}
            onPhotoUpload={canManage ? handlePhotoUpload : undefined}
            photoVersion={photoVersion}
          />

          {canManage ? (
            <ClientMembershipSection
              actionMode={membershipActionMode}
              client={client}
              pending={actionPending}
              selectedMembershipId={selectedMembershipId}
              onCancelAction={cancelMembershipAction}
              onActionModeChange={toggleMembershipActionMode}
              onClientChange={setClient}
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
    currentMemberships: client.currentMemberships.map(applyComment),
    membershipHistory: client.membershipHistory.map(applyComment),
  }
}
