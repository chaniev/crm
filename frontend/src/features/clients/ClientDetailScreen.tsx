import { ClientAccessErrorContext, isClientAccessError, useClientAccessBoundary } from './clientAccessBoundary'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Badge, Button, Group, Loader, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import {
  IconAlertCircle,
  IconArchive,
  IconArrowLeft,
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
import { ClientAvatar, ConfirmActionModal, PageLayout, PageSection } from '../shared/ux'
import { showAppNotification } from '../shared/notifications'
import type { NavigationGuardRegistration } from '../settings/useClientImport'
import { ClientDetailTabs } from './ClientDetailTabs'
import { ClientProfileEditor } from './ClientProfileEditor'
import { ClientGroupsEditor } from './ClientGroupsEditor'
import { ClientPhotoSection } from './ClientPhotoSection'
import { statusLabelMap } from './ClientManagement.formatting'
import { clientDetailText } from '../../resources/client-detail-tabs'
import { ClientMessengerChatSection } from './ClientMessengerChatSection'
import {
  ClientNotesSection,
  ClientRelatedSections,
} from './ClientDetailSections'
import {
  type ClientTransferFormValues,
  type MembershipActionSubmission,
} from './ClientManagement.types'
import { ClientTransferModal } from './ClientTransferModal'
import { ClientOverviewSection } from './ClientOverviewSection'
import { ClientMembershipSection } from './membership'
import { ClientAttendanceHistorySection } from './ClientAttendanceHistorySection'
import { useClientActionSubmissionKey } from './useClientActionSubmissionKey'
import { fe6ClientProfileText } from '../../resources/fe-6-client-profile'

const profileFields = [
  'lastName', 'firstName', 'middleName', 'fullName', 'birthDate', 'phone', 'telegramContactUsername',
  'notes', 'notesLastChangedAt', 'notesLastChangedByName', 'contacts', 'contactCount',
] as const
const groupFields = ['groups', 'groupIds', 'groupCount'] as const
const membershipFields = [
  'currentMemberships', 'membershipHistory', 'membershipState', 'hasActiveMembership', 'hasCurrentMembership',
  'membershipWarning', 'membershipWarningMessage', 'isProfessional', 'professionalComment', 'actionHints',
] as const

type ClientDetailScreenProps = {
  backLabel?: string
  clientId: string
  canManage: boolean
  onBack: () => void
  onNavigationGuardChange?: NavigationGuardRegistration
  canViewClientMessenger?: boolean
}

export function ClientDetailScreen({
  backLabel = fe6ClientProfileText.clientDetailScreen_string_fde25c93,
  clientId,
  canManage,
  onBack,
  canViewClientMessenger = false,
  onNavigationGuardChange,
}: ClientDetailScreenProps) {
  const [loadedClient, setClient] = useState<ClientDetails | null>(null)
  const { isCurrent, close, reportError, unavailable } = useClientAccessBoundary(clientId)
  const client = unavailable ? null : loadedClient
  const backRef = useRef<HTMLButtonElement>(null)
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
  const dirty = useRef({ profile: false, groups: false, memberships: false, messages: false })
  const draftChanges = useMemo(() => ({
    profile: (value: boolean) => { dirty.current.profile = value },
    groups: (value: boolean) => { dirty.current.groups = value },
    memberships: (value: boolean) => { dirty.current.memberships = value },
    messages: (value: boolean) => { dirty.current.messages = value },
  }), [])
  useEffect(() => {
    onNavigationGuardChange?.(action => {
      if (!Object.values(dirty.current).some(Boolean) || window.confirm(clientDetailText.discard)) action()
    })
    return () => onNavigationGuardChange?.(null)
  }, [onNavigationGuardChange])
  const getTransferSubmissionKey = useClientActionSubmissionKey()
  const actionPendingRef = useRef(false)
  const transferForm = useForm<ClientTransferFormValues>({
    initialValues: {
      branchId: '',
      groupId: '',
    },
  })

  useEffect(() => {
    if (!unavailable) return
    setClient(null)
    setLoading(false)
    setLoadError(fe6ClientProfileText.clientUnavailable)
    setActionError(null)
    setArchiveConfirmOpened(false)
    setTransferModalOpened(false)

    setPhotoVersion(null)
    setBranchOptions([])
    setGroupOptions([])
    backRef.current?.focus()
  }, [unavailable])

  const transferFormRef = useRef(transferForm)
  transferFormRef.current = transferForm
  useEffect(() => {
    if (unavailable) transferFormRef.current.reset()
  }, [unavailable])

  function handleMembershipCommentChange(
    updatedMembership: ClientMembership,
  ) {
    if (!isCurrent()) return
    setClient((currentClient) =>
      currentClient
        ? applyMembershipSaleComment(currentClient, updatedMembership)
        : currentClient,
    )
  }

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setClient(null)
      setLoading(true)
      setLoadError(null)

      try {
        const nextClient = await getClient(clientId, controller.signal)

        if (controller.signal.aborted || !isCurrent()) {
          return
        }

        setClient(nextClient)
      } catch (error) {
        if (controller.signal.aborted || !isCurrent()) {
          return
        }

        if (isClientAccessError(error)) { close(); return }
        setLoadError(
          error instanceof Error
            ? error.message
            : fe6ClientProfileText.clientDetailScreen_string_63fa9b9e,
        )
      } finally {
        if (!controller.signal.aborted && isCurrent()) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [clientId, close, isCurrent])

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

      if (!isCurrent()) return
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
      if (!isCurrent() || await reportError(error, false)) return
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
      if (!isCurrent()) return
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

      if (!isCurrent()) return
      if (updatedClient === null) close(false)
      setClient(updatedClient)
      setTransferModalOpened(false)

      showAppNotification({
        id: `client-transfer-${client.id}`,
        title: fe6ClientProfileText.clientDetailScreen_title_a6f3283a,
        message: fe6ClientProfileText.clientDetailScreen_message_66eefff6,
        color: 'teal',
      })
      if (updatedClient === null) {
        transferForm.reset()

        onBack()
      }
    } catch (error) {
      if (!isCurrent() || await reportError(error, false)) return
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

      const updatedClient = await getClient(client.id)
      if (!isCurrent()) return
      applySavedFields(updatedClient, membershipFields)

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
      if (isCurrent()) await reportError(error)
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
    const updatedClient = await getClient(client.id)
    if (!isCurrent()) return
    applySavedFields(updatedClient, ['photo'])
    setPhotoVersion(Date.now())
  }

  function applySavedFields(updated: ClientDetails, fields: readonly (keyof ClientDetails)[]) {
    if (!isCurrent()) return
    // Each response is a complete snapshot. Only the operation's own fields may
    // replace local state if two responses arrive in the opposite order.
    const patch = Object.fromEntries(fields.map(key => [key, updated[key]]))
    setClient(previous => previous ? { ...previous, ...patch } : null)
  }

  function back() {
    if (!client || !Object.values(dirty.current).some(Boolean) || window.confirm(clientDetailText.discard)) onBack()
  }

  const profileActions = (
    <Group gap="xs" className="client-profile-actions">
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
    </Group>
  )
  const backButton = (
    <Button leftSection={<IconArrowLeft size={18} />} onClick={back} ref={backRef} variant="subtle">
      {backLabel}
    </Button>
  )

  return (
    <ClientAccessErrorContext value={reportError}>
    <PageLayout
      className="client-detail-page"
      showHeader={!client}
      renderHiddenHeading={false}
      actions={backButton}
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

          <div>{backButton}</div>
          <Group gap="sm" wrap="nowrap" className="client-profile-identity">
            <ClientAvatar aria-hidden name={client.fullName} size={48} radius="xl" color="brand" />
            <div>
              <Title order={1}>{client.fullName}</Title>
              {canManage && <Badge color={client.status === 'Active' ? 'teal' : 'gray'} variant="light">{statusLabelMap[client.status]}</Badge>}
            </div>
          </Group>
          <ClientDetailTabs
            info={canManage ? (
              <ClientProfileEditor client={client} onSaved={updated => applySavedFields(updated, profileFields)} onDirtyChange={draftChanges.profile} actions={profileActions}
                photo={<ClientPhotoSection clientId={client.id} clientName={client.fullName} photo={client.photo}
                  canUpload onUpload={handlePhotoUpload} previewVersion={photoVersion ?? client.photo?.uploadedAt} variant="profile" />} />
            ) : (
              <><ClientOverviewSection showIdentity={false} client={client} canManage={false} photoVersion={photoVersion} actions={null} />
                <ClientNotesSection client={client} /></>
            )}
            memberships={canManage && <ClientMembershipSection
              client={client} pending={actionPending} onClientChange={updated => applySavedFields(updated, [...membershipFields, ...groupFields])}
              onDirtyChange={draftChanges.memberships} onSubmit={handleMembershipAction}
              onMembershipCommentChange={handleMembershipCommentChange}
            />}
            visits={<ClientAttendanceHistorySection key={client.branchId} canManage={canManage} client={client} />}
            groups={canManage
              ? <ClientGroupsEditor key={client.branchId} client={client} onSaved={updated => applySavedFields(updated, groupFields)} onDirtyChange={draftChanges.groups} />
              : <ClientRelatedSections canManage={false} client={client} onEdit={() => {}} />}
            messages={canViewClientMessenger ? active => (
              <ClientMessengerChatSection active={active} clientId={client.id} onDirtyChange={draftChanges.messages} />
            ) : undefined}
          />
        </>
      ) : null}
    </PageLayout>
    </ClientAccessErrorContext>
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
