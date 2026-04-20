import { useEffect, useState } from 'react'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconAlertCircle,
  IconCalendarEvent,
  IconCheck,
  IconClockHour4,
  IconCreditCardOff,
  IconRefresh,
  IconUsers,
  IconUsersGroup,
} from '@tabler/icons-react'
import {
  buildClientPhotoUrl,
  getAttendanceGroupClients,
  getAttendanceGroups,
  saveAttendanceMarks,
  type AttendanceClient,
  type AttendanceGroup,
  type AttendanceRosterResponse,
  type AuthenticatedUser,
} from '../../lib/api'

type AttendanceScreenProps = {
  user: AuthenticatedUser
}
export function AttendanceScreen({ user }: AttendanceScreenProps) {
  const [groups, setGroups] = useState<AttendanceGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [groupsError, setGroupsError] = useState<string | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [trainingDate, setTrainingDate] = useState(() => formatDateInputValue())
  const [roster, setRoster] = useState<AttendanceRosterResponse | null>(null)
  const [rosterLoading, setRosterLoading] = useState(false)
  const [rosterError, setRosterError] = useState<string | null>(null)
  const [pendingClientIds, setPendingClientIds] = useState<Record<string, boolean>>(
    {},
  )

  useEffect(() => {
    const controller = new AbortController()

    async function loadGroups() {
      setGroupsLoading(true)
      setGroupsError(null)

      try {
        const response = await getAttendanceGroups(controller.signal)

        if (controller.signal.aborted) {
          return
        }

        setGroups(response)
        setSelectedGroupId((currentGroupId) => {
          if (currentGroupId && response.some((group) => group.id === currentGroupId)) {
            return currentGroupId
          }

          return response[0]?.id ?? null
        })
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setGroups([])
        setGroupsError(
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить доступные группы для посещений.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setGroupsLoading(false)
        }
      }
    }

    void loadGroups()

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!selectedGroupId) {
      setRoster(null)
      setRosterError(null)
      setRosterLoading(false)
      return
    }

    const rosterGroupId = selectedGroupId
    const controller = new AbortController()

    async function loadRoster() {
      setRosterLoading(true)
      setRosterError(null)

      try {
        const response = await getAttendanceGroupClients(
          rosterGroupId,
          trainingDate,
          controller.signal,
        )

        if (controller.signal.aborted) {
          return
        }

        setRoster(response)
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setRoster(null)
        setRosterError(
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить клиентов группы на выбранную дату.',
        )
      } finally {
        if (!controller.signal.aborted) {
          setRosterLoading(false)
        }
      }
    }

    void loadRoster()

    return () => controller.abort()
  }, [selectedGroupId, trainingDate])

  async function handleRefreshRoster() {
    if (!selectedGroupId) {
      return
    }

    setRosterLoading(true)
    setRosterError(null)

    try {
      const response = await getAttendanceGroupClients(selectedGroupId, trainingDate)
      setRoster(response)
    } catch (error) {
      setRosterError(
        error instanceof Error
          ? error.message
          : 'Не удалось обновить список клиентов группы.',
      )
    } finally {
      setRosterLoading(false)
    }
  }

  async function handleToggleAttendance(client: AttendanceClient, isPresent: boolean) {
    if (!selectedGroupId) {
      return
    }

    setPendingClientIds((current) => ({
      ...current,
      [client.id]: true,
    }))
    setRoster((currentRoster) =>
      currentRoster
        ? {
            ...currentRoster,
            clients: currentRoster.clients.map((item) =>
              item.id === client.id
                ? {
                    ...item,
                    isPresent,
                  }
                : item,
            ),
          }
        : currentRoster,
    )

    try {
      await saveAttendanceMarks(selectedGroupId, {
        trainingDate,
        attendanceMarks: [
          {
            clientId: client.id,
            isPresent,
          },
        ],
      })

      const refreshedRoster = await getAttendanceGroupClients(
        selectedGroupId,
        trainingDate,
      )
      setRoster(refreshedRoster)
    } catch (error) {
      try {
        const refreshedRoster = await getAttendanceGroupClients(
          selectedGroupId,
          trainingDate,
        )
        setRoster(refreshedRoster)
      } catch {
        setRosterError('Не удалось синхронизировать отметки посещения.')
      }

      notifications.show({
        title: 'Посещение не сохранено',
        message:
          error instanceof Error
            ? error.message
            : 'Не удалось сохранить отметку посещения.',
        color: 'red',
      })
    } finally {
      setPendingClientIds((current) => {
        const nextState = { ...current }
        delete nextState[client.id]
        return nextState
      })
    }
  }

  const groupOptions = groups.map((group) => ({
    value: group.id,
    label: group.name,
  }))
  const selectedGroup =
    groups.find((group) => group.id === selectedGroupId) ?? null
  const scopeBadgeLabel =
    user.role === 'Coach'
      ? `Назначенных групп: ${groups.length}`
      : 'Любая доступная группа'

  return (
    <Stack className="dashboard-stack" data-testid="attendance-screen" gap="xl">
      <Paper className="surface-card surface-card--wide page-header-card" radius="28px" withBorder>
        <Stack className="page-header-card__content" gap="md">
          <Group gap="sm" wrap="wrap">
            <Badge color="accent.5" radius="xl" size="lg" variant="filled">
              Этап 7
            </Badge>
            <Badge color="brand.1" radius="xl" size="lg" variant="light">
              Экран посещений
            </Badge>
            <Badge color="sand" radius="xl" size="lg" variant="light">
              {scopeBadgeLabel}
            </Badge>
          </Group>

          <Stack gap="sm">
            <Title className="page-header-card__title" order={1}>
              Отметка посещений работает как отдельный mobile-first сценарий
            </Title>
            <Text className="page-header-card__description" size="sm">
              Один экран для `HeadCoach` и `Coach`: выберите группу и дату, затем
              быстро проставьте присутствие по клиентам, не смешивая этот flow со
              списком клиентов.
            </Text>
          </Stack>
        </Stack>
      </Paper>

      <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
        <Stack gap="lg">
          <Group justify="space-between" wrap="wrap">
            <div>
              <Text fw={700}>Фильтр посещений</Text>
              <Text c="dimmed" size="sm">
                Выбор группы и даты определяет roster и scope разрешенной отметки.
              </Text>
            </div>

            <Button
              leftSection={<IconRefresh size={18} />}
              loading={rosterLoading && Boolean(roster)}
              onClick={handleRefreshRoster}
              variant="light"
            >
              Обновить
            </Button>
          </Group>

          {groupsError ? (
            <Alert
              color="red"
              icon={<IconAlertCircle size={18} />}
              title="Группы для посещений не загрузились"
              variant="light"
            >
              {groupsError}
            </Alert>
          ) : null}

          {groupsLoading ? (
            <Group justify="center" py="xl">
              <Loader color="brand.7" />
            </Group>
          ) : null}

          {!groupsLoading && !groupsError && groups.length === 0 ? (
            <Paper className="hint-card attendance-empty-card" radius="24px" withBorder>
              <Stack gap="sm">
                <Group gap="xs" wrap="nowrap">
                  <ThemeIcon color="brand.7" radius="xl" size={34} variant="light">
                    <IconUsersGroup size={18} />
                  </ThemeIcon>
                  <div>
                    <Text fw={700}>
                      {user.role === 'Coach'
                        ? 'Назначенные группы отсутствуют'
                        : 'Доступные группы пока отсутствуют'}
                    </Text>
                    <Text c="dimmed" size="sm">
                      {user.role === 'Coach'
                        ? 'Когда backend назначит вам группу, экран посещений автоматически начнет показывать рабочий список.'
                        : 'Создайте группу и добавьте в нее клиентов, чтобы открыть сценарий отметки посещений.'}
                    </Text>
                  </div>
                </Group>
              </Stack>
            </Paper>
          ) : null}

          {!groupsLoading && !groupsError && groups.length > 0 ? (
            <div className="attendance-toolbar" data-testid="attendance-toolbar">
              <Select
                data={groupOptions}
                label="Группа"
                onChange={setSelectedGroupId}
                placeholder="Выберите группу"
                radius="xl"
                searchable
                value={selectedGroupId}
              />
              <TextInput
                label="Дата тренировки"
                onChange={(event) => setTrainingDate(event.currentTarget.value)}
                radius="xl"
                type="date"
                value={trainingDate}
              />
            </div>
          ) : null}
        </Stack>
      </Paper>

      {!groupsLoading && !groupsError && selectedGroup ? (
        <Paper className="surface-card surface-card--wide" radius="28px" withBorder>
          <Stack gap="lg">
            <Group justify="space-between" wrap="wrap">
              <Stack gap={4}>
                <Group gap="sm" wrap="wrap">
                  <Text fw={700}>Клиенты группы {selectedGroup.name}</Text>
                  {selectedGroup.clientCount !== undefined ? (
                    <Badge color="brand.1" radius="xl" variant="light">
                      {selectedGroup.clientCount} клиентов
                    </Badge>
                  ) : null}
                </Group>

                <Group c="dimmed" gap="md" wrap="wrap">
                  {selectedGroup.trainingStartTime ? (
                    <Group gap={6} wrap="nowrap">
                      <IconClockHour4 size={16} />
                      <Text size="sm">{selectedGroup.trainingStartTime}</Text>
                    </Group>
                  ) : null}
                  {selectedGroup.scheduleText ? (
                    <Group gap={6} wrap="nowrap">
                      <IconCalendarEvent size={16} />
                      <Text size="sm">{selectedGroup.scheduleText}</Text>
                    </Group>
                  ) : null}
                </Group>
              </Stack>

              <Badge color="sand" radius="xl" size="lg" variant="light">
                Дата: {formatDateLabel(trainingDate)}
              </Badge>
            </Group>

            {rosterError ? (
              <Alert
                color="red"
                icon={<IconAlertCircle size={18} />}
                title="Список клиентов не загрузился"
                variant="light"
              >
                {rosterError}
              </Alert>
            ) : null}

            {rosterLoading && !roster ? (
              <Group justify="center" py="xl">
                <Loader color="brand.7" />
              </Group>
            ) : null}

            {!rosterLoading && !rosterError && roster && roster.clients.length === 0 ? (
              <Paper className="hint-card attendance-empty-card" radius="24px" withBorder>
                <Stack gap="sm">
                  <Group gap="xs" wrap="nowrap">
                    <ThemeIcon color="brand.7" radius="xl" size={34} variant="light">
                      <IconUsers size={18} />
                    </ThemeIcon>
                    <div>
                      <Text fw={700}>В выбранной группе пока нет клиентов</Text>
                      <Text c="dimmed" size="sm">
                        Состав группы на эту дату пуст. Как только клиент появится в
                        группе, его можно будет отметить на этом экране.
                      </Text>
                    </div>
                  </Group>
                </Stack>
              </Paper>
            ) : null}

            {roster ? (
              <Stack data-testid="attendance-roster" gap="md">
                {roster.clients.map((client) => (
                  <AttendanceClientCard
                    client={client}
                    key={client.id}
                    onToggle={handleToggleAttendance}
                    pending={Boolean(pendingClientIds[client.id])}
                  />
                ))}
              </Stack>
            ) : null}
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  )
}

type AttendanceClientCardProps = {
  client: AttendanceClient
  pending: boolean
  onToggle: (client: AttendanceClient, isPresent: boolean) => Promise<void>
}

function AttendanceClientCard({
  client,
  pending,
  onToggle,
}: AttendanceClientCardProps) {
  const photoUrl =
    client.photo && client.id
      ? buildClientPhotoUrl(
          client.id,
          client.photo.uploadedAt ?? client.photo.path ?? 'attendance',
        )
      : null
  const statusLabel = client.membershipWarning
    ? 'Есть предупреждение по абонементу'
    : client.hasActivePaidMembership
      ? 'Отметка доступна на выбранную дату'
      : 'Нужна проверка статуса абонемента'

  return (
    <Paper
      className="list-row-card attendance-client-card"
      data-testid={`attendance-client-card-${client.id}`}
      radius="24px"
      withBorder
    >
      <div className="attendance-client-row">
        <Group align="flex-start" gap="md" wrap="nowrap">
          <Avatar
            className="attendance-client-avatar"
            name={client.fullName}
            radius="xl"
            size={56}
            src={photoUrl}
          />

          <Stack className="attendance-client-main" gap={10}>
            <div>
              <Text fw={700}>{client.fullName}</Text>
              <Text c="dimmed" size="sm">
                {statusLabel}
              </Text>
            </div>

            {client.groups.length > 0 ? (
              <Group gap="xs" wrap="wrap">
                {client.groups.map((group) => (
                  <Badge color="brand.1" key={group.id} radius="xl" variant="light">
                    {group.name}
                  </Badge>
                ))}
              </Group>
            ) : null}

            <Group gap="xs" wrap="wrap">
              {client.membershipWarning ? (
                <Badge color="yellow" radius="xl" variant="light">
                  Проблема с абонементом
                </Badge>
              ) : (
                <Badge color="teal" radius="xl" variant="light">
                  Абонемент позволяет отметку
                </Badge>
              )}

              {client.hasUnpaidCurrentMembership ? (
                <Tooltip
                  label="Текущий абонемент не оплачен, но отметка посещения разрешена."
                  multiline
                  withArrow
                >
                  <Badge
                    color="red"
                    leftSection={<IconCreditCardOff size={14} />}
                    radius="xl"
                    variant="light"
                  >
                    Не оплачено
                  </Badge>
                </Tooltip>
              ) : null}

              {!client.hasActivePaidMembership && !client.hasUnpaidCurrentMembership ? (
                <Badge color="orange" radius="xl" variant="light">
                  Нужна проверка абонемента
                </Badge>
              ) : null}
            </Group>

            {client.membershipWarningMessage ? (
              <Text c="yellow.8" size="sm">
                {client.membershipWarningMessage}
              </Text>
            ) : null}
          </Stack>
        </Group>

        <Switch
          aria-label={`Отметка посещения для клиента ${client.fullName}`}
          checked={client.isPresent}
          className="attendance-client-switch"
          disabled={pending}
          label={client.isPresent ? 'Присутствовал' : 'Отсутствовал'}
          onChange={(event) =>
            void onToggle(client, event.currentTarget.checked)
          }
          size="lg"
          thumbIcon={
            client.isPresent ? <IconCheck size={12} stroke={3} /> : undefined
          }
        />
      </div>
    </Paper>
  )
}

function formatDateInputValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatDateLabel(value: string) {
  if (!value) {
    return 'Дата не выбрана'
  }

  const [year, month, day] = value.split('-')
  if (!year || !month || !day) {
    return value
  }

  return `${day}.${month}.${year}`
}
