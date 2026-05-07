import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
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
  Switch,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { type UseFormReturnType, useForm } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconArchive,
  IconArrowLeft,
  IconCamera,
  IconCheck,
  IconDeviceFloppy,
  IconEdit,
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
  getClient,
  getGroups,
  markClientMembershipPayment,
  purchaseClientMembership,
  renewClientMembership,
  restoreClient,
  uploadClientPhoto,
  type ClientAttendanceHistoryEntry,
  updateClient,
  type ClientMembership,
  type ClientMembershipChangeReason,
  type ClientDetails,
  type ClientPhoto,
  type ClientStatus,
  type CorrectClientMembershipRequest,
  type MarkClientMembershipPaymentRequest,
  type MembershipType,
  type PurchaseClientMembershipRequest,
  type RenewClientMembershipRequest,
  type TrainingGroupListItem,
} from '../../lib/api'
import { resources } from '../../lib/resources'
import {
  ConfirmActionModal,
  ResponsiveButtonGroup,
} from '../shared/ux'
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
const membershipTypeOptions = [
  { value: 'SingleVisit', label: resources.clients.membershipTypeOptionLabels.SingleVisit },
  { value: 'Monthly', label: resources.clients.membershipTypeOptionLabels.Monthly },
  { value: 'Yearly', label: resources.clients.membershipTypeOptionLabels.Yearly },
] satisfies Array<{ value: MembershipType; label: string }>
const membershipTypeLabels = resources.common.membership
  .typeLabels satisfies Record<MembershipType, string>
const membershipChangeReasonLabels = resources.clients
  .membershipChangeReasonLabels satisfies Record<
  ClientMembershipChangeReason,
  string
>
type MembershipActionMode = 'purchase' | 'renew' | 'correct' | 'markPayment'

type MembershipEditFormValues = {
  membershipType: MembershipType | null
  purchaseDate: string
  expirationDate: string
  paymentAmount: string
  isPaid: boolean
}

type MembershipRenewFormValues = {
  renewalDate: string
  expirationDate: string
  paymentAmount: string
  isPaid: boolean
}

type MembershipActionSubmission =
  | {
      kind: 'purchase'
      payload: PurchaseClientMembershipRequest
    }
  | {
      kind: 'renew'
      payload: RenewClientMembershipRequest
    }
  | {
      kind: 'correct'
      payload: CorrectClientMembershipRequest
    }
  | {
      kind: 'markPayment'
      payload: MarkClientMembershipPaymentRequest
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
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const form = useClientForm()

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoadingOptions(true)
      setLoadError(null)

      try {
        const response = await getGroups({ take: 100 }, controller.signal)
        setGroupOptions(response.items)
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

      notifications.show({
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
    <Stack className="dashboard-stack" gap="xl">
      <ClientHero
        action={
          <Button
            leftSection={<IconArrowLeft size={18} />}
            onClick={onCancel}
            variant="default"
          >
            К списку клиентов
          </Button>
        }
        badge="Новый клиент"
        description="Форма сохраняет базовые данные и рабочую заметку клиента, а фотографию и абонемент можно добавить после первичного сохранения карточки."
        title="Новый клиент"
      />

      <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
        <Stack gap="lg">
          {loadingOptions ? (
            <Group justify="center" py="xl">
              <Loader color="brand.7" />
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
              groupOptions={groupOptions}
              onCancel={onCancel}
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
      </Paper>
    </Stack>
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
        const [nextClient, groupsResponse] = await Promise.all([
          getClient(clientId, controller.signal),
          getGroups({ take: 100 }, controller.signal),
        ])

        setClient(nextClient)
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

      notifications.show({
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
    <Stack className="dashboard-stack" gap="xl">
      <ClientHero
        action={
          <Button
            leftSection={<IconArrowLeft size={18} />}
            onClick={onBack}
            variant="default"
          >
            К карточке клиента
          </Button>
        }
        badge="Редактирование клиента"
        compact
        description="Основные поля, рабочая заметка, группы и фото клиента."
        title={client ? client.fullName : 'Карточка клиента'}
      />

      {loading ? (
        <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
          <Group justify="center" py="xl">
            <Loader color="brand.7" />
          </Group>
        </Paper>
      ) : null}

      {!loading && loadError ? (
        <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            title="Карточка клиента не загрузилась"
            variant="light"
          >
            {loadError}
          </Alert>
        </Paper>
      ) : null}

      {!loading && !loadError ? (
        <>
          <Paper className="surface-card surface-card--wide client-edit-card" radius="8px" withBorder>
            <ClientForm
              form={form}
              formError={formError}
              groupOptions={groupOptions}
              onCancel={onBack}
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
          </Paper>
        </>
      ) : null}
    </Stack>
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
  const [photoVersion, setPhotoVersion] = useState<number | null>(null)
  const [membershipActionMode, setMembershipActionMode] =
    useState<MembershipActionMode | null>(null)

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

      notifications.show({
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

  async function handleMembershipAction(
    submission: MembershipActionSubmission,
  ) {
    if (!client) {
      return
    }

    setActionPending(true)
    setActionError(null)

    try {
      await (submission.kind === 'purchase'
        ? purchaseClientMembership(client.id, submission.payload)
        : submission.kind === 'renew'
          ? renewClientMembership(client.id, submission.payload)
          : submission.kind === 'correct'
            ? correctClientMembership(client.id, submission.payload)
            : markClientMembershipPayment(client.id, submission.payload))

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
            : submission.kind === 'correct'
              ? {
                  title: 'Данные абонемента исправлены',
                  message: 'Карточка клиента обновлена.',
                }
              : {
                  title: 'Оплата отмечена',
                  message: 'Статус оплаты обновлен в текущем абонементе.',
                }

      notifications.show({
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
    } finally {
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
    <Stack className="dashboard-stack" gap="xl">
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

      <ClientHero
        action={
          <ResponsiveButtonGroup>
            <Button
              leftSection={<IconArrowLeft size={18} />}
              onClick={onBack}
              variant="default"
            >
              К списку клиентов
            </Button>
            {canManage && client ? (
              <>
                <Button
                  leftSection={<IconEdit size={18} />}
                  onClick={() => onEdit(client.id)}
                  variant="light"
                >
                  Редактировать
                </Button>
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
              </>
            ) : null}
          </ResponsiveButtonGroup>
        }
        badge="Карточка клиента"
        compact
        description={
          canManage
            ? 'Ключевые данные клиента, заметка, абонемент и ближайшие действия.'
            : 'Фото, рабочая заметка, группы и посещения по назначенным группам.'
        }
        title={client ? client.fullName : 'Детали клиента'}
      />

      {loading ? (
        <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
          <Group justify="center" py="xl">
            <Loader color="brand.7" />
          </Group>
        </Paper>
      ) : null}

      {!loading && loadError ? (
        <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
          <Alert
            color="red"
            icon={<IconAlertCircle size={18} />}
            title="Карточка клиента не загрузилась"
            variant="light"
          >
            {loadError}
          </Alert>
        </Paper>
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
            />
          ) : null}

          <ClientAttendanceHistorySection canManage={canManage} client={client} />

          <Paper className="surface-card client-section-card" radius="8px" withBorder>
            <Stack gap="lg">
              <Group gap="xs">
                <ThemeIcon color="brand.7" radius="xl" size={34} variant="light">
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
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {client.notes}
                </Text>
              ) : (
                <Text c="dimmed" size="sm">
                  Рабочая заметка пока не добавлена.
                </Text>
              )}
            </Stack>
          </Paper>

          <SimpleGrid cols={{ base: 1, md: canManage ? 2 : 1 }}>
            {canManage ? (
              <Paper className="surface-card client-section-card" radius="8px" withBorder>
                <Stack gap="lg">
                  <Group gap="xs">
                    <ThemeIcon color="brand.7" radius="xl" size={34} variant="light">
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
              </Paper>
            ) : null}

            <Paper className="surface-card client-section-card" radius="8px" withBorder>
              <Stack gap="lg">
                <Group justify="space-between" wrap="wrap">
                  <Group gap="xs">
                    <ThemeIcon color="brand.7" radius="xl" size={34} variant="light">
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
                            {group.scheduleText ? ` • ${group.scheduleText}` : ''}
                          </Text>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Paper>
          </SimpleGrid>
        </>
      ) : null}
    </Stack>
  )
}

type ClientFormProps = {
  form: UseFormReturnType<ClientFormValues>
  formError: string | null
  groupOptions: TrainingGroupListItem[]
  onCancel: () => void
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

  return (
    <Paper className="surface-card surface-card--wide client-overview-card" radius="8px" withBorder>
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

          <SimpleGrid cols={{ base: 1, sm: 2, xl: canManage ? 4 : 3 }}>
            {canManage ? (
              <>
                <CompactInfoItem label="Телефон" value={client.phone || 'Не указан'} />
                <CompactInfoItem label="Фамилия" value={client.lastName || 'Не указана'} />
                <CompactInfoItem label="Имя" value={client.firstName || 'Не указано'} />
                <CompactInfoItem label="Отчество" value={client.middleName || 'Не указано'} />
              </>
            ) : null}
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
              onActionModeChange={onMembershipActionModeChange}
              pending={pending}
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
    </Paper>
  )
}

type ClientMembershipSnapshotProps = {
  actionMode: MembershipActionMode | null
  currentMembership: ClientMembership | null
  onActionModeChange: (mode: MembershipActionMode) => void
  pending: boolean
}

function ClientMembershipSnapshot({
  actionMode,
  currentMembership,
  onActionModeChange,
  pending,
}: ClientMembershipSnapshotProps) {
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

  const primaryMode: MembershipActionMode = currentMembership.isPaid
    ? 'renew'
    : 'markPayment'

  return (
    <Paper className="client-membership-snapshot" radius="8px" withBorder>
      <Stack gap="md">
        <Group justify="space-between" wrap="wrap">
          <div>
            <Text fw={700}>Абонемент и оплата</Text>
            <Text c="dimmed" size="sm">
              Текущий срок, сумма и статус оплаты.
            </Text>
          </div>
          <Badge
            color={currentMembership.isPaid ? 'teal' : 'red'}
            radius="sm"
            variant="light"
          >
            {currentMembership.isPaid ? 'Оплачен' : 'Не оплачен'}
          </Badge>
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          <CompactInfoItem
            label="Тип"
            value={membershipTypeLabels[currentMembership.membershipType]}
          />
          <CompactInfoItem
            label="Действует до"
            value={formatExpirationValue(
              currentMembership.membershipType,
              currentMembership.expirationDate,
            )}
          />
          <CompactInfoItem
            label="Сумма"
            value={formatCurrencyValue(currentMembership.paymentAmount)}
          />
          <CompactInfoItem
            label="Оплачено"
            value={
              currentMembership.paidAt
                ? formatDateTimeValue(currentMembership.paidAt)
                : currentMembership.isPaid
                  ? 'Да'
                  : 'Ожидает оплаты'
            }
          />
        </SimpleGrid>

        <Group gap="sm" wrap="wrap">
          <Button
            color={primaryMode === 'markPayment' ? 'teal' : undefined}
            disabled={pending}
            onClick={() => onActionModeChange(primaryMode)}
            variant={actionMode === primaryMode ? 'filled' : 'light'}
          >
            {primaryMode === 'markPayment' ? 'Отметить оплату' : 'Продлить'}
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
  groupOptions,
  onCancel,
  photoSection,
  onSubmit,
  submitLabel,
  submitting,
}: ClientFormProps) {
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

  return (
    <form onSubmit={form.onSubmit((values) => void onSubmit(values))}>
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

              <MultiSelect
                data={groupOptions.map((group) => ({
                  value: group.id,
                  label: formatGroupOptionLabel(group),
                }))}
                label="Группы клиента"
                placeholder="Выберите группы"
                searchable
                {...form.getInputProps('groupIds')}
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

        <ResponsiveButtonGroup justify="space-between">
          <Button onClick={onCancel} type="button" variant="subtle">
            Отменить
          </Button>
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

type ClientHeroProps = {
  action: ReactNode
  badge: string
  compact?: boolean
  description: string
  title: string
}

function ClientHero({
  action,
  badge,
  compact = false,
  description,
  title,
}: ClientHeroProps) {
  return (
    <Paper
      className={`surface-card surface-card--wide page-header-card${compact ? ' page-header-card--compact' : ''}`}
      radius={compact ? '8px' : '28px'}
      withBorder
    >
      <Stack className="page-header-card__content" gap="md">
        <Group gap="sm">
          <Badge color="accent.5" radius="xl" size="lg" variant="filled">
            Клиенты
          </Badge>
          <Badge color="brand.1" radius="xl" size="lg" variant="light">
            {badge}
          </Badge>
        </Group>

        <Stack gap="sm">
          <Title className="page-header-card__title" order={1}>
            {title}
          </Title>
          <Text className="page-header-card__description" size="sm">
            {description}
          </Text>
        </Stack>

        {action}
      </Stack>
    </Paper>
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

      notifications.show({
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
            <ThemeIcon color="brand.7" radius="xl" size={38} variant="light">
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
            <Badge color="brand.1" radius="sm" variant="light">
              {canUpload ? 'Загрузка' : 'Просмотр'}
            </Badge>
          ) : null}
        </Group>

        <div className="client-photo-preview">
          {previewUrl ? (
            <>
              {previewStatus === 'loading' ? (
                <Group className="client-photo-placeholder" justify="center">
                  <Loader color="brand.7" size="sm" />
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
}

function ClientMembershipSection({
  actionMode,
  client,
  pending,
  onCancelAction,
  onSubmit,
}: ClientMembershipSectionProps) {
  const currentMembership = client.currentMembership
  const history = [...client.membershipHistory].sort(compareMembershipHistory)

  return (
    <Paper className="surface-card surface-card--wide client-detail-card client-membership-card" radius="8px" withBorder>
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

        {actionMode === 'purchase' ? (
          <MembershipEditPanel
            key={`purchase-${currentMembership?.id ?? 'empty'}`}
            currentMembership={currentMembership}
            mode="purchase"
            pending={pending}
            onCancel={onCancelAction}
            onSubmit={onSubmit}
          />
        ) : null}

        {actionMode === 'renew' && currentMembership ? (
          <MembershipRenewPanel
            key={`renew-${currentMembership.id}`}
            currentMembership={currentMembership}
            pending={pending}
            onCancel={onCancelAction}
            onSubmit={onSubmit}
          />
        ) : null}

        {actionMode === 'correct' && currentMembership ? (
          <MembershipEditPanel
            key={`correct-${currentMembership.id}`}
            currentMembership={currentMembership}
            mode="correct"
            pending={pending}
            onCancel={onCancelAction}
            onSubmit={onSubmit}
          />
        ) : null}

        {actionMode === 'markPayment' && currentMembership && !currentMembership.isPaid ? (
          <MembershipMarkPaymentPanel
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
          <div className="membership-history-table-wrap">
            <Table className="membership-history-table" horizontalSpacing="md" verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Событие</Table.Th>
                  <Table.Th>Период</Table.Th>
                  <Table.Th>Сумма</Table.Th>
                  <Table.Th>Оплата</Table.Th>
                  <Table.Th>Дата версии</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {history.map((membership) => (
                  <Table.Tr key={membership.id}>
                    <Table.Td>
                      <Group gap="xs" wrap="wrap">
                        <Text fw={700} size="sm">
                          {membershipTypeLabels[membership.membershipType]}
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
                          membership.membershipType,
                          membership.expirationDate,
                        )}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{formatCurrencyValue(membership.paymentAmount)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={membership.isPaid ? 'teal' : 'red'}
                        radius="sm"
                        variant="light"
                      >
                        {membership.isPaid ? 'Оплачен' : 'Не оплачен'}
                      </Badge>
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
        )}
      </Stack>
    </Paper>
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
    <Paper className="surface-card surface-card--wide client-detail-card" radius="8px" withBorder>
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
            <Badge color="brand.1" radius="xl" variant="light">
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

                  <Badge color="brand.1" radius="xl" variant="light">
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
    </Paper>
  )
}

type MembershipEditPanelProps = {
  currentMembership: ClientMembership | null
  mode: 'purchase' | 'correct'
  pending: boolean
  onCancel: () => void
  onSubmit: (submission: MembershipActionSubmission) => Promise<void>
}

function MembershipEditPanel({
  currentMembership,
  mode,
  pending,
  onCancel,
  onSubmit,
}: MembershipEditPanelProps) {
  const initialValues = createMembershipEditInitialValues(mode, currentMembership)
  const form = useForm<MembershipEditFormValues>({
    initialValues,
  })
  const [expirationManuallyChanged, setExpirationManuallyChanged] = useState(false)

  const suggestedExpirationDate = suggestPurchaseExpirationDate(
    form.values.membershipType,
    form.values.purchaseDate,
  )

  function updateSuggestedExpiration(nextType: MembershipType | null, purchaseDate: string) {
    if (!nextType || expirationManuallyChanged) {
      return
    }

    form.setFieldValue(
      'expirationDate',
      suggestPurchaseExpirationDate(nextType, purchaseDate),
    )
  }

  async function submit(values: MembershipEditFormValues) {
    const validationErrors = validateMembershipEditForm(values)

    if (Object.keys(validationErrors).length > 0) {
      form.setErrors(validationErrors)
      return
    }

    const paymentAmount = parsePaymentAmount(values.paymentAmount)
    if (paymentAmount === null || !values.membershipType) {
      return
    }

    await onSubmit({
      kind: mode,
      payload: {
        membershipType: values.membershipType,
        purchaseDate: values.purchaseDate,
        expirationDate: values.expirationDate || undefined,
        paymentAmount,
        isPaid: values.isPaid,
        singleVisitUsed: false,
      },
    })
  }

  return (
    <Paper className="hint-card" radius="8px" withBorder>
      <form onSubmit={form.onSubmit((values) => void submit(values))}>
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Text fw={700}>
                {mode === 'purchase'
                  ? 'Оформить новый абонемент'
                  : 'Исправить текущий абонемент'}
              </Text>
              <Text c="dimmed" size="sm">
                Срок подставляется автоматически по типу и дате покупки, но его можно исправить вручную.
              </Text>
            </div>

            <Badge color="brand.1" radius="sm" variant="light">
              {mode === 'purchase' ? 'Новая покупка' : 'Исправление'}
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Select
              allowDeselect={false}
              data={membershipTypeOptions}
              label="Тип абонемента"
              placeholder="Выберите тип"
              value={form.values.membershipType}
              onChange={(value) => {
                const nextType = (value ?? null) as MembershipType | null
                form.setFieldValue('membershipType', nextType)
                updateSuggestedExpiration(nextType, form.values.purchaseDate)
              }}
              error={form.errors.membershipType}
            />
            <TextInput
              label="Дата покупки"
              type="date"
              value={form.values.purchaseDate}
              onChange={(event) => {
                const nextPurchaseDate = event.currentTarget.value
                form.setFieldValue('purchaseDate', nextPurchaseDate)
                updateSuggestedExpiration(form.values.membershipType, nextPurchaseDate)
              }}
              error={form.errors.purchaseDate}
            />
            <TextInput
              description={
                form.values.membershipType === 'SingleVisit'
                  ? 'Для разового посещения дату можно оставить пустой.'
                  : 'Дата предложена автоматически, но ее можно изменить.'
              }
              label="Дата окончания"
              type="date"
              value={form.values.expirationDate}
              onChange={(event) => {
                setExpirationManuallyChanged(true)
                form.setFieldValue('expirationDate', event.currentTarget.value)
              }}
              error={form.errors.expirationDate}
            />
            <TextInput
              label="Сумма оплаты"
              min="0"
              placeholder="1200"
              step="0.01"
              type="number"
              value={form.values.paymentAmount}
              onChange={(event) =>
                form.setFieldValue('paymentAmount', event.currentTarget.value)
              }
              error={form.errors.paymentAmount}
            />
          </SimpleGrid>

          <Group justify="space-between" wrap="wrap">
            <Switch
              checked={form.values.isPaid}
              label="Оплачен"
              onChange={(event) =>
                form.setFieldValue('isPaid', event.currentTarget.checked)
              }
            />

            <Button
              disabled={pending || suggestedExpirationDate === form.values.expirationDate}
              onClick={() => {
                setExpirationManuallyChanged(false)
                form.setFieldValue('expirationDate', suggestedExpirationDate)
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
              {mode === 'purchase' ? 'Оформить абонемент' : 'Сохранить исправление'}
            </Button>
          </ResponsiveButtonGroup>
        </Stack>
      </form>
    </Paper>
  )
}

type MembershipRenewPanelProps = {
  currentMembership: ClientMembership
  pending: boolean
  onCancel: () => void
  onSubmit: (submission: MembershipActionSubmission) => Promise<void>
}

function MembershipRenewPanel({
  currentMembership,
  pending,
  onCancel,
  onSubmit,
}: MembershipRenewPanelProps) {
  const initialValues = createMembershipRenewInitialValues(currentMembership)
  const form = useForm<MembershipRenewFormValues>({
    initialValues,
  })
  const [expirationManuallyChanged, setExpirationManuallyChanged] = useState(false)

  const suggestedExpirationDate = suggestRenewalExpirationDate(
    currentMembership,
    form.values.renewalDate,
  )

  async function submit(values: MembershipRenewFormValues) {
    const validationErrors = validateMembershipRenewForm(
      values,
      currentMembership.membershipType,
    )

    if (Object.keys(validationErrors).length > 0) {
      form.setErrors(validationErrors)
      return
    }

    const paymentAmount = parsePaymentAmount(values.paymentAmount)
    if (paymentAmount === null) {
      return
    }

    await onSubmit({
      kind: 'renew',
      payload: {
        membershipType: currentMembership.membershipType,
        renewalDate: values.renewalDate,
        paymentDate: values.renewalDate,
        expirationDate: values.expirationDate || undefined,
        paymentAmount,
        isPaid: values.isPaid,
      },
    })
  }

  return (
    <Paper className="hint-card" radius="8px" withBorder>
      <form onSubmit={form.onSubmit((values) => void submit(values))}>
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Text fw={700}>Продлить текущий абонемент</Text>
              <Text c="dimmed" size="sm">
                Тип берется из текущей версии. Срок предложен автоматически и при необходимости редактируется вручную.
              </Text>
            </div>

              <Badge color="brand.1" radius="sm" variant="light">
              {membershipTypeLabels[currentMembership.membershipType]}
            </Badge>
          </Group>

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <InfoItem
              label="Текущий тип"
              value={membershipTypeLabels[currentMembership.membershipType]}
            />
            <InfoItem
              label="Текущая дата окончания"
              value={formatExpirationValue(
                currentMembership.membershipType,
                currentMembership.expirationDate,
              )}
            />
            <TextInput
              label="Дата продления"
              type="date"
              value={form.values.renewalDate}
              onChange={(event) => {
                const nextRenewalDate = event.currentTarget.value
                form.setFieldValue('renewalDate', nextRenewalDate)
                if (!expirationManuallyChanged) {
                  form.setFieldValue(
                    'expirationDate',
                    suggestRenewalExpirationDate(
                      currentMembership,
                      nextRenewalDate,
                    ),
                  )
                }
              }}
              error={form.errors.renewalDate}
            />
            <TextInput
              label="Сумма оплаты"
              min="0"
              placeholder={String(currentMembership.paymentAmount)}
              step="0.01"
              type="number"
              value={form.values.paymentAmount}
              onChange={(event) =>
                form.setFieldValue('paymentAmount', event.currentTarget.value)
              }
              error={form.errors.paymentAmount}
            />
            <TextInput
              description={
                currentMembership.membershipType === 'SingleVisit'
                  ? 'Для разового посещения дату можно оставить пустой.'
                  : 'Если нужно, замените автоматически предложенный срок вручную.'
              }
              label="Новая дата окончания"
              type="date"
              value={form.values.expirationDate}
              onChange={(event) => {
                setExpirationManuallyChanged(true)
                form.setFieldValue('expirationDate', event.currentTarget.value)
              }}
              error={form.errors.expirationDate}
            />
          </SimpleGrid>

          <Group justify="space-between" wrap="wrap">
            <Switch
              checked={form.values.isPaid}
              label="Оплачен"
              onChange={(event) =>
                form.setFieldValue('isPaid', event.currentTarget.checked)
              }
            />

            <Button
              disabled={pending || suggestedExpirationDate === form.values.expirationDate}
              onClick={() => {
                setExpirationManuallyChanged(false)
                form.setFieldValue('expirationDate', suggestedExpirationDate)
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
              Продлить абонемент
            </Button>
          </ResponsiveButtonGroup>
        </Stack>
      </form>
    </Paper>
  )
}

type MembershipMarkPaymentPanelProps = {
  currentMembership: ClientMembership
  pending: boolean
  onCancel: () => void
  onSubmit: (submission: MembershipActionSubmission) => Promise<void>
}

function MembershipMarkPaymentPanel({
  currentMembership,
  pending,
  onCancel,
  onSubmit,
}: MembershipMarkPaymentPanelProps) {
  const [confirmOpened, setConfirmOpened] = useState(false)

  return (
    <Paper className="hint-card" radius="8px" withBorder>
      <ConfirmActionModal
        confirmColor="teal"
        confirmLabel="Подтвердить оплату"
        description="Будет создана новая версия текущего абонемента с отмеченной оплатой."
        onClose={() => setConfirmOpened(false)}
        onConfirm={() => {
          setConfirmOpened(false)
          void onSubmit({
            kind: 'markPayment',
            payload: {
              membershipType: currentMembership.membershipType,
              paymentAmount: currentMembership.paymentAmount,
              isPaid: true,
            },
          })
        }}
        opened={confirmOpened}
        pending={pending}
        title="Подтвердить оплату по текущему абонементу?"
      />

      <Stack gap="md">
        <div>
          <Text fw={700}>Подтвердить оплату</Text>
          <Text c="dimmed" size="sm">
            Действие создаст новую версию текущего абонемента с признаком оплаты.
          </Text>
        </div>

        <SimpleGrid cols={{ base: 1, md: 3 }}>
          <InfoItem
            label="Тип"
            value={membershipTypeLabels[currentMembership.membershipType]}
          />
          <InfoItem
            label="Сумма"
            value={formatCurrencyValue(currentMembership.paymentAmount)}
          />
          <InfoItem
            label="Текущий статус"
            value={currentMembership.isPaid ? 'Оплачен' : 'Не оплачен'}
          />
        </SimpleGrid>

        <ResponsiveButtonGroup justify="space-between">
          <Button onClick={onCancel} type="button" variant="subtle">
            Отменить
          </Button>
          <Button
            color="teal"
            loading={pending}
            onClick={() => setConfirmOpened(true)}
            type="button"
          >
            Подтвердить оплату
          </Button>
        </ResponsiveButtonGroup>
      </Stack>
    </Paper>
  )
}

function createMembershipEditInitialValues(
  mode: 'purchase' | 'correct',
  currentMembership: ClientMembership | null,
): MembershipEditFormValues {
  if (mode === 'correct' && currentMembership) {
    return {
      membershipType: currentMembership.membershipType,
      purchaseDate: currentMembership.purchaseDate,
      expirationDate: currentMembership.expirationDate ?? '',
      paymentAmount: String(currentMembership.paymentAmount),
      isPaid: currentMembership.isPaid,
    }
  }

  const membershipType = currentMembership?.membershipType ?? 'Monthly'
  const purchaseDate = getTodayDateValue()

  return {
    membershipType,
    purchaseDate,
    expirationDate: suggestPurchaseExpirationDate(membershipType, purchaseDate),
    paymentAmount: '',
    isPaid: false,
  }
}

function createMembershipRenewInitialValues(
  currentMembership: ClientMembership,
): MembershipRenewFormValues {
  const renewalDate = getTodayDateValue()

  return {
    renewalDate,
    expirationDate: suggestRenewalExpirationDate(currentMembership, renewalDate),
    paymentAmount: String(currentMembership.paymentAmount),
    isPaid: currentMembership.isPaid,
  }
}

function validateMembershipEditForm(values: MembershipEditFormValues) {
  const errors: Record<string, string> = {}

  if (!values.membershipType) {
    errors.membershipType = 'Выберите тип абонемента.'
  }

  if (!values.purchaseDate) {
    errors.purchaseDate = 'Укажите дату покупки.'
  }

  if (values.membershipType && isExpirationRequired(values.membershipType)) {
    if (!values.expirationDate) {
      errors.expirationDate = 'Укажите дату окончания.'
    }
  }

  if (parsePaymentAmount(values.paymentAmount) === null) {
    errors.paymentAmount = 'Укажите корректную сумму оплаты.'
  }

  return errors
}

function validateMembershipRenewForm(
  values: MembershipRenewFormValues,
  membershipType: MembershipType,
) {
  const errors: Record<string, string> = {}

  if (!values.renewalDate) {
    errors.renewalDate = 'Укажите дату продления.'
  }

  if (isExpirationRequired(membershipType) && !values.expirationDate) {
    errors.expirationDate = 'Укажите новую дату окончания.'
  }

  if (parsePaymentAmount(values.paymentAmount) === null) {
    errors.paymentAmount = 'Укажите корректную сумму оплаты.'
  }

  return errors
}

function parsePaymentAmount(value: string) {
  if (!value.trim()) {
    return null
  }

  const parsed = Number.parseFloat(value)

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }

  return parsed
}

function isExpirationRequired(membershipType: MembershipType) {
  return membershipType !== 'SingleVisit'
}

function suggestPurchaseExpirationDate(
  membershipType: MembershipType | null,
  purchaseDate: string,
) {
  if (!membershipType || !purchaseDate) {
    return ''
  }

  if (membershipType === 'SingleVisit') {
    return ''
  }

  return membershipType === 'Monthly'
    ? addMonthsToDateValue(purchaseDate, 1)
    : addYearsToDateValue(purchaseDate, 1)
}

function suggestRenewalExpirationDate(
  membership: ClientMembership,
  renewalDate: string,
) {
  if (!renewalDate) {
    return ''
  }

  if (membership.membershipType === 'SingleVisit') {
    return ''
  }

  const baseDate = membership.expirationDate || renewalDate

  return membership.membershipType === 'Monthly'
    ? addMonthsToDateValue(baseDate, 1)
    : addYearsToDateValue(baseDate, 1)
}

function addMonthsToDateValue(value: string, months: number) {
  const date = parseDateValue(value)

  if (!date) {
    return ''
  }

  const nextDate = new Date(date)
  nextDate.setMonth(nextDate.getMonth() + months)

  return toDateValue(nextDate)
}

function addYearsToDateValue(value: string, years: number) {
  const date = parseDateValue(value)

  if (!date) {
    return ''
  }

  const nextDate = new Date(date)
  nextDate.setFullYear(nextDate.getFullYear() + years)

  return toDateValue(nextDate)
}

function parseDateValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) {
    return null
  }

  const [, year, month, day] = match

  return new Date(Number(year), Number(month) - 1, Number(day))
}

function toDateValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getTodayDateValue() {
  return toDateValue(new Date())
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
  membershipType: MembershipType,
  expirationDate?: string | null,
) {
  if (membershipType === 'SingleVisit') {
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
