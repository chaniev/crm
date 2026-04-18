import { useEffect, useState, type ReactNode } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  MultiSelect,
  Paper,
  SimpleGrid,
  Stack,
  Text,
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
  IconCheck,
  IconDeviceFloppy,
  IconEdit,
  IconPhone,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconUserHeart,
  IconUsers,
  IconUsersGroup,
} from '@tabler/icons-react'
import {
  ApiError,
  applyFieldErrors,
  archiveClient,
  createClient,
  getClient,
  getClients,
  getGroups,
  restoreClient,
  updateClient,
  type ClientDetails,
  type ClientListItem,
  type ClientStatus,
  type TrainingGroupListItem,
  type UpsertClientRequest,
} from '../../lib/api'

const maxContacts = 2

type ClientFormContact = {
  type: string
  fullName: string
  phone: string
}

type ClientFormValues = {
  lastName: string
  firstName: string
  middleName: string
  phone: string
  groupIds: string[]
  contacts: ClientFormContact[]
}

type ClientsListScreenProps = {
  canManage: boolean
  onCreate: () => void
  onOpen: (clientId: string) => void
}

export function ClientsListScreen({
  canManage,
  onCreate,
  onOpen,
}: ClientsListScreenProps) {
  const [clients, setClients] = useState<ClientListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const nextClients = await getClients(controller.signal)
        setClients(nextClients)
      } catch (loadError) {
        if (controller.signal.aborted) {
          return
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Не удалось загрузить список клиентов.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => controller.abort()
  }, [reloadKey])

  const activeClientsCount = clients.filter(
    (client) => client.status === 'Active',
  ).length
  const archivedClientsCount = clients.length - activeClientsCount
  const groupedClientsCount = clients.filter((client) => client.groupCount > 0).length

  return (
    <Stack className="dashboard-stack" gap="xl">
      <ClientHero
        action={
          <Group className="management-hero__actions" gap="sm" wrap="wrap">
            {canManage ? (
              <Button
                color="accent.5"
                leftSection={<IconPlus size={18} />}
                onClick={onCreate}
                variant="white"
              >
                Создать клиента
              </Button>
            ) : null}
            <Button
              leftSection={<IconRefresh size={18} />}
              onClick={() => setReloadKey((currentKey) => currentKey + 1)}
              variant="light"
            >
              Обновить список
            </Button>
          </Group>
        }
        badge="Route-level clients flow"
        description="Список держит базовый CRM-поток отдельно от посещений: основные данные, статусы, контактные лица и привязку к группам."
        title="Клиенты и базовая карточка встроены в shell"
      />

      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <MetricCard
          description="Все клиенты из management API"
          label="Клиенты"
          value={String(clients.length)}
        />
        <MetricCard
          description="Клиенты со статусом Active"
          label="Активные"
          value={String(activeClientsCount)}
        />
        <MetricCard
          description="Клиенты, уже привязанные хотя бы к одной группе"
          label="В группах"
          value={String(groupedClientsCount)}
        />
      </SimpleGrid>

      <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
        <Stack gap="lg">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Text fw={700}>Список клиентов</Text>
              <Text c="dimmed" size="sm">
                Карточка клиента открывается отдельным route-level экраном,
                редактирование и архивирование доступны только management-ролям.
              </Text>
            </div>

            <Badge color="brand.1" radius="xl" size="lg" variant="light">
              {canManage ? 'HeadCoach и Administrator' : 'Read-only карточки'}
            </Badge>
          </Group>

          <Group gap="sm" wrap="wrap">
            <Badge color="teal" radius="xl" variant="light">
              Активные: {activeClientsCount}
            </Badge>
            <Badge color="gray" radius="xl" variant="light">
              Архив: {archivedClientsCount}
            </Badge>
          </Group>

          {loading ? (
            <Group justify="center" py="xl">
              <Loader color="brand.7" />
            </Group>
          ) : null}

          {!loading && error ? (
            <Alert
              color="red"
              icon={<IconAlertCircle size={18} />}
              title="Список клиентов не загрузился"
              variant="light"
            >
              {error}
            </Alert>
          ) : null}

          {!loading && !error && clients.length === 0 ? (
            <Paper className="hint-card" radius="24px" withBorder>
              <Stack gap="sm">
                <Group gap="xs">
                  <ThemeIcon color="brand.7" radius="xl" size={30} variant="light">
                    <IconUsers size={16} />
                  </ThemeIcon>
                  <Text fw={700}>Клиенты пока не заведены</Text>
                </Group>
                <Text c="dimmed" size="sm">
                  Начните с базовой карточки без абонемента и без истории посещений.
                </Text>
              </Stack>
            </Paper>
          ) : null}

          {!loading && !error && clients.length > 0 ? (
            <Stack gap="md">
              {clients.map((client) => (
                <Paper
                  className="list-row-card client-row-card"
                  key={client.id}
                  radius="24px"
                  withBorder
                >
                  <Stack gap="md">
                    <Group justify="space-between" wrap="wrap">
                      <Stack gap={8}>
                        <Group gap="sm" wrap="wrap">
                          <Text fw={700}>{client.fullName}</Text>
                          <Badge
                            color={client.status === 'Active' ? 'teal' : 'gray'}
                            radius="xl"
                            variant="light"
                          >
                            {statusLabelMap[client.status]}
                          </Badge>
                          <Badge color="sand" radius="xl" variant="light">
                            Контактов: {client.contactCount}
                          </Badge>
                        </Group>

                        <Text c="dimmed" size="sm">
                          Телефон: {client.phone || 'Не указан'}
                        </Text>

                        <Text c="dimmed" size="sm">
                          {client.groupCount > 0
                            ? `Группы: ${client.groups.map((group) => group.name).join(', ')}`
                            : 'Клиент пока не привязан к группам'}
                        </Text>
                      </Stack>

                      <Button
                        leftSection={<IconUserHeart size={18} />}
                        onClick={() => onOpen(client.id)}
                        variant="light"
                      >
                        Карточка
                      </Button>
                    </Group>

                    <Group gap="sm" wrap="wrap">
                      <Badge color="brand.1" radius="xl" variant="light">
                        Групп: {client.groupCount}
                      </Badge>
                      <Badge color="sand" radius="xl" variant="light">
                        Статус: {statusLabelMap[client.status]}
                      </Badge>
                    </Group>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          ) : null}
        </Stack>
      </Paper>
    </Stack>
  )
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
        form.setErrors(applyFieldErrors(error.fieldErrors))
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
            variant="white"
          >
            К списку клиентов
          </Button>
        }
        badge="Новый клиент"
        description="Форма сохраняет только базовые данные клиента: ФИО, телефон, контактных лиц и привязку к группам."
        title="Route-level форма создания клиента"
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
  const form = useClientForm()

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
        form.setValues(toClientFormValues(nextClient))
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
  }, [clientId, form])

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
        form.setErrors(applyFieldErrors(error.fieldErrors))
        setFormError(error.message)
        return
      }

      setFormError('Не удалось сохранить изменения клиента.')
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
            onClick={onBack}
            variant="white"
          >
            К карточке клиента
          </Button>
        }
        badge="Редактирование клиента"
        description="Изменения контактов, групп и базовых полей уходят в `PUT /clients/{id}` без сценариев абонемента и посещений."
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
          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <MetricCard
              description="Контактные лица в карточке клиента"
              label="Контакты"
              value={String(form.values.contacts.length)}
            />
            <MetricCard
              description="Группы, выбранные в карточке"
              label="Группы"
              value={String(form.values.groupIds.length)}
            />
            <MetricCard
              description="Текущий статус клиента"
              label="Статус"
              value={statusLabelMap[client?.status ?? 'Active']}
            />
          </SimpleGrid>

          <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
            <ClientForm
              form={form}
              formError={formError}
              groupOptions={groupOptions}
              onCancel={onBack}
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

  return (
    <Stack className="dashboard-stack" gap="xl">
      <ClientHero
        action={
          <Group className="management-hero__actions" gap="sm" wrap="wrap">
            <Button
              leftSection={<IconArrowLeft size={18} />}
              onClick={onBack}
              variant="white"
            >
              К списку клиентов
            </Button>
            {canManage && client ? (
              <>
                <Button
                  leftSection={<IconEdit size={18} />}
                  onClick={() => onEdit(client.id)}
                  variant="white"
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
                  onClick={() => void toggleArchive()}
                  variant="white"
                >
                  {client.status === 'Active'
                    ? 'В архив'
                    : 'Вернуть в активные'}
                </Button>
              </>
            ) : null}
          </Group>
        }
        badge="Карточка клиента"
        description="Карточка показывает только базовые данные этапа 6a: телефон, контактных лиц, группы и текущий статус клиента."
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

          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <MetricCard
              description="Контактные лица в карточке"
              label="Контакты"
              value={String(client.contacts.length)}
            />
            <MetricCard
              description="Группы, к которым привязан клиент"
              label="Группы"
              value={String(client.groups.length)}
            />
            <MetricCard
              description="Текущий lifecycle status"
              label="Статус"
              value={statusLabelMap[client.status]}
            />
          </SimpleGrid>

          <Paper className="surface-card surface-card--wide client-detail-card" radius="28px" withBorder>
            <Stack gap="lg">
              <Group justify="space-between" wrap="wrap">
                <div>
                  <Text fw={700}>Основные данные</Text>
                  <Text c="dimmed" size="sm">
                    Базовая карточка клиента без фото, абонементов и истории посещений.
                  </Text>
                </div>

                <Badge
                  color={client.status === 'Active' ? 'teal' : 'gray'}
                  radius="xl"
                  size="lg"
                  variant="light"
                >
                  {statusLabelMap[client.status]}
                </Badge>
              </Group>

              {!canManage ? (
                <Alert
                  color="blue"
                  icon={<IconCheck size={18} />}
                  title="Management-действия скрыты"
                  variant="light"
                >
                  Для вашей роли карточка работает в режиме просмотра.
                </Alert>
              ) : null}

              <SimpleGrid cols={{ base: 1, md: 2 }}>
                <InfoItem label="Фамилия" value={client.lastName || 'Не указана'} />
                <InfoItem label="Имя" value={client.firstName || 'Не указано'} />
                <InfoItem label="Отчество" value={client.middleName || 'Не указано'} />
                <InfoItem label="Телефон" value={client.phone || 'Не указан'} />
              </SimpleGrid>
            </Stack>
          </Paper>

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Paper className="surface-card client-section-card" radius="28px" withBorder>
              <Stack gap="lg">
                <Group gap="xs">
                  <ThemeIcon color="brand.7" radius="xl" size={34} variant="light">
                    <IconUserHeart size={18} />
                  </ThemeIcon>
                  <div>
                    <Text fw={700}>Контактные лица</Text>
                    <Text c="dimmed" size="sm">
                      Не более двух контактов по требованиям этапа 6a.
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
                        radius="24px"
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

            <Paper className="surface-card client-section-card" radius="28px" withBorder>
              <Stack gap="lg">
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
                        radius="24px"
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
  onSubmit: (values: ClientFormValues) => Promise<void>
  submitLabel: string
  submitting: boolean
}

function ClientForm({
  form,
  formError,
  groupOptions,
  onCancel,
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
          description="Клиент может состоять в нескольких группах."
          label="Группы клиента"
          placeholder="Выберите группы"
          searchable
          {...form.getInputProps('groupIds')}
        />

        <Paper className="hint-card" radius="24px" withBorder>
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
                  <Paper className="list-row-card" key={index} radius="24px" withBorder>
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

        <Paper className="hint-card" radius="24px" withBorder>
          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <HintStat
              icon={<IconPhone size={18} />}
              label="Телефон"
              value={form.values.phone || 'Не указан'}
            />
            <HintStat
              icon={<IconUserHeart size={18} />}
              label="Контакты"
              value={String(normalizeContacts(form.values.contacts).length)}
            />
            <HintStat
              icon={<IconUsersGroup size={18} />}
              label="Группы"
              value={String(form.values.groupIds.length)}
            />
          </SimpleGrid>
        </Paper>

        <Group justify="space-between" wrap="wrap">
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
        </Group>
      </Stack>
    </form>
  )
}

type ClientHeroProps = {
  action: ReactNode
  badge: string
  description: string
  title: string
}

function ClientHero({
  action,
  badge,
  description,
  title,
}: ClientHeroProps) {
  return (
    <Paper className="dashboard-hero" radius="36px" shadow="lg">
      <div className="dashboard-hero__glow" />
      <Stack className="dashboard-hero__content" gap="lg">
        <Group gap="sm">
          <Badge color="accent.5" radius="xl" size="lg" variant="filled">
            Этап 6a
          </Badge>
          <Badge color="brand.1" radius="xl" size="lg" variant="light">
            {badge}
          </Badge>
        </Group>

        <Stack gap="sm">
          <Title c="white" className="dashboard-hero__title" order={1}>
            {title}
          </Title>
          <Text className="dashboard-hero__description" size="lg">
            {description}
          </Text>
        </Stack>

        {action}
      </Stack>
    </Paper>
  )
}

type MetricCardProps = {
  description: string
  label: string
  value: string
}

function MetricCard({
  description,
  label,
  value,
}: MetricCardProps) {
  return (
    <Paper className="surface-card metric-card" radius="28px" withBorder>
      <Stack gap={6}>
        <Text c="dimmed" fw={600} size="sm">
          {label}
        </Text>
        <Title order={3}>{value}</Title>
        <Text c="dimmed" size="sm">
          {description}
        </Text>
      </Stack>
    </Paper>
  )
}

type HintStatProps = {
  icon: ReactNode
  label: string
  value: string
}

function HintStat({
  icon,
  label,
  value,
}: HintStatProps) {
  return (
    <Group gap="sm" wrap="nowrap">
      <ThemeIcon color="brand.7" radius="xl" size={34} variant="light">
        {icon}
      </ThemeIcon>
      <Stack gap={2}>
        <Text c="dimmed" fw={600} size="xs">
          {label}
        </Text>
        <Text fw={700}>{value}</Text>
      </Stack>
    </Group>
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
    <Paper className="hint-card" radius="24px" withBorder>
      <Stack gap={4}>
        <Text c="dimmed" fw={600} size="xs">
          {label}
        </Text>
        <Text fw={700}>{value}</Text>
      </Stack>
    </Paper>
  )
}

function useClientForm() {
  return useForm<ClientFormValues>({
    initialValues: {
      lastName: '',
      firstName: '',
      middleName: '',
      phone: '',
      groupIds: [],
      contacts: [],
    },
    validate: {
      phone: (value) => (value.trim() ? null : 'Укажите телефон клиента.'),
      lastName: (_, values) =>
        hasClientName(values)
          ? null
          : 'Укажите хотя бы одно из полей ФИО клиента.',
    },
  })
}

function validateClientForm(values: ClientFormValues) {
  const errors: Record<string, string> = {}
  const normalizedContacts = normalizeContacts(values.contacts)

  if (!values.phone.trim()) {
    errors.phone = 'Укажите телефон клиента.'
  }

  if (!hasClientName(values)) {
    errors.lastName = 'Укажите хотя бы одно из полей ФИО клиента.'
  }

  if (normalizedContacts.length > maxContacts) {
    errors.contacts = 'Можно сохранить не более двух контактных лиц.'
  }

  values.contacts.forEach((contact, index) => {
    const trimmedContact = {
      type: contact.type.trim(),
      fullName: contact.fullName.trim(),
      phone: contact.phone.trim(),
    }

    if (
      !trimmedContact.type &&
      !trimmedContact.fullName &&
      !trimmedContact.phone
    ) {
      return
    }

    if (!trimmedContact.type) {
      errors[`contacts.${index}.type`] = 'Укажите тип контактного лица.'
    }

    if (!trimmedContact.fullName) {
      errors[`contacts.${index}.fullName`] =
        'Укажите ФИО контактного лица.'
    }

    if (!trimmedContact.phone) {
      errors[`contacts.${index}.phone`] = 'Укажите телефон контактного лица.'
    }
  })

  return errors
}

function hasClientName(values: Pick<
  ClientFormValues,
  'lastName' | 'firstName' | 'middleName'
>) {
  return [values.lastName, values.firstName, values.middleName].some((value) =>
    value.trim(),
  )
}

function toClientFormValues(client: ClientDetails): ClientFormValues {
  return {
    lastName: client.lastName,
    firstName: client.firstName,
    middleName: client.middleName,
    phone: client.phone,
    groupIds: client.groupIds,
    contacts:
      client.contacts.length > 0
        ? client.contacts.map((contact) => ({
            type: contact.type,
            fullName: contact.fullName,
            phone: contact.phone,
          }))
        : [],
  }
}

function toUpsertClientPayload(values: ClientFormValues): UpsertClientRequest {
  return {
    lastName: values.lastName.trim() || undefined,
    firstName: values.firstName.trim() || undefined,
    middleName: values.middleName.trim() || undefined,
    phone: values.phone.trim(),
    contacts: normalizeContacts(values.contacts),
    groupIds: [...values.groupIds].sort(),
  }
}

function normalizeContacts(contacts: ClientFormContact[]) {
  return contacts
    .map((contact) => ({
      type: contact.type.trim(),
      fullName: contact.fullName.trim(),
      phone: contact.phone.trim(),
    }))
    .filter((contact) => contact.type || contact.fullName || contact.phone)
}

function createEmptyContact(): ClientFormContact {
  return {
    type: '',
    fullName: '',
    phone: '',
  }
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

const statusLabelMap: Record<ClientStatus, string> = {
  Active: 'Активный',
  Archived: 'Архивный',
}
