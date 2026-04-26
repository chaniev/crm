import { useState, type FormEvent } from 'react'
import {
  ActionIcon,
  Badge,
  Button,
  Drawer,
  Group,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import {
  IconAdjustmentsHorizontal,
  IconPlus,
  IconRefresh,
  IconSearch,
} from '@tabler/icons-react'
import {
  clientListPageSizeOptions,
  clientPaymentStatusFilterOptions,
  type ClientPaymentStatusFilter,
  type ClientStatusFilter,
} from './clientListFilters'
import { resolveHeaderCountsLabel } from './clientListViewModel'
import type { ClientsListState } from './useClientsListState'

type ClientsToolbarProps = {
  canManage: boolean
  state: ClientsListState
  onCreate: () => void
}

const statusOptions = [
  { value: 'Active', label: 'Активные' },
  { value: 'all', label: 'Все' },
  { value: 'Archived', label: 'Архив' },
] satisfies Array<{ value: ClientStatusFilter; label: string }>

export function ClientsToolbar({
  canManage,
  state,
  onCreate,
}: ClientsToolbarProps) {
  const [moreFiltersOpened, setMoreFiltersOpened] = useState(false)
  const countLabel = resolveHeaderCountsLabel(
    state.totalCount,
    state.activeCount,
    state.archivedCount,
    state.filters.status,
  )

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    state.applySearchNow()
  }

  return (
    <Stack gap="md">
      <Group align="flex-start" className="clients-v7-header" justify="space-between">
        <div>
          <Title order={1}>Клиенты</Title>
          <Text aria-live="polite" c="dimmed" size="sm">
            {countLabel}
          </Text>
        </div>

        <Group gap="xs" wrap="nowrap">
          <Tooltip label="Обновить список">
            <ActionIcon
              aria-label="Обновить список"
              onClick={state.reload}
              size="lg"
              variant="subtle"
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
          {canManage ? (
            <Button
              color="accent.5"
              leftSection={<IconPlus size={18} />}
              onClick={onCreate}
            >
              Новый клиент
            </Button>
          ) : null}
        </Group>
      </Group>

      <Paper className="clients-v7-toolbar" withBorder>
        <form onSubmit={submitSearch}>
          <Group align="flex-end" gap="sm" wrap="wrap">
            <TextInput
              aria-label={canManage ? 'Поиск по имени или телефону' : 'Поиск по имени'}
              className="clients-v7-toolbar__search"
              label="Поиск"
              leftSection={<IconSearch size={16} />}
              onChange={(event) => state.setSearchDraft(event.currentTarget.value)}
              placeholder={canManage ? 'Имя или телефон' : 'Имя'}
              value={state.searchDraft}
            />
            <SegmentedControl
              aria-label="Статус"
              className="clients-v7-toolbar__status"
              data={statusOptions}
              onChange={(value) => state.setStatus(value as ClientStatusFilter)}
              value={state.filters.status}
            />
            <Select
              clearable
              className="clients-v7-toolbar__group"
              data={state.availableGroupOptions}
              label="Группа"
              onChange={(value) => state.updateFilters({ groupId: value })}
              placeholder="Все группы"
              searchable
              value={state.filters.groupId}
            />
            <Button
              leftSection={<IconAdjustmentsHorizontal size={18} />}
              onClick={() => setMoreFiltersOpened(true)}
              variant={state.activeFiltersCount > 0 ? 'light' : 'default'}
            >
              Еще фильтры
              {state.activeFiltersCount > 0 ? (
                <Badge color="accent.5" ml={8} size="sm" variant="filled">
                  {state.activeFiltersCount}
                </Badge>
              ) : null}
            </Button>
          </Group>
        </form>
      </Paper>

      <Drawer
        onClose={() => setMoreFiltersOpened(false)}
        opened={moreFiltersOpened}
        position="right"
        title="Еще фильтры"
      >
        <Stack gap="md">
          <Select
            clearable
            data={clientPaymentStatusFilterOptions}
            label="Оплата"
            onChange={(value) =>
              state.updateFilters({
                paymentStatus: (value as ClientPaymentStatusFilter | null) ?? 'all',
              })
            }
            placeholder="Любая оплата"
            value={
              state.filters.paymentStatus === 'all'
                ? null
                : state.filters.paymentStatus
            }
          />
          <SimpleGrid cols={2}>
            <TextInput
              label="Истекает с"
              onChange={(event) =>
                state.updateFilters({
                  membershipExpiresFrom: event.currentTarget.value,
                })
              }
              type="date"
              value={state.filters.membershipExpiresFrom}
            />
            <TextInput
              label="Истекает по"
              onChange={(event) =>
                state.updateFilters({
                  membershipExpiresTo: event.currentTarget.value,
                })
              }
              type="date"
              value={state.filters.membershipExpiresTo}
            />
          </SimpleGrid>
          <Switch
            checked={state.filters.withoutPhoto}
            label="Без фото"
            onChange={(event) =>
              state.updateFilters({ withoutPhoto: event.currentTarget.checked })
            }
          />
          <Select
            data={clientListPageSizeOptions}
            label="Размер страницы"
            onChange={(value) => {
              if (value) {
                state.updateFilters({ pageSize: value })
              }
            }}
            value={state.filters.pageSize}
          />
          <Button onClick={state.resetFilters} variant="light">
            Сбросить фильтры
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  )
}
