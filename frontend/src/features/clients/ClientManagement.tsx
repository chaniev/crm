import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Button,
  Group,
  Loader,
  MultiSelect,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Switch,
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
  IconCamera,
  IconChevronLeft,
  IconChevronRight,
  IconCheck,
  IconDeviceFloppy,
  IconEdit,
  IconPhone,
  IconPlus,
  IconPhotoOff,
  IconRefresh,
  IconSearch,
  IconTrash,
  IconUpload,
  IconUserHeart,
  IconUsers,
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
  getClients,
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
  type ClientListItem,
  type ClientPaymentStatus,
  type ClientPhoto,
  type ClientStatus,
  type CorrectClientMembershipRequest,
  type MarkClientMembershipPaymentRequest,
  type MembershipType,
  type PurchaseClientMembershipRequest,
  type RenewClientMembershipRequest,
  type TrainingGroupListItem,
  type UpsertClientRequest,
} from '../../lib/api'
import {
  ConfirmActionModal,
  MetricCard,
  ResponsiveButtonGroup,
} from '../shared/ux'

const maxContacts = 2
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
  { value: 'SingleVisit', label: 'Разовое посещение' },
  { value: 'Monthly', label: 'Месячный абонемент' },
  { value: 'Yearly', label: 'Годовой абонемент' },
] satisfies Array<{ value: MembershipType; label: string }>
const membershipTypeLabels: Record<MembershipType, string> = {
  SingleVisit: 'Разовое посещение',
  Monthly: 'Месячный',
  Yearly: 'Годовой',
}
const membershipChangeReasonLabels: Record<
  ClientMembershipChangeReason,
  string
> = {
  NewPurchase: 'Новая покупка',
  Renewal: 'Продление',
  Correction: 'Исправление',
  PaymentUpdate: 'Оплата отмечена',
  SingleVisitWriteOff: 'Списание разового',
}
const clientListPageSizeOptions = [
  { value: '20', label: '20 на странице' },
  { value: '50', label: '50 на странице' },
  { value: '100', label: '100 на странице' },
] as const
const clientStatusFilterOptions = [
  { value: 'Active', label: 'Только активные' },
  { value: 'Archived', label: 'Только архив' },
] satisfies Array<{ value: ClientStatus; label: string }>
const clientPaymentStatusFilterOptions = [
  { value: 'Paid', label: 'Оплаченные' },
  { value: 'Unpaid', label: 'Неоплаченные' },
] satisfies Array<{ value: ClientPaymentStatus; label: string }>

const membershipStatusBadgeColor = {
  clear: 'teal',
  unpaid: 'red',
  warning: 'orange',
} as const
const clientFieldErrorAliases = {
  fullName: 'lastName',
} as const

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

type ClientListFilterValues = {
  fullName: string
  phone: string
  groupId: string | null
  status: ClientStatus | 'all'
  paymentStatus: ClientPaymentStatus | 'all'
  membershipExpiresFrom: string
  membershipExpiresTo: string
  withoutPhoto: boolean
  withoutGroup: boolean
  withoutActivePaidMembership: boolean
  pageSize: string
}

type ClientGroupFilterOption = {
  value: string
  label: string
}

function buildClientListPhotoUrl(client: ClientListItem) {
  return client.photo && client.id
    ? buildClientPhotoUrl(
        client.id,
        client.photo.uploadedAt ?? client.photo.path ?? client.updatedAt ?? 'list',
      )
    : null
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
  const [groupOptions, setGroupOptions] = useState<ClientGroupFilterOption[]>([])
  const [fallbackGroupOptions, setFallbackGroupOptions] = useState<
    ClientGroupFilterOption[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [draftFilters, setDraftFilters] = useState<ClientListFilterValues>(
    () => createDefaultClientListFilters(),
  )
  const [appliedFilters, setAppliedFilters] = useState<ClientListFilterValues>(
    () => createDefaultClientListFilters(),
  )

  useEffect(() => {
    const controller = new AbortController()

    async function loadGroupOptions() {
      try {
        const response = await getGroups({ take: 100 }, controller.signal)

        if (!controller.signal.aborted) {
          setGroupOptions(
            response.items.map((group) => ({
              value: group.id,
              label: group.name,
            })),
          )
        }
      } catch {
        if (!controller.signal.aborted) {
          setGroupOptions([])
        }
      }
    }

    void loadGroupOptions()

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const nextResponse = await getClients(
          toClientListQueryParams(appliedFilters, page, canManage),
          controller.signal,
        )

        setClients(nextResponse.items)
        setTotalCount(nextResponse.totalCount)
        setHasNextPage(nextResponse.hasNextPage)
        setFallbackGroupOptions((currentOptions) =>
          mergeClientGroupFilterOptions(currentOptions, nextResponse.items),
        )
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
  }, [appliedFilters, canManage, page, reloadKey])

  const activeClientsCount = clients.filter(
    (client) => client.status === 'Active',
  ).length
  const archivedClientsCount = clients.length - activeClientsCount
  const groupedClientsCount = clients.filter((client) => client.groupCount > 0).length
  const pageSize = Number.parseInt(appliedFilters.pageSize, 10) || 20
  const pageStart = clients.length === 0 ? 0 : (page - 1) * pageSize + 1
  const pageEnd = pageStart === 0 ? 0 : pageStart + clients.length - 1
  const hasAppliedFilters = hasClientListFilters(appliedFilters)
  const activeFiltersCount = countClientListFilters(appliedFilters)
  const availableGroupOptions = mergeStaticGroupFilterOptions(
    groupOptions,
    fallbackGroupOptions,
  )

  function updateFilter<Key extends keyof ClientListFilterValues>(
    key: Key,
    value: ClientListFilterValues[Key],
  ) {
    setDraftFilters((currentFilters) => ({
      ...currentFilters,
      [key]: value,
    }))
  }

  function applyFilters(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    setAppliedFilters(normalizeClientListFilters(draftFilters, canManage))
    setPage(1)
  }

  function resetFilters() {
    const nextFilters = createDefaultClientListFilters()
    setDraftFilters(nextFilters)
    setAppliedFilters(nextFilters)
    setPage(1)
  }

  return (
    <Stack className="dashboard-stack" data-testid="clients-screen" gap="xl">
      <ClientHero
        action={
          <ResponsiveButtonGroup>
            {canManage ? (
              <Button
                color="accent.5"
                leftSection={<IconPlus size={18} />}
                onClick={onCreate}
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
          </ResponsiveButtonGroup>
        }
        badge="Клиентская база"
        description="Ищите и фильтруйте клиентов. Для тренера список открыт только в режиме просмотра доступных записей."
        title="Клиентская база со встроенным поиском и фильтрацией"
      />

      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <MetricCard
          description={
            totalCount === null
              ? 'Количество записей в текущей выборке'
              : 'Всего найдено по текущему запросу'
          }
          label={totalCount === null ? 'Показано' : 'Найдено'}
          value={String(totalCount ?? clients.length)}
        />
        <MetricCard
          description="Активные клиенты на текущей странице"
          label="Активные сейчас"
          value={String(activeClientsCount)}
        />
        <MetricCard
          description="Клиенты на текущей странице хотя бы с одной группой"
          label="С группой"
          value={String(groupedClientsCount)}
        />
      </SimpleGrid>

      <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
        <Stack gap="lg">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Text fw={700}>Список клиентов</Text>
              <Text c="dimmed" size="sm">
                Откройте карточку клиента для просмотра деталей. Редактирование
                и архивирование доступны только управленческим ролям.
              </Text>
            </div>

            <Badge color="brand.1" radius="xl" size="lg" variant="light">
              {canManage ? 'Управление клиентами' : 'Только просмотр'}
            </Badge>
          </Group>

          <Group gap="sm" wrap="wrap">
            <Badge color="teal" radius="xl" variant="light">
              Активные: {activeClientsCount}
            </Badge>
            <Badge color="gray" radius="xl" variant="light">
              Архив: {archivedClientsCount}
            </Badge>
            <Badge color="brand.1" radius="xl" variant="light">
              Фильтров: {activeFiltersCount}
            </Badge>
          </Group>

          <Paper className="hint-card" radius="24px" withBorder>
            <form data-testid="clients-filter-form" onSubmit={applyFilters}>
              <Stack gap="lg">
                <Group justify="space-between" wrap="wrap">
                  <div>
                    <Text fw={700}>Поиск и фильтры</Text>
                    <Text c="dimmed" size="sm">
                      Поиск по ФИО работает для всех, поиск по телефону доступен
                      только management-ролям.
                    </Text>
                  </div>

                  <Badge
                    color={activeFiltersCount > 0 ? 'accent.5' : 'gray'}
                    radius="xl"
                    variant={activeFiltersCount > 0 ? 'filled' : 'light'}
                  >
                    {activeFiltersCount > 0
                      ? `Активно фильтров: ${activeFiltersCount}`
                      : 'Фильтры не заданы'}
                  </Badge>
                </Group>

                <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
                  <TextInput
                    label="Поиск по ФИО"
                    onChange={(event) =>
                      updateFilter('fullName', event.currentTarget.value)
                    }
                    placeholder="Например, Иванов"
                    value={draftFilters.fullName}
                  />
                  {canManage ? (
                    <TextInput
                      label="Телефон"
                      leftSection={<IconPhone size={16} />}
                      onChange={(event) =>
                        updateFilter('phone', event.currentTarget.value)
                      }
                      placeholder="+7 999 123-45-67"
                      value={draftFilters.phone}
                    />
                  ) : null}
                  <Select
                    clearable
                    data={availableGroupOptions}
                    label="Группа"
                    onChange={(value) => updateFilter('groupId', value)}
                    placeholder="Все группы"
                    searchable
                    value={draftFilters.groupId}
                  />
                  <Select
                    clearable
                    data={clientStatusFilterOptions}
                    label="Статус"
                    onChange={(value) =>
                      updateFilter(
                        'status',
                        (value as ClientStatus | null) ?? 'all',
                      )
                    }
                    placeholder="Любой статус"
                    value={
                      draftFilters.status === 'all' ? null : draftFilters.status
                    }
                  />
                  <Select
                    clearable
                    data={clientPaymentStatusFilterOptions}
                    label="Оплата"
                    onChange={(value) =>
                      updateFilter(
                        'paymentStatus',
                        (value as ClientPaymentStatus | null) ?? 'all',
                      )
                    }
                    placeholder="Любая оплата"
                    value={
                      draftFilters.paymentStatus === 'all'
                        ? null
                        : draftFilters.paymentStatus
                    }
                  />
                  <Select
                    data={clientListPageSizeOptions}
                    label="Размер страницы"
                    onChange={(value) => {
                      if (value) {
                        updateFilter('pageSize', value)
                      }
                    }}
                    value={draftFilters.pageSize}
                  />
                  <TextInput
                    label="Абонемент истекает с"
                    onChange={(event) =>
                      updateFilter(
                        'membershipExpiresFrom',
                        event.currentTarget.value,
                      )
                    }
                    type="date"
                    value={draftFilters.membershipExpiresFrom}
                  />
                  <TextInput
                    label="Абонемент истекает по"
                    onChange={(event) =>
                      updateFilter(
                        'membershipExpiresTo',
                        event.currentTarget.value,
                      )
                    }
                    type="date"
                    value={draftFilters.membershipExpiresTo}
                  />
                </SimpleGrid>

                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                  <Switch
                    checked={draftFilters.withoutPhoto}
                    label="Без фото"
                    onChange={(event) =>
                      updateFilter('withoutPhoto', event.currentTarget.checked)
                    }
                  />
                  <Switch
                    checked={draftFilters.withoutGroup}
                    label="Без группы"
                    onChange={(event) =>
                      updateFilter('withoutGroup', event.currentTarget.checked)
                    }
                  />
                  <Switch
                    checked={draftFilters.withoutActivePaidMembership}
                    label="Без актуального оплаченного абонемента"
                    onChange={(event) =>
                      updateFilter(
                        'withoutActivePaidMembership',
                        event.currentTarget.checked,
                      )
                    }
                  />
                </SimpleGrid>

                <Group justify="space-between" wrap="wrap">
                  <Text c="dimmed" size="sm">
                    {canManage
                      ? 'Фильтры применяются к общему клиентскому списку.'
                      : 'Для тренера список остается в режиме просмотра без телефона и действий управления.'}
                  </Text>

                  <ResponsiveButtonGroup>
                    <Button
                      leftSection={<IconSearch size={18} />}
                      type="submit"
                      variant="filled"
                    >
                      Применить
                    </Button>
                    <Button onClick={resetFilters} variant="light">
                      Сбросить
                    </Button>
                  </ResponsiveButtonGroup>
                </Group>
              </Stack>
            </form>
          </Paper>

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
                  <Text fw={700}>
                    {hasAppliedFilters
                      ? 'По текущему запросу клиенты не найдены'
                      : 'Клиенты пока не заведены'}
                  </Text>
                </Group>
                <Text c="dimmed" size="sm">
                  {hasAppliedFilters
                    ? 'Снимите часть фильтров или проверьте диапазон дат абонемента.'
                    : 'Начните с базовой карточки без абонемента и без истории посещений.'}
                </Text>
                {hasAppliedFilters ? (
                  <Group>
                    <Button onClick={resetFilters} variant="light">
                      Очистить фильтры
                    </Button>
                  </Group>
                ) : null}
              </Stack>
            </Paper>
          ) : null}

          {!loading && !error && clients.length > 0 ? (
            <Stack data-testid="clients-list" gap="md">
              <Group justify="space-between" wrap="wrap">
                <Text c="dimmed" size="sm">
                  {totalCount === null
                    ? `Страница ${page}, показано ${clients.length} записей`
                    : `Показаны ${pageStart}-${pageEnd} из ${totalCount}`}
                </Text>

                <ResponsiveButtonGroup>
                  <Button
                    disabled={loading || page <= 1}
                    leftSection={<IconChevronLeft size={16} />}
                    onClick={() =>
                      setPage((currentPage) => Math.max(1, currentPage - 1))
                    }
                    variant="default"
                  >
                    Назад
                  </Button>
                  <Badge color="gray" radius="xl" variant="light">
                    Страница {page}
                  </Badge>
                  <Button
                    disabled={loading || !hasNextPage}
                    onClick={() => setPage((currentPage) => currentPage + 1)}
                    rightSection={<IconChevronRight size={16} />}
                    variant="default"
                  >
                    Дальше
                  </Button>
                </ResponsiveButtonGroup>
              </Group>

              {clients.map((client) => (
                <Paper
                  className="list-row-card client-row-card"
                  data-testid={`client-card-${client.id}`}
                  key={client.id}
                  radius="24px"
                  withBorder
                >
                  <Stack gap="md">
                    <Group justify="space-between" wrap="wrap">
                      <Group align="flex-start" gap="md" wrap="nowrap">
                        <Avatar
                          name={client.fullName}
                          radius="xl"
                          size={56}
                          src={buildClientListPhotoUrl(client)}
                        />

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
                            {canManage ? (
                              <Badge color="sand" radius="xl" variant="light">
                                Контактов: {client.contactCount}
                              </Badge>
                            ) : null}
                          </Group>

                          {canManage ? (
                            <Text c="dimmed" size="sm">
                              Телефон: {client.phone || 'Не указан'}
                            </Text>
                          ) : null}

                          <Text c="dimmed" size="sm">
                            {client.groupCount > 0
                              ? `Группы: ${client.groups.map((group) => group.name).join(', ')}`
                              : 'Клиент пока не привязан к группам'}
                          </Text>

                          <Group gap="xs" wrap="wrap">
                            {client.membershipWarning ? (
                              <Badge
                                color={membershipStatusBadgeColor.warning}
                                radius="xl"
                                variant="light"
                              >
                                Проблема с абонементом
                              </Badge>
                            ) : client.hasActivePaidMembership ? (
                              <Badge
                                color={membershipStatusBadgeColor.clear}
                                radius="xl"
                                variant="light"
                              >
                                Абонемент позволяет посещение
                              </Badge>
                            ) : (
                              <Badge
                                color={membershipStatusBadgeColor.warning}
                                radius="xl"
                                variant="light"
                              >
                                Нужна проверка абонемента
                              </Badge>
                            )}

                            {client.hasUnpaidCurrentMembership ? (
                              <Badge
                                color={membershipStatusBadgeColor.unpaid}
                                radius="xl"
                                variant="light"
                              >
                                Не оплачено
                              </Badge>
                            ) : null}

                            {!canManage ? (
                              <Badge color="gray" radius="xl" variant="light">
                                Только просмотр
                              </Badge>
                            ) : null}
                          </Group>

                          {!canManage && client.membershipWarningMessage ? (
                            <Text c="orange.8" size="sm">
                              {client.membershipWarningMessage}
                            </Text>
                          ) : null}
                        </Stack>
                      </Group>

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
                      {canManage ? (
                        <Badge color="sand" radius="xl" variant="light">
                          Статус: {statusLabelMap[client.status]}
                        </Badge>
                      ) : null}
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
        description="Форма сохраняет базовые данные клиента, а фотографию и абонемент можно добавить после первичного сохранения карточки."
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
        description="Обновите базовые данные, контакты, группы и фотографию клиента. Абонемент и оплату можно вести в карточке клиента."
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
                  message: 'Карточка клиента обновлена без ручного refresh.',
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
        description={
          canManage
            ? 'Единая карточка клиента объединяет базовые данные, фотографию, абонемент и историю посещений.'
            : 'Карточка клиента для тренера показывает только ФИО, фотографию, доступные группы и историю посещений по назначенным группам.'
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

          {canManage ? (
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
                description="Текущий статус клиента"
                label="Статус"
                value={statusLabelMap[client.status]}
              />
            </SimpleGrid>
          ) : (
            <SimpleGrid cols={{ base: 1, md: 2 }}>
              <MetricCard
                description="Группы клиента, доступные текущему тренеру."
                label="Доступные группы"
                value={String(client.groups.length)}
              />
              <MetricCard
                description={
                  client.attendanceHistoryLoaded
                    ? 'История посещений по назначенным группам.'
                    : 'История посещений пока недоступна.'
                }
                label="История посещений"
                value={
                  client.attendanceHistoryLoaded
                    ? String(
                        client.attendanceHistoryTotalCount ??
                          client.attendanceHistory.length,
                      )
                    : '...'
                }
              />
            </SimpleGrid>
          )}

          <Paper className="surface-card surface-card--wide client-detail-card" radius="28px" withBorder>
            <Stack gap="lg">
              <Group justify="space-between" wrap="wrap">
                <div>
                  <Text fw={700}>Основные данные</Text>
                  <Text c="dimmed" size="sm">
                    {canManage
                      ? 'Базовые поля клиента, абонемент, оплата и история посещений собраны в одной карточке.'
                      : 'Для тренера карточка ограничена фото и данными, разрешенными для просмотра по назначенным группам.'}
                  </Text>
                </div>

                {canManage ? (
                  <Badge
                    color={client.status === 'Active' ? 'teal' : 'gray'}
                    radius="xl"
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
                  title="Режим тренера"
                  variant="light"
                >
                  Для вашей роли карточка показывает только фотографию, ФИО, доступные группы и историю посещений. Телефон, контакты, статус, абонемент и оплата скрыты.
                </Alert>
              ) : null}

              <ClientPhotoSection
                canUpload={canManage}
                clientId={client.id}
                clientName={client.fullName}
                onUpload={canManage ? handlePhotoUpload : undefined}
                photo={client.photo}
                previewVersion={photoVersion ?? client.photo?.uploadedAt ?? client.updatedAt}
              />

              {canManage ? (
                <SimpleGrid cols={{ base: 1, md: 2 }}>
                  <InfoItem label="Фамилия" value={client.lastName || 'Не указана'} />
                  <InfoItem label="Имя" value={client.firstName || 'Не указано'} />
                  <InfoItem label="Отчество" value={client.middleName || 'Не указано'} />
                  <InfoItem label="Телефон" value={client.phone || 'Не указан'} />
                </SimpleGrid>
              ) : null}
            </Stack>
          </Paper>

          {canManage ? (
            <ClientMembershipSection
              actionMode={membershipActionMode}
              client={client}
              pending={actionPending}
              onActionModeChange={(mode) => {
                setActionError(null)
                setMembershipActionMode((currentMode) =>
                  currentMode === mode ? null : mode,
                )
              }}
              onCancelAction={() => {
                setActionError(null)
                setMembershipActionMode(null)
              }}
              onSubmit={handleMembershipAction}
            />
          ) : null}

          <ClientAttendanceHistorySection canManage={canManage} client={client} />

          <SimpleGrid cols={{ base: 1, md: canManage ? 2 : 1 }}>
            {canManage ? (
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
            ) : null}

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
  photoSection?: ReactNode
  onSubmit: (values: ClientFormValues) => Promise<void>
  submitLabel: string
  submitting: boolean
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

        {photoSection}

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
    <Paper className="surface-card surface-card--wide page-header-card" radius="28px" withBorder>
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

type ClientPhotoSectionProps = {
  canUpload: boolean
  clientId?: string
  clientName: string
  onUpload?: (file: File) => Promise<void>
  photo: ClientPhoto | null
  previewVersion?: string | number | null
}

function ClientPhotoSection({
  canUpload,
  clientId,
  clientName,
  onUpload,
  photo,
  previewVersion,
}: ClientPhotoSectionProps) {
  const inputId = useId()
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
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
    <Paper className="hint-card client-photo-card" radius="24px" withBorder>
      <Stack gap="md">
        <Group justify="space-between" wrap="wrap">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon color="brand.7" radius="xl" size={38} variant="light">
              <IconCamera size={20} />
            </ThemeIcon>
            <div>
              <Text fw={700}>Фотография клиента</Text>
              <Text c="dimmed" size="sm">
                {canUpload
                  ? 'Загрузка и замена фото доступны главному тренеру и администратору.'
                  : clientId
                    ? 'Фото отображается, если оно уже загружено и доступно для просмотра.'
                    : 'Фото можно добавить сразу после первичного сохранения карточки клиента.'}
              </Text>
            </div>
          </Group>

          <Badge color="brand.1" radius="xl" variant="light">
            {canUpload ? 'Загрузка и просмотр' : 'Только просмотр'}
          </Badge>
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
          <Group gap="sm" wrap="wrap">
            {photo.contentType ? (
              <Badge color="sand" radius="xl" variant="light">
                {photo.contentType}
              </Badge>
            ) : null}
            {typeof photo.sizeBytes === 'number' ? (
              <Badge color="sand" radius="xl" variant="light">
                {formatFileSize(photo.sizeBytes)}
              </Badge>
            ) : null}
            {photo.uploadedAt ? (
              <Badge color="sand" radius="xl" variant="light">
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
  )
}

type ClientMembershipSectionProps = {
  actionMode: MembershipActionMode | null
  client: ClientDetails
  pending: boolean
  onActionModeChange: (mode: MembershipActionMode) => void
  onCancelAction: () => void
  onSubmit: (submission: MembershipActionSubmission) => Promise<void>
}

function ClientMembershipSection({
  actionMode,
  client,
  pending,
  onActionModeChange,
  onCancelAction,
  onSubmit,
}: ClientMembershipSectionProps) {
  const currentMembership = client.currentMembership
  const history = [...client.membershipHistory].sort(compareMembershipHistory)

  return (
    <Paper className="surface-card surface-card--wide client-detail-card" radius="28px" withBorder>
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap">
          <div>
            <Text fw={700}>Абонемент и оплата</Text>
            <Text c="dimmed" size="sm">
              Inline-сценарии этапа 6b: новая покупка, продление, исправление и отметка оплаты без отдельного экрана.
            </Text>
          </div>

          <Badge color="brand.1" radius="xl" size="lg" variant="light">
            Только для management-ролей
          </Badge>
        </Group>

        {currentMembership ? (
          <>
            <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }}>
              <InfoItem
                label="Тип абонемента"
                value={membershipTypeLabels[currentMembership.membershipType]}
              />
              <InfoItem
                label="Дата покупки"
                value={formatDateValue(currentMembership.purchaseDate)}
              />
              <InfoItem
                label="Дата окончания"
                value={formatExpirationValue(
                  currentMembership.membershipType,
                  currentMembership.expirationDate,
                )}
              />
              <InfoItem
                label="Сумма оплаты"
                value={formatCurrencyValue(currentMembership.paymentAmount)}
              />
            </SimpleGrid>

            <Group gap="sm" wrap="wrap">
              <Badge
                color={currentMembership.isPaid ? 'teal' : 'orange'}
                radius="xl"
                variant="light"
              >
                {currentMembership.isPaid ? 'Оплачен' : 'Не оплачен'}
              </Badge>
              <Badge color="sand" radius="xl" variant="light">
                {currentMembership.changeReason
                  ? formatMembershipChangeReason(currentMembership.changeReason)
                  : 'Текущая версия'}
              </Badge>
              {currentMembership.membershipType === 'SingleVisit' ? (
                <Badge
                  color={currentMembership.singleVisitUsed ? 'gray' : 'blue'}
                  radius="xl"
                  variant="light"
                >
                  {currentMembership.singleVisitUsed
                    ? 'Разовое посещение использовано'
                    : 'Разовое посещение не использовано'}
                </Badge>
              ) : null}
              {currentMembership.paidAt ? (
                <Badge color="teal" radius="xl" variant="light">
                  Оплата: {formatDateTimeValue(currentMembership.paidAt)}
                </Badge>
              ) : null}
            </Group>
          </>
        ) : (
          <Alert
            color="blue"
            icon={<IconCheck size={18} />}
            title="Текущий абонемент не задан"
            variant="light"
          >
            Клиента можно сохранить без абонемента, а затем оформить его прямо в этой карточке.
          </Alert>
        )}

        <ResponsiveButtonGroup>
          <Button
            color={actionMode === 'purchase' ? 'accent.5' : undefined}
            onClick={() => onActionModeChange('purchase')}
            variant={actionMode === 'purchase' ? 'filled' : 'light'}
          >
            Новый абонемент
          </Button>
          <Button
            disabled={!currentMembership}
            onClick={() => onActionModeChange('renew')}
            variant={actionMode === 'renew' ? 'filled' : 'light'}
          >
            Продлить
          </Button>
          <Button
            disabled={!currentMembership}
            onClick={() => onActionModeChange('correct')}
            variant={actionMode === 'correct' ? 'filled' : 'light'}
          >
            Исправить
          </Button>
          {currentMembership && !currentMembership.isPaid ? (
            <Button
              color="teal"
              onClick={() => onActionModeChange('markPayment')}
              variant={actionMode === 'markPayment' ? 'filled' : 'light'}
            >
              Отметить оплату
            </Button>
          ) : null}
        </ResponsiveButtonGroup>

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

        <Stack gap="sm">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Text fw={700}>История версий абонемента</Text>
              <Text c="dimmed" size="sm">
                Компактный список показывает, как менялись срок, сумма и статус оплаты внутри `ClientMembership`.
              </Text>
            </div>

            <Badge color="sand" radius="xl" variant="light">
              Версий: {history.length}
            </Badge>
          </Group>

          {history.length === 0 ? (
            <Text c="dimmed" size="sm">
              История абонемента появится после первого действия в карточке клиента.
            </Text>
          ) : (
            <Stack gap="sm">
              {history.map((membership) => (
                <Paper
                  className="list-row-card"
                  key={membership.id}
                  radius="24px"
                  withBorder
                >
                  <Stack gap={6}>
                    <Group justify="space-between" wrap="wrap">
                      <Group gap="sm" wrap="wrap">
                        <Text fw={700}>
                          {membershipTypeLabels[membership.membershipType]}
                        </Text>
                        <Badge radius="xl" variant="light">
                          {formatMembershipChangeReason(membership.changeReason)}
                        </Badge>
                        {membership.validTo ? null : (
                          <Badge color="teal" radius="xl" variant="light">
                            Текущая
                          </Badge>
                        )}
                      </Group>

                      <Text c="dimmed" size="sm">
                        {membership.validFrom
                          ? `Версия с ${formatDateTimeValue(membership.validFrom)}`
                          : membership.createdAt
                            ? `Создано ${formatDateTimeValue(membership.createdAt)}`
                            : 'Версия абонемента'}
                      </Text>
                    </Group>

                    <Text c="dimmed" size="sm">
                      Покупка: {formatDateValue(membership.purchaseDate)}
                      {' • '}
                      Окончание:{' '}
                      {formatExpirationValue(
                        membership.membershipType,
                        membership.expirationDate,
                      )}
                      {' • '}
                      Сумма: {formatCurrencyValue(membership.paymentAmount)}
                      {' • '}
                      {membership.isPaid ? 'Оплачен' : 'Не оплачен'}
                    </Text>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Stack>
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
    <Paper className="surface-card surface-card--wide client-detail-card" radius="28px" withBorder>
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
              <Paper className="list-row-card" key={entry.id} radius="24px" withBorder>
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
    <Paper className="hint-card" radius="24px" withBorder>
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

            <Badge color="brand.1" radius="xl" variant="light">
              {mode === 'purchase' ? 'New purchase' : 'Correction'}
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
                  : 'Поле уже заполнено по правилу этапа 6b.'
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
    <Paper className="hint-card" radius="24px" withBorder>
      <form onSubmit={form.onSubmit((values) => void submit(values))}>
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Text fw={700}>Продлить текущий абонемент</Text>
              <Text c="dimmed" size="sm">
                Тип берется из текущей версии. Срок предложен автоматически и при необходимости редактируется вручную.
              </Text>
            </div>

            <Badge color="brand.1" radius="xl" variant="light">
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
    <Paper className="hint-card" radius="24px" withBorder>
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

function buildDraftClientName(values: ClientFormValues) {
  const fullName = [values.lastName, values.firstName, values.middleName]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' ')

  return fullName || 'нового клиента'
}

function createDefaultClientListFilters(): ClientListFilterValues {
  return {
    fullName: '',
    phone: '',
    groupId: null,
    status: 'all',
    paymentStatus: 'all',
    membershipExpiresFrom: '',
    membershipExpiresTo: '',
    withoutPhoto: false,
    withoutGroup: false,
    withoutActivePaidMembership: false,
    pageSize: clientListPageSizeOptions[0].value,
  }
}

function normalizeClientListFilters(
  filters: ClientListFilterValues,
  canManage: boolean,
): ClientListFilterValues {
  const hasKnownPageSize = clientListPageSizeOptions.some(
    (option) => option.value === filters.pageSize,
  )

  return {
    fullName: filters.fullName.trim(),
    phone: canManage ? filters.phone.trim() : '',
    groupId: filters.groupId,
    status: filters.status,
    paymentStatus: filters.paymentStatus,
    membershipExpiresFrom: filters.membershipExpiresFrom,
    membershipExpiresTo: filters.membershipExpiresTo,
    withoutPhoto: filters.withoutPhoto,
    withoutGroup: filters.withoutGroup,
    withoutActivePaidMembership: filters.withoutActivePaidMembership,
    pageSize: hasKnownPageSize
      ? filters.pageSize
      : clientListPageSizeOptions[0].value,
  }
}

function hasClientListFilters(filters: ClientListFilterValues) {
  return countClientListFilters(filters) > 0
}

function countClientListFilters(filters: ClientListFilterValues) {
  let count = 0

  if (filters.fullName) {
    count += 1
  }

  if (filters.phone) {
    count += 1
  }

  if (filters.groupId) {
    count += 1
  }

  if (filters.status !== 'all') {
    count += 1
  }

  if (filters.paymentStatus !== 'all') {
    count += 1
  }

  if (filters.membershipExpiresFrom) {
    count += 1
  }

  if (filters.membershipExpiresTo) {
    count += 1
  }

  if (filters.withoutPhoto) {
    count += 1
  }

  if (filters.withoutGroup) {
    count += 1
  }

  if (filters.withoutActivePaidMembership) {
    count += 1
  }

  return count
}

function toClientListQueryParams(
  filters: ClientListFilterValues,
  page: number,
  canManage: boolean,
) {
  const pageSize = Number.parseInt(filters.pageSize, 10) || 20

  return {
    page,
    pageSize,
    fullName: filters.fullName || undefined,
    phone: canManage ? filters.phone || undefined : undefined,
    groupId: filters.groupId ?? undefined,
    status: filters.status === 'all' ? undefined : filters.status,
    paymentStatus:
      filters.paymentStatus === 'all' ? undefined : filters.paymentStatus,
    membershipExpiresFrom: filters.membershipExpiresFrom || undefined,
    membershipExpiresTo: filters.membershipExpiresTo || undefined,
    hasPhoto: filters.withoutPhoto ? false : undefined,
    hasGroup: filters.withoutGroup ? false : undefined,
    hasActivePaidMembership: filters.withoutActivePaidMembership
      ? false
      : undefined,
  }
}

function mergeClientGroupFilterOptions(
  currentOptions: ClientGroupFilterOption[],
  clients: ClientListItem[],
) {
  return mergeStaticGroupFilterOptions(
    currentOptions,
    clients.flatMap((client) =>
      client.groups.map((group) => ({
        value: group.id,
        label: group.name,
      })),
    ),
  )
}

function mergeStaticGroupFilterOptions(
  ...optionSets: ClientGroupFilterOption[][]
) {
  const optionsById = new Map<string, ClientGroupFilterOption>()

  for (const optionSet of optionSets) {
    for (const option of optionSet) {
      const value = option.value.trim()
      const label = option.label.trim()

      if (!value || !label || optionsById.has(value)) {
        continue
      }

      optionsById.set(value, {
        value,
        label,
      })
    }
  }

  return Array.from(optionsById.values()).sort((left, right) =>
    left.label.localeCompare(right.label, 'ru'),
  )
}

const statusLabelMap: Record<ClientStatus, string> = {
  Active: 'Активный',
  Archived: 'Архивный',
}
