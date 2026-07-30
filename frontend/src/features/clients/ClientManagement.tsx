import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  MultiSelect,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { type UseFormReturnType, useForm } from '@mantine/form'
import {
  IconAlertCircle,
  IconArchive,
  IconArrowLeft,
  IconCamera,
  IconCheck,
  IconDeviceFloppy,
  IconEdit,
  IconGitBranch,
  IconPlus,
  IconPhotoOff,
  IconRefresh,
  IconTrash,
  IconUpload,
  IconUserHeart,
  IconUsersGroup,
} from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  archiveClient,
  buildClientPhotoUrl,
  correctClientMembership,
  createClient,
  getBranches,
  getClient,
  getGroups,
  getEligibleMembershipCatalogItems,
  getMembershipExpirationSuggestion,
  purchaseClientMembership,
  renewClientMembership,
  restoreClient,
  transferClientBranch,
  uploadClientPhoto,
  updateClientMembershipComment,
  type ClientAttendanceHistoryEntry,
  updateClient,
  type Branch,
  type ClientMembership,
  type ClientMembershipChangeReason,
  type ClientDetails,
  type ClientPhoto,
  type ClientStatus,
  type CorrectClientMembershipRequest,
  type MembershipBehaviorKind,
  type MembershipCatalogItem,
  type PurchaseClientMembershipRequest,
  type RenewClientMembershipRequest,
  type TrainingGroupListItem,
} from '../../lib/api'
import { formatNoteAttributionDate } from './noteAttribution'
import {
  formatClientBirthDate,
  getClientAgeDisplayValue,
} from './clientBirthDate'
import { formatGroupSchedule } from '../../lib/groupSchedule'
import { resources } from '../../lib/resources'
import {
  ConfirmActionModal,
  PageLayout,
  PageSection,
  ResponsiveButtonGroup,
} from '../shared/ux'
import { showAppNotification } from '../shared/notifications'
import {
  buildDraftClientName,
  clientFieldErrorAliases,
  createEmptyContact,
  maxContacts,
  toClientFormValues,
  toUpsertClientPayload,
  type ClientFormValues,
  useClientForm,
  validateClientForm,
} from './ClientManagement.form'
import { ClientMessengerChatSection } from './ClientMessengerChatSection'
import {
  MembershipSalePricingFields,
} from './MembershipSalePricingFields'
import {
  buildMembershipSalePricingPayload,
  createEmptyMembershipSalePricingValues,
  membershipSalePricingModeLabels,
  validateMembershipSalePricing,
  type MembershipSalePricingFieldErrors,
  type MembershipSalePricingValues,
} from './MembershipSalePricing'

export { ClientsListScreen } from './list/ClientsListScreen'

const clientPhotoMaxBytes = 10 * 1024 * 1024
const clientPhotoAcceptedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const
const clientPhotoAcceptedExtensions = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.heif',
] as const
const clientPhotoAcceptValue = [
  ...clientPhotoAcceptedExtensions,
  ...clientPhotoAcceptedMimeTypes,
].join(',')
const membershipChangeReasonLabels = resources.clients
  .membershipChangeReasonLabels satisfies Record<
  ClientMembershipChangeReason,
  string
>
type MembershipActionMode = 'purchase' | 'renew' | 'correct'

type MembershipCorrectionFormValues = {
  validFrom: string
  validTo: string
  paymentDate: string
}

type MembershipRenewFormValues = {
  paymentDate: string
  professionalComment: string
} & MembershipSalePricingValues

type MembershipActionSubmission =
  | {
      kind: 'purchase'
      payload: PurchaseClientMembershipRequest
      idempotencyKey: string
    }
  | {
      kind: 'renew'
      payload: RenewClientMembershipRequest
      idempotencyKey: string
    }
  | {
      kind: 'correct'
      payload: CorrectClientMembershipRequest
      idempotencyKey: string
    }

type ClientCreateScreenProps = {
  onCancel: () => void
  onCreated: (clientId?: string) => void
}

export function ClientCreateScreen({
  onCancel,
  onCreated,
}: ClientCreateScreenProps) {
  const [groupOptions, setGroupOptions] = useState<TrainingGroupListItem[]>([])
  const [branchOptions, setBranchOptions] = useState<Branch[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const form = useClientForm()
  const formRef = useRef(form)
  formRef.current = form

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoadingOptions(true)
      setLoadError(null)

      try {
        const [branches, groupsResponse] = await Promise.all([
          getBranches({ includeArchived: true }, controller.signal),
          getGroups({ take: 100 }, controller.signal),
        ])
        setBranchOptions(branches)
        setGroupOptions(groupsResponse.items)
        const firstActiveBranch = branches.find((branch) => !branch.isArchived)
        if (!formRef.current.values.branchId && firstActiveBranch) {
          formRef.current.setFieldValue('branchId', firstActiveBranch.id)
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setLoadError(
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить список групп.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoadingOptions(false)
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [])

  async function submit(values: ClientFormValues) {
    setFormError(null)
    form.clearErrors()

    const validationErrors = validateClientForm(values)
    if (Object.keys(validationErrors).length > 0) {
      form.setErrors(validationErrors)
      setFormError('Проверьте обязательные поля клиента и контактов.')
      return
    }

    setSubmitting(true)

    try {
      const createdClient = await createClient(toUpsertClientPayload(values))

      showAppNotification({
        id: 'client-create-success',
        title: 'Клиент создан',
        message: 'Базовая карточка клиента сохранена.',
        color: 'teal',
      })

      onCreated(createdClient?.id)
    } catch (error) {
      if (error instanceof ApiError) {
        form.setErrors(applyFieldErrors(error.fieldErrors, clientFieldErrorAliases))
        setFormError(error.message)
        return
      }

      setFormError('Не удалось создать клиента. Попробуйте еще раз.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageLayout
      actions={
        <Button
          leftSection={<IconArrowLeft size={18} />}
          onClick={onCancel}
          variant="default"
        >
          К списку клиентов
        </Button>
      }
      title="Новый клиент"
    >
      <PageSection>
        <Stack gap="lg">
          {loadingOptions ? (
            <Group justify="center" py="xl">
              <Loader color="var(--crm-action-primary)" />
            </Group>
          ) : null}

          {!loadingOptions && loadError ? (
            <Alert
              color="red"
              icon={<IconAlertCircle size={18} />}
              title="Не удалось подготовить форму"
              variant="light"
            >
              {loadError}
            </Alert>
          ) : null}

          {!loadingOptions && !loadError ? (
            <ClientForm
              form={form}
              formError={formError}
              branchOptions={branchOptions}
              groupOptions={groupOptions}
              lockBranch={false}
              cancelAction={{ label: 'Отменить', onClick: onCancel }}
              photoSection={
                <ClientPhotoSection
                  canUpload={false}
                  clientName={buildDraftClientName(form.values)}
                  photo={null}
                />
              }
              onSubmit={submit}
              submitLabel="Сохранить клиента"
              submitting={submitting}
            />
          ) : null}
        </Stack>
      </PageSection>
    </PageLayout>
  )
}

type ClientEditScreenProps = {
  clientId: string
  onBack: () => void
  onUpdated: (clientId: string) => void
}

export function ClientEditScreen({
  clientId,
  onBack,
  onUpdated,
}: ClientEditScreenProps) {
  const [client, setClient] = useState<ClientDetails | null>(null)
  const [groupOptions, setGroupOptions] = useState<TrainingGroupListItem[]>([])
  const [branchOptions, setBranchOptions] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [photoVersion, setPhotoVersion] = useState<number | null>(null)
  const form = useClientForm()
  const formRef = useRef(form)
  formRef.current = form

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setLoadError(null)

      try {
        const [nextClient, branches, groupsResponse] = await Promise.all([
          getClient(clientId, controller.signal),
          getBranches({ includeArchived: true }, controller.signal),
          getGroups({ take: 100 }, controller.signal),
        ])

        setClient(nextClient)
        setBranchOptions(branches)
        setGroupOptions(groupsResponse.items)
        formRef.current.setValues(toClientFormValues(nextClient))
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

  async function submit(values: ClientFormValues) {
    setFormError(null)
    form.clearErrors()

    const validationErrors = validateClientForm(values)
    if (Object.keys(validationErrors).length > 0) {
      form.setErrors(validationErrors)
      setFormError('Проверьте обязательные поля клиента и контактов.')
      return
    }

    setSubmitting(true)

    try {
      await updateClient(clientId, toUpsertClientPayload(values))

      showAppNotification({
        id: `client-edit-success-${clientId}`,
        title: 'Изменения сохранены',
        message: 'Карточка клиента обновлена.',
        color: 'teal',
      })

      onUpdated(clientId)
    } catch (error) {
      if (error instanceof ApiError) {
        form.setErrors(applyFieldErrors(error.fieldErrors, clientFieldErrorAliases))
        setFormError(error.message)
        return
      }

      setFormError('Не удалось сохранить изменения клиента.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePhotoUpload(file: File) {
    const updatedClient = await uploadClientPhoto(clientId, file)
    const nextClient = updatedClient ?? (await getClient(clientId))

    setClient(nextClient)
    setPhotoVersion(Date.now())
  }

  return (
    <PageLayout
      actions={
        <Button
          leftSection={<IconArrowLeft size={18} />}
          onClick={onBack}
          variant="default"
        >
          К карточке клиента
        </Button>
      }
      title={client ? client.fullName : 'Карточка клиента'}
    >

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

      {!loading && !loadError ? (
        <>
          <PageSection className="client-edit-card">
            <ClientForm
              form={form}
              formError={formError}
              branchOptions={branchOptions}
              groupOptions={groupOptions}
              lockBranch
              cancelAction={null}
              photoSection={
                client ? (
                  <ClientPhotoSection
                    canUpload
                    clientId={client.id}
                    clientName={client.fullName}
                    onUpload={handlePhotoUpload}
                    photo={client.photo}
                    previewVersion={photoVersion ?? client.photo?.uploadedAt ?? client.updatedAt}
                  />
                ) : null
              }
              onSubmit={submit}
              submitLabel="Сохранить изменения"
              submitting={submitting}
            />
          </PageSection>
        </>
      ) : null}
    </PageLayout>
  )
}

type ClientDetailScreenProps = {
  clientId: string
  canManage: boolean
  onBack: () => void
  onEdit: (clientId: string) => void
}

export function ClientDetailScreen({
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
  const getTransferSubmissionKey = useMembershipSubmissionKey()
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

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setLoadError(null)

      try {
        const nextClient = await getClient(clientId, controller.signal)
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
            К списку клиентов
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
              onClientChange={setClient}
            />
          ) : null}

          <ClientAttendanceHistorySection canManage={canManage} client={client} />

          <PageSection className="client-section-card">
            <Stack gap="lg">
              <Group gap="xs">
                <ThemeIcon color="var(--crm-action-primary)" radius="xl" size={34} variant="light">
                  <IconEdit size={18} />
                </ThemeIcon>
                <div>
                  <Text fw={700}>Рабочая заметка</Text>
                  <Text c="dimmed" size="sm">
                    Внутренняя заметка по клиенту, которая сохраняется в карточке.
                  </Text>
                </div>
              </Group>

              {client.notes ? (
                <Stack gap={4}>
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                    {client.notes}
                  </Text>
                  {client.notesLastChangedByName && client.notesLastChangedAt ? (
                    <NoteAttribution
                      authorName={client.notesLastChangedByName}
                      changedAt={client.notesLastChangedAt}
                    />
                  ) : null}
                </Stack>
              ) : (
                <Text c="dimmed" size="sm">
                  Рабочая заметка пока не добавлена.
                </Text>
              )}
            </Stack>
          </PageSection>

          <ClientMessengerChatSection clientId={client.id} />

          <SimpleGrid cols={{ base: 1, md: canManage ? 2 : 1 }}>
            {canManage ? (
              <PageSection className="client-section-card">
                <Stack gap="lg">
                  <Group gap="xs">
                    <ThemeIcon color="var(--crm-action-primary)" radius="xl" size={34} variant="light">
                      <IconUserHeart size={18} />
                    </ThemeIcon>
                    <div>
                      <Text fw={700}>Контактные лица</Text>
                      <Text c="dimmed" size="sm">
                        До двух контактных лиц для экстренной связи.
                      </Text>
                    </div>
                  </Group>

                  {client.contacts.length === 0 ? (
                    <Text c="dimmed" size="sm">
                      Контактные лица для клиента пока не добавлены.
                    </Text>
                  ) : (
                    <Stack gap="sm">
                      {client.contacts.map((contact, index) => (
                        <Paper
                          className="list-row-card"
                          key={contact.id ?? `${contact.fullName}-${index}`}
                          radius="8px"
                          withBorder
                        >
                          <Stack gap={6}>
                            <Group gap="sm" wrap="wrap">
                              <Text fw={700}>{contact.fullName}</Text>
                              <Badge radius="xl" variant="light">
                                {contact.type}
                              </Badge>
                            </Group>
                            <Text c="dimmed" size="sm">
                              Телефон: {contact.phone}
                            </Text>
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  )}
                </Stack>
              </PageSection>
            ) : null}

            <PageSection className="client-section-card">
              <Stack gap="lg">
                <Group justify="space-between" wrap="wrap">
                  <Group gap="xs">
                    <ThemeIcon color="var(--crm-action-primary)" radius="xl" size={34} variant="light">
                      <IconUsersGroup size={18} />
                    </ThemeIcon>
                    <div>
                      <Text fw={700}>Группы клиента</Text>
                      <Text c="dimmed" size="sm">
                        Блок показывает текущую привязку клиента к тренировочным группам.
                      </Text>
                    </div>
                  </Group>

                  {canManage ? (
                    <Button
                      leftSection={<IconEdit size={18} />}
                      onClick={() => onEdit(client.id)}
                      variant="light"
                    >
                      Изменить группы
                    </Button>
                  ) : null}
                </Group>

                {client.groups.length === 0 ? (
                  <Text c="dimmed" size="sm">
                    Клиент пока не включен ни в одну группу.
                  </Text>
                ) : (
                  <Stack gap="sm">
                    {client.groups.map((group) => (
                      <Paper
                        className="list-row-card"
                        key={group.id}
                        radius="8px"
                        withBorder
                      >
                        <Stack gap={6}>
                          <Group gap="sm" wrap="wrap">
                            <Text fw={700}>{group.name}</Text>
                            <Badge
                              color={group.isActive ? 'teal' : 'gray'}
                              radius="xl"
                              variant="light"
                            >
                              {group.isActive ? 'Активна' : 'Неактивна'}
                            </Badge>
                          </Group>
                          <Text c="dimmed" size="sm">
                            {group.trainingStartTime
                              ? `Старт: ${group.trainingStartTime}`
                              : 'Время начала не указано'}
                            {group.weekdays && typeof group.durationMinutes === 'number'
                              ? ` • ${formatGroupSchedule(group.weekdays, group.durationMinutes)}`
                              : ''}
                          </Text>
                          {group.branchName || group.hallName ? (
                            <Text c="dimmed" size="sm">
                              {[group.branchName, group.hallName]
                                .filter(Boolean)
                                .join(' · ')}
                            </Text>
                          ) : null}
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Stack>
            </PageSection>
          </SimpleGrid>
        </>
      ) : null}
    </PageLayout>
  )
}

function NoteAttribution({ authorName, changedAt }: { authorName: string; changedAt: string }) {
  const formattedDate = formatNoteAttributionDate(changedAt)

  return formattedDate ? (
    <Text c="dimmed" size="xs" style={{ overflowWrap: 'anywhere' }}>
      {authorName} · {formattedDate}
    </Text>
  ) : null
}

type ClientFormProps = {
  form: UseFormReturnType<ClientFormValues>
  formError: string | null
  branchOptions: Branch[]
  groupOptions: TrainingGroupListItem[]
  lockBranch?: boolean
  cancelAction: { label: string; onClick: () => void } | null
  photoSection?: ReactNode
  onSubmit: (values: ClientFormValues) => Promise<void>
  submitLabel: string
  submitting: boolean
}

type ClientOverviewSectionProps = {
  canManage: boolean
  client: ClientDetails
  membershipActionMode: MembershipActionMode | null
  onMembershipActionModeChange: (mode: MembershipActionMode) => void
  onPhotoUpload?: (file: File) => Promise<void>
  pending: boolean
  photoVersion: number | null
}

function ClientOverviewSection({
  canManage,
  client,
  membershipActionMode,
  onMembershipActionModeChange,
  onPhotoUpload,
  pending,
  photoVersion,
}: ClientOverviewSectionProps) {
  const groupsValue =
    client.groups.length > 0
      ? formatPreviewList(client.groups.map((group) => group.name), 2)
      : canManage
        ? 'Не выбраны'
        : 'Нет доступных групп'
  const contactsValue =
    client.contacts.length > 0
      ? formatPreviewList(client.contacts.map((contact) => contact.fullName), 2)
      : 'Не добавлены'
  const visitsValue = client.attendanceHistoryLoaded
    ? `${client.attendanceHistoryTotalCount ?? client.attendanceHistory.length}`
    : 'Загружаются'
  const birthDateValue = formatClientBirthDate(client.birthDate) ?? 'Не указана'
  const ageValue = client.birthDate
    ? getClientAgeDisplayValue(client.birthDate, client.businessDate)
    : null

  return (
    <PageSection className="client-overview-card">
      <div className="client-overview-grid">
        <Stack className="client-overview-main" gap="md">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Text className="client-overview-eyebrow" size="xs">
                {canManage ? 'Клиент' : 'Клиент тренера'}
              </Text>
              <Title order={2} className="client-overview-title">
                {client.fullName}
              </Title>
            </div>

            <Group gap="xs" justify="flex-end" wrap="wrap">
              {canManage ? (
                <Badge
                  color={client.status === 'Active' ? 'teal' : 'gray'}
                  radius="sm"
                  size="lg"
                  variant="light"
                >
                  {statusLabelMap[client.status]}
                </Badge>
              ) : null}
              {client.isProfessional ? (
                <Badge color="blue" radius="sm" size="lg" variant="light">
                  Профессионал
                </Badge>
              ) : null}
            </Group>
          </Group>

          {!canManage ? (
            <Alert
              color="blue"
              icon={<IconCheck size={18} />}
              title="Доступ тренера"
              variant="light"
            >
              Видны фото, ФИО, рабочая заметка, назначенные группы и история
              посещений.
            </Alert>
          ) : null}

          {client.isProfessional ? (
            <Alert
              color="blue"
              icon={<IconUserHeart size={18} />}
              title="Профессионал"
              variant="light"
            >
              {client.professionalComment || 'Профессиональный статус'}
            </Alert>
          ) : null}

          <SimpleGrid cols={{ base: 1, sm: 2, xl: canManage ? 4 : 3 }}>
            {canManage ? (
              <>
                <CompactInfoItem label="Телефон" value={client.phone || 'Не указан'} />
                <CompactInfoItem label="Филиал" value={client.branchName || 'Не указан'} />
                <CompactInfoItem label="Фамилия" value={client.lastName || 'Не указана'} />
                <CompactInfoItem label="Имя" value={client.firstName || 'Не указано'} />
                <CompactInfoItem label="Отчество" value={client.middleName || 'Не указано'} />
              </>
            ) : null}
            <CompactInfoItem label="Дата рождения" value={birthDateValue} />
            {ageValue ? <CompactInfoItem label="Возраст" value={ageValue} /> : null}
            <CompactInfoItem label="Группы" value={groupsValue} />
            {canManage ? <CompactInfoItem label="Контакты" value={contactsValue} /> : null}
            <CompactInfoItem label="Посещений" value={visitsValue} />
            <CompactInfoItem
              label="Последнее посещение"
              value={formatDateValue(client.lastVisitDate)}
            />
          </SimpleGrid>

          {canManage ? (
            <ClientMembershipSnapshot
              actionMode={membershipActionMode}
              currentMembership={client.currentMembership}
              isProfessional={client.isProfessional}
              onActionModeChange={onMembershipActionModeChange}
              pending={pending}
              professionalComment={client.professionalComment}
            />
          ) : null}
        </Stack>

        <aside className="client-overview-rail">
          <ClientPhotoSection
            canUpload={canManage}
            clientId={client.id}
            clientName={client.fullName}
            onUpload={onPhotoUpload}
            photo={client.photo}
            previewVersion={photoVersion ?? client.photo?.uploadedAt ?? client.updatedAt}
            variant="compact"
          />
        </aside>
      </div>
    </PageSection>
  )
}

type ClientMembershipSnapshotProps = {
  actionMode: MembershipActionMode | null
  currentMembership: ClientMembership | null
  isProfessional: boolean
  onActionModeChange: (mode: MembershipActionMode) => void
  pending: boolean
  professionalComment: string | null
}

function ClientMembershipSnapshot({
  actionMode,
  currentMembership,
  isProfessional,
  onActionModeChange,
  pending,
  professionalComment,
}: ClientMembershipSnapshotProps) {
  if (isProfessional) {
    const canRenewFiniteProfessional =
      currentMembership?.behaviorKind === 'Professional' &&
      currentMembership.expirationDate !== null

    return (
      <Paper className="client-membership-snapshot" radius="8px" withBorder>
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Text fw={700}>Профессиональный статус</Text>
              <Text c="dimmed" size="sm">
                {professionalComment || 'Профессионал не попадает в должники.'}
              </Text>
            </div>
            <Badge color="blue" radius="sm" variant="light">
              Профессионал
            </Badge>
          </Group>

          {canRenewFiniteProfessional ? (
            <Group>
              <Button
                disabled={pending}
                onClick={() => onActionModeChange('renew')}
                variant={actionMode === 'renew' ? 'filled' : 'light'}
              >
                Продлить
              </Button>
            </Group>
          ) : null}
        </Stack>
      </Paper>
    )
  }

  if (!currentMembership) {
    return (
      <Paper className="client-membership-snapshot" radius="8px" withBorder>
        <Group justify="space-between" wrap="wrap">
          <div>
            <Text fw={700}>Абонемент не оформлен</Text>
            <Text c="dimmed" size="sm">
              Создайте абонемент, когда клиент оплатит первое посещение.
            </Text>
          </div>
          <Button
            disabled={pending}
            onClick={() => onActionModeChange('purchase')}
            variant={actionMode === 'purchase' ? 'filled' : 'light'}
          >
            Новый абонемент
          </Button>
        </Group>
      </Paper>
    )
  }

  return (
    <Paper className="client-membership-snapshot" radius="8px" withBorder>
      <Stack gap="md">
        <Group justify="space-between" wrap="wrap">
          <div>
            <Text fw={700}>Абонемент и оплата</Text>
            <Text c="dimmed" size="sm">
              Текущий срок, сумма и даты продажи.
            </Text>
          </div>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          <CompactInfoItem
            label="Абонемент"
            value={currentMembership.membershipName}
          />
          <CompactInfoItem
            label="Действует до"
            value={formatExpirationValue(
              currentMembership.behaviorKind,
              currentMembership.expirationDate,
            )}
          />
          <CompactInfoItem
            label="Сумма"
            value={formatCurrencyValue(currentMembership.grossAmount)}
          />
          <CompactInfoItem
            label="Расчёт"
            value={formatMembershipPricingProvenance(currentMembership)}
          />
          <CompactInfoItem
            label="Дата оплаты"
            value={formatDateValue(currentMembership.paymentDate)}
          />
          <CompactInfoItem
            label="Записал"
            value={formatPaymentRecordingValue(currentMembership)}
          />
        </SimpleGrid>

        <Group gap="sm" wrap="wrap">
          <Button
            disabled={pending}
            onClick={() => onActionModeChange('renew')}
            variant={actionMode === 'renew' ? 'filled' : 'light'}
          >
            Продлить
          </Button>
          <Button
            disabled={pending}
            onClick={() => onActionModeChange('purchase')}
            variant={actionMode === 'purchase' ? 'filled' : 'light'}
          >
            Новый абонемент
          </Button>
          <Button
            disabled={pending}
            onClick={() => onActionModeChange('correct')}
            variant={actionMode === 'correct' ? 'filled' : 'light'}
          >
            Исправить
          </Button>
        </Group>
      </Stack>
    </Paper>
  )
}

type CompactInfoItemProps = {
  label: string
  value: string
}

function CompactInfoItem({
  label,
  value,
}: CompactInfoItemProps) {
  return (
    <div className="compact-info-item">
      <Text c="dimmed" fw={600} size="xs">
        {label}
      </Text>
      <Text fw={700} size="sm">
        {value}
      </Text>
    </div>
  )
}

function ClientForm({
  form,
  formError,
  branchOptions,
  groupOptions,
  lockBranch = false,
  cancelAction,
  photoSection,
  onSubmit,
  submitLabel,
  submitting,
}: ClientFormProps) {
  const selectedBranchId =
    form.values.branchId ||
    branchOptions.find((branch) => !branch.isArchived)?.id ||
    ''
  const filteredGroupOptions = selectedBranchId
    ? groupOptions.filter((group) => group.branchId === selectedBranchId)
    : []

  function addContact() {
    if (form.values.contacts.length >= maxContacts) {
      return
    }

    form.setFieldValue('contacts', [...form.values.contacts, createEmptyContact()])
  }

  function removeContact(contactIndex: number) {
    form.setFieldValue(
      'contacts',
      form.values.contacts.filter((_, index) => index !== contactIndex),
    )
  }

  function updateBranch(branchId: string | null) {
    const nextBranchId = branchId ?? ''
    const nextAllowedGroupIds = new Set(
      groupOptions
        .filter((group) => group.branchId === nextBranchId)
        .map((group) => group.id),
    )

    form.setFieldValue('branchId', nextBranchId)
    form.setFieldValue(
      'groupIds',
      form.values.groupIds.filter((groupId) => nextAllowedGroupIds.has(groupId)),
    )
  }

  return (
    <form
      onSubmit={form.onSubmit((values) =>
        void onSubmit({
          ...values,
          branchId: values.branchId || selectedBranchId,
        }),
      )}
    >
      <Stack gap="lg">
        {formError ? (
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            title="Сохранение не выполнено"
            variant="light"
          >
            {formError}
          </Alert>
        ) : null}

        <div className="client-edit-grid">
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, md: 3 }}>
              <TextInput
                label="Фамилия"
                placeholder="Иванов"
                {...form.getInputProps('lastName')}
              />
              <TextInput
                label="Имя"
                placeholder="Иван"
                {...form.getInputProps('firstName')}
              />
              <TextInput
                label="Отчество"
                placeholder="Иванович"
                {...form.getInputProps('middleName')}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <TextInput
                label="Телефон"
                placeholder="+7(999) 000-00-00"
                {...form.getInputProps('phone')}
              />

              <Select
                allowDeselect={false}
                data={branchOptions.map((branch) => ({
                  value: branch.id,
                  label: formatBranchOptionLabel(branch),
                  disabled: branch.isArchived,
                }))}
                disabled={lockBranch}
                label="Филиал"
                onChange={updateBranch}
                placeholder="Выберите филиал"
                searchable
                value={selectedBranchId || null}
                error={form.errors.branchId}
              />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <MultiSelect
                data={filteredGroupOptions.map((group) => ({
                  value: group.id,
                  label: formatGroupOptionLabel(group),
                }))}
                disabled={!selectedBranchId}
                label="Группы клиента"
                placeholder={
                  selectedBranchId
                    ? 'Выберите группы'
                    : 'Сначала выберите филиал'
                }
                searchable
                {...form.getInputProps('groupIds')}
              />
              <TextInput
                label="Дата рождения"
                type="date"
                {...form.getInputProps('birthDate')}
              />
            </SimpleGrid>

            <Textarea
              autosize
              label="Рабочая заметка"
              minRows={4}
              placeholder="Например: предпочитает связь после 18:00, важные детали по посещениям или оплате."
              {...form.getInputProps('notes')}
            />
          </Stack>

          <aside className="client-edit-rail">{photoSection}</aside>
        </div>

        <Paper className="hint-card" radius="8px" withBorder>
          <Stack gap="md">
            <Group justify="space-between" wrap="wrap">
              <div>
                <Text fw={700}>Контактные лица</Text>
                <Text c="dimmed" size="sm">
                  Можно указать до двух контактов. Пустые строки не будут сохранены.
                </Text>
              </div>

              <Button
                disabled={form.values.contacts.length >= maxContacts}
                leftSection={<IconPlus size={18} />}
                onClick={addContact}
                type="button"
                variant="light"
              >
                Добавить контакт
              </Button>
            </Group>

            {form.values.contacts.length === 0 ? (
              <Text c="dimmed" size="sm">
                Контактные лица пока не добавлены.
              </Text>
            ) : (
              <Stack gap="sm">
                {form.values.contacts.map((_, index) => (
                  <Paper className="list-row-card" key={index} radius="8px" withBorder>
                    <Stack gap="md">
                      <Group justify="space-between" wrap="wrap">
                        <Text fw={700}>Контакт #{index + 1}</Text>
                        <ActionIcon
                          aria-label={`Удалить контакт ${index + 1}`}
                          color="red"
                          onClick={() => removeContact(index)}
                          type="button"
                          variant="light"
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>

                      <SimpleGrid cols={{ base: 1, md: 3 }}>
                        <TextInput
                          label="Тип контакта"
                          placeholder="Мама / Папа / Другой"
                          {...form.getInputProps(`contacts.${index}.type`)}
                        />
                        <TextInput
                          label="ФИО контактного лица"
                          placeholder="Анна Иванова"
                          {...form.getInputProps(`contacts.${index}.fullName`)}
                        />
                        <TextInput
                          label="Телефон контакта"
                          placeholder="+7(999) 000-00-01"
                          {...form.getInputProps(`contacts.${index}.phone`)}
                        />
                      </SimpleGrid>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Stack>
        </Paper>

        <ResponsiveButtonGroup justify={cancelAction ? 'space-between' : 'flex-end'}>
          {cancelAction ? (
            <Button onClick={cancelAction.onClick} type="button" variant="subtle">
              {cancelAction.label}
            </Button>
          ) : null}
          <Button
            leftSection={<IconDeviceFloppy size={18} />}
            loading={submitting}
            type="submit"
          >
            {submitLabel}
          </Button>
        </ResponsiveButtonGroup>
      </Stack>
    </form>
  )
}

type ClientTransferFormValues = MembershipSalePricingValues & {
  branchId: string
  groupId: string
  validFrom: string
  validTo: string
  paymentDate: string
  professionalComment: string
}

type ClientTransferModalProps = {
  branchOptions: Branch[]
  client: ClientDetails
  form: UseFormReturnType<ClientTransferFormValues>
  formError: string | null
  groupOptions: TrainingGroupListItem[]
  loadingOptions: boolean
  opened: boolean
  submitting: boolean
  onClose: () => void
  onSubmit: (values: ClientTransferFormValues) => Promise<void>
}

function ClientTransferModal({
  branchOptions,
  client,
  form,
  formError,
  groupOptions,
  loadingOptions,
  opened,
  submitting,
  onClose,
  onSubmit,
}: ClientTransferModalProps) {
  const [catalogItems, setCatalogItems] = useState<MembershipCatalogItem[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [confirmationOpened, setConfirmationOpened] = useState(false)
  const selectedBranchId = form.values.branchId
  const filteredGroupOptions = selectedBranchId
    ? groupOptions.filter((group) => group.branchId === selectedBranchId)
    : []
  const currentGroup = client.groups[0]
  const movesUnusedSingleVisit = client.currentMembership?.behaviorKind === 'SingleVisit' && !client.currentMembership.singleVisitUsed
  const selectedCatalogItem = catalogItems.find((item) => item.id === form.values.membershipCatalogItemId)

  useEffect(() => {
    if (!opened || !selectedBranchId || movesUnusedSingleVisit) return
    const controller = new AbortController()
    void getEligibleMembershipCatalogItems(selectedBranchId, controller.signal)
      .then(setCatalogItems)
      .catch(() => setCatalogItems([]))
      .finally(() => { if (!controller.signal.aborted) setCatalogLoading(false) })
    return () => controller.abort()
  }, [movesUnusedSingleVisit, opened, selectedBranchId])

  function updateBranch(branchId: string | null) {
    form.setFieldValue('branchId', branchId ?? '')
    form.setFieldValue('groupId', '')
    form.setValues({
      ...form.values,
      branchId: branchId ?? '',
      groupId: '',
      ...createEmptyMembershipSalePricingValues(),
    })
    setCatalogItems([])
    setCatalogLoading(Boolean(branchId))
  }

  function requestConfirmation(values: ClientTransferFormValues) {
    if (movesUnusedSingleVisit) {
      void onSubmit(values)
      return
    }

    const pricingErrors = validateMembershipSalePricing(values)
    const errors: Record<string, string> = { ...pricingErrors }
    if (!values.paymentDate) {
      errors.paymentDate = 'Укажите дату оплаты.'
    }
    if (Object.keys(errors).length > 0) {
      form.setErrors(errors)
      return
    }

    setConfirmationOpened(true)
  }

  return (
    <Modal
      centered
      onClose={onClose}
      opened={opened}
      radius="8px"
      title="Перевод клиента"
      withCloseButton={!submitting}
    >
      <MembershipSaleConfirmationModal
        catalogItem={selectedCatalogItem}
        onClose={() => setConfirmationOpened(false)}
        onConfirm={() => {
          setConfirmationOpened(false)
          void onSubmit(form.values)
        }}
        opened={confirmationOpened}
        pending={submitting}
        values={form.values}
      />

      <form noValidate onSubmit={form.onSubmit(requestConfirmation)}>
        <Stack gap="md">
          <Paper className="hint-card" radius="8px" withBorder>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <InfoItem
                label="Текущий филиал"
                value={client.branchName || 'Не указан'}
              />
              <InfoItem
                label="Текущая группа"
                value={currentGroup?.name ?? 'Без группы'}
              />
            </SimpleGrid>
          </Paper>

          {formError ? (
            <Alert
              color="red"
              icon={<IconAlertCircle size={18} />}
              title="Перевод не выполнен"
              variant="light"
            >
              {formError}
            </Alert>
          ) : null}

          <Select
            allowDeselect={false}
            data={branchOptions.map((branch) => ({
              value: branch.id,
              label: formatBranchOptionLabel(branch),
              disabled: branch.isArchived,
            }))}
            disabled={loadingOptions}
            label="Целевой филиал"
            onChange={updateBranch}
            placeholder={loadingOptions ? 'Загружаем филиалы' : 'Выберите филиал'}
            searchable
            value={form.values.branchId || null}
            error={form.errors.branchId}
          />

          <Select
            clearable
            data={filteredGroupOptions.map((group) => ({
              value: group.id,
              label: formatGroupOptionLabel(group),
              disabled: !group.isActive,
            }))}
            disabled={!selectedBranchId || loadingOptions}
            label="Новая группа"
            onChange={(groupId) => form.setFieldValue('groupId', groupId ?? '')}
            placeholder={
              selectedBranchId
                ? 'Можно оставить без группы'
                : 'Сначала выберите филиал'
            }
            searchable
            value={form.values.groupId || null}
            error={form.errors.groupId}
          />

          {movesUnusedSingleVisit ? <Alert color="blue">Разовое посещение ещё не использовано. Оно будет перенесено без новой продажи.</Alert> : <>
            <MembershipSalePricingFields
              catalogItems={catalogItems}
              disabled={!selectedBranchId}
              errors={pickPricingFieldErrors(form.errors)}
              loading={catalogLoading}
              onChange={(pricingValues) => {
                form.setValues({ ...form.values, ...pricingValues })
                form.clearFieldError('pricingMode')
                form.clearFieldError('membershipCatalogItemId')
                form.clearFieldError('manualSaleAmount')
              }}
              values={form.values}
            />
            {form.values.pricingMode === 'AmountOnly' ||
            (selectedCatalogItem !== undefined &&
              selectedCatalogItem.behaviorKind !== 'SingleVisit') ? <SimpleGrid cols={{ base: 1, sm: 2 }}><TextInput label="Действует с" type="date" {...form.getInputProps('validFrom')}/><TextInput label="Действует по" type="date" {...form.getInputProps('validTo')}/></SimpleGrid> : null}
            {selectedCatalogItem?.behaviorKind === 'Professional' ? <Textarea label="Комментарий" {...form.getInputProps('professionalComment')}/> : null}
            <PaymentDateInput
              error={form.errors.paymentDate}
              max={client.businessDate}
              onChange={(value) => form.setFieldValue('paymentDate', value)}
              value={form.values.paymentDate}
            />
          </>}

          <ResponsiveButtonGroup justify="space-between">
            <Button disabled={submitting} onClick={onClose} type="button" variant="subtle">
              Отменить
            </Button>
            <Button
              leftSection={<IconGitBranch size={18} />}
              loading={submitting || loadingOptions}
              type="submit"
            >
              Перевести клиента
            </Button>
          </ResponsiveButtonGroup>
        </Stack>
      </form>
    </Modal>
  )
}

type InfoItemProps = {
  label: string
  value: string
}

function InfoItem({
  label,
  value,
}: InfoItemProps) {
  return (
    <Paper className="hint-card" radius="8px" withBorder>
      <Stack gap={4}>
        <Text c="dimmed" fw={600} size="xs">
          {label}
        </Text>
        <Text fw={700}>{value}</Text>
      </Stack>
    </Paper>
  )
}

type PaymentDateInputProps = {
  value: string
  max: string
  error?: ReactNode
  onChange: (value: string) => void
}

function PaymentDateInput({
  value,
  max,
  error,
  onChange,
}: PaymentDateInputProps) {
  return (
    <TextInput
      error={error}
      label="Дата оплаты"
      max={max}
      onChange={(event) => onChange(event.currentTarget.value)}
      required
      type="date"
      value={value}
      withAsterisk={false}
    />
  )
}

type MembershipSaleConfirmationModalProps = {
  catalogItem?: MembershipCatalogItem
  opened: boolean
  pending: boolean
  values: MembershipSalePricingValues & { paymentDate: string }
  onClose: () => void
  onConfirm: () => void
}

function MembershipSaleConfirmationModal({
  catalogItem,
  opened,
  pending,
  values,
  onClose,
  onConfirm,
}: MembershipSaleConfirmationModalProps) {
  const actualAmount =
    values.pricingMode === 'Catalog'
      ? catalogItem?.price
      : Number(values.manualSaleAmount)

  return (
    <Modal
      centered
      onClose={onClose}
      opened={opened}
      radius="24px"
      title="Подтвердить новую продажу?"
      withCloseButton={!pending}
    >
      <Stack gap="lg">
        <Text c="dimmed" size="sm">
          Проверьте способ расчёта и фактическую сумму. Эти данные сохранятся
          в истории продажи.
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <InfoItem
            label="Способ расчёта"
            value={
              values.pricingMode
                ? membershipSalePricingModeLabels[values.pricingMode]
                : 'Не выбран'
            }
          />
          <InfoItem
            label="Фактическая сумма"
            value={
              typeof actualAmount === 'number' && Number.isFinite(actualAmount)
                ? formatCurrencyValue(actualAmount)
                : 'Не указана'
            }
          />
          <InfoItem
            label="Дата оплаты"
            value={formatDateValue(values.paymentDate)}
          />
        </SimpleGrid>
        <ResponsiveButtonGroup justify="flex-end">
          <Button disabled={pending} onClick={onClose} variant="subtle">
            Отменить
          </Button>
          <Button loading={pending} onClick={onConfirm}>
            Подтвердить продажу
          </Button>
        </ResponsiveButtonGroup>
      </Stack>
    </Modal>
  )
}

type ClientPhotoSectionProps = {
  canUpload: boolean
  clientId?: string
  clientName: string
  onUpload?: (file: File) => Promise<void>
  photo: ClientPhoto | null
  previewVersion?: string | number | null
  variant?: 'default' | 'compact'
}

function ClientPhotoSection({
  canUpload,
  clientId,
  clientName,
  onUpload,
  photo,
  previewVersion,
  variant = 'default',
}: ClientPhotoSectionProps) {
  const inputId = useId()
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [previewOpened, setPreviewOpened] = useState(false)
  const [previewStatus, setPreviewStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >(() => (clientId && photo ? 'loading' : 'idle'))
  const previewUrl = clientId && photo
    ? buildClientPhotoUrl(
        clientId,
        previewVersion ?? photo?.uploadedAt ?? photo?.path ?? 'current',
      )
    : null

  useEffect(() => {
    setPreviewStatus(previewUrl ? 'loading' : 'idle')
  }, [previewUrl])

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.currentTarget.files?.[0] ?? null
    event.currentTarget.value = ''

    if (!file) {
      return
    }

    const validationError = validateClientPhotoFile(file)

    if (validationError) {
      setUploadError(validationError)
      return
    }

    if (!onUpload) {
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      await onUpload(file)

      showAppNotification({
        id: 'client-photo-upload-success',
        title: 'Фотография обновлена',
        message: 'Карточка клиента получила новую фотографию.',
        color: 'teal',
      })
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : 'Не удалось загрузить фотографию клиента.',
      )
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <Modal
        centered
        onClose={() => setPreviewOpened(false)}
        opened={previewOpened && Boolean(previewUrl)}
        radius="8px"
        size="xl"
        title={`Фотография клиента ${clientName}`}
      >
        {previewUrl ? (
          <img
            alt={`Фотография клиента ${clientName}`}
            className="client-photo-modal-image"
            src={previewUrl}
          />
        ) : null}
      </Modal>

      <Paper
        className={`hint-card client-photo-card${variant === 'compact' ? ' client-photo-card--compact' : ''}`}
        radius="8px"
        withBorder
      >
      <Stack gap="md">
        <Group justify="space-between" wrap="wrap">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon color="var(--crm-action-primary)" radius="xl" size={38} variant="light">
              <IconCamera size={20} />
            </ThemeIcon>
            <div>
              <Text fw={700}>{variant === 'compact' ? 'Фото' : 'Фотография клиента'}</Text>
              <Text c="dimmed" size="sm">
                {canUpload
                  ? 'Можно заменить фото клиента.'
                  : clientId
                    ? 'Фото доступно для просмотра.'
                    : 'Фото можно добавить сразу после первичного сохранения карточки клиента.'}
              </Text>
            </div>
          </Group>

          {variant === 'default' ? (
            <Badge color="var(--crm-brand-primary-soft)" radius="sm" variant="light">
              {canUpload ? 'Загрузка' : 'Просмотр'}
            </Badge>
          ) : null}
        </Group>

        <div className="client-photo-preview">
          {previewUrl ? (
            <>
              {previewStatus === 'loading' ? (
                <Group className="client-photo-placeholder" justify="center">
                  <Loader color="var(--crm-action-primary)" size="sm" />
                </Group>
              ) : null}

              {previewStatus !== 'error' ? (
                <button
                  aria-label={`Открыть фотографию клиента ${clientName}`}
                  className="client-photo-preview__button"
                  disabled={previewStatus !== 'ready'}
                  onClick={() => setPreviewOpened(true)}
                  type="button"
                >
                  <img
                    alt={`Фотография клиента ${clientName}`}
                    className="client-photo-preview__image"
                    onError={() => setPreviewStatus('error')}
                    onLoad={() => setPreviewStatus('ready')}
                    src={previewUrl}
                    style={{
                      display: previewStatus === 'ready' ? 'block' : 'none',
                    }}
                  />
                </button>
              ) : null}
            </>
          ) : null}

          {!previewUrl || previewStatus === 'error' ? (
            <Stack
              align="center"
              className="client-photo-placeholder"
              gap="xs"
              justify="center"
            >
              <ThemeIcon color="gray" radius="xl" size={42} variant="light">
                <IconPhotoOff size={20} />
              </ThemeIcon>
              <Text fw={600}>Фото пока не показано</Text>
              <Text c="dimmed" size="sm" ta="center">
                {clientId
                  ? 'Фотография еще не загружена или недоступна для просмотра.'
                  : 'Сначала сохраните клиента, затем вернитесь в карточку или редактирование, чтобы загрузить фотографию.'}
              </Text>
            </Stack>
          ) : null}
        </div>

        {photo ? (
          <Group className="client-photo-meta" gap="xs" wrap="wrap">
            {photo.contentType ? (
              <Badge color="sand" radius="sm" variant="light">
                {photo.contentType}
              </Badge>
            ) : null}
            {typeof photo.sizeBytes === 'number' ? (
              <Badge color="sand" radius="sm" variant="light">
                {formatFileSize(photo.sizeBytes)}
              </Badge>
            ) : null}
            {photo.uploadedAt ? (
              <Badge color="sand" radius="sm" variant="light">
                Загружено: {formatDateTimeValue(photo.uploadedAt)}
              </Badge>
            ) : null}
          </Group>
        ) : null}

        {uploadError ? (
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            title="Фото не загружено"
            variant="light"
          >
            {uploadError}
          </Alert>
        ) : null}

        {canUpload ? (
          <Group gap="sm" wrap="wrap">
            <label htmlFor={inputId}>
              <Button
                component="span"
                leftSection={<IconUpload size={18} />}
                loading={uploading}
                variant="light"
              >
                {photo ? 'Заменить фото' : 'Загрузить фото'}
              </Button>
            </label>
            <input
              accept={clientPhotoAcceptValue}
              disabled={uploading}
              id={inputId}
              onChange={(event) => void handleFileChange(event)}
              style={{ display: 'none' }}
              type="file"
            />
            <Text c="dimmed" size="sm">
              JPEG, PNG, WebP, HEIC, HEIF до 10 MB.
            </Text>
          </Group>
        ) : null}
      </Stack>
    </Paper>
    </>
  )
}

type ClientMembershipSectionProps = {
  actionMode: MembershipActionMode | null
  client: ClientDetails
  pending: boolean
  onCancelAction: () => void
  onSubmit: (submission: MembershipActionSubmission) => Promise<void>
  onClientChange: (client: ClientDetails) => void
}

function ClientMembershipSection({
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

type ClientAttendanceHistorySectionProps = {
  canManage: boolean
  client: ClientDetails
}

function ClientAttendanceHistorySection({
  canManage,
  client,
}: ClientAttendanceHistorySectionProps) {
  const history = [...client.attendanceHistory].sort(compareAttendanceHistory)
  const totalHistoryCount = client.attendanceHistoryTotalCount ?? history.length
  const hasPartialHistory =
    client.attendanceHistoryLoaded &&
    client.attendanceHistoryTotalCount !== null &&
    client.attendanceHistoryTotalCount > history.length

  return (
    <PageSection className="client-detail-card">
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap">
          <div>
            <Text fw={700}>История посещений</Text>
            <Text c="dimmed" size="sm">
              {canManage
                ? 'Карточка показывает дату тренировки, группу и признак посещения.'
                : 'Тренеру доступны только дата тренировки, назначенная группа и признак посещения.'}
            </Text>
          </div>

          <Group gap="sm" wrap="wrap">
            <Badge color="var(--crm-brand-primary-soft)" radius="xl" variant="light">
              {canManage ? 'Полная карточка' : 'Режим тренера'}
            </Badge>
            <Badge color="sand" radius="xl" variant="light">
              Всего: {totalHistoryCount}
            </Badge>
          </Group>
        </Group>

        {!client.attendanceHistoryLoaded ? (
          <Alert
            color="blue"
            icon={<IconCheck size={18} />}
            title="История пока не загружена"
            variant="light"
          >
            История посещений появится здесь после загрузки данных.
          </Alert>
        ) : history.length === 0 ? (
          <Text c="dimmed" size="sm">
            По этому клиенту пока нет отмеченных посещений.
          </Text>
        ) : (
          <Stack gap="sm">
            {history.map((entry) => (
              <Paper className="list-row-card" key={entry.id} radius="8px" withBorder>
                <Stack gap={6}>
                  <Group justify="space-between" wrap="wrap">
                    <Group gap="sm" wrap="wrap">
                      <Text fw={700}>{formatDateValue(entry.trainingDate)}</Text>
                      <Badge
                        color={entry.isPresent ? 'teal' : 'gray'}
                        radius="xl"
                        variant="light"
                      >
                        {entry.isPresent ? 'Присутствовал' : 'Отсутствовал'}
                      </Badge>
                    </Group>

                  <Badge color="var(--crm-brand-primary-soft)" radius="xl" variant="light">
                    {entry.groupName}
                  </Badge>
                </Group>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}

        {hasPartialHistory ? (
          <Text c="dimmed" size="sm">
            Показана текущая порция истории: {history.length} из {totalHistoryCount}.
          </Text>
        ) : null}
      </Stack>
    </PageSection>
  )
}

type MembershipEditPanelProps = {
  businessDate: string
  currentMembership: ClientMembership
  pending: boolean
  onCancel: () => void
  onSubmit: (submission: MembershipActionSubmission) => Promise<void>
}

function useMembershipSubmissionKey() {
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

function parseDateValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) {
    return null
  }

  const [, year, month, day] = match

  return new Date(Number(year), Number(month) - 1, Number(day))
}

function formatDateValue(value?: string | null) {
  if (!value) {
    return 'Не указана'
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = parseDateValue(value)

    return date
      ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(date)
      : value
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(date)
}

function formatDateTimeValue(value?: string | null) {
  if (!value) {
    return 'Не указано'
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date)
}

function formatPaymentRecordingValue(membership: ClientMembership) {
  const recordedAt = formatDateTimeValue(membership.paymentRecordedAt)

  return membership.paymentRecordedByUserName
    ? `${membership.paymentRecordedByUserName} · ${recordedAt}`
    : recordedAt
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatExpirationValue(
  behaviorKind: MembershipBehaviorKind,
  expirationDate?: string | null,
) {
  if (behaviorKind === 'SingleVisit') {
    return expirationDate ? formatDateValue(expirationDate) : 'По факту использования'
  }

  return expirationDate ? formatDateValue(expirationDate) : 'Не указана'
}

function formatCurrencyValue(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatMembershipChangeReason(reason?: string) {
  if (!reason) {
    return 'Версия абонемента'
  }

  return membershipChangeReasonLabels[
    reason as ClientMembershipChangeReason
  ] ?? reason
}

function formatMembershipPricingProvenance(membership: ClientMembership) {
  if (membership.pricingMode === 'AmountOnly') {
    return 'Без варианта каталога'
  }

  if (membership.pricingMode === 'CatalogOverride') {
    return 'Индивидуальная сумма'
  }

  return 'Каталожная цена'
}

function pickPricingFieldErrors(
  errors: Record<string, ReactNode>,
): MembershipSalePricingFieldErrors {
  return {
    pricingMode:
      typeof errors.pricingMode === 'string' ? errors.pricingMode : undefined,
    membershipCatalogItemId:
      typeof errors.membershipCatalogItemId === 'string'
        ? errors.membershipCatalogItemId
        : undefined,
    manualSaleAmount:
      typeof errors.manualSaleAmount === 'string'
        ? errors.manualSaleAmount
        : undefined,
  }
}

function formatMembershipVersionDate(membership: ClientMembership) {
  if (membership.validFrom) {
    return formatDateTimeValue(membership.validFrom)
  }

  if (membership.createdAt) {
    return formatDateTimeValue(membership.createdAt)
  }

  return formatDateValue(membership.purchaseDate)
}

function formatPreviewList(values: string[], limit: number) {
  const cleanValues = values.map((value) => value.trim()).filter(Boolean)
  const visibleValues = cleanValues.slice(0, limit)
  const hiddenCount = cleanValues.length - visibleValues.length

  if (hiddenCount <= 0) {
    return visibleValues.join(', ')
  }

  return `${visibleValues.join(', ')} +${hiddenCount}`
}

function formatBranchOptionLabel(branch: Branch) {
  const parts = [branch.name]

  if (branch.address) {
    parts.push(branch.address)
  }

  if (branch.isArchived) {
    parts.push('архивный')
  }

  return parts.join(' · ')
}

function compareMembershipHistory(
  left: ClientMembership,
  right: ClientMembership,
) {
  const leftDate = left.validFrom ?? left.createdAt ?? left.purchaseDate
  const rightDate = right.validFrom ?? right.createdAt ?? right.purchaseDate

  return rightDate.localeCompare(leftDate)
}

function compareAttendanceHistory(
  left: ClientAttendanceHistoryEntry,
  right: ClientAttendanceHistoryEntry,
) {
  return right.trainingDate.localeCompare(left.trainingDate)
}

function formatGroupOptionLabel(group: TrainingGroupListItem) {
  const parts = [group.name]

  if (group.hallName) {
    parts.push(group.hallName)
  }

  if (group.trainingStartTime) {
    parts.push(group.trainingStartTime)
  }

  if (!group.isActive) {
    parts.push('неактивна')
  }

  return parts.join(' • ')
}

function validateClientPhotoFile(file: File) {
  if (file.size > clientPhotoMaxBytes) {
    return 'Файл больше 10 MB. Выберите фотографию меньшего размера.'
  }

  const normalizedName = file.name.toLowerCase()
  const hasAcceptedExtension = clientPhotoAcceptedExtensions.some((extension) =>
    normalizedName.endsWith(extension),
  )
  const hasAcceptedMimeType = file.type
    ? clientPhotoAcceptedMimeTypes.includes(
        file.type.toLowerCase() as (typeof clientPhotoAcceptedMimeTypes)[number],
      )
    : false

  if (!hasAcceptedExtension && !hasAcceptedMimeType) {
    return 'Допустимы только JPEG, PNG, WebP, HEIC и HEIF.'
  }

  return null
}

const statusLabelMap = resources.clients.statuses satisfies Record<
  ClientStatus,
  string
>
