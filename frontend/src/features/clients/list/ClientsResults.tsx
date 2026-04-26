import {
  Alert,
  Avatar,
  Badge,
  Button,
  Group,
  Paper,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconChevronLeft,
  IconChevronRight,
  IconUserHeart,
  IconUsers,
} from '@tabler/icons-react'
import { buildClientRowViewModel } from './clientListViewModel'
import type { ClientsListState } from './useClientsListState'

type ClientsResultsProps = {
  canManage: boolean
  state: ClientsListState
  onCreate: () => void
  onOpen: (clientId: string) => void
}

export function ClientsResults({
  canManage,
  state,
  onCreate,
  onOpen,
}: ClientsResultsProps) {
  if (state.loading) {
    return (
      <Stack data-testid="clients-list" gap="xs">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton className="clients-v7-row-skeleton" key={index} radius="md" />
        ))}
      </Stack>
    )
  }

  if (state.error) {
    return (
      <Alert
        color="red"
        icon={<IconAlertCircle size={18} />}
        title="Не удалось загрузить клиентов"
        variant="light"
      >
        <Stack gap="sm">
          <Text size="sm">{state.error}</Text>
          <Group>
            <Button onClick={state.reload} variant="light">
              Повторить
            </Button>
          </Group>
        </Stack>
      </Alert>
    )
  }

  if (state.clients.length === 0) {
    return (
      <Paper className="hint-card" radius="md" withBorder>
        <Stack gap="sm">
          <Group gap="xs">
            <ThemeIcon color="brand.7" radius="xl" size={30} variant="light">
              <IconUsers size={16} />
            </ThemeIcon>
            <Text fw={700}>
              {state.isFirstRunEmpty ? 'Клиентов пока нет' : 'Клиенты не найдены'}
            </Text>
          </Group>
          <Text c="dimmed" size="sm">
            {state.isFirstRunEmpty
              ? 'Создайте первую карточку клиента.'
              : 'Попробуйте изменить поиск или сбросить фильтры.'}
          </Text>
          <Group>
            {state.isFirstRunEmpty && canManage ? (
              <Button onClick={onCreate}>Новый клиент</Button>
            ) : (
              <Button onClick={state.resetFilters} variant="light">
                Сбросить фильтры
              </Button>
            )}
          </Group>
        </Stack>
      </Paper>
    )
  }

  return (
    <Stack data-testid="clients-list" gap="sm">
      <div className="clients-v7-table-header" aria-hidden="true">
        <Text size="xs">Клиент</Text>
        <Text size="xs">Статус и абонемент</Text>
        <Text size="xs">Следующий шаг</Text>
        <Text size="xs">Группа</Text>
        <Text size="xs">Визит</Text>
      </div>

      {state.clients.map((client) => {
        const row = buildClientRowViewModel(client)
        const selected = state.selectedClientId === client.id

        return (
          <Paper
            aria-label={`Выбрать клиента ${client.fullName}`}
            aria-selected={selected}
            className="clients-v7-row"
            data-selected={selected || undefined}
            data-testid={`client-card-${client.id}`}
            key={client.id}
            onClick={() => state.setSelectedClientId(client.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                state.setSelectedClientId(client.id)
              }
            }}
            role="button"
            tabIndex={0}
            withBorder
          >
            <Group className="clients-v7-row__client" gap="sm" wrap="nowrap">
              <Avatar name={client.fullName} radius="xl" src={row.photoUrl} />
              <div>
                <Text className="clients-v7-row__primary" fw={700}>
                  {client.fullName}
                </Text>
                {canManage ? (
                  <Text c="dimmed" className="clients-v7-row__secondary" size="sm">
                    {client.phone || 'Телефон не указан'}
                  </Text>
                ) : null}
              </div>
            </Group>

            <div>
              <Group gap={6} wrap="nowrap">
                <Badge
                  color={client.status === 'Active' ? 'teal' : 'gray'}
                  variant="light"
                >
                  {row.statusLabel}
                </Badge>
                <Text className="clients-v7-row__primary" size="sm">
                  {row.membershipLabel}
                </Text>
              </Group>
              <Text c="dimmed" className="clients-v7-row__secondary" size="sm">
                {row.membershipMeta}
              </Text>
            </div>

            <div>
              <Badge color={row.nextAction.tone} variant="light">
                {row.nextAction.label}
              </Badge>
              <Text c="dimmed" className="clients-v7-row__secondary" size="sm">
                {row.nextAction.description}
              </Text>
            </div>

            <Text className="clients-v7-row__primary" size="sm">
              {row.groupLabel}
            </Text>

            <Group justify="space-between" wrap="nowrap">
              <Text className="clients-v7-row__primary" size="sm">
                {row.lastVisitLabel}
              </Text>
              <Button
                leftSection={<IconUserHeart size={16} />}
                onClick={(event) => {
                  event.stopPropagation()
                  onOpen(client.id)
                }}
                size="xs"
                variant="subtle"
              >
                Открыть
              </Button>
            </Group>
          </Paper>
        )
      })}

      <Group justify="space-between" pt="xs" wrap="wrap">
        <Text c="dimmed" size="sm">
          {state.totalCount === null
            ? `Страница ${state.page}, показано ${state.clients.length}`
            : `Показаны ${state.pageStart}-${state.pageEnd} из ${state.totalCount}`}
        </Text>

        <Group gap="xs">
          <Button
            disabled={state.loading || state.page <= 1}
            leftSection={<IconChevronLeft size={16} />}
            onClick={() =>
              state.setPage((currentPage) => Math.max(1, currentPage - 1))
            }
            variant="default"
          >
            Назад
          </Button>
          <Badge color="gray" radius="xl" variant="light">
            Страница {state.page}
          </Badge>
          <Button
            disabled={state.loading || !state.hasNextPage}
            onClick={() => state.setPage((currentPage) => currentPage + 1)}
            rightSection={<IconChevronRight size={16} />}
            variant="default"
          >
            Дальше
          </Button>
        </Group>
      </Group>
    </Stack>
  )
}
