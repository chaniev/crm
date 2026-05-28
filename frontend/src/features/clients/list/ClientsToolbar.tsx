import {
  Select,
  Switch,
  TextInput,
} from '@mantine/core'
import {
  IconSearch,
} from '@tabler/icons-react'
import { resources } from '../../../lib/resources'
import {
  Button,
  CompactFilterPanel,
  type CompactFilterItem,
} from '../../shared/ux'
import {
  clientListPageSizeOptions,
  clientPaymentStatusFilterOptions,
  type ClientPaymentStatusFilter,
  type ClientStatusFilter,
} from './clientListFilters'
import type { ClientsListState } from './useClientsListState'

type ClientsToolbarProps = {
  canManage: boolean
  canSeeWithoutGroup: boolean
  state: ClientsListState
}

const statusOptions = [
  { value: 'all', label: resources.clients.list.statusFilters.all },
  { value: 'Active', label: resources.clients.list.statusFilters.Active },
  { value: 'Archived', label: resources.clients.list.statusFilters.Archived },
] satisfies Array<{ value: ClientStatusFilter; label: string }>

type QuickFilterKey =
  | 'withoutMembership'
  | 'expiringSoon'
  | 'withoutGroup'
  | 'trial'

type InlineQuickFilter = {
  key: QuickFilterKey
  label: string
}

const quickFilters = [
  {
    key: 'withoutMembership',
    label: resources.clients.list.quickFilters.withoutMembership,
  },
  {
    key: 'expiringSoon',
    label: resources.clients.list.quickFilters.expiringSoon,
  },
  {
    key: 'withoutGroup',
    label: resources.clients.list.quickFilters.withoutGroup,
  },
  {
    key: 'trial',
    label: resources.clients.list.quickFilters.trial,
  },
] satisfies InlineQuickFilter[]

export function ClientsToolbar({
  canManage,
  canSeeWithoutGroup,
  state,
}: ClientsToolbarProps) {
  function updateStatus(status: ClientStatusFilter) {
    state.setStatus(status)
  }

  function toggleQuickFilter(key: QuickFilterKey) {
    state.updateFilters({
      [key]: !state.filters[key],
    })
  }

  function renderQuickFilterChip(filter: InlineQuickFilter) {
    const pressed = state.filters[filter.key]

    return (
      <Button
        aria-pressed={pressed}
        className="clients-v7-filter-chip clients-v7-quick-chip"
        data-active={pressed || undefined}
        key={filter.key}
        onClick={() => toggleQuickFilter(filter.key)}
        type="button"
        variant={pressed ? 'filled' : 'secondary'}
      >
        {filter.label}
      </Button>
    )
  }

  const visibleQuickFilters = quickFilters.filter(
    (filter) => filter.key !== 'withoutGroup' || canSeeWithoutGroup,
  )
  const primaryFilters = [
    {
      key: 'query',
      label: 'Поиск',
      render: () => (
        <TextInput
          aria-label={canManage ? 'Поиск по имени или телефону' : 'Поиск по имени'}
          className="clients-v7-filter-search"
          label="Поиск"
          leftSection={<IconSearch size={16} />}
          onChange={(event) => state.setSearchDraft(event.currentTarget.value)}
          placeholder={canManage ? 'Поиск по имени или телефону' : 'Поиск по имени'}
          value={state.searchDraft}
        />
      ),
    },
    {
      key: 'groupId',
      label: 'Группа',
      render: () => (
        <Select
          clearable
          data={state.availableGroupOptions}
          label="Группа"
          onChange={(value) => state.updateFilters({ groupId: value })}
          placeholder="Все группы"
          searchable
          value={state.filters.groupId}
        />
      ),
    },
    {
      key: 'paymentStatus',
      label: 'Оплата',
      render: () => (
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
      ),
    },
    {
      key: 'membershipExpiresFrom',
      label: 'Истекает с',
      render: () => (
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
      ),
    },
    ...visibleQuickFilters.map((filter) => ({
      key: filter.key,
      label: filter.label,
      render: () => renderQuickFilterChip(filter),
    })),
  ] satisfies CompactFilterItem[]
  const secondaryFilters = [
    {
      key: 'status',
      label: 'Статус',
      render: () => (
        <Select
          data={statusOptions}
          label="Статус"
          onChange={(value) => updateStatus((value as ClientStatusFilter | null) ?? 'all')}
          placeholder="Все статусы"
          value={state.filters.status}
        />
      ),
    },
    {
      key: 'membershipExpiresTo',
      label: 'Истекает по',
      render: () => (
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
      ),
    },
    {
      key: 'withoutPhoto',
      label: 'Без фото',
      render: () => (
        <Switch
          checked={state.filters.withoutPhoto}
          label="Без фото"
          onChange={(event) =>
            state.updateFilters({ withoutPhoto: event.currentTarget.checked })
          }
        />
      ),
    },
    {
      key: 'pageSize',
      label: 'Размер страницы',
      render: () => (
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
      ),
    },
  ] satisfies CompactFilterItem[]

  return (
    <CompactFilterPanel
      className="clients-v7-filter-panel"
      data-testid="clients-filter-panel"
      onReset={state.resetFilters}
      primary={primaryFilters}
      secondary={secondaryFilters}
    />
  )
}
